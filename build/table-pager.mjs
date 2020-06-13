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
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_data(text, data) {
        data = '' + data;
        if (text.data !== data)
            text.data = data;
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
    	let span4;
    	let t2;
    	let span2;
    	let t3;
    	let t4;
    	let t5_value = /*firstLineOfPage*/ ctx[4]() + "";
    	let t5;
    	let t6;
    	let t7_value = /*lastLineOfPage*/ ctx[5]() + "";
    	let t7;
    	let t8;
    	let span3;
    	let t9;
    	let t10;
    	let t11;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			main = element("main");
    			span0 = element("span");
    			t0 = space();
    			span1 = element("span");
    			t1 = space();
    			span4 = element("span");
    			t2 = text("lines: ");
    			span2 = element("span");
    			t3 = text(/*maxLines*/ ctx[2]);
    			t4 = text(" / ");
    			t5 = text(t5_value);
    			t6 = text("-");
    			t7 = text(t7_value);
    			t8 = text("\n        /\n        page: ");
    			span3 = element("span");
    			t9 = text(/*currentPage*/ ctx[1]);
    			t10 = text("/");
    			t11 = text(/*maxPages*/ ctx[3]);
    			this.c = noop;
    			attr(span0, "id", "left");
    			attr(span0, "class", span0_class_value = "options left " + (/*currentPage*/ ctx[1] > 1 ? "active" : "inactive"));
    			set_style(span0, "float", "left");
    			attr(span0, "title", "Left");
    			attr(span0, "tabindex", "0");
    			attr(span1, "id", "right");

    			attr(span1, "class", span1_class_value = "options right " + (/*maxLines*/ ctx[2] > /*currentPage*/ ctx[1] * /*pager_config*/ ctx[0].lines
    			? "active"
    			: "inactive"));

    			set_style(span1, "float", "left");
    			attr(span1, "title", "Right");
    			attr(span1, "tabindex", "0");
    			attr(span2, "class", "number-lines");
    			attr(span3, "class", "number");
    			attr(span4, "class", "info");
    			set_style(span4, "float", "right");
    			attr(main, "class", "pager");

    			set_style(main, "width", /*pager_config*/ ctx[0].width !== undefined
    			? /*pager_config*/ ctx[0].width
    			: /*pager_config_default*/ ctx[6].width);
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, span0);
    			span0.innerHTML = iconLeft;
    			append(main, t0);
    			append(main, span1);
    			span1.innerHTML = iconRight;
    			append(main, t1);
    			append(main, span4);
    			append(span4, t2);
    			append(span4, span2);
    			append(span2, t3);
    			append(span2, t4);
    			append(span2, t5);
    			append(span2, t6);
    			append(span2, t7);
    			append(span4, t8);
    			append(span4, span3);
    			append(span3, t9);
    			append(span3, t10);
    			append(span3, t11);

    			if (!mounted) {
    				dispose = [
    					listen(span0, "click", /*click_handler*/ ctx[10]),
    					listen(span1, "click", /*click_handler_1*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*currentPage*/ 2 && span0_class_value !== (span0_class_value = "options left " + (/*currentPage*/ ctx[1] > 1 ? "active" : "inactive"))) {
    				attr(span0, "class", span0_class_value);
    			}

    			if (dirty & /*maxLines, currentPage, pager_config*/ 7 && span1_class_value !== (span1_class_value = "options right " + (/*maxLines*/ ctx[2] > /*currentPage*/ ctx[1] * /*pager_config*/ ctx[0].lines
    			? "active"
    			: "inactive"))) {
    				attr(span1, "class", span1_class_value);
    			}

    			if (dirty & /*maxLines*/ 4) set_data(t3, /*maxLines*/ ctx[2]);
    			if (dirty & /*firstLineOfPage*/ 16 && t5_value !== (t5_value = /*firstLineOfPage*/ ctx[4]() + "")) set_data(t5, t5_value);
    			if (dirty & /*lastLineOfPage*/ 32 && t7_value !== (t7_value = /*lastLineOfPage*/ ctx[5]() + "")) set_data(t7, t7_value);
    			if (dirty & /*currentPage*/ 2) set_data(t9, /*currentPage*/ ctx[1]);
    			if (dirty & /*maxPages*/ 8) set_data(t11, /*maxPages*/ ctx[3]);

    			if (dirty & /*pager_config*/ 1) {
    				set_style(main, "width", /*pager_config*/ ctx[0].width !== undefined
    				? /*pager_config*/ ctx[0].width
    				: /*pager_config_default*/ ctx[6].width);
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
    		width: "250px"
    	};

    	let { pager_data = {} } = $$props;
    	let { pager_config = pager_config_default } = $$props;
    	let currentPage;
    	let maxLines = pager_data.length;
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
    			}
    		} else {
    			getNextPage();

    			const details = {
    				page: currentPage,
    				pages: maxPages,
    				body: page_data
    			};

    			dispatcher("newpage", details);
    		}

    		if (maxLines <= pager_config.lines + 1) {
    			if (shadowed) {
    				document.querySelector("table-pager").shadowRoot.getElementById("right").classList.remove("active");
    				document.querySelector("table-pager").shadowRoot.getElementById("right").classList.add("inactive");
    			} else {
    				document.getElementById("right").classList.remove("active");
    				document.getElementById("right").classList.add("inactive");
    			}
    		}
    	}

    	function getNextPage() {
    		if (currentPage < maxPages) {
    			page_data = pager_data.slice(pager_config.lines * currentPage, pager_config.lines * (currentPage + 1));
    			$$invalidate(1, currentPage++, currentPage);
    		}
    	}

    	function getPreviousPage() {
    		if (currentPage > 1) {
    			page_data = pager_data.slice(pager_config.lines * currentPage - pager_config.lines * 2, pager_config.lines * (currentPage + 1) - pager_config.lines * 2);
    			$$invalidate(1, currentPage--, currentPage);
    		}
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

    	$$self.$set = $$props => {
    		if ("pager_data" in $$props) $$invalidate(9, pager_data = $$props.pager_data);
    		if ("pager_config" in $$props) $$invalidate(0, pager_config = $$props.pager_config);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*pager_data*/ 512) {
    			/* istanbul ignore next line */
    			 $$invalidate(9, pager_data = typeof pager_data === "string"
    			? JSON.parse(pager_data)
    			: pager_data);
    		}

    		if ($$self.$$.dirty & /*pager_config*/ 1) {
    			/* istanbul ignore next line */
    			 $$invalidate(0, pager_config = typeof pager_config === "string"
    			? JSON.parse(pager_config)
    			: pager_config);
    		}

    		if ($$self.$$.dirty & /*pager_data*/ 512) {
    			 $$invalidate(2, maxLines = pager_data.length);
    		}

    		if ($$self.$$.dirty & /*maxLines, pager_config*/ 5) {
    			 $$invalidate(3, maxPages = Math.ceil(maxLines / pager_config.lines));
    		}

    		if ($$self.$$.dirty & /*pager_config, currentPage*/ 3) {
    			 $$invalidate(4, firstLineOfPage = () => {
    				return pager_config.lines * (currentPage - 1) + 1;
    			});
    		}

    		if ($$self.$$.dirty & /*pager_config, currentPage, pager_data*/ 515) {
    			 $$invalidate(5, lastLineOfPage = () => {
    				const last = pager_config.lines * (currentPage - 1) + pager_config.lines;
    				return last > pager_data.length ? pager_data.length : last;
    			});
    		}
    	};

    	 $$invalidate(1, currentPage = 0);

    	return [
    		pager_config,
    		currentPage,
    		maxLines,
    		maxPages,
    		firstLineOfPage,
    		lastLineOfPage,
    		pager_config_default,
    		handleLeft,
    		handleRight,
    		pager_data,
    		click_handler,
    		click_handler_1
    	];
    }

    class GenericTablePager extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>.pager{text-align:center;min-width:220px;max-width:100%;margin-left:1em;height:1em}.number{font-size:0.65em}.number-lines{font-size:0.6em}.info{position:relative;top:0.3em;color:#999999;font-size:0.7em;font-weight:200;width:200px}.inactive{visibility:hidden}.active{visibility:visible}.active:hover{color:limegreen;opacity:80%}.options{position:relative;top:0;width:16px;height:16px;padding:0.2em 0.4em;cursor:pointer;opacity:60%;color:#999999}.options:hover{opacity:100%}.options:focus{border:none;outline:none;opacity:100%}</style>`;
    		init(this, { target: this.shadowRoot }, instance, create_fragment, safe_not_equal, { pager_data: 9, pager_config: 0 });

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
    		return this.$$.ctx[9];
    	}

    	set pager_data(pager_data) {
    		this.$set({ pager_data });
    		flush();
    	}

    	get pager_config() {
    		return this.$$.ctx[0];
    	}

    	set pager_config(pager_config) {
    		this.$set({ pager_config });
    		flush();
    	}
    }

    customElements.define("table-pager", GenericTablePager);

    return GenericTablePager;

}());
