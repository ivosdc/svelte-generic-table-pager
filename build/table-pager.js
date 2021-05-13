(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('svelte-generic-crud-table/src/SvelteGenericCrudTable.svelte')) :
    typeof define === 'function' && define.amd ? define(['svelte-generic-crud-table/src/SvelteGenericCrudTable.svelte'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.GenericTablePager = factory(global.SvelteGenericCrudTable));
}(this, (function (SvelteGenericCrudTable) { 'use strict';

    function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

    var SvelteGenericCrudTable__default = /*#__PURE__*/_interopDefaultLegacy(SvelteGenericCrudTable);

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
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
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
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
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
        }
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
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
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
            mount_component(component, options.target, options.anchor, options.customElement);
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
                const { on_mount } = this.$$;
                this.$$.on_disconnect = on_mount.map(run).filter(is_function);
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            disconnectedCallback() {
                run_all(this.$$.on_disconnect);
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

    /* src/GenericTablePager.svelte generated by Svelte v3.38.2 */

    function create_else_block(ctx) {
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

    // (211:8) {#if (currentPage > 1)}
    function create_if_block_1(ctx) {
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

    // (234:0) {#if typeof page_data !== 'string'}
    function create_if_block(ctx) {
    	let sveltegenericcrudtable;
    	let updating_table_data;
    	let current;

    	function sveltegenericcrudtable_table_data_binding(value) {
    		/*sveltegenericcrudtable_table_data_binding*/ ctx[24](value);
    	}

    	let sveltegenericcrudtable_props = {
    		shadowed: false,
    		table_config: /*table_config*/ ctx[3]
    	};

    	if (/*page_data*/ ctx[2] !== void 0) {
    		sveltegenericcrudtable_props.table_data = /*page_data*/ ctx[2];
    	}

    	sveltegenericcrudtable = new SvelteGenericCrudTable__default['default']({ props: sveltegenericcrudtable_props });
    	binding_callbacks.push(() => bind(sveltegenericcrudtable, "table_data", sveltegenericcrudtable_table_data_binding));
    	sveltegenericcrudtable.$on("delete", /*handleDelete*/ ctx[16]);
    	sveltegenericcrudtable.$on("update", /*handleUpdate*/ ctx[17]);
    	sveltegenericcrudtable.$on("create", /*handleCreate*/ ctx[15]);
    	sveltegenericcrudtable.$on("details", /*handleDetail*/ ctx[18]);
    	sveltegenericcrudtable.$on("sort", /*handleSort*/ ctx[19]);

    	return {
    		c() {
    			create_component(sveltegenericcrudtable.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(sveltegenericcrudtable, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const sveltegenericcrudtable_changes = {};
    			if (dirty[0] & /*table_config*/ 8) sveltegenericcrudtable_changes.table_config = /*table_config*/ ctx[3];

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
    			destroy_component(sveltegenericcrudtable, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let div;
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
    	let t7_value = /*firstLineOfPage*/ ctx[9]() + "";
    	let t7;
    	let t8;
    	let t9_value = /*lastLineOfPage*/ ctx[10]() + "";
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
    	let if_block1_anchor;
    	let current;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*currentPage*/ ctx[4] > 1) return create_if_block_1;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);
    	let if_block1 = typeof /*page_data*/ ctx[2] !== "string" && create_if_block(ctx);

    	return {
    		c() {
    			div = element("div");
    			span0 = element("span");
    			if_block0.c();
    			t0 = space();
    			span1 = element("span");
    			t1 = space();
    			span3 = element("span");
    			input = element("input");
    			t2 = space();
    			span2 = element("span");
    			t3 = text(/*currentStep*/ ctx[7]);
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
    			t14 = text(/*currentPage*/ ctx[4]);
    			t15 = text("/");
    			t16 = text(/*maxPages*/ ctx[8]);
    			t17 = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    			this.c = noop;
    			attr(span0, "id", "left");
    			attr(span0, "class", span0_class_value = "options left " + (/*currentPage*/ ctx[4] > 1 ? "active" : "inactive"));
    			set_style(span0, "float", "left");
    			attr(span0, "title", "Left");
    			attr(span0, "tabindex", "0");
    			attr(span1, "id", "right");

    			attr(span1, "class", span1_class_value = "options right " + (/*pager_data*/ ctx[0].length > /*currentPage*/ ctx[4] * /*pager_config*/ ctx[1].lines
    			? "active"
    			: "inactive"));

    			set_style(span1, "float", "left");
    			attr(span1, "title", "Right");
    			attr(span1, "tabindex", "0");
    			attr(input, "id", "slider");
    			attr(input, "type", "range");
    			attr(input, "min", "1");
    			attr(input, "max", /*maxSteps*/ ctx[6]);
    			attr(input, "steps", /*maxSteps*/ ctx[6]);
    			attr(span2, "class", "number-rows");
    			attr(span3, "class", "range");
    			set_style(span3, "float", "left");
    			attr(span4, "class", "number-lines");
    			attr(span5, "class", "number-pages");
    			attr(span6, "class", "info");
    			set_style(span6, "clear", "both");
    			attr(div, "class", "pager");

    			set_style(div, "width", /*pager_config*/ ctx[1].width !== undefined
    			? /*pager_config*/ ctx[1].width
    			: /*pager_config_default*/ ctx[11].width);
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, span0);
    			if_block0.m(span0, null);
    			append(div, t0);
    			append(div, span1);
    			span1.innerHTML = iconRight;
    			append(div, t1);
    			append(div, span3);
    			append(span3, input);
    			set_input_value(input, /*sliderIndex*/ ctx[5]);
    			append(span3, t2);
    			append(span3, span2);
    			append(span2, t3);
    			append(span2, t4);
    			append(div, t5);
    			append(div, span6);
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
    			if (if_block1) if_block1.m(target, anchor);
    			insert(target, if_block1_anchor, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen(span0, "click", /*click_handler*/ ctx[21]),
    					listen(span1, "click", /*click_handler_1*/ ctx[22]),
    					listen(input, "change", /*input_change_input_handler*/ ctx[23]),
    					listen(input, "input", /*input_change_input_handler*/ ctx[23]),
    					listen(input, "input", /*handlePagerConfig*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(span0, null);
    				}
    			}

    			if (!current || dirty[0] & /*currentPage*/ 16 && span0_class_value !== (span0_class_value = "options left " + (/*currentPage*/ ctx[4] > 1 ? "active" : "inactive"))) {
    				attr(span0, "class", span0_class_value);
    			}

    			if (!current || dirty[0] & /*pager_data, currentPage, pager_config*/ 19 && span1_class_value !== (span1_class_value = "options right " + (/*pager_data*/ ctx[0].length > /*currentPage*/ ctx[4] * /*pager_config*/ ctx[1].lines
    			? "active"
    			: "inactive"))) {
    				attr(span1, "class", span1_class_value);
    			}

    			if (!current || dirty[0] & /*maxSteps*/ 64) {
    				attr(input, "max", /*maxSteps*/ ctx[6]);
    			}

    			if (!current || dirty[0] & /*maxSteps*/ 64) {
    				attr(input, "steps", /*maxSteps*/ ctx[6]);
    			}

    			if (dirty[0] & /*sliderIndex*/ 32) {
    				set_input_value(input, /*sliderIndex*/ ctx[5]);
    			}

    			if (!current || dirty[0] & /*currentStep*/ 128) set_data(t3, /*currentStep*/ ctx[7]);
    			if ((!current || dirty[0] & /*firstLineOfPage*/ 512) && t7_value !== (t7_value = /*firstLineOfPage*/ ctx[9]() + "")) set_data(t7, t7_value);
    			if ((!current || dirty[0] & /*lastLineOfPage*/ 1024) && t9_value !== (t9_value = /*lastLineOfPage*/ ctx[10]() + "")) set_data(t9, t9_value);
    			if ((!current || dirty[0] & /*pager_data*/ 1) && t11_value !== (t11_value = /*pager_data*/ ctx[0].length + "")) set_data(t11, t11_value);
    			if (!current || dirty[0] & /*currentPage*/ 16) set_data(t14, /*currentPage*/ ctx[4]);
    			if (!current || dirty[0] & /*maxPages*/ 256) set_data(t16, /*maxPages*/ ctx[8]);

    			if (!current || dirty[0] & /*pager_config*/ 2) {
    				set_style(div, "width", /*pager_config*/ ctx[1].width !== undefined
    				? /*pager_config*/ ctx[1].width
    				: /*pager_config_default*/ ctx[11].width);
    			}

    			if (typeof /*page_data*/ ctx[2] !== "string") {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty[0] & /*page_data*/ 4) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}
    		},
    		i(local) {
    			if (current) return;
    			transition_in(if_block1);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block1);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div);
    			if_block0.d();
    			if (detaching) detach(t17);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach(if_block1_anchor);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function getSliderIndex(config) {
    	let checkIndex = config.steps !== undefined
    	? config.steps.indexOf(config.lines)
    	: 0;

    	return checkIndex;
    }

    function getMaxPages(current_max) {
    	let check_max = current_max > 0 ? current_max : 1;
    	return check_max === Infinity ? 1 : check_max;
    }

    function instance($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();

    	const pager_config_default = {
    		name: "table-paginator",
    		lines: 1,
    		steps: [0, 1, 2, 3, 4, 5, 10, 15, 20, 30],
    		width: "500px"
    	};

    	let { pager_data = {} } = $$props;

    	function getPagerData(data) {
    		if (data.length > 0) {
    			data = typeof data === "string" ? JSON.parse(data) : data;
    			initPage();
    		}

    		return data;
    	}

    	let { pager_config = pager_config_default } = $$props;

    	function getPagerConfig(config) {
    		let p_config = config === undefined ? pager_config_default : config;
    		p_config = typeof config === "string" ? JSON.parse(config) : config;

    		p_config.lines = p_config.lines === undefined
    		? p_config.steps[0]
    		: p_config.lines;

    		p_config.steps = setSteps();
    		return p_config;
    	}

    	let setSteps = () => {
    		let steps = pager_config.steps !== undefined
    		? pager_config.steps
    		: pager_config_default.steps;

    		if (pager_data.length > 0) {
    			steps = steps.filter(a => {
    				return parseInt(a) < pager_data.length;
    			});

    			steps.push(pager_data.length);
    		}

    		return steps;
    	};

    	let sliderIndex = getSliderIndex(pager_config);
    	let maxSteps = 1;
    	let currentStep = 0;

    	function getCurrentStep(config) {
    		let conf = config.steps !== undefined
    		? config.steps[sliderIndex]
    		: pager_config_default.steps[sliderIndex];

    		$$invalidate(5, sliderIndex = conf === undefined ? 1 : sliderIndex);
    		return conf === undefined ? 1 : conf;
    	}

    	function getMaxSteps(config) {
    		let checkMax = config.steps !== undefined
    		? config.steps.length - 1
    		: pager_config_default.steps.length - 1;

    		return checkMax === 0 ? config.steps.length : checkMax;
    	}

    	let currentPage = 1;
    	let maxPages = 1;
    	let max;
    	let { page_data } = $$props;

    	function getPageData(data) {
    		$$invalidate(1, pager_config.steps = setSteps(), pager_config);

    		$$invalidate(5, sliderIndex = sliderIndex > 1
    		? $$invalidate(5, sliderIndex--, sliderIndex)
    		: sliderIndex);

    		return data === undefined ? [] : data;
    	}

    	function initPage() {
    		$$invalidate(1, pager_config = typeof pager_config === "string"
    		? JSON.parse(pager_config)
    		: pager_config);

    		if (pager_config.lines === undefined) {
    			$$invalidate(1, pager_config.lines = 1, pager_config);
    		}

    		$$invalidate(2, page_data = pager_data.slice(pager_config.lines * (currentPage - 1), pager_config.lines * currentPage));
    	}

    	function getNextPage() {
    		if (currentPage < maxPages) {
    			$$invalidate(2, page_data = pager_data.slice(pager_config.lines * currentPage, pager_config.lines * (currentPage + 1)));
    			$$invalidate(4, currentPage++, currentPage);
    		}
    	}

    	function getPreviousPage() {
    		if (currentPage > 1) {
    			$$invalidate(2, page_data = pager_data.slice(pager_config.lines * currentPage - pager_config.lines * 2, pager_config.lines * (currentPage + 1) - pager_config.lines * 2));
    			$$invalidate(4, currentPage--, currentPage);
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
    		$$invalidate(4, currentPage = 1);
    		$$invalidate(1, pager_config.steps = setSteps(), pager_config);
    		$$invalidate(1, pager_config.lines = pager_config.steps[sliderIndex], pager_config);
    		initPage();
    	}

    	function dispatcher(name, details, event) {
    		dispatch(name, details);
    	}

    	let firstLineOfPage = 0;
    	let lastLineOfPage = 0;

    	function handleCreate(event) {
    		const details = {};
    		dispatcher("create", details);
    	}

    	function handleDelete(event) {
    		const details = {
    			id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
    			body: event.detail.body
    		};

    		dispatcher("delete", details);
    	}

    	function handleUpdate(event) {
    		const details = {
    			id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
    			body: event.detail.body
    		};

    		dispatcher("update", details);
    	}

    	function handleDetail(event) {
    		const details = {
    			id: parseInt(event.detail.id) + (currentPage - 1) * currentStep,
    			body: event.detail.body
    		};

    		dispatcher("details", details);
    	}

    	function handleSort(event) {
    		const column = event.detail.column;
    		const details = { column };
    		dispatcher("sort", details);
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
    		if ("pager_data" in $$props) $$invalidate(0, pager_data = $$props.pager_data);
    		if ("pager_config" in $$props) $$invalidate(1, pager_config = $$props.pager_config);
    		if ("page_data" in $$props) $$invalidate(2, page_data = $$props.page_data);
    		if ("table_config" in $$props) $$invalidate(3, table_config = $$props.table_config);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*pager_data*/ 1) {
    			$$invalidate(0, pager_data = getPagerData(pager_data));
    		}

    		if ($$self.$$.dirty[0] & /*pager_config*/ 2) {
    			$$invalidate(1, pager_config = getPagerConfig(pager_config));
    		}

    		if ($$self.$$.dirty[0] & /*pager_config*/ 2) {
    			$$invalidate(7, currentStep = getCurrentStep(pager_config));
    		}

    		if ($$self.$$.dirty[0] & /*pager_config*/ 2) {
    			$$invalidate(6, maxSteps = getMaxSteps(pager_config));
    		}

    		if ($$self.$$.dirty[0] & /*pager_data, pager_config*/ 3) {
    			$$invalidate(20, max = Math.ceil(pager_data.length / pager_config.lines));
    		}

    		if ($$self.$$.dirty[0] & /*max*/ 1048576) {
    			$$invalidate(8, maxPages = getMaxPages(max));
    		}

    		if ($$self.$$.dirty[0] & /*page_data*/ 4) {
    			$$invalidate(2, page_data = getPageData(page_data));
    		}

    		if ($$self.$$.dirty[0] & /*pager_config, currentPage*/ 18) {
    			$$invalidate(9, firstLineOfPage = () => {
    				return pager_config.lines * (currentPage - 1) + 1;
    			});
    		}

    		if ($$self.$$.dirty[0] & /*pager_config, currentPage, pager_data*/ 19) {
    			$$invalidate(10, lastLineOfPage = () => {
    				const last = pager_config.lines * (currentPage - 1) + pager_config.lines;
    				return last > pager_data.length ? pager_data.length : last;
    			});
    		}
    	};

    	return [
    		pager_data,
    		pager_config,
    		page_data,
    		table_config,
    		currentPage,
    		sliderIndex,
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
    		this.shadowRoot.innerHTML = `<style>.range{background:#fff;height:1.3em;border-radius:5rem;box-shadow:1px 1px 1px rgba(255, 255, 255, 0.3);display:flex;align-items:center;justify-content:center;padding-top:0.3em;outline:none;border:none;text-align:left;color:#999999;font-size:0.7em;font-weight:200}.number-rows{padding-left:0.4em;padding-top:0.1em}.pager{text-align:center;min-width:400px;max-width:100%;margin-left:1em;height:1.8em}.number-pages{font-size:110%;font-weight:200}.number-lines{padding-top:0.3em;font-size:110%;font-weight:200}.info{position:relative;top:-0.2em;text-align:left;color:#999999;font-size:0.7em;font-weight:200;padding-left:2em}.inactive{visibility:hidden}.active{visibility:visible}.active:hover{color:limegreen;opacity:80%}.options{position:relative;top:-0.1em;width:16px;height:16px;padding:0.2em;cursor:pointer;opacity:60%;color:#999999}.options:hover{opacity:100%}.options:focus{border:none;outline:none;opacity:100%}input[type="range"]{-webkit-appearance:none;width:100px;background:transparent}input[type="range"]:focus{outline:none}input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;height:1em;width:1em;border-radius:50%;background:#ffffff;margin-top:-0.25em;box-shadow:1px 1px 2px rgba(0, 0, 0, 0.5);cursor:pointer}input[type="range"]::-webkit-slider-runnable-track{width:60%;height:9px;background:#dddddd;border-radius:3rem;transition:all 0.5s;cursor:pointer}input[type="range"]:hover::-webkit-slider-runnable-track{background:#ff6e40}input[type="range"]::-ms-track{width:60%;cursor:pointer;height:9px;transition:all 0.5s;background:transparent;border-color:transparent;color:transparent}input[type="range"]::-ms-thumb{height:16px;width:16px;border-radius:50%;background:#ffffff;margin-top:-5px;box-shadow:1px 1px 2px rgba(0, 0, 0, 0.5);cursor:pointer}input[type="range"]::-ms-fill-lower{background:#bdbdbd;border-radius:3rem}input[type="range"]:focus::-ms-fill-lower{background:#ff6e40}input[type="range"]::-ms-fill-upper{background:#bdbdbd;border-radius:3rem}input[type="range"]:focus::-ms-fill-upper{background:#ff6e40}input[type="range"]::-moz-range-thumb{height:16px;width:16px;border-radius:50%;background:#ffffff;margin-top:-5px;box-shadow:1px 1px 2px rgba(0, 0, 0, 0.5);cursor:pointer}input[type="range"]::-moz-range-track{width:80%;height:9px;background:#bdbdbd;border-radius:3rem;transition:all 0.5s;cursor:pointer}input[type="range"]:hover::-moz-range-track{background:#ff6e40}</style>`;

    		init(
    			this,
    			{
    				target: this.shadowRoot,
    				props: attribute_to_object(this.attributes),
    				customElement: true
    			},
    			instance,
    			create_fragment,
    			safe_not_equal,
    			{
    				pager_data: 0,
    				pager_config: 1,
    				page_data: 2,
    				table_config: 3
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
    		return ["pager_data", "pager_config", "page_data", "table_config"];
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
    		return this.$$.ctx[3];
    	}

    	set table_config(table_config) {
    		this.$set({ table_config });
    		flush();
    	}
    }

    customElements.define("table-pager", GenericTablePager);

    return GenericTablePager;

})));
