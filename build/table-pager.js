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
        return value === '' ? undefined : +value;
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
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

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error(`Function called outside component initialization`);
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
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
            dirty
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if ($$.bound[i])
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
            $set() {
                // overridden by instance, if it has props
            }
        };
    }

    const iconLeft =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-left"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';

    const iconRight =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-arrow-right"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';

    /* src/GenericTablePager.svelte generated by Svelte v3.23.1 */

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
    	let t7_value = /*pager_data*/ ctx[0].length + "";
    	let t7;
    	let t8;
    	let t9_value = /*firstLineOfPage*/ ctx[7]() + "";
    	let t9;
    	let t10;
    	let t11_value = /*lastLineOfPage*/ ctx[8]() + "";
    	let t11;
    	let t12;
    	let span5;
    	let t13;
    	let t14;
    	let t15;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			main = element("main");
    			span0 = element("span");
    			t0 = space();
    			span1 = element("span");
    			t1 = space();
    			span3 = element("span");
    			input = element("input");
    			t2 = space();
    			span2 = element("span");
    			t3 = text(/*currentStep*/ ctx[4]);
    			t4 = text(" rows");
    			t5 = space();
    			span6 = element("span");
    			t6 = text("lines: ");
    			span4 = element("span");
    			t7 = text(t7_value);
    			t8 = text(" / ");
    			t9 = text(t9_value);
    			t10 = text("-");
    			t11 = text(t11_value);
    			t12 = text("\n        /\n        page: ");
    			span5 = element("span");
    			t13 = text(/*currentPage*/ ctx[5]);
    			t14 = text("/");
    			t15 = text(/*maxPages*/ ctx[6]);
    			this.c = noop;
    			attr(span0, "id", "left");
    			attr(span0, "class", span0_class_value = "options left " + (/*currentPage*/ ctx[5] > 1 ? "active" : "inactive"));
    			set_style(span0, "float", "left");
    			attr(span0, "title", "Left");
    			attr(span0, "tabindex", "0");
    			attr(span1, "id", "right");

    			attr(span1, "class", span1_class_value = "options right " + (/*pager_data*/ ctx[0].length > /*currentPage*/ ctx[5] * /*pager_config*/ ctx[1].lines
    			? "active"
    			: "inactive"));

    			set_style(span1, "float", "left");
    			attr(span1, "title", "Right");
    			attr(span1, "tabindex", "0");
    			attr(input, "id", "slider");
    			attr(input, "type", "range");
    			attr(input, "min", "0");
    			attr(input, "max", /*maxSteps*/ ctx[3]);
    			attr(input, "steps", /*maxSteps*/ ctx[3]);
    			attr(span2, "class", "number-rows");
    			attr(span3, "class", "info range");
    			set_style(span3, "float", "left");
    			attr(span4, "class", "number-lines");
    			attr(span5, "class", "number");
    			attr(span6, "class", "info");
    			set_style(span6, "float", "right");
    			attr(main, "class", "pager");

    			set_style(main, "width", /*pager_config*/ ctx[1].width !== undefined
    			? /*pager_config*/ ctx[1].width
    			: /*pager_config_default*/ ctx[9].width);
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, span0);
    			span0.innerHTML = iconLeft;
    			append(main, t0);
    			append(main, span1);
    			span1.innerHTML = iconRight;
    			append(main, t1);
    			append(main, span3);
    			append(span3, input);
    			set_input_value(input, /*sliderIndex*/ ctx[2]);
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
    			append(span6, t12);
    			append(span6, span5);
    			append(span5, t13);
    			append(span5, t14);
    			append(span5, t15);

    			if (!mounted) {
    				dispose = [
    					listen(span0, "click", /*click_handler*/ ctx[13]),
    					listen(span1, "click", /*click_handler_1*/ ctx[14]),
    					listen(input, "change", /*input_change_input_handler*/ ctx[15]),
    					listen(input, "input", /*input_change_input_handler*/ ctx[15]),
    					listen(input, "input", /*handlePagerConfig*/ ctx[12])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*currentPage*/ 32 && span0_class_value !== (span0_class_value = "options left " + (/*currentPage*/ ctx[5] > 1 ? "active" : "inactive"))) {
    				attr(span0, "class", span0_class_value);
    			}

    			if (dirty & /*pager_data, currentPage, pager_config*/ 35 && span1_class_value !== (span1_class_value = "options right " + (/*pager_data*/ ctx[0].length > /*currentPage*/ ctx[5] * /*pager_config*/ ctx[1].lines
    			? "active"
    			: "inactive"))) {
    				attr(span1, "class", span1_class_value);
    			}

    			if (dirty & /*maxSteps*/ 8) {
    				attr(input, "max", /*maxSteps*/ ctx[3]);
    			}

    			if (dirty & /*maxSteps*/ 8) {
    				attr(input, "steps", /*maxSteps*/ ctx[3]);
    			}

    			if (dirty & /*sliderIndex*/ 4) {
    				set_input_value(input, /*sliderIndex*/ ctx[2]);
    			}

    			if (dirty & /*currentStep*/ 16) set_data(t3, /*currentStep*/ ctx[4]);
    			if (dirty & /*pager_data*/ 1 && t7_value !== (t7_value = /*pager_data*/ ctx[0].length + "")) set_data(t7, t7_value);
    			if (dirty & /*firstLineOfPage*/ 128 && t9_value !== (t9_value = /*firstLineOfPage*/ ctx[7]() + "")) set_data(t9, t9_value);
    			if (dirty & /*lastLineOfPage*/ 256 && t11_value !== (t11_value = /*lastLineOfPage*/ ctx[8]() + "")) set_data(t11, t11_value);
    			if (dirty & /*currentPage*/ 32) set_data(t13, /*currentPage*/ ctx[5]);
    			if (dirty & /*maxPages*/ 64) set_data(t15, /*maxPages*/ ctx[6]);

    			if (dirty & /*pager_config*/ 2) {
    				set_style(main, "width", /*pager_config*/ ctx[1].width !== undefined
    				? /*pager_config*/ ctx[1].width
    				: /*pager_config_default*/ ctx[9].width);
    			}
    		},
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let shadowed = document.querySelector("table-pager") !== null
    	? true
    	: false;

    	const dispatch = createEventDispatcher();

    	const pager_config_default = {
    		name: "table-paginator",
    		lines: 10,
    		steps: [1, 2, 5, 10, 20, 50],
    		width: "500px"
    	};

    	let { pager_data = {} } = $$props;
    	let { pager_config = pager_config_default } = $$props;

    	let setSteps = () => {
    		console.log(pager_data.length);

    		let steps = pager_config.steps !== undefined
    		? pager_config.steps
    		: pager_config_default.steps;

    		steps = steps.filter(a => {
    			return a < pager_data.length;
    		});

    		steps.push(pager_data.length);
    		return steps;
    	};

    	pager_config.steps = setSteps();

    	let setLinesBySteps = () => {
    		let current = pager_config.lines !== undefined
    		? pager_config.lines
    		: pager_config_default.lines;

    		let current_set = 1;

    		if (pager_config.steps !== undefined) {
    			pager_config.steps.forEach(step => {
    				if (step <= current && step >= current_set) {
    					current_set = step;
    				}
    			});
    		}

    		return current_set;
    	};

    	let sliderIndex = 0;
    	let maxSteps = 1;
    	let currentStep = 0;
    	let currentPage = 0;
    	let maxPages = 0;
    	let page_data = [];

    	// workaround for webcomponent behaviour
    	if (!shadowed) {
    		onMount(initFirstPage);
    	} else {
    		afterUpdate(initFirstPage);
    	}

    	let initpage = 0;

    	function initFirstPage() {
    		if (shadowed) {
    			if (initpage < 3) {
    				// ToDo : WTF
    				let elem = document.querySelector("table-pager").shadowRoot.getElementById("right");

    				elem.click();
    				initpage++;

    				$$invalidate(2, sliderIndex = pager_config.steps !== undefined
    				? pager_config.steps.indexOf(pager_config.lines)
    				: 0);
    			}
    		} else {
    			getNextPage();

    			const details = {
    				page: currentPage,
    				pages: maxPages,
    				body: page_data
    			};

    			dispatcher("newpage", details);

    			$$invalidate(2, sliderIndex = pager_config.steps !== undefined
    			? pager_config.steps.indexOf(pager_config.lines)
    			: 0);
    		}
    	}

    	function getNextPage() {
    		if (currentPage < maxPages) {
    			page_data = pager_data.slice(pager_config.lines * currentPage, pager_config.lines * (currentPage + 1));
    			$$invalidate(5, currentPage++, currentPage);
    		}
    	}

    	function getPreviousPage() {
    		if (currentPage > 1) {
    			page_data = pager_data.slice(pager_config.lines * currentPage - pager_config.lines * 2, pager_config.lines * (currentPage + 1) - pager_config.lines * 2);
    			$$invalidate(5, currentPage--, currentPage);
    		}
    	}

    	function getFirstPage() {
    		$$invalidate(5, currentPage = 1);
    		page_data = pager_data.slice(0, pager_config.lines);
    	}

    	function handleLeft(event) {
    		if (currentPage > 1) {
    			getPreviousPage();

    			const details = {
    				page: currentPage,
    				pages: maxPages,
    				body: page_data
    			};

    			dispatcher("newpage", details, event);
    		}
    	}

    	function handleRight(event) {
    		getNextPage();

    		const details = {
    			page: currentPage,
    			pages: maxPages,
    			body: page_data
    		};

    		dispatcher("newpage", details, event);
    	}

    	function handlePagerConfig(event) {
    		$$invalidate(1, pager_config.lines = pager_config.steps[sliderIndex], pager_config);
    		$$invalidate(1, pager_config.steps = setSteps(), pager_config);
    		getFirstPage();

    		const details = {
    			page: currentPage,
    			pages: maxPages,
    			body: page_data
    		};

    		dispatcher("newpage", details, event);
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
    	const click_handler = e => handleLeft(e);
    	const click_handler_1 = e => handleRight(e);

    	function input_change_input_handler() {
    		sliderIndex = to_number(this.value);
    		$$invalidate(2, sliderIndex);
    	}

    	$$self.$set = $$props => {
    		if ("pager_data" in $$props) $$invalidate(0, pager_data = $$props.pager_data);
    		if ("pager_config" in $$props) $$invalidate(1, pager_config = $$props.pager_config);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*pager_data*/ 1) {
    			/* istanbul ignore next line */
    			 $$invalidate(0, pager_data = typeof pager_data === "string"
    			? JSON.parse(pager_data)
    			: pager_data);
    		}

    		if ($$self.$$.dirty & /*pager_config*/ 2) {
    			/* istanbul ignore next line */
    			 $$invalidate(1, pager_config = typeof pager_config === "string"
    			? JSON.parse(pager_config)
    			: pager_config);
    		}

    		if ($$self.$$.dirty & /*pager_config, sliderIndex*/ 6) {
    			 $$invalidate(4, currentStep = pager_config.steps !== undefined
    			? pager_config.steps[sliderIndex]
    			: pager_config_default.steps[sliderIndex]);
    		}

    		if ($$self.$$.dirty & /*pager_config*/ 2) {
    			 $$invalidate(3, maxSteps = pager_config.steps !== undefined
    			? pager_config.steps.length - 1
    			: pager_config_default.steps.length - 1);
    		}

    		if ($$self.$$.dirty & /*pager_data, pager_config*/ 3) {
    			 $$invalidate(6, maxPages = Math.ceil(pager_data.length / pager_config.lines));
    		}

    		if ($$self.$$.dirty & /*pager_config, currentPage*/ 34) {
    			 $$invalidate(7, firstLineOfPage = () => {
    				return pager_config.lines * (currentPage - 1) + 1;
    			});
    		}

    		if ($$self.$$.dirty & /*pager_config, currentPage, pager_data*/ 35) {
    			 $$invalidate(8, lastLineOfPage = () => {
    				const last = pager_config.lines * (currentPage - 1) + pager_config.lines;
    				return last > pager_data.length ? pager_data.length : last;
    			});
    		}
    	};

    	 $$invalidate(1, pager_config.lines = setLinesBySteps(), pager_config);

    	return [
    		pager_data,
    		pager_config,
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
    		click_handler,
    		click_handler_1,
    		input_change_input_handler
    	];
    }

    class GenericTablePager extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>.range{background:#fff;height:1.3em;border-radius:5rem;box-shadow:1px 1px 1px rgba(255, 255, 255, 0.3);display:flex;align-items:center;justify-content:center;padding-top:0.25em;outline:none;border:none}.number-rows{position:relative;top:-0.3em;padding-left:0.4em}input[type="range"]{-webkit-appearance:none;width:100px;background:transparent}input[type="range"]:focus{outline:none}input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;height:1em;width:1em;border-radius:50%;background:#ffffff;margin-top:-0.25em;box-shadow:1px 1px 2px rgba(0, 0, 0, 0.5);cursor:pointer}input[type="range"]::-webkit-slider-runnable-track{width:60%;height:9px;background:#dddddd;border-radius:3rem;transition:all 0.5s;cursor:pointer}input[type="range"]:hover::-webkit-slider-runnable-track{background:#ff6e40}input[type="range"]::-ms-track{width:60%;cursor:pointer;height:9px;transition:all 0.5s;background:transparent;border-color:transparent;color:transparent}input[type="range"]::-ms-thumb{height:16px;width:16px;border-radius:50%;background:#ffffff;margin-top:-5px;box-shadow:1px 1px 2px rgba(0, 0, 0, 0.5);cursor:pointer}input[type="range"]::-ms-fill-lower{background:#bdbdbd;border-radius:3rem}input[type="range"]:focus::-ms-fill-lower{background:#ff6e40}input[type="range"]::-ms-fill-upper{background:#bdbdbd;border-radius:3rem}input[type="range"]:focus::-ms-fill-upper{background:#ff6e40}input[type="range"]::-moz-range-thumb{height:16px;width:16px;border-radius:50%;background:#ffffff;margin-top:-5px;box-shadow:1px 1px 2px rgba(0, 0, 0, 0.5);cursor:pointer}input[type="range"]::-moz-range-track{width:60%;height:9px;background:#bdbdbd;border-radius:3rem;transition:all 0.5s;cursor:pointer}input[type="range"]:hover::-moz-range-track{background:#ff6e40}.pager{text-align:center;min-width:220px;max-width:100%;margin-left:1em;height:1em}.number{font-size:0.65em}.number-lines{font-size:0.6em}.info{position:relative;top:0.3em;color:#999999;font-size:0.7em;font-weight:200;width:200px}.inactive{visibility:hidden}.active{visibility:visible}.active:hover{color:limegreen;opacity:80%}.options{position:relative;top:0;width:16px;height:16px;padding:0.2em 0.4em;cursor:pointer;opacity:60%;color:#999999}.options:hover{opacity:100%}.options:focus{border:none;outline:none;opacity:100%}</style>`;
    		init(this, { target: this.shadowRoot }, instance, create_fragment, safe_not_equal, { pager_data: 0, pager_config: 1 });

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
    		return ["pager_data", "pager_config"];
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
    }

    customElements.define("table-pager", GenericTablePager);

    return GenericTablePager;

}());
