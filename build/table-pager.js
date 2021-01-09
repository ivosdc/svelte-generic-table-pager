(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.GenericTablePager = factory());
}(this, (function () { 'use strict';

    function noop() { }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function to_number(value) {
        return value === '' ? null : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }
    class HtmlTag {
        constructor(anchor = null) {
            this.a = anchor;
            this.e = this.n = null;
        }
        m(html, target, anchor = null) {
            if (!this.e) {
                this.e = element(target.nodeName);
                this.t = target;
                this.h(html);
            }
            this.i(anchor);
        }
        h(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(this.t, this.n[i], anchor);
            }
        }
        p(html) {
            this.d();
            this.h(html);
            this.i(this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }
    function attribute_to_object(attributes) {
        const result = {};
        for (const attribute of attributes) {
            result[attribute.name] = attribute.value;
        }
        return result;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    let SvelteElement;
    if (typeof HTMLElement === 'function') {
        SvelteElement = class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
                const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
                callbacks.push(callback);
                return () => {
                    const index = callbacks.indexOf(callback);
                    if (index !== -1)
                        callbacks.splice(index, 1);
                };
            }
            $set($$props) {
                if (this.$$set && !is_empty($$props)) {
                    this.$$.skip_bound = true;
                    this.$$set($$props);
                    this.$$.skip_bound = false;
                }
            }
        };
    }

    const iconLeft =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';

    const iconRight =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';

    class SvelteGenericCrudTableService {

        constructor(table_config, shadowed) {
            this.name = table_config.name;
            this.table_config = table_config;
            this.shadowed = shadowed;
        }

        getKey(elem) {
            return elem[0];
        }

        makeCapitalLead(elem) {
            return elem[0].toUpperCase() + elem.substr(1);
        }

        getValue(elem) {
            return elem[1];
        }


        resetEditMode(id) {
            if (this.shadowed) {
                this.table_config.columns_setting.forEach((toEdit) => {
                    if (this.isEditField(toEdit.name)) {
                        document.querySelector('crud-table').shadowRoot.getElementById(this.name + toEdit.name + id).classList.add("hidden");
                        document.querySelector('crud-table').shadowRoot.getElementById(this.name + toEdit.name + id).classList.remove("shown");
                        document.querySelector('crud-table').shadowRoot.getElementById(this.name + toEdit.name + id + ':disabled').classList.add("shown");
                        document.querySelector('crud-table').shadowRoot.getElementById(this.name + toEdit.name + id + ':disabled').classList.remove("hidden");
                    }
                });
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-default' + id).classList.remove('hidden');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-default' + id).classList.add('shown');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-edit' + id).classList.remove('shown');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-edit' + id).classList.add('hidden');
            } else {
                this.table_config.columns_setting.forEach((toEdit) => {
                    if (this.isEditField(toEdit.name)) {
                        document.getElementById(this.name + toEdit.name + id).classList.add("hidden");
                        document.getElementById(this.name + toEdit.name + id).classList.remove("shown");
                        document.getElementById(this.name + toEdit.name + id + ':disabled').classList.add("shown");
                        document.getElementById(this.name + toEdit.name + id + ':disabled').classList.remove("hidden");
                    }
                });
                document.getElementById(this.name + 'options-default' + id).classList.remove('hidden');
                document.getElementById(this.name + 'options-default' + id).classList.add('shown');
                document.getElementById(this.name + 'options-edit' + id).classList.remove('shown');
                document.getElementById(this.name + 'options-edit' + id).classList.add('hidden');
            }
        }

        resetDeleteMode(id) {
            if (this.shadowed) {
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-default' + id).classList.remove('hidden');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-default' + id).classList.add('shown');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-delete' + id).classList.remove('shown');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-delete' + id).classList.add('hidden');
            } else {
                document.getElementById(this.name + 'options-default' + id).classList.remove('hidden');
                document.getElementById(this.name + 'options-default' + id).classList.add('shown');
                document.getElementById(this.name + 'options-delete' + id).classList.remove('shown');
                document.getElementById(this.name + 'options-delete' + id).classList.add('hidden');
            }
        }

        setEditMode(id) {
            if (this.shadowed) {
                this.table_config.columns_setting.forEach((toEdit) => {
                    if (this.isEditField(toEdit.name)) {
                        document.querySelector('crud-table').shadowRoot.getElementById(this.name + toEdit.name + id + ':disabled').classList.add("hidden");
                        document.querySelector('crud-table').shadowRoot.getElementById(this.name + toEdit.name + id + ':disabled').classList.remove("shown");
                        document.querySelector('crud-table').shadowRoot.getElementById(this.name + toEdit.name + id).classList.add("shown");
                        document.querySelector('crud-table').shadowRoot.getElementById(this.name + toEdit.name + id).classList.remove("hidden");
                    }
                });
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-default' + id).classList.add('hidden');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-default' + id).classList.remove('shown');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-edit' + id).classList.remove('hidden');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-edit' + id).classList.add('shown');
            } else {
                this.table_config.columns_setting.forEach((toEdit) => {
                    if (this.isEditField(toEdit.name)) {
                        document.getElementById(this.name + toEdit.name + id + ":disabled").classList.add("hidden");
                        document.getElementById(this.name + toEdit.name + id + ":disabled").classList.remove("shown");
                        document.getElementById(this.name + toEdit.name + id).classList.add("shown");
                        document.getElementById(this.name + toEdit.name + id).classList.remove("hidden");
                    }
                });
                document.getElementById(this.name + 'options-default' + id).classList.add('hidden');
                document.getElementById(this.name + 'options-default' + id).classList.remove('shown');
                document.getElementById(this.name + 'options-edit' + id).classList.remove('hidden');
                document.getElementById(this.name + 'options-edit' + id).classList.add('shown');
            }
        }

        setDeleteMode(id) {
            if (this.shadowed) {
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-default' + id).classList.add('hidden');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-default' + id).classList.remove('shown');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-delete' + id).classList.remove('hidden');
                document.querySelector('crud-table').shadowRoot.getElementById(this.name + 'options-delete' + id).classList.add('shown');
            } else {
                document.getElementById(this.name + 'options-default' + id).classList.add('hidden');
                document.getElementById(this.name + 'options-default' + id).classList.remove('shown');
                document.getElementById(this.name + 'options-delete' + id).classList.remove('hidden');
                document.getElementById(this.name + 'options-delete' + id).classList.add('shown');
            }
        }

        gatherUpdates(id, table) {
            const body = table[id];
            this.table_config.columns_setting.forEach((elem) => {
                if (elem.show) {
                    if (this.shadowed) {
                        body[elem.name] = document.querySelector('crud-table').shadowRoot
                            .getElementById(this.name + elem.name + id).value;
                    } else {
                        body[elem.name] = document.getElementById(this.name + elem.name + id).value;
                    }
                }
            });
            return body;
        }

        resetRawValues(id, table) {
            this.table_config.columns_setting.forEach((elem) => {
                if (elem.show) {
                    if (this.shadowed) {
                        document.querySelector('crud-table').shadowRoot.getElementById(this.name + elem.name + id).value = table[id][elem.name];
                    } else {
                        document.getElementById(this.name + elem.name + id).value = table[id][elem.name];
                    }
                }
            });
        }


        isShowField(field) {
            return (this.getColumnSetting('show', field, false) !== undefined) ? this.getColumnSetting('show', field, false) : false;
        }

        isEditField(field) {
            return (this.isShowField(field)) ? this.getColumnSetting('edit', field, false) : false;
        }

        getShowFieldWidth(field) {
            return (this.isShowField(field)) ? this.getColumnSetting('width', field, '100px') : 0;
        }

        getColumnSetting(attr, column, preset) {
            let column_setting = [];
            this.table_config.columns_setting.forEach((elem) => {
                if (elem.name === column) {
                    column_setting = elem;
                }
            });

            return (column_setting[attr] !== undefined) ? column_setting[attr] : preset;
        }
    }

    const icontrash = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32">\n' +
        '<path d="M6 32h20l2-22h-24zM20 4v-4h-8v4h-10v6l2-2h24l2 2v-6h-10zM18 4h-4v-2h4v2z"></path>\n' +
        '</svg>';
    const iconedit = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32">\n' +
        '<path d="M12 20l4-2 14-14-2-2-14 14-2 4zM9.041 27.097c-0.989-2.085-2.052-3.149-4.137-4.137l3.097-8.525 4-2.435 12-12h-6l-12 12-6 20 20-6 12-12v-6l-12 12-2.435 4z"></path>\n' +
        '</svg>';
    const iconsave = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32">\n' +
        '<path d="M28 0h-28v32h32v-28l-4-4zM16 4h4v8h-4v-8zM28 28h-24v-24h2v10h18v-10h2.343l1.657 1.657v22.343z"></path>\n' +
        '</svg>';
    const iconsend = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512">\n' +
        '<path d="M476 3.2L12.5 270.6c-18.1 10.4-15.8 35.6 2.2 43.2L121 358.4l287.3-253.2c5.5-4.9 13.3 2.6 8.6 8.3L176 407v80.5c0 23.6 28.5 32.9 42.5 15.8L282 426l124.6 52.2c14.2 6 30.4-2.9 33-18.2l72-432C515 7.8 493.3-6.8 476 3.2z"/>\n' +
        '</svg>';
    const iconcancel = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32">\n' +
        '<path d="M31.708 25.708c-0-0-0-0-0-0l-9.708-9.708 9.708-9.708c0-0 0-0 0-0 0.105-0.105 0.18-0.227 0.229-0.357 0.133-0.356 0.057-0.771-0.229-1.057l-4.586-4.586c-0.286-0.286-0.702-0.361-1.057-0.229-0.13 0.048-0.252 0.124-0.357 0.228 0 0-0 0-0 0l-9.708 9.708-9.708-9.708c-0-0-0-0-0-0-0.105-0.104-0.227-0.18-0.357-0.228-0.356-0.133-0.771-0.057-1.057 0.229l-4.586 4.586c-0.286 0.286-0.361 0.702-0.229 1.057 0.049 0.13 0.124 0.252 0.229 0.357 0 0 0 0 0 0l9.708 9.708-9.708 9.708c-0 0-0 0-0 0-0.104 0.105-0.18 0.227-0.229 0.357-0.133 0.355-0.057 0.771 0.229 1.057l4.586 4.586c0.286 0.286 0.702 0.361 1.057 0.229 0.13-0.049 0.252-0.124 0.357-0.229 0-0 0-0 0-0l9.708-9.708 9.708 9.708c0 0 0 0 0 0 0.105 0.105 0.227 0.18 0.357 0.229 0.356 0.133 0.771 0.057 1.057-0.229l4.586-4.586c0.286-0.286 0.362-0.702 0.229-1.057-0.049-0.13-0.124-0.252-0.229-0.357z"></path>\n' +
        '</svg>';
    const icondetail = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32">\n' +
        '<path d="M14 9.5c0-0.825 0.675-1.5 1.5-1.5h1c0.825 0 1.5 0.675 1.5 1.5v1c0 0.825-0.675 1.5-1.5 1.5h-1c-0.825 0-1.5-0.675-1.5-1.5v-1z"></path>\n' +
        '<path d="M20 24h-8v-2h2v-6h-2v-2h6v8h2z"></path>\n' +
        '<path d="M16 0c-8.837 0-16 7.163-16 16s7.163 16 16 16 16-7.163 16-16-7.163-16-16-16zM16 29c-7.18 0-13-5.82-13-13s5.82-13 13-13 13 5.82 13 13-5.82 13-13 13z"></path>\n' +
        '</svg>';
    const iconcreate = '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32">\n' +
        '<path d="M31 12h-11v-11c0-0.552-0.448-1-1-1h-6c-0.552 0-1 0.448-1 1v11h-11c-0.552 0-1 0.448-1 1v6c0 0.552 0.448 1 1 1h11v11c0 0.552 0.448 1 1 1h6c0.552 0 1-0.448 1-1v-11h11c0.552 0 1-0.448 1-1v-6c0-0.552-0.448-1-1-1z"></path>\n' +
        '</svg>';

    /* node_modules/svelte-generic-crud-table/src/SvelteGenericCrudTable.svelte generated by Svelte v3.31.2 */

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[33] = list[i];
    	child_ctx[35] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[36] = list[i];
    	child_ctx[38] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[39] = list[i];
    	child_ctx[41] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[39] = list[i];
    	child_ctx[43] = i;
    	return child_ctx;
    }

    // (169:4) {#if (table_data !== undefined)}
    function create_if_block(ctx) {
    	let show_if = Array.isArray(/*table_data*/ ctx[0]);
    	let if_block_anchor;
    	let if_block = show_if && create_if_block_1(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*table_data*/ 1) show_if = Array.isArray(/*table_data*/ ctx[0]);

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    // (171:8) {#if Array.isArray(table_data)}
    function create_if_block_1(ctx) {
    	let div2;
    	let div1;
    	let t0;
    	let div0;
    	let show_if = /*options*/ ctx[3].includes(CREATE);
    	let t1;
    	let each_blocks = [];
    	let each1_lookup = new Map();
    	let each_value_3 = /*table_config*/ ctx[1].columns_setting;
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks_1[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	let if_block = show_if && create_if_block_11(ctx);
    	let each_value = /*table_data*/ ctx[0];
    	const get_key = ctx => /*tableRow*/ ctx[33];

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each1_lookup.set(key, each_blocks[i] = create_each_block(key, child_ctx));
    	}

    	return {
    		c() {
    			div2 = element("div");
    			div1 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t0 = space();
    			div0 = element("div");
    			if (if_block) if_block.c();
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr(div0, "id", "labelOptions");
    			attr(div0, "class", "td headline");
    			attr(div1, "class", "thead");
    			set_style(div1, "max-height", "1.3em");
    			attr(div2, "class", "table");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div1);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div1, null);
    			}

    			append(div1, t0);
    			append(div1, div0);
    			if (if_block) if_block.m(div0, null);
    			append(div2, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*genericCrudTable, table_config, setWidth, handleResize, handleSort*/ 90130) {
    				each_value_3 = /*table_config*/ ctx[1].columns_setting;
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_3(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(div1, t0);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_3.length;
    			}

    			if (dirty[0] & /*options*/ 8) show_if = /*options*/ ctx[3].includes(CREATE);

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_11(ctx);
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty[0] & /*table_config, table_data, name, handleDeleteConfirmation, handleCancelDelete, options, handleCancelEdit, handleEditConfirmation, handleDetails, handleEdit, handleDelete, genericCrudTable, getWidth*/ 38911) {
    				each_value = /*table_data*/ ctx[0];
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each1_lookup, div2, destroy_block, create_each_block, null, get_each_context);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div2);
    			destroy_each(each_blocks_1, detaching);
    			if (if_block) if_block.d();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}
    		}
    	};
    }

    // (175:20) {#each table_config.columns_setting as elem, index}
    function create_each_block_3(ctx) {
    	let div;
    	let span;
    	let t_value = /*genericCrudTable*/ ctx[4].makeCapitalLead(/*elem*/ ctx[39].name) + "";
    	let t;
    	let span_aria_label_value;
    	let div_class_value;
    	let div_style_value;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[18](/*elem*/ ctx[39], ...args);
    	}

    	return {
    		c() {
    			div = element("div");
    			span = element("span");
    			t = text(t_value);
    			attr(span, "aria-label", span_aria_label_value = "Sort" + /*elem*/ ctx[39].name);
    			attr(div, "id", ctx[43]);

    			attr(div, "class", div_class_value = "td headline " + (/*genericCrudTable*/ ctx[4].isShowField(/*elem*/ ctx[39].name) === false
    			? "hidden"
    			: "shown"));

    			attr(div, "style", div_style_value = /*setWidth*/ ctx[16](/*elem*/ ctx[39], /*index*/ ctx[43]));
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, span);
    			append(span, t);

    			if (!mounted) {
    				dispose = [
    					listen(span, "click", click_handler),
    					listen(div, "mousedown", /*handleResize*/ ctx[14]),
    					listen(div, "mouseup", /*handleResize*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*genericCrudTable, table_config*/ 18 && t_value !== (t_value = /*genericCrudTable*/ ctx[4].makeCapitalLead(/*elem*/ ctx[39].name) + "")) set_data(t, t_value);

    			if (dirty[0] & /*table_config*/ 2 && span_aria_label_value !== (span_aria_label_value = "Sort" + /*elem*/ ctx[39].name)) {
    				attr(span, "aria-label", span_aria_label_value);
    			}

    			if (dirty[0] & /*genericCrudTable, table_config*/ 18 && div_class_value !== (div_class_value = "td headline " + (/*genericCrudTable*/ ctx[4].isShowField(/*elem*/ ctx[39].name) === false
    			? "hidden"
    			: "shown"))) {
    				attr(div, "class", div_class_value);
    			}

    			if (dirty[0] & /*table_config*/ 2 && div_style_value !== (div_style_value = /*setWidth*/ ctx[16](/*elem*/ ctx[39], /*index*/ ctx[43]))) {
    				attr(div, "style", div_style_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (190:24) {#if options.includes(CREATE)}
    function create_if_block_11(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", "options blue");
    			attr(div, "title", "Create");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			div.innerHTML = iconcreate;

    			if (!mounted) {
    				dispose = listen(div, "click", /*handleCreate*/ ctx[11]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (205:32) {#if (column_order.name === genericCrudTable.getKey(elem))}
    function create_if_block_9(ctx) {
    	let div1;
    	let div0;
    	let div0_id_value;
    	let div0_aria_label_value;
    	let t;
    	let textarea;
    	let textarea_id_value;
    	let textarea_aria_label_value;
    	let textarea_value_value;
    	let div1_class_value;

    	function select_block_type(ctx, dirty) {
    		if (/*column_order*/ ctx[36].type === "html") return create_if_block_10;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	return {
    		c() {
    			div1 = element("div");
    			div0 = element("div");
    			if_block.c();
    			t = space();
    			textarea = element("textarea");
    			attr(div0, "id", div0_id_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + ":disabled");
    			attr(div0, "class", "td-disabled shown");
    			attr(div0, "aria-label", div0_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + ":disabled");
    			attr(textarea, "id", textarea_id_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35]);
    			attr(textarea, "class", "hidden");
    			attr(textarea, "aria-label", textarea_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35]);
    			textarea.value = textarea_value_value = /*table_data*/ ctx[0][/*i*/ ctx[35]][/*column_order*/ ctx[36].name];
    			attr(div1, "id", ctx[41] + "-" + /*j*/ ctx[38]);

    			attr(div1, "class", div1_class_value = "td " + (/*genericCrudTable*/ ctx[4].isShowField(/*column_order*/ ctx[36].name) === false
    			? "hidden"
    			: "shown"));

    			attr(div1, "style", ctx[15](/*j*/ ctx[38]));
    		},
    		m(target, anchor) {
    			insert(target, div1, anchor);
    			append(div1, div0);
    			if_block.m(div0, null);
    			append(div1, t);
    			append(div1, textarea);
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			}

    			if (dirty[0] & /*name, table_config, table_data*/ 7 && div0_id_value !== (div0_id_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + ":disabled")) {
    				attr(div0, "id", div0_id_value);
    			}

    			if (dirty[0] & /*name, table_config, table_data*/ 7 && div0_aria_label_value !== (div0_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + ":disabled")) {
    				attr(div0, "aria-label", div0_aria_label_value);
    			}

    			if (dirty[0] & /*name, table_config, table_data*/ 7 && textarea_id_value !== (textarea_id_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35])) {
    				attr(textarea, "id", textarea_id_value);
    			}

    			if (dirty[0] & /*name, table_config, table_data*/ 7 && textarea_aria_label_value !== (textarea_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35])) {
    				attr(textarea, "aria-label", textarea_aria_label_value);
    			}

    			if (dirty[0] & /*table_data, table_config*/ 3 && textarea_value_value !== (textarea_value_value = /*table_data*/ ctx[0][/*i*/ ctx[35]][/*column_order*/ ctx[36].name])) {
    				textarea.value = textarea_value_value;
    			}

    			if (dirty[0] & /*genericCrudTable, table_config*/ 18 && div1_class_value !== (div1_class_value = "td " + (/*genericCrudTable*/ ctx[4].isShowField(/*column_order*/ ctx[36].name) === false
    			? "hidden"
    			: "shown"))) {
    				attr(div1, "class", div1_class_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div1);
    			if_block.d();
    		}
    	};
    }

    // (214:44) {:else}
    function create_else_block_1(ctx) {
    	let t_value = /*table_data*/ ctx[0][/*i*/ ctx[35]][/*column_order*/ ctx[36].name] + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*table_data, table_config*/ 3 && t_value !== (t_value = /*table_data*/ ctx[0][/*i*/ ctx[35]][/*column_order*/ ctx[36].name] + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (212:44) {#if column_order.type === 'html'}
    function create_if_block_10(ctx) {
    	let html_tag;
    	let raw_value = /*table_data*/ ctx[0][/*i*/ ctx[35]][/*column_order*/ ctx[36].name] + "";
    	let html_anchor;

    	return {
    		c() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m(target, anchor) {
    			html_tag.m(raw_value, target, anchor);
    			insert(target, html_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*table_data, table_config*/ 3 && raw_value !== (raw_value = /*table_data*/ ctx[0][/*i*/ ctx[35]][/*column_order*/ ctx[36].name] + "")) html_tag.p(raw_value);
    		},
    		d(detaching) {
    			if (detaching) detach(html_anchor);
    			if (detaching) html_tag.d();
    		}
    	};
    }

    // (224:32) {#if table_config.columns_setting.length - 1 === j && Object.entries(tableRow).length - 1 === k }
    function create_if_block_2(ctx) {
    	let div3;
    	let div0;
    	let show_if_4 = /*options*/ ctx[3].includes(DELETE);
    	let t0;
    	let show_if_3 = /*options*/ ctx[3].includes(EDIT);
    	let t1;
    	let show_if_2 = /*options*/ ctx[3].includes(DETAILS);
    	let div0_id_value;
    	let div0_aria_label_value;
    	let t2;
    	let div1;
    	let show_if_1 = /*options*/ ctx[3].includes(EDIT);
    	let div1_id_value;
    	let t3;
    	let div2;
    	let show_if = /*options*/ ctx[3].includes(DELETE);
    	let div2_id_value;
    	let div2_aria_label_value;
    	let if_block0 = show_if_4 && create_if_block_8(ctx);
    	let if_block1 = show_if_3 && create_if_block_7(ctx);
    	let if_block2 = show_if_2 && create_if_block_5(ctx);
    	let if_block3 = show_if_1 && create_if_block_4(ctx);
    	let if_block4 = show_if && create_if_block_3(ctx);

    	return {
    		c() {
    			div3 = element("div");
    			div0 = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			t2 = space();
    			div1 = element("div");
    			if (if_block3) if_block3.c();
    			t3 = space();
    			div2 = element("div");
    			if (if_block4) if_block4.c();
    			attr(div0, "id", div0_id_value = "" + (/*name*/ ctx[2] + "options-default" + /*i*/ ctx[35]));
    			attr(div0, "aria-label", div0_aria_label_value = "" + (/*name*/ ctx[2] + "options-default" + /*i*/ ctx[35]));
    			attr(div0, "class", "options-field shown");
    			attr(div1, "id", div1_id_value = "" + (/*name*/ ctx[2] + "options-edit" + /*i*/ ctx[35]));
    			attr(div1, "class", "options-field hidden");
    			attr(div2, "id", div2_id_value = "" + (/*name*/ ctx[2] + "options-delete" + /*i*/ ctx[35]));
    			attr(div2, "aria-label", div2_aria_label_value = "" + (/*name*/ ctx[2] + "options-delete" + /*i*/ ctx[35]));
    			attr(div2, "class", "options-field hidden");
    			attr(div3, "class", "td");
    		},
    		m(target, anchor) {
    			insert(target, div3, anchor);
    			append(div3, div0);
    			if (if_block0) if_block0.m(div0, null);
    			append(div0, t0);
    			if (if_block1) if_block1.m(div0, null);
    			append(div0, t1);
    			if (if_block2) if_block2.m(div0, null);
    			append(div3, t2);
    			append(div3, div1);
    			if (if_block3) if_block3.m(div1, null);
    			append(div3, t3);
    			append(div3, div2);
    			if (if_block4) if_block4.m(div2, null);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*options*/ 8) show_if_4 = /*options*/ ctx[3].includes(DELETE);

    			if (show_if_4) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_8(ctx);
    					if_block0.c();
    					if_block0.m(div0, t0);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty[0] & /*options*/ 8) show_if_3 = /*options*/ ctx[3].includes(EDIT);

    			if (show_if_3) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_7(ctx);
    					if_block1.c();
    					if_block1.m(div0, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (dirty[0] & /*options*/ 8) show_if_2 = /*options*/ ctx[3].includes(DETAILS);

    			if (show_if_2) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block_5(ctx);
    					if_block2.c();
    					if_block2.m(div0, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}

    			if (dirty[0] & /*name, table_data*/ 5 && div0_id_value !== (div0_id_value = "" + (/*name*/ ctx[2] + "options-default" + /*i*/ ctx[35]))) {
    				attr(div0, "id", div0_id_value);
    			}

    			if (dirty[0] & /*name, table_data*/ 5 && div0_aria_label_value !== (div0_aria_label_value = "" + (/*name*/ ctx[2] + "options-default" + /*i*/ ctx[35]))) {
    				attr(div0, "aria-label", div0_aria_label_value);
    			}

    			if (dirty[0] & /*options*/ 8) show_if_1 = /*options*/ ctx[3].includes(EDIT);

    			if (show_if_1) {
    				if (if_block3) {
    					if_block3.p(ctx, dirty);
    				} else {
    					if_block3 = create_if_block_4(ctx);
    					if_block3.c();
    					if_block3.m(div1, null);
    				}
    			} else if (if_block3) {
    				if_block3.d(1);
    				if_block3 = null;
    			}

    			if (dirty[0] & /*name, table_data*/ 5 && div1_id_value !== (div1_id_value = "" + (/*name*/ ctx[2] + "options-edit" + /*i*/ ctx[35]))) {
    				attr(div1, "id", div1_id_value);
    			}

    			if (dirty[0] & /*options*/ 8) show_if = /*options*/ ctx[3].includes(DELETE);

    			if (show_if) {
    				if (if_block4) {
    					if_block4.p(ctx, dirty);
    				} else {
    					if_block4 = create_if_block_3(ctx);
    					if_block4.c();
    					if_block4.m(div2, null);
    				}
    			} else if (if_block4) {
    				if_block4.d(1);
    				if_block4 = null;
    			}

    			if (dirty[0] & /*name, table_data*/ 5 && div2_id_value !== (div2_id_value = "" + (/*name*/ ctx[2] + "options-delete" + /*i*/ ctx[35]))) {
    				attr(div2, "id", div2_id_value);
    			}

    			if (dirty[0] & /*name, table_data*/ 5 && div2_aria_label_value !== (div2_aria_label_value = "" + (/*name*/ ctx[2] + "options-delete" + /*i*/ ctx[35]))) {
    				attr(div2, "aria-label", div2_aria_label_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div3);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    			if (if_block3) if_block3.d();
    			if (if_block4) if_block4.d();
    		}
    	};
    }

    // (230:44) {#if options.includes(DELETE)}
    function create_if_block_8(ctx) {
    	let div;
    	let div_aria_label_value;
    	let mounted;
    	let dispose;

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[19](/*i*/ ctx[35]);
    	}

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", "options red");
    			attr(div, "title", "Delete");
    			attr(div, "aria-label", div_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + "delete");
    			attr(div, "tabindex", "0");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			div.innerHTML = icontrash;

    			if (!mounted) {
    				dispose = listen(div, "click", click_handler_1);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*name, table_config, table_data*/ 7 && div_aria_label_value !== (div_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + "delete")) {
    				attr(div, "aria-label", div_aria_label_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (238:44) {#if options.includes(EDIT)}
    function create_if_block_7(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	function click_handler_2(...args) {
    		return /*click_handler_2*/ ctx[20](/*i*/ ctx[35], ...args);
    	}

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", "options green");
    			attr(div, "title", "Edit");
    			attr(div, "tabindex", "0");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			div.innerHTML = iconedit;

    			if (!mounted) {
    				dispose = listen(div, "click", click_handler_2);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (245:44) {#if options.includes(DETAILS)}
    function create_if_block_5(ctx) {
    	let div;
    	let mounted;
    	let dispose;

    	function select_block_type_1(ctx, dirty) {
    		if (/*table_config*/ ctx[1].details_text !== undefined) return create_if_block_6;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	function click_handler_3(...args) {
    		return /*click_handler_3*/ ctx[21](/*i*/ ctx[35], ...args);
    	}

    	return {
    		c() {
    			div = element("div");
    			if_block.c();
    			attr(div, "class", "options blue");
    			attr(div, "title", "Details");
    			attr(div, "tabindex", "0");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			if_block.m(div, null);

    			if (!mounted) {
    				dispose = listen(div, "click", click_handler_3);
    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div, null);
    				}
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};
    }

    // (250:52) {:else}
    function create_else_block(ctx) {
    	let html_tag;
    	let html_anchor;

    	return {
    		c() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m(target, anchor) {
    			html_tag.m(icondetail, target, anchor);
    			insert(target, html_anchor, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(html_anchor);
    			if (detaching) html_tag.d();
    		}
    	};
    }

    // (248:52) {#if table_config.details_text !== undefined}
    function create_if_block_6(ctx) {
    	let t_value = /*table_config*/ ctx[1].details_text + "";
    	let t;

    	return {
    		c() {
    			t = text(t_value);
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*table_config*/ 2 && t_value !== (t_value = /*table_config*/ ctx[1].details_text + "")) set_data(t, t_value);
    		},
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (259:44) {#if options.includes(EDIT)}
    function create_if_block_4(ctx) {
    	let div0;
    	let t;
    	let div1;
    	let div1_aria_label_value;
    	let mounted;
    	let dispose;

    	function click_handler_4(...args) {
    		return /*click_handler_4*/ ctx[22](/*i*/ ctx[35], ...args);
    	}

    	function click_handler_5() {
    		return /*click_handler_5*/ ctx[23](/*i*/ ctx[35]);
    	}

    	return {
    		c() {
    			div0 = element("div");
    			t = space();
    			div1 = element("div");
    			attr(div0, "class", "options green");
    			attr(div0, "title", "Update");
    			attr(div0, "tabindex", "0");
    			attr(div1, "class", "options red");
    			attr(div1, "title", "Cancel");
    			attr(div1, "aria-label", div1_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + "editCancel");
    			attr(div1, "tabindex", "0");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			div0.innerHTML = iconsave;
    			insert(target, t, anchor);
    			insert(target, div1, anchor);
    			div1.innerHTML = iconcancel;

    			if (!mounted) {
    				dispose = [
    					listen(div0, "click", click_handler_4),
    					listen(div1, "click", click_handler_5)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*name, table_config, table_data*/ 7 && div1_aria_label_value !== (div1_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + "editCancel")) {
    				attr(div1, "aria-label", div1_aria_label_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t);
    			if (detaching) detach(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (277:44) {#if options.includes(DELETE)}
    function create_if_block_3(ctx) {
    	let div0;
    	let div0_aria_label_value;
    	let t;
    	let div1;
    	let div1_aria_label_value;
    	let mounted;
    	let dispose;

    	function click_handler_6() {
    		return /*click_handler_6*/ ctx[24](/*i*/ ctx[35]);
    	}

    	function click_handler_7(...args) {
    		return /*click_handler_7*/ ctx[25](/*i*/ ctx[35], ...args);
    	}

    	return {
    		c() {
    			div0 = element("div");
    			t = space();
    			div1 = element("div");
    			attr(div0, "class", "options red");
    			attr(div0, "title", "Cancel");
    			attr(div0, "aria-label", div0_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + "deleteCancel");
    			attr(div0, "tabindex", "0");
    			attr(div1, "class", "options green");
    			attr(div1, "title", "Delete");
    			attr(div1, "aria-label", div1_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + "deleteConfirmation");
    			attr(div1, "tabindex", "0");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			div0.innerHTML = iconcancel;
    			insert(target, t, anchor);
    			insert(target, div1, anchor);
    			div1.innerHTML = iconsend;

    			if (!mounted) {
    				dispose = [
    					listen(div0, "click", click_handler_6),
    					listen(div1, "click", click_handler_7)
    				];

    				mounted = true;
    			}
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*name, table_config, table_data*/ 7 && div0_aria_label_value !== (div0_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + "deleteCancel")) {
    				attr(div0, "aria-label", div0_aria_label_value);
    			}

    			if (dirty[0] & /*name, table_config, table_data*/ 7 && div1_aria_label_value !== (div1_aria_label_value = /*name*/ ctx[2] + /*column_order*/ ctx[36].name + /*i*/ ctx[35] + "deleteConfirmation")) {
    				attr(div1, "aria-label", div1_aria_label_value);
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t);
    			if (detaching) detach(div1);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    // (203:28) {#each Object.entries(tableRow) as elem, k}
    function create_each_block_2(ctx) {
    	let show_if_1 = /*column_order*/ ctx[36].name === /*genericCrudTable*/ ctx[4].getKey(/*elem*/ ctx[39]);
    	let t;
    	let show_if = /*table_config*/ ctx[1].columns_setting.length - 1 === /*j*/ ctx[38] && Object.entries(/*tableRow*/ ctx[33]).length - 1 === /*k*/ ctx[41];
    	let if_block1_anchor;
    	let if_block0 = show_if_1 && create_if_block_9(ctx);
    	let if_block1 = show_if && create_if_block_2(ctx);

    	return {
    		c() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert(target, t, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*table_config, genericCrudTable, table_data*/ 19) show_if_1 = /*column_order*/ ctx[36].name === /*genericCrudTable*/ ctx[4].getKey(/*elem*/ ctx[39]);

    			if (show_if_1) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_9(ctx);
    					if_block0.c();
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (dirty[0] & /*table_config, table_data*/ 3) show_if = /*table_config*/ ctx[1].columns_setting.length - 1 === /*j*/ ctx[38] && Object.entries(/*tableRow*/ ctx[33]).length - 1 === /*k*/ ctx[41];

    			if (show_if) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block_2(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		d(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach(t);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    		}
    	};
    }

    // (202:24) {#each table_config.columns_setting as column_order, j}
    function create_each_block_1(ctx) {
    	let each_1_anchor;
    	let each_value_2 = Object.entries(/*tableRow*/ ctx[33]);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	return {
    		c() {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    		},
    		m(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert(target, each_1_anchor, anchor);
    		},
    		p(ctx, dirty) {
    			if (dirty[0] & /*name, table_data, table_config, handleDeleteConfirmation, handleCancelDelete, options, handleCancelEdit, handleEditConfirmation, handleDetails, handleEdit, handleDelete, genericCrudTable, getWidth*/ 38911) {
    				each_value_2 = Object.entries(/*tableRow*/ ctx[33]);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}
    		},
    		d(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach(each_1_anchor);
    		}
    	};
    }

    // (200:16) {#each table_data as tableRow, i (tableRow)}
    function create_each_block(key_1, ctx) {
    	let div;
    	let t;
    	let each_value_1 = /*table_config*/ ctx[1].columns_setting;
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	return {
    		key: key_1,
    		first: null,
    		c() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			attr(div, "class", "row");
    			this.first = div;
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append(div, t);
    		},
    		p(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*table_data, name, table_config, handleDeleteConfirmation, handleCancelDelete, options, handleCancelEdit, handleEditConfirmation, handleDetails, handleEdit, handleDelete, genericCrudTable, getWidth*/ 38911) {
    				each_value_1 = /*table_config*/ ctx[1].columns_setting;
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let main;
    	let if_block = /*table_data*/ ctx[0] !== undefined && create_if_block(ctx);

    	return {
    		c() {
    			main = element("main");
    			if (if_block) if_block.c();
    			this.c = noop;
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			if (if_block) if_block.m(main, null);
    		},
    		p(ctx, dirty) {
    			if (/*table_data*/ ctx[0] !== undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(main, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    			if (if_block) if_block.d();
    		}
    	};
    }

    const EDIT = "EDIT";
    const DELETE = "DELETE";
    const CREATE = "CREATE";
    const DETAILS = "DETAILS";

    function instance($$self, $$props, $$invalidate) {
    	let { shadowed = false } = $$props;
    	const dispatch = createEventDispatcher();

    	const table_config_default = {
    		name: "crud-table",
    		options: ["CREATE", "EDIT", "DELETE", "DETAILS"],
    		columns_setting: [],
    		details_text: "detail"
    	};

    	let { table_data = {} } = $$props;
    	let { table_config = table_config_default } = $$props;
    	let name = "";
    	let options = [];
    	const NO_ROW_IN_EDIT_MODE = -1;
    	let cursor = NO_ROW_IN_EDIT_MODE;
    	let genericCrudTable = new SvelteGenericCrudTableService(table_config, shadowed);

    	function handleEdit(id) {
    		resetRawInEditMode(id);
    		cursor = id;

    		for (let i = 0; i < table_data.length; i++) {
    			genericCrudTable.resetEditMode(i);
    		}

    		genericCrudTable.setEditMode(id);
    	}

    	function handleCancelEdit(id) {
    		genericCrudTable.resetRawValues(id, table_data);
    		genericCrudTable.resetEditMode(id);
    		genericCrudTable.resetDeleteMode(id);
    		cursor = NO_ROW_IN_EDIT_MODE;
    	}

    	function handleEditConfirmation(id, event) {
    		resetRawInEditMode(id);
    		const body = genericCrudTable.gatherUpdates(id, table_data);
    		$$invalidate(0, table_data[id] = body, table_data);
    		const details = { id, body };
    		genericCrudTable.resetEditMode(id);
    		dispatcher("update", details, event);
    	}

    	function handleDelete(id) {
    		resetRawInEditMode(id);
    		genericCrudTable.resetDeleteMode(id);
    		cursor = id;
    		genericCrudTable.setDeleteMode(id);
    	}

    	function handleCancelDelete(id) {
    		genericCrudTable.resetEditMode(id);
    		genericCrudTable.resetDeleteMode(id);
    	}

    	function handleDeleteConfirmation(id, event) {
    		const body = genericCrudTable.gatherUpdates(id, table_data);
    		const details = { id, body };
    		genericCrudTable.resetDeleteMode(id);
    		cursor = NO_ROW_IN_EDIT_MODE;
    		dispatcher("delete", details, event);
    	}

    	function handleCreate(event) {
    		let details = event.detail;
    		dispatcher("create", details, event);
    	}

    	function dispatcher(name, details, event) {
    		/* istanbul ignore next */
    		if (shadowed) {
    			event.target.dispatchEvent(new CustomEvent(name, { composed: true, detail: details }));
    		} else {
    			dispatch(name, details);
    		}
    	}

    	function handleDetails(id, event) {
    		resetRawInEditMode(id);
    		const body = genericCrudTable.gatherUpdates(id, table_data);
    		const details = { id, body };
    		dispatcher("details", details, event);
    	}

    	function resetRawInEditMode(id) {
    		if (cursor !== id && cursor !== NO_ROW_IN_EDIT_MODE) {
    			handleCancelEdit(cursor);
    		}
    	}

    	function handleSort(elem, event) {
    		let column = { column: elem };
    		dispatcher("sort", column, event);
    	}

    	const columnsWidth = [];

    	function handleResize(event) {
    		let elem = event.target;
    		let column;

    		if (shadowed) {
    			column = document.querySelector("crud-table").shadowRoot.querySelectorAll("[id$='-" + elem.id + "']");
    		} else {
    			column = document.querySelectorAll("[id$='-" + elem.id + "']");
    		}

    		columnsWidth[elem.id] = elem.offsetWidth - 8 + "px";

    		for (let i = 0; i < column.length; i++) {
    			column[i].setAttribute("style", "width:" + (elem.offsetWidth - 8) + "px");
    		}
    	}

    	function getWidth(id) {
    		return "width:" + columnsWidth[id] + ";";
    	}

    	function setWidth(elem, i) {
    		const width = genericCrudTable.getShowFieldWidth(elem.name); // incl.px
    		columnsWidth[i] = width;
    		return "width:" + width + ";";
    	}

    	const click_handler = (elem, e) => handleSort(elem.name, e);
    	const click_handler_1 = i => handleDelete(i);
    	const click_handler_2 = (i, e) => handleEdit(i);

    	const click_handler_3 = (i, e) => {
    		handleDetails(i, e);
    	};

    	const click_handler_4 = (i, e) => {
    		handleEditConfirmation(i, e);
    	};

    	const click_handler_5 = i => {
    		handleCancelEdit(i);
    	};

    	const click_handler_6 = i => handleCancelDelete(i);
    	const click_handler_7 = (i, e) => handleDeleteConfirmation(i, e);

    	$$self.$$set = $$props => {
    		if ("shadowed" in $$props) $$invalidate(17, shadowed = $$props.shadowed);
    		if ("table_data" in $$props) $$invalidate(0, table_data = $$props.table_data);
    		if ("table_config" in $$props) $$invalidate(1, table_config = $$props.table_config);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*table_data*/ 1) {
    			/* istanbul ignore next line */
    			 $$invalidate(0, table_data = typeof table_data === "string"
    			? JSON.parse(table_data)
    			: table_data);
    		}

    		if ($$self.$$.dirty[0] & /*table_config*/ 2) {
    			/* istanbul ignore next line */
    			 $$invalidate(1, table_config = typeof table_config === "string"
    			? JSON.parse(table_config)
    			: table_config);
    		}

    		if ($$self.$$.dirty[0] & /*table_config*/ 2) {
    			 $$invalidate(2, name = table_config.name);
    		}

    		if ($$self.$$.dirty[0] & /*table_config*/ 2) {
    			/* istanbul ignore next line */
    			 $$invalidate(3, options = typeof table_config.options !== "undefined"
    			? table_config.options
    			: []);
    		}

    		if ($$self.$$.dirty[0] & /*table_config, shadowed*/ 131074) {
    			 $$invalidate(4, genericCrudTable = new SvelteGenericCrudTableService(table_config, shadowed));
    		}
    	};

    	return [
    		table_data,
    		table_config,
    		name,
    		options,
    		genericCrudTable,
    		handleEdit,
    		handleCancelEdit,
    		handleEditConfirmation,
    		handleDelete,
    		handleCancelDelete,
    		handleDeleteConfirmation,
    		handleCreate,
    		handleDetails,
    		handleSort,
    		handleResize,
    		getWidth,
    		setWidth,
    		shadowed,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7
    	];
    }

    class SvelteGenericCrudTable extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>main{position:inherit;padding-top:0.4em}.red:hover{fill:red;fill-opacity:80%}.green:hover{fill:limegreen;fill-opacity:80%}.blue:hover{fill:dodgerblue;fill-opacity:80%}.table{display:inline-grid;text-align:left}.thead{display:inline-flex;padding:0 0 0.4em 0}.row{display:inline-flex;padding:0;margin:0 0 1px;resize:vertical}.row:hover{background-color:#efefef}.td{color:#5f5f5f;border:none;border-left:0.1em solid #efefef;font-weight:100;padding:0.2em 0 0.1em 0.4em;float:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;resize:none}.td-disabled{vertical-align:middle;color:#5f5f5f;border:none;font-weight:200;float:left;line-height:1em;min-height:1.3em;max-height:1.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;width:-moz-available;width:-webkit-fill-available;width:stretch}.headline{border-bottom:1px solid #dddddd;cursor:pointer;min-height:1.3em;max-height:1.3em;height:1.3em;font-weight:300;padding:0 0 0.3em 0.4em;margin-bottom:0.3em;resize:horizontal}#labelOptions{width:85px;resize:none}.options-field{min-height:1.3em;max-height:1.3em;width:fit-content;width:-moz-fit-content;opacity:60%;resize:inherit}.options{float:left;position:relative;width:fit-content;width:-moz-fit-content;height:16px;padding:0.2em 0.4em;cursor:pointer;fill:#999999;color:#666666;line-height:0.9em}.options:hover{color:#333333;text-decoration:underline}.options:focus{border:none;outline:none;opacity:100%}.hidden{display:none}.shown{display:block}textarea{position:relative;resize:vertical;overflow:hidden;width:100%;min-height:1.3em;height:100%;padding:1px 1px;background-color:#ffffff;border:none;font-size:0.95em;font-weight:300;font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;text-overflow:ellipsis;white-space:pre;-webkit-transition:box-shadow 0.3s;border-bottom:0.5px solid #5f5f5f;overflow-y:scroll}textarea:focus{outline:none;font-weight:300;white-space:normal;overflow:auto;padding-top:1px}textarea:not(:focus){height:100%}</style>`;

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes)
    			},
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				shadowed: 17,
    				table_data: 0,
    				table_config: 1
    			},
    			[-1, -1]
    		);

    		if (options) {
    			if (options.target) {
    				insert(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return ["shadowed", "table_data", "table_config"];
    	}

    	get shadowed() {
    		return this.$$.ctx[17];
    	}

    	set shadowed(shadowed) {
    		this.$set({ shadowed });
    		flush();
    	}

    	get table_data() {
    		return this.$$.ctx[0];
    	}

    	set table_data(table_data) {
    		this.$set({ table_data });
    		flush();
    	}

    	get table_config() {
    		return this.$$.ctx[1];
    	}

    	set table_config(table_config) {
    		this.$set({ table_config });
    		flush();
    	}
    }

    customElements.define("crud-table", SvelteGenericCrudTable);

    /* src/GenericTablePager.svelte generated by Svelte v3.31.2 */

    function create_else_block$1(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("o");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    // (175:8) {#if (currentPage > 1)}
    function create_if_block$1(ctx) {
    	let html_tag;
    	let html_anchor;

    	return {
    		c() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m(target, anchor) {
    			html_tag.m(iconLeft, target, anchor);
    			insert(target, html_anchor, anchor);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(html_anchor);
    			if (detaching) html_tag.d();
    		}
    	};
    }

    function create_fragment$1(ctx) {
    	let main;
    	let span0;
    	let span0_class_value;
    	let t0;
    	let span1;
    	let span1_class_value;
    	let t1;
    	let span3;
    	let input;
    	let t2;
    	let span2;
    	let t3;
    	let t4;
    	let t5;
    	let span6;
    	let t6;
    	let span4;
    	let t7_value = /*firstLineOfPage*/ ctx[10]() + "";
    	let t7;
    	let t8;
    	let t9_value = /*lastLineOfPage*/ ctx[11]() + "";
    	let t9;
    	let t10;
    	let t11_value = /*pager_data*/ ctx[0].length + "";
    	let t11;
    	let t12;
    	let t13;
    	let span5;
    	let t14;
    	let t15;
    	let t16;
    	let t17;
    	let sveltegenericcrudtable;
    	let updating_table_data;
    	let current;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*currentPage*/ ctx[6] > 1) return create_if_block$1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	function sveltegenericcrudtable_table_data_binding(value) {
    		/*sveltegenericcrudtable_table_data_binding*/ ctx[25].call(null, value);
    	}

    	let sveltegenericcrudtable_props = {
    		shadowed: /*shadowed*/ ctx[3],
    		table_config: /*table_config*/ ctx[4]
    	};

    	if (/*page_data*/ ctx[2] !== void 0) {
    		sveltegenericcrudtable_props.table_data = /*page_data*/ ctx[2];
    	}

    	sveltegenericcrudtable = new SvelteGenericCrudTable({ props: sveltegenericcrudtable_props });
    	binding_callbacks.push(() => bind(sveltegenericcrudtable, "table_data", sveltegenericcrudtable_table_data_binding));
    	sveltegenericcrudtable.$on("delete", /*handleDelete*/ ctx[17]);
    	sveltegenericcrudtable.$on("update", /*handleUpdate*/ ctx[18]);
    	sveltegenericcrudtable.$on("create", /*handleCreate*/ ctx[16]);
    	sveltegenericcrudtable.$on("details", /*handleDetail*/ ctx[19]);
    	sveltegenericcrudtable.$on("sort", /*handleSort*/ ctx[20]);

    	return {
    		c() {
    			main = element("main");
    			span0 = element("span");
    			if_block.c();
    			t0 = space();
    			span1 = element("span");
    			t1 = space();
    			span3 = element("span");
    			input = element("input");
    			t2 = space();
    			span2 = element("span");
    			t3 = text(/*currentStep*/ ctx[8]);
    			t4 = text(" rows");
    			t5 = space();
    			span6 = element("span");
    			t6 = text("lines: ");
    			span4 = element("span");
    			t7 = text(t7_value);
    			t8 = text("-");
    			t9 = text(t9_value);
    			t10 = text(" (");
    			t11 = text(t11_value);
    			t12 = text(")");
    			t13 = text("\n         -\n        pages: ");
    			span5 = element("span");
    			t14 = text(/*currentPage*/ ctx[6]);
    			t15 = text("/");
    			t16 = text(/*maxPages*/ ctx[9]);
    			t17 = space();
    			create_component(sveltegenericcrudtable.$$.fragment);
    			this.c = noop;
    			attr(span0, "id", "left");
    			attr(span0, "class", span0_class_value = "options left " + (/*currentPage*/ ctx[6] > 1 ? "active" : "inactive"));
    			set_style(span0, "float", "left");
    			attr(span0, "title", "Left");
    			attr(span0, "tabindex", "0");
    			attr(span1, "id", "right");

    			attr(span1, "class", span1_class_value = "options right " + (/*pager_data*/ ctx[0].length > /*currentPage*/ ctx[6] * /*pager_config*/ ctx[1].lines
    			? "active"
    			: "inactive"));

    			set_style(span1, "float", "left");
    			attr(span1, "title", "Right");
    			attr(span1, "tabindex", "0");
    			attr(input, "id", "slider");
    			attr(input, "type", "range");
    			attr(input, "min", "1");
    			attr(input, "max", /*maxSteps*/ ctx[7]);
    			attr(input, "steps", /*maxSteps*/ ctx[7]);
    			attr(span2, "class", "number-rows");
    			attr(span3, "class", "range");
    			set_style(span3, "float", "left");
    			attr(span4, "class", "number-lines");
    			attr(span5, "class", "number-pages");
    			attr(span6, "class", "info");
    			set_style(span6, "clear", "both");
    			attr(main, "class", "pager");

    			set_style(main, "width", /*pager_config*/ ctx[1].width !== undefined
    			? /*pager_config*/ ctx[1].width
    			: /*pager_config_default*/ ctx[12].width);
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, span0);
    			if_block.m(span0, null);
    			append(main, t0);
    			append(main, span1);
    			span1.innerHTML = iconRight;
    			append(main, t1);
    			append(main, span3);
    			append(span3, input);
    			set_input_value(input, /*sliderIndex*/ ctx[5]);
    			append(span3, t2);
    			append(span3, span2);
    			append(span2, t3);
    			append(span2, t4);
    			append(main, t5);
    			append(main, span6);
    			append(span6, t6);
    			append(span6, span4);
    			append(span4, t7);
    			append(span4, t8);
    			append(span4, t9);
    			append(span4, t10);
    			append(span4, t11);
    			append(span4, t12);
    			append(span6, t13);
    			append(span6, span5);
    			append(span5, t14);
    			append(span5, t15);
    			append(span5, t16);
    			insert(target, t17, anchor);
    			mount_component(sveltegenericcrudtable, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(span0, "click", /*click_handler*/ ctx[22]),
    					listen(span1, "click", /*click_handler_1*/ ctx[23]),
    					listen(input, "change", /*input_change_input_handler*/ ctx[24]),
    					listen(input, "input", /*input_change_input_handler*/ ctx[24]),
    					listen(input, "input", /*handlePagerConfig*/ ctx[15])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(span0, null);
    				}
    			}

    			if (!current || dirty[0] & /*currentPage*/ 64 && span0_class_value !== (span0_class_value = "options left " + (/*currentPage*/ ctx[6] > 1 ? "active" : "inactive"))) {
    				attr(span0, "class", span0_class_value);
    			}

    			if (!current || dirty[0] & /*pager_data, currentPage, pager_config*/ 67 && span1_class_value !== (span1_class_value = "options right " + (/*pager_data*/ ctx[0].length > /*currentPage*/ ctx[6] * /*pager_config*/ ctx[1].lines
    			? "active"
    			: "inactive"))) {
    				attr(span1, "class", span1_class_value);
    			}

    			if (!current || dirty[0] & /*maxSteps*/ 128) {
    				attr(input, "max", /*maxSteps*/ ctx[7]);
    			}

    			if (!current || dirty[0] & /*maxSteps*/ 128) {
    				attr(input, "steps", /*maxSteps*/ ctx[7]);
    			}

    			if (dirty[0] & /*sliderIndex*/ 32) {
    				set_input_value(input, /*sliderIndex*/ ctx[5]);
    			}

    			if (!current || dirty[0] & /*currentStep*/ 256) set_data(t3, /*currentStep*/ ctx[8]);
    			if ((!current || dirty[0] & /*firstLineOfPage*/ 1024) && t7_value !== (t7_value = /*firstLineOfPage*/ ctx[10]() + "")) set_data(t7, t7_value);
    			if ((!current || dirty[0] & /*lastLineOfPage*/ 2048) && t9_value !== (t9_value = /*lastLineOfPage*/ ctx[11]() + "")) set_data(t9, t9_value);
    			if ((!current || dirty[0] & /*pager_data*/ 1) && t11_value !== (t11_value = /*pager_data*/ ctx[0].length + "")) set_data(t11, t11_value);
    			if (!current || dirty[0] & /*currentPage*/ 64) set_data(t14, /*currentPage*/ ctx[6]);
    			if (!current || dirty[0] & /*maxPages*/ 512) set_data(t16, /*maxPages*/ ctx[9]);

    			if (!current || dirty[0] & /*pager_config*/ 2) {
    				set_style(main, "width", /*pager_config*/ ctx[1].width !== undefined
    				? /*pager_config*/ ctx[1].width
    				: /*pager_config_default*/ ctx[12].width);
    			}

    			const sveltegenericcrudtable_changes = {};
    			if (dirty[0] & /*shadowed*/ 8) sveltegenericcrudtable_changes.shadowed = /*shadowed*/ ctx[3];
    			if (dirty[0] & /*table_config*/ 16) sveltegenericcrudtable_changes.table_config = /*table_config*/ ctx[4];

    			if (!updating_table_data && dirty[0] & /*page_data*/ 4) {
    				updating_table_data = true;
    				sveltegenericcrudtable_changes.table_data = /*page_data*/ ctx[2];
    				add_flush_callback(() => updating_table_data = false);
    			}

    			sveltegenericcrudtable.$set(sveltegenericcrudtable_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(sveltegenericcrudtable.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(sveltegenericcrudtable.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(main);
    			if_block.d();
    			if (detaching) detach(t17);
    			destroy_component(sveltegenericcrudtable, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { shadowed = false } = $$props;
    	const dispatch = createEventDispatcher();

    	const pager_config_default = {
    		name: "table-paginator",
    		lines: 0,
    		steps: [1],
    		width: "500px"
    	};

    	let { pager_data = {} } = $$props;
    	let { pager_config = pager_config_default } = $$props;

    	let setSteps = () => {
    		let steps = pager_config.steps !== undefined
    		? pager_config.steps
    		: pager_config_default.steps;

    		steps = steps.filter(a => {
    			return parseInt(a) < pager_data.length;
    		});

    		steps.push(pager_data.length);
    		return steps;
    	};

    	let sliderIndex = pager_config.steps !== undefined
    	? pager_config.steps.indexOf(pager_config.lines)
    	: 0;

    	let maxSteps = 1;
    	let currentStep = 0;
    	let currentPage = 1;
    	let maxPages = 1;
    	let max;
    	let { page_data } = $$props;

    	if (!shadowed) {
    		beforeUpdate(() => {
    			initPage();
    		});
    	} else {
    		afterUpdate(() => {
    			initPage();
    		});
    	}

    	function initPage() {
    		$$invalidate(2, page_data = pager_data.slice(pager_config.lines * (currentPage - 1), pager_config.lines * currentPage));
    	}

    	function getNextPage() {
    		if (currentPage < maxPages) {
    			$$invalidate(2, page_data = pager_data.slice(pager_config.lines * currentPage, pager_config.lines * (currentPage + 1)));
    			$$invalidate(6, currentPage++, currentPage);
    		}
    	}

    	function getPreviousPage() {
    		if (currentPage > 1) {
    			$$invalidate(2, page_data = pager_data.slice(pager_config.lines * currentPage - pager_config.lines * 2, pager_config.lines * (currentPage + 1) - pager_config.lines * 2));
    			$$invalidate(6, currentPage--, currentPage);
    		}
    	}

    	function handleLeft(event) {
    		if (currentPage > 1) {
    			getPreviousPage();
    		}
    	}

    	function handleRight(event) {
    		getNextPage();
    	}

    	function handlePagerConfig(event) {
    		$$invalidate(6, currentPage = 1);
    		$$invalidate(1, pager_config.steps = setSteps(), pager_config);
    		$$invalidate(1, pager_config.lines = pager_config.steps[sliderIndex], pager_config);
    	}

    	function dispatcher(name, details, event) {
    		/* istanbul ignore next */
    		if (shadowed) {
    			event.target.dispatchEvent(new CustomEvent(name, { composed: true, detail: details }));
    		} else {
    			dispatch(name, details);
    		}
    	}

    	let firstLineOfPage = 0;
    	let lastLineOfPage = 0;

    	function handleCreate(event) {
    		const details = {};
    		dispatcher("create", details, event);
    	}

    	function handleDelete(event) {
    		const details = {
    			id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
    			body: event.detail.body
    		};

    		dispatcher("delete", details, event);
    	}

    	function handleUpdate(event) {
    		const details = {
    			id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
    			body: event.detail.body
    		};

    		dispatcher("update", details, event);
    	}

    	function handleDetail(event) {
    		const details = {
    			id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
    			body: event.detail.body
    		};

    		dispatcher("details", details, event);
    	}

    	function handleSort(event) {
    		const column = event.detail.column;
    		const details = { column };
    		dispatcher("sort", details, event);
    	}

    	let { table_config = {} } = $$props;
    	const click_handler = e => handleLeft();
    	const click_handler_1 = e => handleRight();

    	function input_change_input_handler() {
    		sliderIndex = to_number(this.value);
    		$$invalidate(5, sliderIndex);
    	}

    	function sveltegenericcrudtable_table_data_binding(value) {
    		page_data = value;
    		$$invalidate(2, page_data);
    	}

    	$$self.$$set = $$props => {
    		if ("shadowed" in $$props) $$invalidate(3, shadowed = $$props.shadowed);
    		if ("pager_data" in $$props) $$invalidate(0, pager_data = $$props.pager_data);
    		if ("pager_config" in $$props) $$invalidate(1, pager_config = $$props.pager_config);
    		if ("page_data" in $$props) $$invalidate(2, page_data = $$props.page_data);
    		if ("table_config" in $$props) $$invalidate(4, table_config = $$props.table_config);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*pager_data*/ 1) {
    			/* istanbul ignore next line */
    			 $$invalidate(0, pager_data = typeof pager_data === "string"
    			? JSON.parse(pager_data)
    			: pager_data);
    		}

    		if ($$self.$$.dirty[0] & /*pager_config*/ 2) {
    			/* istanbul ignore next line */
    			 $$invalidate(1, pager_config = typeof pager_config === "string"
    			? JSON.parse(pager_config)
    			: pager_config);
    		}

    		if ($$self.$$.dirty[0] & /*pager_config, sliderIndex*/ 34) {
    			 $$invalidate(8, currentStep = pager_config.steps !== undefined
    			? pager_config.steps[sliderIndex]
    			: pager_config_default.steps[sliderIndex]);
    		}

    		if ($$self.$$.dirty[0] & /*pager_config*/ 2) {
    			 $$invalidate(7, maxSteps = pager_config.steps !== undefined
    			? pager_config.steps.length - 1
    			: pager_config_default.steps.length - 1);
    		}

    		if ($$self.$$.dirty[0] & /*pager_data, pager_config*/ 3) {
    			 $$invalidate(21, max = Math.ceil(pager_data.length / pager_config.lines));
    		}

    		if ($$self.$$.dirty[0] & /*max*/ 2097152) {
    			 $$invalidate(9, maxPages = max > 0 ? max : 1);
    		}

    		if ($$self.$$.dirty[0] & /*page_data*/ 4) {
    			 $$invalidate(2, page_data = typeof page_data === "Array" ? page_data : []);
    		}

    		if ($$self.$$.dirty[0] & /*pager_config, currentPage*/ 66) {
    			 $$invalidate(10, firstLineOfPage = () => {
    				return pager_config.lines * (currentPage - 1) + 1;
    			});
    		}

    		if ($$self.$$.dirty[0] & /*pager_config, currentPage, pager_data*/ 67) {
    			 $$invalidate(11, lastLineOfPage = () => {
    				const last = pager_config.lines * (currentPage - 1) + pager_config.lines;
    				return last > pager_data.length ? pager_data.length : last;
    			});
    		}
    	};

    	return [
    		pager_data,
    		pager_config,
    		page_data,
    		shadowed,
    		table_config,
    		sliderIndex,
    		currentPage,
    		maxSteps,
    		currentStep,
    		maxPages,
    		firstLineOfPage,
    		lastLineOfPage,
    		pager_config_default,
    		handleLeft,
    		handleRight,
    		handlePagerConfig,
    		handleCreate,
    		handleDelete,
    		handleUpdate,
    		handleDetail,
    		handleSort,
    		max,
    		click_handler,
    		click_handler_1,
    		input_change_input_handler,
    		sveltegenericcrudtable_table_data_binding
    	];
    }

    class GenericTablePager extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>main{position:inherit;padding-top:0.4em}.range{background:#fff;height:1.3em;border-radius:5rem;box-shadow:1px 1px 1px rgba(255, 255, 255, 0.3);display:flex;align-items:center;justify-content:center;padding-top:0.3em;outline:none;border:none;text-align:left;color:#999999;font-size:0.7em;font-weight:200}.number-rows{padding-left:0.4em;padding-top:0.1em}.pager{text-align:center;min-width:400px;max-width:100%;margin-left:1em;height:1.8em}.number-pages{font-size:110%;font-weight:200}.number-lines{padding-top:0.3em;font-size:110%;font-weight:200}.info{position:relative;top:-0.2em;text-align:left;color:#999999;font-size:0.7em;font-weight:200;padding-left:2em}.inactive{visibility:hidden}.active{visibility:visible}.active:hover{color:limegreen;opacity:80%}.options{position:relative;top:-0.1em;width:16px;height:16px;padding:0.2em;cursor:pointer;opacity:60%;color:#999999}.options:hover{opacity:100%}.options:focus{border:none;outline:none;opacity:100%}input[type="range"]{-webkit-appearance:none;width:100px;background:transparent}input[type="range"]:focus{outline:none}input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;height:1em;width:1em;border-radius:50%;background:#ffffff;margin-top:-0.25em;box-shadow:1px 1px 2px rgba(0, 0, 0, 0.5);cursor:pointer}input[type="range"]::-webkit-slider-runnable-track{width:60%;height:9px;background:#dddddd;border-radius:3rem;transition:all 0.5s;cursor:pointer}input[type="range"]:hover::-webkit-slider-runnable-track{background:#ff6e40}input[type="range"]::-ms-track{width:60%;cursor:pointer;height:9px;transition:all 0.5s;background:transparent;border-color:transparent;color:transparent}input[type="range"]::-ms-thumb{height:16px;width:16px;border-radius:50%;background:#ffffff;margin-top:-5px;box-shadow:1px 1px 2px rgba(0, 0, 0, 0.5);cursor:pointer}input[type="range"]::-ms-fill-lower{background:#bdbdbd;border-radius:3rem}input[type="range"]:focus::-ms-fill-lower{background:#ff6e40}input[type="range"]::-ms-fill-upper{background:#bdbdbd;border-radius:3rem}input[type="range"]:focus::-ms-fill-upper{background:#ff6e40}input[type="range"]::-moz-range-thumb{height:16px;width:16px;border-radius:50%;background:#ffffff;margin-top:-5px;box-shadow:1px 1px 2px rgba(0, 0, 0, 0.5);cursor:pointer}input[type="range"]::-moz-range-track{width:80%;height:9px;background:#bdbdbd;border-radius:3rem;transition:all 0.5s;cursor:pointer}input[type="range"]:hover::-moz-range-track{background:#ff6e40}</style>`;

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes)
    			},
    			instance$1,
    			create_fragment$1,
    			safe_not_equal,
    			{
    				shadowed: 3,
    				pager_data: 0,
    				pager_config: 1,
    				page_data: 2,
    				table_config: 4
    			},
    			[-1, -1]
    		);

    		if (options) {
    			if (options.target) {
    				insert(options.target, this, options.anchor);
    			}

    			if (options.props) {
    				this.$set(options.props);
    				flush();
    			}
    		}
    	}

    	static get observedAttributes() {
    		return ["shadowed", "pager_data", "pager_config", "page_data", "table_config"];
    	}

    	get shadowed() {
    		return this.$$.ctx[3];
    	}

    	set shadowed(shadowed) {
    		this.$set({ shadowed });
    		flush();
    	}

    	get pager_data() {
    		return this.$$.ctx[0];
    	}

    	set pager_data(pager_data) {
    		this.$set({ pager_data });
    		flush();
    	}

    	get pager_config() {
    		return this.$$.ctx[1];
    	}

    	set pager_config(pager_config) {
    		this.$set({ pager_config });
    		flush();
    	}

    	get page_data() {
    		return this.$$.ctx[2];
    	}

    	set page_data(page_data) {
    		this.$set({ page_data });
    		flush();
    	}

    	get table_config() {
    		return this.$$.ctx[4];
    	}

    	set table_config(table_config) {
    		this.$set({ table_config });
    		flush();
    	}
    }

    customElements.define("table-pager", GenericTablePager);

    return GenericTablePager;

})));
