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
    	let t0;
    	let span3;
    	let t1;
    	let span1;
    	let t2;
    	let t3;
    	let t4_value = /*firstLineOfPage*/ ctx[3]() + "";
    	let t4;
    	let t5;
    	let t6_value = /*lastLineOfPage*/ ctx[4]() + "";
    	let t6;
    	let t7;
    	let span2;
    	let t8;
    	let t9;
    	let t10;
    	let t11;
    	let span4;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			main = element("main");
    			span0 = element("span");
    			t0 = space();
    			span3 = element("span");
    			t1 = text("lines: ");
    			span1 = element("span");
    			t2 = text(/*maxLines*/ ctx[1]);
    			t3 = text(" / ");
    			t4 = text(t4_value);
    			t5 = text("-");
    			t6 = text(t6_value);
    			t7 = text("\n        /\n        page: ");
    			span2 = element("span");
    			t8 = text(/*currentPage*/ ctx[0]);
    			t9 = text("/");
    			t10 = text(/*maxPages*/ ctx[2]);
    			t11 = space();
    			span4 = element("span");
    			this.c = noop;
    			attr(span0, "id", "left");
    			attr(span0, "class", "options left active");
    			set_style(span0, "float", "left");
    			attr(span0, "title", "Left");
    			attr(span0, "tabindex", "0");
    			attr(span1, "class", "number-lines");
    			attr(span2, "class", "number");
    			attr(span3, "class", "info");
    			attr(span4, "id", "right");
    			attr(span4, "class", "options right active");
    			set_style(span4, "float", "right");
    			attr(span4, "title", "Right");
    			attr(span4, "tabindex", "0");
    			attr(main, "class", "pager");
    		},
    		m(target, anchor) {
    			insert(target, main, anchor);
    			append(main, span0);
    			span0.innerHTML = iconLeft;
    			append(main, t0);
    			append(main, span3);
    			append(span3, t1);
    			append(span3, span1);
    			append(span1, t2);
    			append(span1, t3);
    			append(span1, t4);
    			append(span1, t5);
    			append(span1, t6);
    			append(span3, t7);
    			append(span3, span2);
    			append(span2, t8);
    			append(span2, t9);
    			append(span2, t10);
    			append(main, t11);
    			append(main, span4);
    			span4.innerHTML = iconRight;

    			if (!mounted) {
    				dispose = [
    					listen(span0, "click", /*click_handler*/ ctx[9]),
    					listen(span4, "click", /*click_handler_1*/ ctx[10])
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*maxLines*/ 2) set_data(t2, /*maxLines*/ ctx[1]);
    			if (dirty & /*firstLineOfPage*/ 8 && t4_value !== (t4_value = /*firstLineOfPage*/ ctx[3]() + "")) set_data(t4, t4_value);
    			if (dirty & /*lastLineOfPage*/ 16 && t6_value !== (t6_value = /*lastLineOfPage*/ ctx[4]() + "")) set_data(t6, t6_value);
    			if (dirty & /*currentPage*/ 1) set_data(t8, /*currentPage*/ ctx[0]);
    			if (dirty & /*maxPages*/ 4) set_data(t10, /*maxPages*/ ctx[2]);
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
    	const pager_config_default = { name: "table-paginator", lines: 10 };
    	let { pager_data = {} } = $$props;
    	let { pager_config = pager_config_default } = $$props;
    	let currentPage;
    	let maxLines = pager_data.length;
    	let maxPages = 0;
    	let page_data = [];

    	if (!shadowed) {
    		onMount(initFirstPage);
    	} else {
    		afterUpdate(initFirstPage);
    	}

    	function initFirstPage() {
    		getNextPage();
    		const event = new Event("initpage");
    		let elem = document.querySelector("table-pager");
    		Object.defineProperty(event, "target", { writable: false, value: elem });

    		if (maxLines <= pager_config.lines + 1) {
    			if (shadowed) {
    				document.querySelector("table-pager").shadowRoot.getElementById("right").classList.remove("active");
    				document.querySelector("table-pager").shadowRoot.getElementById("right").classList.add("inactive");
    			} else {
    				document.getElementById("right").classList.remove("active");
    				document.getElementById("right").classList.add("inactive");
    			}
    		}

    		if (shadowed) {
    			elem.dispatchEvent(new CustomEvent("newpage", { composed: true, detail: page_data }));
    		} else {
    			dispatcher("newpage", page_data, event);
    		}
    	}

    	function getNextPage() {
    		if (currentPage < maxPages) {
    			page_data = pager_data.slice(pager_config.lines * currentPage, pager_config.lines * (currentPage + 1));
    			$$invalidate(0, currentPage++, currentPage);
    		}
    	}

    	function getPreviousPage() {
    		if (currentPage > 1) {
    			page_data = pager_data.slice(pager_config.lines * currentPage - pager_config.lines * 2, pager_config.lines * (currentPage + 1) - pager_config.lines * 2);
    			$$invalidate(0, currentPage--, currentPage);
    		}
    	}

    	function handleLeft(event) {
    		if (currentPage > 1) {
    			getPreviousPage();
    			dispatcher("newpage", page_data, event);
    		}
    	}

    	function handleRight(event) {
    		getNextPage();
    		dispatcher("newpage", page_data, event);
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
    		if ("pager_data" in $$props) $$invalidate(7, pager_data = $$props.pager_data);
    		if ("pager_config" in $$props) $$invalidate(8, pager_config = $$props.pager_config);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*pager_data*/ 128) {
    			/* istanbul ignore next line */
    			 $$invalidate(7, pager_data = typeof pager_data === "string"
    			? JSON.parse(pager_data)
    			: pager_data);
    		}

    		if ($$self.$$.dirty & /*pager_config*/ 256) {
    			/* istanbul ignore next line */
    			 $$invalidate(8, pager_config = typeof pager_config === "string"
    			? JSON.parse(pager_config)
    			: pager_config);
    		}

    		if ($$self.$$.dirty & /*pager_data*/ 128) {
    			 $$invalidate(1, maxLines = pager_data.length);
    		}

    		if ($$self.$$.dirty & /*maxLines, pager_config*/ 258) {
    			 $$invalidate(2, maxPages = Math.ceil(maxLines / pager_config.lines));
    		}

    		if ($$self.$$.dirty & /*pager_config, currentPage*/ 257) {
    			 $$invalidate(3, firstLineOfPage = () => {
    				return pager_config.lines * (currentPage - 1) + 1;
    			});
    		}

    		if ($$self.$$.dirty & /*pager_config, currentPage, pager_data*/ 385) {
    			 $$invalidate(4, lastLineOfPage = () => {
    				const last = pager_config.lines * (currentPage - 1) + pager_config.lines;
    				return last > pager_data.length ? pager_data.length : last;
    			});
    		}
    	};

    	 $$invalidate(0, currentPage = 0);
    	 page_data = initFirstPage();

    	return [
    		currentPage,
    		maxLines,
    		maxPages,
    		firstLineOfPage,
    		lastLineOfPage,
    		handleLeft,
    		handleRight,
    		pager_data,
    		pager_config,
    		click_handler,
    		click_handler_1
    	];
    }

    class GenericTablePager extends SvelteElement {
    	constructor(options) {
    		super();
    		this.shadowRoot.innerHTML = `<style>.pager{text-align:center;min-width:220px;max-width:220px}.number{font-size:0.65em}.number-lines{font-size:0.6em}.info{position:relative;top:0.25em;color:#999999;font-size:0.7em;font-weight:200;width:200px}.active{visibility:visible}.active:hover{color:limegreen;opacity:80%}.options{position:relative;top:0.25em;width:16px;height:16px;padding:0.2em 0.4em;cursor:pointer;opacity:60%;color:#999999}.options:hover{opacity:100%}.options:focus{border:none;outline:none;opacity:100%}</style>`;
    		init(this, { target: this.shadowRoot }, instance, create_fragment, safe_not_equal, { pager_data: 7, pager_config: 8 });

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
    		return this.$$.ctx[7];
    	}

    	set pager_data(pager_data) {
    		this.$set({ pager_data });
    		flush();
    	}

    	get pager_config() {
    		return this.$$.ctx[8];
    	}

    	set pager_config(pager_config) {
    		this.$set({ pager_config });
    		flush();
    	}
    }

    customElements.define("table-pager", GenericTablePager);

    return GenericTablePager;

}());
