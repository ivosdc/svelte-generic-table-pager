var GenericTablePager = (function () {
    'use strict';

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

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
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

    module.exports = require('./dist/build/crud-table');
    var SvelteGenericCrudTable = module.exports;

    /* src/GenericTablePager.svelte generated by Svelte v3.29.0 */

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

    // (178:8) {#if (currentPage > 1)}
    function create_if_block(ctx) {
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

    function create_fragment(ctx) {
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
    		if (/*currentPage*/ ctx[8] > 1) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	function sveltegenericcrudtable_table_data_binding(value) {
    		/*sveltegenericcrudtable_table_data_binding*/ ctx[24].call(null, value);
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
    			t14 = text(/*currentPage*/ ctx[8]);
    			t15 = text("/");
    			t16 = text(/*maxPages*/ ctx[9]);
    			t17 = space();
    			create_component(sveltegenericcrudtable.$$.fragment);
    			this.c = noop;
    			attr(span0, "id", "left");
    			attr(span0, "class", span0_class_value = "options left " + (/*currentPage*/ ctx[8] > 1 ? "active" : "inactive"));
    			set_style(span0, "float", "left");
    			attr(span0, "title", "Left");
    			attr(span0, "tabindex", "0");
    			attr(span1, "id", "right");

    			attr(span1, "class", span1_class_value = "options right " + (/*pager_data*/ ctx[0].length > /*currentPage*/ ctx[8] * /*pager_config*/ ctx[1].lines
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
    					listen(span0, "click", /*click_handler*/ ctx[21]),
    					listen(span1, "click", /*click_handler_1*/ ctx[22]),
    					listen(input, "change", /*input_change_input_handler*/ ctx[23]),
    					listen(input, "input", /*input_change_input_handler*/ ctx[23]),
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

    			if (!current || dirty[0] & /*currentPage*/ 256 && span0_class_value !== (span0_class_value = "options left " + (/*currentPage*/ ctx[8] > 1 ? "active" : "inactive"))) {
    				attr(span0, "class", span0_class_value);
    			}

    			if (!current || dirty[0] & /*pager_data, currentPage, pager_config*/ 259 && span1_class_value !== (span1_class_value = "options right " + (/*pager_data*/ ctx[0].length > /*currentPage*/ ctx[8] * /*pager_config*/ ctx[1].lines
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
    			if ((!current || dirty[0] & /*firstLineOfPage*/ 1024) && t7_value !== (t7_value = /*firstLineOfPage*/ ctx[10]() + "")) set_data(t7, t7_value);
    			if ((!current || dirty[0] & /*lastLineOfPage*/ 2048) && t9_value !== (t9_value = /*lastLineOfPage*/ ctx[11]() + "")) set_data(t9, t9_value);
    			if ((!current || dirty[0] & /*pager_data*/ 1) && t11_value !== (t11_value = /*pager_data*/ ctx[0].length + "")) set_data(t11, t11_value);
    			if (!current || dirty[0] & /*currentPage*/ 256) set_data(t14, /*currentPage*/ ctx[8]);
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

    function instance($$self, $$props, $$invalidate) {
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
    			$$invalidate(8, currentPage++, currentPage);
    		}
    	}

    	function getPreviousPage() {
    		if (currentPage > 1) {
    			$$invalidate(2, page_data = pager_data.slice(pager_config.lines * currentPage - pager_config.lines * 2, pager_config.lines * (currentPage + 1) - pager_config.lines * 2));
    			$$invalidate(8, currentPage--, currentPage);
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
    		$$invalidate(8, currentPage = 1);
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
    			 $$invalidate(7, currentStep = pager_config.steps !== undefined
    			? pager_config.steps[sliderIndex]
    			: pager_config_default.steps[sliderIndex]);
    		}

    		if ($$self.$$.dirty[0] & /*pager_config*/ 2) {
    			 $$invalidate(6, maxSteps = pager_config.steps !== undefined
    			? pager_config.steps.length - 1
    			: pager_config_default.steps.length - 1);
    		}

    		if ($$self.$$.dirty[0] & /*pager_data, pager_config*/ 3) {
    			 $$invalidate(25, max = Math.ceil(pager_data.length / pager_config.lines));
    		}

    		if ($$self.$$.dirty[0] & /*max*/ 33554432) {
    			 $$invalidate(9, maxPages = max > 0 ? max : 1);
    		}

    		if ($$self.$$.dirty[0] & /*page_data*/ 4) {
    			 $$invalidate(2, page_data = typeof page_data === "Array" ? page_data : []);
    		}

    		if ($$self.$$.dirty[0] & /*pager_config, currentPage*/ 258) {
    			 $$invalidate(10, firstLineOfPage = () => {
    				return pager_config.lines * (currentPage - 1) + 1;
    			});
    		}

    		if ($$self.$$.dirty[0] & /*pager_config, currentPage, pager_data*/ 259) {
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
    		maxSteps,
    		currentStep,
    		currentPage,
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
    			{ target: this.shadowRoot },
    			instance,
    			create_fragment,
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

}());
