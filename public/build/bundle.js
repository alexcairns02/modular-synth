
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
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
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
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
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
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.data === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function set_data_contenteditable_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
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
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier} [start]
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
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

    const colours = readable({
        vco: "#ff6666",
        mixer: "#ffff77",
        vca: "#88ff88",
        vcf: "#ff9955",
        lfo: "#dd88ff",
        adsr: "#7788ff",
        delay: "#bbbbcc",
        noise: "#bb7755",
        input: "#88eeff"
    });

    const selectingModule = writable(null);

    const isTyping = writable(false);

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

    const { Object: Object_1$3 } = globals;
    const file$d = "src\\MIDI.svelte";

    // (153:52) {#if note}
    function create_if_block$b(ctx) {
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
    		id: create_if_block$b.name,
    		type: "if",
    		source: "(153:52) {#if note}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let p0;
    	let t2;
    	let br0;
    	let t3;
    	let t4;
    	let p1;
    	let t5;
    	let br1;
    	let t6;
    	let p2;
    	let t7;
    	let b;
    	let t8;
    	let t9;
    	let br2;
    	let mounted;
    	let dispose;
    	let if_block = /*note*/ ctx[2] && create_if_block$b(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Note Input";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("Play notes by pressing QWERTY keys on keyboard");
    			br0 = element("br");
    			t3 = text("\r\n    (Requires oscillator in patch for output)");
    			t4 = space();
    			p1 = element("p");
    			t5 = text("Change octave: '-' and '='");
    			br1 = element("br");
    			t6 = space();
    			p2 = element("p");
    			t7 = text("Note played: ");
    			b = element("b");
    			t8 = text(/*note*/ ctx[2]);
    			if (if_block) if_block.c();
    			t9 = space();
    			br2 = element("br");
    			add_location(h2, file$d, 148, 4, 5393);
    			add_location(br0, file$d, 149, 53, 5467);
    			attr_dev(p0, "class", "svelte-fwrw15");
    			add_location(p0, file$d, 149, 4, 5418);
    			add_location(br1, file$d, 151, 33, 5557);
    			attr_dev(p1, "class", "svelte-fwrw15");
    			add_location(p1, file$d, 151, 4, 5528);
    			attr_dev(b, "class", "svelte-fwrw15");
    			toggle_class(b, "active", /*trigger*/ ctx[1]);
    			add_location(b, file$d, 152, 20, 5587);
    			attr_dev(p2, "class", "svelte-fwrw15");
    			add_location(p2, file$d, 152, 4, 5571);
    			attr_dev(div, "class", "svelte-fwrw15");
    			add_location(div, file$d, 147, 0, 5382);
    			add_location(br2, file$d, 154, 0, 5669);
    			add_location(main, file$d, 146, 0, 5374);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, p0);
    			append_dev(p0, t2);
    			append_dev(p0, br0);
    			append_dev(p0, t3);
    			append_dev(div, t4);
    			append_dev(div, p1);
    			append_dev(p1, t5);
    			append_dev(p1, br1);
    			append_dev(div, t6);
    			append_dev(div, p2);
    			append_dev(p2, t7);
    			append_dev(p2, b);
    			append_dev(b, t8);
    			if (if_block) if_block.m(b, null);
    			append_dev(main, t9);
    			append_dev(main, br2);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", /*onKeyDown*/ ctx[4], false, false, false, false),
    					listen_dev(window, "keyup", /*onKeyUp*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*note*/ 4) set_data_dev(t8, /*note*/ ctx[2]);

    			if (/*note*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$b(ctx);
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
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let $midi;
    	let $isTyping;
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(11, $midi = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(12, $isTyping = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MIDI', slots, []);

    	const noteKeys = {
    		90: {
    			code: 90,
    			frequency: 261.63,
    			note: 'C',
    			octUp: 0
    		}, // Z
    		83: {
    			code: 83,
    			frequency: 277.18,
    			note: 'C#/Db',
    			octUp: 0
    		}, // S
    		88: {
    			code: 88,
    			frequency: 293.66,
    			note: 'D',
    			octUp: 0
    		}, // X
    		68: {
    			code: 68,
    			frequency: 311.13,
    			note: 'D#/Eb',
    			octUp: 0
    		}, // D
    		67: {
    			code: 67,
    			frequency: 329.63,
    			note: 'E',
    			octUp: 0
    		}, // C
    		86: {
    			code: 86,
    			frequency: 349.23,
    			note: 'F',
    			octUp: 0
    		}, // V
    		71: {
    			code: 71,
    			frequency: 369.99,
    			note: 'F#/Gb',
    			octUp: 0
    		}, // G
    		66: {
    			code: 66,
    			frequency: 392.00,
    			note: 'G',
    			octUp: 0
    		}, // B
    		72: {
    			code: 72,
    			frequency: 415.30,
    			note: 'G#/Ab',
    			octUp: 0
    		}, // H
    		78: {
    			code: 78,
    			frequency: 440.00,
    			note: 'A',
    			octUp: 0
    		}, // N
    		74: {
    			code: 74,
    			frequency: 466.16,
    			note: 'A#/Bb',
    			octUp: 0
    		}, // J
    		77: {
    			code: 77,
    			frequency: 493.88,
    			note: 'B',
    			octUp: 0
    		}, // M
    		188: {
    			code: 188,
    			frequency: 523.25,
    			note: 'C',
    			octUp: 1
    		}, // ,
    		76: {
    			code: 76,
    			frequency: 554.37,
    			note: 'C#/Db',
    			octUp: 1
    		}, // L
    		190: {
    			code: 190,
    			frequency: 587.33,
    			note: 'D',
    			octUp: 1
    		}, // .
    		59: {
    			code: 59,
    			frequency: 622.25,
    			note: 'D#/Eb',
    			octUp: 1
    		}, // ;
    		191: {
    			code: 191,
    			frequency: 659.25,
    			note: 'E',
    			octUp: 1
    		}, // /
    		81: {
    			code: 81,
    			frequency: 698.46,
    			note: 'F',
    			octUp: 1
    		}, // Q
    		50: {
    			code: 50,
    			frequency: 739.99,
    			note: 'F#/Gb',
    			octUp: 1
    		}, // 2
    		87: {
    			code: 87,
    			frequency: 783.99,
    			note: 'G',
    			octUp: 1
    		}, // W
    		51: {
    			code: 51,
    			frequency: 830.61,
    			note: 'G#/Ab',
    			octUp: 1
    		}, // 3
    		69: {
    			code: 69,
    			frequency: 880.00,
    			note: 'A',
    			octUp: 1
    		}, // E
    		52: {
    			code: 52,
    			frequency: 932.33,
    			note: 'A#/Bb',
    			octUp: 1
    		}, // 4
    		82: {
    			code: 82,
    			frequency: 987.77,
    			note: 'B',
    			octUp: 1
    		}, // R
    		84: {
    			code: 84,
    			frequency: 1046.50,
    			note: 'C',
    			octUp: 2
    		}, // T
    		54: {
    			code: 54,
    			frequency: 1108.73,
    			note: 'C#/Db',
    			octUp: 2
    		}, // 6
    		89: {
    			code: 89,
    			frequency: 1174.66,
    			note: 'D',
    			octUp: 2
    		}, // Y
    		55: {
    			code: 55,
    			frequency: 1244.51,
    			note: 'D#/Eb',
    			octUp: 2
    		}, // 7
    		85: {
    			code: 85,
    			frequency: 1318.51,
    			note: 'E',
    			octUp: 2
    		}, // U
    		73: {
    			code: 73,
    			frequency: 1396.91,
    			note: 'F',
    			octUp: 2
    		}, // I
    		57: {
    			code: 57,
    			frequency: 1479.98,
    			note: 'F#/Gb',
    			octUp: 2
    		}, // 9
    		79: {
    			code: 79,
    			frequency: 1567.98,
    			note: 'G',
    			octUp: 2
    		}, // O
    		48: {
    			code: 48,
    			frequency: 1661.22,
    			note: 'G#/Ab',
    			octUp: 2
    		}, // 0
    		80: {
    			code: 80,
    			frequency: 1760.00,
    			note: 'A',
    			octUp: 2
    		}, // P
    		
    	};

    	let currentlyPressed = [];
    	let octChanged = false; // Whether key input was an octave change (no note is triggered)
    	let keyPressed = false;
    	let octave = 4; // Updates when octave is changed
    	let newOct = 4; // Only updates when a new note is played
    	let frequency = 440;
    	let trigger = false;
    	let note = ''; // The note to be displayed
    	let octUp = 0;
    	let newOctUp = 0;

    	function isPressed(inp) {
    		let result = false;

    		currentlyPressed.forEach(key => {
    			if (key.code == inp.code) result = true;
    		});

    		return result;
    	}

    	function onKeyDown(e) {
    		if ($isTyping) return; // We don't trigger midi input on key presses if a module's title is being changed
    		e.preventDefault();
    		if (e.repeat) return; // Prevents rapid trigger firing when key held down
    		octChanged = false;
    		octUp = 0;
    		keyPressed = true;
    		let inp;

    		if (Object.keys(noteKeys).includes(String(e.keyCode))) {
    			inp = noteKeys[e.keyCode];
    			if (!isPressed(inp)) currentlyPressed.push(inp);
    		}

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
    		}

    		updateOutput();
    	}

    	function onKeyUp(e) {
    		let indexToRemove = null;

    		currentlyPressed.forEach((inp, i) => {
    			if (inp.code == e.keyCode) {
    				indexToRemove = i;
    			}
    		});

    		if (indexToRemove != null) currentlyPressed.splice(indexToRemove, 1);
    		updateOutput();
    	}

    	function updateOutput() {
    		set_store_value(midi, $midi.trigger = currentlyPressed.length > 0, $midi);

    		if ($midi.trigger) {
    			let top = currentlyPressed[currentlyPressed.length - 1];
    			$$invalidate(0, newOct = octave);
    			$$invalidate(3, newOctUp = top.octUp);
    			$$invalidate(2, note = top.note);
    			$$invalidate(1, trigger = true);
    			let frequency = top.frequency;

    			if (octave > 4) {
    				for (let i = 4; i < octave; i++) {
    					frequency *= 2;
    				}
    			} else {
    				for (let i = 4; i > octave; i--) {
    					frequency /= 2;
    				}
    			}

    			set_store_value(midi, $midi.voct = Math.log2(frequency), $midi);
    		} else {
    			set_store_value(midi, $midi.voct = null, $midi);
    			$$invalidate(1, trigger = false);
    		}
    	}

    	const writable_props = [];

    	Object_1$3.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MIDI> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		midi,
    		isTyping,
    		noteKeys,
    		currentlyPressed,
    		octChanged,
    		keyPressed,
    		octave,
    		newOct,
    		frequency,
    		trigger,
    		note,
    		octUp,
    		newOctUp,
    		isPressed,
    		onKeyDown,
    		onKeyUp,
    		updateOutput,
    		$midi,
    		$isTyping
    	});

    	$$self.$inject_state = $$props => {
    		if ('currentlyPressed' in $$props) currentlyPressed = $$props.currentlyPressed;
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
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MIDI",
    			options,
    			id: create_fragment$e.name
    		});
    	}
    }

    let mods, out;

    modules.subscribe((value) => {
        mods = value;
    });
    output.subscribe((value) => {
        out = value;
    });

    function createNewId() {
        for (let i=0; i<Object.keys(mods).length+1; i++) {
            if (!mods[i]) return i;
        }
    }

    function destroyModule(module) {
        if (module.isAudio) module.clearCurrents();

        module.destroyed = true;

        module.component.parentNode.removeChild(module.component);

        if (module.state.cvId || module.state.cvId == 0) {
            modules.update((ms) => {
                ms[module.state.cvId].removeOutput(module.state.id+".1", module.cv);
                return ms;
            });
        }
        if (module.state.cvId2 || module.state.cvId2 == 0) {
            modules.update((ms) => {
                ms[module.state.cvId2].removeOutput(module.state.id+".2", module.cv2);
                return ms;
            });
        }
        
        if (out.state.inputId == module.state.id) output.update((o) => {o.state.inputId = null; return o});
        Object.values(mods).forEach((m) => {
            if (m.state.inputId != null && m.state.inputId == module.state.id) {
                modules.update((ms) => {ms[m.state.id].state.inputId = null; return ms});
            }
            if (m.state.cvId != null && m.state.cvId == module.state.id) {
                modules.update((ms) => {ms[m.state.id].state.cvId = null; return ms});
            }
            if (m.state.cvId2 != null && m.state.cvId2 == module.state.id) {
                modules.update((ms) => {ms[m.state.id].state.cvId2 = null; return ms});
            }
            if (m.state.type == 'mixer') {
                modules.update((ms) => {
                    ms[m.state.id].state.inputIds.forEach((inputId, i) => {
                        if (inputId == module.state.id) ms[m.state.id].state.inputIds[i] = null;
                    });
                    return ms;
                });
            }
        });

        modules.update((ms) => {delete ms[module.state.id]; return ms;});
    }
    function inputsAllHover(module) {
        Object.values(mods).forEach((m) => {
            if (!m.isAudio && (module == null || m.state.id != module.state.id)) {
                m.fade();
            } else if ((module != null && m.state.id == module.state.inputId) || (module == null && m.state.id == out.state.inputId)) {
                m.bob();
            }
        });
    }

    function mixerInputHover(module, inputId) {
        Object.values(mods).forEach((m) => {
            if (m.state.id != module.state.id && (!m.isAudio || (module.state.inputIds.includes(m.state.id) && m.state.id != inputId))) {
                m.fade();
            } else if (inputId != null && m.state.id == inputId) {
                m.bob();
            }
        });
    }

    function cvsAllHover(module, inputId=0) {
        Object.values(mods).forEach((m) => {
            if (!m.isControl && m.state.id != module.state.id) {
                m.fade();
            } else if (module != null && ((m.state.id == module.state.cvId && inputId == 0) || (m.state.id == module.state.cvId2 && inputId == 1))) {
                m.bob();
            }
        });
    }

    function unhover() {
        Object.values(mods).forEach((m) => {
            m.unfade();
        });
    }

    function setPosition() {
        let pos = { x: 350, y: 100 };
        let spaceNotFound = true;
        while (spaceNotFound) {
            let spaceTaken = false;
            Object.values(mods).forEach((m) => {
                if (m.state.position && m.state.position.x == pos.x && m.state.position.y == pos.y) spaceTaken = true;
            });
            if (spaceTaken) {
                pos.x += 20;
                pos.y += 20;
            } else {
                spaceNotFound = false;
            }
        }
        return pos;
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

    /* src\Output.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$2 } = globals;
    const file$c = "src\\Output.svelte";

    // (213:48) 
    function create_if_block_4(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Select input below";
    			add_location(p, file$c, 212, 48, 6069);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(213:48) ",
    		ctx
    	});

    	return block;
    }

    // (212:8) {#if Object.values($modules).length == 0}
    function create_if_block_3(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Add modules using buttons above";
    			add_location(p, file$c, 211, 49, 5981);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(212:8) {#if Object.values($modules).length == 0}",
    		ctx
    	});

    	return block;
    }

    // (220:12) {:else}
    function create_else_block$6(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$6.name,
    		type: "else",
    		source: "(220:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (218:12) {#if $output.state.inputId != null && $modules[$output.state.inputId]}
    function create_if_block_2$3(ctx) {
    	let t0_value = /*$output*/ ctx[1].state.inputId + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[2][/*$output*/ ctx[1].state.inputId].state.title + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$output*/ 2 && t0_value !== (t0_value = /*$output*/ ctx[1].state.inputId + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, $output*/ 6 && t2_value !== (t2_value = /*$modules*/ ctx[2][/*$output*/ ctx[1].state.inputId].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(218:12) {#if $output.state.inputId != null && $modules[$output.state.inputId]}",
    		ctx
    	});

    	return block;
    }

    // (229:4) {#if $output.state.inputId != null}
    function create_if_block$a(ctx) {
    	let button;
    	let t0;
    	let t1;
    	let div1;
    	let div0;
    	let t2;
    	let mounted;
    	let dispose;
    	let if_block = /*recorded*/ ctx[4] && create_if_block_1$5(ctx);

    	const block = {
    		c: function create() {
    			button = element("button");
    			t0 = text(/*recordBtnText*/ ctx[5]);
    			t1 = space();
    			div1 = element("div");
    			div0 = element("div");
    			t2 = space();
    			if (if_block) if_block.c();
    			attr_dev(button, "id", "recordBtn");
    			attr_dev(button, "class", "svelte-oevgu6");
    			add_location(button, file$c, 229, 8, 6877);
    			attr_dev(div0, "id", "audioClip");
    			attr_dev(div0, "class", "svelte-oevgu6");
    			add_location(div0, file$c, 231, 12, 7010);
    			attr_dev(div1, "id", "recorded");
    			attr_dev(div1, "class", "svelte-oevgu6");
    			add_location(div1, file$c, 230, 8, 6977);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);
    			append_dev(button, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div1, t2);
    			if (if_block) if_block.m(div1, null);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setRecordBtn*/ ctx[10].call(null, button)),
    					listen_dev(button, "click", /*recordBtnClick*/ ctx[15], false, false, false, false),
    					action_destroyer(/*setAudioClip*/ ctx[11].call(null, div0))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*recordBtnText*/ 32) set_data_dev(t0, /*recordBtnText*/ ctx[5]);

    			if (/*recorded*/ ctx[4]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$5(ctx);
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$a.name,
    		type: "if",
    		source: "(229:4) {#if $output.state.inputId != null}",
    		ctx
    	});

    	return block;
    }

    // (233:12) {#if recorded}
    function create_if_block_1$5(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Save";
    			attr_dev(button, "id", "saveBtn");
    			attr_dev(button, "class", "svelte-oevgu6");
    			add_location(button, file$c, 233, 16, 7099);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setSaveBtn*/ ctx[12].call(null, button)),
    					listen_dev(button, "click", /*click_handler*/ ctx[28], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$5.name,
    		type: "if",
    		source: "(233:12) {#if recorded}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let main;
    	let div3;
    	let h2;
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let show_if;
    	let t4;
    	let div1;
    	let div0;
    	let label0;
    	let button;
    	let t5;
    	let t6;
    	let br0;
    	let t7;
    	let label1;
    	let input;
    	let t9;
    	let br1;
    	let t10;
    	let div2;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (dirty[0] & /*$modules*/ 4) show_if = null;
    		if (show_if == null) show_if = !!(Object.values(/*$modules*/ ctx[2]).length == 0);
    		if (show_if) return create_if_block_3;
    		if (/*$output*/ ctx[1].state.inputId == null) return create_if_block_4;
    	}

    	let current_block_type = select_block_type(ctx, [-1, -1]);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*$output*/ ctx[1].state.inputId != null && /*$modules*/ ctx[2][/*$output*/ ctx[1].state.inputId]) return create_if_block_2$3;
    		return create_else_block$6;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);
    	let if_block2 = /*$output*/ ctx[1].state.inputId != null && create_if_block$a(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div3 = element("div");
    			h2 = element("h2");
    			t0 = text("Audio Output (");
    			t1 = text(/*connectedString*/ ctx[3]);
    			t2 = text(")");
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			div1 = element("div");
    			div0 = element("div");
    			label0 = element("label");
    			button = element("button");
    			if_block1.c();
    			t5 = text(" Input");
    			t6 = space();
    			br0 = element("br");
    			t7 = space();
    			label1 = element("label");
    			label1.textContent = "Volume";
    			input = element("input");
    			t9 = space();
    			br1 = element("br");
    			t10 = space();
    			div2 = element("div");
    			if (if_block2) if_block2.c();
    			add_location(h2, file$c, 210, 8, 5889);
    			attr_dev(button, "id", "inputBtn");
    			attr_dev(button, "class", "svelte-oevgu6");
    			add_location(button, file$c, 216, 15, 6296);
    			add_location(label0, file$c, 216, 8, 6289);
    			attr_dev(div0, "id", "inputDiv");
    			attr_dev(div0, "class", "svelte-oevgu6");
    			add_location(div0, file$c, 215, 8, 6150);
    			add_location(br0, file$c, 223, 14, 6639);
    			attr_dev(label1, "for", "gain");
    			add_location(label1, file$c, 224, 8, 6653);
    			attr_dev(input, "id", "gain");
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$c, 224, 40, 6685);
    			add_location(div1, file$c, 214, 8, 6119);
    			add_location(br1, file$c, 226, 4, 6796);
    			attr_dev(div2, "id", "recording");
    			attr_dev(div2, "class", "svelte-oevgu6");
    			add_location(div2, file$c, 227, 4, 6806);
    			attr_dev(div3, "id", "mainDiv");
    			attr_dev(div3, "class", "svelte-oevgu6");
    			add_location(div3, file$c, 209, 4, 5850);
    			add_location(main, file$c, 208, 0, 5838);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div3);
    			append_dev(div3, h2);
    			append_dev(h2, t0);
    			append_dev(h2, t1);
    			append_dev(h2, t2);
    			append_dev(div3, t3);
    			if (if_block0) if_block0.m(div3, null);
    			append_dev(div3, t4);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			append_dev(div0, label0);
    			append_dev(label0, button);
    			if_block1.m(button, null);
    			append_dev(label0, t5);
    			append_dev(div0, t6);
    			append_dev(div1, br0);
    			append_dev(div1, t7);
    			append_dev(div1, label1);
    			append_dev(div1, input);
    			set_input_value(input, /*$output*/ ctx[1].state.volume);
    			append_dev(div3, t9);
    			append_dev(div3, br1);
    			append_dev(div3, t10);
    			append_dev(div3, div2);
    			if (if_block2) if_block2.m(div2, null);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setInputBtn*/ ctx[9].call(null, button)),
    					listen_dev(button, "click", /*chooseInput*/ ctx[14], false, false, false, false),
    					listen_dev(div0, "mouseenter", /*mouseenter_handler*/ ctx[25], false, false, false, false),
    					listen_dev(div0, "mouseleave", /*mouseleave_handler*/ ctx[26], false, false, false, false),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[27]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[27]),
    					action_destroyer(/*setControls*/ ctx[8].call(null, div1)),
    					action_destroyer(/*setDiv*/ ctx[7].call(null, div3))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*connectedString*/ 8) set_data_dev(t1, /*connectedString*/ ctx[3]);

    			if (current_block_type !== (current_block_type = select_block_type(ctx, dirty))) {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div3, t4);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(button, null);
    				}
    			}

    			if (dirty[0] & /*$output*/ 2) {
    				set_input_value(input, /*$output*/ ctx[1].state.volume);
    			}

    			if (/*$output*/ ctx[1].state.inputId != null) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$a(ctx);
    					if_block2.c();
    					if_block2.m(div2, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);

    			if (if_block0) {
    				if_block0.d();
    			}

    			if_block1.d();
    			if (if_block2) if_block2.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let $context;
    	let $selectingModule;
    	let $output;
    	let $modules;
    	let $colours;
    	let $redness;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(36, $context = $$value));
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(0, $selectingModule = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(1, $output = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(2, $modules = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(23, $colours = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Output', slots, []);
    	let { state = { volume: 0.5, inputId: null } } = $$props;
    	let divNode;
    	let controlsNode;
    	let inputBtn;
    	let recordBtn;
    	let audioClip;
    	let saveBtn;
    	set_store_value(output, $output.selectingInput = false, $output);
    	set_store_value(output, $output.state = state, $output);
    	var gainNode = $context.createGain();
    	gainNode.connect($context.destination);
    	var currentInput;

    	const setDiv = node => {
    		$$invalidate(17, divNode = node);

    		divNode.addEventListener("mousedown", () => {
    			if ($selectingModule == "output") {
    				$output.select(null);
    			}
    		});
    	};

    	const setControls = node => {
    		$$invalidate(18, controlsNode = node);
    	};

    	const setInputBtn = node => {
    		$$invalidate(19, inputBtn = node);

    		inputBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(19, inputBtn.style.opacity = 0.8, inputBtn);
    		});

    		inputBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(19, inputBtn.style.opacity = 1, inputBtn);
    		});
    	};

    	const setRecordBtn = node => {
    		recordBtn = node;

    		recordBtn.addEventListener("mouseenter", () => {
    			recordBtn.style.opacity = 0.8;
    		});

    		recordBtn.addEventListener("mouseleave", () => {
    			recordBtn.style.opacity = 1;
    		});
    	};

    	const setAudioClip = node => {
    		audioClip = node;
    	};

    	const setSaveBtn = node => {
    		saveBtn = node;

    		saveBtn.addEventListener("mouseenter", () => {
    			saveBtn.style.opacity = 0.8;
    		});

    		saveBtn.addEventListener("mouseleave", () => {
    			saveBtn.style.opacity = 1;
    		});
    	};

    	let redness = spring(0, { stiffness: 0.05, damping: 0.3 });
    	validate_store(redness, 'redness');
    	component_subscribe($$self, redness, value => $$invalidate(24, $redness = value));
    	let loaded = false;
    	let connectedString = "disconnected";

    	setTimeout(
    		() => {
    			$$invalidate(22, loaded = true);
    		},
    		500
    	);

    	function chooseInput() {
    		inputsAllHover(null);
    		if (!inputBtn) return;

    		if (!$output.selectingInput) {
    			set_store_value(output, $output.selectingInput = true, $output);
    			$$invalidate(19, inputBtn.style.opacity = 0.5, inputBtn);
    			set_store_value(selectingModule, $selectingModule = "output", $selectingModule);
    		} else {
    			set_store_value(output, $output.selectingInput = false, $output);
    		}
    	}

    	set_store_value(
    		output,
    		$output.select = id => {
    			if ($output.selectingInput) {
    				set_store_value(output, $output.state.inputId = id, $output);
    				$$invalidate(19, inputBtn.style.opacity = 1, inputBtn);
    				set_store_value(output, $output.selectingInput = false, $output);
    			}

    			set_store_value(selectingModule, $selectingModule = null, $selectingModule);
    			unhover();
    		},
    		$output
    	);

    	let recording = false;
    	let recorded = false;
    	let recordNode;
    	let recorder;
    	let chunks = [];
    	let recordBtnText = "Record";
    	let recordingElement;

    	function recordBtnClick() {
    		recording = !recording;

    		if (recording) {
    			startRecording();
    		} else {
    			stopRecording();
    		}
    	}

    	function startRecording() {
    		if (recordBtn) recordBtn.style.backgroundColor = "#ff6666";
    		$$invalidate(5, recordBtnText = "Recording");
    		recordNode = $context.createMediaStreamDestination();
    		gainNode.connect(recordNode);
    		recorder = new MediaRecorder(recordNode.stream);

    		recorder.ondataavailable = e => {
    			chunks.push(e.data);
    		};

    		recorder.onstop = e => {
    			$$invalidate(6, recordingElement = document.createElement("a"));
    			const file = new Blob(chunks, { type: "audio/ogg; codec=opus" });
    			const url = URL.createObjectURL(file);
    			$$invalidate(6, recordingElement.href = url, recordingElement);
    			$$invalidate(6, recordingElement.download = "recording.ogg", recordingElement);
    			const audio = new Audio();
    			audio.setAttribute("controls", "");
    			audio.src = url;
    			audioClip.replaceChildren(audio);
    			chunks = [];
    			$$invalidate(4, recorded = true);
    			if (recordBtn) recordBtn.style.backgroundColor = "#f0f0f0";
    			$$invalidate(5, recordBtnText = "Record");
    		};

    		recorder.start();
    	}

    	function stopRecording() {
    		recorder.stop();
    	}

    	const writable_props = ['state'];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Output> was created with unknown prop '${key}'`);
    	});

    	const mouseenter_handler = () => {
    		inputsAllHover(null);
    	};

    	const mouseleave_handler = () => {
    		if ($selectingModule == null) unhover();
    	};

    	function input_change_input_handler() {
    		$output.state.volume = to_number(this.value);
    		output.set($output);
    	}

    	const click_handler = () => recordingElement.click();

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(16, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		output,
    		selectingModule,
    		colours,
    		inputsAllHover,
    		unhover,
    		spring,
    		state,
    		divNode,
    		controlsNode,
    		inputBtn,
    		recordBtn,
    		audioClip,
    		saveBtn,
    		gainNode,
    		currentInput,
    		setDiv,
    		setControls,
    		setInputBtn,
    		setRecordBtn,
    		setAudioClip,
    		setSaveBtn,
    		redness,
    		loaded,
    		connectedString,
    		chooseInput,
    		recording,
    		recorded,
    		recordNode,
    		recorder,
    		chunks,
    		recordBtnText,
    		recordingElement,
    		recordBtnClick,
    		startRecording,
    		stopRecording,
    		$context,
    		$selectingModule,
    		$output,
    		$modules,
    		$colours,
    		$redness
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(16, state = $$props.state);
    		if ('divNode' in $$props) $$invalidate(17, divNode = $$props.divNode);
    		if ('controlsNode' in $$props) $$invalidate(18, controlsNode = $$props.controlsNode);
    		if ('inputBtn' in $$props) $$invalidate(19, inputBtn = $$props.inputBtn);
    		if ('recordBtn' in $$props) recordBtn = $$props.recordBtn;
    		if ('audioClip' in $$props) audioClip = $$props.audioClip;
    		if ('saveBtn' in $$props) saveBtn = $$props.saveBtn;
    		if ('gainNode' in $$props) $$invalidate(20, gainNode = $$props.gainNode);
    		if ('currentInput' in $$props) $$invalidate(21, currentInput = $$props.currentInput);
    		if ('redness' in $$props) $$invalidate(13, redness = $$props.redness);
    		if ('loaded' in $$props) $$invalidate(22, loaded = $$props.loaded);
    		if ('connectedString' in $$props) $$invalidate(3, connectedString = $$props.connectedString);
    		if ('recording' in $$props) recording = $$props.recording;
    		if ('recorded' in $$props) $$invalidate(4, recorded = $$props.recorded);
    		if ('recordNode' in $$props) recordNode = $$props.recordNode;
    		if ('recorder' in $$props) recorder = $$props.recorder;
    		if ('chunks' in $$props) chunks = $$props.chunks;
    		if ('recordBtnText' in $$props) $$invalidate(5, recordBtnText = $$props.recordBtnText);
    		if ('recordingElement' in $$props) $$invalidate(6, recordingElement = $$props.recordingElement);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*$output, $modules*/ 6) {
    			if ($output.state.inputId != null) {
    				set_store_value(output, $output.input = $modules[$output.state.inputId], $output);
    			} else {
    				set_store_value(output, $output.input = null, $output);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$output*/ 2) {
    			$$invalidate(20, gainNode.gain.value = $output.state.volume, gainNode);
    		}

    		if ($$self.$$.dirty[0] & /*$output, currentInput, gainNode*/ 3145730) {
    			if ($output.input) {
    				if (currentInput) currentInput.disconnect(gainNode);
    				$$invalidate(21, currentInput = $output.input.output);
    				currentInput.connect(gainNode);
    				if ($output.input.input || $output.input.inputs) $output.input.update();
    			} else {
    				if (currentInput) currentInput.disconnect(gainNode);
    				$$invalidate(21, currentInput = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*divNode, $redness*/ 16908288) {
    			if (divNode) $$invalidate(17, divNode.style.backgroundColor = `rgba(255, ${255 - $redness}, ${255 - $redness}, 0.7)`, divNode);
    		}

    		if ($$self.$$.dirty[0] & /*loaded, $output*/ 4194306) {
    			if (loaded && $output.state.inputId == null) {
    				redness.set(255);
    				$$invalidate(3, connectedString = "disconnected");
    			} else {
    				redness.set(0);
    				$$invalidate(3, connectedString = "connected");
    			}
    		}

    		if ($$self.$$.dirty[0] & /*inputBtn, $output, $colours, $modules*/ 8912902) {
    			if (inputBtn) {
    				if ($output.state.inputId != null) {
    					$$invalidate(19, inputBtn.style.backgroundColor = $colours[$modules[$output.state.inputId].state.type], inputBtn);
    				} else {
    					$$invalidate(19, inputBtn.style.backgroundColor = "#f0f0f0", inputBtn);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, $selectingModule*/ 262145) {
    			if (controlsNode) {
    				if ($selectingModule != null) {
    					$$invalidate(18, controlsNode.style.pointerEvents = "none", controlsNode);
    				} else {
    					$$invalidate(18, controlsNode.style.pointerEvents = "all", controlsNode);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*divNode, $selectingModule*/ 131073) {
    			if (divNode) {
    				if ($selectingModule != null) {
    					$$invalidate(17, divNode.style.pointerEvents = "all", divNode);
    				} else {
    					$$invalidate(17, divNode.style.pointerEvents = "none", divNode);
    				}
    			}
    		}
    	};

    	return [
    		$selectingModule,
    		$output,
    		$modules,
    		connectedString,
    		recorded,
    		recordBtnText,
    		recordingElement,
    		setDiv,
    		setControls,
    		setInputBtn,
    		setRecordBtn,
    		setAudioClip,
    		setSaveBtn,
    		redness,
    		chooseInput,
    		recordBtnClick,
    		state,
    		divNode,
    		controlsNode,
    		inputBtn,
    		gainNode,
    		currentInput,
    		loaded,
    		$colours,
    		$redness,
    		mouseenter_handler,
    		mouseleave_handler,
    		input_change_input_handler,
    		click_handler
    	];
    }

    class Output extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, { state: 16 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Output",
    			options,
    			id: create_fragment$d.name
    		});
    	}

    	get state() {
    		throw new Error("<Output>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Output>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\ModuleMovement.svelte generated by Svelte v3.59.2 */

    function create_fragment$c(ctx) {
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
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let $bobSize,
    		$$unsubscribe_bobSize = noop,
    		$$subscribe_bobSize = () => ($$unsubscribe_bobSize(), $$unsubscribe_bobSize = subscribe(bobSize, $$value => $$invalidate(11, $bobSize = $$value)), bobSize);

    	let $triggerSize;
    	let $size;
    	let $coords;
    	let $midi;
    	let $selectingModule;
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(15, $midi = $$value));
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(18, $selectingModule = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_bobSize());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ModuleMovement', slots, []);
    	let { hasTrigger = false } = $$props;
    	let { moduleNode } = $$props;
    	let { controlsNode } = $$props;
    	let { deleteNode } = $$props;
    	let { helpBtn } = $$props;
    	let { nodeSize = { x: 300, y: 300 } } = $$props;
    	let { nodePos = { x: 300, y: 100 } } = $$props;
    	let { bobSize } = $$props;
    	validate_store(bobSize, 'bobSize');
    	$$subscribe_bobSize();
    	let coords = spring({ x: nodePos.x, y: nodePos.y }, { stiffness: 0.3, damping: 0.5 });
    	validate_store(coords, 'coords');
    	component_subscribe($$self, coords, value => $$invalidate(14, $coords = value));
    	let size = spring(0, { stiffness: 0.3, damping: 0.5 });
    	validate_store(size, 'size');
    	component_subscribe($$self, size, value => $$invalidate(13, $size = value));
    	let triggerSize = spring(0, { stiffness: 1, damping: 0.5 });
    	validate_store(triggerSize, 'triggerSize');
    	component_subscribe($$self, triggerSize, value => $$invalidate(12, $triggerSize = value));
    	let moving = false;
    	let controlling = false;

    	const moduleClick = () => {
    		moving = true;
    		if (!controlling && $selectingModule == null) size.set(20); else if (!controlling) size.set(5);
    	};

    	const controlsClick = () => {
    		controlling = true;
    	};

    	const windowUnClick = () => {
    		moving = false;
    		controlling = false;
    		size.set(0);
    	};

    	const windowMouseMove = e => {
    		if (moving && !controlling && $selectingModule == null) {
    			$$invalidate(5, nodePos.x += e.movementX, nodePos);
    			$$invalidate(5, nodePos.y += e.movementY, nodePos);
    			coords.set({ x: nodePos.x, y: nodePos.y });
    		}
    	};

    	window.addEventListener('mouseup', windowUnClick);
    	window.addEventListener('touchend', windowUnClick);
    	window.addEventListener('mousemove', windowMouseMove);
    	window.addEventListener('touchmove', windowMouseMove);

    	$$self.$$.on_mount.push(function () {
    		if (moduleNode === undefined && !('moduleNode' in $$props || $$self.$$.bound[$$self.$$.props['moduleNode']])) {
    			console.warn("<ModuleMovement> was created without expected prop 'moduleNode'");
    		}

    		if (controlsNode === undefined && !('controlsNode' in $$props || $$self.$$.bound[$$self.$$.props['controlsNode']])) {
    			console.warn("<ModuleMovement> was created without expected prop 'controlsNode'");
    		}

    		if (deleteNode === undefined && !('deleteNode' in $$props || $$self.$$.bound[$$self.$$.props['deleteNode']])) {
    			console.warn("<ModuleMovement> was created without expected prop 'deleteNode'");
    		}

    		if (helpBtn === undefined && !('helpBtn' in $$props || $$self.$$.bound[$$self.$$.props['helpBtn']])) {
    			console.warn("<ModuleMovement> was created without expected prop 'helpBtn'");
    		}

    		if (bobSize === undefined && !('bobSize' in $$props || $$self.$$.bound[$$self.$$.props['bobSize']])) {
    			console.warn("<ModuleMovement> was created without expected prop 'bobSize'");
    		}
    	});

    	const writable_props = [
    		'hasTrigger',
    		'moduleNode',
    		'controlsNode',
    		'deleteNode',
    		'helpBtn',
    		'nodeSize',
    		'nodePos',
    		'bobSize'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ModuleMovement> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('hasTrigger' in $$props) $$invalidate(6, hasTrigger = $$props.hasTrigger);
    		if ('moduleNode' in $$props) $$invalidate(4, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(7, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(8, deleteNode = $$props.deleteNode);
    		if ('helpBtn' in $$props) $$invalidate(9, helpBtn = $$props.helpBtn);
    		if ('nodeSize' in $$props) $$invalidate(10, nodeSize = $$props.nodeSize);
    		if ('nodePos' in $$props) $$invalidate(5, nodePos = $$props.nodePos);
    		if ('bobSize' in $$props) $$subscribe_bobSize($$invalidate(0, bobSize = $$props.bobSize));
    	};

    	$$self.$capture_state = () => ({
    		spring,
    		midi,
    		selectingModule,
    		hasTrigger,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		helpBtn,
    		nodeSize,
    		nodePos,
    		bobSize,
    		coords,
    		size,
    		triggerSize,
    		moving,
    		controlling,
    		moduleClick,
    		controlsClick,
    		windowUnClick,
    		windowMouseMove,
    		$bobSize,
    		$triggerSize,
    		$size,
    		$coords,
    		$midi,
    		$selectingModule
    	});

    	$$self.$inject_state = $$props => {
    		if ('hasTrigger' in $$props) $$invalidate(6, hasTrigger = $$props.hasTrigger);
    		if ('moduleNode' in $$props) $$invalidate(4, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(7, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(8, deleteNode = $$props.deleteNode);
    		if ('helpBtn' in $$props) $$invalidate(9, helpBtn = $$props.helpBtn);
    		if ('nodeSize' in $$props) $$invalidate(10, nodeSize = $$props.nodeSize);
    		if ('nodePos' in $$props) $$invalidate(5, nodePos = $$props.nodePos);
    		if ('bobSize' in $$props) $$subscribe_bobSize($$invalidate(0, bobSize = $$props.bobSize));
    		if ('coords' in $$props) $$invalidate(1, coords = $$props.coords);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    		if ('triggerSize' in $$props) $$invalidate(3, triggerSize = $$props.triggerSize);
    		if ('moving' in $$props) moving = $$props.moving;
    		if ('controlling' in $$props) controlling = $$props.controlling;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*moduleNode, $coords, $size, $triggerSize, $bobSize, nodeSize*/ 31760) {
    			if (moduleNode) {
    				$$invalidate(4, moduleNode.style.left = `${$coords.x - $size / 2 - $triggerSize / 2 - $bobSize / 2}px`, moduleNode);
    				$$invalidate(4, moduleNode.style.top = `${$coords.y - $size / 2 - $triggerSize / 2 - $bobSize / 2}px`, moduleNode);
    				$$invalidate(4, moduleNode.style.width = `${nodeSize.x + $size + $triggerSize + $bobSize}px`, moduleNode);
    				$$invalidate(4, moduleNode.style.height = `${nodeSize.y + $size + $triggerSize + $bobSize}px`, moduleNode);
    			}
    		}

    		if ($$self.$$.dirty & /*moduleNode*/ 16) {
    			if (moduleNode) {
    				moduleNode.addEventListener('mousedown', moduleClick);
    				moduleNode.addEventListener('touchstart', moduleClick);
    			}
    		}

    		if ($$self.$$.dirty & /*controlsNode*/ 128) {
    			if (controlsNode) {
    				controlsNode.childNodes.forEach(node => {
    					node.addEventListener('mousedown', controlsClick);
    					node.addEventListener('touchstart', controlsClick);
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*deleteNode*/ 256) {
    			if (deleteNode) {
    				deleteNode.addEventListener('mousedown', controlsClick);
    				deleteNode.addEventListener('touchstart', controlsClick);
    			}
    		}

    		if ($$self.$$.dirty & /*helpBtn*/ 512) {
    			if (helpBtn) {
    				helpBtn.addEventListener('mousedown', controlsClick);
    				helpBtn.addEventListener('touchstart', controlsClick);
    			}
    		}

    		if ($$self.$$.dirty & /*$midi, hasTrigger*/ 32832) {
    			if ($midi.trigger && hasTrigger) {
    				triggerSize.set(2);
    			} else {
    				triggerSize.set(0);
    			}
    		}
    	};

    	return [
    		bobSize,
    		coords,
    		size,
    		triggerSize,
    		moduleNode,
    		nodePos,
    		hasTrigger,
    		controlsNode,
    		deleteNode,
    		helpBtn,
    		nodeSize,
    		$bobSize,
    		$triggerSize,
    		$size,
    		$coords,
    		$midi
    	];
    }

    class ModuleMovement extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {
    			hasTrigger: 6,
    			moduleNode: 4,
    			controlsNode: 7,
    			deleteNode: 8,
    			helpBtn: 9,
    			nodeSize: 10,
    			nodePos: 5,
    			bobSize: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ModuleMovement",
    			options,
    			id: create_fragment$c.name
    		});
    	}

    	get hasTrigger() {
    		throw new Error("<ModuleMovement>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set hasTrigger(value) {
    		throw new Error("<ModuleMovement>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
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

    	get deleteNode() {
    		throw new Error("<ModuleMovement>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set deleteNode(value) {
    		throw new Error("<ModuleMovement>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get helpBtn() {
    		throw new Error("<ModuleMovement>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set helpBtn(value) {
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

    	get bobSize() {
    		throw new Error("<ModuleMovement>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bobSize(value) {
    		throw new Error("<ModuleMovement>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\DeleteButton.svelte generated by Svelte v3.59.2 */
    const file$b = "src\\DeleteButton.svelte";

    function create_fragment$b(ctx) {
    	let main;
    	let svg;
    	let defs;
    	let g;
    	let path;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			g = svg_element("g");
    			path = svg_element("path");
    			add_location(defs, file$b, 67, 4, 1612);
    			attr_dev(path, "d", "M 45 0 C 20.147 0 0 20.147 0 45 c 0 24.853 20.147 45 45 45 s 45 -20.147 45 -45 C 90 20.147 69.853 0 45 0 z M 64.244 61.416 c 0.781 0.781 0.781 2.047 0 2.828 c -0.391 0.391 -0.902 0.586 -1.414 0.586 s -1.023 -0.195 -1.414 -0.586 L 45 47.828 L 28.583 64.244 c -0.39 0.391 -0.902 0.586 -1.414 0.586 s -1.024 -0.195 -1.414 -0.586 c -0.781 -0.781 -0.781 -2.047 0 -2.828 L 42.172 45 L 25.755 28.583 c -0.781 -0.781 -0.781 -2.047 0 -2.828 c 0.78 -0.781 2.048 -0.781 2.828 0 L 45 42.172 l 16.416 -16.416 c 0.781 -0.781 2.047 -0.781 2.828 0 c 0.781 0.781 0.781 2.047 0 2.828 L 47.828 45 L 64.244 61.416 z");
    			set_style(path, "stroke", "none");
    			set_style(path, "stroke-width", "1");
    			set_style(path, "stroke-dasharray", "none");
    			set_style(path, "stroke-linecap", "butt");
    			set_style(path, "stroke-linejoin", "miter");
    			set_style(path, "stroke-miterlimit", "10");
    			set_style(path, "fill", "#222222");
    			set_style(path, "fill-rule", "nonzero");
    			set_style(path, "opacity", "1");
    			attr_dev(path, "transform", " matrix(1 0 0 1 0 0) ");
    			attr_dev(path, "stroke-linecap", "round");
    			add_location(path, file$b, 70, 8, 1905);
    			set_style(g, "stroke", "none");
    			set_style(g, "stroke-width", "0");
    			set_style(g, "stroke-dasharray", "none");
    			set_style(g, "stroke-linecap", "butt");
    			set_style(g, "stroke-linejoin", "miter");
    			set_style(g, "stroke-miterlimit", "10");
    			set_style(g, "fill", "none");
    			set_style(g, "fill-rule", "nonzero");
    			set_style(g, "opacity", "1");
    			attr_dev(g, "transform", "translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)");
    			add_location(g, file$b, 69, 4, 1637);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "xmlns:xlink", "http://www.w3.org/1999/xlink");
    			attr_dev(svg, "version", "1.1");
    			attr_dev(svg, "viewBox", "0 0 256 256");
    			attr_dev(svg, "xml:space", "preserve");
    			add_location(svg, file$b, 66, 0, 1452);
    			add_location(main, file$b, 64, 0, 1427);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, svg);
    			append_dev(svg, defs);
    			append_dev(svg, g);
    			append_dev(g, path);

    			if (!mounted) {
    				dispose = action_destroyer(/*setButton*/ ctx[1].call(null, svg));
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let $size;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('DeleteButton', slots, []);
    	let { module } = $$props;
    	let size = spring(25, { stiffness: 0.3, damping: 0.5 });
    	validate_store(size, 'size');
    	component_subscribe($$self, size, value => $$invalidate(4, $size = value));
    	let button;
    	let clicking = false;

    	const buttonClick = () => {
    		size.set(35);
    		clicking = true;
    	};

    	const buttonUnClick = () => {
    		if (clicking) {
    			destroyModule(module);
    		}
    	};

    	const windowUnClick = () => {
    		size.set(25);
    		clicking = false;
    	};

    	const buttonHover = () => {
    		if (!clicking) {
    			size.set(30);
    		}
    	};

    	const buttonUnHover = () => {
    		if (!clicking) {
    			size.set(25);
    		}
    	};

    	function setButton(node) {
    		$$invalidate(3, button = node);
    		button.addEventListener('mousedown', buttonClick);
    		button.addEventListener('touchstart', buttonClick);
    		button.addEventListener('mouseup', buttonUnClick);
    		button.addEventListener('touchend', buttonUnClick);
    		window.addEventListener('mouseup', windowUnClick);
    		window.addEventListener('touchend', buttonUnClick);
    		button.addEventListener('mouseover', buttonHover);
    		button.addEventListener('mouseout', buttonUnHover);
    	}

    	$$self.$$.on_mount.push(function () {
    		if (module === undefined && !('module' in $$props || $$self.$$.bound[$$self.$$.props['module']])) {
    			console.warn("<DeleteButton> was created without expected prop 'module'");
    		}
    	});

    	const writable_props = ['module'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<DeleteButton> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('module' in $$props) $$invalidate(2, module = $$props.module);
    	};

    	$$self.$capture_state = () => ({
    		spring,
    		destroyModule,
    		module,
    		size,
    		button,
    		clicking,
    		buttonClick,
    		buttonUnClick,
    		windowUnClick,
    		buttonHover,
    		buttonUnHover,
    		setButton,
    		$size
    	});

    	$$self.$inject_state = $$props => {
    		if ('module' in $$props) $$invalidate(2, module = $$props.module);
    		if ('size' in $$props) $$invalidate(0, size = $$props.size);
    		if ('button' in $$props) $$invalidate(3, button = $$props.button);
    		if ('clicking' in $$props) clicking = $$props.clicking;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*button, $size*/ 24) {
    			if (button) {
    				$$invalidate(3, button.style.width = `${$size}px`, button);
    			}
    		}
    	};

    	return [size, setButton, module, button, $size];
    }

    class DeleteButton extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, { module: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DeleteButton",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get module() {
    		throw new Error("<DeleteButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set module(value) {
    		throw new Error("<DeleteButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\HelpButton.svelte generated by Svelte v3.59.2 */
    const file$a = "src\\HelpButton.svelte";

    function create_fragment$a(ctx) {
    	let main;
    	let svg;
    	let defs;
    	let g;
    	let path;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			g = svg_element("g");
    			path = svg_element("path");
    			add_location(defs, file$a, 68, 8, 1605);
    			attr_dev(path, "d", "M 45 0 C 20.147 0 0 20.147 0 45 c 0 24.853 20.147 45 45 45 s 45 -20.147 45 -45 C 90 20.147 69.853 0 45 0 z M 43.17 21 c 0 -1.104 0.896 -2 2 -2 c 1.105 0 2 0.896 2 2 v 5.787 c 0 1.104 -0.895 2 -2 2 c -1.104 0 -2 -0.896 -2 -2 V 21 z M 51.639 71 H 45.17 c -1.104 0 -2 -0.896 -2 -2 V 42.064 h -4.809 c -1.104 0 -2 -0.896 -2 -2 s 0.896 -2 2 -2 h 6.809 c 1.105 0 2 0.896 2 2 V 67 h 4.469 c 1.104 0 2 0.896 2 2 S 52.743 71 51.639 71 z");
    			set_style(path, "stroke", "none");
    			set_style(path, "stroke-width", "1");
    			set_style(path, "stroke-dasharray", "none");
    			set_style(path, "stroke-linecap", "butt");
    			set_style(path, "stroke-linejoin", "miter");
    			set_style(path, "stroke-miterlimit", "10");
    			set_style(path, "fill", "#222222");
    			set_style(path, "fill-rule", "nonzero");
    			set_style(path, "opacity", "1");
    			attr_dev(path, "transform", " matrix(1 0 0 1 0 0) ");
    			attr_dev(path, "stroke-linecap", "round");
    			add_location(path, file$a, 71, 12, 1910);
    			set_style(g, "stroke", "none");
    			set_style(g, "stroke-width", "0");
    			set_style(g, "stroke-dasharray", "none");
    			set_style(g, "stroke-linecap", "butt");
    			set_style(g, "stroke-linejoin", "miter");
    			set_style(g, "stroke-miterlimit", "10");
    			set_style(g, "fill", "none");
    			set_style(g, "fill-rule", "nonzero");
    			set_style(g, "opacity", "1");
    			attr_dev(g, "transform", "translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)");
    			add_location(g, file$a, 70, 8, 1638);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "xmlns:xlink", "http://www.w3.org/1999/xlink");
    			attr_dev(svg, "version", "1.1");
    			attr_dev(svg, "viewBox", "0 0 256 256");
    			attr_dev(svg, "xml:space", "preserve");
    			add_location(svg, file$a, 66, 4, 1439);
    			add_location(main, file$a, 64, 0, 1406);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, svg);
    			append_dev(svg, defs);
    			append_dev(svg, g);
    			append_dev(g, path);

    			if (!mounted) {
    				dispose = action_destroyer(/*setButton*/ ctx[1].call(null, svg));
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let $size;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('HelpButton', slots, []);
    	let { module } = $$props;
    	let size = spring(25, { stiffness: 0.3, damping: 0.5 });
    	validate_store(size, 'size');
    	component_subscribe($$self, size, value => $$invalidate(4, $size = value));
    	let button;
    	let clicking = false;

    	const buttonClick = () => {
    		size.set(35);
    		clicking = true;
    	};

    	const buttonUnClick = () => {
    		if (clicking) {
    			size.set(30);
    			module.toggleHelp();
    		}
    	};

    	const windowUnClick = () => {
    		size.set(25);
    		clicking = false;
    	};

    	const buttonHover = () => {
    		if (!clicking) {
    			size.set(30);
    		}
    	};

    	const buttonUnHover = () => {
    		if (!clicking) {
    			size.set(25);
    		}
    	};

    	function setButton(node) {
    		$$invalidate(3, button = node);
    		button.addEventListener('mousedown', buttonClick);
    		button.addEventListener('touchstart', buttonClick);
    		button.addEventListener('mouseup', buttonUnClick);
    		button.addEventListener('touchend', buttonUnClick);
    		window.addEventListener('mouseup', windowUnClick);
    		window.addEventListener('touchend', buttonUnClick);
    		button.addEventListener('mouseover', buttonHover);
    		button.addEventListener('mouseout', buttonUnHover);
    	}

    	$$self.$$.on_mount.push(function () {
    		if (module === undefined && !('module' in $$props || $$self.$$.bound[$$self.$$.props['module']])) {
    			console.warn("<HelpButton> was created without expected prop 'module'");
    		}
    	});

    	const writable_props = ['module'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<HelpButton> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('module' in $$props) $$invalidate(2, module = $$props.module);
    	};

    	$$self.$capture_state = () => ({
    		spring,
    		module,
    		size,
    		button,
    		clicking,
    		buttonClick,
    		buttonUnClick,
    		windowUnClick,
    		buttonHover,
    		buttonUnHover,
    		setButton,
    		$size
    	});

    	$$self.$inject_state = $$props => {
    		if ('module' in $$props) $$invalidate(2, module = $$props.module);
    		if ('size' in $$props) $$invalidate(0, size = $$props.size);
    		if ('button' in $$props) $$invalidate(3, button = $$props.button);
    		if ('clicking' in $$props) clicking = $$props.clicking;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*button, $size*/ 24) {
    			if (button) {
    				$$invalidate(3, button.style.width = `${$size}px`, button);
    			}
    		}
    	};

    	return [size, setButton, module, button, $size];
    }

    class HelpButton extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { module: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "HelpButton",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get module() {
    		throw new Error("<HelpButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set module(value) {
    		throw new Error("<HelpButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\modules\VCO.svelte generated by Svelte v3.59.2 */
    const file$9 = "src\\modules\\VCO.svelte";

    // (328:0) {#if !module.destroyed}
    function create_if_block$9(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_helpBtn;
    	let updating_nodePos;
    	let updating_nodeSize;
    	let updating_bobSize;
    	let t0;
    	let div7;
    	let div0;
    	let deletebutton;
    	let t1;
    	let div1;
    	let helpbutton;
    	let t2;
    	let h1;
    	let t3_value = /*module*/ ctx[4].state.id + "";
    	let t3;
    	let t4;
    	let div5;
    	let h2;
    	let t5_value = /*module*/ ctx[4].state.title + "";
    	let t5;
    	let t6;
    	let div4;
    	let div2;
    	let label0;
    	let button0;
    	let t7;
    	let t8;
    	let label1;
    	let t9;
    	let t10_value = /*totalFrequency*/ ctx[5].toFixed(1) + "";
    	let t10;
    	let t11;
    	let input0;
    	let t12;
    	let br0;
    	let br1;
    	let t13;
    	let div3;
    	let label2;
    	let button1;
    	let t14;
    	let t15;
    	let label3;
    	let t16;
    	let t17_value = /*module*/ ctx[4].state.detune + "";
    	let t17;
    	let t18;
    	let input1;
    	let t19;
    	let br2;
    	let section;
    	let input2;
    	let input2_id_value;
    	let label4;
    	let t20;
    	let label4_for_value;
    	let t21;
    	let input3;
    	let input3_id_value;
    	let label5;
    	let t22;
    	let label5_for_value;
    	let t23;
    	let input4;
    	let input4_id_value;
    	let label6;
    	let t24;
    	let label6_for_value;
    	let t25;
    	let input5;
    	let input5_id_value;
    	let label7;
    	let t26;
    	let label7_for_value;
    	let t27;
    	let div6;
    	let p;
    	let t28;
    	let br3;
    	let br4;
    	let t29;
    	let br5;
    	let br6;
    	let t30;
    	let br7;
    	let br8;
    	let t31;
    	let br9;
    	let br10;
    	let t32;
    	let br11;
    	let br12;
    	let div7_style_value;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[34](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[35](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[36](value);
    	}

    	function modulemovement_helpBtn_binding(value) {
    		/*modulemovement_helpBtn_binding*/ ctx[37](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[38](value);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		/*modulemovement_nodeSize_binding*/ ctx[39](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[40](value);
    	}

    	let modulemovement_props = {};

    	if (/*moduleNode*/ ctx[1] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[1];
    	}

    	if (/*controlsNode*/ ctx[2] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[2];
    	}

    	if (/*deleteNode*/ ctx[3] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[3];
    	}

    	if (/*helpBtn*/ ctx[9] !== void 0) {
    		modulemovement_props.helpBtn = /*helpBtn*/ ctx[9];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	if (/*nodeSize*/ ctx[10] !== void 0) {
    		modulemovement_props.nodeSize = /*nodeSize*/ ctx[10];
    	}

    	if (/*bobSize*/ ctx[11] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[11];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'helpBtn', modulemovement_helpBtn_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodeSize', modulemovement_nodeSize_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[4] },
    			$$inline: true
    		});

    	helpbutton = new HelpButton({
    			props: { module: /*module*/ ctx[4] },
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*module*/ ctx[4].state.cvId != null && /*$modules*/ ctx[7][/*module*/ ctx[4].state.cvId]) return create_if_block_2$2;
    		return create_else_block_1$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*module*/ ctx[4].state.cvId2 != null && /*$modules*/ ctx[7][/*module*/ ctx[4].state.cvId2]) return create_if_block_1$4;
    		return create_else_block$5;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[51][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div7 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(helpbutton.$$.fragment);
    			t2 = space();
    			h1 = element("h1");
    			t3 = text(t3_value);
    			t4 = space();
    			div5 = element("div");
    			h2 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			div4 = element("div");
    			div2 = element("div");
    			label0 = element("label");
    			button0 = element("button");
    			if_block0.c();
    			t7 = text(" Control");
    			t8 = space();
    			label1 = element("label");
    			t9 = text("Frequency (");
    			t10 = text(t10_value);
    			t11 = text("Hz)");
    			input0 = element("input");
    			t12 = space();
    			br0 = element("br");
    			br1 = element("br");
    			t13 = space();
    			div3 = element("div");
    			label2 = element("label");
    			button1 = element("button");
    			if_block1.c();
    			t14 = text(" Control");
    			t15 = space();
    			label3 = element("label");
    			t16 = text("Detune (");
    			t17 = text(t17_value);
    			t18 = text(" cents)");
    			input1 = element("input");
    			t19 = space();
    			br2 = element("br");
    			section = element("section");
    			input2 = element("input");
    			label4 = element("label");
    			t20 = text("Sine");
    			t21 = space();
    			input3 = element("input");
    			label5 = element("label");
    			t22 = text("Triangle");
    			t23 = space();
    			input4 = element("input");
    			label6 = element("label");
    			t24 = text("Sawtooth");
    			t25 = space();
    			input5 = element("input");
    			label7 = element("label");
    			t26 = text("Square");
    			t27 = space();
    			div6 = element("div");
    			p = element("p");
    			t28 = text("Produces a basic sound wave - the primary starting module of most synth patches.");
    			br3 = element("br");
    			br4 = element("br");
    			t29 = text("\r\n            Pressing keyboard keys changes the pitch of the sound wave, following a piano-like arrangement.");
    			br5 = element("br");
    			br6 = element("br");
    			t30 = text("\r\n            Frequency parameter also changes the pitch, and can be automated with its Control selector.");
    			br7 = element("br");
    			br8 = element("br");
    			t31 = text("\r\n            Detune parameter causes subtle pitch adjustment, and can also be automated.");
    			br9 = element("br");
    			br10 = element("br");
    			t32 = text("\r\n            Selecting an LFO for Detune Control causes vibrato effect.");
    			br11 = element("br");
    			br12 = element("br");
    			attr_dev(div0, "class", "delete svelte-1xva0sb");
    			add_location(div0, file$9, 331, 4, 11402);
    			attr_dev(div1, "class", "help svelte-1xva0sb");
    			add_location(div1, file$9, 332, 4, 11480);
    			add_location(h1, file$9, 333, 4, 11555);
    			attr_dev(h2, "class", "editableTitle svelte-1xva0sb");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[7][/*module*/ ctx[4].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[41].call(h2));
    			add_location(h2, file$9, 335, 8, 11635);
    			attr_dev(button0, "class", "svelte-1xva0sb");
    			add_location(button0, file$9, 339, 19, 11984);
    			add_location(label0, file$9, 339, 12, 11977);
    			attr_dev(div2, "class", "inputDiv");
    			add_location(div2, file$9, 338, 8, 11829);
    			attr_dev(label1, "for", "freq");
    			add_location(label1, file$9, 346, 8, 12326);
    			attr_dev(input0, "id", "freq");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "-2");
    			attr_dev(input0, "max", "2");
    			attr_dev(input0, "step", "0.083333333333333");
    			add_location(input0, file$9, 346, 75, 12393);
    			add_location(br0, file$9, 347, 8, 12511);
    			add_location(br1, file$9, 347, 12, 12515);
    			attr_dev(button1, "class", "svelte-1xva0sb");
    			add_location(button1, file$9, 350, 19, 12686);
    			add_location(label2, file$9, 350, 12, 12679);
    			attr_dev(div3, "class", "inputDiv");
    			add_location(div3, file$9, 349, 8, 12531);
    			attr_dev(label3, "for", "detune");
    			add_location(label3, file$9, 357, 8, 13034);
    			attr_dev(input1, "id", "detune");
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "-100");
    			attr_dev(input1, "max", "100");
    			attr_dev(input1, "step", "1");
    			add_location(input1, file$9, 357, 72, 13098);
    			add_location(br2, file$9, 359, 8, 13205);
    			attr_dev(input2, "id", input2_id_value = 'sine' + /*module*/ ctx[4].state.id);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "sine";
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-1xva0sb");
    			add_location(input2, file$9, 360, 12, 13246);
    			attr_dev(label4, "for", label4_for_value = 'sine' + /*module*/ ctx[4].state.id);
    			attr_dev(label4, "class", "svelte-1xva0sb");
    			add_location(label4, file$9, 360, 107, 13341);
    			attr_dev(input3, "id", input3_id_value = 'triangle' + /*module*/ ctx[4].state.id);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "triangle";
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-1xva0sb");
    			add_location(input3, file$9, 361, 12, 13403);
    			attr_dev(label5, "for", label5_for_value = 'triangle' + /*module*/ ctx[4].state.id);
    			attr_dev(label5, "class", "svelte-1xva0sb");
    			add_location(label5, file$9, 361, 116, 13507);
    			attr_dev(input4, "id", input4_id_value = 'sawtooth' + /*module*/ ctx[4].state.id);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "sawtooth";
    			input4.value = input4.__value;
    			attr_dev(input4, "class", "svelte-1xva0sb");
    			add_location(input4, file$9, 362, 12, 13577);
    			attr_dev(label6, "for", label6_for_value = 'sawtooth' + /*module*/ ctx[4].state.id);
    			attr_dev(label6, "class", "svelte-1xva0sb");
    			add_location(label6, file$9, 362, 115, 13680);
    			attr_dev(input5, "id", input5_id_value = 'square' + /*module*/ ctx[4].state.id);
    			attr_dev(input5, "type", "radio");
    			input5.__value = "square";
    			input5.value = input5.__value;
    			attr_dev(input5, "class", "svelte-1xva0sb");
    			add_location(input5, file$9, 363, 12, 13750);
    			attr_dev(label7, "for", label7_for_value = 'square' + /*module*/ ctx[4].state.id);
    			attr_dev(label7, "class", "svelte-1xva0sb");
    			add_location(label7, file$9, 363, 111, 13849);
    			attr_dev(section, "class", "shape svelte-1xva0sb");
    			add_location(section, file$9, 359, 12, 13209);
    			add_location(div4, file$9, 337, 8, 11796);
    			attr_dev(div5, "class", "controls");
    			add_location(div5, file$9, 334, 4, 11587);
    			add_location(br3, file$9, 368, 91, 14068);
    			add_location(br4, file$9, 368, 95, 14072);
    			add_location(br5, file$9, 369, 107, 14185);
    			add_location(br6, file$9, 369, 111, 14189);
    			add_location(br7, file$9, 370, 103, 14298);
    			add_location(br8, file$9, 370, 107, 14302);
    			add_location(br9, file$9, 371, 87, 14395);
    			add_location(br10, file$9, 371, 91, 14399);
    			add_location(br11, file$9, 372, 70, 14475);
    			add_location(br12, file$9, 372, 74, 14479);
    			attr_dev(p, "class", "svelte-1xva0sb");
    			add_location(p, file$9, 368, 8, 13985);
    			add_location(div6, file$9, 367, 4, 13955);
    			attr_dev(div7, "id", "module");
    			attr_dev(div7, "style", div7_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[4].state.type]);
    			attr_dev(div7, "class", "svelte-1xva0sb");
    			add_location(div7, file$9, 330, 4, 11306);
    			add_location(main, file$9, 328, 0, 11121);
    			binding_group.p(input2, input3, input4, input5);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div7);
    			append_dev(div7, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div7, t1);
    			append_dev(div7, div1);
    			mount_component(helpbutton, div1, null);
    			append_dev(div7, t2);
    			append_dev(div7, h1);
    			append_dev(h1, t3);
    			append_dev(div7, t4);
    			append_dev(div7, div5);
    			append_dev(div5, h2);
    			append_dev(h2, t5);

    			if (/*$modules*/ ctx[7][/*module*/ ctx[4].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[7][/*module*/ ctx[4].state.id].state.title;
    			}

    			append_dev(div5, t6);
    			append_dev(div5, div4);
    			append_dev(div4, div2);
    			append_dev(div2, label0);
    			append_dev(label0, button0);
    			if_block0.m(button0, null);
    			append_dev(label0, t7);
    			append_dev(div4, t8);
    			append_dev(div4, label1);
    			append_dev(label1, t9);
    			append_dev(label1, t10);
    			append_dev(label1, t11);
    			append_dev(div4, input0);
    			set_input_value(input0, /*module*/ ctx[4].state.frequency);
    			append_dev(div4, t12);
    			append_dev(div4, br0);
    			append_dev(div4, br1);
    			append_dev(div4, t13);
    			append_dev(div4, div3);
    			append_dev(div3, label2);
    			append_dev(label2, button1);
    			if_block1.m(button1, null);
    			append_dev(label2, t14);
    			append_dev(div4, t15);
    			append_dev(div4, label3);
    			append_dev(label3, t16);
    			append_dev(label3, t17);
    			append_dev(label3, t18);
    			append_dev(div4, input1);
    			set_input_value(input1, /*module*/ ctx[4].state.detune);
    			append_dev(div4, t19);
    			append_dev(div4, br2);
    			append_dev(div4, section);
    			append_dev(section, input2);
    			input2.checked = input2.__value === /*module*/ ctx[4].state.shape;
    			append_dev(section, label4);
    			append_dev(label4, t20);
    			append_dev(section, t21);
    			append_dev(section, input3);
    			input3.checked = input3.__value === /*module*/ ctx[4].state.shape;
    			append_dev(section, label5);
    			append_dev(label5, t22);
    			append_dev(section, t23);
    			append_dev(section, input4);
    			input4.checked = input4.__value === /*module*/ ctx[4].state.shape;
    			append_dev(section, label6);
    			append_dev(label6, t24);
    			append_dev(section, t25);
    			append_dev(section, input5);
    			input5.checked = input5.__value === /*module*/ ctx[4].state.shape;
    			append_dev(section, label7);
    			append_dev(label7, t26);
    			append_dev(div7, t27);
    			append_dev(div7, div6);
    			append_dev(div6, p);
    			append_dev(p, t28);
    			append_dev(p, br3);
    			append_dev(p, br4);
    			append_dev(p, t29);
    			append_dev(p, br5);
    			append_dev(p, br6);
    			append_dev(p, t30);
    			append_dev(p, br7);
    			append_dev(p, br8);
    			append_dev(p, t31);
    			append_dev(p, br9);
    			append_dev(p, br10);
    			append_dev(p, t32);
    			append_dev(p, br11);
    			append_dev(p, br12);
    			/*main_binding*/ ctx[55](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[14].call(null, div0)),
    					action_destroyer(/*setHelpBtn*/ ctx[15].call(null, div1)),
    					action_destroyer(/*setTitleNode*/ ctx[16].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[41]),
    					action_destroyer(/*setFreqCvBtn*/ ctx[17].call(null, button0)),
    					listen_dev(button0, "click", /*click_handler*/ ctx[42], false, false, false, false),
    					listen_dev(div2, "mouseenter", /*mouseenter_handler*/ ctx[43], false, false, false, false),
    					listen_dev(div2, "mouseleave", /*mouseleave_handler*/ ctx[44], false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[45]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[45]),
    					action_destroyer(/*setDetuneCvBtn*/ ctx[18].call(null, button1)),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[46], false, false, false, false),
    					listen_dev(div3, "mouseenter", /*mouseenter_handler_1*/ ctx[47], false, false, false, false),
    					listen_dev(div3, "mouseleave", /*mouseleave_handler_1*/ ctx[48], false, false, false, false),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[49]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[49]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[50]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[52]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[53]),
    					listen_dev(input5, "change", /*input5_change_handler*/ ctx[54]),
    					action_destroyer(/*setNotHelpDiv*/ ctx[20].call(null, div4)),
    					action_destroyer(/*setControls*/ ctx[13].call(null, div5)),
    					action_destroyer(/*setHelpDiv*/ ctx[19].call(null, div6)),
    					action_destroyer(/*setModule*/ ctx[12].call(null, div7))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 2) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[1];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 4) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[2];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 8) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[3];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_helpBtn && dirty[0] & /*helpBtn*/ 512) {
    				updating_helpBtn = true;
    				modulemovement_changes.helpBtn = /*helpBtn*/ ctx[9];
    				add_flush_callback(() => updating_helpBtn = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_nodeSize && dirty[0] & /*nodeSize*/ 1024) {
    				updating_nodeSize = true;
    				modulemovement_changes.nodeSize = /*nodeSize*/ ctx[10];
    				add_flush_callback(() => updating_nodeSize = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 2048) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[11];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 16) deletebutton_changes.module = /*module*/ ctx[4];
    			deletebutton.$set(deletebutton_changes);
    			const helpbutton_changes = {};
    			if (dirty[0] & /*module*/ 16) helpbutton_changes.module = /*module*/ ctx[4];
    			helpbutton.$set(helpbutton_changes);
    			if ((!current || dirty[0] & /*module*/ 16) && t3_value !== (t3_value = /*module*/ ctx[4].state.id + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty[0] & /*module*/ 16) && t5_value !== (t5_value = /*module*/ ctx[4].state.title + "")) set_data_contenteditable_dev(t5, t5_value);

    			if (dirty[0] & /*$modules, module*/ 144 && /*$modules*/ ctx[7][/*module*/ ctx[4].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[7][/*module*/ ctx[4].state.id].state.title;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(button0, null);
    				}
    			}

    			if ((!current || dirty[0] & /*totalFrequency*/ 32) && t10_value !== (t10_value = /*totalFrequency*/ ctx[5].toFixed(1) + "")) set_data_dev(t10, t10_value);

    			if (dirty[0] & /*module*/ 16) {
    				set_input_value(input0, /*module*/ ctx[4].state.frequency);
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(button1, null);
    				}
    			}

    			if ((!current || dirty[0] & /*module*/ 16) && t17_value !== (t17_value = /*module*/ ctx[4].state.detune + "")) set_data_dev(t17, t17_value);

    			if (dirty[0] & /*module*/ 16) {
    				set_input_value(input1, /*module*/ ctx[4].state.detune);
    			}

    			if (!current || dirty[0] & /*module*/ 16 && input2_id_value !== (input2_id_value = 'sine' + /*module*/ ctx[4].state.id)) {
    				attr_dev(input2, "id", input2_id_value);
    			}

    			if (dirty[0] & /*module*/ 16) {
    				input2.checked = input2.__value === /*module*/ ctx[4].state.shape;
    			}

    			if (!current || dirty[0] & /*module*/ 16 && label4_for_value !== (label4_for_value = 'sine' + /*module*/ ctx[4].state.id)) {
    				attr_dev(label4, "for", label4_for_value);
    			}

    			if (!current || dirty[0] & /*module*/ 16 && input3_id_value !== (input3_id_value = 'triangle' + /*module*/ ctx[4].state.id)) {
    				attr_dev(input3, "id", input3_id_value);
    			}

    			if (dirty[0] & /*module*/ 16) {
    				input3.checked = input3.__value === /*module*/ ctx[4].state.shape;
    			}

    			if (!current || dirty[0] & /*module*/ 16 && label5_for_value !== (label5_for_value = 'triangle' + /*module*/ ctx[4].state.id)) {
    				attr_dev(label5, "for", label5_for_value);
    			}

    			if (!current || dirty[0] & /*module*/ 16 && input4_id_value !== (input4_id_value = 'sawtooth' + /*module*/ ctx[4].state.id)) {
    				attr_dev(input4, "id", input4_id_value);
    			}

    			if (dirty[0] & /*module*/ 16) {
    				input4.checked = input4.__value === /*module*/ ctx[4].state.shape;
    			}

    			if (!current || dirty[0] & /*module*/ 16 && label6_for_value !== (label6_for_value = 'sawtooth' + /*module*/ ctx[4].state.id)) {
    				attr_dev(label6, "for", label6_for_value);
    			}

    			if (!current || dirty[0] & /*module*/ 16 && input5_id_value !== (input5_id_value = 'square' + /*module*/ ctx[4].state.id)) {
    				attr_dev(input5, "id", input5_id_value);
    			}

    			if (dirty[0] & /*module*/ 16) {
    				input5.checked = input5.__value === /*module*/ ctx[4].state.shape;
    			}

    			if (!current || dirty[0] & /*module*/ 16 && label7_for_value !== (label7_for_value = 'square' + /*module*/ ctx[4].state.id)) {
    				attr_dev(label7, "for", label7_for_value);
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 272 && div7_style_value !== (div7_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[4].state.type])) {
    				attr_dev(div7, "style", div7_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			transition_in(helpbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			transition_out(helpbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_component(helpbutton);
    			if_block0.d();
    			if_block1.d();
    			/*main_binding*/ ctx[55](null);
    			binding_group.r();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$9.name,
    		type: "if",
    		source: "(328:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    // (343:16) {:else}
    function create_else_block_1$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$2.name,
    		type: "else",
    		source: "(343:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (341:16) {#if module.state.cvId != null && $modules[module.state.cvId]}
    function create_if_block_2$2(ctx) {
    	let t0_value = /*module*/ ctx[4].state.cvId + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[7][/*module*/ ctx[4].state.cvId].state.title + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*module*/ 16 && t0_value !== (t0_value = /*module*/ ctx[4].state.cvId + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, module*/ 144 && t2_value !== (t2_value = /*$modules*/ ctx[7][/*module*/ ctx[4].state.cvId].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(341:16) {#if module.state.cvId != null && $modules[module.state.cvId]}",
    		ctx
    	});

    	return block;
    }

    // (354:16) {:else}
    function create_else_block$5(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$5.name,
    		type: "else",
    		source: "(354:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (352:16) {#if module.state.cvId2 != null && $modules[module.state.cvId2]}
    function create_if_block_1$4(ctx) {
    	let t0_value = /*module*/ ctx[4].state.cvId2 + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[7][/*module*/ ctx[4].state.cvId2].state.title + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*module*/ 16 && t0_value !== (t0_value = /*module*/ ctx[4].state.cvId2 + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, module*/ 144 && t2_value !== (t2_value = /*$modules*/ ctx[7][/*module*/ ctx[4].state.cvId2].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(352:16) {#if module.state.cvId2 != null && $modules[module.state.cvId2]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[4].destroyed && create_if_block$9(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[4].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 16) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$9(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let $selectingModule;
    	let $modules;
    	let $colours;
    	let $opacity;
    	let $context;
    	let $isTyping;
    	let $output;
    	let $midi;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(6, $selectingModule = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(7, $modules = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(8, $colours = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(32, $context = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(61, $isTyping = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(62, $output = $$value));
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(33, $midi = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCO', slots, []);

    	let { state = {
    		type: 'vco',
    		frequency: 0,
    		detune: 0,
    		shape: 'sine',
    		id: createNewId(),
    		title: 'Oscillator',
    		cvId: null,
    		cvId2: null
    	} } = $$props;

    	if (state.cvId2 == undefined) state.cvId2 = null;
    	if (state.detune == undefined) state.detune = 0;
    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let titleNode;
    	let freqCvBtn;
    	let detuneCvBtn;
    	let helpBtn;
    	let notHelpDiv;
    	let helpDiv;
    	let nodeSize = { x: 320, y: 420 };
    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = true;
    	module.isControl = false;
    	module.showingHelp = false;
    	if (!module.state.position) module.state.position = setPosition();
    	module.selectingCv = false;
    	let freqCvModule;
    	let detuneCvModule;
    	let voct = Math.log2(440);
    	let oscNode = $context.createOscillator();
    	module.output = oscNode;
    	module.cv = oscNode.frequency;
    	module.cv2 = oscNode.detune;
    	let totalFrequency;
    	oscNode.start(0);
    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		if (titleNode) titleNode.style.outline = "none";
    	});

    	function setModule(node) {
    		$$invalidate(1, moduleNode = node);

    		moduleNode.addEventListener("mousedown", () => {
    			moduleIsClicked = true;
    		});

    		moduleNode.addEventListener("mouseup", () => {
    			if (moduleIsClicked) {
    				if ($selectingModule == "output") {
    					$output.select(module.state.id);
    				} else if ($selectingModule != null && $modules[$selectingModule].selectingInput && $selectingModule != module.state.id && ($modules[$selectingModule].state.type != "mixer" || (!$modules[$selectingModule].state.inputIds.includes(module.state.id) || $modules[$selectingModule].state.inputIds[$modules[$selectingModule].inputSelecting] == module.state.id))) {
    					$modules[$selectingModule].select(module.state.id);
    				} else if ($selectingModule == module.state.id) {
    					module.select(null);
    				}
    			}
    		});
    	}

    	function setControls(node) {
    		$$invalidate(2, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(3, deleteNode = node);
    	}

    	function setHelpBtn(node) {
    		$$invalidate(9, helpBtn = node);
    	}

    	function setTitleNode(node) {
    		titleNode = node;

    		titleNode.addEventListener("mouseenter", () => {
    			titleNode.style.outline = "2px solid #222222";
    		});

    		titleNode.addEventListener("mouseleave", () => {
    			if (!moduleTyping) titleNode.style.outline = "none";
    		});

    		titleNode.addEventListener("mousedown", () => {
    			setTimeout(
    				() => {
    					set_store_value(isTyping, $isTyping = true, $isTyping);
    					moduleTyping = true;
    					titleNode.style.outline = "2px solid #222222";
    				},
    				10
    			);
    		});
    	}

    	function setFreqCvBtn(node) {
    		$$invalidate(23, freqCvBtn = node);

    		freqCvBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(23, freqCvBtn.style.opacity = 0.8, freqCvBtn);
    		});

    		freqCvBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(23, freqCvBtn.style.opacity = 1, freqCvBtn);
    		});
    	}

    	function setDetuneCvBtn(node) {
    		$$invalidate(24, detuneCvBtn = node);

    		detuneCvBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(24, detuneCvBtn.style.opacity = 0.8, detuneCvBtn);
    		});

    		detuneCvBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(24, detuneCvBtn.style.opacity = 1, detuneCvBtn);
    		});
    	}

    	function setHelpDiv(node) {
    		helpDiv = node;
    		helpDiv.style.display = "none";
    	}

    	function setNotHelpDiv(node) {
    		notHelpDiv = node;
    	}

    	var currentFreqCvModule;
    	let currentDetuneCvModule;

    	module.clearCurrents = () => {
    		$$invalidate(25, freqCvModule = null);
    		$$invalidate(29, currentFreqCvModule = null);
    		$$invalidate(26, detuneCvModule = null);
    		$$invalidate(30, currentDetuneCvModule = null);
    	};

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(31, $opacity = value));
    	let bobSize = spring(0, { stiffness: 0.3, damping: 0.2 });

    	module.fade = () => {
    		opacity.set(0.2);
    	};

    	module.bob = () => {
    		bobSize.set(10);

    		setTimeout(
    			() => {
    				bobSize.set(0);
    			},
    			50
    		);
    	};

    	module.halfFade = () => {
    		opacity.set(0.8);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	module.toggleHelp = () => {
    		$$invalidate(4, module.showingHelp = !module.showingHelp, module);

    		if (notHelpDiv) {
    			if (!module.showingHelp) {
    				notHelpDiv.style.display = "initial";
    			} else {
    				notHelpDiv.style.display = "none";
    			}
    		}

    		if (helpDiv) {
    			if (module.showingHelp) {
    				helpDiv.style.display = "initial";
    			} else {
    				helpDiv.style.display = "none";
    			}
    		}

    		if (module.showingHelp) {
    			$$invalidate(10, nodeSize = { x: 320, y: 550 });
    		} else {
    			$$invalidate(10, nodeSize = { x: 320, y: 420 });
    		}
    	};

    	module.cvSelecting = null;

    	function chooseCv(i) {
    		$$invalidate(4, module.cvSelecting = i, module);
    		cvsAllHover(module, i);
    		if (!freqCvBtn) return;

    		if (!module.selectingCv) {
    			$$invalidate(4, module.selectingCv = true, module);

    			if (module.cvSelecting == 0) {
    				$$invalidate(23, freqCvBtn.style.opacity = 0.5, freqCvBtn);
    			} else {
    				$$invalidate(24, detuneCvBtn.style.opacity = 0.5, detuneCvBtn);
    			}

    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(4, module.selectingCv = false, module);
    		}
    	}

    	module.select = id => {
    		if (module.selectingCv) {
    			if (module.cvSelecting == 0) {
    				$$invalidate(4, module.state.cvId = id, module);
    				$$invalidate(23, freqCvBtn.style.opacity = 1, freqCvBtn);
    			} else {
    				$$invalidate(4, module.state.cvId2 = id, module);
    				$$invalidate(24, detuneCvBtn.style.opacity = 1, detuneCvBtn);
    			}

    			$$invalidate(4, module.selectingCv = false, module);
    		}

    		set_store_value(selectingModule, $selectingModule = null, $selectingModule);
    		unhover();
    	};

    	module.bob();
    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCO> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(1, moduleNode), $$invalidate(31, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(2, controlsNode), $$invalidate(3, deleteNode)), $$invalidate(6, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(3, deleteNode), $$invalidate(2, controlsNode)), $$invalidate(6, $selectingModule));
    	}

    	function modulemovement_helpBtn_binding(value) {
    		helpBtn = value;
    		$$invalidate(9, helpBtn);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_nodeSize_binding(value) {
    		nodeSize = value;
    		$$invalidate(10, nodeSize);
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(11, bobSize);
    	}

    	function h2_input_handler() {
    		$modules[module.state.id].state.title = this.textContent;
    		modules.set($modules);
    	}

    	const click_handler = () => chooseCv(0);

    	const mouseenter_handler = () => {
    		cvsAllHover(module, 0);
    	};

    	const mouseleave_handler = () => {
    		if ($selectingModule == null) unhover();
    	};

    	function input0_change_input_handler() {
    		module.state.frequency = to_number(this.value);
    		$$invalidate(4, module);
    	}

    	const click_handler_1 = () => chooseCv(1);

    	const mouseenter_handler_1 = () => {
    		cvsAllHover(module, 1);
    	};

    	const mouseleave_handler_1 = () => {
    		if ($selectingModule == null) unhover();
    	};

    	function input1_change_input_handler() {
    		module.state.detune = to_number(this.value);
    		$$invalidate(4, module);
    	}

    	function input2_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(4, module);
    	}

    	function input3_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(4, module);
    	}

    	function input4_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(4, module);
    	}

    	function input5_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(4, module);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(4, module);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		midi,
    		colours,
    		selectingModule,
    		output,
    		isTyping,
    		ModuleMovement,
    		DeleteButton,
    		HelpButton,
    		createNewId,
    		setPosition,
    		cvsAllHover,
    		unhover,
    		spring,
    		state,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		titleNode,
    		freqCvBtn,
    		detuneCvBtn,
    		helpBtn,
    		notHelpDiv,
    		helpDiv,
    		nodeSize,
    		module,
    		freqCvModule,
    		detuneCvModule,
    		voct,
    		oscNode,
    		totalFrequency,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setHelpBtn,
    		setTitleNode,
    		setFreqCvBtn,
    		setDetuneCvBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		currentFreqCvModule,
    		currentDetuneCvModule,
    		opacity,
    		bobSize,
    		chooseCv,
    		$selectingModule,
    		$modules,
    		$colours,
    		$opacity,
    		$context,
    		$isTyping,
    		$output,
    		$midi
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(1, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(2, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(3, deleteNode = $$props.deleteNode);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('freqCvBtn' in $$props) $$invalidate(23, freqCvBtn = $$props.freqCvBtn);
    		if ('detuneCvBtn' in $$props) $$invalidate(24, detuneCvBtn = $$props.detuneCvBtn);
    		if ('helpBtn' in $$props) $$invalidate(9, helpBtn = $$props.helpBtn);
    		if ('notHelpDiv' in $$props) notHelpDiv = $$props.notHelpDiv;
    		if ('helpDiv' in $$props) helpDiv = $$props.helpDiv;
    		if ('nodeSize' in $$props) $$invalidate(10, nodeSize = $$props.nodeSize);
    		if ('freqCvModule' in $$props) $$invalidate(25, freqCvModule = $$props.freqCvModule);
    		if ('detuneCvModule' in $$props) $$invalidate(26, detuneCvModule = $$props.detuneCvModule);
    		if ('voct' in $$props) $$invalidate(27, voct = $$props.voct);
    		if ('oscNode' in $$props) $$invalidate(28, oscNode = $$props.oscNode);
    		if ('totalFrequency' in $$props) $$invalidate(5, totalFrequency = $$props.totalFrequency);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('currentFreqCvModule' in $$props) $$invalidate(29, currentFreqCvModule = $$props.currentFreqCvModule);
    		if ('currentDetuneCvModule' in $$props) $$invalidate(30, currentDetuneCvModule = $$props.currentDetuneCvModule);
    		if ('opacity' in $$props) $$invalidate(21, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(11, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $modules*/ 144) {
    			if (module.state.cvId != null) {
    				$$invalidate(25, freqCvModule = $modules[module.state.cvId]);
    			} else {
    				$$invalidate(25, freqCvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, $modules*/ 144) {
    			if (module.state.cvId2 != null) {
    				$$invalidate(26, detuneCvModule = $modules[module.state.cvId2]);
    			} else {
    				$$invalidate(26, detuneCvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[1] & /*$midi*/ 4) {
    			if ($midi.voct) $$invalidate(27, voct = $midi.voct);
    		}

    		if ($$self.$$.dirty[0] & /*voct, module*/ 134217744) {
    			$$invalidate(5, totalFrequency = Math.pow(2, voct + module.state.frequency));
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 16) {
    			$$invalidate(28, oscNode.type = module.state.shape, oscNode);
    		}

    		if ($$self.$$.dirty[0] & /*oscNode, totalFrequency*/ 268435488 | $$self.$$.dirty[1] & /*$context*/ 2) {
    			oscNode.frequency.linearRampToValueAtTime(totalFrequency, $context.currentTime + 0.03);
    		}

    		if ($$self.$$.dirty[0] & /*oscNode, module*/ 268435472 | $$self.$$.dirty[1] & /*$context*/ 2) {
    			oscNode.detune.linearRampToValueAtTime(module.state.detune, $context.currentTime + 0.03);
    		}

    		if ($$self.$$.dirty[0] & /*module, freqCvModule, oscNode, currentFreqCvModule, totalFrequency*/ 838860848 | $$self.$$.dirty[1] & /*$context*/ 2) {
    			if (!module.destroyed) {
    				if (freqCvModule) {
    					oscNode.frequency.cancelScheduledValues($context.currentTime);
    					oscNode.frequency.linearRampToValueAtTime(0, $context.currentTime);

    					if (currentFreqCvModule) {
    						if (currentFreqCvModule.outputs[module.state.id + ".1"]) ;
    						currentFreqCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(29, currentFreqCvModule = freqCvModule);
    					if (!currentFreqCvModule.outputs[module.state.id + ".1"]) currentFreqCvModule.addOutput(module.state.id + ".1", module.cv);
    				} else {
    					oscNode.frequency.cancelScheduledValues($context.currentTime);
    					oscNode.frequency.linearRampToValueAtTime(totalFrequency, $context.currentTime);

    					if (currentFreqCvModule) {
    						if (currentFreqCvModule.outputs[module.state.id + ".1"]) currentFreqCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(29, currentFreqCvModule = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*currentFreqCvModule, module, totalFrequency*/ 536870960) {
    			if (currentFreqCvModule) {
    				currentFreqCvModule.setGain(module.state.id + ".1", totalFrequency);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, detuneCvModule, oscNode, currentDetuneCvModule*/ 1409286160 | $$self.$$.dirty[1] & /*$context*/ 2) {
    			if (!module.destroyed) {
    				if (detuneCvModule) {
    					oscNode.detune.cancelScheduledValues($context.currentTime);
    					oscNode.detune.linearRampToValueAtTime(0, $context.currentTime + 0.01);

    					if (currentDetuneCvModule) {
    						if (currentDetuneCvModule.outputs[module.state.id + ".2"]) ;
    						currentDetuneCvModule.removeOutput(module.state.id + ".2", module.cv2);
    					}

    					$$invalidate(30, currentDetuneCvModule = detuneCvModule);
    					if (!currentDetuneCvModule.outputs[module.state.id + ".2"]) currentDetuneCvModule.addOutput(module.state.id + ".2", module.cv2);
    				} else {
    					oscNode.detune.cancelScheduledValues($context.currentTime);
    					oscNode.detune.linearRampToValueAtTime(module.state.detune, $context.currentTime + 0.01);

    					if (currentDetuneCvModule) {
    						if (currentDetuneCvModule.outputs[module.state.id + ".2"]) currentDetuneCvModule.removeOutput(module.state.id + ".2", module.cv2);
    					}

    					$$invalidate(30, currentDetuneCvModule = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*currentDetuneCvModule, module*/ 1073741840) {
    			if (currentDetuneCvModule) {
    				currentDetuneCvModule.setGain(module.state.id + ".2", module.state.detune);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode*/ 2 | $$self.$$.dirty[1] & /*$opacity*/ 1) {
    			if (moduleNode) $$invalidate(1, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module, freqCvBtn, $colours, $modules, detuneCvBtn*/ 25166224) {
    			if (!module.destroyed) {
    				if (freqCvBtn) {
    					if (module.state.cvId != null) {
    						$$invalidate(23, freqCvBtn.style.backgroundColor = $colours[$modules[module.state.cvId].state.type], freqCvBtn);
    					} else {
    						$$invalidate(23, freqCvBtn.style.backgroundColor = "#f0f0f0", freqCvBtn);
    					}
    				}

    				if (detuneCvBtn) {
    					if (module.state.cvId2 != null) {
    						$$invalidate(24, detuneCvBtn.style.backgroundColor = $colours[$modules[module.state.cvId2].state.type], detuneCvBtn);
    					} else {
    						$$invalidate(24, detuneCvBtn.style.backgroundColor = "#f0f0f0", detuneCvBtn);
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 76) {
    			if (controlsNode && deleteNode) {
    				if ($selectingModule != null) {
    					$$invalidate(2, controlsNode.style.pointerEvents = "none", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "none", deleteNode);
    				} else {
    					$$invalidate(2, controlsNode.style.pointerEvents = "all", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "all", deleteNode);
    				}
    			}
    		}
    	};

    	return [
    		state,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		module,
    		totalFrequency,
    		$selectingModule,
    		$modules,
    		$colours,
    		helpBtn,
    		nodeSize,
    		bobSize,
    		setModule,
    		setControls,
    		setDelete,
    		setHelpBtn,
    		setTitleNode,
    		setFreqCvBtn,
    		setDetuneCvBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		opacity,
    		chooseCv,
    		freqCvBtn,
    		detuneCvBtn,
    		freqCvModule,
    		detuneCvModule,
    		voct,
    		oscNode,
    		currentFreqCvModule,
    		currentDetuneCvModule,
    		$opacity,
    		$context,
    		$midi,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_helpBtn_binding,
    		modulemovement_nodePos_binding,
    		modulemovement_nodeSize_binding,
    		modulemovement_bobSize_binding,
    		h2_input_handler,
    		click_handler,
    		mouseenter_handler,
    		mouseleave_handler,
    		input0_change_input_handler,
    		click_handler_1,
    		mouseenter_handler_1,
    		mouseleave_handler_1,
    		input1_change_input_handler,
    		input2_change_handler,
    		$$binding_groups,
    		input3_change_handler,
    		input4_change_handler,
    		input5_change_handler,
    		main_binding
    	];
    }

    class VCO extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, { state: 0 }, null, [-1, -1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCO",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get state() {
    		throw new Error("<VCO>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<VCO>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\modules\VCA.svelte generated by Svelte v3.59.2 */
    const file$8 = "src\\modules\\VCA.svelte";

    // (295:0) {#if !module.destroyed}
    function create_if_block$8(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_helpBtn;
    	let updating_nodeSize;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div7;
    	let div0;
    	let deletebutton;
    	let t1;
    	let div1;
    	let helpbutton;
    	let t2;
    	let h1;
    	let t3_value = /*module*/ ctx[1].state.id + "";
    	let t3;
    	let t4;
    	let div5;
    	let h2;
    	let t5_value = /*module*/ ctx[1].state.title + "";
    	let t5;
    	let t6;
    	let div4;
    	let div2;
    	let label0;
    	let button0;
    	let t7;
    	let t8;
    	let div3;
    	let label1;
    	let button1;
    	let t9;
    	let br0;
    	let t10;
    	let label2;
    	let t11;
    	let t12_value = /*module*/ ctx[1].state.gain.toFixed(2) + "";
    	let t12;
    	let t13;
    	let input;
    	let t14;
    	let div6;
    	let p;
    	let t15;
    	let br1;
    	let br2;
    	let t16;
    	let br3;
    	let br4;
    	let t17;
    	let br5;
    	let br6;
    	let t18;
    	let div7_style_value;
    	let t19;
    	let br7;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[30](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[31](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[32](value);
    	}

    	function modulemovement_helpBtn_binding(value) {
    		/*modulemovement_helpBtn_binding*/ ctx[33](value);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		/*modulemovement_nodeSize_binding*/ ctx[34](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[35](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[36](value);
    	}

    	let modulemovement_props = {};

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*deleteNode*/ ctx[4] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[4];
    	}

    	if (/*helpBtn*/ ctx[8] !== void 0) {
    		modulemovement_props.helpBtn = /*helpBtn*/ ctx[8];
    	}

    	if (/*nodeSize*/ ctx[9] !== void 0) {
    		modulemovement_props.nodeSize = /*nodeSize*/ ctx[9];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	if (/*bobSize*/ ctx[10] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[10];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'helpBtn', modulemovement_helpBtn_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodeSize', modulemovement_nodeSize_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	helpbutton = new HelpButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*module*/ ctx[1].state.inputId != null && /*$modules*/ ctx[6][/*module*/ ctx[1].state.inputId]) return create_if_block_2$1;
    		return create_else_block_1$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*module*/ ctx[1].state.cvId != null && /*$modules*/ ctx[6][/*module*/ ctx[1].state.cvId]) return create_if_block_1$3;
    		return create_else_block$4;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div7 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(helpbutton.$$.fragment);
    			t2 = space();
    			h1 = element("h1");
    			t3 = text(t3_value);
    			t4 = space();
    			div5 = element("div");
    			h2 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			div4 = element("div");
    			div2 = element("div");
    			label0 = element("label");
    			button0 = element("button");
    			if_block0.c();
    			t7 = text(" Input");
    			t8 = space();
    			div3 = element("div");
    			label1 = element("label");
    			button1 = element("button");
    			if_block1.c();
    			t9 = text(" Control");
    			br0 = element("br");
    			t10 = space();
    			label2 = element("label");
    			t11 = text("Volume (");
    			t12 = text(t12_value);
    			t13 = text(")");
    			input = element("input");
    			t14 = space();
    			div6 = element("div");
    			p = element("p");
    			t15 = text("Changes the volume of the input signal.");
    			br1 = element("br");
    			br2 = element("br");
    			t16 = text("\r\n            Volume control can be automated using the Control selector.");
    			br3 = element("br");
    			br4 = element("br");
    			t17 = text("\r\n            Selecting an Envelope causes the volume to rise and fall when a key is pressed.");
    			br5 = element("br");
    			br6 = element("br");
    			t18 = text("\r\n            Selecting an LFO causes a tremolo effect.");
    			t19 = space();
    			br7 = element("br");
    			attr_dev(div0, "class", "delete svelte-1yeu6yr");
    			add_location(div0, file$8, 298, 4, 9961);
    			attr_dev(div1, "class", "help svelte-1yeu6yr");
    			add_location(div1, file$8, 299, 4, 10039);
    			add_location(h1, file$8, 300, 4, 10114);
    			attr_dev(h2, "class", "editableTitle svelte-1yeu6yr");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[6][/*module*/ ctx[1].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[37].call(h2));
    			add_location(h2, file$8, 302, 8, 10191);
    			attr_dev(button0, "class", "svelte-1yeu6yr");
    			add_location(button0, file$8, 306, 15, 10541);
    			add_location(label0, file$8, 306, 8, 10534);
    			attr_dev(div2, "class", "inputDiv");
    			add_location(div2, file$8, 305, 8, 10392);
    			attr_dev(button1, "class", "svelte-1yeu6yr");
    			add_location(button1, file$8, 315, 15, 11016);
    			add_location(label1, file$8, 315, 8, 11009);
    			attr_dev(div3, "class", "inputDiv");
    			add_location(div3, file$8, 314, 8, 10868);
    			add_location(br0, file$8, 321, 39, 11315);
    			attr_dev(label2, "for", "gain");
    			add_location(label2, file$8, 322, 8, 11329);
    			attr_dev(input, "id", "gain");
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$8, 322, 73, 11394);
    			add_location(div4, file$8, 304, 8, 10359);
    			attr_dev(div5, "id", "controls");
    			add_location(div5, file$8, 301, 4, 10146);
    			add_location(br1, file$8, 326, 50, 11590);
    			add_location(br2, file$8, 326, 54, 11594);
    			add_location(br3, file$8, 327, 71, 11671);
    			add_location(br4, file$8, 327, 75, 11675);
    			add_location(br5, file$8, 328, 91, 11772);
    			add_location(br6, file$8, 328, 95, 11776);
    			attr_dev(p, "class", "svelte-1yeu6yr");
    			add_location(p, file$8, 326, 8, 11548);
    			add_location(div6, file$8, 325, 4, 11518);
    			attr_dev(div7, "id", "module");
    			attr_dev(div7, "style", div7_style_value = "background-color: " + /*$colours*/ ctx[7][/*module*/ ctx[1].state.type]);
    			attr_dev(div7, "class", "svelte-1yeu6yr");
    			add_location(div7, file$8, 297, 0, 9865);
    			add_location(br7, file$8, 333, 0, 11871);
    			add_location(main, file$8, 295, 0, 9688);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div7);
    			append_dev(div7, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div7, t1);
    			append_dev(div7, div1);
    			mount_component(helpbutton, div1, null);
    			append_dev(div7, t2);
    			append_dev(div7, h1);
    			append_dev(h1, t3);
    			append_dev(div7, t4);
    			append_dev(div7, div5);
    			append_dev(div5, h2);
    			append_dev(h2, t5);

    			if (/*$modules*/ ctx[6][/*module*/ ctx[1].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[6][/*module*/ ctx[1].state.id].state.title;
    			}

    			append_dev(div5, t6);
    			append_dev(div5, div4);
    			append_dev(div4, div2);
    			append_dev(div2, label0);
    			append_dev(label0, button0);
    			if_block0.m(button0, null);
    			append_dev(label0, t7);
    			append_dev(div4, t8);
    			append_dev(div4, div3);
    			append_dev(div3, label1);
    			append_dev(label1, button1);
    			if_block1.m(button1, null);
    			append_dev(label1, t9);
    			append_dev(div4, br0);
    			append_dev(div4, t10);
    			append_dev(div4, label2);
    			append_dev(label2, t11);
    			append_dev(label2, t12);
    			append_dev(label2, t13);
    			append_dev(div4, input);
    			set_input_value(input, /*module*/ ctx[1].state.gain);
    			append_dev(div7, t14);
    			append_dev(div7, div6);
    			append_dev(div6, p);
    			append_dev(p, t15);
    			append_dev(p, br1);
    			append_dev(p, br2);
    			append_dev(p, t16);
    			append_dev(p, br3);
    			append_dev(p, br4);
    			append_dev(p, t17);
    			append_dev(p, br5);
    			append_dev(p, br6);
    			append_dev(p, t18);
    			append_dev(main, t19);
    			append_dev(main, br7);
    			/*main_binding*/ ctx[43](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[13].call(null, div0)),
    					action_destroyer(/*setHelpBtn*/ ctx[17].call(null, div1)),
    					action_destroyer(/*setTitleNode*/ ctx[16].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[37]),
    					action_destroyer(/*setInputBtn*/ ctx[14].call(null, button0)),
    					listen_dev(button0, "click", /*chooseInput*/ ctx[21], false, false, false, false),
    					listen_dev(div2, "mouseenter", /*mouseenter_handler*/ ctx[38], false, false, false, false),
    					listen_dev(div2, "mouseleave", /*mouseleave_handler*/ ctx[39], false, false, false, false),
    					action_destroyer(/*setCvBtn*/ ctx[15].call(null, button1)),
    					listen_dev(button1, "click", /*chooseCv*/ ctx[22], false, false, false, false),
    					listen_dev(div3, "mouseenter", /*mouseenter_handler_1*/ ctx[40], false, false, false, false),
    					listen_dev(div3, "mouseleave", /*mouseleave_handler_1*/ ctx[41], false, false, false, false),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[42]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[42]),
    					action_destroyer(/*setNotHelpDiv*/ ctx[18].call(null, div4)),
    					action_destroyer(/*setControls*/ ctx[12].call(null, div5)),
    					action_destroyer(/*setHelpDiv*/ ctx[19].call(null, div6)),
    					action_destroyer(/*setModule*/ ctx[11].call(null, div7))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 4) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[2];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 8) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[3];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 16) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[4];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_helpBtn && dirty[0] & /*helpBtn*/ 256) {
    				updating_helpBtn = true;
    				modulemovement_changes.helpBtn = /*helpBtn*/ ctx[8];
    				add_flush_callback(() => updating_helpBtn = false);
    			}

    			if (!updating_nodeSize && dirty[0] & /*nodeSize*/ 512) {
    				updating_nodeSize = true;
    				modulemovement_changes.nodeSize = /*nodeSize*/ ctx[9];
    				add_flush_callback(() => updating_nodeSize = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 1024) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[10];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			const helpbutton_changes = {};
    			if (dirty[0] & /*module*/ 2) helpbutton_changes.module = /*module*/ ctx[1];
    			helpbutton.$set(helpbutton_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t3_value !== (t3_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty[0] & /*module*/ 2) && t5_value !== (t5_value = /*module*/ ctx[1].state.title + "")) set_data_contenteditable_dev(t5, t5_value);

    			if (dirty[0] & /*$modules, module*/ 66 && /*$modules*/ ctx[6][/*module*/ ctx[1].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[6][/*module*/ ctx[1].state.id].state.title;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(button0, null);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(button1, null);
    				}
    			}

    			if ((!current || dirty[0] & /*module*/ 2) && t12_value !== (t12_value = /*module*/ ctx[1].state.gain.toFixed(2) + "")) set_data_dev(t12, t12_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input, /*module*/ ctx[1].state.gain);
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 130 && div7_style_value !== (div7_style_value = "background-color: " + /*$colours*/ ctx[7][/*module*/ ctx[1].state.type])) {
    				attr_dev(div7, "style", div7_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			transition_in(helpbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			transition_out(helpbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_component(helpbutton);
    			if_block0.d();
    			if_block1.d();
    			/*main_binding*/ ctx[43](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(295:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    // (310:12) {:else}
    function create_else_block_1$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(310:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (308:12) {#if module.state.inputId != null && $modules[module.state.inputId]}
    function create_if_block_2$1(ctx) {
    	let t0_value = /*module*/ ctx[1].state.inputId + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[6][/*module*/ ctx[1].state.inputId].state.title + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*module*/ 2 && t0_value !== (t0_value = /*module*/ ctx[1].state.inputId + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, module*/ 66 && t2_value !== (t2_value = /*$modules*/ ctx[6][/*module*/ ctx[1].state.inputId].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(308:12) {#if module.state.inputId != null && $modules[module.state.inputId]}",
    		ctx
    	});

    	return block;
    }

    // (319:12) {:else}
    function create_else_block$4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(319:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (317:12) {#if module.state.cvId != null && $modules[module.state.cvId]}
    function create_if_block_1$3(ctx) {
    	let t0_value = /*module*/ ctx[1].state.cvId + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[6][/*module*/ ctx[1].state.cvId].state.title + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*module*/ 2 && t0_value !== (t0_value = /*module*/ ctx[1].state.cvId + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, module*/ 66 && t2_value !== (t2_value = /*$modules*/ ctx[6][/*module*/ ctx[1].state.cvId].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(317:12) {#if module.state.cvId != null && $modules[module.state.cvId]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[1].destroyed && create_if_block$8(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[1].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$8(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $selectingModule;
    	let $modules;
    	let $colours;
    	let $opacity;
    	let $isTyping;
    	let $output;
    	let $context;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(5, $selectingModule = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(6, $modules = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(7, $colours = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(49, $isTyping = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(50, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(29, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCA', slots, []);

    	let { state = {
    		type: 'vca',
    		gain: 1,
    		id: createNewId(),
    		inputId: null,
    		cvId: null,
    		title: 'Amplifier'
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = true;
    	module.isControl = false;
    	if (!module.state.position) module.state.position = setPosition();
    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let inputBtn;
    	let cvBtn;
    	let titleNode;
    	let helpBtn;
    	let notHelpDiv;
    	let helpDiv;
    	let nodeSize = { x: 280, y: 310 };
    	module.selectingInput = false;
    	module.selectingCv = false;
    	let cvModule;
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	module.cv = gainNode.gain;
    	var currentInput;
    	var currentCvModule;

    	module.clearCurrents = () => {
    		$$invalidate(26, currentInput = null);
    		$$invalidate(25, cvModule = null);
    		$$invalidate(27, currentCvModule = null);
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		if (titleNode) titleNode.style.outline = "none";
    	});

    	function setModule(node) {
    		$$invalidate(2, moduleNode = node);

    		moduleNode.addEventListener("mousedown", () => {
    			moduleIsClicked = true;
    		});

    		moduleNode.addEventListener("mouseup", () => {
    			if (moduleIsClicked) {
    				if ($selectingModule == "output") {
    					$output.select(module.state.id);
    				} else if ($selectingModule != null && $modules[$selectingModule].selectingInput && $selectingModule != module.state.id && ($modules[$selectingModule].state.type != "mixer" || (!$modules[$selectingModule].state.inputIds.includes(module.state.id) || $modules[$selectingModule].state.inputIds[$modules[$selectingModule].inputSelecting] == module.state.id))) {
    					$modules[$selectingModule].select(module.state.id);
    				} else if ($selectingModule == module.state.id) {
    					module.select(null);
    				}
    			}
    		});
    	}

    	function setControls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(4, deleteNode = node);
    	}

    	function setInputBtn(node) {
    		$$invalidate(23, inputBtn = node);

    		inputBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(23, inputBtn.style.opacity = 0.8, inputBtn);
    		});

    		inputBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(23, inputBtn.style.opacity = 1, inputBtn);
    		});
    	}

    	function setCvBtn(node) {
    		$$invalidate(24, cvBtn = node);

    		cvBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(24, cvBtn.style.opacity = 0.8, cvBtn);
    		});

    		cvBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(24, cvBtn.style.opacity = 1, cvBtn);
    		});
    	}

    	function setTitleNode(node) {
    		titleNode = node;

    		titleNode.addEventListener("mouseenter", () => {
    			titleNode.style.outline = "2px solid #222222";
    		});

    		titleNode.addEventListener("mouseleave", () => {
    			if (!moduleTyping) titleNode.style.outline = "none";
    		});

    		titleNode.addEventListener("mousedown", () => {
    			setTimeout(
    				() => {
    					set_store_value(isTyping, $isTyping = true, $isTyping);
    					moduleTyping = true;
    					titleNode.style.outline = "2px solid #222222";
    				},
    				10
    			);
    		});
    	}

    	function setHelpBtn(node) {
    		$$invalidate(8, helpBtn = node);
    	}

    	function setNotHelpDiv(node) {
    		notHelpDiv = node;
    	}

    	function setHelpDiv(node) {
    		helpDiv = node;
    		helpDiv.style.display = "none";
    	}

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(28, $opacity = value));
    	let bobSize = spring(0, { stiffness: 0.3, damping: 0.2 });

    	module.fade = () => {
    		opacity.set(0.2);
    	};

    	module.halfFade = () => {
    		opacity.set(0.8);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	module.bob = () => {
    		bobSize.set(10);

    		setTimeout(
    			() => {
    				bobSize.set(0);
    			},
    			50
    		);
    	};

    	module.toggleHelp = () => {
    		$$invalidate(1, module.showingHelp = !module.showingHelp, module);

    		if (notHelpDiv) {
    			if (!module.showingHelp) {
    				notHelpDiv.style.display = "initial";
    			} else {
    				notHelpDiv.style.display = "none";
    			}
    		}

    		if (helpDiv) {
    			if (module.showingHelp) {
    				helpDiv.style.display = "initial";
    			} else {
    				helpDiv.style.display = "none";
    			}
    		}

    		if (module.showingHelp) {
    			$$invalidate(9, nodeSize = { x: 280, y: 420 });
    		} else {
    			$$invalidate(9, nodeSize = { x: 280, y: 310 });
    		}
    	};

    	function chooseInput() {
    		inputsAllHover(module);
    		if (!inputBtn) return;

    		if (!module.selectingInput) {
    			$$invalidate(1, module.selectingInput = true, module);
    			$$invalidate(23, inputBtn.style.opacity = 0.5, inputBtn);
    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(1, module.selectingInput = false, module);
    		}
    	}

    	function chooseCv() {
    		cvsAllHover(module);
    		if (!cvBtn) return;

    		if (!module.selectingCv) {
    			$$invalidate(1, module.selectingCv = true, module);
    			$$invalidate(24, cvBtn.style.opacity = 0.5, cvBtn);
    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(1, module.selectingCv = false, module);
    		}
    	}

    	module.select = id => {
    		if (module.selectingInput) {
    			$$invalidate(1, module.state.inputId = id, module);
    			$$invalidate(23, inputBtn.style.opacity = 1, inputBtn);
    			$$invalidate(1, module.selectingInput = false, module);
    		} else if (module.selectingCv) {
    			$$invalidate(1, module.state.cvId = id, module);
    			$$invalidate(24, cvBtn.style.opacity = 1, cvBtn);
    			$$invalidate(1, module.selectingCv = false, module);
    		}

    		set_store_value(selectingModule, $selectingModule = null, $selectingModule);
    		unhover();
    	};

    	module.bob();
    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCA> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(28, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(3, controlsNode), $$invalidate(4, deleteNode)), $$invalidate(5, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(4, deleteNode), $$invalidate(3, controlsNode)), $$invalidate(5, $selectingModule));
    	}

    	function modulemovement_helpBtn_binding(value) {
    		helpBtn = value;
    		$$invalidate(8, helpBtn);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		nodeSize = value;
    		$$invalidate(9, nodeSize);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(10, bobSize);
    	}

    	function h2_input_handler() {
    		$modules[module.state.id].state.title = this.textContent;
    		modules.set($modules);
    	}

    	const mouseenter_handler = () => inputsAllHover(module);

    	const mouseleave_handler = () => {
    		if ($selectingModule == null) unhover();
    	};

    	const mouseenter_handler_1 = () => {
    		cvsAllHover(module);
    	};

    	const mouseleave_handler_1 = () => {
    		if ($selectingModule == null) unhover();
    	};

    	function input_change_input_handler() {
    		module.state.gain = to_number(this.value);
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
    		colours,
    		selectingModule,
    		output,
    		isTyping,
    		ModuleMovement,
    		DeleteButton,
    		HelpButton,
    		createNewId,
    		cvsAllHover,
    		inputsAllHover,
    		unhover,
    		setPosition,
    		spring,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		inputBtn,
    		cvBtn,
    		titleNode,
    		helpBtn,
    		notHelpDiv,
    		helpDiv,
    		nodeSize,
    		cvModule,
    		gainNode,
    		currentInput,
    		currentCvModule,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setCvBtn,
    		setTitleNode,
    		setHelpBtn,
    		setNotHelpDiv,
    		setHelpDiv,
    		opacity,
    		bobSize,
    		chooseInput,
    		chooseCv,
    		$selectingModule,
    		$modules,
    		$colours,
    		$opacity,
    		$isTyping,
    		$output,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(4, deleteNode = $$props.deleteNode);
    		if ('inputBtn' in $$props) $$invalidate(23, inputBtn = $$props.inputBtn);
    		if ('cvBtn' in $$props) $$invalidate(24, cvBtn = $$props.cvBtn);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('helpBtn' in $$props) $$invalidate(8, helpBtn = $$props.helpBtn);
    		if ('notHelpDiv' in $$props) notHelpDiv = $$props.notHelpDiv;
    		if ('helpDiv' in $$props) helpDiv = $$props.helpDiv;
    		if ('nodeSize' in $$props) $$invalidate(9, nodeSize = $$props.nodeSize);
    		if ('cvModule' in $$props) $$invalidate(25, cvModule = $$props.cvModule);
    		if ('gainNode' in $$props) $$invalidate(51, gainNode = $$props.gainNode);
    		if ('currentInput' in $$props) $$invalidate(26, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(27, currentCvModule = $$props.currentCvModule);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(20, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(10, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $modules*/ 66) {
    			if (module.state.cvId != null) {
    				$$invalidate(25, cvModule = $modules[module.state.cvId]);
    			} else {
    				$$invalidate(25, cvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, $context*/ 536870914) {
    			gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);
    		}

    		if ($$self.$$.dirty[0] & /*module, $modules, currentInput*/ 67108930) {
    			if (!module.destroyed) {
    				if (module.state.inputId != null && $modules[module.state.inputId] && $modules[module.state.inputId].output) {
    					if (currentInput) currentInput.disconnect(gainNode);
    					$$invalidate(26, currentInput = $modules[module.state.inputId].output);
    					currentInput.connect(gainNode);
    					if ($modules[module.state.inputId].input || $modules[module.state.inputId].inputs) $modules[module.state.inputId].update();
    				} else {
    					if (currentInput) currentInput.disconnect(gainNode);
    					$$invalidate(26, currentInput = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, cvModule, $context, currentCvModule*/ 704643074) {
    			if (!module.destroyed) {
    				if (cvModule) {
    					gainNode.gain.cancelScheduledValues($context.currentTime);
    					gainNode.gain.setValueAtTime(0, $context.currentTime);

    					if (currentCvModule) {
    						if (currentCvModule.outputs[module.state.id + ".1"]) ;
    						currentCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(27, currentCvModule = cvModule);
    					if (!currentCvModule.outputs[module.state.id + ".1"]) currentCvModule.addOutput(module.state.id + ".1", module.cv);
    				} else {
    					gainNode.gain.cancelScheduledValues($context.currentTime);
    					gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);

    					if (currentCvModule) {
    						if (currentCvModule.outputs[module.state.id + ".1"]) currentCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(27, currentCvModule = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*currentCvModule, module*/ 134217730) {
    			if (currentCvModule) {
    				currentCvModule.setGain(module.state.id + ".1", module.state.gain);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 268435460) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module, inputBtn, $colours, $modules, cvBtn*/ 25166018) {
    			if (!module.destroyed) {
    				if (inputBtn) {
    					if (module.state.inputId != null) {
    						$$invalidate(23, inputBtn.style.backgroundColor = $colours[$modules[module.state.inputId].state.type], inputBtn);
    					} else {
    						$$invalidate(23, inputBtn.style.backgroundColor = "#f0f0f0", inputBtn);
    					}
    				}

    				if (cvBtn) {
    					if (module.state.cvId != null) {
    						$$invalidate(24, cvBtn.style.backgroundColor = $colours[$modules[module.state.cvId].state.type], cvBtn);
    					} else {
    						$$invalidate(24, cvBtn.style.backgroundColor = "#f0f0f0", cvBtn);
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 56) {
    			if (controlsNode && deleteNode) {
    				if ($selectingModule != null) {
    					$$invalidate(3, controlsNode.style.pointerEvents = "none", controlsNode);
    					$$invalidate(4, deleteNode.style.pointerEvents = "none", deleteNode);
    				} else {
    					$$invalidate(3, controlsNode.style.pointerEvents = "all", controlsNode);
    					$$invalidate(4, deleteNode.style.pointerEvents = "all", deleteNode);
    				}
    			}
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		$selectingModule,
    		$modules,
    		$colours,
    		helpBtn,
    		nodeSize,
    		bobSize,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setCvBtn,
    		setTitleNode,
    		setHelpBtn,
    		setNotHelpDiv,
    		setHelpDiv,
    		opacity,
    		chooseInput,
    		chooseCv,
    		inputBtn,
    		cvBtn,
    		cvModule,
    		currentInput,
    		currentCvModule,
    		$opacity,
    		$context,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_helpBtn_binding,
    		modulemovement_nodeSize_binding,
    		modulemovement_nodePos_binding,
    		modulemovement_bobSize_binding,
    		h2_input_handler,
    		mouseenter_handler,
    		mouseleave_handler,
    		mouseenter_handler_1,
    		mouseleave_handler_1,
    		input_change_input_handler,
    		main_binding
    	];
    }

    class VCA extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCA",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get state() {
    		throw new Error("<VCA>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<VCA>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\modules\ADSR.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1$1 } = globals;
    const file$7 = "src\\modules\\ADSR.svelte";

    // (196:0) {#if !module.destroyed}
    function create_if_block$7(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_helpBtn;
    	let updating_nodeSize;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div6;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let div0;
    	let deletebutton;
    	let t3;
    	let div1;
    	let helpbutton;
    	let t4;
    	let div4;
    	let h2;
    	let t5_value = /*module*/ ctx[1].state.title + "";
    	let t5;
    	let t6;
    	let div3;
    	let div2;
    	let label0;
    	let t7;
    	let t8_value = /*attack*/ ctx[7].toFixed(2) + "";
    	let t8;
    	let t9;
    	let input0;
    	let t10;
    	let label1;
    	let t11;
    	let t12_value = /*decay*/ ctx[8].toFixed(2) + "";
    	let t12;
    	let t13;
    	let input1;
    	let t14;
    	let label2;
    	let t15;
    	let t16_value = /*module*/ ctx[1].state.sustain.toFixed(2) + "";
    	let t16;
    	let t17;
    	let input2;
    	let t18;
    	let label3;
    	let t19;
    	let t20_value = /*release*/ ctx[9].toFixed(2) + "";
    	let t20;
    	let t21;
    	let input3;
    	let t22;
    	let div5;
    	let p;
    	let t23;
    	let br0;
    	let br1;
    	let t24;
    	let br2;
    	let br3;
    	let t25;
    	let br4;
    	let br5;
    	let t26;
    	let br6;
    	let br7;
    	let t27;
    	let br8;
    	let br9;
    	let t28;
    	let br10;
    	let br11;
    	let div6_style_value;
    	let t29;
    	let br12;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[25](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[26](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[27](value);
    	}

    	function modulemovement_helpBtn_binding(value) {
    		/*modulemovement_helpBtn_binding*/ ctx[28](value);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		/*modulemovement_nodeSize_binding*/ ctx[29](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[30](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[31](value);
    	}

    	let modulemovement_props = { hasTrigger: true };

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*deleteNode*/ ctx[4] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[4];
    	}

    	if (/*helpBtn*/ ctx[5] !== void 0) {
    		modulemovement_props.helpBtn = /*helpBtn*/ ctx[5];
    	}

    	if (/*nodeSize*/ ctx[6] !== void 0) {
    		modulemovement_props.nodeSize = /*nodeSize*/ ctx[6];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	if (/*bobSize*/ ctx[10] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[10];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'helpBtn', modulemovement_helpBtn_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodeSize', modulemovement_nodeSize_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	helpbutton = new HelpButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div6 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t3 = space();
    			div1 = element("div");
    			create_component(helpbutton.$$.fragment);
    			t4 = space();
    			div4 = element("div");
    			h2 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			div3 = element("div");
    			div2 = element("div");
    			label0 = element("label");
    			t7 = text("Attack (");
    			t8 = text(t8_value);
    			t9 = text("s)");
    			input0 = element("input");
    			t10 = space();
    			label1 = element("label");
    			t11 = text("Decay (");
    			t12 = text(t12_value);
    			t13 = text("s)");
    			input1 = element("input");
    			t14 = space();
    			label2 = element("label");
    			t15 = text("Sustain (");
    			t16 = text(t16_value);
    			t17 = text(")");
    			input2 = element("input");
    			t18 = space();
    			label3 = element("label");
    			t19 = text("Release (");
    			t20 = text(t20_value);
    			t21 = text("s)");
    			input3 = element("input");
    			t22 = space();
    			div5 = element("div");
    			p = element("p");
    			t23 = text("Can be selected as a Control option on other modules to automate parameters.");
    			br0 = element("br");
    			br1 = element("br");
    			t24 = text("\r\n                When key is pressed, causes connected parameters to rise up to their maximum value and then fall.");
    			br2 = element("br");
    			br3 = element("br");
    			t25 = text("\r\n                Attack - time it takes to rise to the maximum value when key is pressed.");
    			br4 = element("br");
    			br5 = element("br");
    			t26 = text("\r\n                Decay - time it takes to fall to sustained value after maximum reached.");
    			br6 = element("br");
    			br7 = element("br");
    			t27 = text("\r\n                Sustain - proportion of maximum value the parameter is sustained at while key is held.");
    			br8 = element("br");
    			br9 = element("br");
    			t28 = text("\r\n                Release - time it takes to fall to minimum when key is released.");
    			br10 = element("br");
    			br11 = element("br");
    			t29 = space();
    			br12 = element("br");
    			add_location(h1, file$7, 199, 8, 6186);
    			attr_dev(div0, "class", "delete svelte-n94yys");
    			add_location(div0, file$7, 200, 8, 6222);
    			attr_dev(div1, "class", "help svelte-n94yys");
    			add_location(div1, file$7, 201, 8, 6304);
    			attr_dev(h2, "class", "editableTitle svelte-n94yys");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[11][/*module*/ ctx[1].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[32].call(h2));
    			add_location(h2, file$7, 203, 12, 6432);
    			attr_dev(label0, "for", "attack");
    			add_location(label0, file$7, 207, 16, 6683);
    			attr_dev(input0, "id", "attack");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "1");
    			attr_dev(input0, "step", "0.001");
    			add_location(input0, file$7, 207, 73, 6740);
    			attr_dev(label1, "for", "decay");
    			add_location(label1, file$7, 208, 16, 6852);
    			attr_dev(input1, "id", "decay");
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "max", "1");
    			attr_dev(input1, "step", "0.001");
    			add_location(input1, file$7, 208, 70, 6906);
    			attr_dev(label2, "for", "sustain");
    			add_location(label2, file$7, 209, 16, 7016);
    			attr_dev(input2, "id", "sustain");
    			attr_dev(input2, "type", "range");
    			attr_dev(input2, "min", "0");
    			attr_dev(input2, "max", "1");
    			attr_dev(input2, "step", "0.001");
    			add_location(input2, file$7, 209, 88, 7088);
    			attr_dev(label3, "for", "release");
    			add_location(label3, file$7, 210, 16, 7202);
    			attr_dev(input3, "id", "release");
    			attr_dev(input3, "type", "range");
    			attr_dev(input3, "min", "0");
    			attr_dev(input3, "max", "1");
    			attr_dev(input3, "step", "0.001");
    			add_location(input3, file$7, 210, 76, 7262);
    			attr_dev(div2, "class", "params");
    			add_location(div2, file$7, 206, 12, 6645);
    			add_location(div3, file$7, 205, 12, 6608);
    			attr_dev(div4, "id", "controls");
    			add_location(div4, file$7, 202, 8, 6383);
    			add_location(br0, file$7, 216, 92, 7555);
    			add_location(br1, file$7, 216, 96, 7559);
    			add_location(br2, file$7, 217, 113, 7678);
    			add_location(br3, file$7, 217, 117, 7682);
    			add_location(br4, file$7, 218, 88, 7776);
    			add_location(br5, file$7, 218, 92, 7780);
    			add_location(br6, file$7, 219, 87, 7873);
    			add_location(br7, file$7, 219, 91, 7877);
    			add_location(br8, file$7, 220, 102, 7985);
    			add_location(br9, file$7, 220, 106, 7989);
    			add_location(br10, file$7, 221, 80, 8075);
    			add_location(br11, file$7, 221, 84, 8079);
    			attr_dev(p, "class", "svelte-n94yys");
    			add_location(p, file$7, 215, 12, 7458);
    			add_location(div5, file$7, 214, 8, 7424);
    			attr_dev(div6, "id", "module");
    			attr_dev(div6, "style", div6_style_value = "background-color: " + /*$colours*/ ctx[12][/*module*/ ctx[1].state.type]);
    			attr_dev(div6, "class", "svelte-n94yys");
    			add_location(div6, file$7, 198, 4, 6086);
    			add_location(br12, file$7, 225, 4, 8135);
    			add_location(main, file$7, 196, 0, 5883);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div6);
    			append_dev(div6, h1);
    			append_dev(h1, t1);
    			append_dev(div6, t2);
    			append_dev(div6, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div6, t3);
    			append_dev(div6, div1);
    			mount_component(helpbutton, div1, null);
    			append_dev(div6, t4);
    			append_dev(div6, div4);
    			append_dev(div4, h2);
    			append_dev(h2, t5);

    			if (/*$modules*/ ctx[11][/*module*/ ctx[1].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[11][/*module*/ ctx[1].state.id].state.title;
    			}

    			append_dev(div4, t6);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, label0);
    			append_dev(label0, t7);
    			append_dev(label0, t8);
    			append_dev(label0, t9);
    			append_dev(div2, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.attack);
    			append_dev(div2, t10);
    			append_dev(div2, label1);
    			append_dev(label1, t11);
    			append_dev(label1, t12);
    			append_dev(label1, t13);
    			append_dev(div2, input1);
    			set_input_value(input1, /*module*/ ctx[1].state.decay);
    			append_dev(div2, t14);
    			append_dev(div2, label2);
    			append_dev(label2, t15);
    			append_dev(label2, t16);
    			append_dev(label2, t17);
    			append_dev(div2, input2);
    			set_input_value(input2, /*module*/ ctx[1].state.sustain);
    			append_dev(div2, t18);
    			append_dev(div2, label3);
    			append_dev(label3, t19);
    			append_dev(label3, t20);
    			append_dev(label3, t21);
    			append_dev(div2, input3);
    			set_input_value(input3, /*module*/ ctx[1].state.release);
    			append_dev(div6, t22);
    			append_dev(div6, div5);
    			append_dev(div5, p);
    			append_dev(p, t23);
    			append_dev(p, br0);
    			append_dev(p, br1);
    			append_dev(p, t24);
    			append_dev(p, br2);
    			append_dev(p, br3);
    			append_dev(p, t25);
    			append_dev(p, br4);
    			append_dev(p, br5);
    			append_dev(p, t26);
    			append_dev(p, br6);
    			append_dev(p, br7);
    			append_dev(p, t27);
    			append_dev(p, br8);
    			append_dev(p, br9);
    			append_dev(p, t28);
    			append_dev(p, br10);
    			append_dev(p, br11);
    			append_dev(main, t29);
    			append_dev(main, br12);
    			/*main_binding*/ ctx[37](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[15].call(null, div0)),
    					action_destroyer(/*setHelpBtn*/ ctx[17].call(null, div1)),
    					action_destroyer(/*setTitleNode*/ ctx[16].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[32]),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[33]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[33]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[34]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[34]),
    					listen_dev(input2, "change", /*input2_change_input_handler*/ ctx[35]),
    					listen_dev(input2, "input", /*input2_change_input_handler*/ ctx[35]),
    					listen_dev(input3, "change", /*input3_change_input_handler*/ ctx[36]),
    					listen_dev(input3, "input", /*input3_change_input_handler*/ ctx[36]),
    					action_destroyer(/*setNotHelpDiv*/ ctx[19].call(null, div3)),
    					action_destroyer(/*setControls*/ ctx[14].call(null, div4)),
    					action_destroyer(/*setHelpDiv*/ ctx[18].call(null, div5)),
    					action_destroyer(/*setModule*/ ctx[13].call(null, div6))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 4) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[2];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 8) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[3];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 16) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[4];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_helpBtn && dirty[0] & /*helpBtn*/ 32) {
    				updating_helpBtn = true;
    				modulemovement_changes.helpBtn = /*helpBtn*/ ctx[5];
    				add_flush_callback(() => updating_helpBtn = false);
    			}

    			if (!updating_nodeSize && dirty[0] & /*nodeSize*/ 64) {
    				updating_nodeSize = true;
    				modulemovement_changes.nodeSize = /*nodeSize*/ ctx[6];
    				add_flush_callback(() => updating_nodeSize = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 1024) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[10];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			const helpbutton_changes = {};
    			if (dirty[0] & /*module*/ 2) helpbutton_changes.module = /*module*/ ctx[1];
    			helpbutton.$set(helpbutton_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t5_value !== (t5_value = /*module*/ ctx[1].state.title + "")) set_data_contenteditable_dev(t5, t5_value);

    			if (dirty[0] & /*$modules, module*/ 2050 && /*$modules*/ ctx[11][/*module*/ ctx[1].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[11][/*module*/ ctx[1].state.id].state.title;
    			}

    			if ((!current || dirty[0] & /*attack*/ 128) && t8_value !== (t8_value = /*attack*/ ctx[7].toFixed(2) + "")) set_data_dev(t8, t8_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input0, /*module*/ ctx[1].state.attack);
    			}

    			if ((!current || dirty[0] & /*decay*/ 256) && t12_value !== (t12_value = /*decay*/ ctx[8].toFixed(2) + "")) set_data_dev(t12, t12_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input1, /*module*/ ctx[1].state.decay);
    			}

    			if ((!current || dirty[0] & /*module*/ 2) && t16_value !== (t16_value = /*module*/ ctx[1].state.sustain.toFixed(2) + "")) set_data_dev(t16, t16_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input2, /*module*/ ctx[1].state.sustain);
    			}

    			if ((!current || dirty[0] & /*release*/ 512) && t20_value !== (t20_value = /*release*/ ctx[9].toFixed(2) + "")) set_data_dev(t20, t20_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input3, /*module*/ ctx[1].state.release);
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 4098 && div6_style_value !== (div6_style_value = "background-color: " + /*$colours*/ ctx[12][/*module*/ ctx[1].state.type])) {
    				attr_dev(div6, "style", div6_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			transition_in(helpbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			transition_out(helpbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_component(helpbutton);
    			/*main_binding*/ ctx[37](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(196:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[1].destroyed && create_if_block$7(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[1].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$7(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $selectingModule;
    	let $opacity;
    	let $isTyping;
    	let $modules;
    	let $midi;
    	let $context;
    	let $colours;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(22, $selectingModule = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(44, $isTyping = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(11, $modules = $$value));
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(24, $midi = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(45, $context = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(12, $colours = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ADSR', slots, []);

    	let { state = {
    		type: 'adsr',
    		attack: 0.1,
    		decay: 0.1,
    		sustain: 0.5,
    		release: 0.1,
    		id: createNewId(),
    		title: 'Envelope'
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = false;
    	module.isControl = true;
    	if (!module.state.position) module.state.position = setPosition();
    	module.outputs = {};
    	let maxCvs = {};
    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let titleNode;
    	let helpBtn;
    	let helpDiv;
    	let notHelpDiv;
    	let nodeSize = { x: 280, y: 400 };
    	let notePlaying = false;
    	let attack, decay, release;

    	const fireEnv = () => {
    		Object.entries(module.outputs).forEach(([id, output]) => {
    			output.cancelScheduledValues($context.currentTime);
    			output.setValueAtTime(0, $context.currentTime);
    			output.linearRampToValueAtTime(maxCvs[id], $context.currentTime + attack);
    			output.linearRampToValueAtTime(maxCvs[id] * module.state.sustain, $context.currentTime + attack + decay);
    		});
    	};

    	const unFireEnv = () => {
    		Object.entries(module.outputs).forEach(([id, output]) => {
    			output.cancelScheduledValues($context.currentTime);
    			output.setValueAtTime(maxCvs[id] * module.state.sustain, $context.currentTime);
    			output.linearRampToValueAtTime(0, $context.currentTime + release);
    		});
    	};

    	module.addOutput = (id, cv) => {
    		$$invalidate(1, module.outputs[id] = cv, module);
    		maxCvs[id] = 1;
    		unFireEnv();
    	};

    	module.removeOutput = id => {
    		delete module.outputs[id];
    	};

    	module.setGain = (id, gain) => {
    		maxCvs[id] = gain;
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		if (titleNode) titleNode.style.outline = "none";
    	});

    	function setModule(node) {
    		$$invalidate(2, moduleNode = node);

    		moduleNode.addEventListener("mousedown", () => {
    			moduleIsClicked = true;
    		});

    		moduleNode.addEventListener("mouseup", () => {
    			if (moduleIsClicked) {
    				if ($selectingModule != null && $modules[$selectingModule].selectingCv) $modules[$selectingModule].select(module.state.id);
    			}
    		});
    	}

    	function setControls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(4, deleteNode = node);
    	}

    	function setTitleNode(node) {
    		titleNode = node;

    		titleNode.addEventListener("mouseenter", () => {
    			titleNode.style.outline = "2px solid #222222";
    		});

    		titleNode.addEventListener("mouseleave", () => {
    			if (!moduleTyping) titleNode.style.outline = "none";
    		});

    		titleNode.addEventListener("mousedown", () => {
    			setTimeout(
    				() => {
    					set_store_value(isTyping, $isTyping = true, $isTyping);
    					moduleTyping = true;
    					titleNode.style.outline = "2px solid #222222";
    				},
    				10
    			);
    		});
    	}

    	function setHelpBtn(node) {
    		$$invalidate(5, helpBtn = node);
    	}

    	function setHelpDiv(node) {
    		helpDiv = node;
    		helpDiv.style.display = "none";
    	}

    	function setNotHelpDiv(node) {
    		notHelpDiv = node;
    	}

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(23, $opacity = value));
    	let bobSize = spring(0, { stiffness: 0.3, damping: 0.2 });

    	module.fade = () => {
    		opacity.set(0.2);
    	};

    	module.halfFade = () => {
    		opacity.set(0.8);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	module.bob = () => {
    		bobSize.set(10);

    		setTimeout(
    			() => {
    				bobSize.set(0);
    			},
    			50
    		);
    	};

    	module.toggleHelp = () => {
    		$$invalidate(1, module.showingHelp = !module.showingHelp, module);

    		if (notHelpDiv) {
    			if (!module.showingHelp) {
    				notHelpDiv.style.display = "initial";
    			} else {
    				notHelpDiv.style.display = "none";
    			}
    		}

    		if (helpDiv) {
    			if (module.showingHelp) {
    				helpDiv.style.display = "initial";
    			} else {
    				helpDiv.style.display = "none";
    			}
    		}

    		if (module.showingHelp) {
    			$$invalidate(6, nodeSize = { x: 280, y: 650 });
    		} else {
    			$$invalidate(6, nodeSize = { x: 280, y: 400 });
    		}
    	};

    	module.bob();
    	const writable_props = ['state'];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ADSR> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(23, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(3, controlsNode), $$invalidate(4, deleteNode)), $$invalidate(22, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(4, deleteNode), $$invalidate(3, controlsNode)), $$invalidate(22, $selectingModule));
    	}

    	function modulemovement_helpBtn_binding(value) {
    		helpBtn = value;
    		$$invalidate(5, helpBtn);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		nodeSize = value;
    		$$invalidate(6, nodeSize);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(10, bobSize);
    	}

    	function h2_input_handler() {
    		$modules[module.state.id].state.title = this.textContent;
    		modules.set($modules);
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
    		colours,
    		selectingModule,
    		isTyping,
    		ModuleMovement,
    		DeleteButton,
    		HelpButton,
    		createNewId,
    		setPosition,
    		spring,
    		state,
    		module,
    		maxCvs,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		titleNode,
    		helpBtn,
    		helpDiv,
    		notHelpDiv,
    		nodeSize,
    		notePlaying,
    		attack,
    		decay,
    		release,
    		fireEnv,
    		unFireEnv,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		setHelpBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		opacity,
    		bobSize,
    		$selectingModule,
    		$opacity,
    		$isTyping,
    		$modules,
    		$midi,
    		$context,
    		$colours
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('maxCvs' in $$props) maxCvs = $$props.maxCvs;
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(4, deleteNode = $$props.deleteNode);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('helpBtn' in $$props) $$invalidate(5, helpBtn = $$props.helpBtn);
    		if ('helpDiv' in $$props) helpDiv = $$props.helpDiv;
    		if ('notHelpDiv' in $$props) notHelpDiv = $$props.notHelpDiv;
    		if ('nodeSize' in $$props) $$invalidate(6, nodeSize = $$props.nodeSize);
    		if ('notePlaying' in $$props) $$invalidate(21, notePlaying = $$props.notePlaying);
    		if ('attack' in $$props) $$invalidate(7, attack = $$props.attack);
    		if ('decay' in $$props) $$invalidate(8, decay = $$props.decay);
    		if ('release' in $$props) $$invalidate(9, release = $$props.release);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(20, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(10, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(7, attack = Math.pow(10, module.state.attack) - 1);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(8, decay = Math.pow(10, module.state.decay) - 1);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(9, release = Math.pow(10, module.state.release) - 1);
    		}

    		if ($$self.$$.dirty[0] & /*$midi, notePlaying*/ 18874368) {
    			if ($midi.trigger && !notePlaying) $$invalidate(21, notePlaying = true);
    		}

    		if ($$self.$$.dirty[0] & /*$midi, notePlaying*/ 18874368) {
    			if (!$midi.trigger && notePlaying) $$invalidate(21, notePlaying = false);
    		}

    		if ($$self.$$.dirty[0] & /*notePlaying*/ 2097152) {
    			if (notePlaying) fireEnv(); else unFireEnv();
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 8388612) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 4194328) {
    			if (controlsNode && deleteNode) {
    				if ($selectingModule != null) {
    					$$invalidate(3, controlsNode.style.pointerEvents = "none", controlsNode);
    					$$invalidate(4, deleteNode.style.pointerEvents = "none", deleteNode);
    				} else {
    					$$invalidate(3, controlsNode.style.pointerEvents = "all", controlsNode);
    					$$invalidate(4, deleteNode.style.pointerEvents = "all", deleteNode);
    				}
    			}
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		helpBtn,
    		nodeSize,
    		attack,
    		decay,
    		release,
    		bobSize,
    		$modules,
    		$colours,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		setHelpBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		opacity,
    		notePlaying,
    		$selectingModule,
    		$opacity,
    		$midi,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_helpBtn_binding,
    		modulemovement_nodeSize_binding,
    		modulemovement_nodePos_binding,
    		modulemovement_bobSize_binding,
    		h2_input_handler,
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
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ADSR",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get state() {
    		throw new Error("<ADSR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<ADSR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\modules\VCF.svelte generated by Svelte v3.59.2 */
    const file$6 = "src\\modules\\VCF.svelte";

    // (300:0) {#if !module.destroyed}
    function create_if_block$6(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_helpBtn;
    	let updating_nodeSize;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div7;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let div0;
    	let deletebutton;
    	let t3;
    	let div1;
    	let helpbutton;
    	let t4;
    	let div5;
    	let h2;
    	let t5_value = /*module*/ ctx[1].state.title + "";
    	let t5;
    	let t6;
    	let div4;
    	let div2;
    	let label0;
    	let button0;
    	let t7;
    	let t8;
    	let div3;
    	let label1;
    	let button1;
    	let t9;
    	let br0;
    	let t10;
    	let label2;
    	let t11;
    	let t12_value = /*frequency*/ ctx[5].toFixed(1) + "";
    	let t12;
    	let t13;
    	let input0;
    	let t14;
    	let br1;
    	let section;
    	let input1;
    	let input1_id_value;
    	let label3;
    	let t15;
    	let label3_for_value;
    	let t16;
    	let input2;
    	let input2_id_value;
    	let label4;
    	let t17;
    	let label4_for_value;
    	let t18;
    	let input3;
    	let input3_id_value;
    	let label5;
    	let t19;
    	let label5_for_value;
    	let t20;
    	let div6;
    	let p;
    	let t21;
    	let br2;
    	let br3;
    	let t22;
    	let br4;
    	let br5;
    	let t23;
    	let br6;
    	let br7;
    	let t24;
    	let br8;
    	let br9;
    	let t25;
    	let br10;
    	let br11;
    	let div7_style_value;
    	let t26;
    	let br12;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[32](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[33](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[34](value);
    	}

    	function modulemovement_helpBtn_binding(value) {
    		/*modulemovement_helpBtn_binding*/ ctx[35](value);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		/*modulemovement_nodeSize_binding*/ ctx[36](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[37](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[38](value);
    	}

    	let modulemovement_props = {};

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*deleteNode*/ ctx[4] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[4];
    	}

    	if (/*helpBtn*/ ctx[9] !== void 0) {
    		modulemovement_props.helpBtn = /*helpBtn*/ ctx[9];
    	}

    	if (/*nodeSize*/ ctx[10] !== void 0) {
    		modulemovement_props.nodeSize = /*nodeSize*/ ctx[10];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	if (/*bobSize*/ ctx[11] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[11];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'helpBtn', modulemovement_helpBtn_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodeSize', modulemovement_nodeSize_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	helpbutton = new HelpButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*module*/ ctx[1].state.inputId != null && /*$modules*/ ctx[7][/*module*/ ctx[1].state.inputId]) return create_if_block_2;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*module*/ ctx[1].state.cvId != null && /*$modules*/ ctx[7][/*module*/ ctx[1].state.cvId]) return create_if_block_1$2;
    		return create_else_block$3;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[46][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div7 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t3 = space();
    			div1 = element("div");
    			create_component(helpbutton.$$.fragment);
    			t4 = space();
    			div5 = element("div");
    			h2 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			div4 = element("div");
    			div2 = element("div");
    			label0 = element("label");
    			button0 = element("button");
    			if_block0.c();
    			t7 = text(" Input");
    			t8 = space();
    			div3 = element("div");
    			label1 = element("label");
    			button1 = element("button");
    			if_block1.c();
    			t9 = text(" Control");
    			br0 = element("br");
    			t10 = space();
    			label2 = element("label");
    			t11 = text("Cutoff Frequency (");
    			t12 = text(t12_value);
    			t13 = text("Hz)");
    			input0 = element("input");
    			t14 = space();
    			br1 = element("br");
    			section = element("section");
    			input1 = element("input");
    			label3 = element("label");
    			t15 = text("Lowpass");
    			t16 = space();
    			input2 = element("input");
    			label4 = element("label");
    			t17 = text("Highpass");
    			t18 = space();
    			input3 = element("input");
    			label5 = element("label");
    			t19 = text("Bandpass");
    			t20 = space();
    			div6 = element("div");
    			p = element("p");
    			t21 = text("Changes the timbre of an input signal by cutting out a range of frequencies.");
    			br2 = element("br");
    			br3 = element("br");
    			t22 = text("\r\n                Cutoff frequency changes the range of frequencies that are cut out, and can be automated with a Control module.");
    			br4 = element("br");
    			br5 = element("br");
    			t23 = text("\r\n                Lowpass mode cuts out frequencies above the cutoff.");
    			br6 = element("br");
    			br7 = element("br");
    			t24 = text("\r\n                Highpass mode cuts out frequencies below the cutoff.");
    			br8 = element("br");
    			br9 = element("br");
    			t25 = text("\r\n                Bandpass mode only preserves frequencies near to the cutoff.");
    			br10 = element("br");
    			br11 = element("br");
    			t26 = space();
    			br12 = element("br");
    			add_location(h1, file$6, 303, 8, 10073);
    			attr_dev(div0, "class", "delete svelte-im3yse");
    			add_location(div0, file$6, 304, 8, 10109);
    			attr_dev(div1, "class", "help svelte-im3yse");
    			add_location(div1, file$6, 305, 8, 10191);
    			attr_dev(h2, "class", "editableTitle svelte-im3yse");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[39].call(h2));
    			add_location(h2, file$6, 307, 12, 10319);
    			attr_dev(button0, "class", "svelte-im3yse");
    			add_location(button0, file$6, 311, 23, 10689);
    			add_location(label0, file$6, 311, 16, 10682);
    			attr_dev(div2, "class", "inputDiv");
    			add_location(div2, file$6, 310, 12, 10532);
    			attr_dev(button1, "class", "svelte-im3yse");
    			add_location(button1, file$6, 320, 23, 11236);
    			add_location(label1, file$6, 320, 16, 11229);
    			attr_dev(div3, "class", "inputDiv");
    			add_location(div3, file$6, 319, 16, 11080);
    			add_location(br0, file$6, 326, 47, 11583);
    			attr_dev(label2, "for", "freq");
    			add_location(label2, file$6, 328, 12, 11603);
    			attr_dev(input0, "id", "freq");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", Math.log2(20));
    			attr_dev(input0, "max", Math.log2(18000));
    			attr_dev(input0, "step", "0.0001");
    			add_location(input0, file$6, 328, 81, 11672);
    			add_location(br1, file$6, 329, 12, 11808);
    			attr_dev(input1, "id", input1_id_value = 'lowpass' + /*module*/ ctx[1].state.id);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "lowpass";
    			input1.value = input1.__value;
    			attr_dev(input1, "class", "svelte-im3yse");
    			add_location(input1, file$6, 330, 16, 11852);
    			attr_dev(label3, "for", label3_for_value = 'lowpass' + /*module*/ ctx[1].state.id);
    			attr_dev(label3, "class", "svelte-im3yse");
    			add_location(label3, file$6, 330, 122, 11958);
    			attr_dev(input2, "id", input2_id_value = 'highpass' + /*module*/ ctx[1].state.id);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "highpass";
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-im3yse");
    			add_location(input2, file$6, 331, 16, 12030);
    			attr_dev(label4, "for", label4_for_value = 'highpass' + /*module*/ ctx[1].state.id);
    			attr_dev(label4, "class", "svelte-im3yse");
    			add_location(label4, file$6, 331, 124, 12138);
    			attr_dev(input3, "id", input3_id_value = 'bandpass' + /*module*/ ctx[1].state.id);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "bandpass";
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-im3yse");
    			add_location(input3, file$6, 332, 16, 12212);
    			attr_dev(label5, "for", label5_for_value = 'bandpass' + /*module*/ ctx[1].state.id);
    			attr_dev(label5, "class", "svelte-im3yse");
    			add_location(label5, file$6, 332, 124, 12320);
    			attr_dev(section, "class", "type svelte-im3yse");
    			add_location(section, file$6, 329, 16, 11812);
    			add_location(div4, file$6, 309, 12, 10495);
    			attr_dev(div5, "id", "controls");
    			add_location(div5, file$6, 306, 8, 10270);
    			add_location(br2, file$6, 337, 91, 12559);
    			add_location(br3, file$6, 337, 95, 12563);
    			add_location(br4, file$6, 338, 127, 12696);
    			add_location(br5, file$6, 338, 131, 12700);
    			add_location(br6, file$6, 339, 67, 12773);
    			add_location(br7, file$6, 339, 71, 12777);
    			add_location(br8, file$6, 340, 68, 12851);
    			add_location(br9, file$6, 340, 72, 12855);
    			add_location(br10, file$6, 341, 76, 12937);
    			add_location(br11, file$6, 341, 80, 12941);
    			attr_dev(p, "class", "svelte-im3yse");
    			add_location(p, file$6, 337, 12, 12480);
    			add_location(div6, file$6, 336, 8, 12446);
    			attr_dev(div7, "id", "module");
    			attr_dev(div7, "style", div7_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[1].state.type]);
    			attr_dev(div7, "class", "svelte-im3yse");
    			add_location(div7, file$6, 302, 4, 9973);
    			add_location(br12, file$6, 345, 4, 12997);
    			add_location(main, file$6, 300, 0, 9792);
    			binding_group.p(input1, input2, input3);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div7);
    			append_dev(div7, h1);
    			append_dev(h1, t1);
    			append_dev(div7, t2);
    			append_dev(div7, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div7, t3);
    			append_dev(div7, div1);
    			mount_component(helpbutton, div1, null);
    			append_dev(div7, t4);
    			append_dev(div7, div5);
    			append_dev(div5, h2);
    			append_dev(h2, t5);

    			if (/*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title;
    			}

    			append_dev(div5, t6);
    			append_dev(div5, div4);
    			append_dev(div4, div2);
    			append_dev(div2, label0);
    			append_dev(label0, button0);
    			if_block0.m(button0, null);
    			append_dev(label0, t7);
    			append_dev(div4, t8);
    			append_dev(div4, div3);
    			append_dev(div3, label1);
    			append_dev(label1, button1);
    			if_block1.m(button1, null);
    			append_dev(label1, t9);
    			append_dev(div4, br0);
    			append_dev(div4, t10);
    			append_dev(div4, label2);
    			append_dev(label2, t11);
    			append_dev(label2, t12);
    			append_dev(label2, t13);
    			append_dev(div4, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.voct);
    			append_dev(div4, t14);
    			append_dev(div4, br1);
    			append_dev(div4, section);
    			append_dev(section, input1);
    			input1.checked = input1.__value === /*module*/ ctx[1].state.filterType;
    			append_dev(section, label3);
    			append_dev(label3, t15);
    			append_dev(section, t16);
    			append_dev(section, input2);
    			input2.checked = input2.__value === /*module*/ ctx[1].state.filterType;
    			append_dev(section, label4);
    			append_dev(label4, t17);
    			append_dev(section, t18);
    			append_dev(section, input3);
    			input3.checked = input3.__value === /*module*/ ctx[1].state.filterType;
    			append_dev(section, label5);
    			append_dev(label5, t19);
    			append_dev(div7, t20);
    			append_dev(div7, div6);
    			append_dev(div6, p);
    			append_dev(p, t21);
    			append_dev(p, br2);
    			append_dev(p, br3);
    			append_dev(p, t22);
    			append_dev(p, br4);
    			append_dev(p, br5);
    			append_dev(p, t23);
    			append_dev(p, br6);
    			append_dev(p, br7);
    			append_dev(p, t24);
    			append_dev(p, br8);
    			append_dev(p, br9);
    			append_dev(p, t25);
    			append_dev(p, br10);
    			append_dev(p, br11);
    			append_dev(main, t26);
    			append_dev(main, br12);
    			/*main_binding*/ ctx[49](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[14].call(null, div0)),
    					action_destroyer(/*setHelpBtn*/ ctx[18].call(null, div1)),
    					action_destroyer(/*setTitleNode*/ ctx[17].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[39]),
    					action_destroyer(/*setInputBtn*/ ctx[15].call(null, button0)),
    					listen_dev(button0, "click", /*chooseInput*/ ctx[22], false, false, false, false),
    					listen_dev(div2, "mouseenter", /*mouseenter_handler*/ ctx[40], false, false, false, false),
    					listen_dev(div2, "mouseleave", /*mouseleave_handler*/ ctx[41], false, false, false, false),
    					action_destroyer(/*setCvBtn*/ ctx[16].call(null, button1)),
    					listen_dev(button1, "click", /*chooseCv*/ ctx[23], false, false, false, false),
    					listen_dev(div3, "mouseenter", /*mouseenter_handler_1*/ ctx[42], false, false, false, false),
    					listen_dev(div3, "mouseleave", /*mouseleave_handler_1*/ ctx[43], false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[44]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[44]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[45]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[47]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[48]),
    					action_destroyer(/*setNotHelpDiv*/ ctx[20].call(null, div4)),
    					action_destroyer(/*setControls*/ ctx[13].call(null, div5)),
    					action_destroyer(/*setHelpDiv*/ ctx[19].call(null, div6)),
    					action_destroyer(/*setModule*/ ctx[12].call(null, div7))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 4) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[2];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 8) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[3];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 16) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[4];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_helpBtn && dirty[0] & /*helpBtn*/ 512) {
    				updating_helpBtn = true;
    				modulemovement_changes.helpBtn = /*helpBtn*/ ctx[9];
    				add_flush_callback(() => updating_helpBtn = false);
    			}

    			if (!updating_nodeSize && dirty[0] & /*nodeSize*/ 1024) {
    				updating_nodeSize = true;
    				modulemovement_changes.nodeSize = /*nodeSize*/ ctx[10];
    				add_flush_callback(() => updating_nodeSize = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 2048) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[11];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			const helpbutton_changes = {};
    			if (dirty[0] & /*module*/ 2) helpbutton_changes.module = /*module*/ ctx[1];
    			helpbutton.$set(helpbutton_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t5_value !== (t5_value = /*module*/ ctx[1].state.title + "")) set_data_contenteditable_dev(t5, t5_value);

    			if (dirty[0] & /*$modules, module*/ 130 && /*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(button0, null);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_1(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(button1, null);
    				}
    			}

    			if ((!current || dirty[0] & /*frequency*/ 32) && t12_value !== (t12_value = /*frequency*/ ctx[5].toFixed(1) + "")) set_data_dev(t12, t12_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input0, /*module*/ ctx[1].state.voct);
    			}

    			if (!current || dirty[0] & /*module*/ 2 && input1_id_value !== (input1_id_value = 'lowpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input1, "id", input1_id_value);
    			}

    			if (dirty[0] & /*module*/ 2) {
    				input1.checked = input1.__value === /*module*/ ctx[1].state.filterType;
    			}

    			if (!current || dirty[0] & /*module*/ 2 && label3_for_value !== (label3_for_value = 'lowpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label3, "for", label3_for_value);
    			}

    			if (!current || dirty[0] & /*module*/ 2 && input2_id_value !== (input2_id_value = 'highpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input2, "id", input2_id_value);
    			}

    			if (dirty[0] & /*module*/ 2) {
    				input2.checked = input2.__value === /*module*/ ctx[1].state.filterType;
    			}

    			if (!current || dirty[0] & /*module*/ 2 && label4_for_value !== (label4_for_value = 'highpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label4, "for", label4_for_value);
    			}

    			if (!current || dirty[0] & /*module*/ 2 && input3_id_value !== (input3_id_value = 'bandpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input3, "id", input3_id_value);
    			}

    			if (dirty[0] & /*module*/ 2) {
    				input3.checked = input3.__value === /*module*/ ctx[1].state.filterType;
    			}

    			if (!current || dirty[0] & /*module*/ 2 && label5_for_value !== (label5_for_value = 'bandpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label5, "for", label5_for_value);
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 258 && div7_style_value !== (div7_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[1].state.type])) {
    				attr_dev(div7, "style", div7_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			transition_in(helpbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			transition_out(helpbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_component(helpbutton);
    			if_block0.d();
    			if_block1.d();
    			/*main_binding*/ ctx[49](null);
    			binding_group.r();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(300:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    // (315:20) {:else}
    function create_else_block_1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(315:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (313:20) {#if module.state.inputId != null && $modules[module.state.inputId]}
    function create_if_block_2(ctx) {
    	let t0_value = /*module*/ ctx[1].state.inputId + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[7][/*module*/ ctx[1].state.inputId].state.title + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*module*/ 2 && t0_value !== (t0_value = /*module*/ ctx[1].state.inputId + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, module*/ 130 && t2_value !== (t2_value = /*$modules*/ ctx[7][/*module*/ ctx[1].state.inputId].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(313:20) {#if module.state.inputId != null && $modules[module.state.inputId]}",
    		ctx
    	});

    	return block;
    }

    // (324:20) {:else}
    function create_else_block$3(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(324:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (322:20) {#if module.state.cvId != null && $modules[module.state.cvId]}
    function create_if_block_1$2(ctx) {
    	let t0_value = /*module*/ ctx[1].state.cvId + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[7][/*module*/ ctx[1].state.cvId].state.title + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*module*/ 2 && t0_value !== (t0_value = /*module*/ ctx[1].state.cvId + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, module*/ 130 && t2_value !== (t2_value = /*$modules*/ ctx[7][/*module*/ ctx[1].state.cvId].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(322:20) {#if module.state.cvId != null && $modules[module.state.cvId]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[1].destroyed && create_if_block$6(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[1].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$6(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $selectingModule;
    	let $modules;
    	let $colours;
    	let $opacity;
    	let $isTyping;
    	let $output;
    	let $context;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(6, $selectingModule = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(7, $modules = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(8, $colours = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(55, $isTyping = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(56, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(31, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCF', slots, []);

    	let { state = {
    		type: 'vcf',
    		voct: Math.log2(18000),
    		filterType: 'lowpass',
    		id: createNewId(),
    		inputId: null,
    		cvId: null,
    		title: 'Filter'
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = true;
    	module.isControl = false;
    	if (!module.state.position) module.state.position = setPosition();
    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let inputBtn;
    	let cvBtn;
    	let titleNode;
    	let helpBtn;
    	let helpDiv;
    	let notHelpDiv;
    	let nodeSize = { x: 280, y: 350 };
    	module.selectingInput = false;
    	module.selectingCv = false;
    	let cvModule;
    	var filterNode = $context.createBiquadFilter();
    	module.output = filterNode;
    	module.cv = filterNode.frequency;
    	var frequency;
    	var currentInput;
    	var currentCvModule;

    	module.clearCurrents = () => {
    		$$invalidate(28, currentInput = null);
    		$$invalidate(26, cvModule = null);
    		$$invalidate(29, currentCvModule = null);
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		if (titleNode) titleNode.style.outline = "none";
    	});

    	function setModule(node) {
    		$$invalidate(2, moduleNode = node);

    		moduleNode.addEventListener("mousedown", () => {
    			moduleIsClicked = true;
    		});

    		moduleNode.addEventListener("mouseup", () => {
    			if (moduleIsClicked) {
    				if ($selectingModule == "output") {
    					$output.select(module.state.id);
    				} else if ($selectingModule != null && $modules[$selectingModule].selectingInput && $selectingModule != module.state.id && ($modules[$selectingModule].state.type != "mixer" || (!$modules[$selectingModule].state.inputIds.includes(module.state.id) || $modules[$selectingModule].state.inputIds[$modules[$selectingModule].inputSelecting] == module.state.id))) {
    					$modules[$selectingModule].select(module.state.id);
    				} else if ($selectingModule == module.state.id) {
    					module.select(null);
    				}
    			}
    		});
    	}

    	function setControls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(4, deleteNode = node);
    	}

    	function setInputBtn(node) {
    		$$invalidate(24, inputBtn = node);

    		inputBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(24, inputBtn.style.opacity = 0.8, inputBtn);
    		});

    		inputBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(24, inputBtn.style.opacity = 1, inputBtn);
    		});
    	}

    	function setCvBtn(node) {
    		$$invalidate(25, cvBtn = node);

    		cvBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(25, cvBtn.style.opacity = 0.8, cvBtn);
    		});

    		cvBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(25, cvBtn.style.opacity = 1, cvBtn);
    		});
    	}

    	function setTitleNode(node) {
    		titleNode = node;

    		titleNode.addEventListener("mouseenter", () => {
    			titleNode.style.outline = "2px solid #222222";
    		});

    		titleNode.addEventListener("mouseleave", () => {
    			if (!moduleTyping) titleNode.style.outline = "none";
    		});

    		titleNode.addEventListener("mousedown", () => {
    			setTimeout(
    				() => {
    					set_store_value(isTyping, $isTyping = true, $isTyping);
    					moduleTyping = true;
    					titleNode.style.outline = "2px solid #222222";
    				},
    				10
    			);
    		});
    	}

    	function setHelpBtn(node) {
    		$$invalidate(9, helpBtn = node);
    	}

    	function setHelpDiv(node) {
    		helpDiv = node;
    		helpDiv.style.display = "none";
    	}

    	function setNotHelpDiv(node) {
    		notHelpDiv = node;
    	}

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(30, $opacity = value));
    	let bobSize = spring(0, { stiffness: 0.3, damping: 0.2 });

    	module.fade = () => {
    		opacity.set(0.2);
    	};

    	module.halfFade = () => {
    		opacity.set(0.8);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	module.bob = () => {
    		bobSize.set(10);

    		setTimeout(
    			() => {
    				bobSize.set(0);
    			},
    			50
    		);
    	};

    	module.toggleHelp = () => {
    		$$invalidate(1, module.showingHelp = !module.showingHelp, module);

    		if (notHelpDiv) {
    			if (!module.showingHelp) {
    				notHelpDiv.style.display = "initial";
    			} else {
    				notHelpDiv.style.display = "none";
    			}
    		}

    		if (helpDiv) {
    			if (module.showingHelp) {
    				helpDiv.style.display = "initial";
    			} else {
    				helpDiv.style.display = "none";
    			}
    		}

    		if (module.showingHelp) {
    			$$invalidate(10, nodeSize = { x: 280, y: 560 });
    		} else {
    			$$invalidate(10, nodeSize = { x: 280, y: 350 });
    		}
    	};

    	function chooseInput() {
    		inputsAllHover(module);
    		if (!inputBtn) return;

    		if (!module.selectingInput) {
    			$$invalidate(1, module.selectingInput = true, module);
    			$$invalidate(24, inputBtn.style.opacity = 0.5, inputBtn);
    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(1, module.selectingInput = false, module);
    		}
    	}

    	function chooseCv() {
    		cvsAllHover(module);
    		if (!cvBtn) return;

    		if (!module.selectingCv) {
    			$$invalidate(1, module.selectingCv = true, module);
    			$$invalidate(25, cvBtn.style.opacity = 0.5, cvBtn);
    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(1, module.selectingCv = false, module);
    		}
    	}

    	module.select = id => {
    		if (module.selectingInput) {
    			$$invalidate(1, module.state.inputId = id, module);
    			$$invalidate(24, inputBtn.style.opacity = 1, inputBtn);
    			$$invalidate(1, module.selectingInput = false, module);
    		} else if (module.selectingCv) {
    			$$invalidate(1, module.state.cvId = id, module);
    			$$invalidate(25, cvBtn.style.opacity = 1, cvBtn);
    			$$invalidate(1, module.selectingCv = false, module);
    		}

    		set_store_value(selectingModule, $selectingModule = null, $selectingModule);
    		unhover();
    	};

    	module.bob();
    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCF> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(30, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(3, controlsNode), $$invalidate(4, deleteNode)), $$invalidate(6, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(4, deleteNode), $$invalidate(3, controlsNode)), $$invalidate(6, $selectingModule));
    	}

    	function modulemovement_helpBtn_binding(value) {
    		helpBtn = value;
    		$$invalidate(9, helpBtn);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		nodeSize = value;
    		$$invalidate(10, nodeSize);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(11, bobSize);
    	}

    	function h2_input_handler() {
    		$modules[module.state.id].state.title = this.textContent;
    		modules.set($modules);
    	}

    	const mouseenter_handler = () => inputsAllHover(module);

    	const mouseleave_handler = () => {
    		if ($selectingModule == null) unhover();
    	};

    	const mouseenter_handler_1 = () => {
    		cvsAllHover(module);
    	};

    	const mouseleave_handler_1 = () => {
    		if ($selectingModule == null) unhover();
    	};

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
    		colours,
    		selectingModule,
    		output,
    		isTyping,
    		ModuleMovement,
    		DeleteButton,
    		HelpButton,
    		createNewId,
    		cvsAllHover,
    		inputsAllHover,
    		unhover,
    		setPosition,
    		spring,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		inputBtn,
    		cvBtn,
    		titleNode,
    		helpBtn,
    		helpDiv,
    		notHelpDiv,
    		nodeSize,
    		cvModule,
    		filterNode,
    		frequency,
    		currentInput,
    		currentCvModule,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setCvBtn,
    		setTitleNode,
    		setHelpBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		opacity,
    		bobSize,
    		chooseInput,
    		chooseCv,
    		$selectingModule,
    		$modules,
    		$colours,
    		$opacity,
    		$isTyping,
    		$output,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(4, deleteNode = $$props.deleteNode);
    		if ('inputBtn' in $$props) $$invalidate(24, inputBtn = $$props.inputBtn);
    		if ('cvBtn' in $$props) $$invalidate(25, cvBtn = $$props.cvBtn);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('helpBtn' in $$props) $$invalidate(9, helpBtn = $$props.helpBtn);
    		if ('helpDiv' in $$props) helpDiv = $$props.helpDiv;
    		if ('notHelpDiv' in $$props) notHelpDiv = $$props.notHelpDiv;
    		if ('nodeSize' in $$props) $$invalidate(10, nodeSize = $$props.nodeSize);
    		if ('cvModule' in $$props) $$invalidate(26, cvModule = $$props.cvModule);
    		if ('filterNode' in $$props) $$invalidate(27, filterNode = $$props.filterNode);
    		if ('frequency' in $$props) $$invalidate(5, frequency = $$props.frequency);
    		if ('currentInput' in $$props) $$invalidate(28, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(29, currentCvModule = $$props.currentCvModule);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(21, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(11, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $modules*/ 130) {
    			if (module.state.cvId != null) {
    				$$invalidate(26, cvModule = $modules[module.state.cvId]);
    			} else {
    				$$invalidate(26, cvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(5, frequency = Math.pow(2, module.state.voct));
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(27, filterNode.type = module.state.filterType, filterNode);
    		}

    		if ($$self.$$.dirty[0] & /*filterNode, frequency*/ 134217760 | $$self.$$.dirty[1] & /*$context*/ 1) {
    			filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
    		}

    		if ($$self.$$.dirty[0] & /*module, $modules, currentInput, filterNode*/ 402653314) {
    			if (!module.destroyed) {
    				if (module.state.inputId != null && $modules[module.state.inputId] && $modules[module.state.inputId].output) {
    					let input = $modules[module.state.inputId];
    					if (currentInput) currentInput.disconnect(filterNode);
    					$$invalidate(28, currentInput = input.output);
    					currentInput.connect(filterNode);
    				} else {
    					if (currentInput) currentInput.disconnect(filterNode);
    					$$invalidate(28, currentInput = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, cvModule, filterNode, currentCvModule, frequency*/ 738197538 | $$self.$$.dirty[1] & /*$context*/ 1) {
    			if (!module.destroyed) {
    				if (cvModule) {
    					filterNode.frequency.cancelScheduledValues($context.currentTime);
    					filterNode.frequency.setValueAtTime(0, $context.currentTime);

    					if (currentCvModule) {
    						if (currentCvModule.outputs[module.state.id + ".1"]) ;
    						currentCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(29, currentCvModule = cvModule);
    					if (!currentCvModule.outputs[module.state.id + ".1"]) currentCvModule.addOutput(module.state.id + ".1", module.cv);
    				} else {
    					filterNode.frequency.cancelScheduledValues($context.currentTime);
    					filterNode.frequency.setValueAtTime(frequency, $context.currentTime);

    					if (currentCvModule) {
    						if (currentCvModule.outputs[module.state.id + ".1"]) ;
    						currentCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(29, currentCvModule = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*currentCvModule, module, frequency*/ 536870946) {
    			if (currentCvModule) {
    				currentCvModule.setGain(module.state.id + ".1", frequency);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 1073741828) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module, inputBtn, $colours, $modules, cvBtn*/ 50332034) {
    			if (!module.destroyed) {
    				if (inputBtn) {
    					if (module.state.inputId != null) {
    						$$invalidate(24, inputBtn.style.backgroundColor = $colours[$modules[module.state.inputId].state.type], inputBtn);
    					} else {
    						$$invalidate(24, inputBtn.style.backgroundColor = "#f0f0f0", inputBtn);
    					}
    				}

    				if (cvBtn) {
    					if (module.state.cvId != null) {
    						$$invalidate(25, cvBtn.style.backgroundColor = $colours[$modules[module.state.cvId].state.type], cvBtn);
    					} else {
    						$$invalidate(25, cvBtn.style.backgroundColor = "#f0f0f0", cvBtn);
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 88) {
    			if (controlsNode && deleteNode) {
    				if ($selectingModule != null) {
    					$$invalidate(3, controlsNode.style.pointerEvents = "none", controlsNode);
    					$$invalidate(4, deleteNode.style.pointerEvents = "none", deleteNode);
    				} else {
    					$$invalidate(3, controlsNode.style.pointerEvents = "all", controlsNode);
    					$$invalidate(4, deleteNode.style.pointerEvents = "all", deleteNode);
    				}
    			}
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		frequency,
    		$selectingModule,
    		$modules,
    		$colours,
    		helpBtn,
    		nodeSize,
    		bobSize,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setCvBtn,
    		setTitleNode,
    		setHelpBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		opacity,
    		chooseInput,
    		chooseCv,
    		inputBtn,
    		cvBtn,
    		cvModule,
    		filterNode,
    		currentInput,
    		currentCvModule,
    		$opacity,
    		$context,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_helpBtn_binding,
    		modulemovement_nodeSize_binding,
    		modulemovement_nodePos_binding,
    		modulemovement_bobSize_binding,
    		h2_input_handler,
    		mouseenter_handler,
    		mouseleave_handler,
    		mouseenter_handler_1,
    		mouseleave_handler_1,
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
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCF",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get state() {
    		throw new Error("<VCF>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<VCF>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\modules\Mixer.svelte generated by Svelte v3.59.2 */
    const file$5 = "src\\modules\\Mixer.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[45] = list[i];
    	child_ctx[47] = i;
    	return child_ctx;
    }

    // (225:0) {#if !module.destroyed}
    function create_if_block$5(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_helpBtn;
    	let updating_nodeSize;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div6;
    	let div0;
    	let deletebutton;
    	let t1;
    	let div1;
    	let helpbutton;
    	let t2;
    	let h1;
    	let t3_value = /*module*/ ctx[0].state.id + "";
    	let t3;
    	let t4;
    	let div4;
    	let h2;
    	let t5_value = /*module*/ ctx[0].state.title + "";
    	let t5;
    	let t6;
    	let div3;
    	let label;
    	let t7;
    	let div2;
    	let t8;
    	let div5;
    	let p;
    	let t9;
    	let br0;
    	let br1;
    	let div6_style_value;
    	let t10;
    	let br2;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[24](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[25](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[26](value);
    	}

    	function modulemovement_helpBtn_binding(value) {
    		/*modulemovement_helpBtn_binding*/ ctx[27](value);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		/*modulemovement_nodeSize_binding*/ ctx[28](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[29](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[30](value);
    	}

    	let modulemovement_props = {};

    	if (/*moduleNode*/ ctx[1] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[1];
    	}

    	if (/*controlsNode*/ ctx[2] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[2];
    	}

    	if (/*deleteNode*/ ctx[3] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[3];
    	}

    	if (/*helpBtn*/ ctx[7] !== void 0) {
    		modulemovement_props.helpBtn = /*helpBtn*/ ctx[7];
    	}

    	if (/*nodeSize*/ ctx[8] !== void 0) {
    		modulemovement_props.nodeSize = /*nodeSize*/ ctx[8];
    	}

    	if (/*module*/ ctx[0].state.position !== void 0) {
    		modulemovement_props.nodePos = /*module*/ ctx[0].state.position;
    	}

    	if (/*bobSize*/ ctx[9] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[9];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'helpBtn', modulemovement_helpBtn_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodeSize', modulemovement_nodeSize_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[0] },
    			$$inline: true
    		});

    	helpbutton = new HelpButton({
    			props: { module: /*module*/ ctx[0] },
    			$$inline: true
    		});

    	let each_value = /*module*/ ctx[0].state.inputIds;
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
    			div6 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(helpbutton.$$.fragment);
    			t2 = space();
    			h1 = element("h1");
    			t3 = text(t3_value);
    			t4 = space();
    			div4 = element("div");
    			h2 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			div3 = element("div");
    			label = element("label");
    			t7 = text("Inputs\r\n    ");
    			div2 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t8 = space();
    			div5 = element("div");
    			p = element("p");
    			t9 = text("Combines inputs together into one signal, allowing for more complex, multi-layered synth patches.");
    			br0 = element("br");
    			br1 = element("br");
    			t10 = space();
    			br2 = element("br");
    			attr_dev(div0, "class", "delete svelte-1mlbx33");
    			add_location(div0, file$5, 228, 4, 7555);
    			attr_dev(div1, "class", "help svelte-1mlbx33");
    			add_location(div1, file$5, 229, 4, 7633);
    			add_location(h1, file$5, 230, 4, 7708);
    			attr_dev(h2, "class", "editableTitle svelte-1mlbx33");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[31].call(h2));
    			add_location(h2, file$5, 232, 4, 7781);
    			attr_dev(div2, "id", "inputs");
    			add_location(div2, file$5, 236, 4, 7998);
    			attr_dev(label, "for", "inputs");
    			attr_dev(label, "class", "svelte-1mlbx33");
    			add_location(label, file$5, 235, 4, 7966);
    			add_location(div3, file$5, 234, 4, 7937);
    			attr_dev(div4, "id", "controls");
    			add_location(div4, file$5, 231, 4, 7740);
    			add_location(br0, file$5, 253, 108, 8765);
    			add_location(br1, file$5, 253, 112, 8769);
    			attr_dev(p, "class", "svelte-1mlbx33");
    			add_location(p, file$5, 253, 8, 8665);
    			add_location(div5, file$5, 252, 4, 8635);
    			attr_dev(div6, "id", "module");
    			attr_dev(div6, "style", div6_style_value = "background-color: " + /*$colours*/ ctx[6][/*module*/ ctx[0].state.type]);
    			attr_dev(div6, "class", "svelte-1mlbx33");
    			add_location(div6, file$5, 227, 0, 7459);
    			add_location(br2, file$5, 257, 0, 8809);
    			add_location(main, file$5, 225, 0, 7275);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div6);
    			append_dev(div6, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div6, t1);
    			append_dev(div6, div1);
    			mount_component(helpbutton, div1, null);
    			append_dev(div6, t2);
    			append_dev(div6, h1);
    			append_dev(h1, t3);
    			append_dev(div6, t4);
    			append_dev(div6, div4);
    			append_dev(div4, h2);
    			append_dev(h2, t5);

    			if (/*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title;
    			}

    			append_dev(div4, t6);
    			append_dev(div4, div3);
    			append_dev(div3, label);
    			append_dev(label, t7);
    			append_dev(label, div2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div2, null);
    				}
    			}

    			append_dev(div6, t8);
    			append_dev(div6, div5);
    			append_dev(div5, p);
    			append_dev(p, t9);
    			append_dev(p, br0);
    			append_dev(p, br1);
    			append_dev(main, t10);
    			append_dev(main, br2);
    			/*main_binding*/ ctx[35](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[12].call(null, div0)),
    					action_destroyer(/*setHelpBtn*/ ctx[15].call(null, div1)),
    					action_destroyer(/*setTitleNode*/ ctx[14].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[31]),
    					action_destroyer(/*setNotHelpDiv*/ ctx[17].call(null, div3)),
    					action_destroyer(/*setControls*/ ctx[11].call(null, div4)),
    					action_destroyer(/*setHelpDiv*/ ctx[16].call(null, div5)),
    					action_destroyer(/*setModule*/ ctx[10].call(null, div6))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 2) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[1];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 4) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[2];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 8) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[3];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_helpBtn && dirty[0] & /*helpBtn*/ 128) {
    				updating_helpBtn = true;
    				modulemovement_changes.helpBtn = /*helpBtn*/ ctx[7];
    				add_flush_callback(() => updating_helpBtn = false);
    			}

    			if (!updating_nodeSize && dirty[0] & /*nodeSize*/ 256) {
    				updating_nodeSize = true;
    				modulemovement_changes.nodeSize = /*nodeSize*/ ctx[8];
    				add_flush_callback(() => updating_nodeSize = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*module*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*module*/ ctx[0].state.position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 512) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[9];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 1) deletebutton_changes.module = /*module*/ ctx[0];
    			deletebutton.$set(deletebutton_changes);
    			const helpbutton_changes = {};
    			if (dirty[0] & /*module*/ 1) helpbutton_changes.module = /*module*/ ctx[0];
    			helpbutton.$set(helpbutton_changes);
    			if ((!current || dirty[0] & /*module*/ 1) && t3_value !== (t3_value = /*module*/ ctx[0].state.id + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty[0] & /*module*/ 1) && t5_value !== (t5_value = /*module*/ ctx[0].state.title + "")) set_data_contenteditable_dev(t5, t5_value);

    			if (dirty[0] & /*$modules, module*/ 33 && /*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title;
    			}

    			if (dirty[0] & /*module, $selectingModule, chooseInput, $modules*/ 524337) {
    				each_value = /*module*/ ctx[0].state.inputIds;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 65 && div6_style_value !== (div6_style_value = "background-color: " + /*$colours*/ ctx[6][/*module*/ ctx[0].state.type])) {
    				attr_dev(div6, "style", div6_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			transition_in(helpbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			transition_out(helpbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_component(helpbutton);
    			destroy_each(each_blocks, detaching);
    			/*main_binding*/ ctx[35](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(225:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    // (243:12) {:else}
    function create_else_block$2(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(243:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (241:12) {#if module.state.inputIds[i] != null && $modules[module.state.inputIds[i]]}
    function create_if_block_1$1(ctx) {
    	let t0_value = /*module*/ ctx[0].state.inputIds[/*i*/ ctx[47]] + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[5][/*module*/ ctx[0].state.inputIds[/*i*/ ctx[47]]].state.title + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*module*/ 1 && t0_value !== (t0_value = /*module*/ ctx[0].state.inputIds[/*i*/ ctx[47]] + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, module*/ 33 && t2_value !== (t2_value = /*$modules*/ ctx[5][/*module*/ ctx[0].state.inputIds[/*i*/ ctx[47]]].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(241:12) {#if module.state.inputIds[i] != null && $modules[module.state.inputIds[i]]}",
    		ctx
    	});

    	return block;
    }

    // (238:4) {#each module.state.inputIds as inputId, i}
    function create_each_block$1(ctx) {
    	let div;
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*module*/ ctx[0].state.inputIds[/*i*/ ctx[47]] != null && /*$modules*/ ctx[5][/*module*/ ctx[0].state.inputIds[/*i*/ ctx[47]]]) return create_if_block_1$1;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	function click_handler() {
    		return /*click_handler*/ ctx[32](/*i*/ ctx[47]);
    	}

    	function mouseenter_handler() {
    		return /*mouseenter_handler*/ ctx[33](/*inputId*/ ctx[45]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			button = element("button");
    			if_block.c();
    			t = space();
    			attr_dev(button, "class", "svelte-1mlbx33");
    			add_location(button, file$5, 239, 8, 8226);
    			attr_dev(div, "class", "inputDiv");
    			add_location(div, file$5, 238, 8, 8074);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button);
    			if_block.m(button, null);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setInputBtn*/ ctx[13].call(null, button, [/*i*/ ctx[47]])),
    					listen_dev(button, "click", click_handler, false, false, false, false),
    					listen_dev(div, "mouseenter", mouseenter_handler, false, false, false, false),
    					listen_dev(div, "mouseleave", /*mouseleave_handler*/ ctx[34], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(button, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(238:4) {#each module.state.inputIds as inputId, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[0].destroyed && create_if_block$5(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[0].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$5(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $selectingModule;
    	let $modules;
    	let $colours;
    	let $opacity;
    	let $isTyping;
    	let $output;
    	let $context;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(4, $selectingModule = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(5, $modules = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(6, $colours = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(41, $isTyping = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(42, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(43, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Mixer', slots, []);

    	let { state = {
    		type: 'mixer',
    		id: createNewId(),
    		inputIds: [null, null, null, null],
    		title: 'Mixer'
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = true;
    	module.isControl = false;
    	if (!module.state.position) module.state.position = setPosition();
    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let inputBtns = [null, null, null, null];
    	let titleNode;
    	let helpBtn;
    	let helpDiv;
    	let notHelpDiv;
    	let nodeSize = { x: 180, y: 370 };
    	module.selectingInput = false;
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	let currentInputs = [null, null, null, null];

    	module.clearCurrents = () => {
    		$$invalidate(22, currentInputs = [null, null, null, null]);
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		if (titleNode) titleNode.style.outline = "none";
    	});

    	function setModule(node) {
    		$$invalidate(1, moduleNode = node);

    		moduleNode.addEventListener("mousedown", () => {
    			moduleIsClicked = true;
    		});

    		moduleNode.addEventListener("mouseup", () => {
    			if (moduleIsClicked) {
    				if ($selectingModule == "output") {
    					$output.select(module.state.id);
    				} else if ($selectingModule != null && $modules[$selectingModule].selectingInput && $selectingModule != module.state.id && ($modules[$selectingModule].state.type != "mixer" || (!$modules[$selectingModule].state.inputIds.includes(module.state.id) || $modules[$selectingModule].state.inputIds[$modules[$selectingModule].inputSelecting] == module.state.id))) {
    					$modules[$selectingModule].select(module.state.id);
    				} else if ($selectingModule == module.state.id) {
    					module.select(null);
    				}
    			}
    		});
    	}

    	function setControls(node) {
    		$$invalidate(2, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(3, deleteNode = node);
    	}

    	function setInputBtn(node, i) {
    		$$invalidate(21, inputBtns[i] = node, inputBtns);

    		inputBtns[i].addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(21, inputBtns[i].style.opacity = 0.8, inputBtns);
    		});

    		inputBtns[i].addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(21, inputBtns[i].style.opacity = 1, inputBtns);
    		});
    	}

    	function setTitleNode(node) {
    		titleNode = node;

    		titleNode.addEventListener("mouseenter", () => {
    			titleNode.style.outline = "2px solid #222222";
    		});

    		titleNode.addEventListener("mouseleave", () => {
    			if (!moduleTyping) titleNode.style.outline = "none";
    		});

    		titleNode.addEventListener("mousedown", () => {
    			setTimeout(
    				() => {
    					set_store_value(isTyping, $isTyping = true, $isTyping);
    					moduleTyping = true;
    					titleNode.style.outline = "2px solid #222222";
    				},
    				10
    			);
    		});
    	}

    	function setHelpBtn(node) {
    		$$invalidate(7, helpBtn = node);
    	}

    	function setHelpDiv(node) {
    		helpDiv = node;
    		helpDiv.style.display = "none";
    	}

    	function setNotHelpDiv(node) {
    		notHelpDiv = node;
    	}

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(23, $opacity = value));
    	let bobSize = spring(0, { stiffness: 0.3, damping: 0.2 });

    	module.fade = () => {
    		opacity.set(0.2);
    	};

    	module.halfFade = () => {
    		opacity.set(0.8);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	module.bob = () => {
    		bobSize.set(10);

    		setTimeout(
    			() => {
    				bobSize.set(0);
    			},
    			50
    		);
    	};

    	module.toggleHelp = () => {
    		$$invalidate(0, module.showingHelp = !module.showingHelp, module);

    		if (notHelpDiv) {
    			if (!module.showingHelp) {
    				notHelpDiv.style.display = "initial";
    			} else {
    				notHelpDiv.style.display = "none";
    			}
    		}

    		if (helpDiv) {
    			if (module.showingHelp) {
    				helpDiv.style.display = "initial";
    			} else {
    				helpDiv.style.display = "none";
    			}
    		}

    		if (module.showingHelp) {
    			$$invalidate(8, nodeSize = { x: 180, y: 290 });
    		} else {
    			$$invalidate(8, nodeSize = { x: 180, y: 370 });
    		}
    	};

    	module.inputSelecting = null;

    	function chooseInput(i) {
    		$$invalidate(0, module.inputSelecting = i, module);
    		if (!inputBtns[i]) return;
    		mixerInputHover(module, module.state.inputIds[i]);

    		if (!module.selectingInput) {
    			$$invalidate(0, module.selectingInput = true, module);
    			$$invalidate(21, inputBtns[module.inputSelecting].style.opacity = 0.5, inputBtns);
    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(0, module.selectingInput = false, module);
    		}
    	}

    	module.select = id => {
    		if (module.selectingInput) {
    			$$invalidate(0, module.state.inputIds[module.inputSelecting] = id, module);
    			$$invalidate(21, inputBtns[module.inputSelecting].style.opacity = 1, inputBtns);
    			$$invalidate(0, module.selectingInput = false, module);
    		}

    		set_store_value(selectingModule, $selectingModule = null, $selectingModule);
    		unhover();
    	};

    	module.bob();
    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Mixer> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(1, moduleNode), $$invalidate(23, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(2, controlsNode), $$invalidate(3, deleteNode)), $$invalidate(4, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(3, deleteNode), $$invalidate(2, controlsNode)), $$invalidate(4, $selectingModule));
    	}

    	function modulemovement_helpBtn_binding(value) {
    		helpBtn = value;
    		$$invalidate(7, helpBtn);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		nodeSize = value;
    		$$invalidate(8, nodeSize);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(module.state.position, value)) {
    			module.state.position = value;
    			$$invalidate(0, module);
    		}
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(9, bobSize);
    	}

    	function h2_input_handler() {
    		$modules[module.state.id].state.title = this.textContent;
    		modules.set($modules);
    	}

    	const click_handler = i => chooseInput(i);
    	const mouseenter_handler = inputId => mixerInputHover(module, inputId);

    	const mouseleave_handler = () => {
    		if ($selectingModule == null) unhover();
    	};

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(0, module);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(20, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		colours,
    		selectingModule,
    		output,
    		isTyping,
    		ModuleMovement,
    		DeleteButton,
    		HelpButton,
    		createNewId,
    		mixerInputHover,
    		unhover,
    		setPosition,
    		spring,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		inputBtns,
    		titleNode,
    		helpBtn,
    		helpDiv,
    		notHelpDiv,
    		nodeSize,
    		gainNode,
    		currentInputs,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setTitleNode,
    		setHelpBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		opacity,
    		bobSize,
    		chooseInput,
    		$selectingModule,
    		$modules,
    		$colours,
    		$opacity,
    		$isTyping,
    		$output,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(20, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(1, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(2, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(3, deleteNode = $$props.deleteNode);
    		if ('inputBtns' in $$props) $$invalidate(21, inputBtns = $$props.inputBtns);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('helpBtn' in $$props) $$invalidate(7, helpBtn = $$props.helpBtn);
    		if ('helpDiv' in $$props) helpDiv = $$props.helpDiv;
    		if ('notHelpDiv' in $$props) notHelpDiv = $$props.notHelpDiv;
    		if ('nodeSize' in $$props) $$invalidate(8, nodeSize = $$props.nodeSize);
    		if ('gainNode' in $$props) $$invalidate(44, gainNode = $$props.gainNode);
    		if ('currentInputs' in $$props) $$invalidate(22, currentInputs = $$props.currentInputs);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(18, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(9, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $modules, currentInputs*/ 4194337) {
    			module.state.inputIds.forEach((id, i) => {
    				if (id != null && $modules[id] && $modules[id].output) {
    					if (currentInputs[i]) currentInputs[i].disconnect(gainNode);
    					$$invalidate(22, currentInputs[i] = $modules[id].output, currentInputs);
    					currentInputs[i].connect(gainNode);
    				} else {
    					if (currentInputs[i]) currentInputs[i].disconnect(gainNode);
    					$$invalidate(22, currentInputs[i] = null, currentInputs);
    				}
    			});
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 8388610) {
    			if (moduleNode) $$invalidate(1, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module, inputBtns, $colours, $modules*/ 2097249) {
    			if (!module.destroyed) {
    				inputBtns.forEach((btn, i) => {
    					if (btn != null) {
    						if (module.state.inputIds[i] != null) {
    							btn.style.backgroundColor = $colours[$modules[module.state.inputIds[i]].state.type];
    						} else {
    							btn.style.backgroundColor = "#f0f0f0";
    						}
    					}
    				});
    			}
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 28) {
    			if (controlsNode && deleteNode) {
    				if ($selectingModule != null) {
    					$$invalidate(2, controlsNode.style.pointerEvents = "none", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "none", deleteNode);
    				} else {
    					$$invalidate(2, controlsNode.style.pointerEvents = "all", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "all", deleteNode);
    				}
    			}
    		}
    	};

    	return [
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		$selectingModule,
    		$modules,
    		$colours,
    		helpBtn,
    		nodeSize,
    		bobSize,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setTitleNode,
    		setHelpBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		opacity,
    		chooseInput,
    		state,
    		inputBtns,
    		currentInputs,
    		$opacity,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_helpBtn_binding,
    		modulemovement_nodeSize_binding,
    		modulemovement_nodePos_binding,
    		modulemovement_bobSize_binding,
    		h2_input_handler,
    		click_handler,
    		mouseenter_handler,
    		mouseleave_handler,
    		main_binding
    	];
    }

    class Mixer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { state: 20 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Mixer",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get state() {
    		throw new Error("<Mixer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Mixer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\modules\LFO.svelte generated by Svelte v3.59.2 */
    const file$4 = "src\\modules\\LFO.svelte";

    // (178:0) {#if !module.destroyed}
    function create_if_block$4(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_helpBtn;
    	let updating_nodePos;
    	let updating_nodeSize;
    	let updating_bobSize;
    	let t0;
    	let div5;
    	let div0;
    	let deletebutton;
    	let t1;
    	let div1;
    	let helpbutton;
    	let t2;
    	let h1;
    	let t3_value = /*module*/ ctx[1].state.id + "";
    	let t3;
    	let t4;
    	let div3;
    	let h2;
    	let t5_value = /*module*/ ctx[1].state.title + "";
    	let t5;
    	let t6;
    	let div2;
    	let label0;
    	let t7;
    	let t8_value = /*oscNode*/ ctx[7].frequency.value.toFixed(2) + "";
    	let t8;
    	let t9;
    	let input0;
    	let t10;
    	let br0;
    	let section;
    	let input1;
    	let input1_id_value;
    	let label1;
    	let t11;
    	let label1_for_value;
    	let t12;
    	let input2;
    	let input2_id_value;
    	let label2;
    	let t13;
    	let label2_for_value;
    	let t14;
    	let input3;
    	let input3_id_value;
    	let label3;
    	let t15;
    	let label3_for_value;
    	let t16;
    	let input4;
    	let input4_id_value;
    	let label4;
    	let t17;
    	let label4_for_value;
    	let t18;
    	let div4;
    	let p;
    	let t19;
    	let br1;
    	let br2;
    	let t20;
    	let br3;
    	let br4;
    	let t21;
    	let br5;
    	let br6;
    	let t22;
    	let br7;
    	let br8;
    	let div5_style_value;
    	let t23;
    	let br9;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[22](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[23](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[24](value);
    	}

    	function modulemovement_helpBtn_binding(value) {
    		/*modulemovement_helpBtn_binding*/ ctx[25](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[26](value);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		/*modulemovement_nodeSize_binding*/ ctx[27](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[28](value);
    	}

    	let modulemovement_props = {};

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*deleteNode*/ ctx[4] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[4];
    	}

    	if (/*helpBtn*/ ctx[5] !== void 0) {
    		modulemovement_props.helpBtn = /*helpBtn*/ ctx[5];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	if (/*nodeSize*/ ctx[6] !== void 0) {
    		modulemovement_props.nodeSize = /*nodeSize*/ ctx[6];
    	}

    	if (/*bobSize*/ ctx[8] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[8];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'helpBtn', modulemovement_helpBtn_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodeSize', modulemovement_nodeSize_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	helpbutton = new HelpButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[32][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div5 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(helpbutton.$$.fragment);
    			t2 = space();
    			h1 = element("h1");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			h2 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			div2 = element("div");
    			label0 = element("label");
    			t7 = text("Frequency (");
    			t8 = text(t8_value);
    			t9 = text("Hz)");
    			input0 = element("input");
    			t10 = space();
    			br0 = element("br");
    			section = element("section");
    			input1 = element("input");
    			label1 = element("label");
    			t11 = text("Sine");
    			t12 = space();
    			input2 = element("input");
    			label2 = element("label");
    			t13 = text("Triangle");
    			t14 = space();
    			input3 = element("input");
    			label3 = element("label");
    			t15 = text("Sawtooth");
    			t16 = space();
    			input4 = element("input");
    			label4 = element("label");
    			t17 = text("Square");
    			t18 = space();
    			div4 = element("div");
    			p = element("p");
    			t19 = text("Low Frequency Oscillator.");
    			br1 = element("br");
    			br2 = element("br");
    			t20 = text("\r\n                Can be selected as a Control option on other modules to automate parameters.");
    			br3 = element("br");
    			br4 = element("br");
    			t21 = text("\r\n                Causes the value of connected parameters to rise and fall periodically.");
    			br5 = element("br");
    			br6 = element("br");
    			t22 = text("\r\n                Frequency parameter determines the rate at which the LFO oscillates.");
    			br7 = element("br");
    			br8 = element("br");
    			t23 = space();
    			br9 = element("br");
    			attr_dev(div0, "class", "delete svelte-19css60");
    			add_location(div0, file$4, 181, 8, 5413);
    			attr_dev(div1, "class", "help svelte-19css60");
    			add_location(div1, file$4, 182, 8, 5495);
    			add_location(h1, file$4, 183, 8, 5574);
    			attr_dev(h2, "class", "editableTitle svelte-19css60");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[29].call(h2));
    			add_location(h2, file$4, 185, 12, 5659);
    			attr_dev(label0, "for", "freq");
    			add_location(label0, file$4, 188, 12, 5872);
    			attr_dev(input0, "id", "freq");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0.001");
    			attr_dev(input0, "max", "2");
    			attr_dev(input0, "step", "0.001");
    			add_location(input0, file$4, 188, 88, 5948);
    			add_location(br0, file$4, 189, 12, 6061);
    			attr_dev(input1, "id", input1_id_value = 'sine' + /*module*/ ctx[1].state.id);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "sine";
    			input1.value = input1.__value;
    			attr_dev(input1, "class", "svelte-19css60");
    			add_location(input1, file$4, 190, 16, 6106);
    			attr_dev(label1, "for", label1_for_value = 'sine' + /*module*/ ctx[1].state.id);
    			attr_dev(label1, "class", "svelte-19css60");
    			add_location(label1, file$4, 190, 111, 6201);
    			attr_dev(input2, "id", input2_id_value = 'triangle' + /*module*/ ctx[1].state.id);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "triangle";
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-19css60");
    			add_location(input2, file$4, 191, 16, 6267);
    			attr_dev(label2, "for", label2_for_value = 'triangle' + /*module*/ ctx[1].state.id);
    			attr_dev(label2, "class", "svelte-19css60");
    			add_location(label2, file$4, 191, 120, 6371);
    			attr_dev(input3, "id", input3_id_value = 'sawtooth' + /*module*/ ctx[1].state.id);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "sawtooth";
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-19css60");
    			add_location(input3, file$4, 192, 16, 6445);
    			attr_dev(label3, "for", label3_for_value = 'sawtooth' + /*module*/ ctx[1].state.id);
    			attr_dev(label3, "class", "svelte-19css60");
    			add_location(label3, file$4, 192, 119, 6548);
    			attr_dev(input4, "id", input4_id_value = 'square' + /*module*/ ctx[1].state.id);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "square";
    			input4.value = input4.__value;
    			attr_dev(input4, "class", "svelte-19css60");
    			add_location(input4, file$4, 193, 16, 6622);
    			attr_dev(label4, "for", label4_for_value = 'square' + /*module*/ ctx[1].state.id);
    			attr_dev(label4, "class", "svelte-19css60");
    			add_location(label4, file$4, 193, 115, 6721);
    			attr_dev(section, "class", "shape svelte-19css60");
    			add_location(section, file$4, 189, 16, 6065);
    			add_location(div2, file$4, 187, 12, 5835);
    			attr_dev(div3, "id", "controls");
    			add_location(div3, file$4, 184, 8, 5610);
    			add_location(br1, file$4, 199, 41, 6923);
    			add_location(br2, file$4, 199, 45, 6927);
    			add_location(br3, file$4, 200, 92, 7025);
    			add_location(br4, file$4, 200, 96, 7029);
    			add_location(br5, file$4, 201, 87, 7122);
    			add_location(br6, file$4, 201, 91, 7126);
    			add_location(br7, file$4, 202, 84, 7216);
    			add_location(br8, file$4, 202, 88, 7220);
    			attr_dev(p, "class", "svelte-19css60");
    			add_location(p, file$4, 198, 12, 6877);
    			add_location(div4, file$4, 197, 8, 6843);
    			attr_dev(div5, "id", "module");
    			attr_dev(div5, "style", div5_style_value = "background-color: " + /*$colours*/ ctx[10][/*module*/ ctx[1].state.type]);
    			attr_dev(div5, "class", "svelte-19css60");
    			add_location(div5, file$4, 180, 4, 5313);
    			add_location(br9, file$4, 206, 4, 7276);
    			add_location(main, file$4, 178, 0, 5128);
    			binding_group.p(input1, input2, input3, input4);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div5);
    			append_dev(div5, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div5, t1);
    			append_dev(div5, div1);
    			mount_component(helpbutton, div1, null);
    			append_dev(div5, t2);
    			append_dev(div5, h1);
    			append_dev(h1, t3);
    			append_dev(div5, t4);
    			append_dev(div5, div3);
    			append_dev(div3, h2);
    			append_dev(h2, t5);

    			if (/*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title;
    			}

    			append_dev(div3, t6);
    			append_dev(div3, div2);
    			append_dev(div2, label0);
    			append_dev(label0, t7);
    			append_dev(label0, t8);
    			append_dev(label0, t9);
    			append_dev(div2, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.frequency);
    			append_dev(div2, t10);
    			append_dev(div2, br0);
    			append_dev(div2, section);
    			append_dev(section, input1);
    			input1.checked = input1.__value === /*module*/ ctx[1].state.shape;
    			append_dev(section, label1);
    			append_dev(label1, t11);
    			append_dev(section, t12);
    			append_dev(section, input2);
    			input2.checked = input2.__value === /*module*/ ctx[1].state.shape;
    			append_dev(section, label2);
    			append_dev(label2, t13);
    			append_dev(section, t14);
    			append_dev(section, input3);
    			input3.checked = input3.__value === /*module*/ ctx[1].state.shape;
    			append_dev(section, label3);
    			append_dev(label3, t15);
    			append_dev(section, t16);
    			append_dev(section, input4);
    			input4.checked = input4.__value === /*module*/ ctx[1].state.shape;
    			append_dev(section, label4);
    			append_dev(label4, t17);
    			append_dev(div5, t18);
    			append_dev(div5, div4);
    			append_dev(div4, p);
    			append_dev(p, t19);
    			append_dev(p, br1);
    			append_dev(p, br2);
    			append_dev(p, t20);
    			append_dev(p, br3);
    			append_dev(p, br4);
    			append_dev(p, t21);
    			append_dev(p, br5);
    			append_dev(p, br6);
    			append_dev(p, t22);
    			append_dev(p, br7);
    			append_dev(p, br8);
    			append_dev(main, t23);
    			append_dev(main, br9);
    			/*main_binding*/ ctx[36](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[13].call(null, div0)),
    					action_destroyer(/*setHelpBtn*/ ctx[15].call(null, div1)),
    					action_destroyer(/*setTitleNode*/ ctx[14].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[29]),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[30]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[30]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[31]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[33]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[34]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[35]),
    					action_destroyer(/*setNotHelpDiv*/ ctx[17].call(null, div2)),
    					action_destroyer(/*setControls*/ ctx[12].call(null, div3)),
    					action_destroyer(/*setHelpDiv*/ ctx[16].call(null, div4)),
    					action_destroyer(/*setModule*/ ctx[11].call(null, div5))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 4) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[2];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 8) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[3];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 16) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[4];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_helpBtn && dirty[0] & /*helpBtn*/ 32) {
    				updating_helpBtn = true;
    				modulemovement_changes.helpBtn = /*helpBtn*/ ctx[5];
    				add_flush_callback(() => updating_helpBtn = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_nodeSize && dirty[0] & /*nodeSize*/ 64) {
    				updating_nodeSize = true;
    				modulemovement_changes.nodeSize = /*nodeSize*/ ctx[6];
    				add_flush_callback(() => updating_nodeSize = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 256) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[8];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			const helpbutton_changes = {};
    			if (dirty[0] & /*module*/ 2) helpbutton_changes.module = /*module*/ ctx[1];
    			helpbutton.$set(helpbutton_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t3_value !== (t3_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty[0] & /*module*/ 2) && t5_value !== (t5_value = /*module*/ ctx[1].state.title + "")) set_data_contenteditable_dev(t5, t5_value);

    			if (dirty[0] & /*$modules, module*/ 514 && /*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title;
    			}

    			if ((!current || dirty[0] & /*oscNode*/ 128) && t8_value !== (t8_value = /*oscNode*/ ctx[7].frequency.value.toFixed(2) + "")) set_data_dev(t8, t8_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input0, /*module*/ ctx[1].state.frequency);
    			}

    			if (!current || dirty[0] & /*module*/ 2 && input1_id_value !== (input1_id_value = 'sine' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input1, "id", input1_id_value);
    			}

    			if (dirty[0] & /*module*/ 2) {
    				input1.checked = input1.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (!current || dirty[0] & /*module*/ 2 && label1_for_value !== (label1_for_value = 'sine' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label1, "for", label1_for_value);
    			}

    			if (!current || dirty[0] & /*module*/ 2 && input2_id_value !== (input2_id_value = 'triangle' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input2, "id", input2_id_value);
    			}

    			if (dirty[0] & /*module*/ 2) {
    				input2.checked = input2.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (!current || dirty[0] & /*module*/ 2 && label2_for_value !== (label2_for_value = 'triangle' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label2, "for", label2_for_value);
    			}

    			if (!current || dirty[0] & /*module*/ 2 && input3_id_value !== (input3_id_value = 'sawtooth' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input3, "id", input3_id_value);
    			}

    			if (dirty[0] & /*module*/ 2) {
    				input3.checked = input3.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (!current || dirty[0] & /*module*/ 2 && label3_for_value !== (label3_for_value = 'sawtooth' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label3, "for", label3_for_value);
    			}

    			if (!current || dirty[0] & /*module*/ 2 && input4_id_value !== (input4_id_value = 'square' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input4, "id", input4_id_value);
    			}

    			if (dirty[0] & /*module*/ 2) {
    				input4.checked = input4.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (!current || dirty[0] & /*module*/ 2 && label4_for_value !== (label4_for_value = 'square' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label4, "for", label4_for_value);
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 1026 && div5_style_value !== (div5_style_value = "background-color: " + /*$colours*/ ctx[10][/*module*/ ctx[1].state.type])) {
    				attr_dev(div5, "style", div5_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			transition_in(helpbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			transition_out(helpbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_component(helpbutton);
    			/*main_binding*/ ctx[36](null);
    			binding_group.r();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(178:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[1].destroyed && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[1].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $selectingModule;
    	let $opacity;
    	let $isTyping;
    	let $modules;
    	let $context;
    	let $colours;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(20, $selectingModule = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(42, $isTyping = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(9, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(43, $context = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(10, $colours = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('LFO', slots, []);

    	let { state = {
    		type: 'lfo',
    		frequency: 1,
    		shape: 'sine',
    		id: createNewId(),
    		title: 'LFO'
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = false;
    	module.isControl = true;
    	if (!module.state.position) module.state.position = setPosition();
    	module.outputs = {};
    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let titleNode;
    	let helpBtn;
    	let helpDiv;
    	let notHelpDiv;
    	let nodeSize = { x: 320, y: 250 };
    	let oscNode = $context.createOscillator();
    	let frequency;
    	oscNode.start(0);

    	module.addOutput = (id, cv) => {
    		$$invalidate(1, module.outputs[id] = $context.createGain(), module);
    		let output = module.outputs[id];
    		oscNode.connect(output);
    		output.connect(cv);
    	};

    	module.removeOutput = (id, cv) => {
    		let output = module.outputs[id];
    		oscNode.disconnect(output);
    		output.disconnect(cv);
    		delete module.outputs[id];
    	};

    	module.setGain = (id, gain) => {
    		if (module.outputs[id]) {
    			module.outputs[id].gain.linearRampToValueAtTime(gain, $context.currentTime + 0.01);
    		}
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		if (titleNode) titleNode.style.outline = "none";
    	});

    	function setModule(node) {
    		$$invalidate(2, moduleNode = node);

    		moduleNode.addEventListener("mousedown", () => {
    			moduleIsClicked = true;
    		});

    		moduleNode.addEventListener("mouseup", () => {
    			if (moduleIsClicked) {
    				if ($selectingModule != null && $modules[$selectingModule].selectingCv) $modules[$selectingModule].select(module.state.id);
    			}
    		});
    	}

    	function setControls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(4, deleteNode = node);
    	}

    	function setTitleNode(node) {
    		titleNode = node;

    		titleNode.addEventListener("mouseenter", () => {
    			titleNode.style.outline = "2px solid #222222";
    		});

    		titleNode.addEventListener("mouseleave", () => {
    			if (!moduleTyping) titleNode.style.outline = "none";
    		});

    		titleNode.addEventListener("mousedown", () => {
    			setTimeout(
    				() => {
    					set_store_value(isTyping, $isTyping = true, $isTyping);
    					moduleTyping = true;
    					titleNode.style.outline = "2px solid #222222";
    				},
    				10
    			);
    		});
    	}

    	function setHelpBtn(node) {
    		$$invalidate(5, helpBtn = node);
    	}

    	function setHelpDiv(node) {
    		helpDiv = node;
    		helpDiv.style.display = "none";
    	}

    	function setNotHelpDiv(node) {
    		notHelpDiv = node;
    	}

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(21, $opacity = value));
    	let bobSize = spring(0, { stiffness: 0.3, damping: 0.2 });

    	module.fade = () => {
    		opacity.set(0.2);
    	};

    	module.halfFade = () => {
    		opacity.set(0.8);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	module.bob = () => {
    		bobSize.set(10);

    		setTimeout(
    			() => {
    				bobSize.set(0);
    			},
    			50
    		);
    	};

    	module.toggleHelp = () => {
    		$$invalidate(1, module.showingHelp = !module.showingHelp, module);

    		if (notHelpDiv) {
    			if (!module.showingHelp) {
    				notHelpDiv.style.display = "initial";
    			} else {
    				notHelpDiv.style.display = "none";
    			}
    		}

    		if (helpDiv) {
    			if (module.showingHelp) {
    				helpDiv.style.display = "initial";
    			} else {
    				helpDiv.style.display = "none";
    			}
    		}

    		if (module.showingHelp) {
    			$$invalidate(6, nodeSize = { x: 320, y: 400 });
    		} else {
    			$$invalidate(6, nodeSize = { x: 320, y: 250 });
    		}
    	};

    	module.bob();
    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<LFO> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(21, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(3, controlsNode), $$invalidate(4, deleteNode)), $$invalidate(20, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(4, deleteNode), $$invalidate(3, controlsNode)), $$invalidate(20, $selectingModule));
    	}

    	function modulemovement_helpBtn_binding(value) {
    		helpBtn = value;
    		$$invalidate(5, helpBtn);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_nodeSize_binding(value) {
    		nodeSize = value;
    		$$invalidate(6, nodeSize);
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(8, bobSize);
    	}

    	function h2_input_handler() {
    		$modules[module.state.id].state.title = this.textContent;
    		modules.set($modules);
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
    		colours,
    		selectingModule,
    		isTyping,
    		ModuleMovement,
    		DeleteButton,
    		createNewId,
    		setPosition,
    		spring,
    		HelpButton,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		titleNode,
    		helpBtn,
    		helpDiv,
    		notHelpDiv,
    		nodeSize,
    		oscNode,
    		frequency,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		setHelpBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		opacity,
    		bobSize,
    		$selectingModule,
    		$opacity,
    		$isTyping,
    		$modules,
    		$context,
    		$colours
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(4, deleteNode = $$props.deleteNode);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('helpBtn' in $$props) $$invalidate(5, helpBtn = $$props.helpBtn);
    		if ('helpDiv' in $$props) helpDiv = $$props.helpDiv;
    		if ('notHelpDiv' in $$props) notHelpDiv = $$props.notHelpDiv;
    		if ('nodeSize' in $$props) $$invalidate(6, nodeSize = $$props.nodeSize);
    		if ('oscNode' in $$props) $$invalidate(7, oscNode = $$props.oscNode);
    		if ('frequency' in $$props) $$invalidate(19, frequency = $$props.frequency);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(18, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(8, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(19, frequency = Math.pow(20, module.state.frequency - 1));
    		}

    		if ($$self.$$.dirty[0] & /*frequency*/ 524288) {
    			$$invalidate(7, oscNode.frequency.value = frequency, oscNode);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(7, oscNode.type = module.state.shape, oscNode);
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 2097156) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 1048600) {
    			if (controlsNode && deleteNode) {
    				if ($selectingModule != null) {
    					$$invalidate(3, controlsNode.style.pointerEvents = "none", controlsNode);
    					$$invalidate(4, deleteNode.style.pointerEvents = "none", deleteNode);
    				} else {
    					$$invalidate(3, controlsNode.style.pointerEvents = "all", controlsNode);
    					$$invalidate(4, deleteNode.style.pointerEvents = "all", deleteNode);
    				}
    			}
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		helpBtn,
    		nodeSize,
    		oscNode,
    		bobSize,
    		$modules,
    		$colours,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		setHelpBtn,
    		setHelpDiv,
    		setNotHelpDiv,
    		opacity,
    		frequency,
    		$selectingModule,
    		$opacity,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_helpBtn_binding,
    		modulemovement_nodePos_binding,
    		modulemovement_nodeSize_binding,
    		modulemovement_bobSize_binding,
    		h2_input_handler,
    		input0_change_input_handler,
    		input1_change_handler,
    		$$binding_groups,
    		input2_change_handler,
    		input3_change_handler,
    		input4_change_handler,
    		main_binding
    	];
    }

    class LFO extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LFO",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get state() {
    		throw new Error("<LFO>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<LFO>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\modules\Delay.svelte generated by Svelte v3.59.2 */
    const file$3 = "src\\modules\\Delay.svelte";

    // (246:0) {#if !module.destroyed}
    function create_if_block$3(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_helpBtn;
    	let updating_nodeSize;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div6;
    	let div0;
    	let deletebutton;
    	let t1;
    	let div1;
    	let helpbutton;
    	let t2;
    	let h1;
    	let t3_value = /*module*/ ctx[4].state.id + "";
    	let t3;
    	let t4;
    	let div4;
    	let h2;
    	let t5_value = /*module*/ ctx[4].state.title + "";
    	let t5;
    	let t6;
    	let div3;
    	let div2;
    	let label0;
    	let button;
    	let t7;
    	let br0;
    	let t8;
    	let label1;
    	let t9;
    	let t10_value = /*module*/ ctx[4].state.delayTime.toFixed(2) + "";
    	let t10;
    	let t11;
    	let input;
    	let t12;
    	let div5;
    	let p;
    	let t13;
    	let br1;
    	let br2;
    	let t14;
    	let div6_style_value;
    	let t15;
    	let br3;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[25](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[26](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[27](value);
    	}

    	function modulemovement_helpBtn_binding(value) {
    		/*modulemovement_helpBtn_binding*/ ctx[28](value);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		/*modulemovement_nodeSize_binding*/ ctx[29](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[30](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[31](value);
    	}

    	let modulemovement_props = {};

    	if (/*moduleNode*/ ctx[1] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[1];
    	}

    	if (/*controlsNode*/ ctx[2] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[2];
    	}

    	if (/*deleteNode*/ ctx[3] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[3];
    	}

    	if (/*helpBtn*/ ctx[8] !== void 0) {
    		modulemovement_props.helpBtn = /*helpBtn*/ ctx[8];
    	}

    	if (/*nodeSize*/ ctx[9] !== void 0) {
    		modulemovement_props.nodeSize = /*nodeSize*/ ctx[9];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	if (/*bobSize*/ ctx[10] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[10];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'helpBtn', modulemovement_helpBtn_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodeSize', modulemovement_nodeSize_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[4] },
    			$$inline: true
    		});

    	helpbutton = new HelpButton({
    			props: { module: /*module*/ ctx[4] },
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*module*/ ctx[4].state.inputId != null && /*$modules*/ ctx[6][/*module*/ ctx[4].state.inputId]) return create_if_block_1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div6 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(helpbutton.$$.fragment);
    			t2 = space();
    			h1 = element("h1");
    			t3 = text(t3_value);
    			t4 = space();
    			div4 = element("div");
    			h2 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			div3 = element("div");
    			div2 = element("div");
    			label0 = element("label");
    			button = element("button");
    			if_block.c();
    			t7 = text(" Input");
    			br0 = element("br");
    			t8 = space();
    			label1 = element("label");
    			t9 = text("Delay Time (");
    			t10 = text(t10_value);
    			t11 = text("s)");
    			input = element("input");
    			t12 = space();
    			div5 = element("div");
    			p = element("p");
    			t13 = text("Causes the input signal to repeat, with each repetition gradually lowering in volume.");
    			br1 = element("br");
    			br2 = element("br");
    			t14 = text("\r\n            Delay Time parameter controls the time between each repetition.");
    			t15 = space();
    			br3 = element("br");
    			attr_dev(div0, "class", "delete svelte-1yeu6yr");
    			add_location(div0, file$3, 249, 4, 8044);
    			attr_dev(div1, "class", "help svelte-1yeu6yr");
    			add_location(div1, file$3, 250, 4, 8122);
    			add_location(h1, file$3, 251, 4, 8197);
    			attr_dev(h2, "class", "editableTitle svelte-1yeu6yr");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[6][/*module*/ ctx[4].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[32].call(h2));
    			add_location(h2, file$3, 253, 8, 8274);
    			attr_dev(button, "class", "svelte-1yeu6yr");
    			add_location(button, file$3, 257, 15, 8624);
    			add_location(label0, file$3, 257, 8, 8617);
    			attr_dev(div2, "class", "inputDiv");
    			add_location(div2, file$3, 256, 8, 8475);
    			add_location(br0, file$3, 263, 37, 8939);
    			attr_dev(label1, "for", "delayTime");
    			add_location(label1, file$3, 264, 8, 8953);
    			attr_dev(input, "id", "delayTime");
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0.01");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$3, 264, 88, 9033);
    			add_location(div3, file$3, 255, 8, 8442);
    			attr_dev(div4, "id", "controls");
    			add_location(div4, file$3, 252, 4, 8229);
    			add_location(br1, file$3, 268, 96, 9288);
    			add_location(br2, file$3, 268, 100, 9292);
    			attr_dev(p, "class", "svelte-1yeu6yr");
    			add_location(p, file$3, 268, 8, 9200);
    			add_location(div5, file$3, 267, 4, 9170);
    			attr_dev(div6, "id", "module");
    			attr_dev(div6, "style", div6_style_value = "background-color: " + /*$colours*/ ctx[7][/*module*/ ctx[4].state.type]);
    			attr_dev(div6, "class", "svelte-1yeu6yr");
    			add_location(div6, file$3, 248, 0, 7948);
    			add_location(br3, file$3, 273, 0, 9409);
    			add_location(main, file$3, 246, 0, 7771);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div6);
    			append_dev(div6, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div6, t1);
    			append_dev(div6, div1);
    			mount_component(helpbutton, div1, null);
    			append_dev(div6, t2);
    			append_dev(div6, h1);
    			append_dev(h1, t3);
    			append_dev(div6, t4);
    			append_dev(div6, div4);
    			append_dev(div4, h2);
    			append_dev(h2, t5);

    			if (/*$modules*/ ctx[6][/*module*/ ctx[4].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[6][/*module*/ ctx[4].state.id].state.title;
    			}

    			append_dev(div4, t6);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			append_dev(div2, label0);
    			append_dev(label0, button);
    			if_block.m(button, null);
    			append_dev(label0, t7);
    			append_dev(div3, br0);
    			append_dev(div3, t8);
    			append_dev(div3, label1);
    			append_dev(label1, t9);
    			append_dev(label1, t10);
    			append_dev(label1, t11);
    			append_dev(div3, input);
    			set_input_value(input, /*module*/ ctx[4].state.delayTime);
    			append_dev(div6, t12);
    			append_dev(div6, div5);
    			append_dev(div5, p);
    			append_dev(p, t13);
    			append_dev(p, br1);
    			append_dev(p, br2);
    			append_dev(p, t14);
    			append_dev(main, t15);
    			append_dev(main, br3);
    			/*main_binding*/ ctx[36](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[13].call(null, div0)),
    					action_destroyer(/*setHelpBtn*/ ctx[16].call(null, div1)),
    					action_destroyer(/*setTitleNode*/ ctx[15].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[32]),
    					action_destroyer(/*setInputBtn*/ ctx[14].call(null, button)),
    					listen_dev(button, "click", /*chooseInput*/ ctx[20], false, false, false, false),
    					listen_dev(div2, "mouseenter", /*mouseenter_handler*/ ctx[33], false, false, false, false),
    					listen_dev(div2, "mouseleave", /*mouseleave_handler*/ ctx[34], false, false, false, false),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[35]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[35]),
    					action_destroyer(/*setNotHelpDiv*/ ctx[17].call(null, div3)),
    					action_destroyer(/*setControls*/ ctx[12].call(null, div4)),
    					action_destroyer(/*setHelpDiv*/ ctx[18].call(null, div5)),
    					action_destroyer(/*setModule*/ ctx[11].call(null, div6))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 2) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[1];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 4) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[2];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 8) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[3];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_helpBtn && dirty[0] & /*helpBtn*/ 256) {
    				updating_helpBtn = true;
    				modulemovement_changes.helpBtn = /*helpBtn*/ ctx[8];
    				add_flush_callback(() => updating_helpBtn = false);
    			}

    			if (!updating_nodeSize && dirty[0] & /*nodeSize*/ 512) {
    				updating_nodeSize = true;
    				modulemovement_changes.nodeSize = /*nodeSize*/ ctx[9];
    				add_flush_callback(() => updating_nodeSize = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 1024) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[10];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 16) deletebutton_changes.module = /*module*/ ctx[4];
    			deletebutton.$set(deletebutton_changes);
    			const helpbutton_changes = {};
    			if (dirty[0] & /*module*/ 16) helpbutton_changes.module = /*module*/ ctx[4];
    			helpbutton.$set(helpbutton_changes);
    			if ((!current || dirty[0] & /*module*/ 16) && t3_value !== (t3_value = /*module*/ ctx[4].state.id + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty[0] & /*module*/ 16) && t5_value !== (t5_value = /*module*/ ctx[4].state.title + "")) set_data_contenteditable_dev(t5, t5_value);

    			if (dirty[0] & /*$modules, module*/ 80 && /*$modules*/ ctx[6][/*module*/ ctx[4].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[6][/*module*/ ctx[4].state.id].state.title;
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(button, null);
    				}
    			}

    			if ((!current || dirty[0] & /*module*/ 16) && t10_value !== (t10_value = /*module*/ ctx[4].state.delayTime.toFixed(2) + "")) set_data_dev(t10, t10_value);

    			if (dirty[0] & /*module*/ 16) {
    				set_input_value(input, /*module*/ ctx[4].state.delayTime);
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 144 && div6_style_value !== (div6_style_value = "background-color: " + /*$colours*/ ctx[7][/*module*/ ctx[4].state.type])) {
    				attr_dev(div6, "style", div6_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			transition_in(helpbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			transition_out(helpbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_component(helpbutton);
    			if_block.d();
    			/*main_binding*/ ctx[36](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(246:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    // (261:12) {:else}
    function create_else_block$1(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("None");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(261:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (259:12) {#if module.state.inputId != null && $modules[module.state.inputId]}
    function create_if_block_1(ctx) {
    	let t0_value = /*module*/ ctx[4].state.inputId + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[6][/*module*/ ctx[4].state.inputId].state.title + "";
    	let t2;

    	const block = {
    		c: function create() {
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*module*/ 16 && t0_value !== (t0_value = /*module*/ ctx[4].state.inputId + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, module*/ 80 && t2_value !== (t2_value = /*$modules*/ ctx[6][/*module*/ ctx[4].state.inputId].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(259:12) {#if module.state.inputId != null && $modules[module.state.inputId]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[4].destroyed && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[4].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 16) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $selectingModule;
    	let $modules;
    	let $colours;
    	let $opacity;
    	let $isTyping;
    	let $output;
    	let $context;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(5, $selectingModule = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(6, $modules = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(7, $colours = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(42, $isTyping = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(43, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(24, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Delay', slots, []);

    	let { state = {
    		type: 'delay',
    		id: createNewId(),
    		title: 'Delay',
    		inputId: null,
    		delayTime: 0.5
    	} } = $$props;

    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let titleNode;
    	let inputBtn;
    	let helpBtn;
    	let notHelpDiv;
    	let helpDiv;
    	let nodeSize = { x: 280, y: 265 };
    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = true;
    	module.isControl = false;
    	module.showingHelp = false;
    	if (!module.state.position) module.state.position = setPosition();
    	let mixerNode = $context.createGain();
    	let n = 10;
    	let delays = [];
    	let gains = [];

    	for (let i = 0; i < n; i++) {
    		let delayNode = $context.createDelay(20);
    		let gainNode = $context.createGain();
    		delayNode.connect(gainNode);
    		gainNode.connect(mixerNode);
    		delays.push(delayNode);
    		gains.push(gainNode);
    	}

    	module.output = mixerNode;

    	for (let i = 0; i < n; i++) {
    		gains[i].gain.setValueAtTime(1 - (i + 1) / n, $context.currentTime);
    	}

    	var currentInput;

    	module.clearCurrents = () => {
    		$$invalidate(22, currentInput = null);
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		if (titleNode) titleNode.style.outline = "none";
    	});

    	function setModule(node) {
    		$$invalidate(1, moduleNode = node);

    		moduleNode.addEventListener("mousedown", () => {
    			moduleIsClicked = true;
    		});

    		moduleNode.addEventListener("mouseup", () => {
    			if (moduleIsClicked) {
    				if ($selectingModule == "output") {
    					$output.select(module.state.id);
    				} else if ($selectingModule != null && $modules[$selectingModule].selectingInput && $selectingModule != module.state.id && ($modules[$selectingModule].state.type != "mixer" || (!$modules[$selectingModule].state.inputIds.includes(module.state.id) || $modules[$selectingModule].state.inputIds[$modules[$selectingModule].inputSelecting] == module.state.id))) {
    					$modules[$selectingModule].select(module.state.id);
    				} else if ($selectingModule == module.state.id) {
    					module.select(null);
    				}
    			}
    		});
    	}

    	function setControls(node) {
    		$$invalidate(2, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(3, deleteNode = node);
    	}

    	function setInputBtn(node) {
    		$$invalidate(21, inputBtn = node);

    		inputBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(21, inputBtn.style.opacity = 0.8, inputBtn);
    		});

    		inputBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(21, inputBtn.style.opacity = 1, inputBtn);
    		});
    	}

    	function setTitleNode(node) {
    		titleNode = node;

    		titleNode.addEventListener("mouseenter", () => {
    			titleNode.style.outline = "2px solid #222222";
    		});

    		titleNode.addEventListener("mouseleave", () => {
    			if (!moduleTyping) titleNode.style.outline = "none";
    		});

    		titleNode.addEventListener("mousedown", () => {
    			setTimeout(
    				() => {
    					set_store_value(isTyping, $isTyping = true, $isTyping);
    					moduleTyping = true;
    					titleNode.style.outline = "2px solid #222222";
    				},
    				10
    			);
    		});
    	}

    	function setHelpBtn(node) {
    		$$invalidate(8, helpBtn = node);
    	}

    	function setNotHelpDiv(node) {
    		notHelpDiv = node;
    	}

    	function setHelpDiv(node) {
    		helpDiv = node;
    		helpDiv.style.display = "none";
    	}

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(23, $opacity = value));
    	let bobSize = spring(0, { stiffness: 0.3, damping: 0.2 });

    	module.fade = () => {
    		opacity.set(0.2);
    	};

    	module.halfFade = () => {
    		opacity.set(0.8);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	module.bob = () => {
    		bobSize.set(10);

    		setTimeout(
    			() => {
    				bobSize.set(0);
    			},
    			50
    		);
    	};

    	module.toggleHelp = () => {
    		$$invalidate(4, module.showingHelp = !module.showingHelp, module);

    		if (notHelpDiv) {
    			if (!module.showingHelp) {
    				notHelpDiv.style.display = "initial";
    			} else {
    				notHelpDiv.style.display = "none";
    			}
    		}

    		if (helpDiv) {
    			if (module.showingHelp) {
    				helpDiv.style.display = "initial";
    			} else {
    				helpDiv.style.display = "none";
    			}
    		}

    		if (module.showingHelp) {
    			$$invalidate(9, nodeSize = { x: 280, y: 310 });
    		} else {
    			$$invalidate(9, nodeSize = { x: 280, y: 265 });
    		}
    	};

    	function chooseInput() {
    		inputsAllHover(module);
    		if (!inputBtn) return;

    		if (!module.selectingInput) {
    			$$invalidate(4, module.selectingInput = true, module);
    			$$invalidate(21, inputBtn.style.opacity = 0.5, inputBtn);
    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(4, module.selectingInput = false, module);
    		}
    	}

    	module.select = id => {
    		if (module.selectingInput) {
    			$$invalidate(4, module.state.inputId = id, module);
    			$$invalidate(21, inputBtn.style.opacity = 1, inputBtn);
    			$$invalidate(4, module.selectingInput = false, module);
    		}

    		set_store_value(selectingModule, $selectingModule = null, $selectingModule);
    		unhover();
    	};

    	module.bob();
    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Delay> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(1, moduleNode), $$invalidate(23, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(2, controlsNode), $$invalidate(3, deleteNode)), $$invalidate(5, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(3, deleteNode), $$invalidate(2, controlsNode)), $$invalidate(5, $selectingModule));
    	}

    	function modulemovement_helpBtn_binding(value) {
    		helpBtn = value;
    		$$invalidate(8, helpBtn);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		nodeSize = value;
    		$$invalidate(9, nodeSize);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(10, bobSize);
    	}

    	function h2_input_handler() {
    		$modules[module.state.id].state.title = this.textContent;
    		modules.set($modules);
    	}

    	const mouseenter_handler = () => inputsAllHover(module);

    	const mouseleave_handler = () => {
    		if ($selectingModule == null) unhover();
    	};

    	function input_change_input_handler() {
    		module.state.delayTime = to_number(this.value);
    		$$invalidate(4, module);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(4, module);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		colours,
    		selectingModule,
    		output,
    		isTyping,
    		ModuleMovement,
    		DeleteButton,
    		HelpButton,
    		createNewId,
    		setPosition,
    		inputsAllHover,
    		unhover,
    		spring,
    		state,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		titleNode,
    		inputBtn,
    		helpBtn,
    		notHelpDiv,
    		helpDiv,
    		nodeSize,
    		module,
    		mixerNode,
    		n,
    		delays,
    		gains,
    		currentInput,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setTitleNode,
    		setHelpBtn,
    		setNotHelpDiv,
    		setHelpDiv,
    		opacity,
    		bobSize,
    		chooseInput,
    		$selectingModule,
    		$modules,
    		$colours,
    		$opacity,
    		$isTyping,
    		$output,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(1, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(2, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(3, deleteNode = $$props.deleteNode);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('inputBtn' in $$props) $$invalidate(21, inputBtn = $$props.inputBtn);
    		if ('helpBtn' in $$props) $$invalidate(8, helpBtn = $$props.helpBtn);
    		if ('notHelpDiv' in $$props) notHelpDiv = $$props.notHelpDiv;
    		if ('helpDiv' in $$props) helpDiv = $$props.helpDiv;
    		if ('nodeSize' in $$props) $$invalidate(9, nodeSize = $$props.nodeSize);
    		if ('mixerNode' in $$props) mixerNode = $$props.mixerNode;
    		if ('n' in $$props) $$invalidate(45, n = $$props.n);
    		if ('delays' in $$props) $$invalidate(46, delays = $$props.delays);
    		if ('gains' in $$props) gains = $$props.gains;
    		if ('currentInput' in $$props) $$invalidate(22, currentInput = $$props.currentInput);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(19, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(10, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $context*/ 16777232) {
    			for (let i = 0; i < n; i++) {
    				delays[i].delayTime.setValueAtTime(module.state.delayTime * i, $context.currentTime);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, $modules, currentInput*/ 4194384) {
    			if (!module.destroyed) {
    				if (module.state.inputId != null && $modules[module.state.inputId] && $modules[module.state.inputId].output) {
    					if (currentInput) delays.forEach(delayNode => {
    						currentInput.disconnect(delayNode);
    					});

    					$$invalidate(22, currentInput = $modules[module.state.inputId].output);

    					delays.forEach(delayNode => {
    						currentInput.connect(delayNode);
    					});

    					if ($modules[module.state.inputId].input || $modules[module.state.inputId].inputs) $modules[module.state.inputId].update();
    				} else {
    					if (currentInput) delays.forEach(delayNode => {
    						currentInput.disconnect(delayNode);
    					});

    					$$invalidate(22, currentInput = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 8388610) {
    			if (moduleNode) $$invalidate(1, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module, inputBtn, $colours, $modules*/ 2097360) {
    			if (!module.destroyed) {
    				if (inputBtn) {
    					if (module.state.inputId != null) {
    						$$invalidate(21, inputBtn.style.backgroundColor = $colours[$modules[module.state.inputId].state.type], inputBtn);
    					} else {
    						$$invalidate(21, inputBtn.style.backgroundColor = "#f0f0f0", inputBtn);
    					}
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 44) {
    			if (controlsNode && deleteNode) {
    				if ($selectingModule != null) {
    					$$invalidate(2, controlsNode.style.pointerEvents = "none", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "none", deleteNode);
    				} else {
    					$$invalidate(2, controlsNode.style.pointerEvents = "all", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "all", deleteNode);
    				}
    			}
    		}
    	};

    	return [
    		state,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		module,
    		$selectingModule,
    		$modules,
    		$colours,
    		helpBtn,
    		nodeSize,
    		bobSize,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setTitleNode,
    		setHelpBtn,
    		setNotHelpDiv,
    		setHelpDiv,
    		opacity,
    		chooseInput,
    		inputBtn,
    		currentInput,
    		$opacity,
    		$context,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_helpBtn_binding,
    		modulemovement_nodeSize_binding,
    		modulemovement_nodePos_binding,
    		modulemovement_bobSize_binding,
    		h2_input_handler,
    		mouseenter_handler,
    		mouseleave_handler,
    		input_change_input_handler,
    		main_binding
    	];
    }

    class Delay extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Delay",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get state() {
    		throw new Error("<Delay>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Delay>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\modules\Noise.svelte generated by Svelte v3.59.2 */
    const file$2 = "src\\modules\\Noise.svelte";

    // (173:0) {#if !module.destroyed}
    function create_if_block$2(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_helpBtn;
    	let updating_nodeSize;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div5;
    	let div0;
    	let deletebutton;
    	let t1;
    	let div1;
    	let helpbutton;
    	let t2;
    	let h1;
    	let t3_value = /*module*/ ctx[6].state.id + "";
    	let t3;
    	let t4;
    	let div3;
    	let h2;
    	let t5_value = /*module*/ ctx[6].state.title + "";
    	let t5;
    	let t6;
    	let div2;
    	let t7;
    	let div4;
    	let p;
    	let div5_style_value;
    	let t9;
    	let br;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[20](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[21](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[22](value);
    	}

    	function modulemovement_helpBtn_binding(value) {
    		/*modulemovement_helpBtn_binding*/ ctx[23](value);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		/*modulemovement_nodeSize_binding*/ ctx[24](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[25](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[26](value);
    	}

    	let modulemovement_props = {};

    	if (/*moduleNode*/ ctx[1] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[1];
    	}

    	if (/*controlsNode*/ ctx[2] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[2];
    	}

    	if (/*deleteNode*/ ctx[3] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[3];
    	}

    	if (/*helpBtn*/ ctx[4] !== void 0) {
    		modulemovement_props.helpBtn = /*helpBtn*/ ctx[4];
    	}

    	if (/*nodeSize*/ ctx[5] !== void 0) {
    		modulemovement_props.nodeSize = /*nodeSize*/ ctx[5];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	if (/*bobSize*/ ctx[7] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[7];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'helpBtn', modulemovement_helpBtn_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodeSize', modulemovement_nodeSize_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[6] },
    			$$inline: true
    		});

    	helpbutton = new HelpButton({
    			props: { module: /*module*/ ctx[6] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div5 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(helpbutton.$$.fragment);
    			t2 = space();
    			h1 = element("h1");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			h2 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			div2 = element("div");
    			t7 = space();
    			div4 = element("div");
    			p = element("p");
    			p.textContent = "Produces a constant white noise signal.";
    			t9 = space();
    			br = element("br");
    			attr_dev(div0, "class", "delete svelte-1gia3or");
    			add_location(div0, file$2, 176, 4, 5737);
    			attr_dev(div1, "class", "help svelte-1gia3or");
    			add_location(div1, file$2, 177, 4, 5815);
    			add_location(h1, file$2, 178, 4, 5890);
    			attr_dev(h2, "class", "editableTitle svelte-1gia3or");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[27].call(h2));
    			add_location(h2, file$2, 180, 8, 5967);
    			add_location(div2, file$2, 182, 8, 6135);
    			attr_dev(div3, "id", "controls");
    			add_location(div3, file$2, 179, 4, 5922);
    			attr_dev(p, "class", "svelte-1gia3or");
    			add_location(p, file$2, 186, 8, 6222);
    			add_location(div4, file$2, 185, 4, 6192);
    			attr_dev(div5, "id", "module");
    			attr_dev(div5, "style", div5_style_value = "background-color: " + /*$colours*/ ctx[9][/*module*/ ctx[6].state.type]);
    			attr_dev(div5, "class", "svelte-1gia3or");
    			add_location(div5, file$2, 175, 0, 5641);
    			add_location(br, file$2, 190, 0, 6300);
    			add_location(main, file$2, 173, 0, 5464);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div5);
    			append_dev(div5, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div5, t1);
    			append_dev(div5, div1);
    			mount_component(helpbutton, div1, null);
    			append_dev(div5, t2);
    			append_dev(div5, h1);
    			append_dev(h1, t3);
    			append_dev(div5, t4);
    			append_dev(div5, div3);
    			append_dev(div3, h2);
    			append_dev(h2, t5);

    			if (/*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title;
    			}

    			append_dev(div3, t6);
    			append_dev(div3, div2);
    			append_dev(div5, t7);
    			append_dev(div5, div4);
    			append_dev(div4, p);
    			append_dev(main, t9);
    			append_dev(main, br);
    			/*main_binding*/ ctx[28](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[12].call(null, div0)),
    					action_destroyer(/*setHelpBtn*/ ctx[14].call(null, div1)),
    					action_destroyer(/*setTitleNode*/ ctx[13].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[27]),
    					action_destroyer(/*setNotHelpDiv*/ ctx[15].call(null, div2)),
    					action_destroyer(/*setControls*/ ctx[11].call(null, div3)),
    					action_destroyer(/*setHelpDiv*/ ctx[16].call(null, div4)),
    					action_destroyer(/*setModule*/ ctx[10].call(null, div5))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 2) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[1];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 4) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[2];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 8) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[3];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_helpBtn && dirty[0] & /*helpBtn*/ 16) {
    				updating_helpBtn = true;
    				modulemovement_changes.helpBtn = /*helpBtn*/ ctx[4];
    				add_flush_callback(() => updating_helpBtn = false);
    			}

    			if (!updating_nodeSize && dirty[0] & /*nodeSize*/ 32) {
    				updating_nodeSize = true;
    				modulemovement_changes.nodeSize = /*nodeSize*/ ctx[5];
    				add_flush_callback(() => updating_nodeSize = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 128) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[7];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 64) deletebutton_changes.module = /*module*/ ctx[6];
    			deletebutton.$set(deletebutton_changes);
    			const helpbutton_changes = {};
    			if (dirty[0] & /*module*/ 64) helpbutton_changes.module = /*module*/ ctx[6];
    			helpbutton.$set(helpbutton_changes);
    			if ((!current || dirty[0] & /*module*/ 64) && t3_value !== (t3_value = /*module*/ ctx[6].state.id + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty[0] & /*module*/ 64) && t5_value !== (t5_value = /*module*/ ctx[6].state.title + "")) set_data_contenteditable_dev(t5, t5_value);

    			if (dirty[0] & /*$modules, module*/ 320 && /*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title;
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 576 && div5_style_value !== (div5_style_value = "background-color: " + /*$colours*/ ctx[9][/*module*/ ctx[6].state.type])) {
    				attr_dev(div5, "style", div5_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			transition_in(helpbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			transition_out(helpbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_component(helpbutton);
    			/*main_binding*/ ctx[28](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(173:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[6].destroyed && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[6].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 64) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $selectingModule;
    	let $opacity;
    	let $isTyping;
    	let $modules;
    	let $output;
    	let $context;
    	let $colours;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(18, $selectingModule = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(36, $isTyping = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(8, $modules = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(37, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(38, $context = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(9, $colours = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Noise', slots, []);

    	let { state = {
    		type: 'noise',
    		id: createNewId(),
    		title: 'Noise'
    	} } = $$props;

    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let titleNode;
    	let helpBtn;
    	let notHelpDiv;
    	let helpDiv;
    	let nodeSize = { x: 200, y: 150 };
    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = true;
    	module.isControl = false;
    	module.showingHelp = false;
    	if (!module.state.position) module.state.position = setPosition();

    	// https://noisehack.com/generate-noise-web-audio-api/
    	let bufferSize = 2 * $context.sampleRate;

    	let noiseBuffer = $context.createBuffer(1, bufferSize, $context.sampleRate);
    	let noiseOutput = noiseBuffer.getChannelData(0);

    	for (let i = 0; i < bufferSize; i++) {
    		noiseOutput[i] = Math.random() * 2 - 1;
    	}

    	let noiseNode = $context.createBufferSource();
    	noiseNode.buffer = noiseBuffer;
    	noiseNode.loop = true;
    	noiseNode.start(0);
    	module.output = noiseNode;

    	module.clearCurrents = () => {
    		return;
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		if (titleNode) titleNode.style.outline = "none";
    	});

    	function setModule(node) {
    		$$invalidate(1, moduleNode = node);

    		moduleNode.addEventListener("mousedown", () => {
    			moduleIsClicked = true;
    		});

    		moduleNode.addEventListener("mouseup", () => {
    			if (moduleIsClicked) {
    				if ($selectingModule == "output") {
    					$output.select(module.state.id);
    				} else if ($selectingModule != null && $modules[$selectingModule].selectingInput && $selectingModule != module.state.id && ($modules[$selectingModule].state.type != "mixer" || (!$modules[$selectingModule].state.inputIds.includes(module.state.id) || $modules[$selectingModule].state.inputIds[$modules[$selectingModule].inputSelecting] == module.state.id))) {
    					$modules[$selectingModule].select(module.state.id);
    				} else if ($selectingModule == module.state.id) {
    					module.select(null);
    				}
    			}
    		});
    	}

    	function setControls(node) {
    		$$invalidate(2, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(3, deleteNode = node);
    	}

    	function setTitleNode(node) {
    		titleNode = node;

    		titleNode.addEventListener("mouseenter", () => {
    			titleNode.style.outline = "2px solid #222222";
    		});

    		titleNode.addEventListener("mouseleave", () => {
    			if (!moduleTyping) titleNode.style.outline = "none";
    		});

    		titleNode.addEventListener("mousedown", () => {
    			setTimeout(
    				() => {
    					set_store_value(isTyping, $isTyping = true, $isTyping);
    					moduleTyping = true;
    					titleNode.style.outline = "2px solid #222222";
    				},
    				10
    			);
    		});
    	}

    	function setHelpBtn(node) {
    		$$invalidate(4, helpBtn = node);
    	}

    	function setNotHelpDiv(node) {
    		notHelpDiv = node;
    	}

    	function setHelpDiv(node) {
    		helpDiv = node;
    		helpDiv.style.display = "none";
    	}

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(19, $opacity = value));
    	let bobSize = spring(0, { stiffness: 0.3, damping: 0.2 });

    	module.fade = () => {
    		opacity.set(0.2);
    	};

    	module.halfFade = () => {
    		opacity.set(0.8);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	module.bob = () => {
    		bobSize.set(10);

    		setTimeout(
    			() => {
    				bobSize.set(0);
    			},
    			50
    		);
    	};

    	module.toggleHelp = () => {
    		$$invalidate(6, module.showingHelp = !module.showingHelp, module);

    		if (notHelpDiv) {
    			if (!module.showingHelp) {
    				notHelpDiv.style.display = "initial";
    			} else {
    				notHelpDiv.style.display = "none";
    			}
    		}

    		if (helpDiv) {
    			if (module.showingHelp) {
    				helpDiv.style.display = "initial";
    			} else {
    				helpDiv.style.display = "none";
    			}
    		}

    		if (module.showingHelp) {
    			$$invalidate(5, nodeSize = { x: 200, y: 220 });
    		} else {
    			$$invalidate(5, nodeSize = { x: 200, y: 150 });
    		}
    	};

    	module.bob();
    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Noise> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(1, moduleNode), $$invalidate(19, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(2, controlsNode), $$invalidate(3, deleteNode)), $$invalidate(18, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(3, deleteNode), $$invalidate(2, controlsNode)), $$invalidate(18, $selectingModule));
    	}

    	function modulemovement_helpBtn_binding(value) {
    		helpBtn = value;
    		$$invalidate(4, helpBtn);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		nodeSize = value;
    		$$invalidate(5, nodeSize);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(7, bobSize);
    	}

    	function h2_input_handler() {
    		$modules[module.state.id].state.title = this.textContent;
    		modules.set($modules);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(6, module);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		colours,
    		selectingModule,
    		isTyping,
    		output,
    		ModuleMovement,
    		DeleteButton,
    		HelpButton,
    		createNewId,
    		setPosition,
    		spring,
    		state,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		titleNode,
    		helpBtn,
    		notHelpDiv,
    		helpDiv,
    		nodeSize,
    		module,
    		bufferSize,
    		noiseBuffer,
    		noiseOutput,
    		noiseNode,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		setHelpBtn,
    		setNotHelpDiv,
    		setHelpDiv,
    		opacity,
    		bobSize,
    		$selectingModule,
    		$opacity,
    		$isTyping,
    		$modules,
    		$output,
    		$context,
    		$colours
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(1, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(2, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(3, deleteNode = $$props.deleteNode);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('helpBtn' in $$props) $$invalidate(4, helpBtn = $$props.helpBtn);
    		if ('notHelpDiv' in $$props) notHelpDiv = $$props.notHelpDiv;
    		if ('helpDiv' in $$props) helpDiv = $$props.helpDiv;
    		if ('nodeSize' in $$props) $$invalidate(5, nodeSize = $$props.nodeSize);
    		if ('bufferSize' in $$props) bufferSize = $$props.bufferSize;
    		if ('noiseBuffer' in $$props) noiseBuffer = $$props.noiseBuffer;
    		if ('noiseOutput' in $$props) noiseOutput = $$props.noiseOutput;
    		if ('noiseNode' in $$props) noiseNode = $$props.noiseNode;
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(17, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(7, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 524290) {
    			if (moduleNode) $$invalidate(1, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 262156) {
    			if (controlsNode && deleteNode) {
    				if ($selectingModule != null) {
    					$$invalidate(2, controlsNode.style.pointerEvents = "none", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "none", deleteNode);
    				} else {
    					$$invalidate(2, controlsNode.style.pointerEvents = "all", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "all", deleteNode);
    				}
    			}
    		}
    	};

    	return [
    		state,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		helpBtn,
    		nodeSize,
    		module,
    		bobSize,
    		$modules,
    		$colours,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		setHelpBtn,
    		setNotHelpDiv,
    		setHelpDiv,
    		opacity,
    		$selectingModule,
    		$opacity,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_helpBtn_binding,
    		modulemovement_nodeSize_binding,
    		modulemovement_nodePos_binding,
    		modulemovement_bobSize_binding,
    		h2_input_handler,
    		main_binding
    	];
    }

    class Noise extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Noise",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get state() {
    		throw new Error("<Noise>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Noise>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\modules\Input.svelte generated by Svelte v3.59.2 */
    const file$1 = "src\\modules\\Input.svelte";

    // (166:0) {#if !module.destroyed}
    function create_if_block$1(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_helpBtn;
    	let updating_nodeSize;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div5;
    	let div0;
    	let deletebutton;
    	let t1;
    	let div1;
    	let helpbutton;
    	let t2;
    	let h1;
    	let t3_value = /*module*/ ctx[6].state.id + "";
    	let t3;
    	let t4;
    	let div3;
    	let h2;
    	let t5_value = /*module*/ ctx[6].state.title + "";
    	let t5;
    	let t6;
    	let div2;
    	let t7;
    	let div4;
    	let p;
    	let div5_style_value;
    	let t9;
    	let br;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[20](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[21](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[22](value);
    	}

    	function modulemovement_helpBtn_binding(value) {
    		/*modulemovement_helpBtn_binding*/ ctx[23](value);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		/*modulemovement_nodeSize_binding*/ ctx[24](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[25](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[26](value);
    	}

    	let modulemovement_props = {};

    	if (/*moduleNode*/ ctx[1] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[1];
    	}

    	if (/*controlsNode*/ ctx[2] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[2];
    	}

    	if (/*deleteNode*/ ctx[3] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[3];
    	}

    	if (/*helpBtn*/ ctx[4] !== void 0) {
    		modulemovement_props.helpBtn = /*helpBtn*/ ctx[4];
    	}

    	if (/*nodeSize*/ ctx[5] !== void 0) {
    		modulemovement_props.nodeSize = /*nodeSize*/ ctx[5];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	if (/*bobSize*/ ctx[7] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[7];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'helpBtn', modulemovement_helpBtn_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodeSize', modulemovement_nodeSize_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[6] },
    			$$inline: true
    		});

    	helpbutton = new HelpButton({
    			props: { module: /*module*/ ctx[6] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div5 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(helpbutton.$$.fragment);
    			t2 = space();
    			h1 = element("h1");
    			t3 = text(t3_value);
    			t4 = space();
    			div3 = element("div");
    			h2 = element("h2");
    			t5 = text(t5_value);
    			t6 = space();
    			div2 = element("div");
    			t7 = space();
    			div4 = element("div");
    			p = element("p");
    			p.textContent = "Produces the audio being captured by the user's input device (e.g. microphone) if permission is given.";
    			t9 = space();
    			br = element("br");
    			attr_dev(div0, "class", "delete svelte-2v84ug");
    			add_location(div0, file$1, 169, 4, 5481);
    			attr_dev(div1, "class", "help svelte-2v84ug");
    			add_location(div1, file$1, 170, 4, 5559);
    			add_location(h1, file$1, 171, 4, 5634);
    			attr_dev(h2, "class", "editableTitle svelte-2v84ug");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[27].call(h2));
    			add_location(h2, file$1, 173, 8, 5711);
    			add_location(div2, file$1, 175, 8, 5879);
    			attr_dev(div3, "id", "controls");
    			add_location(div3, file$1, 172, 4, 5666);
    			attr_dev(p, "class", "svelte-2v84ug");
    			add_location(p, file$1, 179, 8, 5966);
    			add_location(div4, file$1, 178, 4, 5936);
    			attr_dev(div5, "id", "module");
    			attr_dev(div5, "style", div5_style_value = "background-color: " + /*$colours*/ ctx[9][/*module*/ ctx[6].state.type]);
    			attr_dev(div5, "class", "svelte-2v84ug");
    			add_location(div5, file$1, 168, 0, 5385);
    			add_location(br, file$1, 183, 0, 6107);
    			add_location(main, file$1, 166, 0, 5208);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div5);
    			append_dev(div5, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div5, t1);
    			append_dev(div5, div1);
    			mount_component(helpbutton, div1, null);
    			append_dev(div5, t2);
    			append_dev(div5, h1);
    			append_dev(h1, t3);
    			append_dev(div5, t4);
    			append_dev(div5, div3);
    			append_dev(div3, h2);
    			append_dev(h2, t5);

    			if (/*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title;
    			}

    			append_dev(div3, t6);
    			append_dev(div3, div2);
    			append_dev(div5, t7);
    			append_dev(div5, div4);
    			append_dev(div4, p);
    			append_dev(main, t9);
    			append_dev(main, br);
    			/*main_binding*/ ctx[28](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[12].call(null, div0)),
    					action_destroyer(/*setHelpBtn*/ ctx[14].call(null, div1)),
    					action_destroyer(/*setTitleNode*/ ctx[13].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[27]),
    					action_destroyer(/*setNotHelpDiv*/ ctx[15].call(null, div2)),
    					action_destroyer(/*setControls*/ ctx[11].call(null, div3)),
    					action_destroyer(/*setHelpDiv*/ ctx[16].call(null, div4)),
    					action_destroyer(/*setModule*/ ctx[10].call(null, div5))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty[0] & /*moduleNode*/ 2) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[1];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 4) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[2];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 8) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[3];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_helpBtn && dirty[0] & /*helpBtn*/ 16) {
    				updating_helpBtn = true;
    				modulemovement_changes.helpBtn = /*helpBtn*/ ctx[4];
    				add_flush_callback(() => updating_helpBtn = false);
    			}

    			if (!updating_nodeSize && dirty[0] & /*nodeSize*/ 32) {
    				updating_nodeSize = true;
    				modulemovement_changes.nodeSize = /*nodeSize*/ ctx[5];
    				add_flush_callback(() => updating_nodeSize = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 128) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[7];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 64) deletebutton_changes.module = /*module*/ ctx[6];
    			deletebutton.$set(deletebutton_changes);
    			const helpbutton_changes = {};
    			if (dirty[0] & /*module*/ 64) helpbutton_changes.module = /*module*/ ctx[6];
    			helpbutton.$set(helpbutton_changes);
    			if ((!current || dirty[0] & /*module*/ 64) && t3_value !== (t3_value = /*module*/ ctx[6].state.id + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty[0] & /*module*/ 64) && t5_value !== (t5_value = /*module*/ ctx[6].state.title + "")) set_data_contenteditable_dev(t5, t5_value);

    			if (dirty[0] & /*$modules, module*/ 320 && /*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[8][/*module*/ ctx[6].state.id].state.title;
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 576 && div5_style_value !== (div5_style_value = "background-color: " + /*$colours*/ ctx[9][/*module*/ ctx[6].state.type])) {
    				attr_dev(div5, "style", div5_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			transition_in(helpbutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			transition_out(helpbutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_component(helpbutton);
    			/*main_binding*/ ctx[28](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(166:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[6].destroyed && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[6].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 64) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
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
    	let $selectingModule;
    	let $opacity;
    	let $isTyping;
    	let $modules;
    	let $output;
    	let $context;
    	let $colours;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(18, $selectingModule = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(34, $isTyping = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(8, $modules = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(35, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(36, $context = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(9, $colours = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Input', slots, []);

    	let { state = {
    		type: 'input',
    		id: createNewId(),
    		title: 'Audio Input'
    	} } = $$props;

    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let titleNode;
    	let helpBtn;
    	let notHelpDiv;
    	let helpDiv;
    	let nodeSize = { x: 280, y: 150 };
    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = true;
    	module.isControl = false;
    	module.showingHelp = false;
    	if (!module.state.position) module.state.position = setPosition();

    	if (navigator.mediaDevices) {
    		navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
    			let source = $context.createMediaStreamSource(stream);
    			$$invalidate(6, module.output = source, module);
    		});
    	}

    	module.clearCurrents = () => {
    		return;
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		if (titleNode) titleNode.style.outline = "none";
    	});

    	function setModule(node) {
    		$$invalidate(1, moduleNode = node);

    		moduleNode.addEventListener("mousedown", () => {
    			moduleIsClicked = true;
    		});

    		moduleNode.addEventListener("mouseup", () => {
    			if (moduleIsClicked) {
    				if ($selectingModule == "output") {
    					$output.select(module.state.id);
    				} else if ($selectingModule != null && $modules[$selectingModule].selectingInput && $selectingModule != module.state.id && ($modules[$selectingModule].state.type != "mixer" || (!$modules[$selectingModule].state.inputIds.includes(module.state.id) || $modules[$selectingModule].state.inputIds[$modules[$selectingModule].inputSelecting] == module.state.id))) {
    					$modules[$selectingModule].select(module.state.id);
    				} else if ($selectingModule == module.state.id) {
    					module.select(null);
    				}
    			}
    		});
    	}

    	function setControls(node) {
    		$$invalidate(2, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(3, deleteNode = node);
    	}

    	function setTitleNode(node) {
    		titleNode = node;

    		titleNode.addEventListener("mouseenter", () => {
    			titleNode.style.outline = "2px solid #222222";
    		});

    		titleNode.addEventListener("mouseleave", () => {
    			if (!moduleTyping) titleNode.style.outline = "none";
    		});

    		titleNode.addEventListener("mousedown", () => {
    			setTimeout(
    				() => {
    					set_store_value(isTyping, $isTyping = true, $isTyping);
    					moduleTyping = true;
    					titleNode.style.outline = "2px solid #222222";
    				},
    				10
    			);
    		});
    	}

    	function setHelpBtn(node) {
    		$$invalidate(4, helpBtn = node);
    	}

    	function setNotHelpDiv(node) {
    		notHelpDiv = node;
    	}

    	function setHelpDiv(node) {
    		helpDiv = node;
    		helpDiv.style.display = "none";
    	}

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(19, $opacity = value));
    	let bobSize = spring(0, { stiffness: 0.3, damping: 0.2 });

    	module.fade = () => {
    		opacity.set(0.2);
    	};

    	module.halfFade = () => {
    		opacity.set(0.8);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	module.bob = () => {
    		bobSize.set(10);

    		setTimeout(
    			() => {
    				bobSize.set(0);
    			},
    			50
    		);
    	};

    	module.toggleHelp = () => {
    		$$invalidate(6, module.showingHelp = !module.showingHelp, module);

    		if (notHelpDiv) {
    			if (!module.showingHelp) {
    				notHelpDiv.style.display = "initial";
    			} else {
    				notHelpDiv.style.display = "none";
    			}
    		}

    		if (helpDiv) {
    			if (module.showingHelp) {
    				helpDiv.style.display = "initial";
    			} else {
    				helpDiv.style.display = "none";
    			}
    		}

    		if (module.showingHelp) {
    			$$invalidate(5, nodeSize = { x: 280, y: 255 });
    		} else {
    			$$invalidate(5, nodeSize = { x: 280, y: 150 });
    		}
    	};

    	module.bob();
    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Input> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(1, moduleNode), $$invalidate(19, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(2, controlsNode), $$invalidate(3, deleteNode)), $$invalidate(18, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(3, deleteNode), $$invalidate(2, controlsNode)), $$invalidate(18, $selectingModule));
    	}

    	function modulemovement_helpBtn_binding(value) {
    		helpBtn = value;
    		$$invalidate(4, helpBtn);
    	}

    	function modulemovement_nodeSize_binding(value) {
    		nodeSize = value;
    		$$invalidate(5, nodeSize);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(7, bobSize);
    	}

    	function h2_input_handler() {
    		$modules[module.state.id].state.title = this.textContent;
    		modules.set($modules);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(6, module);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		colours,
    		selectingModule,
    		isTyping,
    		output,
    		ModuleMovement,
    		DeleteButton,
    		HelpButton,
    		createNewId,
    		setPosition,
    		spring,
    		state,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		titleNode,
    		helpBtn,
    		notHelpDiv,
    		helpDiv,
    		nodeSize,
    		module,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		setHelpBtn,
    		setNotHelpDiv,
    		setHelpDiv,
    		opacity,
    		bobSize,
    		$selectingModule,
    		$opacity,
    		$isTyping,
    		$modules,
    		$output,
    		$context,
    		$colours
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(1, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(2, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(3, deleteNode = $$props.deleteNode);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('helpBtn' in $$props) $$invalidate(4, helpBtn = $$props.helpBtn);
    		if ('notHelpDiv' in $$props) notHelpDiv = $$props.notHelpDiv;
    		if ('helpDiv' in $$props) helpDiv = $$props.helpDiv;
    		if ('nodeSize' in $$props) $$invalidate(5, nodeSize = $$props.nodeSize);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(17, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(7, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 524290) {
    			if (moduleNode) $$invalidate(1, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 262156) {
    			if (controlsNode && deleteNode) {
    				if ($selectingModule != null) {
    					$$invalidate(2, controlsNode.style.pointerEvents = "none", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "none", deleteNode);
    				} else {
    					$$invalidate(2, controlsNode.style.pointerEvents = "all", controlsNode);
    					$$invalidate(3, deleteNode.style.pointerEvents = "all", deleteNode);
    				}
    			}
    		}
    	};

    	return [
    		state,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		helpBtn,
    		nodeSize,
    		module,
    		bobSize,
    		$modules,
    		$colours,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		setHelpBtn,
    		setNotHelpDiv,
    		setHelpDiv,
    		opacity,
    		$selectingModule,
    		$opacity,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_helpBtn_binding,
    		modulemovement_nodeSize_binding,
    		modulemovement_nodePos_binding,
    		modulemovement_bobSize_binding,
    		h2_input_handler,
    		main_binding
    	];
    }

    class Input extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Input",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get state() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[27] = list[i];
    	return child_ctx;
    }

    // (179:1) {:else}
    function create_else_block(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Mobile not yet supported";
    			add_location(h2, file, 179, 1, 11546);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(179:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (148:1) {#if !window.mobileCheck()}
    function create_if_block(ctx) {
    	let div2;
    	let div1;
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
    	let button7;
    	let t15;
    	let button8;
    	let t17;
    	let button9;
    	let t19;
    	let button10;
    	let t21;
    	let button11;
    	let t23;
    	let div0;
    	let button12;
    	let br0;
    	let t25;
    	let button13;
    	let br1;
    	let t27;
    	let button14;
    	let br2;
    	let t29;
    	let button15;
    	let br3;
    	let t31;
    	let button16;
    	let br4;
    	let t33;
    	let midi;
    	let t34;
    	let output_1;
    	let t35;
    	let div3;
    	let current;
    	let mounted;
    	let dispose;
    	midi = new MIDI({ $$inline: true });
    	output_1 = new Output({ $$inline: true });
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
    			div2 = element("div");
    			div1 = element("div");
    			button0 = element("button");
    			button0.textContent = "Save Patch";
    			t1 = space();
    			button1 = element("button");
    			button1.textContent = "Load Patch";
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
    			button5.textContent = "Add Mixer";
    			t11 = space();
    			button6 = element("button");
    			button6.textContent = "Add Envelope";
    			t13 = space();
    			button7 = element("button");
    			button7.textContent = "Add LFO";
    			t15 = space();
    			button8 = element("button");
    			button8.textContent = "Add Delay";
    			t17 = space();
    			button9 = element("button");
    			button9.textContent = "Add Noise";
    			t19 = space();
    			button10 = element("button");
    			button10.textContent = "Add Audio Input";
    			t21 = space();
    			button11 = element("button");
    			button11.textContent = "Clear Patch";
    			t23 = space();
    			div0 = element("div");
    			button12 = element("button");
    			button12.textContent = "Demo 1";
    			br0 = element("br");
    			t25 = space();
    			button13 = element("button");
    			button13.textContent = "Demo 2";
    			br1 = element("br");
    			t27 = space();
    			button14 = element("button");
    			button14.textContent = "Demo 3";
    			br2 = element("br");
    			t29 = space();
    			button15 = element("button");
    			button15.textContent = "Demo 4";
    			br3 = element("br");
    			t31 = space();
    			button16 = element("button");
    			button16.textContent = "Demo 5";
    			br4 = element("br");
    			t33 = space();
    			create_component(midi.$$.fragment);
    			t34 = space();
    			create_component(output_1.$$.fragment);
    			t35 = space();
    			div3 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(button0, "class", "svelte-1xpejh3");
    			add_location(button0, file, 150, 2, 5958);
    			attr_dev(button1, "class", "svelte-1xpejh3");
    			add_location(button1, file, 151, 2, 6005);
    			attr_dev(button2, "id", "vcoBtn");
    			attr_dev(button2, "class", "svelte-1xpejh3");
    			add_location(button2, file, 152, 2, 6052);
    			attr_dev(button3, "id", "vcaBtn");
    			attr_dev(button3, "class", "svelte-1xpejh3");
    			add_location(button3, file, 153, 2, 6131);
    			attr_dev(button4, "id", "vcfBtn");
    			attr_dev(button4, "class", "svelte-1xpejh3");
    			add_location(button4, file, 154, 2, 6209);
    			attr_dev(button5, "id", "mixerBtn");
    			attr_dev(button5, "class", "svelte-1xpejh3");
    			add_location(button5, file, 155, 2, 6284);
    			attr_dev(button6, "id", "adsrBtn");
    			attr_dev(button6, "class", "svelte-1xpejh3");
    			add_location(button6, file, 156, 2, 6362);
    			attr_dev(button7, "id", "lfoBtn");
    			attr_dev(button7, "class", "svelte-1xpejh3");
    			add_location(button7, file, 157, 2, 6441);
    			attr_dev(button8, "id", "delayBtn");
    			attr_dev(button8, "class", "svelte-1xpejh3");
    			add_location(button8, file, 158, 2, 6513);
    			attr_dev(button9, "id", "noiseBtn");
    			attr_dev(button9, "class", "svelte-1xpejh3");
    			add_location(button9, file, 159, 2, 6591);
    			attr_dev(button10, "id", "audioInpBtn");
    			attr_dev(button10, "class", "svelte-1xpejh3");
    			add_location(button10, file, 160, 2, 6669);
    			attr_dev(button11, "class", "svelte-1xpejh3");
    			add_location(button11, file, 161, 2, 6756);
    			attr_dev(button12, "class", "svelte-1xpejh3");
    			add_location(button12, file, 163, 3, 6829);
    			add_location(br0, file, 163, 491, 7317);
    			attr_dev(button13, "class", "svelte-1xpejh3");
    			add_location(button13, file, 164, 3, 7326);
    			add_location(br1, file, 164, 1251, 8574);
    			attr_dev(button14, "class", "svelte-1xpejh3");
    			add_location(button14, file, 165, 3, 8583);
    			add_location(br2, file, 165, 1068, 9648);
    			attr_dev(button15, "class", "svelte-1xpejh3");
    			add_location(button15, file, 166, 3, 9657);
    			add_location(br3, file, 166, 614, 10268);
    			attr_dev(button16, "class", "svelte-1xpejh3");
    			add_location(button16, file, 167, 3, 10277);
    			add_location(br4, file, 167, 1086, 11360);
    			attr_dev(div0, "class", "demos svelte-1xpejh3");
    			add_location(div0, file, 162, 2, 6805);
    			add_location(div1, file, 149, 2, 5934);
    			attr_dev(div2, "class", "menu svelte-1xpejh3");
    			add_location(div2, file, 148, 1, 5912);
    			attr_dev(div3, "class", "modules svelte-1xpejh3");
    			add_location(div3, file, 173, 1, 11422);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div1);
    			append_dev(div1, button0);
    			append_dev(div1, t1);
    			append_dev(div1, button1);
    			append_dev(div1, t3);
    			append_dev(div1, button2);
    			append_dev(div1, t5);
    			append_dev(div1, button3);
    			append_dev(div1, t7);
    			append_dev(div1, button4);
    			append_dev(div1, t9);
    			append_dev(div1, button5);
    			append_dev(div1, t11);
    			append_dev(div1, button6);
    			append_dev(div1, t13);
    			append_dev(div1, button7);
    			append_dev(div1, t15);
    			append_dev(div1, button8);
    			append_dev(div1, t17);
    			append_dev(div1, button9);
    			append_dev(div1, t19);
    			append_dev(div1, button10);
    			append_dev(div1, t21);
    			append_dev(div1, button11);
    			append_dev(div1, t23);
    			append_dev(div1, div0);
    			append_dev(div0, button12);
    			append_dev(div0, br0);
    			append_dev(div0, t25);
    			append_dev(div0, button13);
    			append_dev(div0, br1);
    			append_dev(div0, t27);
    			append_dev(div0, button14);
    			append_dev(div0, br2);
    			append_dev(div0, t29);
    			append_dev(div0, button15);
    			append_dev(div0, br3);
    			append_dev(div0, t31);
    			append_dev(div0, button16);
    			append_dev(div0, br4);
    			append_dev(div2, t33);
    			mount_component(midi, div2, null);
    			append_dev(div2, t34);
    			mount_component(output_1, div2, null);
    			insert_dev(target, t35, anchor);
    			insert_dev(target, div3, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div3, null);
    				}
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*save*/ ctx[5], false, false, false, false),
    					listen_dev(button1, "click", /*load*/ ctx[6], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler*/ ctx[8], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_1*/ ctx[9], false, false, false, false),
    					listen_dev(button4, "click", /*click_handler_2*/ ctx[10], false, false, false, false),
    					listen_dev(button5, "click", /*click_handler_3*/ ctx[11], false, false, false, false),
    					listen_dev(button6, "click", /*click_handler_4*/ ctx[12], false, false, false, false),
    					listen_dev(button7, "click", /*click_handler_5*/ ctx[13], false, false, false, false),
    					listen_dev(button8, "click", /*click_handler_6*/ ctx[14], false, false, false, false),
    					listen_dev(button9, "click", /*click_handler_7*/ ctx[15], false, false, false, false),
    					listen_dev(button10, "click", /*click_handler_8*/ ctx[16], false, false, false, false),
    					listen_dev(button11, "click", /*clear*/ ctx[7], false, false, false, false),
    					listen_dev(button12, "click", /*click_handler_9*/ ctx[17], false, false, false, false),
    					listen_dev(button13, "click", /*click_handler_10*/ ctx[18], false, false, false, false),
    					listen_dev(button14, "click", /*click_handler_11*/ ctx[19], false, false, false, false),
    					listen_dev(button15, "click", /*click_handler_12*/ ctx[20], false, false, false, false),
    					listen_dev(button16, "click", /*click_handler_13*/ ctx[21], false, false, false, false),
    					action_destroyer(/*setButtons*/ ctx[2].call(null, div1))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
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
    						each_blocks[i].m(div3, null);
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
    			transition_in(output_1.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(midi.$$.fragment, local);
    			transition_out(output_1.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_component(midi);
    			destroy_component(output_1);
    			if (detaching) detach_dev(t35);
    			if (detaching) detach_dev(div3);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(148:1) {#if !window.mobileCheck()}",
    		ctx
    	});

    	return block;
    }

    // (175:1) {#each mods as m}
    function create_each_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*m*/ ctx[27].props];
    	var switch_value = /*m*/ ctx[27].type;

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
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*m*/ ctx[27].props)])
    			: {};

    			if (dirty & /*mods*/ 1 && switch_value !== (switch_value = /*m*/ ctx[27].type)) {
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
    		source: "(175:1) {#each mods as m}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let html;
    	let body;
    	let main;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (!window.mobileCheck()) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type();
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			html = element("html");
    			body = element("body");
    			main = element("main");
    			if_block.c();
    			attr_dev(main, "class", "svelte-1xpejh3");
    			add_location(main, file, 146, 0, 5873);
    			attr_dev(body, "class", "svelte-1xpejh3");
    			add_location(body, file, 145, 0, 5865);
    			attr_dev(html, "lang", "UTF-8");
    			add_location(html, file, 144, 0, 5844);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, html, anchor);
    			append_dev(html, body);
    			append_dev(body, main);
    			if_blocks[current_block_type_index].m(main, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if_block.p(ctx, dirty);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(html);
    			if_blocks[current_block_type_index].d();
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

    const DEBUG = false;

    function instance($$self, $$props, $$invalidate) {
    	let $output;
    	let $modules;
    	let $context;
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(1, $output = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(23, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(24, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);

    	window.mobileCheck = function () {
    		let check = false;

    		(function (a) {
    			if ((/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i).test(a) || (/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i).test(a.substr(0, 4))) check = true;
    		})(navigator.userAgent || navigator.vendor || window.opera);

    		return check;
    	};

    	let buttons;

    	function setButtons(node) {
    		buttons = node;

    		buttons.childNodes.forEach(button => {
    			if (button.childNodes.length > 1) {
    				button.childNodes.forEach(button => {
    					button.addEventListener("mouseenter", () => {
    						button.style.opacity = 0.8;
    					});

    					button.addEventListener("mouseleave", () => {
    						button.style.opacity = 1;
    					});
    				});
    			} else {
    				button.addEventListener("mouseenter", () => {
    					button.style.opacity = 0.8;
    				});

    				button.addEventListener("mouseleave", () => {
    					button.style.opacity = 1;
    				});
    			}
    		});
    	}

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
    			destroyModule(module);
    		});

    		patch.modules.forEach(module => {
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
    				case "lfo":
    					addModule(LFO, { state: module });
    					break;
    				case "delay":
    					addModule(Delay, { state: module });
    					break;
    				case "noise":
    					addModule(Noise, { state: module });
    					break;
    				case "input":
    					addModule(Input, { state: module });
    					break;
    			}
    		});

    		set_store_value(output, $output.state = patch.output, $output);
    	};

    	const save = () => {
    		const patchModules = [];

    		Object.entries($modules).forEach(module => {
    			patchModules.push(module[1].state);
    		});

    		const patch = {
    			output: $output.state,
    			modules: patchModules
    		};

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

    	const clear = () => addPatch({
    		output: {
    			volume: $output.state.volume,
    			inputId: null
    		},
    		modules: []
    	});

    	const debugPatch = {
    		"output": { "volume": 0.2, "inputId": 1 },
    		"modules": [
    			{
    				"type": "vco",
    				"frequency": 0,
    				"shape": "sine",
    				"id": 0,
    				"title": "Oscillator",
    				"position": { "x": 350, "y": 100 }
    			},
    			{
    				"type": "vca",
    				"gain": 1,
    				"id": 1,
    				"inputId": 0,
    				"cvId": null,
    				"title": "out",
    				"position": { "x": 656, "y": 241 }
    			}
    		]
    	};
    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => addModule(VCO);
    	const click_handler_1 = () => addModule(VCA);
    	const click_handler_2 = () => addModule(VCF);
    	const click_handler_3 = () => addModule(Mixer);
    	const click_handler_4 = () => addModule(ADSR);
    	const click_handler_5 = () => addModule(LFO);
    	const click_handler_6 = () => addModule(Delay);
    	const click_handler_7 = () => addModule(Noise);
    	const click_handler_8 = () => addModule(Input);

    	const click_handler_9 = () => addPatch({
    		"output": {
    			"volume": $output.state.volume,
    			"inputId": 1
    		},
    		"modules": [
    			{
    				"type": "vco",
    				"frequency": 0,
    				"detune": 0,
    				"shape": "triangle",
    				"id": 0,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 310, "y": 60 }
    			},
    			{
    				"type": "vca",
    				"gain": 1,
    				"id": 1,
    				"inputId": 0,
    				"cvId": 2,
    				"title": "Amplifier",
    				"position": { "x": 660, "y": 61 }
    			},
    			{
    				"type": "adsr",
    				"attack": 0.034,
    				"decay": 0.141,
    				"sustain": 0.169,
    				"release": 0.094,
    				"id": 2,
    				"title": "Envelope",
    				"position": { "x": 975, "y": 62 }
    			}
    		]
    	});

    	const click_handler_10 = () => addPatch({
    		"output": {
    			"volume": $output.state.volume,
    			"inputId": 8
    		},
    		"modules": [
    			{
    				"type": "vcf",
    				"voct": 10.5078280948874,
    				"filterType": "lowpass",
    				"id": 0,
    				"inputId": 3,
    				"cvId": 1,
    				"title": "Filter",
    				"position": { "x": 640, "y": 528 }
    			},
    			{
    				"type": "adsr",
    				"attack": 0,
    				"decay": 0.077,
    				"sustain": 0.058,
    				"release": 0.035,
    				"id": 1,
    				"title": "Envelope",
    				"position": { "x": 318, "y": 513 }
    			},
    			{
    				"type": "vco",
    				"frequency": 0,
    				"detune": 0,
    				"shape": "sawtooth",
    				"id": 2,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 302, "y": 66 }
    			},
    			{
    				"type": "mixer",
    				"id": 3,
    				"inputIds": [2, 4, null, null],
    				"title": "Mixer",
    				"position": { "x": 979, "y": 77 }
    			},
    			{
    				"type": "vco",
    				"frequency": 0,
    				"detune": 7,
    				"shape": "sawtooth",
    				"id": 4,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 637, "y": 68 }
    			},
    			{
    				"type": "vco",
    				"frequency": -1.08333333333334,
    				"detune": -2,
    				"shape": "sine",
    				"id": 5,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 311, "y": 930 }
    			},
    			{
    				"type": "mixer",
    				"id": 6,
    				"inputIds": [0, 7, null, null],
    				"title": "Mixer",
    				"position": { "x": 321, "y": 1384 }
    			},
    			{
    				"type": "vca",
    				"gain": 1,
    				"id": 7,
    				"inputId": 5,
    				"cvId": 1,
    				"title": "Amplifier",
    				"position": { "x": 661, "y": 940 }
    			},
    			{
    				"type": "vcf",
    				"voct": 11.2724280948874,
    				"filterType": "lowpass",
    				"id": 8,
    				"inputId": 6,
    				"cvId": null,
    				"title": "Filter",
    				"position": { "x": 539, "y": 1383 }
    			}
    		]
    	});

    	const click_handler_11 = () => addPatch({
    		"output": {
    			"volume": $output.state.volume,
    			"inputId": 3
    		},
    		"modules": [
    			{
    				"type": "vco",
    				"frequency": 0,
    				"detune": 0,
    				"shape": "sawtooth",
    				"id": 0,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 300, "y": 53 }
    			},
    			{
    				"type": "vco",
    				"frequency": 0,
    				"detune": 10,
    				"shape": "sawtooth",
    				"id": 1,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 639, "y": 52 }
    			},
    			{
    				"type": "mixer",
    				"id": 2,
    				"inputIds": [0, 1, 6, 7],
    				"title": "Mixer",
    				"position": { "x": 310, "y": 499 }
    			},
    			{
    				"type": "vcf",
    				"voct": 9.53782809488736,
    				"filterType": "lowpass",
    				"id": 3,
    				"inputId": 2,
    				"cvId": 5,
    				"title": "Filter",
    				"position": { "x": 818, "y": 503 }
    			},
    			{
    				"type": "adsr",
    				"attack": 0.443,
    				"decay": 0.465,
    				"sustain": 0.433,
    				"release": 0.387,
    				"id": 5,
    				"title": "Envelope",
    				"position": { "x": 515, "y": 501 }
    			},
    			{
    				"type": "vco",
    				"frequency": 0.333333333333324,
    				"detune": 0,
    				"shape": "square",
    				"id": 6,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 975, "y": 52 }
    			},
    			{
    				"type": "vco",
    				"frequency": 0.333333333333324,
    				"detune": 8,
    				"shape": "square",
    				"id": 7,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 1311, "y": 53 }
    			}
    		]
    	});

    	const click_handler_12 = () => addPatch({
    		"output": {
    			"volume": $output.state.volume,
    			"inputId": 3
    		},
    		"modules": [
    			{
    				"type": "vco",
    				"frequency": 0,
    				"detune": 44,
    				"shape": "sawtooth",
    				"id": 0,
    				"title": "Oscillator",
    				"cvId": 2,
    				"cvId2": 1,
    				"position": { "x": 660, "y": 65 }
    			},
    			{
    				"type": "lfo",
    				"frequency": 1.7,
    				"shape": "sine",
    				"id": 1,
    				"title": "LFO",
    				"position": { "x": 315, "y": 64 }
    			},
    			{
    				"type": "adsr",
    				"attack": 0,
    				"decay": 0.041,
    				"sustain": 0.5,
    				"release": 0.022,
    				"id": 2,
    				"title": "Envelope",
    				"position": { "x": 319, "y": 339 }
    			},
    			{
    				"type": "vcf",
    				"voct": 10.5078280948874,
    				"filterType": "lowpass",
    				"id": 3,
    				"inputId": 0,
    				"cvId": null,
    				"title": "Filter",
    				"position": { "x": 999, "y": 64 }
    			}
    		]
    	});

    	const click_handler_13 = () => addPatch({
    		"output": {
    			"volume": $output.state.volume,
    			"inputId": 9
    		},
    		"modules": [
    			{
    				"type": "vco",
    				"frequency": 0,
    				"detune": 0,
    				"shape": "sawtooth",
    				"id": 0,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 307, "y": 63 }
    			},
    			{
    				"type": "adsr",
    				"attack": 0.012,
    				"decay": 0.123,
    				"sustain": 0.295,
    				"release": 0.156,
    				"id": 2,
    				"title": "Envelope",
    				"position": { "x": 318, "y": 513 }
    			},
    			{
    				"type": "vcf",
    				"voct": 10.1541280948874,
    				"filterType": "lowpass",
    				"id": 3,
    				"inputId": 5,
    				"cvId": 2,
    				"title": "Filter",
    				"position": { "x": 641, "y": 514 }
    			},
    			{
    				"type": "mixer",
    				"id": 5,
    				"inputIds": [0, 6, null, null],
    				"title": "Mixer",
    				"position": { "x": 1007, "y": 78 }
    			},
    			{
    				"type": "vco",
    				"frequency": -0.583333333333339,
    				"detune": 0,
    				"shape": "sawtooth",
    				"id": 6,
    				"title": "Oscillator",
    				"cvId": null,
    				"cvId2": null,
    				"position": { "x": 656, "y": 70 }
    			},
    			{
    				"type": "delay",
    				"id": 8,
    				"title": "Delay",
    				"inputId": 3,
    				"delayTime": 0.121,
    				"position": { "x": 319, "y": 945 }
    			},
    			{
    				"type": "mixer",
    				"id": 9,
    				"inputIds": [3, 10, null, null],
    				"title": "Mixer",
    				"position": { "x": 959, "y": 876 }
    			},
    			{
    				"type": "vca",
    				"gain": 0.215,
    				"id": 10,
    				"inputId": 8,
    				"cvId": null,
    				"title": "Amplifier",
    				"position": { "x": 642, "y": 922 }
    			}
    		]
    	});

    	$$self.$capture_state = () => ({
    		context,
    		modules,
    		output,
    		fileDialog,
    		MIDI,
    		Output,
    		VCO,
    		VCA,
    		ADSR,
    		VCF,
    		Mixer,
    		LFO,
    		Delay,
    		Noise,
    		Input,
    		destroyModule,
    		DEBUG,
    		buttons,
    		setButtons,
    		ctx,
    		mods,
    		addModule,
    		addPatch,
    		save,
    		load,
    		clear,
    		debugPatch,
    		$output,
    		$modules,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('buttons' in $$props) buttons = $$props.buttons;
    		if ('ctx' in $$props) ctx = $$props.ctx;
    		if ('mods' in $$props) $$invalidate(0, mods = $$props.mods);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		mods,
    		$output,
    		setButtons,
    		addModule,
    		addPatch,
    		save,
    		load,
    		clear,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5,
    		click_handler_6,
    		click_handler_7,
    		click_handler_8,
    		click_handler_9,
    		click_handler_10,
    		click_handler_11,
    		click_handler_12,
    		click_handler_13
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
