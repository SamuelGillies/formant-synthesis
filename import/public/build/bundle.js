
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
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
        if (node.parentNode) {
            node.parentNode.removeChild(node);
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
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    // unfortunately this can't be a constant as that wouldn't be tree-shakeable
    // so we cache the result instead
    let crossorigin;
    function is_crossorigin() {
        if (crossorigin === undefined) {
            crossorigin = false;
            try {
                if (typeof window !== 'undefined' && window.parent) {
                    void window.parent.document;
                }
            }
            catch (error) {
                crossorigin = true;
            }
        }
        return crossorigin;
    }
    function add_iframe_resize_listener(node, fn) {
        const computed_style = getComputedStyle(node);
        if (computed_style.position === 'static') {
            node.style.position = 'relative';
        }
        const iframe = element('iframe');
        iframe.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        const crossorigin = is_crossorigin();
        let unsubscribe;
        if (crossorigin) {
            iframe.src = "data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>";
            unsubscribe = listen(window, 'message', (event) => {
                if (event.source === iframe.contentWindow)
                    fn();
            });
        }
        else {
            iframe.src = 'about:blank';
            iframe.onload = () => {
                unsubscribe = listen(iframe.contentWindow, 'resize', fn);
                // make sure an initial resize event is fired _after_ the iframe is loaded (which is asynchronous)
                // see https://github.com/sveltejs/svelte/issues/4233
                fn();
            };
        }
        append(node, iframe);
        return () => {
            if (crossorigin) {
                unsubscribe();
            }
            else if (unsubscribe && iframe.contentWindow) {
                unsubscribe();
            }
            detach(iframe);
        };
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
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
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Schedules a callback to run immediately after the component has been updated.
     *
     * The first time the callback runs will be after the initial `onMount`
     */
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
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
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
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
        seen_callbacks.clear();
        set_current_component(saved_component);
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
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
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
        else if (callback) {
            callback();
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
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
            flush_render_callbacks($$.after_update);
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
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
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
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
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
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
            }
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
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.1' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation, has_stop_immediate_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        if (has_stop_immediate_propagation)
            modifiers.push('stopImmediatePropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=} start
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function scaleNumber(input, inputRange, outputRange, decInt) { 
    		let scaledValue = (input - inputRange[0]) * (outputRange[1] - outputRange[0]) 
    											/ (inputRange[1] - inputRange[0]) + outputRange[0];
    		
    		if ((scaledValue <= outputRange[1]) && (scaledValue => outputRange[0])) {
    				return scaledValue.toFixed(decInt); 
    		} else if (scaledValue > outputRange[1]) {
    				return outputRange[1].toFixed(decInt); 
    		} else if (scaledValue < outputRange[0]) {
    				return outputRange[0].toFixed(decInt);
    		}
    }

    let gain = writable(0.); 
    let x = writable(0.5); 
    let y = writable(0.5);

    /* src/Sliders.svelte generated by Svelte v3.59.1 */
    const file$1 = "src/Sliders.svelte";

    function create_fragment$2(ctx) {
    	let div3;
    	let div0;
    	let label0;
    	let input0;
    	let input1;
    	let t1;
    	let div1;
    	let label1;
    	let input2;
    	let input3;
    	let t3;
    	let div2;
    	let label2;
    	let input4;
    	let input5;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			label0 = element("label");
    			label0.textContent = "Gain:";
    			input0 = element("input");
    			input1 = element("input");
    			t1 = space();
    			div1 = element("div");
    			label1 = element("label");
    			label1.textContent = "f1:";
    			input2 = element("input");
    			input3 = element("input");
    			t3 = space();
    			div2 = element("div");
    			label2 = element("label");
    			label2.textContent = "f2:";
    			input4 = element("input");
    			input5 = element("input");
    			attr_dev(label0, "for", "gain");
    			attr_dev(label0, "class", "svelte-ldbiyj");
    			add_location(label0, file$1, 33, 2, 518);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "step", "0.01");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "1");
    			attr_dev(input0, "name", "gain");
    			attr_dev(input0, "class", "svelte-ldbiyj");
    			add_location(input0, file$1, 33, 33, 549);
    			attr_dev(input1, "type", "number");
    			input1.value = /*gvalue*/ ctx[0];
    			attr_dev(input1, "class", "svelte-ldbiyj");
    			add_location(input1, file$1, 33, 105, 621);
    			attr_dev(div0, "class", "slider svelte-ldbiyj");
    			add_location(div0, file$1, 32, 1, 495);
    			attr_dev(label1, "for", "f1");
    			attr_dev(label1, "class", "svelte-ldbiyj");
    			add_location(label1, file$1, 36, 2, 688);
    			attr_dev(input2, "type", "range");
    			attr_dev(input2, "step", "0.01");
    			attr_dev(input2, "min", "0");
    			attr_dev(input2, "max", "1");
    			attr_dev(input2, "name", "f1");
    			attr_dev(input2, "class", "svelte-ldbiyj");
    			add_location(input2, file$1, 36, 29, 715);
    			attr_dev(input3, "type", "number");
    			input3.value = /*f1value*/ ctx[1];
    			attr_dev(input3, "class", "svelte-ldbiyj");
    			add_location(input3, file$1, 36, 119, 805);
    			attr_dev(div1, "class", "slider svelte-ldbiyj");
    			add_location(div1, file$1, 35, 1, 665);
    			attr_dev(label2, "for", "f2");
    			attr_dev(label2, "class", "svelte-ldbiyj");
    			add_location(label2, file$1, 39, 2, 873);
    			attr_dev(input4, "type", "range");
    			attr_dev(input4, "step", "0.01");
    			attr_dev(input4, "min", "0");
    			attr_dev(input4, "max", "1");
    			attr_dev(input4, "name", "f2");
    			attr_dev(input4, "class", "svelte-ldbiyj");
    			add_location(input4, file$1, 39, 29, 900);
    			attr_dev(input5, "type", "number");
    			input5.value = /*f2value*/ ctx[2];
    			attr_dev(input5, "class", "svelte-ldbiyj");
    			add_location(input5, file$1, 39, 119, 990);
    			attr_dev(div2, "class", "slider svelte-ldbiyj");
    			add_location(div2, file$1, 38, 1, 850);
    			attr_dev(div3, "class", "sliderContainer svelte-ldbiyj");
    			add_location(div3, file$1, 31, 0, 464);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, label0);
    			append_dev(div0, input0);
    			set_input_value(input0, /*gvalue*/ ctx[0]);
    			append_dev(div0, input1);
    			append_dev(div3, t1);
    			append_dev(div3, div1);
    			append_dev(div1, label1);
    			append_dev(div1, input2);
    			set_input_value(input2, /*f1value*/ ctx[1]);
    			append_dev(div1, input3);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, label2);
    			append_dev(div2, input4);
    			set_input_value(input4, /*f2value*/ ctx[2]);
    			append_dev(div2, input5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[5]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[5]),
    					listen_dev(input2, "change", /*input2_change_input_handler*/ ctx[6]),
    					listen_dev(input2, "input", /*input2_change_input_handler*/ ctx[6]),
    					listen_dev(input2, "input", /*xChange*/ ctx[3], false, false, false, false),
    					listen_dev(input4, "change", /*input4_change_input_handler*/ ctx[7]),
    					listen_dev(input4, "input", /*input4_change_input_handler*/ ctx[7]),
    					listen_dev(input4, "input", /*yChange*/ ctx[4], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*gvalue*/ 1) {
    				set_input_value(input0, /*gvalue*/ ctx[0]);
    			}

    			if (dirty & /*gvalue*/ 1 && input1.value !== /*gvalue*/ ctx[0]) {
    				prop_dev(input1, "value", /*gvalue*/ ctx[0]);
    			}

    			if (dirty & /*f1value*/ 2) {
    				set_input_value(input2, /*f1value*/ ctx[1]);
    			}

    			if (dirty & /*f1value*/ 2 && input3.value !== /*f1value*/ ctx[1]) {
    				prop_dev(input3, "value", /*f1value*/ ctx[1]);
    			}

    			if (dirty & /*f2value*/ 4) {
    				set_input_value(input4, /*f2value*/ ctx[2]);
    			}

    			if (dirty & /*f2value*/ 4 && input5.value !== /*f2value*/ ctx[2]) {
    				prop_dev(input5, "value", /*f2value*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Sliders', slots, []);
    	let gvalue = 0, f1value, f2value;

    	function gainChange(e) {
    		gain.update(x => gvalue);
    	}

    	function xChange(e) {
    		x.update(x => f1value);
    	}

    	function yChange(e) {
    		y.update(y => f2value);
    	}

    	gain.subscribe(value => {
    		$$invalidate(0, gvalue = value);
    	});

    	x.subscribe(value => {
    		$$invalidate(1, f1value = value);
    	});

    	y.subscribe(value => {
    		$$invalidate(2, f2value = value);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Sliders> was created with unknown prop '${key}'`);
    	});

    	function input0_change_input_handler() {
    		gvalue = to_number(this.value);
    		$$invalidate(0, gvalue);
    	}

    	function input2_change_input_handler() {
    		f1value = to_number(this.value);
    		$$invalidate(1, f1value);
    	}

    	function input4_change_input_handler() {
    		f2value = to_number(this.value);
    		$$invalidate(2, f2value);
    	}

    	$$self.$capture_state = () => ({
    		gain,
    		x,
    		y,
    		scaleNumber,
    		gvalue,
    		f1value,
    		f2value,
    		gainChange,
    		xChange,
    		yChange
    	});

    	$$self.$inject_state = $$props => {
    		if ('gvalue' in $$props) $$invalidate(0, gvalue = $$props.gvalue);
    		if ('f1value' in $$props) $$invalidate(1, f1value = $$props.f1value);
    		if ('f2value' in $$props) $$invalidate(2, f2value = $$props.f2value);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		gvalue,
    		f1value,
    		f2value,
    		xChange,
    		yChange,
    		input0_change_input_handler,
    		input2_change_input_handler,
    		input4_change_input_handler
    	];
    }

    class Sliders extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Sliders",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/Trackpad.svelte generated by Svelte v3.59.1 */
    const file = "src/Trackpad.svelte";

    function create_fragment$1(ctx) {
    	let div2;
    	let div1;
    	let div0;
    	let div0_resize_listener;
    	let div1_resize_listener;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "handle svelte-1wrwive");
    			add_render_callback(() => /*div0_elementresize_handler*/ ctx[10].call(div0));
    			add_location(div0, file, 106, 2, 2993);
    			attr_dev(div1, "class", "trackpad svelte-1wrwive");
    			add_render_callback(() => /*div1_elementresize_handler*/ ctx[12].call(div1));
    			add_location(div1, file, 105, 1, 2879);
    			attr_dev(div2, "class", "trackpadContainer svelte-1wrwive");
    			add_location(div2, file, 104, 0, 2749);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			/*div0_binding*/ ctx[9](div0);
    			div0_resize_listener = add_iframe_resize_listener(div0, /*div0_elementresize_handler*/ ctx[10].bind(div0));
    			/*div1_binding*/ ctx[11](div1);
    			div1_resize_listener = add_iframe_resize_listener(div1, /*div1_elementresize_handler*/ ctx[12].bind(div1));
    			/*div2_binding*/ ctx[13](div2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(div2, "mousedown", /*clickOn*/ ctx[6], false, false, false, false),
    					listen_dev(div2, "mousemove", /*mouseMovement*/ ctx[8], false, false, false, false),
    					listen_dev(div2, "mouseup", /*clickOff*/ ctx[7], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			/*div0_binding*/ ctx[9](null);
    			div0_resize_listener();
    			/*div1_binding*/ ctx[11](null);
    			div1_resize_listener();
    			/*div2_binding*/ ctx[13](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Trackpad', slots, []);
    	const Range = { xmin: 0., xmax: 1., ymin: 0., ymax: 1. };
    	let trackpad, handle, container, trackpadWidth, trackpadHeight, handleHeight;
    	let posX = 1, posY = 1;
    	let clickState = false;

    	function clickOn(event) {
    		clickState = true;
    		let rect = trackpad.getBoundingClientRect();
    		posX = event.clientX - rect.left;
    		posY = event.clientY - rect.top;
    		moveHandle(posX, posY);
    	}

    	function clickOff() {
    		clickState = false;
    	}

    	function mouseMovement(event) {
    		const rect = trackpad.getBoundingClientRect();

    		if (clickState === true) {
    			posX = event.clientX - rect.left;
    			posY = event.clientY - rect.top;
    			moveHandle(posX, posY);
    		}
    	}

    	function moveHandle(moveX, moveY) {
    		let rect = trackpad.getBoundingClientRect();
    		rect.width;

    		// x values
    		if (moveX < handleHeight / 2) {
    			moveX = 0;
    		} else if (moveX > rect.width + handleHeight) {
    			moveX = rect.width + handleHeight;
    		} else {
    			moveX = moveX;
    		}

    		// y values
    		if (moveY < handleHeight / 2) {
    			moveY = 0;
    		} else if (moveY > rect.height + handleHeight) {
    			moveY = rect.height + handleHeight;
    		} else {
    			moveY = moveY;
    		}
    		$$invalidate(1, handle.style.left = moveX + 'px', handle);
    		$$invalidate(1, handle.style.top = moveY + 'px', handle);
    		x.update(x => scaleNumber(moveX, [0, trackpadWidth], [Range.xmin, Range.xmax], 2));
    		y.update(y => scaleNumber(moveY, [0, trackpadHeight], [Range.ymin, Range.ymax], 2));
    	}

    	onMount(async () => {
    		let startWidth = trackpadWidth / 2;
    		let startHeight = trackpadHeight / 2;
    		posX = startWidth;
    		posY = startHeight;
    		moveHandle(startWidth, startHeight);
    	});

    	afterUpdate(() => {
    		if (trackpad) {
    			x.subscribe(value => {
    				let subX = scaleNumber(value, [Range.xmin, Range.xmax], [0, trackpadWidth], 2);
    				let rect = trackpad.getBoundingClientRect();

    				if (subX < handleHeight / 2) {
    					subX = 0;
    				} else if (subX > rect.width - handleHeight) {
    					subX = rect.width - handleHeight * 1.5;
    				} else {
    					subX = subX - handleHeight / 2;
    				}
    				$$invalidate(1, handle.style.left = subX + 'px', handle);
    			});

    			y.subscribe(value => {
    				let subY = scaleNumber(value, [Range.ymin, Range.ymax], [0, trackpadWidth], 2);
    				let rect = trackpad.getBoundingClientRect();

    				if (subY < handleHeight / 2) {
    					subY = 0;
    				} else if (subY > rect.height - handleHeight) {
    					subY = rect.height - handleHeight * 1.5;
    				} else {
    					subY = subY - handleHeight / 2;
    				}
    				$$invalidate(1, handle.style.top = subY + 'px', handle);
    			});
    		}
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Trackpad> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			handle = $$value;
    			$$invalidate(1, handle);
    		});
    	}

    	function div0_elementresize_handler() {
    		handleHeight = this.clientHeight;
    		$$invalidate(5, handleHeight);
    	}

    	function div1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			trackpad = $$value;
    			$$invalidate(0, trackpad);
    		});
    	}

    	function div1_elementresize_handler() {
    		trackpadWidth = this.clientWidth;
    		trackpadHeight = this.clientHeight;
    		$$invalidate(3, trackpadWidth);
    		$$invalidate(4, trackpadHeight);
    	}

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			container = $$value;
    			$$invalidate(2, container);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		afterUpdate,
    		Sliders,
    		scaleNumber,
    		x,
    		y,
    		Range,
    		trackpad,
    		handle,
    		container,
    		trackpadWidth,
    		trackpadHeight,
    		handleHeight,
    		posX,
    		posY,
    		clickState,
    		clickOn,
    		clickOff,
    		mouseMovement,
    		moveHandle
    	});

    	$$self.$inject_state = $$props => {
    		if ('trackpad' in $$props) $$invalidate(0, trackpad = $$props.trackpad);
    		if ('handle' in $$props) $$invalidate(1, handle = $$props.handle);
    		if ('container' in $$props) $$invalidate(2, container = $$props.container);
    		if ('trackpadWidth' in $$props) $$invalidate(3, trackpadWidth = $$props.trackpadWidth);
    		if ('trackpadHeight' in $$props) $$invalidate(4, trackpadHeight = $$props.trackpadHeight);
    		if ('handleHeight' in $$props) $$invalidate(5, handleHeight = $$props.handleHeight);
    		if ('posX' in $$props) posX = $$props.posX;
    		if ('posY' in $$props) posY = $$props.posY;
    		if ('clickState' in $$props) clickState = $$props.clickState;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		trackpad,
    		handle,
    		container,
    		trackpadWidth,
    		trackpadHeight,
    		handleHeight,
    		clickOn,
    		clickOff,
    		mouseMovement,
    		div0_binding,
    		div0_elementresize_handler,
    		div1_binding,
    		div1_elementresize_handler,
    		div2_binding
    	];
    }

    class Trackpad extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Trackpad",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    // Get createDevice from the rnbo.js library
    // const { createDevice } = require("@rnbo/js");

    // Create AudioContext
    let WAContext = window.AudioContext || window.webkitAudioContext;
    new WAContext();

    function setup() {}
    // We can't await an asynchronous function at the top level, so we create an asynchronous
    // function setup, and then call it without waiting for the result.

    // export async function setup() {
    //     const patchExportURL = "export/patch.export.json";

    //     // Create AudioContext
    //     const WAContext = window.AudioContext || window.webkitAudioContext;
    //     const context = new WAContext();

    //     // Create gain node and connect it to audio output
    //     const outputNode = context.createGain();
    //     outputNode.connect(context.destination);
        
    //     // Fetch the exported patcher
    //     let response, patcher;
    //     try {
    //         response = await fetch(patchExportURL);
    //         patcher = await response.json();
        
    //         if (!window.RNBO) {
    //             // Load RNBO script dynamically
    //             // Note that you can skip this by knowing the RNBO version of your patch
    //             // beforehand and just include it using a <script> tag
    //             await loadRNBOScript(patcher.desc.meta.rnboversion);
    //         }

    //     } catch (err) {
    //         const errorContext = {
    //             error: err
    //         };
    //         if (response && (response.status >= 300 || response.status < 200)) {
    //             errorContext.header = `Couldn't load patcher export bundle`,
    //             errorContext.description = `Check app.js to see what file it's trying to load. Currently it's` +
    //             ` trying to load "${patchExportURL}". If that doesn't` + 
    //             ` match the name of the file you exported from RNBO, modify` + 
    //             ` patchExportURL in app.js.`;
    //         }
    //         if (typeof guardrails === "function") {
    //             guardrails(errorContext);
    //         } else {
    //             throw err;
    //         }
    //         return;
    //     }
        
    //     // (Optional) Fetch the dependencies
    //     let dependencies = [];
    //     try {
    //         const dependenciesResponse = await fetch("export/dependencies.json");
    //         dependencies = await dependenciesResponse.json();

    //         // Prepend "export" to any file dependenciies
    //         dependencies = dependencies.map(d => d.file ? Object.assign({}, d, { file: "export/" + d.file }) : d);
    //     } catch (e) {}

    //     // Create the device
    //     let device;
    //     try {
    //         device = await RNBO.createDevice({ context, patcher });
    //     } catch (err) {
    //         if (typeof guardrails === "function") {
    //             guardrails({ error: err });
    //         } else {
    //             throw err;
    //         }
    //         return;
    //     }

    //     device.node.connect(outputNode);

    // };

    	
    // function loadRNBOScript(version) {
    //     return new Promise((resolve, reject) => {
    //         if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
    //             throw new Error("Patcher exported with a Debug Version!\nPlease specify the correct RNBO version to use in the code.");
    //         }
    //         const el = document.createElement("script");
    //         el.src = "https://c74-public.nyc3.digitaloceanspaces.com/rnbo/" + encodeURIComponent(version) + "/rnbo.min.js";
    //         el.onload = resolve;
    //         el.onerror = function(err) {
    //            console.log(err);
    //             reject(new Error("Failed to load rnbo.js v" + version));
    //         };
    //         document.body.append(el);
    //     });
    // }

    /* src/App.svelte generated by Svelte v3.59.1 */

    function create_fragment(ctx) {
    	let trackpad;
    	let t;
    	let sliders;
    	let current;
    	trackpad = new Trackpad({ $$inline: true });
    	sliders = new Sliders({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(trackpad.$$.fragment);
    			t = space();
    			create_component(sliders.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(trackpad, target, anchor);
    			insert_dev(target, t, anchor);
    			mount_component(sliders, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(trackpad.$$.fragment, local);
    			transition_in(sliders.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(trackpad.$$.fragment, local);
    			transition_out(sliders.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(trackpad, detaching);
    			if (detaching) detach_dev(t);
    			destroy_component(sliders, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Trackpad, Sliders, gain, x, y, setup });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var app = new App({
    	target: document.body
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
