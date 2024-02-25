
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
    const file$9 = "src\\MIDI.svelte";

    // (260:52) {#if note}
    function create_if_block$8(ctx) {
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
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(260:52) {#if note}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
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
    	let br2;
    	let t7;
    	let p2;
    	let t8;
    	let b;
    	let t9;
    	let t10;
    	let br3;
    	let mounted;
    	let dispose;
    	let if_block = /*note*/ ctx[2] && create_if_block$8(ctx);

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
    			t6 = text("\r\n    Noteless trigger: 'SPACE'");
    			br2 = element("br");
    			t7 = space();
    			p2 = element("p");
    			t8 = text("Note played: ");
    			b = element("b");
    			t9 = text(/*note*/ ctx[2]);
    			if (if_block) if_block.c();
    			t10 = space();
    			br3 = element("br");
    			add_location(h2, file$9, 254, 4, 6889);
    			add_location(br0, file$9, 255, 53, 6963);
    			attr_dev(p0, "class", "svelte-fwrw15");
    			add_location(p0, file$9, 255, 4, 6914);
    			add_location(br1, file$9, 257, 33, 7053);
    			add_location(br2, file$9, 258, 29, 7088);
    			attr_dev(p1, "class", "svelte-fwrw15");
    			add_location(p1, file$9, 257, 4, 7024);
    			attr_dev(b, "class", "svelte-fwrw15");
    			toggle_class(b, "active", /*trigger*/ ctx[1]);
    			add_location(b, file$9, 259, 20, 7118);
    			attr_dev(p2, "class", "svelte-fwrw15");
    			add_location(p2, file$9, 259, 4, 7102);
    			attr_dev(div, "class", "svelte-fwrw15");
    			add_location(div, file$9, 253, 0, 6878);
    			add_location(br3, file$9, 261, 0, 7200);
    			add_location(main, file$9, 252, 0, 6870);
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
    			append_dev(p1, t6);
    			append_dev(p1, br2);
    			append_dev(div, t7);
    			append_dev(div, p2);
    			append_dev(p2, t8);
    			append_dev(p2, b);
    			append_dev(b, t9);
    			if (if_block) if_block.m(b, null);
    			append_dev(main, t10);
    			append_dev(main, br3);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", /*onKeyDown*/ ctx[4], false, false, false, false),
    					listen_dev(window, "keyup", /*onKeyUp*/ ctx[5], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*note*/ 4) set_data_dev(t9, /*note*/ ctx[2]);

    			if (/*note*/ ctx[2]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$8(ctx);
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let $midi;
    	let $isTyping;
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(11, $midi = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(12, $isTyping = $$value));
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
    		if ($isTyping) return;
    		e.preventDefault();
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
    			case 81:
    				//Q
    				frequency = 698.46;
    				$$invalidate(2, note = 'F');
    				octUp = 1;
    				break;
    			case 50:
    				//2
    				frequency = 739.99;
    				$$invalidate(2, note = 'F#/Gb');
    				octUp = 1;
    				break;
    			case 87:
    				//W
    				frequency = 783.99;
    				$$invalidate(2, note = 'G');
    				octUp = 1;
    				break;
    			case 51:
    				//3
    				frequency = 830.61;
    				$$invalidate(2, note = 'G#/Ab');
    				octUp = 1;
    				break;
    			case 69:
    				//E
    				frequency = 880.00;
    				$$invalidate(2, note = 'A');
    				octUp = 1;
    				break;
    			case 52:
    				//4
    				frequency = 932.33;
    				$$invalidate(2, note = 'A#/Bb');
    				octUp = 1;
    				break;
    			case 82:
    				//R
    				frequency = 987.77;
    				$$invalidate(2, note = 'B');
    				octUp = 1;
    				break;
    			case 84:
    				//T
    				frequency = 1046.50;
    				$$invalidate(2, note = 'C');
    				octUp = 2;
    				break;
    			case 54:
    				//6
    				frequency = 1108.73;
    				$$invalidate(2, note = 'C#/Db');
    				octUp = 2;
    				break;
    			case 89:
    				//Y
    				frequency = 1174.66;
    				$$invalidate(2, note = 'D');
    				octUp = 2;
    				break;
    			case 55:
    				//7
    				frequency = 1244.51;
    				$$invalidate(2, note = 'D#/Eb');
    				octUp = 2;
    				break;
    			case 85:
    				//U
    				frequency = 1318.51;
    				$$invalidate(2, note = 'E');
    				octUp = 2;
    				break;
    			case 73:
    				//I
    				frequency = 1396.91;
    				$$invalidate(2, note = 'F');
    				octUp = 2;
    				break;
    			case 57:
    				//9
    				frequency = 1479.98;
    				$$invalidate(2, note = 'F#/Gb');
    				octUp = 2;
    				break;
    			case 79:
    				//O
    				frequency = 1567.98;
    				$$invalidate(2, note = 'G');
    				octUp = 2;
    				break;
    			case 48:
    				//0
    				frequency = 1661.22;
    				$$invalidate(2, note = 'G#/Ab');
    				octUp = 2;
    				break;
    			case 80:
    				//P
    				frequency = 1760.00;
    				$$invalidate(2, note = 'A');
    				octUp = 2;
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
    		isTyping,
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
    		$midi,
    		$isTyping
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
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MIDI",
    			options,
    			id: create_fragment$a.name
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

    function create_fragment$9(ctx) {
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
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let $bobSize,
    		$$unsubscribe_bobSize = noop,
    		$$subscribe_bobSize = () => ($$unsubscribe_bobSize(), $$unsubscribe_bobSize = subscribe(bobSize, $$value => $$invalidate(10, $bobSize = $$value)), bobSize);

    	let $triggerSize;
    	let $size;
    	let $coords;
    	let $midi;
    	let $selectingModule;
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(14, $midi = $$value));
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(17, $selectingModule = $$value));
    	$$self.$$.on_destroy.push(() => $$unsubscribe_bobSize());
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ModuleMovement', slots, []);
    	let { hasTrigger = false } = $$props;
    	let { moduleNode } = $$props;
    	let { controlsNode } = $$props;
    	let { deleteNode } = $$props;
    	let { nodeSize = { x: 300, y: 300 } } = $$props;
    	let { nodePos = { x: 300, y: 100 } } = $$props;
    	let { bobSize } = $$props;
    	validate_store(bobSize, 'bobSize');
    	$$subscribe_bobSize();
    	let coords = spring({ x: nodePos.x, y: nodePos.y }, { stiffness: 0.3, damping: 0.5 });
    	validate_store(coords, 'coords');
    	component_subscribe($$self, coords, value => $$invalidate(13, $coords = value));
    	let size = spring(0, { stiffness: 0.3, damping: 0.5 });
    	validate_store(size, 'size');
    	component_subscribe($$self, size, value => $$invalidate(12, $size = value));
    	let triggerSize = spring(0, { stiffness: 1, damping: 0.5 });
    	validate_store(triggerSize, 'triggerSize');
    	component_subscribe($$self, triggerSize, value => $$invalidate(11, $triggerSize = value));
    	let moving = false;
    	let controlling = false;

    	const moduleClick = () => {
    		moving = true;
    		if (!controlling && $selectingModule == null) size.set(20); else if (!controlling) size.set(10);
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

    		if (bobSize === undefined && !('bobSize' in $$props || $$self.$$.bound[$$self.$$.props['bobSize']])) {
    			console.warn("<ModuleMovement> was created without expected prop 'bobSize'");
    		}
    	});

    	const writable_props = [
    		'hasTrigger',
    		'moduleNode',
    		'controlsNode',
    		'deleteNode',
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
    		if ('nodeSize' in $$props) $$invalidate(9, nodeSize = $$props.nodeSize);
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
    		if ('nodeSize' in $$props) $$invalidate(9, nodeSize = $$props.nodeSize);
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
    		if ($$self.$$.dirty & /*moduleNode, $coords, $size, $triggerSize, $bobSize, nodeSize*/ 15888) {
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

    		if ($$self.$$.dirty & /*$midi, hasTrigger*/ 16448) {
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

    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {
    			hasTrigger: 6,
    			moduleNode: 4,
    			controlsNode: 7,
    			deleteNode: 8,
    			nodeSize: 9,
    			nodePos: 5,
    			bobSize: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ModuleMovement",
    			options,
    			id: create_fragment$9.name
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

    /* src\DeleteButton.svelte generated by Svelte v3.59.2 */
    const file$8 = "src\\DeleteButton.svelte";

    function create_fragment$8(ctx) {
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
    			add_location(defs, file$8, 71, 4, 1668);
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
    			add_location(path, file$8, 74, 8, 1961);
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
    			add_location(g, file$8, 73, 4, 1693);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "xmlns:xlink", "http://www.w3.org/1999/xlink");
    			attr_dev(svg, "version", "1.1");
    			attr_dev(svg, "viewBox", "0 0 256 256");
    			attr_dev(svg, "xml:space", "preserve");
    			add_location(svg, file$8, 70, 0, 1508);
    			add_location(main, file$8, 69, 0, 1500);
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
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
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

    	onMount(() => {
    		button.addEventListener('mousedown', buttonClick);
    		button.addEventListener('touchstart', buttonClick);
    		button.addEventListener('mouseup', buttonUnClick);
    		button.addEventListener('touchend', buttonUnClick);
    		window.addEventListener('mouseup', windowUnClick);
    		window.addEventListener('touchend', buttonUnClick);
    		button.addEventListener('mouseover', buttonHover);
    		button.addEventListener('mouseout', buttonUnHover);
    	});

    	function setButton(node) {
    		$$invalidate(3, button = node);
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
    		onMount,
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
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, { module: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "DeleteButton",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get module() {
    		throw new Error("<DeleteButton>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set module(value) {
    		throw new Error("<DeleteButton>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\VCO.svelte generated by Svelte v3.59.2 */
    const file$7 = "src\\VCO.svelte";

    // (291:0) {#if !module.destroyed}
    function create_if_block$7(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div4;
    	let div0;
    	let deletebutton;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[4].state.id + "";
    	let t2;
    	let t3;
    	let div3;
    	let h2;
    	let t4_value = /*module*/ ctx[4].state.title + "";
    	let t4;
    	let t5;
    	let div1;
    	let label0;
    	let button0;
    	let t6;
    	let t7;
    	let label1;
    	let t8;
    	let t9_value = /*totalFrequency*/ ctx[5].toFixed(1) + "";
    	let t9;
    	let t10;
    	let input0;
    	let t11;
    	let br0;
    	let br1;
    	let t12;
    	let div2;
    	let label2;
    	let button1;
    	let t13;
    	let t14;
    	let label3;
    	let t15;
    	let t16_value = /*module*/ ctx[4].state.detune + "";
    	let t16;
    	let t17;
    	let input1;
    	let t18;
    	let br2;
    	let section;
    	let input2;
    	let input2_id_value;
    	let label4;
    	let t19;
    	let label4_for_value;
    	let t20;
    	let input3;
    	let input3_id_value;
    	let label5;
    	let t21;
    	let label5_for_value;
    	let t22;
    	let input4;
    	let input4_id_value;
    	let label6;
    	let t23;
    	let label6_for_value;
    	let t24;
    	let input5;
    	let input5_id_value;
    	let label7;
    	let t25;
    	let label7_for_value;
    	let div4_style_value;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[29](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[30](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[31](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[32](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[33](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 320, y: 420 } };

    	if (/*moduleNode*/ ctx[1] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[1];
    	}

    	if (/*controlsNode*/ ctx[2] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[2];
    	}

    	if (/*deleteNode*/ ctx[3] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[3];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
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
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[4] },
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*module*/ ctx[4].state.cvId != null && /*$modules*/ ctx[7][/*module*/ ctx[4].state.cvId]) return create_if_block_2$3;
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
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[44][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div4 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			div3 = element("div");
    			h2 = element("h2");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			label0 = element("label");
    			button0 = element("button");
    			if_block0.c();
    			t6 = text(" Control");
    			t7 = space();
    			label1 = element("label");
    			t8 = text("Frequency (");
    			t9 = text(t9_value);
    			t10 = text("Hz)");
    			input0 = element("input");
    			t11 = space();
    			br0 = element("br");
    			br1 = element("br");
    			t12 = space();
    			div2 = element("div");
    			label2 = element("label");
    			button1 = element("button");
    			if_block1.c();
    			t13 = text(" Control");
    			t14 = space();
    			label3 = element("label");
    			t15 = text("Detune (");
    			t16 = text(t16_value);
    			t17 = text(" cents)");
    			input1 = element("input");
    			t18 = space();
    			br2 = element("br");
    			section = element("section");
    			input2 = element("input");
    			label4 = element("label");
    			t19 = text("Sine");
    			t20 = space();
    			input3 = element("input");
    			label5 = element("label");
    			t21 = text("Triangle");
    			t22 = space();
    			input4 = element("input");
    			label6 = element("label");
    			t23 = text("Sawtooth");
    			t24 = space();
    			input5 = element("input");
    			label7 = element("label");
    			t25 = text("Square");
    			attr_dev(div0, "class", "delete svelte-gr9wpl");
    			add_location(div0, file$7, 294, 4, 10225);
    			add_location(h1, file$7, 295, 4, 10303);
    			attr_dev(h2, "class", "editableTitle svelte-gr9wpl");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[7][/*module*/ ctx[4].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[34].call(h2));
    			add_location(h2, file$7, 297, 8, 10383);
    			attr_dev(button0, "class", "svelte-gr9wpl");
    			add_location(button0, file$7, 300, 19, 10699);
    			add_location(label0, file$7, 300, 12, 10692);
    			attr_dev(div1, "class", "inputDiv");
    			add_location(div1, file$7, 299, 8, 10544);
    			attr_dev(label1, "for", "freq");
    			add_location(label1, file$7, 307, 8, 11041);
    			attr_dev(input0, "id", "freq");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "-2");
    			attr_dev(input0, "max", "2");
    			attr_dev(input0, "step", "0.083333333333333");
    			add_location(input0, file$7, 307, 75, 11108);
    			add_location(br0, file$7, 308, 8, 11226);
    			add_location(br1, file$7, 308, 12, 11230);
    			attr_dev(button1, "class", "svelte-gr9wpl");
    			add_location(button1, file$7, 311, 19, 11401);
    			add_location(label2, file$7, 311, 12, 11394);
    			attr_dev(div2, "class", "inputDiv");
    			add_location(div2, file$7, 310, 8, 11246);
    			attr_dev(label3, "for", "detune");
    			add_location(label3, file$7, 318, 8, 11749);
    			attr_dev(input1, "id", "detune");
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "-100");
    			attr_dev(input1, "max", "100");
    			attr_dev(input1, "step", "1");
    			add_location(input1, file$7, 318, 72, 11813);
    			add_location(br2, file$7, 320, 8, 11920);
    			attr_dev(input2, "id", input2_id_value = 'sine' + /*module*/ ctx[4].state.id);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "sine";
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-gr9wpl");
    			add_location(input2, file$7, 321, 12, 11961);
    			attr_dev(label4, "for", label4_for_value = 'sine' + /*module*/ ctx[4].state.id);
    			attr_dev(label4, "class", "svelte-gr9wpl");
    			add_location(label4, file$7, 321, 107, 12056);
    			attr_dev(input3, "id", input3_id_value = 'triangle' + /*module*/ ctx[4].state.id);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "triangle";
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-gr9wpl");
    			add_location(input3, file$7, 322, 12, 12118);
    			attr_dev(label5, "for", label5_for_value = 'triangle' + /*module*/ ctx[4].state.id);
    			attr_dev(label5, "class", "svelte-gr9wpl");
    			add_location(label5, file$7, 322, 116, 12222);
    			attr_dev(input4, "id", input4_id_value = 'sawtooth' + /*module*/ ctx[4].state.id);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "sawtooth";
    			input4.value = input4.__value;
    			attr_dev(input4, "class", "svelte-gr9wpl");
    			add_location(input4, file$7, 323, 12, 12292);
    			attr_dev(label6, "for", label6_for_value = 'sawtooth' + /*module*/ ctx[4].state.id);
    			attr_dev(label6, "class", "svelte-gr9wpl");
    			add_location(label6, file$7, 323, 115, 12395);
    			attr_dev(input5, "id", input5_id_value = 'square' + /*module*/ ctx[4].state.id);
    			attr_dev(input5, "type", "radio");
    			input5.__value = "square";
    			input5.value = input5.__value;
    			attr_dev(input5, "class", "svelte-gr9wpl");
    			add_location(input5, file$7, 324, 12, 12465);
    			attr_dev(label7, "for", label7_for_value = 'square' + /*module*/ ctx[4].state.id);
    			attr_dev(label7, "class", "svelte-gr9wpl");
    			add_location(label7, file$7, 324, 111, 12564);
    			attr_dev(section, "class", "shape svelte-gr9wpl");
    			add_location(section, file$7, 320, 12, 11924);
    			attr_dev(div3, "class", "controls");
    			add_location(div3, file$7, 296, 4, 10335);
    			attr_dev(div4, "id", "module");
    			attr_dev(div4, "style", div4_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[4].state.type]);
    			attr_dev(div4, "class", "svelte-gr9wpl");
    			add_location(div4, file$7, 293, 4, 10129);
    			add_location(main, file$7, 291, 0, 9941);
    			binding_group.p(input2, input3, input4, input5);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div4);
    			append_dev(div4, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div4, t1);
    			append_dev(div4, h1);
    			append_dev(h1, t2);
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, h2);
    			append_dev(h2, t4);

    			if (/*$modules*/ ctx[7][/*module*/ ctx[4].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[7][/*module*/ ctx[4].state.id].state.title;
    			}

    			append_dev(div3, t5);
    			append_dev(div3, div1);
    			append_dev(div1, label0);
    			append_dev(label0, button0);
    			if_block0.m(button0, null);
    			append_dev(label0, t6);
    			append_dev(div3, t7);
    			append_dev(div3, label1);
    			append_dev(label1, t8);
    			append_dev(label1, t9);
    			append_dev(label1, t10);
    			append_dev(div3, input0);
    			set_input_value(input0, /*module*/ ctx[4].state.frequency);
    			append_dev(div3, t11);
    			append_dev(div3, br0);
    			append_dev(div3, br1);
    			append_dev(div3, t12);
    			append_dev(div3, div2);
    			append_dev(div2, label2);
    			append_dev(label2, button1);
    			if_block1.m(button1, null);
    			append_dev(label2, t13);
    			append_dev(div3, t14);
    			append_dev(div3, label3);
    			append_dev(label3, t15);
    			append_dev(label3, t16);
    			append_dev(label3, t17);
    			append_dev(div3, input1);
    			set_input_value(input1, /*module*/ ctx[4].state.detune);
    			append_dev(div3, t18);
    			append_dev(div3, br2);
    			append_dev(div3, section);
    			append_dev(section, input2);
    			input2.checked = input2.__value === /*module*/ ctx[4].state.shape;
    			append_dev(section, label4);
    			append_dev(label4, t19);
    			append_dev(section, t20);
    			append_dev(section, input3);
    			input3.checked = input3.__value === /*module*/ ctx[4].state.shape;
    			append_dev(section, label5);
    			append_dev(label5, t21);
    			append_dev(section, t22);
    			append_dev(section, input4);
    			input4.checked = input4.__value === /*module*/ ctx[4].state.shape;
    			append_dev(section, label6);
    			append_dev(label6, t23);
    			append_dev(section, t24);
    			append_dev(section, input5);
    			input5.checked = input5.__value === /*module*/ ctx[4].state.shape;
    			append_dev(section, label7);
    			append_dev(label7, t25);
    			/*main_binding*/ ctx[48](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[12].call(null, div0)),
    					action_destroyer(/*setTitleNode*/ ctx[13].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[34]),
    					action_destroyer(/*setFreqCvBtn*/ ctx[14].call(null, button0)),
    					listen_dev(button0, "click", /*click_handler*/ ctx[35], false, false, false, false),
    					listen_dev(div1, "mouseenter", /*mouseenter_handler*/ ctx[36], false, false, false, false),
    					listen_dev(div1, "mouseleave", /*mouseleave_handler*/ ctx[37], false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[38]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[38]),
    					action_destroyer(/*setDetuneCvBtn*/ ctx[15].call(null, button1)),
    					listen_dev(button1, "click", /*click_handler_1*/ ctx[39], false, false, false, false),
    					listen_dev(div2, "mouseenter", /*mouseenter_handler_1*/ ctx[40], false, false, false, false),
    					listen_dev(div2, "mouseleave", /*mouseleave_handler_1*/ ctx[41], false, false, false, false),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[42]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[42]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[43]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[45]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[46]),
    					listen_dev(input5, "change", /*input5_change_handler*/ ctx[47]),
    					action_destroyer(/*setControls*/ ctx[11].call(null, div3)),
    					action_destroyer(/*setModule*/ ctx[10].call(null, div4))
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

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 512) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[9];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 16) deletebutton_changes.module = /*module*/ ctx[4];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty[0] & /*module*/ 16) && t2_value !== (t2_value = /*module*/ ctx[4].state.id + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty[0] & /*module*/ 16) && t4_value !== (t4_value = /*module*/ ctx[4].state.title + "")) set_data_contenteditable_dev(t4, t4_value);

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

    			if ((!current || dirty[0] & /*totalFrequency*/ 32) && t9_value !== (t9_value = /*totalFrequency*/ ctx[5].toFixed(1) + "")) set_data_dev(t9, t9_value);

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

    			if ((!current || dirty[0] & /*module*/ 16) && t16_value !== (t16_value = /*module*/ ctx[4].state.detune + "")) set_data_dev(t16, t16_value);

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

    			if (!current || dirty[0] & /*$colours, module*/ 272 && div4_style_value !== (div4_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[4].state.type])) {
    				attr_dev(div4, "style", div4_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			if_block0.d();
    			if_block1.d();
    			/*main_binding*/ ctx[48](null);
    			binding_group.r();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(291:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    // (304:16) {:else}
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
    		source: "(304:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (302:16) {#if module.state.cvId != null && $modules[module.state.cvId]}
    function create_if_block_2$3(ctx) {
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
    		id: create_if_block_2$3.name,
    		type: "if",
    		source: "(302:16) {#if module.state.cvId != null && $modules[module.state.cvId]}",
    		ctx
    	});

    	return block;
    }

    // (315:16) {:else}
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
    		source: "(315:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (313:16) {#if module.state.cvId2 != null && $modules[module.state.cvId2]}
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
    		source: "(313:16) {#if module.state.cvId2 != null && $modules[module.state.cvId2]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[4].destroyed && create_if_block$7(ctx);

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
    	component_subscribe($$self, context, $$value => $$invalidate(27, $context = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(52, $isTyping = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(53, $output = $$value));
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(28, $midi = $$value));
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
    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.isAudio = true;
    	module.isControl = false;
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
    		titleNode.style.outline = "none";
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

    	function setFreqCvBtn(node) {
    		$$invalidate(18, freqCvBtn = node);

    		freqCvBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(18, freqCvBtn.style.opacity = 0.8, freqCvBtn);
    		});

    		freqCvBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(18, freqCvBtn.style.opacity = 1, freqCvBtn);
    		});
    	}

    	function setDetuneCvBtn(node) {
    		$$invalidate(19, detuneCvBtn = node);

    		detuneCvBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(19, detuneCvBtn.style.opacity = 0.8, detuneCvBtn);
    		});

    		detuneCvBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(19, detuneCvBtn.style.opacity = 1, detuneCvBtn);
    		});
    	}

    	var currentFreqCvModule;
    	let currentDetuneCvModule;

    	module.clearCurrents = () => {
    		$$invalidate(20, freqCvModule = null);
    		$$invalidate(24, currentFreqCvModule = null);
    		$$invalidate(21, detuneCvModule = null);
    		$$invalidate(25, currentDetuneCvModule = null);
    	};

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(26, $opacity = value));
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

    	module.cvSelecting = null;

    	function chooseCv(i) {
    		$$invalidate(4, module.cvSelecting = i, module);
    		cvsAllHover(module, i);
    		if (!freqCvBtn) return;

    		if (!module.selectingCv) {
    			$$invalidate(4, module.selectingCv = true, module);

    			if (module.cvSelecting == 0) {
    				$$invalidate(18, freqCvBtn.style.opacity = 0.5, freqCvBtn);
    			} else {
    				$$invalidate(19, detuneCvBtn.style.opacity = 0.5, detuneCvBtn);
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
    				$$invalidate(18, freqCvBtn.style.opacity = 1, freqCvBtn);
    			} else {
    				$$invalidate(4, module.state.cvId2 = id, module);
    				$$invalidate(19, detuneCvBtn.style.opacity = 1, detuneCvBtn);
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
    		($$invalidate(1, moduleNode), $$invalidate(26, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(2, controlsNode), $$invalidate(3, deleteNode)), $$invalidate(6, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(3, deleteNode), $$invalidate(2, controlsNode)), $$invalidate(6, $selectingModule));
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
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
    		setTitleNode,
    		setFreqCvBtn,
    		setDetuneCvBtn,
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
    		if ('freqCvBtn' in $$props) $$invalidate(18, freqCvBtn = $$props.freqCvBtn);
    		if ('detuneCvBtn' in $$props) $$invalidate(19, detuneCvBtn = $$props.detuneCvBtn);
    		if ('freqCvModule' in $$props) $$invalidate(20, freqCvModule = $$props.freqCvModule);
    		if ('detuneCvModule' in $$props) $$invalidate(21, detuneCvModule = $$props.detuneCvModule);
    		if ('voct' in $$props) $$invalidate(22, voct = $$props.voct);
    		if ('oscNode' in $$props) $$invalidate(23, oscNode = $$props.oscNode);
    		if ('totalFrequency' in $$props) $$invalidate(5, totalFrequency = $$props.totalFrequency);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('currentFreqCvModule' in $$props) $$invalidate(24, currentFreqCvModule = $$props.currentFreqCvModule);
    		if ('currentDetuneCvModule' in $$props) $$invalidate(25, currentDetuneCvModule = $$props.currentDetuneCvModule);
    		if ('opacity' in $$props) $$invalidate(16, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(9, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $modules*/ 144) {
    			if (module.state.cvId != null) {
    				$$invalidate(20, freqCvModule = $modules[module.state.cvId]);
    			} else {
    				$$invalidate(20, freqCvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, $modules*/ 144) {
    			if (module.state.cvId2 != null) {
    				$$invalidate(21, detuneCvModule = $modules[module.state.cvId2]);
    			} else {
    				$$invalidate(21, detuneCvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$midi*/ 268435456) {
    			if ($midi.voct) $$invalidate(22, voct = $midi.voct);
    		}

    		if ($$self.$$.dirty[0] & /*voct, module*/ 4194320) {
    			$$invalidate(5, totalFrequency = Math.pow(2, voct + module.state.frequency));
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 16) {
    			$$invalidate(23, oscNode.type = module.state.shape, oscNode);
    		}

    		if ($$self.$$.dirty[0] & /*oscNode, totalFrequency, $context*/ 142606368) {
    			oscNode.frequency.setValueAtTime(totalFrequency, $context.currentTime);
    		}

    		if ($$self.$$.dirty[0] & /*oscNode, module, $context*/ 142606352) {
    			oscNode.detune.setValueAtTime(module.state.detune, $context.currentTime);
    		}

    		if ($$self.$$.dirty[0] & /*module, freqCvModule, oscNode, $context, currentFreqCvModule, totalFrequency*/ 160432176) {
    			if (!module.destroyed) {
    				if (freqCvModule) {
    					oscNode.frequency.cancelScheduledValues($context.currentTime);
    					oscNode.frequency.setValueAtTime(0, $context.currentTime);

    					if (currentFreqCvModule) {
    						if (currentFreqCvModule.outputs[module.state.id + ".1"]) ;
    						currentFreqCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(24, currentFreqCvModule = freqCvModule);
    					if (!currentFreqCvModule.outputs[module.state.id + ".1"]) currentFreqCvModule.addOutput(module.state.id + ".1", module.cv);
    				} else {
    					oscNode.frequency.cancelScheduledValues($context.currentTime);
    					oscNode.frequency.setValueAtTime(totalFrequency, $context.currentTime);

    					if (currentFreqCvModule) {
    						if (currentFreqCvModule.outputs[module.state.id + ".1"]) currentFreqCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(24, currentFreqCvModule = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*currentFreqCvModule, module, totalFrequency*/ 16777264) {
    			if (currentFreqCvModule) {
    				currentFreqCvModule.setGain(module.state.id + ".1", totalFrequency);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, detuneCvModule, oscNode, $context, currentDetuneCvModule*/ 178257936) {
    			if (!module.destroyed) {
    				if (detuneCvModule) {
    					oscNode.detune.cancelScheduledValues($context.currentTime);
    					oscNode.detune.setValueAtTime(0, $context.currentTime);

    					if (currentDetuneCvModule) {
    						if (currentDetuneCvModule.outputs[module.state.id + ".2"]) ;
    						currentDetuneCvModule.removeOutput(module.state.id + ".2", module.cv2);
    					}

    					$$invalidate(25, currentDetuneCvModule = detuneCvModule);
    					if (!currentDetuneCvModule.outputs[module.state.id + ".2"]) currentDetuneCvModule.addOutput(module.state.id + ".2", module.cv2);
    				} else {
    					oscNode.detune.cancelScheduledValues($context.currentTime);
    					oscNode.detune.setValueAtTime(module.state.detune, $context.currentTime);

    					if (currentDetuneCvModule) {
    						if (currentDetuneCvModule.outputs[module.state.id + ".2"]) currentDetuneCvModule.removeOutput(module.state.id + ".2", module.cv2);
    					}

    					$$invalidate(25, currentDetuneCvModule = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*currentDetuneCvModule, module*/ 33554448) {
    			if (currentDetuneCvModule) {
    				currentDetuneCvModule.setGain(module.state.id + ".2", module.state.detune);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 67108866) {
    			if (moduleNode) $$invalidate(1, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module, freqCvBtn, $colours, $modules, detuneCvBtn*/ 786832) {
    			if (!module.destroyed) {
    				if (freqCvBtn) {
    					if (module.state.cvId != null) {
    						$$invalidate(18, freqCvBtn.style.backgroundColor = $colours[$modules[module.state.cvId].state.type], freqCvBtn);
    					} else {
    						$$invalidate(18, freqCvBtn.style.backgroundColor = "#f0f0f0", freqCvBtn);
    					}
    				}

    				if (detuneCvBtn) {
    					if (module.state.cvId2 != null) {
    						$$invalidate(19, detuneCvBtn.style.backgroundColor = $colours[$modules[module.state.cvId2].state.type], detuneCvBtn);
    					} else {
    						$$invalidate(19, detuneCvBtn.style.backgroundColor = "#f0f0f0", detuneCvBtn);
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
    		bobSize,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		setFreqCvBtn,
    		setDetuneCvBtn,
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
    		modulemovement_nodePos_binding,
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
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCO",
    			options,
    			id: create_fragment$7.name
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

    const { Object: Object_1$2 } = globals;
    const file$6 = "src\\Output.svelte";

    // (132:48) 
    function create_if_block_2$2(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Select input below";
    			add_location(p, file$6, 131, 48, 3798);
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
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(132:48) ",
    		ctx
    	});

    	return block;
    }

    // (131:8) {#if Object.values($modules).length == 0}
    function create_if_block_1$3(ctx) {
    	let p;

    	const block = {
    		c: function create() {
    			p = element("p");
    			p.textContent = "Add modules using buttons above";
    			add_location(p, file$6, 130, 49, 3710);
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
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(131:8) {#if Object.values($modules).length == 0}",
    		ctx
    	});

    	return block;
    }

    // (139:12) {:else}
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
    		source: "(139:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (137:12) {#if $output.state.inputId != null && $modules[$output.state.inputId]}
    function create_if_block$6(ctx) {
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
    			if (dirty & /*$output*/ 2 && t0_value !== (t0_value = /*$output*/ ctx[1].state.inputId + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*$modules, $output*/ 6 && t2_value !== (t2_value = /*$modules*/ ctx[2][/*$output*/ ctx[1].state.inputId].state.title + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(137:12) {#if $output.state.inputId != null && $modules[$output.state.inputId]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let main;
    	let div2;
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
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (dirty & /*$modules*/ 4) show_if = null;
    		if (show_if == null) show_if = !!(Object.values(/*$modules*/ ctx[2]).length == 0);
    		if (show_if) return create_if_block_1$3;
    		if (/*$output*/ ctx[1].state.inputId == null) return create_if_block_2$2;
    	}

    	let current_block_type = select_block_type(ctx, -1);
    	let if_block0 = current_block_type && current_block_type(ctx);

    	function select_block_type_1(ctx, dirty) {
    		if (/*$output*/ ctx[1].state.inputId != null && /*$modules*/ ctx[2][/*$output*/ ctx[1].state.inputId]) return create_if_block$6;
    		return create_else_block$4;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div2 = element("div");
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
    			add_location(h2, file$6, 129, 8, 3618);
    			attr_dev(button, "class", "svelte-1ogz0su");
    			add_location(button, file$6, 135, 15, 4025);
    			add_location(label0, file$6, 135, 8, 4018);
    			attr_dev(div0, "id", "inputDiv");
    			attr_dev(div0, "class", "svelte-1ogz0su");
    			add_location(div0, file$6, 134, 8, 3879);
    			add_location(br0, file$6, 142, 14, 4354);
    			attr_dev(label1, "for", "gain");
    			add_location(label1, file$6, 143, 8, 4368);
    			attr_dev(input, "id", "gain");
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$6, 143, 40, 4400);
    			add_location(div1, file$6, 133, 8, 3848);
    			attr_dev(div2, "id", "mainDiv");
    			attr_dev(div2, "class", "svelte-1ogz0su");
    			add_location(div2, file$6, 128, 4, 3579);
    			add_location(br1, file$6, 146, 4, 4527);
    			add_location(main, file$6, 127, 0, 3567);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div2);
    			append_dev(div2, h2);
    			append_dev(h2, t0);
    			append_dev(h2, t1);
    			append_dev(h2, t2);
    			append_dev(div2, t3);
    			if (if_block0) if_block0.m(div2, null);
    			append_dev(div2, t4);
    			append_dev(div2, div1);
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
    			append_dev(main, t9);
    			append_dev(main, br1);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setInputBtn*/ ctx[6].call(null, button)),
    					listen_dev(button, "click", /*chooseInput*/ ctx[8], false, false, false, false),
    					listen_dev(div0, "mouseenter", /*mouseenter_handler*/ ctx[18], false, false, false, false),
    					listen_dev(div0, "mouseleave", /*mouseleave_handler*/ ctx[19], false, false, false, false),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[20]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[20]),
    					action_destroyer(/*setControls*/ ctx[5].call(null, div1)),
    					action_destroyer(/*setDiv*/ ctx[4].call(null, div2))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*connectedString*/ 8) set_data_dev(t1, /*connectedString*/ ctx[3]);

    			if (current_block_type !== (current_block_type = select_block_type(ctx, dirty))) {
    				if (if_block0) if_block0.d(1);
    				if_block0 = current_block_type && current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div2, t4);
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

    			if (dirty & /*$output*/ 2) {
    				set_input_value(input, /*$output*/ ctx[1].state.volume);
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
    	let $selectingModule;
    	let $output;
    	let $modules;
    	let $colours;
    	let $redness;
    	let $context;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(0, $selectingModule = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(1, $output = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(2, $modules = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(16, $colours = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(21, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Output', slots, []);
    	let { state = { volume: 0.2, inputId: null } } = $$props;
    	let divNode;
    	let controlsNode;
    	let inputBtn;
    	set_store_value(output, $output.selectingInput = false, $output);
    	set_store_value(output, $output.state = state, $output);
    	var gainNode = $context.createGain();
    	gainNode.connect($context.destination);
    	var currentInput;

    	const setDiv = node => {
    		$$invalidate(10, divNode = node);

    		divNode.addEventListener("mousedown", () => {
    			if ($selectingModule == "output") {
    				$output.select(null);
    			}
    		});
    	};

    	const setControls = node => {
    		$$invalidate(11, controlsNode = node);
    	};

    	const setInputBtn = node => {
    		$$invalidate(12, inputBtn = node);

    		inputBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(12, inputBtn.style.opacity = 0.8, inputBtn);
    		});

    		inputBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(12, inputBtn.style.opacity = 1, inputBtn);
    		});
    	};

    	let redness = spring(0, { stiffness: 0.05, damping: 0.3 });
    	validate_store(redness, 'redness');
    	component_subscribe($$self, redness, value => $$invalidate(17, $redness = value));
    	let loaded = false;
    	let connectedString = "disconnected";

    	setTimeout(
    		() => {
    			$$invalidate(15, loaded = true);
    		},
    		500
    	);

    	function chooseInput() {
    		inputsAllHover(null);
    		if (!inputBtn) return;

    		if (!$output.selectingInput) {
    			set_store_value(output, $output.selectingInput = true, $output);
    			$$invalidate(12, inputBtn.style.opacity = 0.5, inputBtn);
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
    				$$invalidate(12, inputBtn.style.opacity = 1, inputBtn);
    				set_store_value(output, $output.selectingInput = false, $output);
    			}

    			set_store_value(selectingModule, $selectingModule = null, $selectingModule);
    			unhover();
    		},
    		$output
    	);

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

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(9, state = $$props.state);
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
    		gainNode,
    		currentInput,
    		setDiv,
    		setControls,
    		setInputBtn,
    		redness,
    		loaded,
    		connectedString,
    		chooseInput,
    		$selectingModule,
    		$output,
    		$modules,
    		$colours,
    		$redness,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(9, state = $$props.state);
    		if ('divNode' in $$props) $$invalidate(10, divNode = $$props.divNode);
    		if ('controlsNode' in $$props) $$invalidate(11, controlsNode = $$props.controlsNode);
    		if ('inputBtn' in $$props) $$invalidate(12, inputBtn = $$props.inputBtn);
    		if ('gainNode' in $$props) $$invalidate(13, gainNode = $$props.gainNode);
    		if ('currentInput' in $$props) $$invalidate(14, currentInput = $$props.currentInput);
    		if ('redness' in $$props) $$invalidate(7, redness = $$props.redness);
    		if ('loaded' in $$props) $$invalidate(15, loaded = $$props.loaded);
    		if ('connectedString' in $$props) $$invalidate(3, connectedString = $$props.connectedString);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$output, $modules*/ 6) {
    			if ($output.state.inputId != null) {
    				set_store_value(output, $output.input = $modules[$output.state.inputId], $output);
    			} else {
    				set_store_value(output, $output.input = null, $output);
    			}
    		}

    		if ($$self.$$.dirty & /*$output*/ 2) {
    			$$invalidate(13, gainNode.gain.value = $output.state.volume, gainNode);
    		}

    		if ($$self.$$.dirty & /*$output, currentInput, gainNode*/ 24578) {
    			if ($output.input) {
    				if (currentInput) currentInput.disconnect(gainNode);
    				$$invalidate(14, currentInput = $output.input.output);
    				currentInput.connect(gainNode);
    				if ($output.input.input || $output.input.inputs) $output.input.update();
    			} else {
    				if (currentInput) currentInput.disconnect(gainNode);
    				$$invalidate(14, currentInput = null);
    			}
    		}

    		if ($$self.$$.dirty & /*divNode, $redness*/ 132096) {
    			if (divNode) $$invalidate(10, divNode.style.backgroundColor = `rgba(255, ${255 - $redness}, ${255 - $redness}, 0.7)`, divNode);
    		}

    		if ($$self.$$.dirty & /*loaded, $output*/ 32770) {
    			if (loaded && $output.state.inputId == null) {
    				redness.set(255);
    				$$invalidate(3, connectedString = "disconnected");
    			} else {
    				redness.set(0);
    				$$invalidate(3, connectedString = "connected");
    			}
    		}

    		if ($$self.$$.dirty & /*inputBtn, $output, $colours, $modules*/ 69638) {
    			if (inputBtn) {
    				if ($output.state.inputId != null) {
    					$$invalidate(12, inputBtn.style.backgroundColor = $colours[$modules[$output.state.inputId].state.type], inputBtn);
    				} else {
    					$$invalidate(12, inputBtn.style.backgroundColor = "#f0f0f0", inputBtn);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*controlsNode, $selectingModule*/ 2049) {
    			if (controlsNode) {
    				if ($selectingModule != null) {
    					$$invalidate(11, controlsNode.style.pointerEvents = "none", controlsNode);
    				} else {
    					$$invalidate(11, controlsNode.style.pointerEvents = "all", controlsNode);
    				}
    			}
    		}

    		if ($$self.$$.dirty & /*divNode, $selectingModule*/ 1025) {
    			if (divNode) {
    				if ($selectingModule != null) {
    					$$invalidate(10, divNode.style.pointerEvents = "all", divNode);
    				} else {
    					$$invalidate(10, divNode.style.pointerEvents = "none", divNode);
    				}
    			}
    		}
    	};

    	return [
    		$selectingModule,
    		$output,
    		$modules,
    		connectedString,
    		setDiv,
    		setControls,
    		setInputBtn,
    		redness,
    		chooseInput,
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
    		input_change_input_handler
    	];
    }

    class Output extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { state: 9 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Output",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get state() {
    		throw new Error("<Output>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Output>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\VCA.svelte generated by Svelte v3.59.2 */

    const { window: window_1 } = globals;
    const file$5 = "src\\VCA.svelte";

    // (259:0) {#if !module.destroyed}
    function create_if_block$5(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div4;
    	let div0;
    	let deletebutton;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[1].state.id + "";
    	let t2;
    	let t3;
    	let div3;
    	let h2;
    	let t4_value = /*module*/ ctx[1].state.title + "";
    	let t4;
    	let t5;
    	let div1;
    	let label0;
    	let button0;
    	let t6;
    	let t7;
    	let div2;
    	let label1;
    	let button1;
    	let t8;
    	let br0;
    	let t9;
    	let label2;
    	let t10;
    	let t11_value = /*module*/ ctx[1].state.gain.toFixed(2) + "";
    	let t11;
    	let t12;
    	let input;
    	let div4_style_value;
    	let t13;
    	let br1;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[26](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[27](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[28](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[29](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[30](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 280, y: 310 } };

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*deleteNode*/ ctx[4] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[4];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
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
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
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
    		if (/*module*/ ctx[1].state.cvId != null && /*$modules*/ ctx[6][/*module*/ ctx[1].state.cvId]) return create_if_block_1$2;
    		return create_else_block$3;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div4 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			div3 = element("div");
    			h2 = element("h2");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			label0 = element("label");
    			button0 = element("button");
    			if_block0.c();
    			t6 = text(" Input");
    			t7 = space();
    			div2 = element("div");
    			label1 = element("label");
    			button1 = element("button");
    			if_block1.c();
    			t8 = text(" Control");
    			br0 = element("br");
    			t9 = space();
    			label2 = element("label");
    			t10 = text("Volume (");
    			t11 = text(t11_value);
    			t12 = text(")");
    			input = element("input");
    			t13 = space();
    			br1 = element("br");
    			attr_dev(div0, "class", "delete svelte-1dvaz9a");
    			add_location(div0, file$5, 262, 4, 8899);
    			add_location(h1, file$5, 263, 4, 8977);
    			attr_dev(h2, "class", "editableTitle svelte-1dvaz9a");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[6][/*module*/ ctx[1].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[31].call(h2));
    			add_location(h2, file$5, 265, 8, 9054);
    			attr_dev(button0, "class", "svelte-1dvaz9a");
    			add_location(button0, file$5, 268, 15, 9371);
    			add_location(label0, file$5, 268, 8, 9364);
    			attr_dev(div1, "class", "inputDiv");
    			add_location(div1, file$5, 267, 8, 9222);
    			attr_dev(button1, "class", "svelte-1dvaz9a");
    			add_location(button1, file$5, 277, 15, 9846);
    			add_location(label1, file$5, 277, 8, 9839);
    			attr_dev(div2, "class", "inputDiv");
    			add_location(div2, file$5, 276, 8, 9698);
    			add_location(br0, file$5, 283, 39, 10145);
    			attr_dev(label2, "for", "gain");
    			add_location(label2, file$5, 284, 8, 10159);
    			attr_dev(input, "id", "gain");
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$5, 284, 73, 10224);
    			attr_dev(div3, "id", "controls");
    			add_location(div3, file$5, 264, 4, 9009);
    			attr_dev(div4, "id", "module");
    			attr_dev(div4, "style", div4_style_value = "background-color: " + /*$colours*/ ctx[7][/*module*/ ctx[1].state.type]);
    			attr_dev(div4, "class", "svelte-1dvaz9a");
    			add_location(div4, file$5, 261, 0, 8803);
    			add_location(br1, file$5, 287, 0, 10336);
    			add_location(main, file$5, 259, 0, 8623);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div4);
    			append_dev(div4, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div4, t1);
    			append_dev(div4, h1);
    			append_dev(h1, t2);
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, h2);
    			append_dev(h2, t4);

    			if (/*$modules*/ ctx[6][/*module*/ ctx[1].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[6][/*module*/ ctx[1].state.id].state.title;
    			}

    			append_dev(div3, t5);
    			append_dev(div3, div1);
    			append_dev(div1, label0);
    			append_dev(label0, button0);
    			if_block0.m(button0, null);
    			append_dev(label0, t6);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			append_dev(div2, label1);
    			append_dev(label1, button1);
    			if_block1.m(button1, null);
    			append_dev(label1, t8);
    			append_dev(div3, br0);
    			append_dev(div3, t9);
    			append_dev(div3, label2);
    			append_dev(label2, t10);
    			append_dev(label2, t11);
    			append_dev(label2, t12);
    			append_dev(div3, input);
    			set_input_value(input, /*module*/ ctx[1].state.gain);
    			append_dev(main, t13);
    			append_dev(main, br1);
    			/*main_binding*/ ctx[37](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[11].call(null, div0)),
    					action_destroyer(/*setTitleNode*/ ctx[14].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[31]),
    					action_destroyer(/*setInputBtn*/ ctx[12].call(null, button0)),
    					listen_dev(button0, "click", /*chooseInput*/ ctx[16], false, false, false, false),
    					listen_dev(div1, "mouseenter", /*mouseenter_handler*/ ctx[32], false, false, false, false),
    					listen_dev(div1, "mouseleave", /*mouseleave_handler*/ ctx[33], false, false, false, false),
    					action_destroyer(/*setCvBtn*/ ctx[13].call(null, button1)),
    					listen_dev(button1, "click", /*chooseCv*/ ctx[17], false, false, false, false),
    					listen_dev(div2, "mouseenter", /*mouseenter_handler_1*/ ctx[34], false, false, false, false),
    					listen_dev(div2, "mouseleave", /*mouseleave_handler_1*/ ctx[35], false, false, false, false),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[36]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[36]),
    					action_destroyer(/*setControls*/ ctx[10].call(null, div3)),
    					action_destroyer(/*setModule*/ ctx[9].call(null, div4))
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

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
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
    			if ((!current || dirty[0] & /*module*/ 2) && t2_value !== (t2_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty[0] & /*module*/ 2) && t4_value !== (t4_value = /*module*/ ctx[1].state.title + "")) set_data_contenteditable_dev(t4, t4_value);

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

    			if ((!current || dirty[0] & /*module*/ 2) && t11_value !== (t11_value = /*module*/ ctx[1].state.gain.toFixed(2) + "")) set_data_dev(t11, t11_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input, /*module*/ ctx[1].state.gain);
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 130 && div4_style_value !== (div4_style_value = "background-color: " + /*$colours*/ ctx[7][/*module*/ ctx[1].state.type])) {
    				attr_dev(div4, "style", div4_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			if_block0.d();
    			if_block1.d();
    			/*main_binding*/ ctx[37](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(259:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    // (272:12) {:else}
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
    		source: "(272:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (270:12) {#if module.state.inputId != null && $modules[module.state.inputId]}
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
    		source: "(270:12) {#if module.state.inputId != null && $modules[module.state.inputId]}",
    		ctx
    	});

    	return block;
    }

    // (281:12) {:else}
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
    		source: "(281:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (279:12) {#if module.state.cvId != null && $modules[module.state.cvId]}
    function create_if_block_1$2(ctx) {
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
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(279:12) {#if module.state.cvId != null && $modules[module.state.cvId]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let if_block_anchor;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = !/*module*/ ctx[1].destroyed && create_if_block$5(ctx);

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

    			if (!mounted) {
    				dispose = listen_dev(window_1, "click", /*click_handler*/ ctx[25], false, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (!/*module*/ ctx[1].destroyed) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*module*/ 2) {
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
    			mounted = false;
    			dispose();
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
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(5, $selectingModule = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(6, $modules = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(7, $colours = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(41, $isTyping = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(42, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(24, $context = $$value));
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
    	module.selectingInput = false;
    	module.selectingCv = false;
    	let cvModule;
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	module.cv = gainNode.gain;
    	var currentInput;
    	var currentCvModule;

    	module.clearCurrents = () => {
    		$$invalidate(21, currentInput = null);
    		$$invalidate(20, cvModule = null);
    		$$invalidate(22, currentCvModule = null);
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		titleNode.style.outline = "none";
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
    		$$invalidate(18, inputBtn = node);

    		inputBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(18, inputBtn.style.opacity = 0.8, inputBtn);
    		});

    		inputBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(18, inputBtn.style.opacity = 1, inputBtn);
    		});
    	}

    	function setCvBtn(node) {
    		$$invalidate(19, cvBtn = node);

    		cvBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(19, cvBtn.style.opacity = 0.8, cvBtn);
    		});

    		cvBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(19, cvBtn.style.opacity = 1, cvBtn);
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

    	function chooseInput() {
    		inputsAllHover(module);
    		if (!inputBtn) return;

    		if (!module.selectingInput) {
    			$$invalidate(1, module.selectingInput = true, module);
    			$$invalidate(18, inputBtn.style.opacity = 0.5, inputBtn);
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
    			$$invalidate(19, cvBtn.style.opacity = 0.5, cvBtn);
    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(1, module.selectingCv = false, module);
    		}
    	}

    	module.select = id => {
    		if (module.selectingInput) {
    			$$invalidate(1, module.state.inputId = id, module);
    			$$invalidate(18, inputBtn.style.opacity = 1, inputBtn);
    			$$invalidate(1, module.selectingInput = false, module);
    		} else if (module.selectingCv) {
    			$$invalidate(1, module.state.cvId = id, module);
    			$$invalidate(19, cvBtn.style.opacity = 1, cvBtn);
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

    	const click_handler = () => {
    		if (module.selectingInput) ;
    	};

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(23, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(3, controlsNode), $$invalidate(4, deleteNode)), $$invalidate(5, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(4, deleteNode), $$invalidate(3, controlsNode)), $$invalidate(5, $selectingModule));
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(8, bobSize);
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
    		if ('inputBtn' in $$props) $$invalidate(18, inputBtn = $$props.inputBtn);
    		if ('cvBtn' in $$props) $$invalidate(19, cvBtn = $$props.cvBtn);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('cvModule' in $$props) $$invalidate(20, cvModule = $$props.cvModule);
    		if ('gainNode' in $$props) $$invalidate(43, gainNode = $$props.gainNode);
    		if ('currentInput' in $$props) $$invalidate(21, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(22, currentCvModule = $$props.currentCvModule);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(15, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(8, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $modules*/ 66) {
    			if (module.state.cvId != null) {
    				$$invalidate(20, cvModule = $modules[module.state.cvId]);
    			} else {
    				$$invalidate(20, cvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, $context*/ 16777218) {
    			gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);
    		}

    		if ($$self.$$.dirty[0] & /*module, $modules, currentInput*/ 2097218) {
    			if (!module.destroyed) {
    				if (module.state.inputId != null && $modules[module.state.inputId] && $modules[module.state.inputId].output) {
    					if (currentInput) currentInput.disconnect(gainNode);
    					$$invalidate(21, currentInput = $modules[module.state.inputId].output);
    					currentInput.connect(gainNode);
    					if ($modules[module.state.inputId].input || $modules[module.state.inputId].inputs) $modules[module.state.inputId].update();
    				} else {
    					if (currentInput) currentInput.disconnect(gainNode);
    					$$invalidate(21, currentInput = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, cvModule, $context, currentCvModule*/ 22020098) {
    			if (!module.destroyed) {
    				if (cvModule) {
    					gainNode.gain.cancelScheduledValues($context.currentTime);
    					gainNode.gain.setValueAtTime(0, $context.currentTime);

    					if (currentCvModule) {
    						if (currentCvModule.outputs[module.state.id + ".1"]) ;
    						currentCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(22, currentCvModule = cvModule);
    					if (!currentCvModule.outputs[module.state.id + ".1"]) currentCvModule.addOutput(module.state.id + ".1", module.cv);
    				} else {
    					gainNode.gain.cancelScheduledValues($context.currentTime);
    					gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);

    					if (currentCvModule) {
    						if (currentCvModule.outputs[module.state.id + ".1"]) currentCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(22, currentCvModule = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*currentCvModule, module*/ 4194306) {
    			if (currentCvModule) {
    				currentCvModule.setGain(module.state.id + ".1", module.state.gain);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 8388612) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module, inputBtn, $colours, $modules, cvBtn*/ 786626) {
    			if (!module.destroyed) {
    				if (inputBtn) {
    					if (module.state.inputId != null) {
    						$$invalidate(18, inputBtn.style.backgroundColor = $colours[$modules[module.state.inputId].state.type], inputBtn);
    					} else {
    						$$invalidate(18, inputBtn.style.backgroundColor = "#f0f0f0", inputBtn);
    					}
    				}

    				if (cvBtn) {
    					if (module.state.cvId != null) {
    						$$invalidate(19, cvBtn.style.backgroundColor = $colours[$modules[module.state.cvId].state.type], cvBtn);
    					} else {
    						$$invalidate(19, cvBtn.style.backgroundColor = "#f0f0f0", cvBtn);
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
    		bobSize,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setCvBtn,
    		setTitleNode,
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
    		click_handler,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
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
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCA",
    			options,
    			id: create_fragment$5.name
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

    const { Object: Object_1$1 } = globals;
    const file$4 = "src\\ADSR.svelte";

    // (160:0) {#if !module.destroyed}
    function create_if_block$4(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div3;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let div0;
    	let deletebutton;
    	let t3;
    	let div2;
    	let h2;
    	let t4_value = /*module*/ ctx[1].state.title + "";
    	let t4;
    	let t5;
    	let div1;
    	let label0;
    	let t6;
    	let t7_value = /*attack*/ ctx[5].toFixed(2) + "";
    	let t7;
    	let t8;
    	let input0;
    	let t9;
    	let label1;
    	let t10;
    	let t11_value = /*decay*/ ctx[6].toFixed(2) + "";
    	let t11;
    	let t12;
    	let input1;
    	let t13;
    	let label2;
    	let t14;
    	let t15_value = /*module*/ ctx[1].state.sustain.toFixed(2) + "";
    	let t15;
    	let t16;
    	let input2;
    	let t17;
    	let label3;
    	let t18;
    	let t19_value = /*release*/ ctx[7].toFixed(2) + "";
    	let t19;
    	let t20;
    	let input3;
    	let div3_style_value;
    	let t21;
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

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[23](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[24](value);
    	}

    	let modulemovement_props = {
    		hasTrigger: true,
    		nodeSize: { x: 280, y: 400 }
    	};

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*deleteNode*/ ctx[4] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[4];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
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
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div3 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t3 = space();
    			div2 = element("div");
    			h2 = element("h2");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			label0 = element("label");
    			t6 = text("Attack (");
    			t7 = text(t7_value);
    			t8 = text("s)");
    			input0 = element("input");
    			t9 = space();
    			label1 = element("label");
    			t10 = text("Decay (");
    			t11 = text(t11_value);
    			t12 = text("s)");
    			input1 = element("input");
    			t13 = space();
    			label2 = element("label");
    			t14 = text("Sustain (");
    			t15 = text(t15_value);
    			t16 = text(")");
    			input2 = element("input");
    			t17 = space();
    			label3 = element("label");
    			t18 = text("Release (");
    			t19 = text(t19_value);
    			t20 = text("s)");
    			input3 = element("input");
    			t21 = space();
    			br = element("br");
    			add_location(h1, file$4, 163, 8, 5124);
    			attr_dev(div0, "class", "delete svelte-ec6hez");
    			add_location(div0, file$4, 164, 8, 5160);
    			attr_dev(h2, "class", "editableTitle svelte-ec6hez");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[25].call(h2));
    			add_location(h2, file$4, 166, 12, 5291);
    			attr_dev(label0, "for", "attack");
    			add_location(label0, file$4, 168, 16, 5491);
    			attr_dev(input0, "id", "attack");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "1");
    			attr_dev(input0, "step", "0.001");
    			add_location(input0, file$4, 168, 73, 5548);
    			attr_dev(label1, "for", "decay");
    			add_location(label1, file$4, 169, 16, 5660);
    			attr_dev(input1, "id", "decay");
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "max", "1");
    			attr_dev(input1, "step", "0.001");
    			add_location(input1, file$4, 169, 70, 5714);
    			attr_dev(label2, "for", "sustain");
    			add_location(label2, file$4, 170, 16, 5824);
    			attr_dev(input2, "id", "sustain");
    			attr_dev(input2, "type", "range");
    			attr_dev(input2, "min", "0");
    			attr_dev(input2, "max", "1");
    			attr_dev(input2, "step", "0.001");
    			add_location(input2, file$4, 170, 88, 5896);
    			attr_dev(label3, "for", "release");
    			add_location(label3, file$4, 171, 16, 6010);
    			attr_dev(input3, "id", "release");
    			attr_dev(input3, "type", "range");
    			attr_dev(input3, "min", "0");
    			attr_dev(input3, "max", "1");
    			attr_dev(input3, "step", "0.001");
    			add_location(input3, file$4, 171, 76, 6070);
    			attr_dev(div1, "class", "params");
    			add_location(div1, file$4, 167, 12, 5453);
    			attr_dev(div2, "id", "controls");
    			add_location(div2, file$4, 165, 8, 5242);
    			attr_dev(div3, "id", "module");
    			attr_dev(div3, "style", div3_style_value = "background-color: " + /*$colours*/ ctx[10][/*module*/ ctx[1].state.type]);
    			attr_dev(div3, "class", "svelte-ec6hez");
    			add_location(div3, file$4, 162, 4, 5024);
    			add_location(br, file$4, 175, 4, 6220);
    			add_location(main, file$4, 160, 0, 4818);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div3);
    			append_dev(div3, h1);
    			append_dev(h1, t1);
    			append_dev(div3, t2);
    			append_dev(div3, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, h2);
    			append_dev(h2, t4);

    			if (/*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title;
    			}

    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, label0);
    			append_dev(label0, t6);
    			append_dev(label0, t7);
    			append_dev(label0, t8);
    			append_dev(div1, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.attack);
    			append_dev(div1, t9);
    			append_dev(div1, label1);
    			append_dev(label1, t10);
    			append_dev(label1, t11);
    			append_dev(label1, t12);
    			append_dev(div1, input1);
    			set_input_value(input1, /*module*/ ctx[1].state.decay);
    			append_dev(div1, t13);
    			append_dev(div1, label2);
    			append_dev(label2, t14);
    			append_dev(label2, t15);
    			append_dev(label2, t16);
    			append_dev(div1, input2);
    			set_input_value(input2, /*module*/ ctx[1].state.sustain);
    			append_dev(div1, t17);
    			append_dev(div1, label3);
    			append_dev(label3, t18);
    			append_dev(label3, t19);
    			append_dev(label3, t20);
    			append_dev(div1, input3);
    			set_input_value(input3, /*module*/ ctx[1].state.release);
    			append_dev(main, t21);
    			append_dev(main, br);
    			/*main_binding*/ ctx[30](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[13].call(null, div0)),
    					action_destroyer(/*setTitleNode*/ ctx[14].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[25]),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[26]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[26]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[27]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[27]),
    					listen_dev(input2, "change", /*input2_change_input_handler*/ ctx[28]),
    					listen_dev(input2, "input", /*input2_change_input_handler*/ ctx[28]),
    					listen_dev(input3, "change", /*input3_change_input_handler*/ ctx[29]),
    					listen_dev(input3, "input", /*input3_change_input_handler*/ ctx[29]),
    					action_destroyer(/*setControls*/ ctx[12].call(null, div2)),
    					action_destroyer(/*setModule*/ ctx[11].call(null, div3))
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

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 256) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[8];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t4_value !== (t4_value = /*module*/ ctx[1].state.title + "")) set_data_contenteditable_dev(t4, t4_value);

    			if (dirty[0] & /*$modules, module*/ 514 && /*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[9][/*module*/ ctx[1].state.id].state.title;
    			}

    			if ((!current || dirty[0] & /*attack*/ 32) && t7_value !== (t7_value = /*attack*/ ctx[5].toFixed(2) + "")) set_data_dev(t7, t7_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input0, /*module*/ ctx[1].state.attack);
    			}

    			if ((!current || dirty[0] & /*decay*/ 64) && t11_value !== (t11_value = /*decay*/ ctx[6].toFixed(2) + "")) set_data_dev(t11, t11_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input1, /*module*/ ctx[1].state.decay);
    			}

    			if ((!current || dirty[0] & /*module*/ 2) && t15_value !== (t15_value = /*module*/ ctx[1].state.sustain.toFixed(2) + "")) set_data_dev(t15, t15_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input2, /*module*/ ctx[1].state.sustain);
    			}

    			if ((!current || dirty[0] & /*release*/ 128) && t19_value !== (t19_value = /*release*/ ctx[7].toFixed(2) + "")) set_data_dev(t19, t19_value);

    			if (dirty[0] & /*module*/ 2) {
    				set_input_value(input3, /*module*/ ctx[1].state.release);
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 1026 && div3_style_value !== (div3_style_value = "background-color: " + /*$colours*/ ctx[10][/*module*/ ctx[1].state.type])) {
    				attr_dev(div3, "style", div3_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			/*main_binding*/ ctx[30](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(160:0) {#if !module.destroyed}",
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
    	let $midi;
    	let $context;
    	let $colours;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(17, $selectingModule = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(35, $isTyping = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(9, $modules = $$value));
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(19, $midi = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(36, $context = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(10, $colours = $$value));
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
    		titleNode.style.outline = "none";
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

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(18, $opacity = value));
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

    	module.bob();
    	const writable_props = ['state'];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ADSR> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(18, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(3, controlsNode), $$invalidate(4, deleteNode)), $$invalidate(17, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(4, deleteNode), $$invalidate(3, controlsNode)), $$invalidate(17, $selectingModule));
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
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
    		if ('notePlaying' in $$props) $$invalidate(16, notePlaying = $$props.notePlaying);
    		if ('attack' in $$props) $$invalidate(5, attack = $$props.attack);
    		if ('decay' in $$props) $$invalidate(6, decay = $$props.decay);
    		if ('release' in $$props) $$invalidate(7, release = $$props.release);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(15, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(8, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(5, attack = Math.pow(10, module.state.attack) - 1);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(6, decay = Math.pow(10, module.state.decay) - 1);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(7, release = Math.pow(10, module.state.release) - 1);
    		}

    		if ($$self.$$.dirty[0] & /*$midi, notePlaying*/ 589824) {
    			if ($midi.trigger && !notePlaying) $$invalidate(16, notePlaying = true);
    		}

    		if ($$self.$$.dirty[0] & /*$midi, notePlaying*/ 589824) {
    			if (!$midi.trigger && notePlaying) $$invalidate(16, notePlaying = false);
    		}

    		if ($$self.$$.dirty[0] & /*notePlaying*/ 65536) {
    			if (notePlaying) fireEnv(); else unFireEnv();
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 262148) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 131096) {
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
    		opacity,
    		notePlaying,
    		$selectingModule,
    		$opacity,
    		$midi,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
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
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ADSR",
    			options,
    			id: create_fragment$4.name
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
    const file$3 = "src\\VCF.svelte";

    // (264:0) {#if !module.destroyed}
    function create_if_block$3(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div4;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let div0;
    	let deletebutton;
    	let t3;
    	let div3;
    	let h2;
    	let t4_value = /*module*/ ctx[1].state.title + "";
    	let t4;
    	let t5;
    	let div1;
    	let label0;
    	let button0;
    	let t6;
    	let t7;
    	let div2;
    	let label1;
    	let button1;
    	let t8;
    	let br0;
    	let t9;
    	let label2;
    	let t10;
    	let t11_value = /*frequency*/ ctx[5].toFixed(1) + "";
    	let t11;
    	let t12;
    	let input0;
    	let t13;
    	let br1;
    	let section;
    	let input1;
    	let input1_id_value;
    	let label3;
    	let t14;
    	let label3_for_value;
    	let t15;
    	let input2;
    	let input2_id_value;
    	let label4;
    	let t16;
    	let label4_for_value;
    	let t17;
    	let input3;
    	let input3_id_value;
    	let label5;
    	let t18;
    	let label5_for_value;
    	let div4_style_value;
    	let t19;
    	let br2;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[27](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[28](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[29](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[30](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[31](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 280, y: 350 } };

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*deleteNode*/ ctx[4] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[4];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
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
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
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
    		if (/*module*/ ctx[1].state.cvId != null && /*$modules*/ ctx[7][/*module*/ ctx[1].state.cvId]) return create_if_block_1$1;
    		return create_else_block$2;
    	}

    	let current_block_type_1 = select_block_type_1(ctx);
    	let if_block1 = current_block_type_1(ctx);
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[39][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div4 = element("div");
    			h1 = element("h1");
    			t1 = text(t1_value);
    			t2 = space();
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t3 = space();
    			div3 = element("div");
    			h2 = element("h2");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			label0 = element("label");
    			button0 = element("button");
    			if_block0.c();
    			t6 = text(" Input");
    			t7 = space();
    			div2 = element("div");
    			label1 = element("label");
    			button1 = element("button");
    			if_block1.c();
    			t8 = text(" Control");
    			br0 = element("br");
    			t9 = space();
    			label2 = element("label");
    			t10 = text("Cutoff Frequency (");
    			t11 = text(t11_value);
    			t12 = text("Hz)");
    			input0 = element("input");
    			t13 = space();
    			br1 = element("br");
    			section = element("section");
    			input1 = element("input");
    			label3 = element("label");
    			t14 = text("Lowpass");
    			t15 = space();
    			input2 = element("input");
    			label4 = element("label");
    			t16 = text("Highpass");
    			t17 = space();
    			input3 = element("input");
    			label5 = element("label");
    			t18 = text("Bandpass");
    			t19 = space();
    			br2 = element("br");
    			add_location(h1, file$3, 267, 8, 9011);
    			attr_dev(div0, "class", "delete svelte-1yepwxx");
    			add_location(div0, file$3, 268, 8, 9047);
    			attr_dev(h2, "class", "editableTitle svelte-1yepwxx");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[32].call(h2));
    			add_location(h2, file$3, 270, 12, 9178);
    			attr_dev(button0, "class", "svelte-1yepwxx");
    			add_location(button0, file$3, 273, 23, 9511);
    			add_location(label0, file$3, 273, 16, 9504);
    			attr_dev(div1, "class", "inputDiv");
    			add_location(div1, file$3, 272, 12, 9354);
    			attr_dev(button1, "class", "svelte-1yepwxx");
    			add_location(button1, file$3, 282, 23, 10058);
    			add_location(label1, file$3, 282, 16, 10051);
    			attr_dev(div2, "class", "inputDiv");
    			add_location(div2, file$3, 281, 16, 9902);
    			add_location(br0, file$3, 288, 47, 10405);
    			attr_dev(label2, "for", "freq");
    			add_location(label2, file$3, 290, 12, 10425);
    			attr_dev(input0, "id", "freq");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", Math.log2(20));
    			attr_dev(input0, "max", Math.log2(18000));
    			attr_dev(input0, "step", "0.0001");
    			add_location(input0, file$3, 290, 81, 10494);
    			add_location(br1, file$3, 291, 12, 10630);
    			attr_dev(input1, "id", input1_id_value = 'lowpass' + /*module*/ ctx[1].state.id);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "lowpass";
    			input1.value = input1.__value;
    			attr_dev(input1, "class", "svelte-1yepwxx");
    			add_location(input1, file$3, 292, 16, 10674);
    			attr_dev(label3, "for", label3_for_value = 'lowpass' + /*module*/ ctx[1].state.id);
    			attr_dev(label3, "class", "svelte-1yepwxx");
    			add_location(label3, file$3, 292, 122, 10780);
    			attr_dev(input2, "id", input2_id_value = 'highpass' + /*module*/ ctx[1].state.id);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "highpass";
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-1yepwxx");
    			add_location(input2, file$3, 293, 16, 10852);
    			attr_dev(label4, "for", label4_for_value = 'highpass' + /*module*/ ctx[1].state.id);
    			attr_dev(label4, "class", "svelte-1yepwxx");
    			add_location(label4, file$3, 293, 124, 10960);
    			attr_dev(input3, "id", input3_id_value = 'bandpass' + /*module*/ ctx[1].state.id);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "bandpass";
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-1yepwxx");
    			add_location(input3, file$3, 294, 16, 11034);
    			attr_dev(label5, "for", label5_for_value = 'bandpass' + /*module*/ ctx[1].state.id);
    			attr_dev(label5, "class", "svelte-1yepwxx");
    			add_location(label5, file$3, 294, 124, 11142);
    			attr_dev(section, "class", "type svelte-1yepwxx");
    			add_location(section, file$3, 291, 16, 10634);
    			attr_dev(div3, "id", "controls");
    			add_location(div3, file$3, 269, 8, 9129);
    			attr_dev(div4, "id", "module");
    			attr_dev(div4, "style", div4_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[1].state.type]);
    			attr_dev(div4, "class", "svelte-1yepwxx");
    			add_location(div4, file$3, 266, 4, 8911);
    			add_location(br2, file$3, 298, 4, 11256);
    			add_location(main, file$3, 264, 0, 8727);
    			binding_group.p(input1, input2, input3);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div4);
    			append_dev(div4, h1);
    			append_dev(h1, t1);
    			append_dev(div4, t2);
    			append_dev(div4, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div4, t3);
    			append_dev(div4, div3);
    			append_dev(div3, h2);
    			append_dev(h2, t4);

    			if (/*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title;
    			}

    			append_dev(div3, t5);
    			append_dev(div3, div1);
    			append_dev(div1, label0);
    			append_dev(label0, button0);
    			if_block0.m(button0, null);
    			append_dev(label0, t6);
    			append_dev(div3, t7);
    			append_dev(div3, div2);
    			append_dev(div2, label1);
    			append_dev(label1, button1);
    			if_block1.m(button1, null);
    			append_dev(label1, t8);
    			append_dev(div3, br0);
    			append_dev(div3, t9);
    			append_dev(div3, label2);
    			append_dev(label2, t10);
    			append_dev(label2, t11);
    			append_dev(label2, t12);
    			append_dev(div3, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.voct);
    			append_dev(div3, t13);
    			append_dev(div3, br1);
    			append_dev(div3, section);
    			append_dev(section, input1);
    			input1.checked = input1.__value === /*module*/ ctx[1].state.filterType;
    			append_dev(section, label3);
    			append_dev(label3, t14);
    			append_dev(section, t15);
    			append_dev(section, input2);
    			input2.checked = input2.__value === /*module*/ ctx[1].state.filterType;
    			append_dev(section, label4);
    			append_dev(label4, t16);
    			append_dev(section, t17);
    			append_dev(section, input3);
    			input3.checked = input3.__value === /*module*/ ctx[1].state.filterType;
    			append_dev(section, label5);
    			append_dev(label5, t18);
    			append_dev(main, t19);
    			append_dev(main, br2);
    			/*main_binding*/ ctx[42](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[12].call(null, div0)),
    					action_destroyer(/*setTitleNode*/ ctx[15].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[32]),
    					action_destroyer(/*setInputBtn*/ ctx[13].call(null, button0)),
    					listen_dev(button0, "click", /*chooseInput*/ ctx[17], false, false, false, false),
    					listen_dev(div1, "mouseenter", /*mouseenter_handler*/ ctx[33], false, false, false, false),
    					listen_dev(div1, "mouseleave", /*mouseleave_handler*/ ctx[34], false, false, false, false),
    					action_destroyer(/*setCvBtn*/ ctx[14].call(null, button1)),
    					listen_dev(button1, "click", /*chooseCv*/ ctx[18], false, false, false, false),
    					listen_dev(div2, "mouseenter", /*mouseenter_handler_1*/ ctx[35], false, false, false, false),
    					listen_dev(div2, "mouseleave", /*mouseleave_handler_1*/ ctx[36], false, false, false, false),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[37]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[37]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[38]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[40]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[41]),
    					action_destroyer(/*setControls*/ ctx[11].call(null, div3)),
    					action_destroyer(/*setModule*/ ctx[10].call(null, div4))
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

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 512) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[9];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t4_value !== (t4_value = /*module*/ ctx[1].state.title + "")) set_data_contenteditable_dev(t4, t4_value);

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

    			if ((!current || dirty[0] & /*frequency*/ 32) && t11_value !== (t11_value = /*frequency*/ ctx[5].toFixed(1) + "")) set_data_dev(t11, t11_value);

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

    			if (!current || dirty[0] & /*$colours, module*/ 258 && div4_style_value !== (div4_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[1].state.type])) {
    				attr_dev(div4, "style", div4_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			if_block0.d();
    			if_block1.d();
    			/*main_binding*/ ctx[42](null);
    			binding_group.r();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(264:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    // (277:20) {:else}
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
    		source: "(277:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (275:20) {#if module.state.inputId != null && $modules[module.state.inputId]}
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
    		source: "(275:20) {#if module.state.inputId != null && $modules[module.state.inputId]}",
    		ctx
    	});

    	return block;
    }

    // (286:20) {:else}
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
    		source: "(286:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (284:20) {#if module.state.cvId != null && $modules[module.state.cvId]}
    function create_if_block_1$1(ctx) {
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
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(284:20) {#if module.state.cvId != null && $modules[module.state.cvId]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[1].destroyed && create_if_block$3(ctx);

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
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(6, $selectingModule = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(7, $modules = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(8, $colours = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(46, $isTyping = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(47, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(26, $context = $$value));
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
    		$$invalidate(23, currentInput = null);
    		$$invalidate(21, cvModule = null);
    		$$invalidate(24, currentCvModule = null);
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		titleNode.style.outline = "none";
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
    		$$invalidate(19, inputBtn = node);

    		inputBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(19, inputBtn.style.opacity = 0.8, inputBtn);
    		});

    		inputBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(19, inputBtn.style.opacity = 1, inputBtn);
    		});
    	}

    	function setCvBtn(node) {
    		$$invalidate(20, cvBtn = node);

    		cvBtn.addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(20, cvBtn.style.opacity = 0.8, cvBtn);
    		});

    		cvBtn.addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(20, cvBtn.style.opacity = 1, cvBtn);
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

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(25, $opacity = value));
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

    	function chooseInput() {
    		inputsAllHover(module);
    		if (!inputBtn) return;

    		if (!module.selectingInput) {
    			$$invalidate(1, module.selectingInput = true, module);
    			$$invalidate(19, inputBtn.style.opacity = 0.5, inputBtn);
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
    			$$invalidate(20, cvBtn.style.opacity = 0.5, cvBtn);
    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(1, module.selectingCv = false, module);
    		}
    	}

    	module.select = id => {
    		if (module.selectingInput) {
    			$$invalidate(1, module.state.inputId = id, module);
    			$$invalidate(19, inputBtn.style.opacity = 1, inputBtn);
    			$$invalidate(1, module.selectingInput = false, module);
    		} else if (module.selectingCv) {
    			$$invalidate(1, module.state.cvId = id, module);
    			$$invalidate(20, cvBtn.style.opacity = 1, cvBtn);
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
    		($$invalidate(2, moduleNode), $$invalidate(25, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(3, controlsNode), $$invalidate(4, deleteNode)), $$invalidate(6, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(4, deleteNode), $$invalidate(3, controlsNode)), $$invalidate(6, $selectingModule));
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
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
    		if ('inputBtn' in $$props) $$invalidate(19, inputBtn = $$props.inputBtn);
    		if ('cvBtn' in $$props) $$invalidate(20, cvBtn = $$props.cvBtn);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('cvModule' in $$props) $$invalidate(21, cvModule = $$props.cvModule);
    		if ('filterNode' in $$props) $$invalidate(22, filterNode = $$props.filterNode);
    		if ('frequency' in $$props) $$invalidate(5, frequency = $$props.frequency);
    		if ('currentInput' in $$props) $$invalidate(23, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(24, currentCvModule = $$props.currentCvModule);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(16, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(9, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $modules*/ 130) {
    			if (module.state.cvId != null) {
    				$$invalidate(21, cvModule = $modules[module.state.cvId]);
    			} else {
    				$$invalidate(21, cvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(5, frequency = Math.pow(2, module.state.voct));
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(22, filterNode.type = module.state.filterType, filterNode);
    		}

    		if ($$self.$$.dirty[0] & /*filterNode, frequency, $context*/ 71303200) {
    			filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
    		}

    		if ($$self.$$.dirty[0] & /*module, $modules, currentInput, filterNode*/ 12583042) {
    			if (!module.destroyed) {
    				if (module.state.inputId != null && $modules[module.state.inputId] && $modules[module.state.inputId].output) {
    					let input = $modules[module.state.inputId];
    					if (currentInput) currentInput.disconnect(filterNode);
    					$$invalidate(23, currentInput = input.output);
    					currentInput.connect(filterNode);
    				} else {
    					if (currentInput) currentInput.disconnect(filterNode);
    					$$invalidate(23, currentInput = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, cvModule, filterNode, $context, currentCvModule, frequency*/ 90177570) {
    			if (!module.destroyed) {
    				if (cvModule) {
    					filterNode.frequency.cancelScheduledValues($context.currentTime);
    					filterNode.frequency.setValueAtTime(0, $context.currentTime);

    					if (currentCvModule) {
    						if (currentCvModule.outputs[module.state.id + ".1"]) ;
    						currentCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(24, currentCvModule = cvModule);
    					if (!currentCvModule.outputs[module.state.id + ".1"]) currentCvModule.addOutput(module.state.id + ".1", module.cv);
    				} else {
    					filterNode.frequency.cancelScheduledValues($context.currentTime);
    					filterNode.frequency.setValueAtTime(frequency, $context.currentTime);

    					if (currentCvModule) {
    						if (currentCvModule.outputs[module.state.id + ".1"]) ;
    						currentCvModule.removeOutput(module.state.id + ".1", module.cv);
    					}

    					$$invalidate(24, currentCvModule = null);
    				}
    			}
    		}

    		if ($$self.$$.dirty[0] & /*currentCvModule, module, frequency*/ 16777250) {
    			if (currentCvModule) {
    				currentCvModule.setGain(module.state.id + ".1", frequency);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 33554436) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module, inputBtn, $colours, $modules, cvBtn*/ 1573250) {
    			if (!module.destroyed) {
    				if (inputBtn) {
    					if (module.state.inputId != null) {
    						$$invalidate(19, inputBtn.style.backgroundColor = $colours[$modules[module.state.inputId].state.type], inputBtn);
    					} else {
    						$$invalidate(19, inputBtn.style.backgroundColor = "#f0f0f0", inputBtn);
    					}
    				}

    				if (cvBtn) {
    					if (module.state.cvId != null) {
    						$$invalidate(20, cvBtn.style.backgroundColor = $colours[$modules[module.state.cvId].state.type], cvBtn);
    					} else {
    						$$invalidate(20, cvBtn.style.backgroundColor = "#f0f0f0", cvBtn);
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
    		bobSize,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setCvBtn,
    		setTitleNode,
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
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCF",
    			options,
    			id: create_fragment$3.name
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
    const file$2 = "src\\Mixer.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[36] = list[i];
    	child_ctx[38] = i;
    	return child_ctx;
    }

    // (189:0) {#if !module.destroyed}
    function create_if_block$2(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div3;
    	let div0;
    	let deletebutton;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[0].state.id + "";
    	let t2;
    	let t3;
    	let div2;
    	let h2;
    	let t4_value = /*module*/ ctx[0].state.title + "";
    	let t4;
    	let t5;
    	let label;
    	let t6;
    	let div1;
    	let div3_style_value;
    	let t7;
    	let br;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[19](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[20](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[21](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[22](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[23](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 180, y: 370 } };

    	if (/*moduleNode*/ ctx[1] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[1];
    	}

    	if (/*controlsNode*/ ctx[2] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[2];
    	}

    	if (/*deleteNode*/ ctx[3] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[3];
    	}

    	if (/*module*/ ctx[0].state.position !== void 0) {
    		modulemovement_props.nodePos = /*module*/ ctx[0].state.position;
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
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
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
    			div3 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			div2 = element("div");
    			h2 = element("h2");
    			t4 = text(t4_value);
    			t5 = space();
    			label = element("label");
    			t6 = text("Inputs\r\n    ");
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t7 = space();
    			br = element("br");
    			attr_dev(div0, "class", "delete svelte-1rjc33v");
    			add_location(div0, file$2, 192, 4, 6493);
    			add_location(h1, file$2, 193, 4, 6571);
    			attr_dev(h2, "class", "editableTitle svelte-1rjc33v");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[24].call(h2));
    			add_location(h2, file$2, 195, 4, 6644);
    			attr_dev(div1, "id", "inputs");
    			add_location(div1, file$2, 198, 4, 6832);
    			attr_dev(label, "for", "inputs");
    			attr_dev(label, "class", "svelte-1rjc33v");
    			add_location(label, file$2, 197, 4, 6800);
    			attr_dev(div2, "id", "controls");
    			add_location(div2, file$2, 194, 4, 6603);
    			attr_dev(div3, "id", "module");
    			attr_dev(div3, "style", div3_style_value = "background-color: " + /*$colours*/ ctx[6][/*module*/ ctx[0].state.type]);
    			attr_dev(div3, "class", "svelte-1rjc33v");
    			add_location(div3, file$2, 191, 0, 6397);
    			add_location(br, file$2, 214, 0, 7461);
    			add_location(main, file$2, 189, 0, 6210);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div3);
    			append_dev(div3, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div3, t1);
    			append_dev(div3, h1);
    			append_dev(h1, t2);
    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, h2);
    			append_dev(h2, t4);

    			if (/*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title;
    			}

    			append_dev(div2, t5);
    			append_dev(div2, label);
    			append_dev(label, t6);
    			append_dev(label, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div1, null);
    				}
    			}

    			append_dev(main, t7);
    			append_dev(main, br);
    			/*main_binding*/ ctx[28](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[10].call(null, div0)),
    					action_destroyer(/*setTitleNode*/ ctx[12].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[24]),
    					action_destroyer(/*setControls*/ ctx[9].call(null, div2)),
    					action_destroyer(/*setModule*/ ctx[8].call(null, div3))
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

    			if (!updating_nodePos && dirty[0] & /*module*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*module*/ ctx[0].state.position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 128) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[7];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 1) deletebutton_changes.module = /*module*/ ctx[0];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty[0] & /*module*/ 1) && t2_value !== (t2_value = /*module*/ ctx[0].state.id + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty[0] & /*module*/ 1) && t4_value !== (t4_value = /*module*/ ctx[0].state.title + "")) set_data_contenteditable_dev(t4, t4_value);

    			if (dirty[0] & /*$modules, module*/ 33 && /*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[5][/*module*/ ctx[0].state.id].state.title;
    			}

    			if (dirty[0] & /*module, $selectingModule, chooseInput, $modules*/ 16433) {
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
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (!current || dirty[0] & /*$colours, module*/ 65 && div3_style_value !== (div3_style_value = "background-color: " + /*$colours*/ ctx[6][/*module*/ ctx[0].state.type])) {
    				attr_dev(div3, "style", div3_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			destroy_each(each_blocks, detaching);
    			/*main_binding*/ ctx[28](null);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(189:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    // (205:12) {:else}
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
    		source: "(205:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (203:12) {#if module.state.inputIds[i] != null && $modules[module.state.inputIds[i]]}
    function create_if_block_1(ctx) {
    	let t0_value = /*module*/ ctx[0].state.inputIds[/*i*/ ctx[38]] + "";
    	let t0;
    	let t1;
    	let t2_value = /*$modules*/ ctx[5][/*module*/ ctx[0].state.inputIds[/*i*/ ctx[38]]].state.title + "";
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
    			if (dirty[0] & /*module*/ 1 && t0_value !== (t0_value = /*module*/ ctx[0].state.inputIds[/*i*/ ctx[38]] + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*$modules, module*/ 33 && t2_value !== (t2_value = /*$modules*/ ctx[5][/*module*/ ctx[0].state.inputIds[/*i*/ ctx[38]]].state.title + "")) set_data_dev(t2, t2_value);
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
    		source: "(203:12) {#if module.state.inputIds[i] != null && $modules[module.state.inputIds[i]]}",
    		ctx
    	});

    	return block;
    }

    // (200:4) {#each module.state.inputIds as inputId, i}
    function create_each_block$1(ctx) {
    	let div;
    	let button;
    	let t;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*module*/ ctx[0].state.inputIds[/*i*/ ctx[38]] != null && /*$modules*/ ctx[5][/*module*/ ctx[0].state.inputIds[/*i*/ ctx[38]]]) return create_if_block_1;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	function click_handler() {
    		return /*click_handler*/ ctx[25](/*i*/ ctx[38]);
    	}

    	function mouseenter_handler() {
    		return /*mouseenter_handler*/ ctx[26](/*inputId*/ ctx[36]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			button = element("button");
    			if_block.c();
    			t = space();
    			attr_dev(button, "class", "svelte-1rjc33v");
    			add_location(button, file$2, 201, 8, 7060);
    			attr_dev(div, "class", "inputDiv");
    			add_location(div, file$2, 200, 8, 6908);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, button);
    			if_block.m(button, null);
    			append_dev(div, t);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setInputBtn*/ ctx[11].call(null, button, [/*i*/ ctx[38]])),
    					listen_dev(button, "click", click_handler, false, false, false, false),
    					listen_dev(div, "mouseenter", mouseenter_handler, false, false, false, false),
    					listen_dev(div, "mouseleave", /*mouseleave_handler*/ ctx[27], false, false, false, false)
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
    		source: "(200:4) {#each module.state.inputIds as inputId, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[0].destroyed && create_if_block$2(ctx);

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
    	component_subscribe($$self, isTyping, $$value => $$invalidate(32, $isTyping = $$value));
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(33, $output = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(34, $context = $$value));
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
    	module.selectingInput = false;
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	let currentInputs = [null, null, null, null];

    	module.clearCurrents = () => {
    		$$invalidate(17, currentInputs = [null, null, null, null]);
    	};

    	let moduleIsClicked = false;
    	let moduleTyping = false;

    	window.addEventListener("mouseup", () => {
    		if (moduleIsClicked) moduleIsClicked = false;
    	});

    	window.addEventListener("mousedown", () => {
    		set_store_value(isTyping, $isTyping = false, $isTyping);
    		moduleTyping = false;
    		titleNode.style.outline = "none";
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
    		$$invalidate(16, inputBtns[i] = node, inputBtns);

    		inputBtns[i].addEventListener("mouseenter", () => {
    			if ($selectingModule == null) $$invalidate(16, inputBtns[i].style.opacity = 0.8, inputBtns);
    		});

    		inputBtns[i].addEventListener("mouseleave", () => {
    			if ($selectingModule == null) $$invalidate(16, inputBtns[i].style.opacity = 1, inputBtns);
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

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(18, $opacity = value));
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

    	module.inputSelecting = null;

    	function chooseInput(i) {
    		$$invalidate(0, module.inputSelecting = i, module);
    		if (!inputBtns[i]) return;
    		mixerInputHover(module, module.state.inputIds[i]);

    		if (!module.selectingInput) {
    			$$invalidate(0, module.selectingInput = true, module);
    			$$invalidate(16, inputBtns[module.inputSelecting].style.opacity = 0.5, inputBtns);
    			set_store_value(selectingModule, $selectingModule = module.state.id, $selectingModule);
    		} else {
    			$$invalidate(0, module.selectingInput = false, module);
    		}
    	}

    	module.select = id => {
    		if (module.selectingInput) {
    			$$invalidate(0, module.state.inputIds[module.inputSelecting] = id, module);
    			$$invalidate(16, inputBtns[module.inputSelecting].style.opacity = 1, inputBtns);
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
    		($$invalidate(1, moduleNode), $$invalidate(18, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(2, controlsNode), $$invalidate(3, deleteNode)), $$invalidate(4, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(3, deleteNode), $$invalidate(2, controlsNode)), $$invalidate(4, $selectingModule));
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(module.state.position, value)) {
    			module.state.position = value;
    			$$invalidate(0, module);
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
    		if ('state' in $$props) $$invalidate(15, state = $$props.state);
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
    		gainNode,
    		currentInputs,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setTitleNode,
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
    		if ('state' in $$props) $$invalidate(15, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(1, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(2, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(3, deleteNode = $$props.deleteNode);
    		if ('inputBtns' in $$props) $$invalidate(16, inputBtns = $$props.inputBtns);
    		if ('titleNode' in $$props) titleNode = $$props.titleNode;
    		if ('gainNode' in $$props) $$invalidate(35, gainNode = $$props.gainNode);
    		if ('currentInputs' in $$props) $$invalidate(17, currentInputs = $$props.currentInputs);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(13, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(7, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $modules, currentInputs*/ 131105) {
    			module.state.inputIds.forEach((id, i) => {
    				if (id != null && $modules[id] && $modules[id].output) {
    					if (currentInputs[i]) currentInputs[i].disconnect(gainNode);
    					$$invalidate(17, currentInputs[i] = $modules[id].output, currentInputs);
    					currentInputs[i].connect(gainNode);
    				} else {
    					if (currentInputs[i]) currentInputs[i].disconnect(gainNode);
    					$$invalidate(17, currentInputs[i] = null, currentInputs);
    				}
    			});
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 262146) {
    			if (moduleNode) $$invalidate(1, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module, inputBtns, $colours, $modules*/ 65633) {
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
    		bobSize,
    		setModule,
    		setControls,
    		setDelete,
    		setInputBtn,
    		setTitleNode,
    		opacity,
    		chooseInput,
    		state,
    		inputBtns,
    		currentInputs,
    		$opacity,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
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
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { state: 15 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Mixer",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get state() {
    		throw new Error("<Mixer>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Mixer>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\LFO.svelte generated by Svelte v3.59.2 */
    const file$1 = "src\\LFO.svelte";

    // (138:0) {#if !module.destroyed}
    function create_if_block$1(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let updating_bobSize;
    	let t0;
    	let div2;
    	let div0;
    	let deletebutton;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[1].state.id + "";
    	let t2;
    	let t3;
    	let div1;
    	let h2;
    	let t4_value = /*module*/ ctx[1].state.title + "";
    	let t4;
    	let t5;
    	let label0;
    	let t6;
    	let t7_value = /*oscNode*/ ctx[5].frequency.value.toFixed(1) + "";
    	let t7;
    	let t8;
    	let input0;
    	let t9;
    	let br0;
    	let section;
    	let input1;
    	let input1_id_value;
    	let label1;
    	let t10;
    	let label1_for_value;
    	let t11;
    	let input2;
    	let input2_id_value;
    	let label2;
    	let t12;
    	let label2_for_value;
    	let t13;
    	let input3;
    	let input3_id_value;
    	let label3;
    	let t14;
    	let label3_for_value;
    	let t15;
    	let input4;
    	let input4_id_value;
    	let label4;
    	let t16;
    	let label4_for_value;
    	let div2_style_value;
    	let t17;
    	let br1;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[16](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[17](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[18](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[19](value);
    	}

    	function modulemovement_bobSize_binding(value) {
    		/*modulemovement_bobSize_binding*/ ctx[20](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 320, y: 250 } };

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[3] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[3];
    	}

    	if (/*deleteNode*/ ctx[4] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[4];
    	}

    	if (/*state*/ ctx[0].position !== void 0) {
    		modulemovement_props.nodePos = /*state*/ ctx[0].position;
    	}

    	if (/*bobSize*/ ctx[6] !== void 0) {
    		modulemovement_props.bobSize = /*bobSize*/ ctx[6];
    	}

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'bobSize', modulemovement_bobSize_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[24][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			create_component(modulemovement.$$.fragment);
    			t0 = space();
    			div2 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			div1 = element("div");
    			h2 = element("h2");
    			t4 = text(t4_value);
    			t5 = space();
    			label0 = element("label");
    			t6 = text("Frequency (");
    			t7 = text(t7_value);
    			t8 = text("Hz)");
    			input0 = element("input");
    			t9 = space();
    			br0 = element("br");
    			section = element("section");
    			input1 = element("input");
    			label1 = element("label");
    			t10 = text("Sine");
    			t11 = space();
    			input2 = element("input");
    			label2 = element("label");
    			t12 = text("Triangle");
    			t13 = space();
    			input3 = element("input");
    			label3 = element("label");
    			t14 = text("Sawtooth");
    			t15 = space();
    			input4 = element("input");
    			label4 = element("label");
    			t16 = text("Square");
    			t17 = space();
    			br1 = element("br");
    			attr_dev(div0, "class", "delete svelte-1igd91y");
    			add_location(div0, file$1, 141, 8, 4232);
    			add_location(h1, file$1, 142, 8, 4314);
    			attr_dev(h2, "class", "editableTitle svelte-1igd91y");
    			attr_dev(h2, "contenteditable", "true");
    			if (/*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title === void 0) add_render_callback(() => /*h2_input_handler*/ ctx[21].call(h2));
    			add_location(h2, file$1, 144, 12, 4399);
    			attr_dev(label0, "for", "freq");
    			add_location(label0, file$1, 145, 12, 4561);
    			attr_dev(input0, "id", "freq");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0.1");
    			attr_dev(input0, "max", "20");
    			attr_dev(input0, "step", "0.01");
    			add_location(input0, file$1, 145, 88, 4637);
    			add_location(br0, file$1, 146, 12, 4748);
    			attr_dev(input1, "id", input1_id_value = 'sine' + /*module*/ ctx[1].state.id);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "sine";
    			input1.value = input1.__value;
    			attr_dev(input1, "class", "svelte-1igd91y");
    			add_location(input1, file$1, 147, 16, 4793);
    			attr_dev(label1, "for", label1_for_value = 'sine' + /*module*/ ctx[1].state.id);
    			attr_dev(label1, "class", "svelte-1igd91y");
    			add_location(label1, file$1, 147, 111, 4888);
    			attr_dev(input2, "id", input2_id_value = 'triangle' + /*module*/ ctx[1].state.id);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "triangle";
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-1igd91y");
    			add_location(input2, file$1, 148, 16, 4954);
    			attr_dev(label2, "for", label2_for_value = 'triangle' + /*module*/ ctx[1].state.id);
    			attr_dev(label2, "class", "svelte-1igd91y");
    			add_location(label2, file$1, 148, 120, 5058);
    			attr_dev(input3, "id", input3_id_value = 'sawtooth' + /*module*/ ctx[1].state.id);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "sawtooth";
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-1igd91y");
    			add_location(input3, file$1, 149, 16, 5132);
    			attr_dev(label3, "for", label3_for_value = 'sawtooth' + /*module*/ ctx[1].state.id);
    			attr_dev(label3, "class", "svelte-1igd91y");
    			add_location(label3, file$1, 149, 119, 5235);
    			attr_dev(input4, "id", input4_id_value = 'square' + /*module*/ ctx[1].state.id);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "square";
    			input4.value = input4.__value;
    			attr_dev(input4, "class", "svelte-1igd91y");
    			add_location(input4, file$1, 150, 16, 5309);
    			attr_dev(label4, "for", label4_for_value = 'square' + /*module*/ ctx[1].state.id);
    			attr_dev(label4, "class", "svelte-1igd91y");
    			add_location(label4, file$1, 150, 115, 5408);
    			attr_dev(section, "class", "shape svelte-1igd91y");
    			add_location(section, file$1, 146, 16, 4752);
    			attr_dev(div1, "id", "controls");
    			add_location(div1, file$1, 143, 8, 4350);
    			attr_dev(div2, "id", "module");
    			attr_dev(div2, "style", div2_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[1].state.type]);
    			attr_dev(div2, "class", "svelte-1igd91y");
    			add_location(div2, file$1, 140, 4, 4132);
    			add_location(br1, file$1, 154, 4, 5518);
    			add_location(main, file$1, 138, 0, 3944);
    			binding_group.p(input1, input2, input3, input4);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div2);
    			append_dev(div2, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div2, t1);
    			append_dev(div2, h1);
    			append_dev(h1, t2);
    			append_dev(div2, t3);
    			append_dev(div2, div1);
    			append_dev(div1, h2);
    			append_dev(h2, t4);

    			if (/*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title !== void 0) {
    				h2.textContent = /*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title;
    			}

    			append_dev(div1, t5);
    			append_dev(div1, label0);
    			append_dev(label0, t6);
    			append_dev(label0, t7);
    			append_dev(label0, t8);
    			append_dev(div1, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.frequency);
    			append_dev(div1, t9);
    			append_dev(div1, br0);
    			append_dev(div1, section);
    			append_dev(section, input1);
    			input1.checked = input1.__value === /*module*/ ctx[1].state.shape;
    			append_dev(section, label1);
    			append_dev(label1, t10);
    			append_dev(section, t11);
    			append_dev(section, input2);
    			input2.checked = input2.__value === /*module*/ ctx[1].state.shape;
    			append_dev(section, label2);
    			append_dev(label2, t12);
    			append_dev(section, t13);
    			append_dev(section, input3);
    			input3.checked = input3.__value === /*module*/ ctx[1].state.shape;
    			append_dev(section, label3);
    			append_dev(label3, t14);
    			append_dev(section, t15);
    			append_dev(section, input4);
    			input4.checked = input4.__value === /*module*/ ctx[1].state.shape;
    			append_dev(section, label4);
    			append_dev(label4, t16);
    			append_dev(main, t17);
    			append_dev(main, br1);
    			/*main_binding*/ ctx[28](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[11].call(null, div0)),
    					action_destroyer(/*setTitleNode*/ ctx[12].call(null, h2)),
    					listen_dev(h2, "input", /*h2_input_handler*/ ctx[21]),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[22]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[22]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[23]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[25]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[26]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[27]),
    					action_destroyer(/*setControls*/ ctx[10].call(null, div1)),
    					action_destroyer(/*setModule*/ ctx[9].call(null, div2))
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

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			if (!updating_bobSize && dirty[0] & /*bobSize*/ 64) {
    				updating_bobSize = true;
    				modulemovement_changes.bobSize = /*bobSize*/ ctx[6];
    				add_flush_callback(() => updating_bobSize = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t2_value !== (t2_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty[0] & /*module*/ 2) && t4_value !== (t4_value = /*module*/ ctx[1].state.title + "")) set_data_contenteditable_dev(t4, t4_value);

    			if (dirty[0] & /*$modules, module*/ 130 && /*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title !== h2.textContent) {
    				h2.textContent = /*$modules*/ ctx[7][/*module*/ ctx[1].state.id].state.title;
    			}

    			if ((!current || dirty[0] & /*oscNode*/ 32) && t7_value !== (t7_value = /*oscNode*/ ctx[5].frequency.value.toFixed(1) + "")) set_data_dev(t7, t7_value);

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

    			if (!current || dirty[0] & /*$colours, module*/ 258 && div2_style_value !== (div2_style_value = "background-color: " + /*$colours*/ ctx[8][/*module*/ ctx[1].state.type])) {
    				attr_dev(div2, "style", div2_style_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modulemovement.$$.fragment, local);
    			transition_in(deletebutton.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modulemovement.$$.fragment, local);
    			transition_out(deletebutton.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(modulemovement);
    			destroy_component(deletebutton);
    			/*main_binding*/ ctx[28](null);
    			binding_group.r();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(138:0) {#if !module.destroyed}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = !/*module*/ ctx[1].destroyed && create_if_block$1(ctx);

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
    	let $context;
    	let $colours;
    	validate_store(selectingModule, 'selectingModule');
    	component_subscribe($$self, selectingModule, $$value => $$invalidate(14, $selectingModule = $$value));
    	validate_store(isTyping, 'isTyping');
    	component_subscribe($$self, isTyping, $$value => $$invalidate(32, $isTyping = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(7, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(33, $context = $$value));
    	validate_store(colours, 'colours');
    	component_subscribe($$self, colours, $$value => $$invalidate(8, $colours = $$value));
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
    	let oscNode = $context.createOscillator();
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
    			$$invalidate(1, module.outputs[id].gain.value = gain, module);
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
    		titleNode.style.outline = "none";
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

    	let opacity = spring(1, { stiffness: 0.1, damping: 0.5 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(15, $opacity = value));
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

    	module.bob();
    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<LFO> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(15, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		(($$invalidate(3, controlsNode), $$invalidate(4, deleteNode)), $$invalidate(14, $selectingModule));
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		(($$invalidate(4, deleteNode), $$invalidate(3, controlsNode)), $$invalidate(14, $selectingModule));
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function modulemovement_bobSize_binding(value) {
    		bobSize = value;
    		$$invalidate(6, bobSize);
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
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		titleNode,
    		oscNode,
    		moduleIsClicked,
    		moduleTyping,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
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
    		if ('oscNode' in $$props) $$invalidate(5, oscNode = $$props.oscNode);
    		if ('moduleIsClicked' in $$props) moduleIsClicked = $$props.moduleIsClicked;
    		if ('moduleTyping' in $$props) moduleTyping = $$props.moduleTyping;
    		if ('opacity' in $$props) $$invalidate(13, opacity = $$props.opacity);
    		if ('bobSize' in $$props) $$invalidate(6, bobSize = $$props.bobSize);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(5, oscNode.frequency.value = module.state.frequency, oscNode);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(5, oscNode.type = module.state.shape, oscNode);
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 32772) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*controlsNode, deleteNode, $selectingModule*/ 16408) {
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
    		oscNode,
    		bobSize,
    		$modules,
    		$colours,
    		setModule,
    		setControls,
    		setDelete,
    		setTitleNode,
    		opacity,
    		$selectingModule,
    		$opacity,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_nodePos_binding,
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
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { state: 0 }, null, [-1, -1]);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "LFO",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get state() {
    		throw new Error("<LFO>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<LFO>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src\\App.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[19] = list[i];
    	return child_ctx;
    }

    // (146:1) {:else}
    function create_else_block(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Mobile not yet supported";
    			add_location(h2, file, 146, 1, 6008);
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
    		source: "(146:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (125:1) {#if !window.mobileCheck()}
    function create_if_block(ctx) {
    	let div1;
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
    	let button7;
    	let t15;
    	let button8;
    	let t17;
    	let midi;
    	let t18;
    	let output_1;
    	let t19;
    	let div2;
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
    			div1 = element("div");
    			div0 = element("div");
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
    			button5.textContent = "Add Envelope";
    			t11 = space();
    			button6 = element("button");
    			button6.textContent = "Add Mixer";
    			t13 = space();
    			button7 = element("button");
    			button7.textContent = "Add LFO";
    			t15 = space();
    			button8 = element("button");
    			button8.textContent = "Clear Patch";
    			t17 = space();
    			create_component(midi.$$.fragment);
    			t18 = space();
    			create_component(output_1.$$.fragment);
    			t19 = space();
    			div2 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(button0, "class", "svelte-1kc2qqz");
    			add_location(button0, file, 127, 2, 5236);
    			attr_dev(button1, "class", "svelte-1kc2qqz");
    			add_location(button1, file, 128, 2, 5283);
    			attr_dev(button2, "id", "vcoBtn");
    			attr_dev(button2, "class", "svelte-1kc2qqz");
    			add_location(button2, file, 129, 2, 5330);
    			attr_dev(button3, "id", "vcaBtn");
    			attr_dev(button3, "class", "svelte-1kc2qqz");
    			add_location(button3, file, 130, 2, 5409);
    			attr_dev(button4, "id", "vcfBtn");
    			attr_dev(button4, "class", "svelte-1kc2qqz");
    			add_location(button4, file, 131, 2, 5487);
    			attr_dev(button5, "id", "adsrBtn");
    			attr_dev(button5, "class", "svelte-1kc2qqz");
    			add_location(button5, file, 132, 2, 5562);
    			attr_dev(button6, "id", "mixerBtn");
    			attr_dev(button6, "class", "svelte-1kc2qqz");
    			add_location(button6, file, 133, 2, 5641);
    			attr_dev(button7, "id", "lfoBtn");
    			attr_dev(button7, "class", "svelte-1kc2qqz");
    			add_location(button7, file, 134, 2, 5719);
    			attr_dev(button8, "class", "svelte-1kc2qqz");
    			add_location(button8, file, 135, 2, 5791);
    			add_location(div0, file, 126, 2, 5212);
    			attr_dev(div1, "class", "menu svelte-1kc2qqz");
    			add_location(div1, file, 125, 1, 5190);
    			attr_dev(div2, "class", "modules svelte-1kc2qqz");
    			add_location(div2, file, 140, 1, 5884);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
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
    			append_dev(div0, button7);
    			append_dev(div0, t15);
    			append_dev(div0, button8);
    			append_dev(div1, t17);
    			mount_component(midi, div1, null);
    			append_dev(div1, t18);
    			mount_component(output_1, div1, null);
    			insert_dev(target, t19, anchor);
    			insert_dev(target, div2, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div2, null);
    				}
    			}

    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", /*save*/ ctx[3], false, false, false, false),
    					listen_dev(button1, "click", /*load*/ ctx[4], false, false, false, false),
    					listen_dev(button2, "click", /*click_handler*/ ctx[6], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_1*/ ctx[7], false, false, false, false),
    					listen_dev(button4, "click", /*click_handler_2*/ ctx[8], false, false, false, false),
    					listen_dev(button5, "click", /*click_handler_3*/ ctx[9], false, false, false, false),
    					listen_dev(button6, "click", /*click_handler_4*/ ctx[10], false, false, false, false),
    					listen_dev(button7, "click", /*click_handler_5*/ ctx[11], false, false, false, false),
    					listen_dev(button8, "click", /*clear*/ ctx[5], false, false, false, false),
    					action_destroyer(/*setButtons*/ ctx[1].call(null, div0))
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
    						each_blocks[i].m(div2, null);
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
    			if (detaching) detach_dev(div1);
    			destroy_component(midi);
    			destroy_component(output_1);
    			if (detaching) detach_dev(t19);
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(125:1) {#if !window.mobileCheck()}",
    		ctx
    	});

    	return block;
    }

    // (142:1) {#each mods as m}
    function create_each_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*m*/ ctx[19].props];
    	var switch_value = /*m*/ ctx[19].type;

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
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*m*/ ctx[19].props)])
    			: {};

    			if (dirty & /*mods*/ 1 && switch_value !== (switch_value = /*m*/ ctx[19].type)) {
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
    		source: "(142:1) {#each mods as m}",
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
    			attr_dev(main, "class", "svelte-1kc2qqz");
    			add_location(main, file, 123, 0, 5151);
    			attr_dev(body, "class", "svelte-1kc2qqz");
    			add_location(body, file, 122, 0, 5143);
    			attr_dev(html, "lang", "UTF-8");
    			add_location(html, file, 121, 0, 5122);
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
    	component_subscribe($$self, output, $$value => $$invalidate(13, $output = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(14, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(15, $context = $$value));
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
    			button.addEventListener("mouseenter", () => {
    				button.style.opacity = 0.8;
    			});

    			button.addEventListener("mouseleave", () => {
    				button.style.opacity = 1;
    			});
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
    		"output": { "volume": 0.2, "inputId": "1" },
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
    	const click_handler_3 = () => addModule(ADSR);
    	const click_handler_4 = () => addModule(Mixer);
    	const click_handler_5 = () => addModule(LFO);

    	$$self.$capture_state = () => ({
    		context,
    		modules,
    		output,
    		fileDialog,
    		MIDI,
    		VCO,
    		Output,
    		VCA,
    		ADSR,
    		VCF,
    		Mixer,
    		LFO,
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
    		setButtons,
    		addModule,
    		save,
    		load,
    		clear,
    		click_handler,
    		click_handler_1,
    		click_handler_2,
    		click_handler_3,
    		click_handler_4,
    		click_handler_5
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
