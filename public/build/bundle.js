
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

    const context = writable(null);

    const output = writable({});

    /* src\MIDI.svelte generated by Svelte v3.59.2 */
    const file$7 = "src\\MIDI.svelte";

    // (169:52) {#if note}
    function create_if_block$4(ctx) {
    	let t_value = /*newOct*/ ctx[0] + /*newOctUp*/ ctx[3] + "";
    	let t;

    	const block = {
    		c: function create() {
    			t = text(t_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*newOct, newOctUp*/ 9 && t_value !== (t_value = /*newOct*/ ctx[0] + /*newOctUp*/ ctx[3] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(169:52) {#if note}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let br0;
    	let t2;
    	let p;
    	let t3;
    	let b;
    	let t4;
    	let t5;
    	let br1;
    	let mounted;
    	let dispose;
    	let if_block = /*note*/ ctx[2] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "MIDI";
    			t1 = text("\r\n    Play notes by pressing keys on keyboard. Row Z-/ is white notes, row A-' is black notes.\r\n    ");
    			br0 = element("br");
    			t2 = text("Press - to lower octave and = to raise octave. Press space to trigger envelope without giving note input.\r\n    ");
    			p = element("p");
    			t3 = text("Note played: ");
    			b = element("b");
    			t4 = text(/*note*/ ctx[2]);
    			if (if_block) if_block.c();
    			t5 = space();
    			br1 = element("br");
    			add_location(h2, file$7, 165, 4, 4327);
    			add_location(br0, file$7, 167, 4, 4440);
    			attr_dev(b, "class", "svelte-1z0taqc");
    			toggle_class(b, "active", /*trigger*/ ctx[1]);
    			add_location(b, file$7, 168, 20, 4571);
    			add_location(p, file$7, 168, 4, 4555);
    			attr_dev(div, "class", "svelte-1z0taqc");
    			add_location(div, file$7, 164, 0, 4316);
    			add_location(br1, file$7, 170, 0, 4653);
    			add_location(main, file$7, 163, 0, 4308);
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
    			append_dev(div, p);
    			append_dev(p, t3);
    			append_dev(p, b);
    			append_dev(b, t4);
    			if (if_block) if_block.m(b, null);
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
    			if (dirty & /*note*/ 4) set_data_dev(t4, /*note*/ ctx[2]);

    			if (/*note*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					if_block.m(b, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*trigger*/ 2) {
    				toggle_class(b, "active", /*trigger*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (if_block) if_block.d();
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
    	let octChanged = false; // Whether key input was an octave change (no note is triggered)
    	let keyPressed = false;
    	let octave = 4; // Updates when octave is changed
    	let newOct = 4; // Only updates when a new note is played
    	let frequency = 440;
    	let trigger = false;
    	let note = ''; // The note to be displayed
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
    		midi,
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

    const { Object: Object_1$6 } = globals;
    const file$6 = "src\\VCO.svelte";

    function create_fragment$6(ctx) {
    	let main;
    	let div;
    	let button;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[0].state.id + "";
    	let t2;
    	let t3;
    	let h2;
    	let t5;
    	let label0;
    	let input0;
    	let t6;
    	let t7;
    	let section;
    	let label1;
    	let input1;
    	let t8;
    	let t9;
    	let label2;
    	let input2;
    	let t10;
    	let t11;
    	let label3;
    	let input3;
    	let t12;
    	let t13;
    	let label4;
    	let input4;
    	let t14;
    	let t15;
    	let br;
    	let binding_group;
    	let mounted;
    	let dispose;
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[7][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			button = element("button");
    			button.textContent = "x";
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			h2 = element("h2");
    			h2.textContent = "Oscillator";
    			t5 = space();
    			label0 = element("label");
    			input0 = element("input");
    			t6 = text("Frequency");
    			t7 = space();
    			section = element("section");
    			label1 = element("label");
    			input1 = element("input");
    			t8 = text("Sine");
    			t9 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t10 = text("Triangle");
    			t11 = space();
    			label3 = element("label");
    			input3 = element("input");
    			t12 = text("Sawtooth");
    			t13 = space();
    			label4 = element("label");
    			input4 = element("input");
    			t14 = text("Square");
    			t15 = space();
    			br = element("br");
    			attr_dev(button, "class", "delete");
    			add_location(button, file$6, 56, 4, 1531);
    			add_location(h1, file$6, 57, 4, 1589);
    			add_location(h2, file$6, 58, 4, 1621);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "-2");
    			attr_dev(input0, "max", "2");
    			attr_dev(input0, "step", "0.083333333333333");
    			add_location(input0, file$6, 60, 11, 1785);
    			add_location(label0, file$6, 60, 4, 1778);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "sine";
    			input1.value = input1.__value;
    			add_location(input1, file$6, 62, 15, 1946);
    			attr_dev(label1, "class", "svelte-16wx8yy");
    			add_location(label1, file$6, 62, 8, 1939);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "triangle";
    			input2.value = input2.__value;
    			add_location(input2, file$6, 63, 15, 2042);
    			attr_dev(label2, "class", "svelte-16wx8yy");
    			add_location(label2, file$6, 63, 8, 2035);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "sawtooth";
    			input3.value = input3.__value;
    			add_location(input3, file$6, 64, 15, 2146);
    			attr_dev(label3, "class", "svelte-16wx8yy");
    			add_location(label3, file$6, 64, 8, 2139);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "square";
    			input4.value = input4.__value;
    			add_location(input4, file$6, 65, 15, 2250);
    			attr_dev(label4, "class", "svelte-16wx8yy");
    			add_location(label4, file$6, 65, 8, 2243);
    			attr_dev(section, "class", "shape svelte-16wx8yy");
    			add_location(section, file$6, 61, 4, 1906);
    			attr_dev(div, "class", "svelte-16wx8yy");
    			add_location(div, file$6, 55, 0, 1520);
    			add_location(br, file$6, 68, 0, 2360);
    			add_location(main, file$6, 54, 0, 1483);
    			binding_group.p(input1, input2, input3, input4);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, button);
    			append_dev(div, t1);
    			append_dev(div, h1);
    			append_dev(h1, t2);
    			append_dev(div, t3);
    			append_dev(div, h2);
    			append_dev(div, t5);
    			append_dev(div, label0);
    			append_dev(label0, input0);
    			set_input_value(input0, /*module*/ ctx[0].state.frequency);
    			append_dev(label0, t6);
    			append_dev(div, t7);
    			append_dev(div, section);
    			append_dev(section, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*module*/ ctx[0].state.shape;
    			append_dev(label1, t8);
    			append_dev(section, t9);
    			append_dev(section, label2);
    			append_dev(label2, input2);
    			input2.checked = input2.__value === /*module*/ ctx[0].state.shape;
    			append_dev(label2, t10);
    			append_dev(section, t11);
    			append_dev(section, label3);
    			append_dev(label3, input3);
    			input3.checked = input3.__value === /*module*/ ctx[0].state.shape;
    			append_dev(label3, t12);
    			append_dev(section, t13);
    			append_dev(section, label4);
    			append_dev(label4, input4);
    			input4.checked = input4.__value === /*module*/ ctx[0].state.shape;
    			append_dev(label4, t14);
    			append_dev(main, t15);
    			append_dev(main, br);
    			/*main_binding*/ ctx[11](main);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*destroy*/ ctx[1], false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[5]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[5]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[6]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[8]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[9]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[10])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*module*/ 1 && t2_value !== (t2_value = /*module*/ ctx[0].state.id + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*module*/ 1) {
    				set_input_value(input0, /*module*/ ctx[0].state.frequency);
    			}

    			if (dirty & /*module*/ 1) {
    				input1.checked = input1.__value === /*module*/ ctx[0].state.shape;
    			}

    			if (dirty & /*module*/ 1) {
    				input2.checked = input2.__value === /*module*/ ctx[0].state.shape;
    			}

    			if (dirty & /*module*/ 1) {
    				input3.checked = input3.__value === /*module*/ ctx[0].state.shape;
    			}

    			if (dirty & /*module*/ 1) {
    				input4.checked = input4.__value === /*module*/ ctx[0].state.shape;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			/*main_binding*/ ctx[11](null);
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
    	let $modules;
    	let $output;
    	let $midi;
    	let $context;
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(13, $modules = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(14, $output = $$value));
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(4, $midi = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(15, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCO', slots, []);

    	const state = {
    		type: 'vco',
    		frequency: 0,
    		shape: 'sine',
    		id: createNewId()
    	};

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.deleted = false;
    	let voct = Math.log2(440);
    	let oscNode = $context.createOscillator();
    	module.output = oscNode;
    	oscNode.start(0);

    	const destroy = () => {
    		module.component.parentNode.removeChild(module.component);
    		delete $modules[module.state.id];
    		modules.set($modules);
    		if ($output.input == module) set_store_value(output, $output.input = null, $output);

    		Object.values($modules).forEach(m => {
    			if (m.input && m.input == module) {
    				m.input = null;
    				m.update();
    			}

    			if (m.inputs) {
    				m.inputs.forEach((input, i) => {
    					if (input && input.state.id == module.state.id) m.inputs[i] = null;
    				});

    				m.update();
    			}
    		});
    	};

    	function createNewId() {
    		for (let i = 0; i < Object.keys($modules).length + 1; i++) {
    			if (!$modules[i]) return i;
    		}
    	}

    	const writable_props = [];

    	Object_1$6.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCO> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function input0_change_input_handler() {
    		module.state.frequency = to_number(this.value);
    		$$invalidate(0, module);
    	}

    	function input1_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(0, module);
    	}

    	function input2_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(0, module);
    	}

    	function input3_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(0, module);
    	}

    	function input4_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(0, module);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(0, module);
    		});
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		midi,
    		output,
    		state,
    		module,
    		voct,
    		oscNode,
    		destroy,
    		createNewId,
    		$modules,
    		$output,
    		$midi,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('voct' in $$props) $$invalidate(3, voct = $$props.voct);
    		if ('oscNode' in $$props) oscNode = $$props.oscNode;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$midi*/ 16) {
    			if ($midi.voct) $$invalidate(3, voct = $midi.voct);
    		}

    		if ($$self.$$.dirty & /*voct, module*/ 9) {
    			oscNode.frequency.value = Math.pow(2, voct + module.state.frequency);
    		}

    		if ($$self.$$.dirty & /*module*/ 1) {
    			oscNode.type = module.state.shape;
    		}
    	};

    	return [
    		module,
    		destroy,
    		state,
    		voct,
    		$midi,
    		input0_change_input_handler,
    		input1_change_handler,
    		$$binding_groups,
    		input2_change_handler,
    		input3_change_handler,
    		input4_change_handler,
    		main_binding
    	];
    }

    class VCO extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { state: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCO",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get state() {
    		return this.$$.ctx[2];
    	}

    	set state(value) {
    		throw new Error("<VCO>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Output.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$5 } = globals;
    const file$5 = "src\\Output.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i][0];
    	child_ctx[9] = list[i][1];
    	return child_ctx;
    }

    // (29:12) {#if m.output}
    function create_if_block$3(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[8] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[9];
    			option.value = option.__value;
    			add_location(option, file$5, 29, 12, 859);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 4 && t_value !== (t_value = /*id*/ ctx[8] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 4 && option_value_value !== (option_value_value = /*m*/ ctx[9])) {
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
    		source: "(29:12) {#if m.output}",
    		ctx
    	});

    	return block;
    }

    // (28:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block$4(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[9].output && create_if_block$3(ctx);

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
    			if (/*m*/ ctx[9].output) {
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
    		source: "(28:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let label0;
    	let select;
    	let option;
    	let t2;
    	let t3;
    	let label1;
    	let input;
    	let t4;
    	let t5;
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
    			h2 = element("h2");
    			h2.textContent = "Output";
    			t1 = space();
    			label0 = element("label");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option = element("option");
    			t2 = text("Input");
    			t3 = space();
    			label1 = element("label");
    			input = element("input");
    			t4 = text("Gain");
    			t5 = space();
    			br = element("br");
    			add_location(h2, file$5, 25, 8, 697);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$5, 32, 8, 936);
    			if (/*$output*/ ctx[1].input === void 0) add_render_callback(() => /*select_change_handler*/ ctx[5].call(select));
    			add_location(select, file$5, 26, 15, 729);
    			add_location(label0, file$5, 26, 8, 722);
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$5, 34, 15, 1015);
    			add_location(label1, file$5, 34, 8, 1008);
    			attr_dev(div, "class", "svelte-11uixgu");
    			add_location(div, file$5, 24, 4, 682);
    			add_location(br, file$5, 36, 4, 1127);
    			add_location(main, file$5, 23, 0, 670);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, label0);
    			append_dev(label0, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select, null);
    				}
    			}

    			append_dev(select, option);
    			select_option(select, /*$output*/ ctx[1].input, true);
    			append_dev(label0, t2);
    			append_dev(div, t3);
    			append_dev(div, label1);
    			append_dev(label1, input);
    			set_input_value(input, /*gainNode*/ ctx[0].gain.value);
    			append_dev(label1, t4);
    			append_dev(main, t5);
    			append_dev(main, br);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select, "change", /*select_change_handler*/ ctx[5]),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[6]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[6])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*Object, $modules*/ 4) {
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

    			if (dirty & /*$output, Object, $modules*/ 6) {
    				select_option(select, /*$output*/ ctx[1].input);
    			}

    			if (dirty & /*gainNode*/ 1) {
    				set_input_value(input, /*gainNode*/ ctx[0].gain.value);
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
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $output;
    	let $context;
    	let $modules;
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(1, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(7, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(2, $modules = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Output', slots, []);
    	const state = {};
    	var gainNode = $context.createGain();
    	gainNode.gain.value = 0.2;
    	gainNode.connect($context.destination);
    	$output.input;
    	var currentInput;
    	const writable_props = [];

    	Object_1$5.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Output> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		$output.input = select_value(this);
    		output.set($output);
    	}

    	function input_change_input_handler() {
    		gainNode.gain.value = to_number(this.value);
    		$$invalidate(0, gainNode);
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		output,
    		state,
    		gainNode,
    		currentInput,
    		$output,
    		$context,
    		$modules
    	});

    	$$self.$inject_state = $$props => {
    		if ('gainNode' in $$props) $$invalidate(0, gainNode = $$props.gainNode);
    		if ('currentInput' in $$props) $$invalidate(4, currentInput = $$props.currentInput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$output, currentInput, gainNode*/ 19) {
    			if ($output.input && $output.input.output) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(4, currentInput = $output.input.output);
    				currentInput.connect(gainNode);
    				if ($output.input.input || $output.input.inputs) $output.input.update();
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(4, currentInput = null);
    			}
    		}
    	};

    	return [
    		gainNode,
    		$output,
    		$modules,
    		state,
    		currentInput,
    		select_change_handler,
    		input_change_input_handler
    	];
    }

    class Output extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { state: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Output",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get state() {
    		return this.$$.ctx[3];
    	}

    	set state(value) {
    		throw new Error("<Output>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\VCA.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$4 } = globals;
    const file$4 = "src\\VCA.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i][0];
    	child_ctx[17] = list[i][1];
    	return child_ctx;
    }

    function get_each_context_1$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[16] = list[i][0];
    	child_ctx[17] = list[i][1];
    	return child_ctx;
    }

    // (106:8) {#if m.output && id != module.state.id}
    function create_if_block_1$1(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[16] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[17];
    			option.value = option.__value;
    			add_location(option, file$4, 106, 8, 3099);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 4 && t_value !== (t_value = /*id*/ ctx[16] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 4 && option_value_value !== (option_value_value = /*m*/ ctx[17])) {
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
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(106:8) {#if m.output && id != module.state.id}",
    		ctx
    	});

    	return block;
    }

    // (105:4) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[17].output && /*id*/ ctx[16] != /*module*/ ctx[0].state.id && create_if_block_1$1(ctx);

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
    			if (/*m*/ ctx[17].output && /*id*/ ctx[16] != /*module*/ ctx[0].state.id) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$1(ctx);
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
    		id: create_each_block_1$2.name,
    		type: "each",
    		source: "(105:4) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (114:8) {#if m.state.type == 'adsr'}
    function create_if_block$2(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[16] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[17];
    			option.value = option.__value;
    			add_location(option, file$4, 114, 8, 3363);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 4 && t_value !== (t_value = /*id*/ ctx[16] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 4 && option_value_value !== (option_value_value = /*m*/ ctx[17])) {
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
    		source: "(114:8) {#if m.state.type == 'adsr'}",
    		ctx
    	});

    	return block;
    }

    // (113:4) {#each Object.entries($modules) as [id, m]}
    function create_each_block$3(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[17].state.type == 'adsr' && create_if_block$2(ctx);

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
    			if (/*m*/ ctx[17].state.type == 'adsr') {
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
    		source: "(113:4) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let main;
    	let div;
    	let button;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[0].state.id + "";
    	let t2;
    	let t3;
    	let h2;
    	let t5;
    	let label0;
    	let select0;
    	let option0;
    	let t6;
    	let t7;
    	let label1;
    	let select1;
    	let option1;
    	let t8;
    	let t9;
    	let label2;
    	let input;
    	let t10;
    	let t11;
    	let br;
    	let mounted;
    	let dispose;
    	let each_value_1 = Object.entries(/*$modules*/ ctx[2]);
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$2(get_each_context_1$2(ctx, each_value_1, i));
    	}

    	let each_value = Object.entries(/*$modules*/ ctx[2]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			button = element("button");
    			button.textContent = "x";
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			h2 = element("h2");
    			h2.textContent = "Amplifier";
    			t5 = space();
    			label0 = element("label");
    			select0 = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			option0 = element("option");
    			t6 = text("Input");
    			t7 = space();
    			label1 = element("label");
    			select1 = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option1 = element("option");
    			t8 = text("CV");
    			t9 = space();
    			label2 = element("label");
    			input = element("input");
    			t10 = text("Gain");
    			t11 = space();
    			br = element("br");
    			attr_dev(button, "class", "delete");
    			add_location(button, file$4, 100, 4, 2836);
    			add_location(h1, file$4, 101, 4, 2894);
    			add_location(h2, file$4, 102, 4, 2926);
    			option0.__value = null;
    			option0.value = option0.__value;
    			add_location(option0, file$4, 109, 4, 3164);
    			if (/*module*/ ctx[0].input === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[9].call(select0));
    			add_location(select0, file$4, 103, 11, 2957);
    			add_location(label0, file$4, 103, 4, 2950);
    			option1.__value = null;
    			option1.value = option1.__value;
    			add_location(option1, file$4, 117, 4, 3428);
    			if (/*cv_module*/ ctx[1] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[10].call(select1));
    			add_location(select1, file$4, 111, 11, 3235);
    			add_location(label1, file$4, 111, 4, 3228);
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$4, 119, 11, 3496);
    			add_location(label2, file$4, 119, 4, 3489);
    			attr_dev(div, "class", "svelte-1e1auds");
    			add_location(div, file$4, 99, 0, 2825);
    			add_location(br, file$4, 121, 0, 3598);
    			add_location(main, file$4, 98, 0, 2788);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, button);
    			append_dev(div, t1);
    			append_dev(div, h1);
    			append_dev(h1, t2);
    			append_dev(div, t3);
    			append_dev(div, h2);
    			append_dev(div, t5);
    			append_dev(div, label0);
    			append_dev(label0, select0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(select0, null);
    				}
    			}

    			append_dev(select0, option0);
    			select_option(select0, /*module*/ ctx[0].input, true);
    			append_dev(label0, t6);
    			append_dev(div, t7);
    			append_dev(div, label1);
    			append_dev(label1, select1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select1, null);
    				}
    			}

    			append_dev(select1, option1);
    			select_option(select1, /*cv_module*/ ctx[1], true);
    			append_dev(label1, t8);
    			append_dev(div, t9);
    			append_dev(div, label2);
    			append_dev(label2, input);
    			set_input_value(input, /*module*/ ctx[0].state.gain);
    			append_dev(label2, t10);
    			append_dev(main, t11);
    			append_dev(main, br);
    			/*main_binding*/ ctx[12](main);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*destroy*/ ctx[3], false, false, false, false),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[9]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[10]),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[11]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*module*/ 1 && t2_value !== (t2_value = /*module*/ ctx[0].state.id + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*Object, $modules, module*/ 5) {
    				each_value_1 = Object.entries(/*$modules*/ ctx[2]);
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$2(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1$2(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select0, option0);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*module, Object, $modules*/ 5) {
    				select_option(select0, /*module*/ ctx[0].input);
    			}

    			if (dirty & /*Object, $modules*/ 4) {
    				each_value = Object.entries(/*$modules*/ ctx[2]);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$3(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select1, option1);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*cv_module, Object, $modules*/ 6) {
    				select_option(select1, /*cv_module*/ ctx[1]);
    			}

    			if (dirty & /*module, Object, $modules*/ 5) {
    				set_input_value(input, /*module*/ ctx[0].state.gain);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			/*main_binding*/ ctx[12](null);
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
    	let $modules;
    	let $output;
    	let $context;
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(2, $modules = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(13, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(8, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCA', slots, []);
    	const state = { type: 'vca', gain: 1, id: createNewId() };
    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.input = null;
    	let cv_module = null;
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	var isEnv = false;
    	var currentInput;
    	var currentCvModule;

    	module.update = () => {
    		($$invalidate(0, module), $$invalidate(14, gainNode));
    	};

    	const destroy = () => {
    		module.component.parentNode.removeChild(module.component);
    		delete $modules[module.state.id];
    		modules.set($modules);
    		if ($output.input == module) set_store_value(output, $output.input = null, $output);

    		Object.values($modules).forEach(m => {
    			if (m.input && m.input == module) {
    				m.input = null;
    				m.update();
    			}

    			if (m.inputs) {
    				m.inputs.forEach((input, i) => {
    					if (input && input.state.id == module.state.id) m.inputs[i] = null;
    				});

    				m.update();
    			}
    		});
    	};

    	function createNewId() {
    		for (let i = 0; i < Object.keys($modules).length + 1; i++) {
    			if (!$modules[i]) return i;
    		}
    	}

    	const writable_props = [];

    	Object_1$4.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCA> was created with unknown prop '${key}'`);
    	});

    	function select0_change_handler() {
    		module.input = select_value(this);
    		($$invalidate(0, module), $$invalidate(14, gainNode));
    	}

    	function select1_change_handler() {
    		cv_module = select_value(this);
    		(($$invalidate(1, cv_module), $$invalidate(5, isEnv)), $$invalidate(2, $modules));
    	}

    	function input_change_input_handler() {
    		module.state.gain = to_number(this.value);
    		($$invalidate(0, module), $$invalidate(14, gainNode));
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			($$invalidate(0, module), $$invalidate(14, gainNode));
    		});
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		output,
    		state,
    		module,
    		cv_module,
    		gainNode,
    		isEnv,
    		currentInput,
    		currentCvModule,
    		destroy,
    		createNewId,
    		$modules,
    		$output,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('cv_module' in $$props) $$invalidate(1, cv_module = $$props.cv_module);
    		if ('gainNode' in $$props) $$invalidate(14, gainNode = $$props.gainNode);
    		if ('isEnv' in $$props) $$invalidate(5, isEnv = $$props.isEnv);
    		if ('currentInput' in $$props) $$invalidate(6, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(7, currentCvModule = $$props.currentCvModule);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$modules*/ 4) {
    			{
    				$$invalidate(5, isEnv = false);

    				Object.entries($modules).forEach(m => {
    					if (m[1].state.type == 'adsr') $$invalidate(5, isEnv = true);
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*isEnv*/ 32) {
    			if (!isEnv) $$invalidate(1, cv_module = null);
    		}

    		if ($$self.$$.dirty & /*module*/ 1) {
    			$$invalidate(0, module.max_cv = module.state.gain, module);
    		}

    		if ($$self.$$.dirty & /*module, $context*/ 257) {
    			gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);
    		}

    		if ($$self.$$.dirty & /*module, currentInput*/ 65) {
    			if (module.input) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(6, currentInput = module.input.output);
    				currentInput.connect(gainNode);
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(6, currentInput = null);
    			}
    		}

    		if ($$self.$$.dirty & /*cv_module, $context, currentCvModule, module*/ 387) {
    			if (cv_module) {
    				gainNode.gain.cancelScheduledValues($context.currentTime);
    				gainNode.gain.setValueAtTime(0, $context.currentTime);

    				if (currentCvModule) {
    					$$invalidate(7, currentCvModule.cv = null, currentCvModule);
    					$$invalidate(7, currentCvModule.max_cv = null, currentCvModule);
    				}

    				$$invalidate(7, currentCvModule = cv_module);
    				$$invalidate(7, currentCvModule.cv = gainNode.gain, currentCvModule);
    				$$invalidate(7, currentCvModule.max_cv = module.state.gain, currentCvModule);
    			} else {
    				gainNode.gain.cancelScheduledValues($context.currentTime);
    				gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);

    				if (currentCvModule) {
    					$$invalidate(7, currentCvModule.cv = null, currentCvModule);
    					$$invalidate(7, currentCvModule.max_cv = null, currentCvModule);
    				}

    				$$invalidate(7, currentCvModule = null);
    			}
    		}
    	};

    	$$invalidate(0, module.cv_in = gainNode.gain, module);

    	return [
    		module,
    		cv_module,
    		$modules,
    		destroy,
    		state,
    		isEnv,
    		currentInput,
    		currentCvModule,
    		$context,
    		select0_change_handler,
    		select1_change_handler,
    		input_change_input_handler,
    		main_binding
    	];
    }

    class VCA extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { state: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCA",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get state() {
    		return this.$$.ctx[4];
    	}

    	set state(value) {
    		throw new Error("<VCA>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\ADSR.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$3 } = globals;
    const file$3 = "src\\ADSR.svelte";

    function create_fragment$3(ctx) {
    	let main;
    	let div1;
    	let button;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[0].state.id + "";
    	let t2;
    	let t3;
    	let h2;
    	let t5;
    	let div0;
    	let label0;
    	let input0;
    	let t6;
    	let t7_value = /*attack*/ ctx[1].toFixed(2) + "";
    	let t7;
    	let t8;
    	let t9;
    	let label1;
    	let input1;
    	let t10;
    	let t11_value = /*decay*/ ctx[2].toFixed(2) + "";
    	let t11;
    	let t12;
    	let t13;
    	let label2;
    	let input2;
    	let t14;
    	let t15_value = /*module*/ ctx[0].state.sustain.toFixed(2) + "";
    	let t15;
    	let t16;
    	let t17;
    	let label3;
    	let input3;
    	let t18;
    	let t19_value = /*release*/ ctx[3].toFixed(2) + "";
    	let t19;
    	let t20;
    	let t21;
    	let br;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "x";
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			h2 = element("h2");
    			h2.textContent = "Envelope";
    			t5 = space();
    			div0 = element("div");
    			label0 = element("label");
    			input0 = element("input");
    			t6 = text("Attack (");
    			t7 = text(t7_value);
    			t8 = text("s)");
    			t9 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t10 = text("Decay (");
    			t11 = text(t11_value);
    			t12 = text("s)");
    			t13 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t14 = text("Sustain (");
    			t15 = text(t15_value);
    			t16 = text(")");
    			t17 = space();
    			label3 = element("label");
    			input3 = element("input");
    			t18 = text("Release (");
    			t19 = text(t19_value);
    			t20 = text("s)");
    			t21 = space();
    			br = element("br");
    			attr_dev(button, "class", "delete");
    			add_location(button, file$3, 64, 8, 1984);
    			add_location(h1, file$3, 65, 8, 2046);
    			add_location(h2, file$3, 66, 8, 2082);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "1");
    			attr_dev(input0, "step", "0.001");
    			add_location(input0, file$3, 68, 19, 2150);
    			add_location(label0, file$3, 68, 12, 2143);
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "max", "1");
    			attr_dev(input1, "step", "0.001");
    			add_location(input1, file$3, 69, 19, 2290);
    			add_location(label1, file$3, 69, 12, 2283);
    			attr_dev(input2, "type", "range");
    			attr_dev(input2, "min", "0");
    			attr_dev(input2, "max", "1");
    			attr_dev(input2, "step", "0.001");
    			add_location(input2, file$3, 70, 19, 2427);
    			add_location(label2, file$3, 70, 12, 2420);
    			attr_dev(input3, "type", "range");
    			attr_dev(input3, "min", "0");
    			attr_dev(input3, "max", "1");
    			attr_dev(input3, "step", "0.001");
    			add_location(input3, file$3, 71, 19, 2582);
    			add_location(label3, file$3, 71, 12, 2575);
    			attr_dev(div0, "class", "params svelte-13rfham");
    			add_location(div0, file$3, 67, 8, 2109);
    			add_location(div1, file$3, 63, 4, 1969);
    			add_location(br, file$3, 74, 4, 2738);
    			attr_dev(main, "class", "svelte-13rfham");
    			add_location(main, file$3, 62, 0, 1928);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div1);
    			append_dev(div1, button);
    			append_dev(div1, t1);
    			append_dev(div1, h1);
    			append_dev(h1, t2);
    			append_dev(div1, t3);
    			append_dev(div1, h2);
    			append_dev(div1, t5);
    			append_dev(div1, div0);
    			append_dev(div0, label0);
    			append_dev(label0, input0);
    			set_input_value(input0, /*module*/ ctx[0].state.attack);
    			append_dev(label0, t6);
    			append_dev(label0, t7);
    			append_dev(label0, t8);
    			append_dev(div0, t9);
    			append_dev(div0, label1);
    			append_dev(label1, input1);
    			set_input_value(input1, /*module*/ ctx[0].state.decay);
    			append_dev(label1, t10);
    			append_dev(label1, t11);
    			append_dev(label1, t12);
    			append_dev(div0, t13);
    			append_dev(div0, label2);
    			append_dev(label2, input2);
    			set_input_value(input2, /*module*/ ctx[0].state.sustain);
    			append_dev(label2, t14);
    			append_dev(label2, t15);
    			append_dev(label2, t16);
    			append_dev(div0, t17);
    			append_dev(div0, label3);
    			append_dev(label3, input3);
    			set_input_value(input3, /*module*/ ctx[0].state.release);
    			append_dev(label3, t18);
    			append_dev(label3, t19);
    			append_dev(label3, t20);
    			append_dev(main, t21);
    			append_dev(main, br);
    			/*main_binding*/ ctx[12](main);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*destroy*/ ctx[4], false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[8]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[8]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[9]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[9]),
    					listen_dev(input2, "change", /*input2_change_input_handler*/ ctx[10]),
    					listen_dev(input2, "input", /*input2_change_input_handler*/ ctx[10]),
    					listen_dev(input3, "change", /*input3_change_input_handler*/ ctx[11]),
    					listen_dev(input3, "input", /*input3_change_input_handler*/ ctx[11])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*module*/ 1 && t2_value !== (t2_value = /*module*/ ctx[0].state.id + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*module*/ 1) {
    				set_input_value(input0, /*module*/ ctx[0].state.attack);
    			}

    			if (dirty & /*attack*/ 2 && t7_value !== (t7_value = /*attack*/ ctx[1].toFixed(2) + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*module*/ 1) {
    				set_input_value(input1, /*module*/ ctx[0].state.decay);
    			}

    			if (dirty & /*decay*/ 4 && t11_value !== (t11_value = /*decay*/ ctx[2].toFixed(2) + "")) set_data_dev(t11, t11_value);

    			if (dirty & /*module*/ 1) {
    				set_input_value(input2, /*module*/ ctx[0].state.sustain);
    			}

    			if (dirty & /*module*/ 1 && t15_value !== (t15_value = /*module*/ ctx[0].state.sustain.toFixed(2) + "")) set_data_dev(t15, t15_value);

    			if (dirty & /*module*/ 1) {
    				set_input_value(input3, /*module*/ ctx[0].state.release);
    			}

    			if (dirty & /*release*/ 8 && t19_value !== (t19_value = /*release*/ ctx[3].toFixed(2) + "")) set_data_dev(t19, t19_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			/*main_binding*/ ctx[12](null);
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
    	let $modules;
    	let $midi;
    	let $context;
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(13, $modules = $$value));
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(7, $midi = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(14, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ADSR', slots, []);

    	const state = {
    		type: 'adsr',
    		attack: 0.1,
    		decay: 0.1,
    		sustain: 0.5,
    		release: 0.1,
    		id: createNewId()
    	};

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	let notePlaying = false;
    	let attack, decay, release;

    	const fireEnv = () => {
    		if (module.cv) {
    			module.cv.cancelScheduledValues($context.currentTime);
    			module.cv.setValueAtTime(0, $context.currentTime);
    			module.cv.linearRampToValueAtTime(module.max_cv, $context.currentTime + attack);
    			module.cv.linearRampToValueAtTime(module.max_cv * module.state.sustain, $context.currentTime + attack + decay);
    		}
    	};

    	const unFireEnv = () => {
    		if (module.cv) {
    			module.cv.cancelScheduledValues($context.currentTime);
    			module.cv.setValueAtTime(module.max_cv * module.state.sustain, $context.currentTime);
    			module.cv.linearRampToValueAtTime(0, $context.currentTime + release);
    		}
    	};

    	const destroy = () => {
    		$$invalidate(0, module.cv = null, module);
    		$$invalidate(0, module.max_cv = null, module);
    		module.component.parentNode.removeChild(module.component);
    		delete $modules[module.state.id];
    		modules.set($modules);
    	};

    	function createNewId() {
    		for (let i = 0; i < Object.keys($modules).length + 1; i++) {
    			if (!$modules[i]) return i;
    		}
    	}

    	const writable_props = [];

    	Object_1$3.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ADSR> was created with unknown prop '${key}'`);
    	});

    	function input0_change_input_handler() {
    		module.state.attack = to_number(this.value);
    		$$invalidate(0, module);
    	}

    	function input1_change_input_handler() {
    		module.state.decay = to_number(this.value);
    		$$invalidate(0, module);
    	}

    	function input2_change_input_handler() {
    		module.state.sustain = to_number(this.value);
    		$$invalidate(0, module);
    	}

    	function input3_change_input_handler() {
    		module.state.release = to_number(this.value);
    		$$invalidate(0, module);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(0, module);
    		});
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		midi,
    		state,
    		module,
    		notePlaying,
    		attack,
    		decay,
    		release,
    		fireEnv,
    		unFireEnv,
    		destroy,
    		createNewId,
    		$modules,
    		$midi,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('notePlaying' in $$props) $$invalidate(6, notePlaying = $$props.notePlaying);
    		if ('attack' in $$props) $$invalidate(1, attack = $$props.attack);
    		if ('decay' in $$props) $$invalidate(2, decay = $$props.decay);
    		if ('release' in $$props) $$invalidate(3, release = $$props.release);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*module*/ 1) {
    			$$invalidate(1, attack = Math.pow(10, module.state.attack) - 1);
    		}

    		if ($$self.$$.dirty & /*module*/ 1) {
    			$$invalidate(2, decay = Math.pow(10, module.state.decay) - 1);
    		}

    		if ($$self.$$.dirty & /*module*/ 1) {
    			$$invalidate(3, release = Math.pow(10, module.state.release) - 1);
    		}

    		if ($$self.$$.dirty & /*$midi, notePlaying*/ 192) {
    			if ($midi.trigger && !notePlaying) $$invalidate(6, notePlaying = true);
    		}

    		if ($$self.$$.dirty & /*$midi, notePlaying*/ 192) {
    			if (!$midi.trigger && notePlaying) $$invalidate(6, notePlaying = false);
    		}

    		if ($$self.$$.dirty & /*notePlaying*/ 64) {
    			if (notePlaying) fireEnv(); else unFireEnv();
    		}
    	};

    	return [
    		module,
    		attack,
    		decay,
    		release,
    		destroy,
    		state,
    		notePlaying,
    		$midi,
    		input0_change_input_handler,
    		input1_change_input_handler,
    		input2_change_input_handler,
    		input3_change_input_handler,
    		main_binding
    	];
    }

    class ADSR extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { state: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ADSR",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get state() {
    		return this.$$.ctx[5];
    	}

    	set state(value) {
    		throw new Error("<ADSR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\VCF.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$2 } = globals;
    const file$2 = "src\\VCF.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[21] = list[i][0];
    	child_ctx[22] = list[i][1];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[21] = list[i][0];
    	child_ctx[22] = list[i][1];
    	return child_ctx;
    }

    // (109:12) {#if m.output && id != module.state.id}
    function create_if_block_1(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[21] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[22];
    			option.value = option.__value;
    			add_location(option, file$2, 109, 12, 3328);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 4 && t_value !== (t_value = /*id*/ ctx[21] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 4 && option_value_value !== (option_value_value = /*m*/ ctx[22])) {
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
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(109:12) {#if m.output && id != module.state.id}",
    		ctx
    	});

    	return block;
    }

    // (108:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[22].output && /*id*/ ctx[21] != /*module*/ ctx[0].state.id && create_if_block_1(ctx);

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
    			if (/*m*/ ctx[22].output && /*id*/ ctx[21] != /*module*/ ctx[0].state.id) {
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
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1$1.name,
    		type: "each",
    		source: "(108:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (117:12) {#if m.state.type == 'adsr'}
    function create_if_block$1(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[21] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[22];
    			option.value = option.__value;
    			add_location(option, file$2, 117, 12, 3624);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 4 && t_value !== (t_value = /*id*/ ctx[21] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 4 && option_value_value !== (option_value_value = /*m*/ ctx[22])) {
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
    		source: "(117:12) {#if m.state.type == 'adsr'}",
    		ctx
    	});

    	return block;
    }

    // (116:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[22].state.type == 'adsr' && create_if_block$1(ctx);

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
    			if (/*m*/ ctx[22].state.type == 'adsr') {
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
    		source: "(116:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let main;
    	let div;
    	let button;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[0].state.id + "";
    	let t2;
    	let t3;
    	let h2;
    	let t5;
    	let label0;
    	let select0;
    	let option0;
    	let t6;
    	let t7;
    	let label1;
    	let select1;
    	let option1;
    	let t8;
    	let t9;
    	let label2;
    	let input0;
    	let t10;
    	let t11;
    	let section;
    	let label3;
    	let input1;
    	let t12;
    	let t13;
    	let label4;
    	let input2;
    	let t14;
    	let t15;
    	let label5;
    	let input3;
    	let t16;
    	let t17;
    	let br;
    	let binding_group;
    	let mounted;
    	let dispose;
    	let each_value_1 = Object.entries(/*$modules*/ ctx[2]);
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	let each_value = Object.entries(/*$modules*/ ctx[2]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[15][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			button = element("button");
    			button.textContent = "x";
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			h2 = element("h2");
    			h2.textContent = "Filter";
    			t5 = space();
    			label0 = element("label");
    			select0 = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			option0 = element("option");
    			t6 = text("Input");
    			t7 = space();
    			label1 = element("label");
    			select1 = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option1 = element("option");
    			t8 = text("CV");
    			t9 = space();
    			label2 = element("label");
    			input0 = element("input");
    			t10 = text("Frequency");
    			t11 = space();
    			section = element("section");
    			label3 = element("label");
    			input1 = element("input");
    			t12 = text(" Lowpass");
    			t13 = space();
    			label4 = element("label");
    			input2 = element("input");
    			t14 = text(" Highpass");
    			t15 = space();
    			label5 = element("label");
    			input3 = element("input");
    			t16 = text(" Bandpass");
    			t17 = space();
    			br = element("br");
    			attr_dev(button, "class", "delete");
    			add_location(button, file$2, 103, 8, 3044);
    			add_location(h1, file$2, 104, 8, 3106);
    			add_location(h2, file$2, 105, 8, 3142);
    			option0.__value = null;
    			option0.value = option0.__value;
    			add_location(option0, file$2, 112, 8, 3405);
    			if (/*module*/ ctx[0].input === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[11].call(select0));
    			add_location(select0, file$2, 106, 15, 3174);
    			add_location(label0, file$2, 106, 8, 3167);
    			option1.__value = null;
    			option1.value = option1.__value;
    			add_location(option1, file$2, 120, 8, 3701);
    			if (/*cv_module*/ ctx[1] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[12].call(select1));
    			add_location(select1, file$2, 114, 15, 3484);
    			add_location(label1, file$2, 114, 8, 3477);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "2.78135971352466");
    			attr_dev(input0, "max", "14.78135971352466");
    			attr_dev(input0, "step", "0.0001");
    			add_location(input0, file$2, 122, 15, 3777);
    			add_location(label2, file$2, 122, 8, 3770);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "lowpass";
    			input1.value = input1.__value;
    			add_location(input1, file$2, 124, 19, 3946);
    			add_location(label3, file$2, 124, 12, 3939);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "highpass";
    			input2.value = input2.__value;
    			add_location(input2, file$2, 125, 19, 4058);
    			add_location(label4, file$2, 125, 12, 4051);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "bandpass";
    			input3.value = input3.__value;
    			add_location(input3, file$2, 126, 19, 4172);
    			add_location(label5, file$2, 126, 12, 4165);
    			add_location(section, file$2, 123, 8, 3916);
    			attr_dev(div, "class", "svelte-1sapet7");
    			add_location(div, file$2, 102, 4, 3029);
    			add_location(br, file$2, 129, 4, 4303);
    			add_location(main, file$2, 101, 0, 2988);
    			binding_group.p(input1, input2, input3);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, button);
    			append_dev(div, t1);
    			append_dev(div, h1);
    			append_dev(h1, t2);
    			append_dev(div, t3);
    			append_dev(div, h2);
    			append_dev(div, t5);
    			append_dev(div, label0);
    			append_dev(label0, select0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(select0, null);
    				}
    			}

    			append_dev(select0, option0);
    			select_option(select0, /*module*/ ctx[0].input, true);
    			append_dev(label0, t6);
    			append_dev(div, t7);
    			append_dev(div, label1);
    			append_dev(label1, select1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select1, null);
    				}
    			}

    			append_dev(select1, option1);
    			select_option(select1, /*cv_module*/ ctx[1], true);
    			append_dev(label1, t8);
    			append_dev(div, t9);
    			append_dev(div, label2);
    			append_dev(label2, input0);
    			set_input_value(input0, /*module*/ ctx[0].state.voct);
    			append_dev(label2, t10);
    			append_dev(div, t11);
    			append_dev(div, section);
    			append_dev(section, label3);
    			append_dev(label3, input1);
    			input1.checked = input1.__value === /*module*/ ctx[0].state.filterType;
    			append_dev(label3, t12);
    			append_dev(section, t13);
    			append_dev(section, label4);
    			append_dev(label4, input2);
    			input2.checked = input2.__value === /*module*/ ctx[0].state.filterType;
    			append_dev(label4, t14);
    			append_dev(section, t15);
    			append_dev(section, label5);
    			append_dev(label5, input3);
    			input3.checked = input3.__value === /*module*/ ctx[0].state.filterType;
    			append_dev(label5, t16);
    			append_dev(main, t17);
    			append_dev(main, br);
    			/*main_binding*/ ctx[18](main);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", /*destroy*/ ctx[3], false, false, false, false),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[11]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[12]),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[13]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[13]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[14]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[16]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[17])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*module*/ 1 && t2_value !== (t2_value = /*module*/ ctx[0].state.id + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*Object, $modules, module*/ 5) {
    				each_value_1 = Object.entries(/*$modules*/ ctx[2]);
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1$1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1$1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(select0, option0);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*module, Object, $modules*/ 5) {
    				select_option(select0, /*module*/ ctx[0].input);
    			}

    			if (dirty & /*Object, $modules*/ 4) {
    				each_value = Object.entries(/*$modules*/ ctx[2]);
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select1, option1);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*cv_module, Object, $modules*/ 6) {
    				select_option(select1, /*cv_module*/ ctx[1]);
    			}

    			if (dirty & /*module, Object, $modules*/ 5) {
    				set_input_value(input0, /*module*/ ctx[0].state.voct);
    			}

    			if (dirty & /*module, Object, $modules*/ 5) {
    				input1.checked = input1.__value === /*module*/ ctx[0].state.filterType;
    			}

    			if (dirty & /*module, Object, $modules*/ 5) {
    				input2.checked = input2.__value === /*module*/ ctx[0].state.filterType;
    			}

    			if (dirty & /*module, Object, $modules*/ 5) {
    				input3.checked = input3.__value === /*module*/ ctx[0].state.filterType;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			/*main_binding*/ ctx[18](null);
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
    	let $modules;
    	let $output;
    	let $context;
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(2, $modules = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(19, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(10, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCF', slots, []);

    	const state = {
    		type: 'vcf',
    		voct: Math.log2(18000),
    		filterType: 'lowpass',
    		id: createNewId()
    	};

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.input = null;
    	let cv_module = null;
    	var filterNode = $context.createBiquadFilter();
    	module.output = filterNode;
    	var isEnv = false;
    	var frequency;
    	var currentInput;
    	var currentCvModule;

    	module.update = () => {
    		$$invalidate(0, module);
    	};

    	const destroy = () => {
    		module.component.parentNode.removeChild(module.component);
    		delete $modules[module.state.id];
    		modules.set($modules);
    		if ($output.input == module) set_store_value(output, $output.input = null, $output);

    		Object.values($modules).forEach(m => {
    			if (m.input && m.input == module) {
    				m.input = null;
    				m.update();
    			}

    			if (m.inputs) {
    				m.inputs.forEach((input, i) => {
    					if (input && input.state.id == module.state.id) m.inputs[i] = null;
    				});

    				m.update();
    			}
    		});
    	};

    	function createNewId() {
    		for (let i = 0; i < Object.keys($modules).length + 1; i++) {
    			if (!$modules[i]) return i;
    		}
    	}

    	const writable_props = [];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCF> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function select0_change_handler() {
    		module.input = select_value(this);
    		$$invalidate(0, module);
    	}

    	function select1_change_handler() {
    		cv_module = select_value(this);
    		(($$invalidate(1, cv_module), $$invalidate(6, isEnv)), $$invalidate(2, $modules));
    	}

    	function input0_change_input_handler() {
    		module.state.voct = to_number(this.value);
    		$$invalidate(0, module);
    	}

    	function input1_change_handler() {
    		module.state.filterType = this.__value;
    		$$invalidate(0, module);
    	}

    	function input2_change_handler() {
    		module.state.filterType = this.__value;
    		$$invalidate(0, module);
    	}

    	function input3_change_handler() {
    		module.state.filterType = this.__value;
    		$$invalidate(0, module);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(0, module);
    		});
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		output,
    		state,
    		module,
    		cv_module,
    		filterNode,
    		isEnv,
    		frequency,
    		currentInput,
    		currentCvModule,
    		destroy,
    		createNewId,
    		$modules,
    		$output,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('cv_module' in $$props) $$invalidate(1, cv_module = $$props.cv_module);
    		if ('filterNode' in $$props) $$invalidate(5, filterNode = $$props.filterNode);
    		if ('isEnv' in $$props) $$invalidate(6, isEnv = $$props.isEnv);
    		if ('frequency' in $$props) $$invalidate(7, frequency = $$props.frequency);
    		if ('currentInput' in $$props) $$invalidate(8, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(9, currentCvModule = $$props.currentCvModule);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$modules*/ 4) {
    			{
    				$$invalidate(6, isEnv = false);

    				Object.entries($modules).forEach(m => {
    					if (m[1].state.type == 'adsr') $$invalidate(6, isEnv = true);
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*isEnv*/ 64) {
    			if (!isEnv) $$invalidate(1, cv_module = null);
    		}

    		if ($$self.$$.dirty & /*module*/ 1) {
    			$$invalidate(7, frequency = Math.pow(2, module.state.voct));
    		}

    		if ($$self.$$.dirty & /*module*/ 1) {
    			$$invalidate(5, filterNode.type = module.state.filterType, filterNode);
    		}

    		if ($$self.$$.dirty & /*filterNode, frequency, $context*/ 1184) {
    			filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
    		}

    		if ($$self.$$.dirty & /*module, currentInput, filterNode*/ 289) {
    			if (module.input) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(8, currentInput = module.input.output);
    				currentInput.connect(filterNode);
    				if (module.input.input || module.input.inputs) module.input.update();
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(8, currentInput = null);
    			}
    		}

    		if ($$self.$$.dirty & /*cv_module, filterNode, $context, currentCvModule, frequency*/ 1698) {
    			if (cv_module) {
    				filterNode.frequency.cancelScheduledValues($context.currentTime);
    				filterNode.frequency.setValueAtTime(0, $context.currentTime);

    				if (currentCvModule) {
    					$$invalidate(9, currentCvModule.cv = null, currentCvModule);
    					$$invalidate(9, currentCvModule.max_cv = null, currentCvModule);
    				}

    				$$invalidate(9, currentCvModule = cv_module);
    				$$invalidate(9, currentCvModule.cv = filterNode.frequency, currentCvModule);
    				$$invalidate(9, currentCvModule.max_cv = frequency, currentCvModule);
    			} else {
    				filterNode.frequency.cancelScheduledValues($context.currentTime);
    				filterNode.frequency.setValueAtTime(frequency, $context.currentTime);

    				if (currentCvModule) {
    					$$invalidate(9, currentCvModule.cv = null, currentCvModule);
    					$$invalidate(9, currentCvModule.max_cv = null, currentCvModule);
    				}

    				$$invalidate(9, currentCvModule = null);
    			}
    		}
    	};

    	return [
    		module,
    		cv_module,
    		$modules,
    		destroy,
    		state,
    		filterNode,
    		isEnv,
    		frequency,
    		currentInput,
    		currentCvModule,
    		$context,
    		select0_change_handler,
    		select1_change_handler,
    		input0_change_input_handler,
    		input1_change_handler,
    		$$binding_groups,
    		input2_change_handler,
    		input3_change_handler,
    		main_binding
    	];
    }

    class VCF extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { state: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCF",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get state() {
    		return this.$$.ctx[4];
    	}

    	set state(value) {
    		throw new Error("<VCF>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Mixer.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$1 } = globals;
    const file$1 = "src\\Mixer.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[10] = list[i];
    	child_ctx[11] = list;
    	child_ctx[12] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i][0];
    	child_ctx[14] = list[i][1];
    	return child_ctx;
    }

    // (73:12) {#if m.output && id != module.state.id && (!module.inputs.includes(m) || m == input)}
    function create_if_block(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[13] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[14];
    			option.value = option.__value;
    			add_location(option, file$1, 73, 12, 2344);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 2 && t_value !== (t_value = /*id*/ ctx[13] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 2 && option_value_value !== (option_value_value = /*m*/ ctx[14])) {
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
    		source: "(73:12) {#if m.output && id != module.state.id && (!module.inputs.includes(m) || m == input)}",
    		ctx
    	});

    	return block;
    }

    // (72:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1(ctx) {
    	let show_if = /*m*/ ctx[14].output && /*id*/ ctx[13] != /*module*/ ctx[0].state.id && (!/*module*/ ctx[0].inputs.includes(/*m*/ ctx[14]) || /*m*/ ctx[14] == /*input*/ ctx[10]);
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
    			if (dirty & /*$modules, module*/ 3) show_if = /*m*/ ctx[14].output && /*id*/ ctx[13] != /*module*/ ctx[0].state.id && (!/*module*/ ctx[0].inputs.includes(/*m*/ ctx[14]) || /*m*/ ctx[14] == /*input*/ ctx[10]);

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
    		source: "(72:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (70:4) {#each module.inputs as input, inpid}
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
    		/*select_change_handler*/ ctx[5].call(select, /*each_value*/ ctx[11], /*inpid*/ ctx[12]);
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
    			t1 = text(/*inpid*/ ctx[12]);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$1, 76, 12, 2425);
    			if (/*input*/ ctx[10] === void 0) add_render_callback(select_change_handler);
    			add_location(select, file$1, 70, 15, 2151);
    			add_location(label, file$1, 70, 8, 2144);
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
    			select_option(select, /*input*/ ctx[10], true);
    			append_dev(label, t0);
    			append_dev(label, t1);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", select_change_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*Object, $modules, module*/ 3) {
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
    				select_option(select, /*input*/ ctx[10]);
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
    		source: "(70:4) {#each module.inputs as input, inpid}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let div;
    	let button0;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[0].state.id + "";
    	let t2;
    	let t3;
    	let h2;
    	let t5;
    	let button1;
    	let t7;
    	let t8;
    	let br;
    	let t9;
    	let t10;
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
    			button0 = element("button");
    			button0.textContent = "x";
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			h2 = element("h2");
    			h2.textContent = "Mixer";
    			t5 = space();
    			button1 = element("button");
    			button1.textContent = "Update";
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t8 = space();
    			br = element("br");
    			t9 = space();
    			t10 = text("\r\n\r\n\r\n\r\n\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000");
    			attr_dev(button0, "class", "delete");
    			add_location(button0, file$1, 65, 4, 1933);
    			add_location(h1, file$1, 66, 4, 1991);
    			add_location(h2, file$1, 67, 4, 2023);
    			add_location(button1, file$1, 68, 4, 2043);
    			attr_dev(div, "class", "svelte-bb2tv");
    			add_location(div, file$1, 64, 0, 1922);
    			add_location(br, file$1, 80, 0, 2518);
    			add_location(main, file$1, 63, 0, 1885);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, button0);
    			append_dev(div, t1);
    			append_dev(div, h1);
    			append_dev(h1, t2);
    			append_dev(div, t3);
    			append_dev(div, h2);
    			append_dev(div, t5);
    			append_dev(div, button1);
    			append_dev(div, t7);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div, null);
    				}
    			}

    			append_dev(main, t8);
    			append_dev(main, br);
    			append_dev(main, t9);
    			/*main_binding*/ ctx[6](main);
    			insert_dev(target, t10, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*destroy*/ ctx[2], false, false, false, false),
    					listen_dev(
    						button1,
    						"click",
    						function () {
    							if (is_function(/*module*/ ctx[0].update)) /*module*/ ctx[0].update.apply(this, arguments);
    						},
    						false,
    						false,
    						false,
    						false
    					)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			if (dirty & /*module*/ 1 && t2_value !== (t2_value = /*module*/ ctx[0].state.id + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*module, Object, $modules*/ 3) {
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
    			/*main_binding*/ ctx[6](null);
    			if (detaching) detach_dev(t10);
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
    	let $modules;
    	let $context;
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(1, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(7, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Mixer', slots, []);

    	const state = {
    		type: 'mixer',
    		id: createNewId(),
    		inputIds: [null, null, null, null]
    	};

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	module.inputs = [null, null, null, null];
    	const currentInputs = [null, null, null, null];

    	module.update = () => {
    		(($$invalidate(0, module), $$invalidate(4, currentInputs)), $$invalidate(8, gainNode));
    	};

    	const destroy = () => {
    		module.component.parentNode.removeChild(module.component);
    		delete $modules[module.state.id];
    		modules.set($modules);

    		Object.values($modules).forEach(m => {
    			if (m.input && m.input == module) {
    				m.input = null;
    				m.update();
    			}

    			if (m.inputs) {
    				m.inputs.forEach((input, i) => {
    					if (input && input.state.id == module.state.id) m.inputs[i] = null;
    				});

    				m.update();
    			}
    		});
    	};

    	function createNewId() {
    		for (let i = 0; i < Object.keys($modules).length + 1; i++) {
    			if (!$modules[i]) return i;
    		}
    	}

    	const writable_props = [];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Mixer> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler(each_value, inpid) {
    		each_value[inpid] = select_value(this);
    		(($$invalidate(0, module), $$invalidate(4, currentInputs)), $$invalidate(8, gainNode));
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			(($$invalidate(0, module), $$invalidate(4, currentInputs)), $$invalidate(8, gainNode));
    		});
    	}

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		output,
    		state,
    		module,
    		gainNode,
    		currentInputs,
    		destroy,
    		createNewId,
    		$modules,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('gainNode' in $$props) $$invalidate(8, gainNode = $$props.gainNode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*module, currentInputs*/ 17) {
    			module.inputs.forEach((input, i) => {
    				if (input) {
    					if (currentInputs[i] && currentInputs[i].output) currentInputs[i].output.disconnect();
    					$$invalidate(4, currentInputs[i] = input, currentInputs);
    					currentInputs[i].output.connect(gainNode);
    					$$invalidate(0, module.state.inputIds[i] = input.state.id, module);
    				} else {
    					if (currentInputs[i] && currentInputs[i].output) currentInputs[i].output.disconnect();
    					$$invalidate(4, currentInputs[i] = null, currentInputs);
    					$$invalidate(0, module.state.inputIds[i] = null, module);
    				}
    			});
    		}
    	};

    	return [
    		module,
    		$modules,
    		destroy,
    		state,
    		currentInputs,
    		select_change_handler,
    		main_binding
    	];
    }

    class Mixer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { state: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Mixer",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get state() {
    		return this.$$.ctx[3];
    	}

    	set state(value) {
    		throw new Error("<Mixer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	return child_ctx;
    }

    // (39:1) {#each mods as m}
    function create_each_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*m*/ ctx[11];

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
    			if (dirty & /*mods*/ 1 && switch_value !== (switch_value = /*m*/ ctx[11])) {
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
    		source: "(39:1) {#each mods as m}",
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
    	let button5;
    	let t11;
    	let midi;
    	let t12;
    	let output;
    	let t13;
    	let div;
    	let current;
    	let mounted;
    	let dispose;
    	midi = new MIDI({ $$inline: true });
    	output = new Output({ $$inline: true });
    	let each_value = /*mods*/ ctx[0];
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
    			button0.textContent = "Save patch";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Add Oscillator";
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
    			button5 = element("button");
    			button5.textContent = "Add Mixer";
    			t11 = space();
    			create_component(midi.$$.fragment);
    			t12 = space();
    			create_component(output.$$.fragment);
    			t13 = space();
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(button0, file, 29, 1, 676);
    			add_location(button1, file, 30, 1, 722);
    			add_location(button2, file, 31, 1, 788);
    			add_location(button3, file, 32, 1, 853);
    			add_location(button4, file, 33, 1, 915);
    			add_location(button5, file, 34, 1, 980);
    			attr_dev(div, "class", "modules svelte-hwx5i5");
    			add_location(div, file, 37, 1, 1067);
    			add_location(main, file, 28, 0, 667);
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
    			append_dev(main, button5);
    			append_dev(main, t11);
    			mount_component(midi, main, null);
    			append_dev(main, t12);
    			mount_component(output, main, null);
    			append_dev(main, t13);
    			append_dev(main, div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div, null);
    				}
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*save*/ ctx[2], false, false, false, false),
    					listen_dev(button1, "click", /*click_handler*/ ctx[3], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler_1*/ ctx[4], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_2*/ ctx[5], false, false, false, false),
    					listen_dev(button4, "click", /*click_handler_3*/ ctx[6], false, false, false, false),
    					listen_dev(button5, "click", /*click_handler_4*/ ctx[7], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*mods*/ 1) {
    				each_value = /*mods*/ ctx[0];
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
    						each_blocks[i].m(div, null);
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
    	let $modules;
    	let $context;
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(8, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(9, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	window.AudioContext = window.AudioContext || window.webkitAudioContext;
    	var ctx = new AudioContext();
    	set_store_value(context, $context = ctx, $context);
    	var mods = [];

    	const addModule = type => {
    		mods.push(type);
    		$$invalidate(0, mods);
    	};

    	const save = () => {
    		Object.entries($modules).forEach(module => {
    			console.log(module[1].state);
    		});
    	};

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => addModule(VCO);
    	const click_handler_1 = () => addModule(VCA);
    	const click_handler_2 = () => addModule(VCF);
    	const click_handler_3 = () => addModule(ADSR);
    	const click_handler_4 = () => addModule(Mixer);

    	$$self.$capture_state = () => ({
    		context,
    		modules,
    		MIDI,
    		VCO,
    		Output,
    		VCA,
    		ADSR,
    		VCF,
    		Mixer,
    		ctx,
    		mods,
    		addModule,
    		save,
    		$modules,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('ctx' in $$props) ctx = $$props.ctx;
    		if ('mods' in $$props) $$invalidate(0, mods = $$props.mods);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		mods,
    		addModule,
    		save,
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
