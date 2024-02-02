
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
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
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
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
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
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

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
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

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    var fileDialog_min = {exports: {}};

    (function (module, exports) {
    var _typeof='function'==typeof Symbol&&'symbol'==typeof Symbol.iterator?function(a){return typeof a}:function(a){return a&&'function'==typeof Symbol&&a.constructor===Symbol&&a!==Symbol.prototype?'symbol':typeof a};(function(a){var b=function(){for(var d=arguments.length,c=Array(d),f=0;f<d;f++)c[f]=arguments[f];var g=document.createElement('input');return 'object'===_typeof(c[0])&&(!0===c[0].multiple&&g.setAttribute('multiple',''),void 0!==c[0].accept&&g.setAttribute('accept',c[0].accept)),g.setAttribute('type','file'),g.style.display='none',g.setAttribute('id','hidden-file'),document.body.appendChild(g),new Promise(function(h){g.addEventListener('change',function(){h(g.files);var l=c[c.length-1];'function'==typeof l&&l(g.files),document.body.removeChild(g);});var j=document.createEvent('MouseEvents');j.initMouseEvent('click',!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,0,null),g.dispatchEvent(j);})};(module.exports&&(exports=module.exports=b),exports.fileDialog=b);})(); 
    } (fileDialog_min, fileDialog_min.exports));

    var fileDialog_minExports = fileDialog_min.exports;
    var fileDialog = /*@__PURE__*/getDefaultExportFromCjs(fileDialog_minExports);

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

    function create_fragment$8(ctx) {
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
    			attr_dev(b, "class", "svelte-wqx3ce");
    			toggle_class(b, "active", /*trigger*/ ctx[1]);
    			add_location(b, file$7, 168, 20, 4571);
    			add_location(p, file$7, 168, 4, 4555);
    			attr_dev(div, "class", "svelte-wqx3ce");
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
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MIDI",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    function is_date(obj) {
        return Object.prototype.toString.call(obj) === '[object Date]';
    }

    function tick_spring(ctx, last_value, current_value, target_value) {
        if (typeof current_value === 'number' || is_date(current_value)) {
            // @ts-ignore
            const delta = target_value - current_value;
            // @ts-ignore
            const velocity = (current_value - last_value) / (ctx.dt || 1 / 60); // guard div by 0
            const spring = ctx.opts.stiffness * delta;
            const damper = ctx.opts.damping * velocity;
            const acceleration = (spring - damper) * ctx.inv_mass;
            const d = (velocity + acceleration) * ctx.dt;
            if (Math.abs(d) < ctx.opts.precision && Math.abs(delta) < ctx.opts.precision) {
                return target_value; // settled
            }
            else {
                ctx.settled = false; // signal loop to keep ticking
                // @ts-ignore
                return is_date(current_value) ?
                    new Date(current_value.getTime() + d) : current_value + d;
            }
        }
        else if (Array.isArray(current_value)) {
            // @ts-ignore
            return current_value.map((_, i) => tick_spring(ctx, last_value[i], current_value[i], target_value[i]));
        }
        else if (typeof current_value === 'object') {
            const next_value = {};
            for (const k in current_value) {
                // @ts-ignore
                next_value[k] = tick_spring(ctx, last_value[k], current_value[k], target_value[k]);
            }
            // @ts-ignore
            return next_value;
        }
        else {
            throw new Error(`Cannot spring ${typeof current_value} values`);
        }
    }
    function spring(value, opts = {}) {
        const store = writable(value);
        const { stiffness = 0.15, damping = 0.8, precision = 0.01 } = opts;
        let last_time;
        let task;
        let current_token;
        let last_value = value;
        let target_value = value;
        let inv_mass = 1;
        let inv_mass_recovery_rate = 0;
        let cancel_task = false;
        function set(new_value, opts = {}) {
            target_value = new_value;
            const token = current_token = {};
            if (value == null || opts.hard || (spring.stiffness >= 1 && spring.damping >= 1)) {
                cancel_task = true; // cancel any running animation
                last_time = now();
                last_value = new_value;
                store.set(value = target_value);
                return Promise.resolve();
            }
            else if (opts.soft) {
                const rate = opts.soft === true ? .5 : +opts.soft;
                inv_mass_recovery_rate = 1 / (rate * 60);
                inv_mass = 0; // infinite mass, unaffected by spring forces
            }
            if (!task) {
                last_time = now();
                cancel_task = false;
                task = loop(now => {
                    if (cancel_task) {
                        cancel_task = false;
                        task = null;
                        return false;
                    }
                    inv_mass = Math.min(inv_mass + inv_mass_recovery_rate, 1);
                    const ctx = {
                        inv_mass,
                        opts: spring,
                        settled: true,
                        dt: (now - last_time) * 60 / 1000
                    };
                    const next_value = tick_spring(ctx, last_value, value, target_value);
                    last_time = now;
                    last_value = value;
                    store.set(value = next_value);
                    if (ctx.settled) {
                        task = null;
                    }
                    return !ctx.settled;
                });
            }
            return new Promise(fulfil => {
                task.promise.then(() => {
                    if (token === current_token)
                        fulfil();
                });
            });
        }
        const spring = {
            set,
            update: (fn, opts) => set(fn(target_value, value), opts),
            subscribe: store.subscribe,
            stiffness,
            damping,
            precision
        };
        return spring;
    }

    /* src\ModuleMovement.svelte generated by Svelte v3.59.2 */

    function create_fragment$7(ctx) {
    	const block = {
    		c: noop,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
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
    	let $size;
    	let $coords;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ModuleMovement', slots, []);
    	let { moduleNode } = $$props;
    	let { controlsNode } = $$props;
    	let { nodeSize = { x: 300, y: 300 } } = $$props;
    	let { nodePos = { x: 300, y: 100 } } = $$props;
    	let coords = spring({ x: nodePos.x, y: nodePos.y }, { stiffness: 0.3, damping: 0.5 });
    	validate_store(coords, 'coords');
    	component_subscribe($$self, coords, value => $$invalidate(8, $coords = value));
    	let size = spring(0);
    	validate_store(size, 'size');
    	component_subscribe($$self, size, value => $$invalidate(7, $size = value));
    	let moving = false;
    	let controlling = false;

    	window.addEventListener('mouseup', () => {
    		moving = false;
    		$$invalidate(6, controlling = false);
    		size.set(0);
    	});

    	window.addEventListener('mousemove', e => {
    		if (moving && !controlling) {
    			$$invalidate(3, nodePos.x += e.movementX, nodePos);
    			$$invalidate(3, nodePos.y += e.movementY, nodePos);
    			coords.set({ x: nodePos.x, y: nodePos.y });
    		}
    	});

    	$$self.$$.on_mount.push(function () {
    		if (moduleNode === undefined && !('moduleNode' in $$props || $$self.$$.bound[$$self.$$.props['moduleNode']])) {
    			console.warn("<ModuleMovement> was created without expected prop 'moduleNode'");
    		}

    		if (controlsNode === undefined && !('controlsNode' in $$props || $$self.$$.bound[$$self.$$.props['controlsNode']])) {
    			console.warn("<ModuleMovement> was created without expected prop 'controlsNode'");
    		}
    	});

    	const writable_props = ['moduleNode', 'controlsNode', 'nodeSize', 'nodePos'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ModuleMovement> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(4, controlsNode = $$props.controlsNode);
    		if ('nodeSize' in $$props) $$invalidate(5, nodeSize = $$props.nodeSize);
    		if ('nodePos' in $$props) $$invalidate(3, nodePos = $$props.nodePos);
    	};

    	$$self.$capture_state = () => ({
    		spring,
    		moduleNode,
    		controlsNode,
    		nodeSize,
    		nodePos,
    		coords,
    		size,
    		moving,
    		controlling,
    		$size,
    		$coords
    	});

    	$$self.$inject_state = $$props => {
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(4, controlsNode = $$props.controlsNode);
    		if ('nodeSize' in $$props) $$invalidate(5, nodeSize = $$props.nodeSize);
    		if ('nodePos' in $$props) $$invalidate(3, nodePos = $$props.nodePos);
    		if ('coords' in $$props) $$invalidate(0, coords = $$props.coords);
    		if ('size' in $$props) $$invalidate(1, size = $$props.size);
    		if ('moving' in $$props) moving = $$props.moving;
    		if ('controlling' in $$props) $$invalidate(6, controlling = $$props.controlling);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*moduleNode, $coords, $size, nodeSize*/ 420) {
    			if (moduleNode) {
    				$$invalidate(2, moduleNode.style.left = `${$coords.x - $size / 2}px`, moduleNode);
    				$$invalidate(2, moduleNode.style.top = `${$coords.y - $size / 2}px`, moduleNode);
    				$$invalidate(2, moduleNode.style.width = `${nodeSize.x + $size}px`, moduleNode);
    				$$invalidate(2, moduleNode.style.height = `${nodeSize.y + $size}px`, moduleNode);
    			}
    		}

    		if ($$self.$$.dirty & /*controlsNode*/ 16) {
    			if (controlsNode) {
    				controlsNode.addEventListener('mousedown', () => {
    					$$invalidate(6, controlling = true);
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*moduleNode, controlling*/ 68) {
    			if (moduleNode) {
    				moduleNode.addEventListener('mousedown', () => {
    					moving = true;
    					if (!controlling) size.set(20);
    				});
    			}
    		}
    	};

    	return [
    		coords,
    		size,
    		moduleNode,
    		nodePos,
    		controlsNode,
    		nodeSize,
    		controlling,
    		$size,
    		$coords
    	];
    }

    class ModuleMovement extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {
    			moduleNode: 2,
    			controlsNode: 4,
    			nodeSize: 5,
    			nodePos: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ModuleMovement",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get moduleNode() {
    		throw new Error("<ModuleMovement>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set moduleNode(value) {
    		throw new Error("<ModuleMovement>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get controlsNode() {
    		throw new Error("<ModuleMovement>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set controlsNode(value) {
    		throw new Error("<ModuleMovement>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nodeSize() {
    		throw new Error("<ModuleMovement>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nodeSize(value) {
    		throw new Error("<ModuleMovement>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get nodePos() {
    		throw new Error("<ModuleMovement>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set nodePos(value) {
    		throw new Error("<ModuleMovement>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\VCO.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$6 } = globals;
    const file$6 = "src\\VCO.svelte";

    function create_fragment$6(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_nodePos;
    	let t0;
    	let div1;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let h2;
    	let t4;
    	let div0;
    	let button;
    	let t6;
    	let label0;
    	let input0;
    	let t7;
    	let t8;
    	let section;
    	let label1;
    	let input1;
    	let t9;
    	let t10;
    	let label2;
    	let input2;
    	let t11;
    	let t12;
    	let label3;
    	let input3;
    	let t13;
    	let t14;
    	let label4;
    	let input4;
    	let t15;
    	let t16;
    	let br;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[8](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[9](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[10](value);
    	}

    	let modulemovement_props = {};

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[13][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			h2 = element("h2");
    			h2.textContent = "Oscillator";
    			t4 = space();
    			div0 = element("div");
    			button = element("button");
    			button.textContent = "x";
    			t6 = space();
    			label0 = element("label");
    			input0 = element("input");
    			t7 = text("Frequency");
    			t8 = space();
    			section = element("section");
    			label1 = element("label");
    			input1 = element("input");
    			t9 = text("Sine");
    			t10 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t11 = text("Triangle");
    			t12 = space();
    			label3 = element("label");
    			input3 = element("input");
    			t13 = text("Sawtooth");
    			t14 = space();
    			label4 = element("label");
    			input4 = element("input");
    			t15 = text("Square");
    			t16 = space();
    			br = element("br");
    			add_location(h1, file$6, 68, 4, 1854);
    			add_location(h2, file$6, 69, 4, 1886);
    			attr_dev(button, "class", "delete");
    			add_location(button, file$6, 71, 8, 1953);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "-2");
    			attr_dev(input0, "max", "2");
    			attr_dev(input0, "step", "0.083333333333333");
    			add_location(input0, file$6, 72, 15, 2029);
    			add_location(label0, file$6, 72, 8, 2022);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "sine";
    			input1.value = input1.__value;
    			add_location(input1, file$6, 74, 19, 2198);
    			attr_dev(label1, "class", "svelte-8emvqc");
    			add_location(label1, file$6, 74, 12, 2191);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "triangle";
    			input2.value = input2.__value;
    			add_location(input2, file$6, 75, 19, 2298);
    			attr_dev(label2, "class", "svelte-8emvqc");
    			add_location(label2, file$6, 75, 12, 2291);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "sawtooth";
    			input3.value = input3.__value;
    			add_location(input3, file$6, 76, 19, 2406);
    			attr_dev(label3, "class", "svelte-8emvqc");
    			add_location(label3, file$6, 76, 12, 2399);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "square";
    			input4.value = input4.__value;
    			add_location(input4, file$6, 77, 19, 2514);
    			attr_dev(label4, "class", "svelte-8emvqc");
    			add_location(label4, file$6, 77, 12, 2507);
    			attr_dev(section, "class", "shape svelte-8emvqc");
    			add_location(section, file$6, 73, 8, 2154);
    			attr_dev(div0, "id", "controls");
    			add_location(div0, file$6, 70, 4, 1911);
    			attr_dev(div1, "id", "module");
    			attr_dev(div1, "class", "svelte-8emvqc");
    			add_location(div1, file$6, 67, 0, 1818);
    			add_location(br, file$6, 81, 0, 2639);
    			add_location(main, file$6, 65, 0, 1697);
    			binding_group.p(input1, input2, input3, input4);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div1);
    			append_dev(div1, h1);
    			append_dev(h1, t1);
    			append_dev(div1, t2);
    			append_dev(div1, h2);
    			append_dev(div1, t4);
    			append_dev(div1, div0);
    			append_dev(div0, button);
    			append_dev(div0, t6);
    			append_dev(div0, label0);
    			append_dev(label0, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.frequency);
    			append_dev(label0, t7);
    			append_dev(div0, t8);
    			append_dev(div0, section);
    			append_dev(section, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*module*/ ctx[1].state.shape;
    			append_dev(label1, t9);
    			append_dev(section, t10);
    			append_dev(section, label2);
    			append_dev(label2, input2);
    			input2.checked = input2.__value === /*module*/ ctx[1].state.shape;
    			append_dev(label2, t11);
    			append_dev(section, t12);
    			append_dev(section, label3);
    			append_dev(label3, input3);
    			input3.checked = input3.__value === /*module*/ ctx[1].state.shape;
    			append_dev(label3, t13);
    			append_dev(section, t14);
    			append_dev(section, label4);
    			append_dev(label4, input4);
    			input4.checked = input4.__value === /*module*/ ctx[1].state.shape;
    			append_dev(label4, t15);
    			append_dev(main, t16);
    			append_dev(main, br);
    			/*main_binding*/ ctx[17](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button,
    						"click",
    						function () {
    							if (is_function(/*module*/ ctx[1].destroy)) /*module*/ ctx[1].destroy.apply(this, arguments);
    						},
    						false,
    						false,
    						false,
    						false
    					),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[11]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[11]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[12]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[14]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[15]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[16]),
    					action_destroyer(/*controls*/ ctx[5].call(null, div0)),
    					action_destroyer(/*movement*/ ctx[4].call(null, div1))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty & /*moduleNode*/ 4) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[2];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty & /*controlsNode*/ 8) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[3];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_nodePos && dirty & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input0, /*module*/ ctx[1].state.frequency);
    			}

    			if (dirty & /*module*/ 2) {
    				input1.checked = input1.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (dirty & /*module*/ 2) {
    				input2.checked = input2.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (dirty & /*module*/ 2) {
    				input3.checked = input3.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (dirty & /*module*/ 2) {
    				input4.checked = input4.__value === /*module*/ ctx[1].state.shape;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			/*main_binding*/ ctx[17](null);
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
    	component_subscribe($$self, modules, $$value => $$invalidate(19, $modules = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(20, $output = $$value));
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(7, $midi = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(21, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCO', slots, []);

    	let { state = {
    		type: 'vco',
    		frequency: 0,
    		shape: 'sine',
    		id: createNewId()
    	} } = $$props;

    	let moduleNode;
    	let controlsNode;
    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	let voct = Math.log2(440);
    	let oscNode = $context.createOscillator();
    	module.output = oscNode;
    	oscNode.start(0);

    	module.destroy = () => {
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

    	function movement(node) {
    		$$invalidate(2, moduleNode = node);
    	}

    	function controls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	const writable_props = ['state'];

    	Object_1$6.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCO> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		$$invalidate(2, moduleNode);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(3, controlsNode);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function input0_change_input_handler() {
    		module.state.frequency = to_number(this.value);
    		$$invalidate(1, module);
    	}

    	function input1_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(1, module);
    	}

    	function input2_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(1, module);
    	}

    	function input3_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(1, module);
    	}

    	function input4_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(1, module);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(1, module);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		midi,
    		output,
    		ModuleMovement,
    		state,
    		moduleNode,
    		controlsNode,
    		module,
    		voct,
    		oscNode,
    		createNewId,
    		movement,
    		controls,
    		$modules,
    		$output,
    		$midi,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('voct' in $$props) $$invalidate(6, voct = $$props.voct);
    		if ('oscNode' in $$props) oscNode = $$props.oscNode;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$midi*/ 128) {
    			if ($midi.voct) $$invalidate(6, voct = $midi.voct);
    		}

    		if ($$self.$$.dirty & /*voct, module*/ 66) {
    			oscNode.frequency.value = Math.pow(2, voct + module.state.frequency);
    		}

    		if ($$self.$$.dirty & /*module*/ 2) {
    			oscNode.type = module.state.shape;
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		movement,
    		controls,
    		voct,
    		$midi,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_nodePos_binding,
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
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { state: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCO",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get state() {
    		throw new Error("<VCO>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
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
    			attr_dev(div, "class", "svelte-gu11lu");
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
    	child_ctx[22] = list[i][0];
    	child_ctx[23] = list[i][1];
    	return child_ctx;
    }

    function get_each_context_1$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[22] = list[i][0];
    	child_ctx[23] = list[i][1];
    	return child_ctx;
    }

    // (137:12) {#if m.output && id != module.state.id}
    function create_if_block_1$1(ctx) {
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
    			add_location(option, file$4, 137, 12, 4071);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 8 && t_value !== (t_value = /*id*/ ctx[22] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 8 && option_value_value !== (option_value_value = /*m*/ ctx[23])) {
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
    		source: "(137:12) {#if m.output && id != module.state.id}",
    		ctx
    	});

    	return block;
    }

    // (136:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[23].output && /*id*/ ctx[22] != /*module*/ ctx[1].state.id && create_if_block_1$1(ctx);

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
    			if (/*m*/ ctx[23].output && /*id*/ ctx[22] != /*module*/ ctx[1].state.id) {
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
    		source: "(136:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (145:12) {#if m.state.type == 'adsr'}
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
    			add_location(option, file$4, 145, 12, 4367);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 8 && t_value !== (t_value = /*id*/ ctx[22] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 8 && option_value_value !== (option_value_value = /*m*/ ctx[23])) {
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
    		source: "(145:12) {#if m.state.type == 'adsr'}",
    		ctx
    	});

    	return block;
    }

    // (144:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block$3(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[23].state.type == 'adsr' && create_if_block$2(ctx);

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
    			if (/*m*/ ctx[23].state.type == 'adsr') {
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
    		source: "(144:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_nodePos;
    	let t0;
    	let div1;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let h2;
    	let t4;
    	let div0;
    	let button;
    	let t6;
    	let label0;
    	let select0;
    	let option0;
    	let t7;
    	let t8;
    	let label1;
    	let select1;
    	let option1;
    	let t9;
    	let t10;
    	let label2;
    	let input;
    	let t11;
    	let t12;
    	let br;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[12](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[13](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[14](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 300, y: 350 } };

    	if (/*moduleNode*/ ctx[4] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[4];
    	}

    	if (/*controlsNode*/ ctx[5] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[5];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	let each_value_1 = Object.entries(/*$modules*/ ctx[3]);
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$2(get_each_context_1$2(ctx, each_value_1, i));
    	}

    	let each_value = Object.entries(/*$modules*/ ctx[3]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$3(get_each_context$3(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			h2 = element("h2");
    			h2.textContent = "Amplifier";
    			t4 = space();
    			div0 = element("div");
    			button = element("button");
    			button.textContent = "x";
    			t6 = space();
    			label0 = element("label");
    			select0 = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			option0 = element("option");
    			t7 = text("Input");
    			t8 = space();
    			label1 = element("label");
    			select1 = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option1 = element("option");
    			t9 = text("CV");
    			t10 = space();
    			label2 = element("label");
    			input = element("input");
    			t11 = text("Gain");
    			t12 = space();
    			br = element("br");
    			add_location(h1, file$4, 130, 4, 3743);
    			add_location(h2, file$4, 131, 4, 3775);
    			attr_dev(button, "class", "delete");
    			add_location(button, file$4, 133, 8, 3841);
    			option0.__value = null;
    			option0.value = option0.__value;
    			add_location(option0, file$4, 140, 8, 4148);
    			if (/*module*/ ctx[1].input === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[15].call(select0));
    			add_location(select0, file$4, 134, 15, 3917);
    			add_location(label0, file$4, 134, 8, 3910);
    			option1.__value = null;
    			option1.value = option1.__value;
    			add_location(option1, file$4, 148, 8, 4444);
    			if (/*cv_module*/ ctx[2] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[16].call(select1));
    			add_location(select1, file$4, 142, 15, 4227);
    			add_location(label1, file$4, 142, 8, 4220);
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$4, 150, 15, 4520);
    			add_location(label2, file$4, 150, 8, 4513);
    			attr_dev(div0, "id", "controls");
    			add_location(div0, file$4, 132, 4, 3799);
    			attr_dev(div1, "id", "module");
    			attr_dev(div1, "class", "svelte-1k91gv6");
    			add_location(div1, file$4, 129, 0, 3707);
    			add_location(br, file$4, 153, 0, 4634);
    			add_location(main, file$4, 127, 0, 3556);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div1);
    			append_dev(div1, h1);
    			append_dev(h1, t1);
    			append_dev(div1, t2);
    			append_dev(div1, h2);
    			append_dev(div1, t4);
    			append_dev(div1, div0);
    			append_dev(div0, button);
    			append_dev(div0, t6);
    			append_dev(div0, label0);
    			append_dev(label0, select0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(select0, null);
    				}
    			}

    			append_dev(select0, option0);
    			select_option(select0, /*module*/ ctx[1].input, true);
    			append_dev(label0, t7);
    			append_dev(div0, t8);
    			append_dev(div0, label1);
    			append_dev(label1, select1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select1, null);
    				}
    			}

    			append_dev(select1, option1);
    			select_option(select1, /*cv_module*/ ctx[2], true);
    			append_dev(label1, t9);
    			append_dev(div0, t10);
    			append_dev(div0, label2);
    			append_dev(label2, input);
    			set_input_value(input, /*module*/ ctx[1].state.gain);
    			append_dev(label2, t11);
    			append_dev(main, t12);
    			append_dev(main, br);
    			/*main_binding*/ ctx[18](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button,
    						"click",
    						function () {
    							if (is_function(/*module*/ ctx[1].destroy)) /*module*/ ctx[1].destroy.apply(this, arguments);
    						},
    						false,
    						false,
    						false,
    						false
    					),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[15]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[16]),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[17]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[17]),
    					action_destroyer(/*controls*/ ctx[7].call(null, div0)),
    					action_destroyer(/*movement*/ ctx[6].call(null, div1))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty & /*moduleNode*/ 16) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[4];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty & /*controlsNode*/ 32) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[5];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_nodePos && dirty & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*Object, $modules, module*/ 10) {
    				each_value_1 = Object.entries(/*$modules*/ ctx[3]);
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

    			if (dirty & /*module, Object, $modules*/ 10) {
    				select_option(select0, /*module*/ ctx[1].input);
    			}

    			if (dirty & /*Object, $modules*/ 8) {
    				each_value = Object.entries(/*$modules*/ ctx[3]);
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

    			if (dirty & /*cv_module, Object, $modules*/ 12) {
    				select_option(select1, /*cv_module*/ ctx[2]);
    			}

    			if (dirty & /*module, Object, $modules*/ 10) {
    				set_input_value(input, /*module*/ ctx[1].state.gain);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			/*main_binding*/ ctx[18](null);
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
    	component_subscribe($$self, modules, $$value => $$invalidate(3, $modules = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(19, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(11, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCA', slots, []);

    	let { state = {
    		type: 'vca',
    		gain: 1,
    		id: createNewId(),
    		inputId: null,
    		cvId: null
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	let moduleNode;
    	let controlsNode;

    	if (state.inputId != null) {
    		module.input = $modules[state.inputId];
    	} else {
    		module.input = null;
    	}

    	let cv_module;

    	if (state.cvId != null) {
    		cv_module = $modules[state.cvId];
    	} else {
    		cv_module = null;
    	}

    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	var isEnv = false;
    	var currentInput;
    	var currentCvModule;

    	module.update = () => {
    		((((((($$invalidate(1, module), $$invalidate(20, gainNode)), $$invalidate(9, currentInput)), $$invalidate(2, cv_module)), $$invalidate(11, $context)), $$invalidate(10, currentCvModule)), $$invalidate(8, isEnv)), $$invalidate(3, $modules));
    	};

    	module.destroy = () => {
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

    	function movement(node) {
    		$$invalidate(4, moduleNode = node);
    	}

    	function controls(node) {
    		$$invalidate(5, controlsNode = node);
    	}

    	const writable_props = ['state'];

    	Object_1$4.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCA> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		$$invalidate(4, moduleNode);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(5, controlsNode);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function select0_change_handler() {
    		module.input = select_value(this);
    		((((((($$invalidate(1, module), $$invalidate(20, gainNode)), $$invalidate(9, currentInput)), $$invalidate(2, cv_module)), $$invalidate(11, $context)), $$invalidate(10, currentCvModule)), $$invalidate(8, isEnv)), $$invalidate(3, $modules));
    	}

    	function select1_change_handler() {
    		cv_module = select_value(this);
    		(($$invalidate(2, cv_module), $$invalidate(8, isEnv)), $$invalidate(3, $modules));
    	}

    	function input_change_input_handler() {
    		module.state.gain = to_number(this.value);
    		((((((($$invalidate(1, module), $$invalidate(20, gainNode)), $$invalidate(9, currentInput)), $$invalidate(2, cv_module)), $$invalidate(11, $context)), $$invalidate(10, currentCvModule)), $$invalidate(8, isEnv)), $$invalidate(3, $modules));
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			((((((($$invalidate(1, module), $$invalidate(20, gainNode)), $$invalidate(9, currentInput)), $$invalidate(2, cv_module)), $$invalidate(11, $context)), $$invalidate(10, currentCvModule)), $$invalidate(8, isEnv)), $$invalidate(3, $modules));
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		output,
    		ModuleMovement,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		cv_module,
    		gainNode,
    		isEnv,
    		currentInput,
    		currentCvModule,
    		createNewId,
    		movement,
    		controls,
    		$modules,
    		$output,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(4, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(5, controlsNode = $$props.controlsNode);
    		if ('cv_module' in $$props) $$invalidate(2, cv_module = $$props.cv_module);
    		if ('gainNode' in $$props) $$invalidate(20, gainNode = $$props.gainNode);
    		if ('isEnv' in $$props) $$invalidate(8, isEnv = $$props.isEnv);
    		if ('currentInput' in $$props) $$invalidate(9, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(10, currentCvModule = $$props.currentCvModule);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$modules*/ 8) {
    			{
    				$$invalidate(8, isEnv = false);

    				Object.entries($modules).forEach(m => {
    					if (m[1].state.type == 'adsr') $$invalidate(8, isEnv = true);
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*isEnv*/ 256) {
    			if (!isEnv) $$invalidate(2, cv_module = null);
    		}

    		if ($$self.$$.dirty & /*module*/ 2) {
    			$$invalidate(1, module.max_cv = module.state.gain, module);
    		}

    		if ($$self.$$.dirty & /*module, currentInput*/ 514) {
    			if (module.input) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(9, currentInput = module.input.output);
    				currentInput.connect(gainNode);
    				if (module.input.input || module.input.inputs) module.input.update();
    				$$invalidate(1, module.state.inputId = module.input.state.id, module);
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(9, currentInput = null);
    				$$invalidate(1, module.state.inputId = null, module);
    			}
    		}

    		if ($$self.$$.dirty & /*cv_module, $context, currentCvModule, module*/ 3078) {
    			if (cv_module) {
    				gainNode.gain.cancelScheduledValues($context.currentTime);
    				gainNode.gain.setValueAtTime(0, $context.currentTime);

    				if (currentCvModule) {
    					$$invalidate(10, currentCvModule.cv = null, currentCvModule);
    					$$invalidate(10, currentCvModule.max_cv = null, currentCvModule);
    				}

    				$$invalidate(10, currentCvModule = cv_module);
    				$$invalidate(10, currentCvModule.cv = gainNode.gain, currentCvModule);
    				$$invalidate(10, currentCvModule.max_cv = module.state.gain, currentCvModule);
    				$$invalidate(1, module.state.cvId = cv_module.state.id, module);
    			} else {
    				gainNode.gain.cancelScheduledValues($context.currentTime);
    				gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);

    				if (currentCvModule) {
    					$$invalidate(10, currentCvModule.cv = null, currentCvModule);
    					$$invalidate(10, currentCvModule.max_cv = null, currentCvModule);
    				}

    				$$invalidate(10, currentCvModule = null);
    				$$invalidate(1, module.state.cvId = null, module);
    			}
    		}

    		if ($$self.$$.dirty & /*module, $context*/ 2050) {
    			gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);
    		}
    	};

    	$$invalidate(1, module.cv_in = gainNode.gain, module);

    	return [
    		state,
    		module,
    		cv_module,
    		$modules,
    		moduleNode,
    		controlsNode,
    		movement,
    		controls,
    		isEnv,
    		currentInput,
    		currentCvModule,
    		$context,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_nodePos_binding,
    		select0_change_handler,
    		select1_change_handler,
    		input_change_input_handler,
    		main_binding
    	];
    }

    class VCA extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { state: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCA",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get state() {
    		throw new Error("<VCA>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
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
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_nodePos;
    	let t0;
    	let div2;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let h2;
    	let t4;
    	let div1;
    	let button;
    	let t6;
    	let div0;
    	let label0;
    	let input0;
    	let t7;
    	let t8_value = /*attack*/ ctx[4].toFixed(2) + "";
    	let t8;
    	let t9;
    	let t10;
    	let label1;
    	let input1;
    	let t11;
    	let t12_value = /*decay*/ ctx[5].toFixed(2) + "";
    	let t12;
    	let t13;
    	let t14;
    	let label2;
    	let input2;
    	let t15;
    	let t16_value = /*module*/ ctx[1].state.sustain.toFixed(2) + "";
    	let t16;
    	let t17;
    	let t18;
    	let label3;
    	let input3;
    	let t19;
    	let t20_value = /*release*/ ctx[6].toFixed(2) + "";
    	let t20;
    	let t21;
    	let t22;
    	let br;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[11](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[12](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[13](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 400, y: 400 } };

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div2 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			h2 = element("h2");
    			h2.textContent = "Envelope";
    			t4 = space();
    			div1 = element("div");
    			button = element("button");
    			button.textContent = "x";
    			t6 = space();
    			div0 = element("div");
    			label0 = element("label");
    			input0 = element("input");
    			t7 = text("Attack (");
    			t8 = text(t8_value);
    			t9 = text("s)");
    			t10 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t11 = text("Decay (");
    			t12 = text(t12_value);
    			t13 = text("s)");
    			t14 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t15 = text("Sustain (");
    			t16 = text(t16_value);
    			t17 = text(")");
    			t18 = space();
    			label3 = element("label");
    			input3 = element("input");
    			t19 = text("Release (");
    			t20 = text(t20_value);
    			t21 = text("s)");
    			t22 = space();
    			br = element("br");
    			add_location(h1, file$3, 77, 8, 2369);
    			add_location(h2, file$3, 78, 8, 2405);
    			attr_dev(button, "class", "delete");
    			add_location(button, file$3, 80, 12, 2478);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "1");
    			attr_dev(input0, "step", "0.001");
    			add_location(input0, file$3, 82, 23, 2596);
    			add_location(label0, file$3, 82, 16, 2589);
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "max", "1");
    			attr_dev(input1, "step", "0.001");
    			add_location(input1, file$3, 83, 23, 2740);
    			add_location(label1, file$3, 83, 16, 2733);
    			attr_dev(input2, "type", "range");
    			attr_dev(input2, "min", "0");
    			attr_dev(input2, "max", "1");
    			attr_dev(input2, "step", "0.001");
    			add_location(input2, file$3, 84, 23, 2881);
    			add_location(label2, file$3, 84, 16, 2874);
    			attr_dev(input3, "type", "range");
    			attr_dev(input3, "min", "0");
    			attr_dev(input3, "max", "1");
    			attr_dev(input3, "step", "0.001");
    			add_location(input3, file$3, 85, 23, 3040);
    			add_location(label3, file$3, 85, 16, 3033);
    			attr_dev(div0, "class", "params svelte-1pxka4e");
    			add_location(div0, file$3, 81, 12, 2551);
    			attr_dev(div1, "id", "controls");
    			add_location(div1, file$3, 79, 8, 2432);
    			attr_dev(div2, "id", "module");
    			attr_dev(div2, "class", "svelte-1pxka4e");
    			add_location(div2, file$3, 76, 4, 2329);
    			add_location(br, file$3, 89, 4, 3216);
    			add_location(main, file$3, 74, 0, 2170);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div2);
    			append_dev(div2, h1);
    			append_dev(h1, t1);
    			append_dev(div2, t2);
    			append_dev(div2, h2);
    			append_dev(div2, t4);
    			append_dev(div2, div1);
    			append_dev(div1, button);
    			append_dev(div1, t6);
    			append_dev(div1, div0);
    			append_dev(div0, label0);
    			append_dev(label0, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.attack);
    			append_dev(label0, t7);
    			append_dev(label0, t8);
    			append_dev(label0, t9);
    			append_dev(div0, t10);
    			append_dev(div0, label1);
    			append_dev(label1, input1);
    			set_input_value(input1, /*module*/ ctx[1].state.decay);
    			append_dev(label1, t11);
    			append_dev(label1, t12);
    			append_dev(label1, t13);
    			append_dev(div0, t14);
    			append_dev(div0, label2);
    			append_dev(label2, input2);
    			set_input_value(input2, /*module*/ ctx[1].state.sustain);
    			append_dev(label2, t15);
    			append_dev(label2, t16);
    			append_dev(label2, t17);
    			append_dev(div0, t18);
    			append_dev(div0, label3);
    			append_dev(label3, input3);
    			set_input_value(input3, /*module*/ ctx[1].state.release);
    			append_dev(label3, t19);
    			append_dev(label3, t20);
    			append_dev(label3, t21);
    			append_dev(main, t22);
    			append_dev(main, br);
    			/*main_binding*/ ctx[18](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button,
    						"click",
    						function () {
    							if (is_function(/*module*/ ctx[1].destroy)) /*module*/ ctx[1].destroy.apply(this, arguments);
    						},
    						false,
    						false,
    						false,
    						false
    					),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[14]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[14]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[15]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[15]),
    					listen_dev(input2, "change", /*input2_change_input_handler*/ ctx[16]),
    					listen_dev(input2, "input", /*input2_change_input_handler*/ ctx[16]),
    					listen_dev(input3, "change", /*input3_change_input_handler*/ ctx[17]),
    					listen_dev(input3, "input", /*input3_change_input_handler*/ ctx[17]),
    					action_destroyer(/*controls*/ ctx[8].call(null, div1)),
    					action_destroyer(/*movement*/ ctx[7].call(null, div2))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty & /*moduleNode*/ 4) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[2];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty & /*controlsNode*/ 8) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[3];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_nodePos && dirty & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input0, /*module*/ ctx[1].state.attack);
    			}

    			if ((!current || dirty & /*attack*/ 16) && t8_value !== (t8_value = /*attack*/ ctx[4].toFixed(2) + "")) set_data_dev(t8, t8_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input1, /*module*/ ctx[1].state.decay);
    			}

    			if ((!current || dirty & /*decay*/ 32) && t12_value !== (t12_value = /*decay*/ ctx[5].toFixed(2) + "")) set_data_dev(t12, t12_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input2, /*module*/ ctx[1].state.sustain);
    			}

    			if ((!current || dirty & /*module*/ 2) && t16_value !== (t16_value = /*module*/ ctx[1].state.sustain.toFixed(2) + "")) set_data_dev(t16, t16_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input3, /*module*/ ctx[1].state.release);
    			}

    			if ((!current || dirty & /*release*/ 64) && t20_value !== (t20_value = /*release*/ ctx[6].toFixed(2) + "")) set_data_dev(t20, t20_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			/*main_binding*/ ctx[18](null);
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
    	component_subscribe($$self, modules, $$value => $$invalidate(19, $modules = $$value));
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(10, $midi = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(20, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ADSR', slots, []);

    	let { state = {
    		type: 'adsr',
    		attack: 0.1,
    		decay: 0.1,
    		sustain: 0.5,
    		release: 0.1,
    		id: createNewId()
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	let moduleNode;
    	let controlsNode;
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

    	module.destroy = () => {
    		$$invalidate(1, module.cv = null, module);
    		$$invalidate(1, module.max_cv = null, module);
    		module.component.parentNode.removeChild(module.component);
    		delete $modules[module.state.id];
    		modules.set($modules);
    	};

    	function createNewId() {
    		for (let i = 0; i < Object.keys($modules).length + 1; i++) {
    			if (!$modules[i]) return i;
    		}
    	}

    	function movement(node) {
    		$$invalidate(2, moduleNode = node);
    	}

    	function controls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	const writable_props = ['state'];

    	Object_1$3.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ADSR> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		$$invalidate(2, moduleNode);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(3, controlsNode);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function input0_change_input_handler() {
    		module.state.attack = to_number(this.value);
    		$$invalidate(1, module);
    	}

    	function input1_change_input_handler() {
    		module.state.decay = to_number(this.value);
    		$$invalidate(1, module);
    	}

    	function input2_change_input_handler() {
    		module.state.sustain = to_number(this.value);
    		$$invalidate(1, module);
    	}

    	function input3_change_input_handler() {
    		module.state.release = to_number(this.value);
    		$$invalidate(1, module);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(1, module);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		midi,
    		ModuleMovement,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		notePlaying,
    		attack,
    		decay,
    		release,
    		fireEnv,
    		unFireEnv,
    		createNewId,
    		movement,
    		controls,
    		$modules,
    		$midi,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('notePlaying' in $$props) $$invalidate(9, notePlaying = $$props.notePlaying);
    		if ('attack' in $$props) $$invalidate(4, attack = $$props.attack);
    		if ('decay' in $$props) $$invalidate(5, decay = $$props.decay);
    		if ('release' in $$props) $$invalidate(6, release = $$props.release);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*module*/ 2) {
    			$$invalidate(4, attack = Math.pow(10, module.state.attack) - 1);
    		}

    		if ($$self.$$.dirty & /*module*/ 2) {
    			$$invalidate(5, decay = Math.pow(10, module.state.decay) - 1);
    		}

    		if ($$self.$$.dirty & /*module*/ 2) {
    			$$invalidate(6, release = Math.pow(10, module.state.release) - 1);
    		}

    		if ($$self.$$.dirty & /*$midi, notePlaying*/ 1536) {
    			if ($midi.trigger && !notePlaying) $$invalidate(9, notePlaying = true);
    		}

    		if ($$self.$$.dirty & /*$midi, notePlaying*/ 1536) {
    			if (!$midi.trigger && notePlaying) $$invalidate(9, notePlaying = false);
    		}

    		if ($$self.$$.dirty & /*notePlaying*/ 512) {
    			if (notePlaying) fireEnv(); else unFireEnv();
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		attack,
    		decay,
    		release,
    		movement,
    		controls,
    		notePlaying,
    		$midi,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_nodePos_binding,
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { state: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ADSR",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get state() {
    		throw new Error("<ADSR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
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
    	child_ctx[27] = list[i][0];
    	child_ctx[28] = list[i][1];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[27] = list[i][0];
    	child_ctx[28] = list[i][1];
    	return child_ctx;
    }

    // (139:16) {#if m.output && id != module.state.id}
    function create_if_block_1(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[27] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[28];
    			option.value = option.__value;
    			add_location(option, file$2, 139, 16, 4197);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$modules*/ 8 && t_value !== (t_value = /*id*/ ctx[27] + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*$modules*/ 8 && option_value_value !== (option_value_value = /*m*/ ctx[28])) {
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
    		source: "(139:16) {#if m.output && id != module.state.id}",
    		ctx
    	});

    	return block;
    }

    // (138:12) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[28].output && /*id*/ ctx[27] != /*module*/ ctx[1].state.id && create_if_block_1(ctx);

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
    			if (/*m*/ ctx[28].output && /*id*/ ctx[27] != /*module*/ ctx[1].state.id) {
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
    		source: "(138:12) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (147:16) {#if m.state.type == 'adsr'}
    function create_if_block$1(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[27] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[28];
    			option.value = option.__value;
    			add_location(option, file$2, 147, 16, 4525);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$modules*/ 8 && t_value !== (t_value = /*id*/ ctx[27] + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*$modules*/ 8 && option_value_value !== (option_value_value = /*m*/ ctx[28])) {
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
    		source: "(147:16) {#if m.state.type == 'adsr'}",
    		ctx
    	});

    	return block;
    }

    // (146:12) {#each Object.entries($modules) as [id, m]}
    function create_each_block$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[28].state.type == 'adsr' && create_if_block$1(ctx);

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
    			if (/*m*/ ctx[28].state.type == 'adsr') {
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
    		source: "(146:12) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_nodePos;
    	let t0;
    	let div1;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let h2;
    	let t4;
    	let div0;
    	let button;
    	let t6;
    	let label0;
    	let select0;
    	let option0;
    	let t7;
    	let t8;
    	let label1;
    	let select1;
    	let option1;
    	let t9;
    	let t10;
    	let label2;
    	let input0;
    	let t11;
    	let t12;
    	let section;
    	let label3;
    	let input1;
    	let t13;
    	let t14;
    	let label4;
    	let input2;
    	let t15;
    	let t16;
    	let label5;
    	let input3;
    	let t17;
    	let t18;
    	let br;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[14](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[15](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[16](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 320, y: 420 } };

    	if (/*moduleNode*/ ctx[4] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[4];
    	}

    	if (/*controlsNode*/ ctx[5] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[5];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	let each_value_1 = Object.entries(/*$modules*/ ctx[3]);
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	let each_value = Object.entries(/*$modules*/ ctx[3]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[21][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			h2 = element("h2");
    			h2.textContent = "Filter";
    			t4 = space();
    			div0 = element("div");
    			button = element("button");
    			button.textContent = "x";
    			t6 = space();
    			label0 = element("label");
    			select0 = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			option0 = element("option");
    			t7 = text("Input");
    			t8 = space();
    			label1 = element("label");
    			select1 = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option1 = element("option");
    			t9 = text("CV");
    			t10 = space();
    			label2 = element("label");
    			input0 = element("input");
    			t11 = text("Frequency");
    			t12 = space();
    			section = element("section");
    			label3 = element("label");
    			input1 = element("input");
    			t13 = text(" Lowpass");
    			t14 = space();
    			label4 = element("label");
    			input2 = element("input");
    			t15 = text(" Highpass");
    			t16 = space();
    			label5 = element("label");
    			input3 = element("input");
    			t17 = text(" Bandpass");
    			t18 = space();
    			br = element("br");
    			add_location(h1, file$2, 132, 8, 3844);
    			add_location(h2, file$2, 133, 8, 3880);
    			attr_dev(button, "class", "delete");
    			add_location(button, file$2, 135, 12, 3951);
    			option0.__value = null;
    			option0.value = option0.__value;
    			add_location(option0, file$2, 142, 12, 4286);
    			if (/*module*/ ctx[1].input === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[17].call(select0));
    			add_location(select0, file$2, 136, 19, 4031);
    			add_location(label0, file$2, 136, 12, 4024);
    			option1.__value = null;
    			option1.value = option1.__value;
    			add_location(option1, file$2, 150, 12, 4614);
    			if (/*cv_module*/ ctx[2] === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[18].call(select1));
    			add_location(select1, file$2, 144, 19, 4373);
    			add_location(label1, file$2, 144, 12, 4366);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "2.78135971352466");
    			attr_dev(input0, "max", "14.78135971352466");
    			attr_dev(input0, "step", "0.0001");
    			add_location(input0, file$2, 152, 19, 4698);
    			add_location(label2, file$2, 152, 12, 4691);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "lowpass";
    			input1.value = input1.__value;
    			add_location(input1, file$2, 154, 23, 4875);
    			add_location(label3, file$2, 154, 16, 4868);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "highpass";
    			input2.value = input2.__value;
    			add_location(input2, file$2, 155, 23, 4991);
    			add_location(label4, file$2, 155, 16, 4984);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "bandpass";
    			input3.value = input3.__value;
    			add_location(input3, file$2, 156, 23, 5109);
    			add_location(label5, file$2, 156, 16, 5102);
    			add_location(section, file$2, 153, 12, 4841);
    			attr_dev(div0, "id", "controls");
    			add_location(div0, file$2, 134, 8, 3905);
    			attr_dev(div1, "id", "module");
    			attr_dev(div1, "class", "svelte-1u4kldb");
    			add_location(div1, file$2, 131, 4, 3804);
    			add_location(br, file$2, 160, 4, 5260);
    			add_location(main, file$2, 129, 0, 3649);
    			binding_group.p(input1, input2, input3);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div1);
    			append_dev(div1, h1);
    			append_dev(h1, t1);
    			append_dev(div1, t2);
    			append_dev(div1, h2);
    			append_dev(div1, t4);
    			append_dev(div1, div0);
    			append_dev(div0, button);
    			append_dev(div0, t6);
    			append_dev(div0, label0);
    			append_dev(label0, select0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(select0, null);
    				}
    			}

    			append_dev(select0, option0);
    			select_option(select0, /*module*/ ctx[1].input, true);
    			append_dev(label0, t7);
    			append_dev(div0, t8);
    			append_dev(div0, label1);
    			append_dev(label1, select1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select1, null);
    				}
    			}

    			append_dev(select1, option1);
    			select_option(select1, /*cv_module*/ ctx[2], true);
    			append_dev(label1, t9);
    			append_dev(div0, t10);
    			append_dev(div0, label2);
    			append_dev(label2, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.voct);
    			append_dev(label2, t11);
    			append_dev(div0, t12);
    			append_dev(div0, section);
    			append_dev(section, label3);
    			append_dev(label3, input1);
    			input1.checked = input1.__value === /*module*/ ctx[1].state.filterType;
    			append_dev(label3, t13);
    			append_dev(section, t14);
    			append_dev(section, label4);
    			append_dev(label4, input2);
    			input2.checked = input2.__value === /*module*/ ctx[1].state.filterType;
    			append_dev(label4, t15);
    			append_dev(section, t16);
    			append_dev(section, label5);
    			append_dev(label5, input3);
    			input3.checked = input3.__value === /*module*/ ctx[1].state.filterType;
    			append_dev(label5, t17);
    			append_dev(main, t18);
    			append_dev(main, br);
    			/*main_binding*/ ctx[24](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button,
    						"click",
    						function () {
    							if (is_function(/*module*/ ctx[1].destroy)) /*module*/ ctx[1].destroy.apply(this, arguments);
    						},
    						false,
    						false,
    						false,
    						false
    					),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[17]),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[18]),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[19]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[19]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[20]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[22]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[23]),
    					action_destroyer(/*controls*/ ctx[7].call(null, div0)),
    					action_destroyer(/*movement*/ ctx[6].call(null, div1))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 16) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[4];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 32) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[5];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);

    			if (dirty[0] & /*$modules, module*/ 10) {
    				each_value_1 = Object.entries(/*$modules*/ ctx[3]);
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

    			if (dirty[0] & /*module, $modules*/ 10) {
    				select_option(select0, /*module*/ ctx[1].input);
    			}

    			if (dirty[0] & /*$modules*/ 8) {
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
    						each_blocks[i].m(select1, option1);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty[0] & /*cv_module, $modules*/ 12) {
    				select_option(select1, /*cv_module*/ ctx[2]);
    			}

    			if (dirty[0] & /*module, $modules*/ 10) {
    				set_input_value(input0, /*module*/ ctx[1].state.voct);
    			}

    			if (dirty[0] & /*module, $modules*/ 10) {
    				input1.checked = input1.__value === /*module*/ ctx[1].state.filterType;
    			}

    			if (dirty[0] & /*module, $modules*/ 10) {
    				input2.checked = input2.__value === /*module*/ ctx[1].state.filterType;
    			}

    			if (dirty[0] & /*module, $modules*/ 10) {
    				input3.checked = input3.__value === /*module*/ ctx[1].state.filterType;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			/*main_binding*/ ctx[24](null);
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
    	component_subscribe($$self, modules, $$value => $$invalidate(3, $modules = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(25, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(13, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCF', slots, []);

    	let { state = {
    		type: 'vcf',
    		voct: Math.log2(18000),
    		filterType: 'lowpass',
    		id: createNewId(),
    		inputId: null,
    		cvId: null
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	let moduleNode;
    	let controlsNode;

    	if (state.inputId != null) {
    		module.input = $modules[state.inputId];
    	} else {
    		module.input = null;
    	}

    	let cv_module;

    	if (state.cvId != null) {
    		cv_module = $modules[state.cvId];
    	} else {
    		cv_module = null;
    	}

    	var filterNode = $context.createBiquadFilter();
    	module.output = filterNode;
    	var isEnv = false;
    	var frequency;
    	var currentInput;
    	var currentCvModule;

    	module.update = () => {
    		$$invalidate(1, module);
    	};

    	module.destroy = () => {
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

    	function movement(node) {
    		$$invalidate(4, moduleNode = node);
    	}

    	function controls(node) {
    		$$invalidate(5, controlsNode = node);
    	}

    	const writable_props = ['state'];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCF> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		$$invalidate(4, moduleNode);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(5, controlsNode);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			((((((((($$invalidate(0, state), $$invalidate(1, module)), $$invalidate(11, currentInput)), $$invalidate(8, filterNode)), $$invalidate(2, cv_module)), $$invalidate(13, $context)), $$invalidate(12, currentCvModule)), $$invalidate(10, frequency)), $$invalidate(9, isEnv)), $$invalidate(3, $modules));
    		}
    	}

    	function select0_change_handler() {
    		module.input = select_value(this);
    		$$invalidate(1, module);
    	}

    	function select1_change_handler() {
    		cv_module = select_value(this);
    		(($$invalidate(2, cv_module), $$invalidate(9, isEnv)), $$invalidate(3, $modules));
    	}

    	function input0_change_input_handler() {
    		module.state.voct = to_number(this.value);
    		$$invalidate(1, module);
    	}

    	function input1_change_handler() {
    		module.state.filterType = this.__value;
    		$$invalidate(1, module);
    	}

    	function input2_change_handler() {
    		module.state.filterType = this.__value;
    		$$invalidate(1, module);
    	}

    	function input3_change_handler() {
    		module.state.filterType = this.__value;
    		$$invalidate(1, module);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(1, module);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		output,
    		ModuleMovement,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		cv_module,
    		filterNode,
    		isEnv,
    		frequency,
    		currentInput,
    		currentCvModule,
    		createNewId,
    		movement,
    		controls,
    		$modules,
    		$output,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(4, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(5, controlsNode = $$props.controlsNode);
    		if ('cv_module' in $$props) $$invalidate(2, cv_module = $$props.cv_module);
    		if ('filterNode' in $$props) $$invalidate(8, filterNode = $$props.filterNode);
    		if ('isEnv' in $$props) $$invalidate(9, isEnv = $$props.isEnv);
    		if ('frequency' in $$props) $$invalidate(10, frequency = $$props.frequency);
    		if ('currentInput' in $$props) $$invalidate(11, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(12, currentCvModule = $$props.currentCvModule);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*$modules*/ 8) {
    			{
    				$$invalidate(9, isEnv = false);

    				Object.entries($modules).forEach(m => {
    					if (m[1].state.type == 'adsr') $$invalidate(9, isEnv = true);
    				});
    			}
    		}

    		if ($$self.$$.dirty[0] & /*isEnv*/ 512) {
    			if (!isEnv) $$invalidate(2, cv_module = null);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(10, frequency = Math.pow(2, module.state.voct));
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(8, filterNode.type = module.state.filterType, filterNode);
    		}

    		if ($$self.$$.dirty[0] & /*filterNode, frequency, $context*/ 9472) {
    			filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
    		}

    		if ($$self.$$.dirty[0] & /*module, currentInput, filterNode*/ 2306) {
    			if (module.input) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(11, currentInput = module.input.output);
    				currentInput.connect(filterNode);
    				if (module.input.input || module.input.inputs) module.input.update();
    				$$invalidate(0, state.inputId = module.input.state.id, state);
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(11, currentInput = null);
    				$$invalidate(0, state.inputId = null, state);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*cv_module, filterNode, $context, currentCvModule, frequency*/ 13572) {
    			if (cv_module) {
    				filterNode.frequency.cancelScheduledValues($context.currentTime);
    				filterNode.frequency.setValueAtTime(0, $context.currentTime);

    				if (currentCvModule) {
    					$$invalidate(12, currentCvModule.cv = null, currentCvModule);
    					$$invalidate(12, currentCvModule.max_cv = null, currentCvModule);
    				}

    				$$invalidate(12, currentCvModule = cv_module);
    				$$invalidate(12, currentCvModule.cv = filterNode.frequency, currentCvModule);
    				$$invalidate(12, currentCvModule.max_cv = frequency, currentCvModule);
    				$$invalidate(0, state.cvId = cv_module.state.id, state);
    			} else {
    				filterNode.frequency.cancelScheduledValues($context.currentTime);
    				filterNode.frequency.setValueAtTime(frequency, $context.currentTime);

    				if (currentCvModule) {
    					$$invalidate(12, currentCvModule.cv = null, currentCvModule);
    					$$invalidate(12, currentCvModule.max_cv = null, currentCvModule);
    				}

    				$$invalidate(12, currentCvModule = null);
    				$$invalidate(0, state.cvId = null, state);
    			}
    		}
    	};

    	return [
    		state,
    		module,
    		cv_module,
    		$modules,
    		moduleNode,
    		controlsNode,
    		movement,
    		controls,
    		filterNode,
    		isEnv,
    		frequency,
    		currentInput,
    		currentCvModule,
    		$context,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_nodePos_binding,
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCF",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get state() {
    		throw new Error("<VCF>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
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
    	child_ctx[17] = list[i];
    	child_ctx[18] = list;
    	child_ctx[19] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i][0];
    	child_ctx[21] = list[i][1];
    	return child_ctx;
    }

    // (92:12) {#if m && m.output && id != module.state.id && (!module.inputs.includes(m) || m == input)}
    function create_if_block(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[20] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*m*/ ctx[21];
    			option.value = option.__value;
    			add_location(option, file$1, 92, 12, 2871);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 16 && t_value !== (t_value = /*id*/ ctx[20] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 16 && option_value_value !== (option_value_value = /*m*/ ctx[21])) {
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
    		source: "(92:12) {#if m && m.output && id != module.state.id && (!module.inputs.includes(m) || m == input)}",
    		ctx
    	});

    	return block;
    }

    // (91:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1(ctx) {
    	let show_if = /*m*/ ctx[21] && /*m*/ ctx[21].output && /*id*/ ctx[20] != /*module*/ ctx[1].state.id && (!/*module*/ ctx[1].inputs.includes(/*m*/ ctx[21]) || /*m*/ ctx[21] == /*input*/ ctx[17]);
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
    			if (dirty & /*$modules, module*/ 18) show_if = /*m*/ ctx[21] && /*m*/ ctx[21].output && /*id*/ ctx[20] != /*module*/ ctx[1].state.id && (!/*module*/ ctx[1].inputs.includes(/*m*/ ctx[21]) || /*m*/ ctx[21] == /*input*/ ctx[17]);

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
    		source: "(91:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (89:4) {#each module.inputs as input, inpid}
    function create_each_block$1(ctx) {
    	let label;
    	let select;
    	let option;
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;
    	let each_value_1 = Object.entries(/*$modules*/ ctx[4]);
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	function select_change_handler() {
    		/*select_change_handler*/ ctx[11].call(select, /*each_value*/ ctx[18], /*inpid*/ ctx[19]);
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
    			t1 = text(/*inpid*/ ctx[19]);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$1, 95, 12, 2952);
    			if (/*input*/ ctx[17] === void 0) add_render_callback(select_change_handler);
    			add_location(select, file$1, 89, 15, 2673);
    			add_location(label, file$1, 89, 8, 2666);
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
    			select_option(select, /*input*/ ctx[17], true);
    			append_dev(label, t0);
    			append_dev(label, t1);

    			if (!mounted) {
    				dispose = listen_dev(select, "change", select_change_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*Object, $modules, module*/ 18) {
    				each_value_1 = Object.entries(/*$modules*/ ctx[4]);
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

    			if (dirty & /*module, Object, $modules*/ 18) {
    				select_option(select, /*input*/ ctx[17]);
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
    		source: "(89:4) {#each module.inputs as input, inpid}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_nodePos;
    	let t0;
    	let div1;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let h2;
    	let t4;
    	let div0;
    	let button;
    	let t6;
    	let t7;
    	let br;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[8](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[9](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[10](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 200, y: 400 } };

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	let each_value = /*module*/ ctx[1].inputs;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div1 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			h2 = element("h2");
    			h2.textContent = "Mixer";
    			t4 = space();
    			div0 = element("div");
    			button = element("button");
    			button.textContent = "x";
    			t6 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			br = element("br");
    			add_location(h1, file$1, 84, 4, 2464);
    			add_location(h2, file$1, 85, 4, 2496);
    			attr_dev(button, "class", "delete");
    			add_location(button, file$1, 87, 4, 2554);
    			attr_dev(div0, "id", "controls");
    			add_location(div0, file$1, 86, 4, 2516);
    			attr_dev(div1, "id", "module");
    			attr_dev(div1, "class", "svelte-1sxa0ll");
    			add_location(div1, file$1, 83, 0, 2428);
    			add_location(br, file$1, 100, 0, 3057);
    			add_location(main, file$1, 81, 0, 2277);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div1);
    			append_dev(div1, h1);
    			append_dev(h1, t1);
    			append_dev(div1, t2);
    			append_dev(div1, h2);
    			append_dev(div1, t4);
    			append_dev(div1, div0);
    			append_dev(div0, button);
    			append_dev(div0, t6);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div0, null);
    				}
    			}

    			append_dev(main, t7);
    			append_dev(main, br);
    			/*main_binding*/ ctx[12](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						button,
    						"click",
    						function () {
    							if (is_function(/*module*/ ctx[1].destroy)) /*module*/ ctx[1].destroy.apply(this, arguments);
    						},
    						false,
    						false,
    						false,
    						false
    					),
    					action_destroyer(/*controls*/ ctx[6].call(null, div0)),
    					action_destroyer(/*movement*/ ctx[5].call(null, div1))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty & /*moduleNode*/ 4) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[2];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty & /*controlsNode*/ 8) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[3];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_nodePos && dirty & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*module, Object, $modules*/ 18) {
    				each_value = /*module*/ ctx[1].inputs;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_each(each_blocks, detaching);
    			/*main_binding*/ ctx[12](null);
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
    	let $output;
    	let $context;
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(4, $modules = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(13, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(14, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Mixer', slots, []);

    	let { state = {
    		type: 'mixer',
    		id: createNewId(),
    		inputIds: [null, null, null, null]
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	let moduleNode;
    	let controlsNode;
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	module.inputs = [null, null, null, null];

    	state.inputIds.forEach((id, i) => {
    		if (id != null && $modules[id] != null) {
    			$$invalidate(1, module.inputs[i] = $modules[id], module);
    		}
    	});

    	const currentInputs = [null, null, null, null];

    	module.update = () => {
    		(($$invalidate(1, module), $$invalidate(7, currentInputs)), $$invalidate(15, gainNode));
    	};

    	module.destroy = () => {
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

    	function movement(node) {
    		$$invalidate(2, moduleNode = node);
    	}

    	function controls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	const writable_props = ['state'];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Mixer> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		$$invalidate(2, moduleNode);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(3, controlsNode);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function select_change_handler(each_value, inpid) {
    		each_value[inpid] = select_value(this);
    		(($$invalidate(1, module), $$invalidate(7, currentInputs)), $$invalidate(15, gainNode));
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			(($$invalidate(1, module), $$invalidate(7, currentInputs)), $$invalidate(15, gainNode));
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		output,
    		ModuleMovement,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		gainNode,
    		currentInputs,
    		createNewId,
    		movement,
    		controls,
    		$modules,
    		$output,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('gainNode' in $$props) $$invalidate(15, gainNode = $$props.gainNode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*module, currentInputs*/ 130) {
    			module.inputs.forEach((input, i) => {
    				if (input) {
    					if (currentInputs[i]) currentInputs[i].disconnect();
    					$$invalidate(7, currentInputs[i] = input.output, currentInputs);
    					currentInputs[i].connect(gainNode);
    					$$invalidate(1, module.state.inputIds[i] = input.state.id, module);
    				} else {
    					if (currentInputs[i]) currentInputs[i].disconnect();
    					$$invalidate(7, currentInputs[i] = null, currentInputs);
    					$$invalidate(1, module.state.inputIds[i] = null, module);
    				}
    			});
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		$modules,
    		movement,
    		controls,
    		currentInputs,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_nodePos_binding,
    		select_change_handler,
    		main_binding
    	];
    }

    class Mixer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { state: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Mixer",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get state() {
    		throw new Error("<Mixer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
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
    	child_ctx[13] = list[i];
    	return child_ctx;
    }

    // (99:1) {#each mods as m}
    function create_each_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*m*/ ctx[13].props];
    	var switch_value = /*m*/ ctx[13].type;

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
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
    			const switch_instance_changes = (dirty & /*mods*/ 1)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*m*/ ctx[13].props)])
    			: {};

    			if (dirty & /*mods*/ 1 && switch_value !== (switch_value = /*m*/ ctx[13].type)) {
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
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
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
    		source: "(99:1) {#each mods as m}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div0;
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
    	let button6;
    	let t13;
    	let midi;
    	let t14;
    	let output;
    	let t15;
    	let div1;
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
    			div0 = element("div");
    			button0 = element("button");
    			button0.textContent = "Save patch";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Load patch";
    			t3 = space();
    			button2 = element("button");
    			button2.textContent = "Add Oscillator";
    			t5 = space();
    			button3 = element("button");
    			button3.textContent = "Add Amplifier";
    			t7 = space();
    			button4 = element("button");
    			button4.textContent = "Add Filter";
    			t9 = space();
    			button5 = element("button");
    			button5.textContent = "Add Envelope";
    			t11 = space();
    			button6 = element("button");
    			button6.textContent = "Add Mixer";
    			t13 = space();
    			create_component(midi.$$.fragment);
    			t14 = space();
    			create_component(output.$$.fragment);
    			t15 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(button0, file, 87, 2, 1994);
    			add_location(button1, file, 88, 2, 2041);
    			add_location(button2, file, 89, 2, 2088);
    			add_location(button3, file, 90, 2, 2155);
    			add_location(button4, file, 91, 2, 2221);
    			add_location(button5, file, 92, 2, 2284);
    			add_location(button6, file, 93, 2, 2350);
    			attr_dev(div0, "class", "menu svelte-1mmrt05");
    			add_location(div0, file, 86, 1, 1972);
    			attr_dev(div1, "class", "modules svelte-1mmrt05");
    			add_location(div1, file, 97, 1, 2448);
    			add_location(main, file, 85, 0, 1963);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div0);
    			append_dev(div0, button0);
    			append_dev(div0, t1);
    			append_dev(div0, button1);
    			append_dev(div0, t3);
    			append_dev(div0, button2);
    			append_dev(div0, t5);
    			append_dev(div0, button3);
    			append_dev(div0, t7);
    			append_dev(div0, button4);
    			append_dev(div0, t9);
    			append_dev(div0, button5);
    			append_dev(div0, t11);
    			append_dev(div0, button6);
    			append_dev(div0, t13);
    			mount_component(midi, div0, null);
    			append_dev(div0, t14);
    			mount_component(output, div0, null);
    			append_dev(main, t15);
    			append_dev(main, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div1, null);
    				}
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*save*/ ctx[2], false, false, false, false),
    					listen_dev(button1, "click", /*load*/ ctx[3], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler*/ ctx[4], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_1*/ ctx[5], false, false, false, false),
    					listen_dev(button4, "click", /*click_handler_2*/ ctx[6], false, false, false, false),
    					listen_dev(button5, "click", /*click_handler_3*/ ctx[7], false, false, false, false),
    					listen_dev(button6, "click", /*click_handler_4*/ ctx[8], false, false, false, false)
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
    						each_blocks[i].m(div1, null);
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
    	component_subscribe($$self, modules, $$value => $$invalidate(9, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(10, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	window.AudioContext = window.AudioContext || window.webkitAudioContext;
    	var ctx = new AudioContext();
    	set_store_value(context, $context = ctx, $context);
    	var mods = [];

    	const addModule = (type, props = {}) => {
    		mods.push({ type, props });
    		$$invalidate(0, mods);
    	};

    	const addPatch = patch => {
    		Object.values($modules).forEach(module => {
    			module.destroy();
    		});

    		patch.forEach(module => {
    			switch (module.type) {
    				case "vco":
    					addModule(VCO, { state: module });
    					break;
    				case "mixer":
    					addModule(Mixer, { state: module });
    					break;
    				case "vca":
    					addModule(VCA, { state: module });
    					break;
    				case "vcf":
    					addModule(VCF, { state: module });
    					break;
    				case "adsr":
    					addModule(ADSR, { state: module });
    					break;
    			}
    		});
    	};

    	const save = () => {
    		const patch = [];

    		Object.entries($modules).forEach(module => {
    			patch.push(module[1].state);
    		});

    		const json = JSON.stringify(patch);
    		var a = document.createElement("a");
    		var file = new Blob([json], { type: "text/plain" });
    		a.href = URL.createObjectURL(file);
    		a.download = "patch.json";
    		a.click();
    	};

    	const load = () => {
    		fileDialog().then(files => {
    			try {
    				if (files && files.length == 1) {
    					const fileReader = new FileReader();

    					fileReader.onload = event => {
    						if (typeof event.target.result == "string") {
    							const patch = JSON.parse(event.target.result);
    							addPatch(patch);
    						}
    					};

    					fileReader.readAsText(files[0]);
    				}
    			} catch(e) {
    				console.log(e);
    			}
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
    		fileDialog,
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
    		addPatch,
    		save,
    		load,
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
    		load,
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
