
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
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function set_store_value(store, ret, value) {
        store.set(value);
        return ret;
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
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
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function init_binding_group(group) {
        let _inputs;
        return {
            /* push */ p(...inputs) {
                _inputs = inputs;
                _inputs.forEach(input => group.push(input));
            },
            /* remove */ r() {
                _inputs.forEach(input => group.splice(group.indexOf(input), 1));
            }
        };
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
    function select_option(select, value, mounting) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        if (!mounting || value !== undefined) {
            select.selectedIndex = -1; // no option should be selected
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked');
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
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
     * Schedules a callback to run immediately before the component is unmounted.
     *
     * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
     * only one that runs inside a server-side component.
     *
     * https://svelte.dev/docs#run-time-svelte-ondestroy
     */
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    /**
     * Creates an event dispatcher that can be used to dispatch [component events](/docs#template-syntax-component-directives-on-eventname).
     * Event dispatchers are functions that can take two arguments: `name` and `detail`.
     *
     * Component events created with `createEventDispatcher` create a
     * [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent).
     * These events do not [bubble](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Building_blocks/Events#Event_bubbling_and_capture).
     * The `detail` argument corresponds to the [CustomEvent.detail](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/detail)
     * property and can contain any type of data.
     *
     * https://svelte.dev/docs#run-time-svelte-createeventdispatcher
     */
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail, { cancelable = false } = {}) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail, { cancelable });
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
                return !event.defaultPrevented;
            }
            return true;
        };
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.59.2' }, detail), { bubbles: true }));
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
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    function construct_svelte_component_dev(component, props) {
        const error_message = 'this={...} of <svelte:component> should specify a Svelte component.';
        try {
            const instance = new component(props);
            if (!instance.$$ || !instance.$set || !instance.$on || !instance.$destroy) {
                throw new Error(error_message);
            }
            return instance;
        }
        catch (err) {
            const { message } = err;
            if (typeof message === 'string' && message.indexOf('is not a constructor') !== -1) {
                throw new Error(error_message);
            }
            else {
                throw err;
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

    const modules = writable({});

    const midi = writable({voct: null, trigger: false});

    const noModules = writable(0);

    const context = writable(null);

    /* src\MIDI.svelte generated by Svelte v3.59.2 */
    const file$7 = "src\\MIDI.svelte";

    function create_fragment$7(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let br0;
    	let t2;
    	let h3;
    	let t3;
    	let t4_value = /*newOct*/ ctx[0] + /*newOctUp*/ ctx[3] + "";
    	let t4;
    	let t5;
    	let br1;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "MIDI";
    			t1 = text("\r\n    Play notes by pressing keys on keyboard. Row Z-/ is white notes, row A-' is black notes.\r\n    ");
    			br0 = element("br");
    			t2 = text("Press - to lower octave and = to raise octave. Press space to trigger envelope without giving note input.\r\n    ");
    			h3 = element("h3");
    			t3 = text(/*note*/ ctx[2]);
    			t4 = text(t4_value);
    			t5 = space();
    			br1 = element("br");
    			add_location(h2, file$7, 168, 4, 4434);
    			add_location(br0, file$7, 170, 4, 4547);
    			attr_dev(h3, "class", "svelte-1y6qcrh");
    			toggle_class(h3, "active", /*trigger*/ ctx[1]);
    			add_location(h3, file$7, 171, 4, 4662);
    			attr_dev(div, "class", "svelte-1y6qcrh");
    			add_location(div, file$7, 167, 0, 4423);
    			add_location(br1, file$7, 173, 0, 4727);
    			add_location(main, file$7, 166, 0, 4415);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, br0);
    			append_dev(div, t2);
    			append_dev(div, h3);
    			append_dev(h3, t3);
    			append_dev(h3, t4);
    			append_dev(main, t5);
    			append_dev(main, br1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", prevent_default(/*onKeyDown*/ ctx[4]), false, true, false, false),
    					listen_dev(window, "keyup", prevent_default(/*onKeyUp*/ ctx[5]), false, true, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*note*/ 4) set_data_dev(t3, /*note*/ ctx[2]);
    			if (dirty & /*newOct, newOctUp*/ 9 && t4_value !== (t4_value = /*newOct*/ ctx[0] + /*newOctUp*/ ctx[3] + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*trigger*/ 2) {
    				toggle_class(h3, "active", /*trigger*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let $midi;
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(11, $midi = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MIDI', slots, []);
    	const dispatch = createEventDispatcher();
    	let octChanged = false; // Whether key input was an octave change (no note is triggered)
    	let keyPressed = false;
    	let octave = 4; // Updates when octave is changed
    	let newOct = 4; // Only updates when a new note is played
    	let frequency = 440;
    	let trigger = false;
    	let note = 'A'; // The note to be displayed
    	let octUp = 0;
    	let newOctUp = 0;

    	function onKeyDown(e) {
    		if (e.repeat) return; // Prevents rapid trigger firing when key held down
    		octChanged = false;
    		octUp = 0;
    		keyPressed = true;

    		switch (e.keyCode) {
    			case 61:
    				//=
    				octChanged = true;
    				if (octave < 10) {
    					octave += 1;
    					frequency *= 2;
    				}
    				break;
    			case 173:
    				//-
    				octChanged = true;
    				if (octave > -2) {
    					octave -= 1;
    					frequency /= 2;
    				}
    				break;
    			case 90:
    				//Z
    				frequency = 261.63;
    				$$invalidate(2, note = 'C');
    				break;
    			case 83:
    				//S
    				frequency = 277.18;
    				$$invalidate(2, note = 'C#/Db');
    				break;
    			case 88:
    				//X
    				frequency = 293.66;
    				$$invalidate(2, note = 'D');
    				break;
    			case 68:
    				//D
    				frequency = 311.13;
    				$$invalidate(2, note = 'D#/Eb');
    				break;
    			case 67:
    				//C
    				frequency = 329.63;
    				$$invalidate(2, note = 'E');
    				break;
    			case 86:
    				//V
    				frequency = 349.23;
    				$$invalidate(2, note = 'F');
    				break;
    			case 71:
    				//G
    				frequency = 369.99;
    				$$invalidate(2, note = 'F#/Gb');
    				break;
    			case 66:
    				//B
    				frequency = 392.00;
    				$$invalidate(2, note = 'G');
    				break;
    			case 72:
    				//H
    				frequency = 415.30;
    				$$invalidate(2, note = 'G#/Ab');
    				break;
    			case 78:
    				//N
    				frequency = 440.00;
    				$$invalidate(2, note = 'A');
    				break;
    			case 74:
    				//J
    				frequency = 466.16;
    				$$invalidate(2, note = 'A#/Bb');
    				break;
    			case 77:
    				//M
    				frequency = 493.88;
    				$$invalidate(2, note = 'B');
    				break;
    			case 188:
    				//,
    				frequency = 523.25;
    				$$invalidate(2, note = 'C');
    				octUp = 1;
    				break;
    			case 76:
    				//L
    				frequency = 554.37;
    				$$invalidate(2, note = 'C#/Db');
    				octUp = 1;
    				break;
    			case 190:
    				//.
    				frequency = 587.33;
    				$$invalidate(2, note = 'D');
    				octUp = 1;
    				break;
    			case 59:
    				//;
    				frequency = 622.25;
    				$$invalidate(2, note = 'D#/Eb');
    				octUp = 1;
    				break;
    			case 191:
    				///
    				frequency = 659.25;
    				$$invalidate(2, note = 'E');
    				octUp = 1;
    				break;
    			case 32:
    				//Space
    				$$invalidate(1, trigger = true);
    				set_store_value(midi, $midi.voct = null, $midi);
    				set_store_value(midi, $midi.trigger = trigger, $midi);
    				return;
    			default:
    				keyPressed = false;
    				break;
    		} //C4
    		//D4
    		//E4

    		if (!octChanged && keyPressed) {
    			if (octave > 4) {
    				for (let i = 4; i < octave; i++) {
    					frequency *= 2;
    				}
    			} else {
    				for (let i = 4; i > octave; i--) {
    					frequency /= 2;
    				}
    			}

    			$$invalidate(1, trigger = true);
    			$$invalidate(0, newOct = octave);
    			$$invalidate(3, newOctUp = octUp);
    			set_store_value(midi, $midi.voct = Math.log2(frequency), $midi);
    			set_store_value(midi, $midi.trigger = trigger, $midi);
    		}
    	}

    	function onKeyUp(e) {
    		if (trigger) {
    			$$invalidate(1, trigger = false);
    			keyPressed = false;
    			set_store_value(midi, $midi.voct = null, $midi);
    			set_store_value(midi, $midi.trigger = trigger, $midi);
    		}
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MIDI> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		midi,
    		dispatch,
    		octChanged,
    		keyPressed,
    		octave,
    		newOct,
    		frequency,
    		trigger,
    		note,
    		octUp,
    		newOctUp,
    		onKeyDown,
    		onKeyUp,
    		$midi
    	});

    	$$self.$inject_state = $$props => {
    		if ('octChanged' in $$props) octChanged = $$props.octChanged;
    		if ('keyPressed' in $$props) keyPressed = $$props.keyPressed;
    		if ('octave' in $$props) octave = $$props.octave;
    		if ('newOct' in $$props) $$invalidate(0, newOct = $$props.newOct);
    		if ('frequency' in $$props) frequency = $$props.frequency;
    		if ('trigger' in $$props) $$invalidate(1, trigger = $$props.trigger);
    		if ('note' in $$props) $$invalidate(2, note = $$props.note);
    		if ('octUp' in $$props) octUp = $$props.octUp;
    		if ('newOctUp' in $$props) $$invalidate(3, newOctUp = $$props.newOctUp);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [newOct, trigger, note, newOctUp, onKeyDown, onKeyUp];
    }

    class MIDI extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MIDI",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src\VCO.svelte generated by Svelte v3.59.2 */
    const file$6 = "src\\VCO.svelte";

    function create_fragment$6(ctx) {
    	let main;
    	let div;
    	let h1;
    	let t1;
    	let h2;
    	let t3;
    	let label0;
    	let input0;
    	let t4;
    	let t5;
    	let label1;
    	let input1;
    	let t6;
    	let t7;
    	let section;
    	let label2;
    	let input2;
    	let t8;
    	let t9;
    	let label3;
    	let input3;
    	let t10;
    	let t11;
    	let label4;
    	let input4;
    	let t12;
    	let t13;
    	let label5;
    	let input5;
    	let t14;
    	let t15;
    	let br;
    	let binding_group;
    	let mounted;
    	let dispose;
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[8][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = `${/*moduleId*/ ctx[3]}`;
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "Oscillator";
    			t3 = space();
    			label0 = element("label");
    			input0 = element("input");
    			t4 = text("v/oct");
    			t5 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t6 = text("Frequency");
    			t7 = space();
    			section = element("section");
    			label2 = element("label");
    			input2 = element("input");
    			t8 = text("Sine");
    			t9 = space();
    			label3 = element("label");
    			input3 = element("input");
    			t10 = text("Triangle");
    			t11 = space();
    			label4 = element("label");
    			input4 = element("input");
    			t12 = text("Sawtooth");
    			t13 = space();
    			label5 = element("label");
    			input5 = element("input");
    			t14 = text("Square");
    			t15 = space();
    			br = element("br");
    			add_location(h1, file$6, 25, 4, 521);
    			add_location(h2, file$6, 26, 4, 546);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "2.78135971352466");
    			attr_dev(input0, "max", "14.78135971352466");
    			attr_dev(input0, "step", "0.0001");
    			add_location(input0, file$6, 27, 11, 578);
    			add_location(label0, file$6, 27, 4, 571);
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "-2");
    			attr_dev(input1, "max", "2");
    			attr_dev(input1, "step", "0.083333333333333");
    			add_location(input1, file$6, 28, 11, 703);
    			add_location(label1, file$6, 28, 4, 696);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "sine";
    			input2.value = input2.__value;
    			add_location(input2, file$6, 30, 15, 837);
    			add_location(label2, file$6, 30, 8, 830);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "triangle";
    			input3.value = input3.__value;
    			add_location(input3, file$6, 31, 15, 927);
    			add_location(label3, file$6, 31, 8, 920);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "sawtooth";
    			input4.value = input4.__value;
    			add_location(input4, file$6, 32, 15, 1025);
    			add_location(label4, file$6, 32, 8, 1018);
    			attr_dev(input5, "type", "radio");
    			input5.__value = "square";
    			input5.value = input5.__value;
    			add_location(input5, file$6, 33, 15, 1123);
    			add_location(label5, file$6, 33, 8, 1116);
    			add_location(section, file$6, 29, 4, 811);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$6, 24, 0, 510);
    			add_location(br, file$6, 36, 0, 1227);
    			add_location(main, file$6, 23, 0, 502);
    			binding_group.p(input2, input3, input4, input5);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, h2);
    			append_dev(div, t3);
    			append_dev(div, label0);
    			append_dev(label0, input0);
    			set_input_value(input0, /*voct*/ ctx[0]);
    			append_dev(label0, t4);
    			append_dev(div, t5);
    			append_dev(div, label1);
    			append_dev(label1, input1);
    			set_input_value(input1, /*frequency*/ ctx[1]);
    			append_dev(label1, t6);
    			append_dev(div, t7);
    			append_dev(div, section);
    			append_dev(section, label2);
    			append_dev(label2, input2);
    			input2.checked = input2.__value === /*oscNode*/ ctx[2].type;
    			append_dev(label2, t8);
    			append_dev(section, t9);
    			append_dev(section, label3);
    			append_dev(label3, input3);
    			input3.checked = input3.__value === /*oscNode*/ ctx[2].type;
    			append_dev(label3, t10);
    			append_dev(section, t11);
    			append_dev(section, label4);
    			append_dev(label4, input4);
    			input4.checked = input4.__value === /*oscNode*/ ctx[2].type;
    			append_dev(label4, t12);
    			append_dev(section, t13);
    			append_dev(section, label5);
    			append_dev(label5, input5);
    			input5.checked = input5.__value === /*oscNode*/ ctx[2].type;
    			append_dev(label5, t14);
    			append_dev(main, t15);
    			append_dev(main, br);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[5]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[5]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[6]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[6]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[7]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[9]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[10]),
    					listen_dev(input5, "change", /*input5_change_handler*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*voct*/ 1) {
    				set_input_value(input0, /*voct*/ ctx[0]);
    			}

    			if (dirty & /*frequency*/ 2) {
    				set_input_value(input1, /*frequency*/ ctx[1]);
    			}

    			if (dirty & /*oscNode*/ 4) {
    				input2.checked = input2.__value === /*oscNode*/ ctx[2].type;
    			}

    			if (dirty & /*oscNode*/ 4) {
    				input3.checked = input3.__value === /*oscNode*/ ctx[2].type;
    			}

    			if (dirty & /*oscNode*/ 4) {
    				input4.checked = input4.__value === /*oscNode*/ ctx[2].type;
    			}

    			if (dirty & /*oscNode*/ 4) {
    				input5.checked = input5.__value === /*oscNode*/ ctx[2].type;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			binding_group.r();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $midi;
    	let $context;
    	let $modules;
    	let $noModules;
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(4, $midi = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(13, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(14, $modules = $$value));
    	validate_store(noModules, 'noModules');
    	component_subscribe($$self, noModules, $$value => $$invalidate(15, $noModules = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCO', slots, []);
    	const moduleId = $noModules;
    	set_store_value(modules, $modules[moduleId] = {}, $modules);
    	set_store_value(noModules, $noModules++, $noModules);
    	const module = $modules[moduleId];
    	let voct = Math.log2(440);
    	let frequency = 0;
    	let oscNode = $context.createOscillator();
    	module.output = oscNode;
    	oscNode.start(0);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCO> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function input0_change_input_handler() {
    		voct = to_number(this.value);
    		($$invalidate(0, voct), $$invalidate(4, $midi));
    	}

    	function input1_change_input_handler() {
    		frequency = to_number(this.value);
    		$$invalidate(1, frequency);
    	}

    	function input2_change_handler() {
    		oscNode.type = this.__value;
    		((($$invalidate(2, oscNode), $$invalidate(0, voct)), $$invalidate(1, frequency)), $$invalidate(4, $midi));
    	}

    	function input3_change_handler() {
    		oscNode.type = this.__value;
    		((($$invalidate(2, oscNode), $$invalidate(0, voct)), $$invalidate(1, frequency)), $$invalidate(4, $midi));
    	}

    	function input4_change_handler() {
    		oscNode.type = this.__value;
    		((($$invalidate(2, oscNode), $$invalidate(0, voct)), $$invalidate(1, frequency)), $$invalidate(4, $midi));
    	}

    	function input5_change_handler() {
    		oscNode.type = this.__value;
    		((($$invalidate(2, oscNode), $$invalidate(0, voct)), $$invalidate(1, frequency)), $$invalidate(4, $midi));
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		noModules,
    		midi,
    		moduleId,
    		module,
    		voct,
    		frequency,
    		oscNode,
    		$midi,
    		$context,
    		$modules,
    		$noModules
    	});

    	$$self.$inject_state = $$props => {
    		if ('voct' in $$props) $$invalidate(0, voct = $$props.voct);
    		if ('frequency' in $$props) $$invalidate(1, frequency = $$props.frequency);
    		if ('oscNode' in $$props) $$invalidate(2, oscNode = $$props.oscNode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$midi*/ 16) {
    			if ($midi.voct) $$invalidate(0, voct = $midi.voct);
    		}

    		if ($$self.$$.dirty & /*voct, frequency*/ 3) {
    			$$invalidate(2, oscNode.frequency.value = Math.pow(2, voct + frequency), oscNode);
    		}
    	};

    	return [
    		voct,
    		frequency,
    		oscNode,
    		moduleId,
    		$midi,
    		input0_change_input_handler,
    		input1_change_input_handler,
    		input2_change_handler,
    		$$binding_groups,
    		input3_change_handler,
    		input4_change_handler,
    		input5_change_handler
    	];
    }

    class VCO extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCO",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\Output.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$4 } = globals;
    const file$5 = "src\\Output.svelte";

    function get_each_context$5(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i][0];
    	child_ctx[13] = list[i][1];
    	return child_ctx;
    }

    // (46:12) {#if m.output}
    function create_if_block$4(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[12] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[13].output;
    			option.value = option.__value;
    			add_location(option, file$5, 46, 12, 1189);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 8 && t_value !== (t_value = /*id*/ ctx[12] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 8 && option_value_value !== (option_value_value = /*m*/ ctx[13].output)) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(46:12) {#if m.output}",
    		ctx
    	});

    	return block;
    }

    // (45:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block$5(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[13].output && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*m*/ ctx[13].output) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$5.name,
    		type: "each",
    		source: "(45:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let main;
    	let div;
    	let h1;
    	let t1;
    	let h2;
    	let t3;
    	let label0;
    	let select;
    	let option;
    	let t4;
    	let t5;
    	let label1;
    	let input;
    	let t6;
    	let t7;
    	let button;
    	let t8;
    	let t9;
    	let br;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*$modules*/ ctx[3]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$5(get_each_context$5(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = `${/*moduleId*/ ctx[4]}`;
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "Output";
    			t3 = space();
    			label0 = element("label");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option = element("option");
    			t4 = text("Input");
    			t5 = space();
    			label1 = element("label");
    			input = element("input");
    			t6 = text("Gain");
    			t7 = space();
    			button = element("button");
    			t8 = text(/*muteUnmute*/ ctx[2]);
    			t9 = space();
    			br = element("br");
    			add_location(h1, file$5, 41, 8, 999);
    			add_location(h2, file$5, 42, 8, 1028);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$5, 49, 8, 1273);
    			if (/*module*/ ctx[0].input === void 0) add_render_callback(() => /*select_change_handler*/ ctx[7].call(select));
    			add_location(select, file$5, 43, 15, 1060);
    			add_location(label0, file$5, 43, 8, 1053);
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$5, 51, 15, 1352);
    			add_location(label1, file$5, 51, 8, 1345);
    			add_location(button, file$5, 52, 8, 1456);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$5, 40, 4, 984);
    			add_location(br, file$5, 54, 4, 1527);
    			add_location(main, file$5, 39, 0, 972);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, h2);
    			append_dev(div, t3);
    			append_dev(div, label0);
    			append_dev(label0, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			append_dev(select, option);
    			select_option(select, /*module*/ ctx[0].input, true);
    			append_dev(label0, t4);
    			append_dev(div, t5);
    			append_dev(div, label1);
    			append_dev(label1, input);
    			set_input_value(input, /*gainNode*/ ctx[1].gain.value);
    			append_dev(label1, t6);
    			append_dev(div, t7);
    			append_dev(div, button);
    			append_dev(button, t8);
    			append_dev(main, t9);
    			append_dev(main, br);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select, "change", /*select_change_handler*/ ctx[7]),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[8]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[8]),
    					listen_dev(button, "click", /*toggleMute*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Object, $modules*/ 8) {
    				each_value = Object.entries(/*$modules*/ ctx[3]);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$5(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$5(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, option);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*module, Object, $modules*/ 9) {
    				select_option(select, /*module*/ ctx[0].input);
    			}

    			if (dirty & /*gainNode*/ 2) {
    				set_input_value(input, /*gainNode*/ ctx[1].gain.value);
    			}

    			if (dirty & /*muteUnmute*/ 4) set_data_dev(t8, /*muteUnmute*/ ctx[2]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $context;
    	let $modules;
    	let $noModules;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(10, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(3, $modules = $$value));
    	validate_store(noModules, 'noModules');
    	component_subscribe($$self, noModules, $$value => $$invalidate(11, $noModules = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Output', slots, []);
    	const moduleId = $noModules;
    	set_store_value(modules, $modules[moduleId] = {}, $modules);
    	set_store_value(noModules, $noModules++, $noModules);
    	const module = $modules[moduleId];
    	var gainNode = $context.createGain();
    	gainNode.gain.value = 0.2;
    	gainNode.connect($context.destination);
    	var currentInput;
    	var playing = false;
    	var muteUnmute = 'Unmute';

    	function toggleMute() {
    		if (playing) {
    			playing = false;
    			$$invalidate(2, muteUnmute = 'Unmute');
    			$context.suspend();
    		} else {
    			playing = true;
    			$$invalidate(2, muteUnmute = 'Mute');
    			$context.resume();
    		}
    	}

    	const writable_props = [];

    	Object_1$4.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Output> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		module.input = select_value(this);
    		$$invalidate(0, module);
    	}

    	function input_change_input_handler() {
    		gainNode.gain.value = to_number(this.value);
    		$$invalidate(1, gainNode);
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		noModules,
    		moduleId,
    		module,
    		gainNode,
    		currentInput,
    		playing,
    		muteUnmute,
    		toggleMute,
    		$context,
    		$modules,
    		$noModules
    	});

    	$$self.$inject_state = $$props => {
    		if ('gainNode' in $$props) $$invalidate(1, gainNode = $$props.gainNode);
    		if ('currentInput' in $$props) $$invalidate(6, currentInput = $$props.currentInput);
    		if ('playing' in $$props) playing = $$props.playing;
    		if ('muteUnmute' in $$props) $$invalidate(2, muteUnmute = $$props.muteUnmute);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*module, currentInput, gainNode*/ 67) {
    			if (module.input) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(6, currentInput = module.input);
    				currentInput.connect(gainNode);
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(6, currentInput = null);
    			}
    		}
    	};

    	return [
    		module,
    		gainNode,
    		muteUnmute,
    		$modules,
    		moduleId,
    		toggleMute,
    		currentInput,
    		select_change_handler,
    		input_change_input_handler
    	];
    }

    class Output extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Output",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\VCA.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$3 } = globals;
    const file$4 = "src\\VCA.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i][0];
    	child_ctx[12] = list[i][1];
    	return child_ctx;
    }

    // (45:8) {#if m.output && id != moduleId}
    function create_if_block$3(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[11] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[12].output;
    			option.value = option.__value;
    			add_location(option, file$4, 45, 8, 1129);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 4 && t_value !== (t_value = /*id*/ ctx[11] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 4 && option_value_value !== (option_value_value = /*m*/ ctx[12].output)) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(45:8) {#if m.output && id != moduleId}",
    		ctx
    	});

    	return block;
    }

    // (44:4) {#each Object.entries($modules) as [id, m]}
    function create_each_block$4(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[12].output && /*id*/ ctx[11] != /*moduleId*/ ctx[3] && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*m*/ ctx[12].output && /*id*/ ctx[11] != /*moduleId*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(44:4) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let main;
    	let div;
    	let h1;
    	let t1;
    	let h2;
    	let t3;
    	let button;
    	let t5;
    	let label0;
    	let select;
    	let option;
    	let t6;
    	let t7;
    	let label1;
    	let input;
    	let t8;
    	let t9;
    	let br;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*$modules*/ ctx[2]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = `${/*moduleId*/ ctx[3]}`;
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "Amplifier";
    			t3 = space();
    			button = element("button");
    			button.textContent = "Update";
    			t5 = space();
    			label0 = element("label");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option = element("option");
    			t6 = text("Input");
    			t7 = space();
    			label1 = element("label");
    			input = element("input");
    			t8 = text("Gain");
    			t9 = space();
    			br = element("br");
    			add_location(h1, file$4, 39, 4, 891);
    			add_location(h2, file$4, 40, 4, 916);
    			add_location(button, file$4, 41, 4, 940);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$4, 48, 4, 1201);
    			if (/*module*/ ctx[0].input === void 0) add_render_callback(() => /*select_change_handler*/ ctx[7].call(select));
    			add_location(select, file$4, 42, 11, 994);
    			add_location(label0, file$4, 42, 4, 987);
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$4, 50, 11, 1272);
    			add_location(label1, file$4, 50, 4, 1265);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$4, 38, 0, 880);
    			add_location(br, file$4, 52, 0, 1369);
    			add_location(main, file$4, 37, 0, 872);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, h2);
    			append_dev(div, t3);
    			append_dev(div, button);
    			append_dev(div, t5);
    			append_dev(div, label0);
    			append_dev(label0, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			append_dev(select, option);
    			select_option(select, /*module*/ ctx[0].input, true);
    			append_dev(label0, t6);
    			append_dev(div, t7);
    			append_dev(div, label1);
    			append_dev(label1, input);
    			set_input_value(input, /*max_cv*/ ctx[1].value);
    			append_dev(label1, t8);
    			append_dev(main, t9);
    			append_dev(main, br);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*update*/ ctx[4], false, false, false, false),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[7]),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[8]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[8])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Object, $modules, moduleId*/ 12) {
    				each_value = Object.entries(/*$modules*/ ctx[2]);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, option);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*module, Object, $modules*/ 5) {
    				select_option(select, /*module*/ ctx[0].input);
    			}

    			if (dirty & /*max_cv*/ 2) {
    				set_input_value(input, /*max_cv*/ ctx[1].value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $context;
    	let $modules;
    	let $noModules;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(6, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(2, $modules = $$value));
    	validate_store(noModules, 'noModules');
    	component_subscribe($$self, noModules, $$value => $$invalidate(9, $noModules = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCA', slots, []);
    	const moduleId = $noModules;
    	set_store_value(modules, $modules[moduleId] = {}, $modules);
    	set_store_value(noModules, $noModules++, $noModules);
    	const module = $modules[moduleId];
    	module.input = null;
    	let max_cv = { value: 1 };
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	var currentInput;

    	const update = () => {
    		(($$invalidate(0, module), $$invalidate(10, gainNode)), $$invalidate(1, max_cv));
    	};

    	const writable_props = [];

    	Object_1$3.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCA> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		module.input = select_value(this);
    		(($$invalidate(0, module), $$invalidate(10, gainNode)), $$invalidate(1, max_cv));
    	}

    	function input_change_input_handler() {
    		max_cv.value = to_number(this.value);
    		$$invalidate(1, max_cv);
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		noModules,
    		midi,
    		moduleId,
    		module,
    		max_cv,
    		gainNode,
    		currentInput,
    		update,
    		$context,
    		$modules,
    		$noModules
    	});

    	$$self.$inject_state = $$props => {
    		if ('max_cv' in $$props) $$invalidate(1, max_cv = $$props.max_cv);
    		if ('gainNode' in $$props) $$invalidate(10, gainNode = $$props.gainNode);
    		if ('currentInput' in $$props) $$invalidate(5, currentInput = $$props.currentInput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*max_cv*/ 2) {
    			$$invalidate(0, module.max_cv = max_cv, module);
    		}

    		if ($$self.$$.dirty & /*module, currentInput*/ 33) {
    			if (module.input) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(5, currentInput = module.input);
    				currentInput.connect(gainNode);
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(5, currentInput = null);
    			}
    		}

    		if ($$self.$$.dirty & /*max_cv, $context*/ 66) {
    			gainNode.gain.setValueAtTime(max_cv.value, $context.currentTime);
    		}
    	};

    	$$invalidate(0, module.cv_in = gainNode.gain, module);

    	return [
    		module,
    		max_cv,
    		$modules,
    		moduleId,
    		update,
    		currentInput,
    		$context,
    		select_change_handler,
    		input_change_input_handler
    	];
    }

    class VCA extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCA",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src\ADSR.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$2 } = globals;
    const file$3 = "src\\ADSR.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[22] = list[i][0];
    	child_ctx[23] = list[i][1];
    	return child_ctx;
    }

    // (75:12) {#if m.cv_in && m.max_cv}
    function create_if_block$2(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[22] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[23];
    			option.value = option.__value;
    			add_location(option, file$3, 75, 12, 2147);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 32 && t_value !== (t_value = /*id*/ ctx[22] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 32 && option_value_value !== (option_value_value = /*m*/ ctx[23])) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(75:12) {#if m.cv_in && m.max_cv}",
    		ctx
    	});

    	return block;
    }

    // (74:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block$3(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[23].cv_in && /*m*/ ctx[23].max_cv && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*m*/ ctx[23].cv_in && /*m*/ ctx[23].max_cv) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(74:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;
    	let div1;
    	let h1;
    	let t1;
    	let h2;
    	let t3;
    	let button;
    	let t5;
    	let label0;
    	let select;
    	let option;
    	let t6;
    	let t7;
    	let div0;
    	let label1;
    	let input0;
    	let t8;
    	let t9;
    	let t10;
    	let t11;
    	let label2;
    	let input1;
    	let t12;
    	let t13;
    	let t14;
    	let t15;
    	let label3;
    	let input2;
    	let t16;
    	let t17;
    	let t18;
    	let t19;
    	let label4;
    	let input3;
    	let t20;
    	let t21;
    	let t22;
    	let t23;
    	let br;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*$modules*/ ctx[5]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = `${/*moduleId*/ ctx[6]}`;
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "Envelope";
    			t3 = space();
    			button = element("button");
    			button.textContent = "Update";
    			t5 = space();
    			label0 = element("label");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option = element("option");
    			t6 = text("Output");
    			t7 = space();
    			div0 = element("div");
    			label1 = element("label");
    			input0 = element("input");
    			t8 = text("Attack (");
    			t9 = text(/*attack*/ ctx[1]);
    			t10 = text("s)");
    			t11 = space();
    			label2 = element("label");
    			input1 = element("input");
    			t12 = text("Decay (");
    			t13 = text(/*decay*/ ctx[2]);
    			t14 = text("s)");
    			t15 = space();
    			label3 = element("label");
    			input2 = element("input");
    			t16 = text("Sustain (");
    			t17 = text(/*sustain*/ ctx[3]);
    			t18 = text(")");
    			t19 = space();
    			label4 = element("label");
    			input3 = element("input");
    			t20 = text("Release (");
    			t21 = text(/*release*/ ctx[4]);
    			t22 = text("s)");
    			t23 = space();
    			br = element("br");
    			add_location(h1, file$3, 69, 8, 1896);
    			add_location(h2, file$3, 70, 8, 1925);
    			add_location(button, file$3, 71, 8, 1952);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$3, 78, 8, 2224);
    			if (/*moduleOut*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[10].call(select));
    			add_location(select, file$3, 72, 15, 2010);
    			add_location(label0, file$3, 72, 8, 2003);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "10");
    			attr_dev(input0, "step", "0.001");
    			add_location(input0, file$3, 81, 19, 2338);
    			add_location(label1, file$3, 81, 12, 2331);
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "max", "10");
    			attr_dev(input1, "step", "0.001");
    			add_location(input1, file$3, 82, 19, 2455);
    			add_location(label2, file$3, 82, 12, 2448);
    			attr_dev(input2, "type", "range");
    			attr_dev(input2, "min", "0");
    			attr_dev(input2, "max", "1");
    			attr_dev(input2, "step", "0.001");
    			add_location(input2, file$3, 83, 19, 2569);
    			add_location(label3, file$3, 83, 12, 2562);
    			attr_dev(input3, "type", "range");
    			attr_dev(input3, "min", "0");
    			attr_dev(input3, "max", "10");
    			attr_dev(input3, "step", "0.001");
    			add_location(input3, file$3, 84, 19, 2687);
    			add_location(label4, file$3, 84, 12, 2680);
    			attr_dev(div0, "class", "params svelte-1bez2y1");
    			add_location(div0, file$3, 80, 8, 2297);
    			attr_dev(div1, "class", "main svelte-1bez2y1");
    			add_location(div1, file$3, 68, 4, 1868);
    			add_location(br, file$3, 87, 4, 2820);
    			add_location(main, file$3, 67, 0, 1856);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div1);
    			append_dev(div1, h1);
    			append_dev(div1, t1);
    			append_dev(div1, h2);
    			append_dev(div1, t3);
    			append_dev(div1, button);
    			append_dev(div1, t5);
    			append_dev(div1, label0);
    			append_dev(label0, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			append_dev(select, option);
    			select_option(select, /*moduleOut*/ ctx[0], true);
    			append_dev(label0, t6);
    			append_dev(div1, t7);
    			append_dev(div1, div0);
    			append_dev(div0, label1);
    			append_dev(label1, input0);
    			set_input_value(input0, /*attack*/ ctx[1]);
    			append_dev(label1, t8);
    			append_dev(label1, t9);
    			append_dev(label1, t10);
    			append_dev(div0, t11);
    			append_dev(div0, label2);
    			append_dev(label2, input1);
    			set_input_value(input1, /*decay*/ ctx[2]);
    			append_dev(label2, t12);
    			append_dev(label2, t13);
    			append_dev(label2, t14);
    			append_dev(div0, t15);
    			append_dev(div0, label3);
    			append_dev(label3, input2);
    			set_input_value(input2, /*sustain*/ ctx[3]);
    			append_dev(label3, t16);
    			append_dev(label3, t17);
    			append_dev(label3, t18);
    			append_dev(div0, t19);
    			append_dev(div0, label4);
    			append_dev(label4, input3);
    			set_input_value(input3, /*release*/ ctx[4]);
    			append_dev(label4, t20);
    			append_dev(label4, t21);
    			append_dev(label4, t22);
    			append_dev(main, t23);
    			append_dev(main, br);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*update*/ ctx[7], false, false, false, false),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[10]),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[11]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[11]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[12]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[12]),
    					listen_dev(input2, "change", /*input2_change_input_handler*/ ctx[13]),
    					listen_dev(input2, "input", /*input2_change_input_handler*/ ctx[13]),
    					listen_dev(input3, "change", /*input3_change_input_handler*/ ctx[14]),
    					listen_dev(input3, "input", /*input3_change_input_handler*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Object, $modules*/ 32) {
    				each_value = Object.entries(/*$modules*/ ctx[5]);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, option);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*moduleOut, Object, $modules*/ 33) {
    				select_option(select, /*moduleOut*/ ctx[0]);
    			}

    			if (dirty & /*attack*/ 2) {
    				set_input_value(input0, /*attack*/ ctx[1]);
    			}

    			if (dirty & /*attack*/ 2) set_data_dev(t9, /*attack*/ ctx[1]);

    			if (dirty & /*decay*/ 4) {
    				set_input_value(input1, /*decay*/ ctx[2]);
    			}

    			if (dirty & /*decay*/ 4) set_data_dev(t13, /*decay*/ ctx[2]);

    			if (dirty & /*sustain*/ 8) {
    				set_input_value(input2, /*sustain*/ ctx[3]);
    			}

    			if (dirty & /*sustain*/ 8) set_data_dev(t17, /*sustain*/ ctx[3]);

    			if (dirty & /*release*/ 16) {
    				set_input_value(input3, /*release*/ ctx[4]);
    			}

    			if (dirty & /*release*/ 16) set_data_dev(t21, /*release*/ ctx[4]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let $context;
    	let $midi;
    	let $modules;
    	let $noModules;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(16, $context = $$value));
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(9, $midi = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(5, $modules = $$value));
    	validate_store(noModules, 'noModules');
    	component_subscribe($$self, noModules, $$value => $$invalidate(17, $noModules = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ADSR', slots, []);
    	const moduleId = $noModules;
    	set_store_value(modules, $modules[moduleId] = {}, $modules);
    	set_store_value(noModules, $noModules++, $noModules);
    	const module = $modules[moduleId];
    	let notePlaying = false;
    	let moduleOut = null;
    	let attack = 1;
    	let decay = 1;
    	let sustain = 1;
    	let release = 1;

    	const fireEnv = () => {
    		if (moduleOut && moduleOut.cv_in) {
    			let cv_out = moduleOut.cv_in;
    			let now = $context.currentTime;
    			cv_out.cancelScheduledValues(now);
    			cv_out.setValueAtTime(0, now);
    			cv_out.linearRampToValueAtTime(moduleOut.max_cv.value, now + attack);
    			cv_out.linearRampToValueAtTime(moduleOut.max_cv.value * sustain, now + attack + decay);
    		}
    	};

    	const unFireEnv = () => {
    		if (moduleOut && moduleOut.cv_in) {
    			let cv_out = moduleOut.cv_in;
    			let now = $context.currentTime;
    			cv_out.cancelScheduledValues(now);
    			cv_out.linearRampToValueAtTime(0, now + release);
    		}
    	};

    	var currentModuleOut;

    	const reset = () => {
    		if (currentModuleOut) {
    			let cv_out = currentModuleOut.cv_in;
    			let now = $context.currentTime;
    			cv_out.cancelScheduledValues(now);
    			cv_out.setValueAtTime(currentModuleOut.max_cv.value, now);
    		}
    	};

    	const update = () => {
    		$$invalidate(0, moduleOut);
    	};

    	onDestroy(reset);
    	const writable_props = [];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ADSR> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		moduleOut = select_value(this);
    		$$invalidate(0, moduleOut);
    	}

    	function input0_change_input_handler() {
    		attack = to_number(this.value);
    		$$invalidate(1, attack);
    	}

    	function input1_change_input_handler() {
    		decay = to_number(this.value);
    		$$invalidate(2, decay);
    	}

    	function input2_change_input_handler() {
    		sustain = to_number(this.value);
    		$$invalidate(3, sustain);
    	}

    	function input3_change_input_handler() {
    		release = to_number(this.value);
    		$$invalidate(4, release);
    	}

    	$$self.$capture_state = () => ({
    		onDestroy,
    		modules,
    		context,
    		noModules,
    		midi,
    		moduleId,
    		module,
    		notePlaying,
    		moduleOut,
    		attack,
    		decay,
    		sustain,
    		release,
    		fireEnv,
    		unFireEnv,
    		currentModuleOut,
    		reset,
    		update,
    		$context,
    		$midi,
    		$modules,
    		$noModules
    	});

    	$$self.$inject_state = $$props => {
    		if ('notePlaying' in $$props) $$invalidate(8, notePlaying = $$props.notePlaying);
    		if ('moduleOut' in $$props) $$invalidate(0, moduleOut = $$props.moduleOut);
    		if ('attack' in $$props) $$invalidate(1, attack = $$props.attack);
    		if ('decay' in $$props) $$invalidate(2, decay = $$props.decay);
    		if ('sustain' in $$props) $$invalidate(3, sustain = $$props.sustain);
    		if ('release' in $$props) $$invalidate(4, release = $$props.release);
    		if ('currentModuleOut' in $$props) currentModuleOut = $$props.currentModuleOut;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$midi, notePlaying*/ 768) {
    			if ($midi.trigger && !notePlaying) $$invalidate(8, notePlaying = true);
    		}

    		if ($$self.$$.dirty & /*$midi, notePlaying*/ 768) {
    			if (!$midi.trigger && notePlaying) $$invalidate(8, notePlaying = false);
    		}

    		if ($$self.$$.dirty & /*notePlaying*/ 256) {
    			if (notePlaying) fireEnv(); else unFireEnv();
    		}

    		if ($$self.$$.dirty & /*moduleOut*/ 1) {
    			if (moduleOut) currentModuleOut = moduleOut;
    		}

    		if ($$self.$$.dirty & /*moduleOut*/ 1) {
    			if (!moduleOut) reset();
    		}
    	};

    	return [
    		moduleOut,
    		attack,
    		decay,
    		sustain,
    		release,
    		$modules,
    		moduleId,
    		update,
    		notePlaying,
    		$midi,
    		select_change_handler,
    		input0_change_input_handler,
    		input1_change_input_handler,
    		input2_change_input_handler,
    		input3_change_input_handler
    	];
    }

    class ADSR extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ADSR",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\VCF.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$1 } = globals;
    const file$2 = "src\\VCF.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i][0];
    	child_ctx[17] = list[i][1];
    	return child_ctx;
    }

    // (49:12) {#if m.output && id != moduleId}
    function create_if_block$1(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[16] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[17].output;
    			option.value = option.__value;
    			add_location(option, file$2, 49, 12, 1272);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 8 && t_value !== (t_value = /*id*/ ctx[16] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 8 && option_value_value !== (option_value_value = /*m*/ ctx[17].output)) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(49:12) {#if m.output && id != moduleId}",
    		ctx
    	});

    	return block;
    }

    // (48:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[17].output && /*id*/ ctx[16] != /*moduleId*/ ctx[4] && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*m*/ ctx[17].output && /*id*/ ctx[16] != /*moduleId*/ ctx[4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(48:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let main;
    	let div;
    	let h1;
    	let t1;
    	let h2;
    	let t3;
    	let button;
    	let t5;
    	let label0;
    	let select;
    	let option;
    	let t6;
    	let t7;
    	let label1;
    	let input0;
    	let t8;
    	let t9;
    	let section;
    	let label2;
    	let input1;
    	let t10;
    	let t11;
    	let label3;
    	let input2;
    	let t12;
    	let t13;
    	let label4;
    	let input3;
    	let t14;
    	let t15;
    	let br;
    	let binding_group;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*$modules*/ ctx[3]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[12][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = `${/*moduleId*/ ctx[4]}`;
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "Filter";
    			t3 = space();
    			button = element("button");
    			button.textContent = "Update";
    			t5 = space();
    			label0 = element("label");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option = element("option");
    			t6 = text("Input");
    			t7 = space();
    			label1 = element("label");
    			input0 = element("input");
    			t8 = text("Frequency");
    			t9 = space();
    			section = element("section");
    			label2 = element("label");
    			input1 = element("input");
    			t10 = text(" Lowpass");
    			t11 = space();
    			label3 = element("label");
    			input2 = element("input");
    			t12 = text(" Highpass");
    			t13 = space();
    			label4 = element("label");
    			input3 = element("input");
    			t14 = text(" Bandpass");
    			t15 = space();
    			br = element("br");
    			add_location(h1, file$2, 43, 8, 1013);
    			add_location(h2, file$2, 44, 8, 1042);
    			add_location(button, file$2, 45, 8, 1067);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$2, 52, 8, 1356);
    			if (/*module*/ ctx[0].input === void 0) add_render_callback(() => /*select_change_handler*/ ctx[9].call(select));
    			add_location(select, file$2, 46, 15, 1125);
    			add_location(label0, file$2, 46, 8, 1118);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "2.78135971352466");
    			attr_dev(input0, "max", "14.78135971352466");
    			attr_dev(input0, "step", "0.0001");
    			add_location(input0, file$2, 54, 15, 1435);
    			add_location(label1, file$2, 54, 8, 1428);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "lowpass";
    			input1.value = input1.__value;
    			add_location(input1, file$2, 56, 19, 1591);
    			add_location(label2, file$2, 56, 12, 1584);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "highpass";
    			input2.value = input2.__value;
    			add_location(input2, file$2, 57, 19, 1695);
    			add_location(label3, file$2, 57, 12, 1688);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "bandpass";
    			input3.value = input3.__value;
    			add_location(input3, file$2, 58, 19, 1801);
    			add_location(label4, file$2, 58, 12, 1794);
    			add_location(section, file$2, 55, 8, 1561);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$2, 42, 4, 998);
    			add_location(br, file$2, 61, 4, 1924);
    			add_location(main, file$2, 41, 0, 986);
    			binding_group.p(input1, input2, input3);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, h2);
    			append_dev(div, t3);
    			append_dev(div, button);
    			append_dev(div, t5);
    			append_dev(div, label0);
    			append_dev(label0, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			append_dev(select, option);
    			select_option(select, /*module*/ ctx[0].input, true);
    			append_dev(label0, t6);
    			append_dev(div, t7);
    			append_dev(div, label1);
    			append_dev(label1, input0);
    			set_input_value(input0, /*voct*/ ctx[1]);
    			append_dev(label1, t8);
    			append_dev(div, t9);
    			append_dev(div, section);
    			append_dev(section, label2);
    			append_dev(label2, input1);
    			input1.checked = input1.__value === /*filterNode*/ ctx[2].type;
    			append_dev(label2, t10);
    			append_dev(section, t11);
    			append_dev(section, label3);
    			append_dev(label3, input2);
    			input2.checked = input2.__value === /*filterNode*/ ctx[2].type;
    			append_dev(label3, t12);
    			append_dev(section, t13);
    			append_dev(section, label4);
    			append_dev(label4, input3);
    			input3.checked = input3.__value === /*filterNode*/ ctx[2].type;
    			append_dev(label4, t14);
    			append_dev(main, t15);
    			append_dev(main, br);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*update*/ ctx[5], false, false, false, false),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[9]),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[10]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[10]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[11]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[13]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Object, $modules, moduleId*/ 24) {
    				each_value = Object.entries(/*$modules*/ ctx[3]);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, option);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*module, Object, $modules*/ 9) {
    				select_option(select, /*module*/ ctx[0].input);
    			}

    			if (dirty & /*voct*/ 2) {
    				set_input_value(input0, /*voct*/ ctx[1]);
    			}

    			if (dirty & /*filterNode*/ 4) {
    				input1.checked = input1.__value === /*filterNode*/ ctx[2].type;
    			}

    			if (dirty & /*filterNode*/ 4) {
    				input2.checked = input2.__value === /*filterNode*/ ctx[2].type;
    			}

    			if (dirty & /*filterNode*/ 4) {
    				input3.checked = input3.__value === /*filterNode*/ ctx[2].type;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    			binding_group.r();
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
    	let $context;
    	let $modules;
    	let $noModules;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(8, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(3, $modules = $$value));
    	validate_store(noModules, 'noModules');
    	component_subscribe($$self, noModules, $$value => $$invalidate(15, $noModules = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCF', slots, []);
    	const moduleId = $noModules;
    	set_store_value(modules, $modules[moduleId] = {}, $modules);
    	set_store_value(noModules, $noModules++, $noModules);
    	const module = $modules[moduleId];
    	module.input = null;
    	let voct = Math.log2(18000);
    	let max_cv = { value: 18000 };
    	var filterNode = $context.createBiquadFilter();
    	module.output = filterNode;
    	var currentInput;

    	const update = () => {
    		((($$invalidate(0, module), $$invalidate(2, filterNode)), $$invalidate(6, max_cv)), $$invalidate(1, voct));
    	};

    	const writable_props = [];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCF> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function select_change_handler() {
    		module.input = select_value(this);
    		((($$invalidate(0, module), $$invalidate(2, filterNode)), $$invalidate(6, max_cv)), $$invalidate(1, voct));
    	}

    	function input0_change_input_handler() {
    		voct = to_number(this.value);
    		$$invalidate(1, voct);
    	}

    	function input1_change_handler() {
    		filterNode.type = this.__value;
    		$$invalidate(2, filterNode);
    	}

    	function input2_change_handler() {
    		filterNode.type = this.__value;
    		$$invalidate(2, filterNode);
    	}

    	function input3_change_handler() {
    		filterNode.type = this.__value;
    		$$invalidate(2, filterNode);
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		noModules,
    		midi,
    		moduleId,
    		module,
    		voct,
    		max_cv,
    		filterNode,
    		currentInput,
    		update,
    		$context,
    		$modules,
    		$noModules
    	});

    	$$self.$inject_state = $$props => {
    		if ('voct' in $$props) $$invalidate(1, voct = $$props.voct);
    		if ('max_cv' in $$props) $$invalidate(6, max_cv = $$props.max_cv);
    		if ('filterNode' in $$props) $$invalidate(2, filterNode = $$props.filterNode);
    		if ('currentInput' in $$props) $$invalidate(7, currentInput = $$props.currentInput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*voct*/ 2) {
    			$$invalidate(6, max_cv.value = Math.pow(2, voct), max_cv);
    		}

    		if ($$self.$$.dirty & /*filterNode*/ 4) {
    			$$invalidate(0, module.cv_in = filterNode.frequency, module);
    		}

    		if ($$self.$$.dirty & /*max_cv*/ 64) {
    			$$invalidate(0, module.max_cv = max_cv, module);
    		}

    		if ($$self.$$.dirty & /*module, currentInput, filterNode*/ 133) {
    			if (module.input) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(7, currentInput = module.input);
    				currentInput.connect(filterNode);
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(7, currentInput = null);
    			}
    		}

    		if ($$self.$$.dirty & /*filterNode, max_cv, $context*/ 324) {
    			filterNode.frequency.setValueAtTime(max_cv.value, $context.currentTime);
    		}
    	};

    	return [
    		module,
    		voct,
    		filterNode,
    		$modules,
    		moduleId,
    		update,
    		max_cv,
    		currentInput,
    		$context,
    		select_change_handler,
    		input0_change_input_handler,
    		input1_change_handler,
    		$$binding_groups,
    		input2_change_handler,
    		input3_change_handler
    	];
    }

    class VCF extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCF",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src\Mixer.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1 } = globals;
    const file$1 = "src\\Mixer.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[10] = list;
    	child_ctx[11] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i][0];
    	child_ctx[13] = list[i][1];
    	return child_ctx;
    }

    // (42:12) {#if m.output && id != moduleId && (!module.inputs.includes(m) || m == input)}
    function create_if_block(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[12] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[13];
    			option.value = option.__value;
    			add_location(option, file$1, 42, 12, 1223);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 2 && t_value !== (t_value = /*id*/ ctx[12] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 2 && option_value_value !== (option_value_value = /*m*/ ctx[13])) {
    				prop_dev(option, "__value", option_value_value);
    				option.value = option.__value;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(42:12) {#if m.output && id != moduleId && (!module.inputs.includes(m) || m == input)}",
    		ctx
    	});

    	return block;
    }

    // (41:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1(ctx) {
    	let show_if = /*m*/ ctx[13].output && /*id*/ ctx[12] != /*moduleId*/ ctx[2] && (!/*module*/ ctx[0].inputs.includes(/*m*/ ctx[13]) || /*m*/ ctx[13] == /*input*/ ctx[9]);
    	let if_block_anchor;
    	let if_block = show_if && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules, module*/ 3) show_if = /*m*/ ctx[13].output && /*id*/ ctx[12] != /*moduleId*/ ctx[2] && (!/*module*/ ctx[0].inputs.includes(/*m*/ ctx[13]) || /*m*/ ctx[13] == /*input*/ ctx[9]);

    			if (show_if) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(41:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (39:4) {#each module.inputs as input, inpid}
    function create_each_block$1(ctx) {
    	let label;
    	let select;
    	let option;
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;
    	let each_value_1 = Object.entries(/*$modules*/ ctx[1]);
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	function select_change_handler() {
    		/*select_change_handler*/ ctx[5].call(select, /*each_value*/ ctx[10], /*inpid*/ ctx[11]);
    	}

    	const block = {
    		c: function create() {
    			label = element("label");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option = element("option");
    			t0 = text("Input ");
    			t1 = text(/*inpid*/ ctx[11]);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$1, 45, 12, 1304);
    			if (/*input*/ ctx[9] === void 0) add_render_callback(select_change_handler);
    			add_location(select, file$1, 39, 15, 1037);
    			add_location(label, file$1, 39, 8, 1030);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			append_dev(select, option);
    			select_option(select, /*input*/ ctx[9], true);
    			append_dev(label, t0);
    			append_dev(label, t1);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", select_change_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*Object, $modules, moduleId, module*/ 7) {
    				each_value_1 = Object.entries(/*$modules*/ ctx[1]);
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, option);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}

    			if (dirty & /*module, Object, $modules*/ 3) {
    				select_option(select, /*input*/ ctx[9]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(39:4) {#each module.inputs as input, inpid}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let div;
    	let h1;
    	let t1;
    	let h2;
    	let t3;
    	let button;
    	let t5;
    	let t6;
    	let br;
    	let mounted;
    	let dispose;
    	let each_value = /*module*/ ctx[0].inputs;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = `${/*moduleId*/ ctx[2]}`;
    			t1 = space();
    			h2 = element("h2");
    			h2.textContent = "Mixer";
    			t3 = space();
    			button = element("button");
    			button.textContent = "Update";
    			t5 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			br = element("br");
    			add_location(h1, file$1, 35, 4, 891);
    			add_location(h2, file$1, 36, 4, 916);
    			add_location(button, file$1, 37, 4, 936);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$1, 34, 0, 880);
    			add_location(br, file$1, 49, 0, 1397);
    			add_location(main, file$1, 33, 0, 872);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h1);
    			append_dev(div, t1);
    			append_dev(div, h2);
    			append_dev(div, t3);
    			append_dev(div, button);
    			append_dev(div, t5);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div, null);
    				}
    			}

    			append_dev(main, t6);
    			append_dev(main, br);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*update*/ ctx[3], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*module, Object, $modules, moduleId*/ 7) {
    				each_value = /*module*/ ctx[0].inputs;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
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
    	let $context;
    	let $modules;
    	let $noModules;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(6, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(1, $modules = $$value));
    	validate_store(noModules, 'noModules');
    	component_subscribe($$self, noModules, $$value => $$invalidate(7, $noModules = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Mixer', slots, []);
    	const moduleId = $noModules;
    	set_store_value(modules, $modules[moduleId] = {}, $modules);
    	set_store_value(noModules, $noModules++, $noModules);
    	const module = $modules[moduleId];
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	module.inputs = [null, null, null, null];
    	const currentInputs = [null, null, null, null];

    	const update = () => {
    		$$invalidate(0, module);
    	};

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Mixer> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler(each_value, inpid) {
    		each_value[inpid] = select_value(this);
    		$$invalidate(0, module);
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		noModules,
    		moduleId,
    		module,
    		gainNode,
    		currentInputs,
    		update,
    		$context,
    		$modules,
    		$noModules
    	});

    	$$self.$inject_state = $$props => {
    		if ('gainNode' in $$props) $$invalidate(8, gainNode = $$props.gainNode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*module, currentInputs*/ 17) {
    			module.inputs.forEach((input, id) => {
    				if (input) {
    					if (currentInputs[id]) currentInputs[id].output.disconnect();
    					$$invalidate(4, currentInputs[id] = input, currentInputs);
    					currentInputs[id].output.connect(gainNode);
    				} else {
    					if (currentInputs[id]) currentInputs[id].output.disconnect();
    					$$invalidate(4, currentInputs[id] = null, currentInputs);
    				}
    			});
    		}
    	};

    	return [module, $modules, moduleId, update, currentInputs, select_change_handler];
    }

    class Mixer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Mixer",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (31:1) {#each modules as m}
    function create_each_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*m*/ ctx[9];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = construct_svelte_component_dev(switch_value, switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) mount_component(switch_instance, target, anchor);
    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*modules*/ 1 && switch_value !== (switch_value = /*m*/ ctx[9])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = construct_svelte_component_dev(switch_value, switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(31:1) {#each modules as m}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let button0;
    	let t1;
    	let button1;
    	let t3;
    	let button2;
    	let t5;
    	let button3;
    	let t7;
    	let button4;
    	let t9;
    	let midi;
    	let t10;
    	let output;
    	let t11;
    	let current;
    	let mounted;
    	let dispose;
    	midi = new MIDI({ $$inline: true });
    	output = new Output({ $$inline: true });
    	let each_value = /*modules*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			main = element("main");
    			button0 = element("button");
    			button0.textContent = "Add Oscillator";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Add Mixer";
    			t3 = space();
    			button2 = element("button");
    			button2.textContent = "Add Amplifier";
    			t5 = space();
    			button3 = element("button");
    			button3.textContent = "Add Filter";
    			t7 = space();
    			button4 = element("button");
    			button4.textContent = "Add Envelope";
    			t9 = space();
    			create_component(midi.$$.fragment);
    			t10 = space();
    			create_component(output.$$.fragment);
    			t11 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(button0, file, 23, 1, 562);
    			add_location(button1, file, 24, 1, 628);
    			add_location(button2, file, 25, 1, 691);
    			add_location(button3, file, 26, 1, 756);
    			add_location(button4, file, 27, 1, 818);
    			attr_dev(main, "class", "svelte-pet8xf");
    			add_location(main, file, 22, 0, 553);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, button0);
    			append_dev(main, t1);
    			append_dev(main, button1);
    			append_dev(main, t3);
    			append_dev(main, button2);
    			append_dev(main, t5);
    			append_dev(main, button3);
    			append_dev(main, t7);
    			append_dev(main, button4);
    			append_dev(main, t9);
    			mount_component(midi, main, null);
    			append_dev(main, t10);
    			mount_component(output, main, null);
    			append_dev(main, t11);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(main, null);
    				}
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*click_handler*/ ctx[2], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[3], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler_2*/ ctx[4], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_3*/ ctx[5], false, false, false, false),
    					listen_dev(button4, "click", /*click_handler_4*/ ctx[6], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*modules*/ 1) {
    				each_value = /*modules*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(main, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(midi.$$.fragment, local);
    			transition_in(output.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(midi.$$.fragment, local);
    			transition_out(output.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(midi);
    			destroy_component(output);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
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
    	let $context;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(7, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	window.AudioContext = window.AudioContext || window.webkitAudioContext;
    	var ctx = new AudioContext();
    	set_store_value(context, $context = ctx, $context);
    	var modules = [];

    	const addModule = type => {
    		modules.push(type);
    		$$invalidate(0, modules);
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => addModule(VCO);
    	const click_handler_1 = () => addModule(Mixer);
    	const click_handler_2 = () => addModule(VCA);
    	const click_handler_3 = () => addModule(VCF);
    	const click_handler_4 = () => addModule(ADSR);

    	$$self.$capture_state = () => ({
    		context,
    		MIDI,
    		VCO,
    		Output,
    		VCA,
    		ADSR,
    		VCF,
    		Mixer,
    		ctx,
    		modules,
    		addModule,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('ctx' in $$props) ctx = $$props.ctx;
    		if ('modules' in $$props) $$invalidate(0, modules = $$props.modules);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		modules,
    		addModule,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4
    	];
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

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
