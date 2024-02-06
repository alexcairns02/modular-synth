
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
    function set_style(node, key, value, important) {
        if (value == null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
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
    const file$9 = "src\\MIDI.svelte";

    // (172:52) {#if note}
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
    		source: "(172:52) {#if note}",
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
    	let br1;
    	let t4;
    	let br2;
    	let t5;
    	let br3;
    	let t6;
    	let br4;
    	let t7;
    	let p1;
    	let t8;
    	let b;
    	let t9;
    	let t10;
    	let br5;
    	let mounted;
    	let dispose;
    	let if_block = /*note*/ ctx[2] && create_if_block$4(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Note Input";
    			t1 = space();
    			p0 = element("p");
    			t2 = text("Play notes by pressing keys on keyboard");
    			br0 = element("br");
    			t3 = text("\r\n    White notes: 'Z'-'/'");
    			br1 = element("br");
    			t4 = text("\r\n    Black notes: 'S'-';'");
    			br2 = element("br");
    			t5 = text("\r\n    Change octave: '-' and '='");
    			br3 = element("br");
    			t6 = text("\r\n    Noteless trigger: 'SPACE'");
    			br4 = element("br");
    			t7 = space();
    			p1 = element("p");
    			t8 = text("Note played: ");
    			b = element("b");
    			t9 = text(/*note*/ ctx[2]);
    			if (if_block) if_block.c();
    			t10 = space();
    			br5 = element("br");
    			add_location(h2, file$9, 165, 4, 4327);
    			add_location(br0, file$9, 166, 46, 4394);
    			add_location(br1, file$9, 167, 24, 4424);
    			add_location(br2, file$9, 168, 24, 4454);
    			add_location(br3, file$9, 169, 30, 4490);
    			add_location(br4, file$9, 170, 29, 4525);
    			attr_dev(p0, "class", "svelte-wujitx");
    			add_location(p0, file$9, 166, 4, 4352);
    			attr_dev(b, "class", "svelte-wujitx");
    			toggle_class(b, "active", /*trigger*/ ctx[1]);
    			add_location(b, file$9, 171, 20, 4555);
    			attr_dev(p1, "class", "svelte-wujitx");
    			add_location(p1, file$9, 171, 4, 4539);
    			attr_dev(div, "class", "svelte-wujitx");
    			add_location(div, file$9, 164, 0, 4316);
    			add_location(br5, file$9, 173, 0, 4637);
    			add_location(main, file$9, 163, 0, 4308);
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
    			append_dev(p0, br1);
    			append_dev(p0, t4);
    			append_dev(p0, br2);
    			append_dev(p0, t5);
    			append_dev(p0, br3);
    			append_dev(p0, t6);
    			append_dev(p0, br4);
    			append_dev(div, t7);
    			append_dev(div, p1);
    			append_dev(p1, t8);
    			append_dev(p1, b);
    			append_dev(b, t9);
    			if (if_block) if_block.m(b, null);
    			append_dev(main, t10);
    			append_dev(main, br5);

    			if (!mounted) {
    				dispose = [
    					listen_dev(window, "keydown", prevent_default(/*onKeyDown*/ ctx[4]), false, true, false, false),
    					listen_dev(window, "keyup", prevent_default(/*onKeyUp*/ ctx[5]), false, true, false, false)
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
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
    	let $triggerSize;
    	let $size;
    	let $coords;
    	let $midi;
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(12, $midi = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ModuleMovement', slots, []);
    	let { hasTrigger = false } = $$props;
    	let { moduleNode } = $$props;
    	let { controlsNode } = $$props;
    	let { deleteNode } = $$props;
    	let { nodeSize = { x: 300, y: 300 } } = $$props;
    	let { nodePos = { x: 300, y: 100 } } = $$props;
    	let coords = spring({ x: nodePos.x, y: nodePos.y }, { stiffness: 0.3, damping: 0.5 });
    	validate_store(coords, 'coords');
    	component_subscribe($$self, coords, value => $$invalidate(11, $coords = value));
    	let size = spring(0, { stiffness: 0.3, damping: 0.5 });
    	validate_store(size, 'size');
    	component_subscribe($$self, size, value => $$invalidate(10, $size = value));
    	let triggerSize = spring(0, { stiffness: 1, damping: 0.5 });
    	validate_store(triggerSize, 'triggerSize');
    	component_subscribe($$self, triggerSize, value => $$invalidate(9, $triggerSize = value));
    	let moving = false;
    	let controlling = false;

    	const moduleClick = () => {
    		moving = true;
    		if (!controlling) size.set(20);
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
    		if (moving && !controlling) {
    			$$invalidate(4, nodePos.x += e.movementX, nodePos);
    			$$invalidate(4, nodePos.y += e.movementY, nodePos);
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
    	});

    	const writable_props = [
    		'hasTrigger',
    		'moduleNode',
    		'controlsNode',
    		'deleteNode',
    		'nodeSize',
    		'nodePos'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ModuleMovement> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('hasTrigger' in $$props) $$invalidate(5, hasTrigger = $$props.hasTrigger);
    		if ('moduleNode' in $$props) $$invalidate(3, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(6, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(7, deleteNode = $$props.deleteNode);
    		if ('nodeSize' in $$props) $$invalidate(8, nodeSize = $$props.nodeSize);
    		if ('nodePos' in $$props) $$invalidate(4, nodePos = $$props.nodePos);
    	};

    	$$self.$capture_state = () => ({
    		spring,
    		midi,
    		hasTrigger,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		nodeSize,
    		nodePos,
    		coords,
    		size,
    		triggerSize,
    		moving,
    		controlling,
    		moduleClick,
    		controlsClick,
    		windowUnClick,
    		windowMouseMove,
    		$triggerSize,
    		$size,
    		$coords,
    		$midi
    	});

    	$$self.$inject_state = $$props => {
    		if ('hasTrigger' in $$props) $$invalidate(5, hasTrigger = $$props.hasTrigger);
    		if ('moduleNode' in $$props) $$invalidate(3, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(6, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(7, deleteNode = $$props.deleteNode);
    		if ('nodeSize' in $$props) $$invalidate(8, nodeSize = $$props.nodeSize);
    		if ('nodePos' in $$props) $$invalidate(4, nodePos = $$props.nodePos);
    		if ('coords' in $$props) $$invalidate(0, coords = $$props.coords);
    		if ('size' in $$props) $$invalidate(1, size = $$props.size);
    		if ('triggerSize' in $$props) $$invalidate(2, triggerSize = $$props.triggerSize);
    		if ('moving' in $$props) moving = $$props.moving;
    		if ('controlling' in $$props) controlling = $$props.controlling;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*moduleNode, $coords, $size, $triggerSize, nodeSize*/ 3848) {
    			if (moduleNode) {
    				$$invalidate(3, moduleNode.style.left = `${$coords.x - $size / 2 - $triggerSize / 2}px`, moduleNode);
    				$$invalidate(3, moduleNode.style.top = `${$coords.y - $size / 2 - $triggerSize / 2}px`, moduleNode);
    				$$invalidate(3, moduleNode.style.width = `${nodeSize.x + $size + $triggerSize}px`, moduleNode);
    				$$invalidate(3, moduleNode.style.height = `${nodeSize.y + $size + $triggerSize}px`, moduleNode);
    			}
    		}

    		if ($$self.$$.dirty & /*moduleNode*/ 8) {
    			if (moduleNode) {
    				moduleNode.addEventListener('mousedown', moduleClick);
    				moduleNode.addEventListener('touchstart', moduleClick);
    			}
    		}

    		if ($$self.$$.dirty & /*controlsNode*/ 64) {
    			if (controlsNode) {
    				controlsNode.addEventListener('mousedown', controlsClick);
    				controlsNode.addEventListener('touchstart', controlsClick);
    			}
    		}

    		if ($$self.$$.dirty & /*deleteNode*/ 128) {
    			if (deleteNode) {
    				deleteNode.addEventListener('mousedown', controlsClick);
    				deleteNode.addEventListener('touchstart', controlsClick);
    			}
    		}

    		if ($$self.$$.dirty & /*$midi, hasTrigger*/ 4128) {
    			if ($midi.trigger && hasTrigger) {
    				triggerSize.set(2);
    			} else {
    				triggerSize.set(0);
    			}
    		}
    	};

    	return [
    		coords,
    		size,
    		triggerSize,
    		moduleNode,
    		nodePos,
    		hasTrigger,
    		controlsNode,
    		deleteNode,
    		nodeSize,
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
    			hasTrigger: 5,
    			moduleNode: 3,
    			controlsNode: 6,
    			deleteNode: 7,
    			nodeSize: 8,
    			nodePos: 4
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
        module.component.parentNode.removeChild(module.component);
        delete mods[module.state.id];
        if (out.state.inputId == module.state.id) out.state.inputId = null;
        Object.values(mods).forEach((m) => {
            if (m.state.inputId && m.state.inputId == module.state.id) {
                m.state.inputId = null;
                m.update();
            }
            if (m.state.cvId && m.state.cvId == module.state.id) {
                m.state.cvId = null;
                m.update();
            }
            if (m.state.type == 'mixer') {
                m.state.inputIds.forEach((inputId) => {
                    if (inputId == module.state.id) inputId = null;
                });
                m.update();
            }
        });
    }
    function inputsAllHover(module) {
        Object.values(mods).forEach((m) => {
            if (!m.output && m.state.id != module.state.id) {
                m.fade();
            }
        });
    }

    function cvsAllHover(module) {
        Object.values(mods).forEach((m) => {
            if (!(m.state.type == 'lfo' || m.state.type == 'adsr') && m.state.id != module.state.id) {
                m.fade();
            }
        });
    }

    function unhover() {
        Object.values(mods).forEach((m) => {
            m.unfade();
        });
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

    function create_fragment$7(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let t0;
    	let div2;
    	let div0;
    	let deletebutton;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[2].state.id + "";
    	let t2;
    	let t3;
    	let h2;
    	let t5;
    	let div1;
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
    	let t17;
    	let br1;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[13](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[14](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[15](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[16](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 320, y: 250 } };

    	if (/*moduleNode*/ ctx[1] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[1];
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

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[2] },
    			$$inline: true
    		});

    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[19][0]);

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
    			h2 = element("h2");
    			h2.textContent = "Oscillator";
    			t5 = space();
    			div1 = element("div");
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
    			attr_dev(div0, "class", "delete svelte-f9blgn");
    			add_location(div0, file$7, 66, 4, 1603);
    			add_location(h1, file$7, 67, 4, 1681);
    			add_location(h2, file$7, 68, 4, 1713);
    			attr_dev(label0, "for", "freq");
    			add_location(label0, file$7, 70, 8, 1783);
    			attr_dev(input0, "id", "freq");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "-2");
    			attr_dev(input0, "max", "2");
    			attr_dev(input0, "step", "0.083333333333333");
    			add_location(input0, file$7, 70, 84, 1859);
    			add_location(br0, file$7, 71, 8, 1977);
    			attr_dev(input1, "id", input1_id_value = 'sine' + /*module*/ ctx[2].state.id);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "sine";
    			input1.value = input1.__value;
    			attr_dev(input1, "class", "svelte-f9blgn");
    			add_location(input1, file$7, 72, 12, 2018);
    			attr_dev(label1, "for", label1_for_value = 'sine' + /*module*/ ctx[2].state.id);
    			attr_dev(label1, "class", "svelte-f9blgn");
    			add_location(label1, file$7, 72, 107, 2113);
    			attr_dev(input2, "id", input2_id_value = 'triangle' + /*module*/ ctx[2].state.id);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "triangle";
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-f9blgn");
    			add_location(input2, file$7, 73, 12, 2175);
    			attr_dev(label2, "for", label2_for_value = 'triangle' + /*module*/ ctx[2].state.id);
    			attr_dev(label2, "class", "svelte-f9blgn");
    			add_location(label2, file$7, 73, 116, 2279);
    			attr_dev(input3, "id", input3_id_value = 'sawtooth' + /*module*/ ctx[2].state.id);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "sawtooth";
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-f9blgn");
    			add_location(input3, file$7, 74, 12, 2349);
    			attr_dev(label3, "for", label3_for_value = 'sawtooth' + /*module*/ ctx[2].state.id);
    			attr_dev(label3, "class", "svelte-f9blgn");
    			add_location(label3, file$7, 74, 115, 2452);
    			attr_dev(input4, "id", input4_id_value = 'square' + /*module*/ ctx[2].state.id);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "square";
    			input4.value = input4.__value;
    			attr_dev(input4, "class", "svelte-f9blgn");
    			add_location(input4, file$7, 75, 12, 2522);
    			attr_dev(label4, "for", label4_for_value = 'square' + /*module*/ ctx[2].state.id);
    			attr_dev(label4, "class", "svelte-f9blgn");
    			add_location(label4, file$7, 75, 111, 2621);
    			attr_dev(section, "class", "shape svelte-f9blgn");
    			add_location(section, file$7, 71, 12, 1981);
    			attr_dev(div1, "id", "controls");
    			add_location(div1, file$7, 69, 4, 1738);
    			attr_dev(div2, "id", "module");
    			attr_dev(div2, "class", "svelte-f9blgn");
    			add_location(div2, file$7, 65, 0, 1566);
    			add_location(br1, file$7, 79, 0, 2715);
    			add_location(main, file$7, 63, 0, 1399);
    			binding_group.p(input1, input2, input3, input4);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
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
    			append_dev(div2, h2);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, label0);
    			append_dev(label0, t6);
    			append_dev(label0, t7);
    			append_dev(label0, t8);
    			append_dev(div1, input0);
    			set_input_value(input0, /*module*/ ctx[2].state.frequency);
    			append_dev(div1, t9);
    			append_dev(div1, br0);
    			append_dev(div1, section);
    			append_dev(section, input1);
    			input1.checked = input1.__value === /*module*/ ctx[2].state.shape;
    			append_dev(section, label1);
    			append_dev(label1, t10);
    			append_dev(section, t11);
    			append_dev(section, input2);
    			input2.checked = input2.__value === /*module*/ ctx[2].state.shape;
    			append_dev(section, label2);
    			append_dev(label2, t12);
    			append_dev(section, t13);
    			append_dev(section, input3);
    			input3.checked = input3.__value === /*module*/ ctx[2].state.shape;
    			append_dev(section, label3);
    			append_dev(label3, t14);
    			append_dev(section, t15);
    			append_dev(section, input4);
    			input4.checked = input4.__value === /*module*/ ctx[2].state.shape;
    			append_dev(section, label4);
    			append_dev(label4, t16);
    			append_dev(main, t17);
    			append_dev(main, br1);
    			/*main_binding*/ ctx[23](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[8].call(null, div0)),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[17]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[17]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[18]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[20]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[21]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[22]),
    					action_destroyer(/*setControls*/ ctx[7].call(null, div1)),
    					action_destroyer(/*setModule*/ ctx[6].call(null, div2))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty & /*moduleNode*/ 2) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[1];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty & /*controlsNode*/ 8) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[3];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty & /*deleteNode*/ 16) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[4];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_nodePos && dirty & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty & /*module*/ 4) deletebutton_changes.module = /*module*/ ctx[2];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty & /*module*/ 4) && t2_value !== (t2_value = /*module*/ ctx[2].state.id + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty & /*oscNode*/ 32) && t7_value !== (t7_value = /*oscNode*/ ctx[5].frequency.value.toFixed(1) + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*module*/ 4) {
    				set_input_value(input0, /*module*/ ctx[2].state.frequency);
    			}

    			if (!current || dirty & /*module*/ 4 && input1_id_value !== (input1_id_value = 'sine' + /*module*/ ctx[2].state.id)) {
    				attr_dev(input1, "id", input1_id_value);
    			}

    			if (dirty & /*module*/ 4) {
    				input1.checked = input1.__value === /*module*/ ctx[2].state.shape;
    			}

    			if (!current || dirty & /*module*/ 4 && label1_for_value !== (label1_for_value = 'sine' + /*module*/ ctx[2].state.id)) {
    				attr_dev(label1, "for", label1_for_value);
    			}

    			if (!current || dirty & /*module*/ 4 && input2_id_value !== (input2_id_value = 'triangle' + /*module*/ ctx[2].state.id)) {
    				attr_dev(input2, "id", input2_id_value);
    			}

    			if (dirty & /*module*/ 4) {
    				input2.checked = input2.__value === /*module*/ ctx[2].state.shape;
    			}

    			if (!current || dirty & /*module*/ 4 && label2_for_value !== (label2_for_value = 'triangle' + /*module*/ ctx[2].state.id)) {
    				attr_dev(label2, "for", label2_for_value);
    			}

    			if (!current || dirty & /*module*/ 4 && input3_id_value !== (input3_id_value = 'sawtooth' + /*module*/ ctx[2].state.id)) {
    				attr_dev(input3, "id", input3_id_value);
    			}

    			if (dirty & /*module*/ 4) {
    				input3.checked = input3.__value === /*module*/ ctx[2].state.shape;
    			}

    			if (!current || dirty & /*module*/ 4 && label3_for_value !== (label3_for_value = 'sawtooth' + /*module*/ ctx[2].state.id)) {
    				attr_dev(label3, "for", label3_for_value);
    			}

    			if (!current || dirty & /*module*/ 4 && input4_id_value !== (input4_id_value = 'square' + /*module*/ ctx[2].state.id)) {
    				attr_dev(input4, "id", input4_id_value);
    			}

    			if (dirty & /*module*/ 4) {
    				input4.checked = input4.__value === /*module*/ ctx[2].state.shape;
    			}

    			if (!current || dirty & /*module*/ 4 && label4_for_value !== (label4_for_value = 'square' + /*module*/ ctx[2].state.id)) {
    				attr_dev(label4, "for", label4_for_value);
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
    			/*main_binding*/ ctx[23](null);
    			binding_group.r();
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
    	let $opacity;
    	let $midi;
    	let $context;
    	let $modules;
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(12, $midi = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(24, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(25, $modules = $$value));
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
    	let deleteNode;
    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	let voct = Math.log2(440);
    	let oscNode = $context.createOscillator();
    	module.output = oscNode;
    	oscNode.start(0);

    	function setModule(node) {
    		$$invalidate(1, moduleNode = node);
    	}

    	function setControls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(4, deleteNode = node);
    	}

    	let opacity = spring(1, { stiffness: 0.3, damping: 0.3 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(11, $opacity = value));

    	module.fade = () => {
    		opacity.set(0.3);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	const writable_props = ['state'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCO> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(1, moduleNode), $$invalidate(11, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(3, controlsNode);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		$$invalidate(4, deleteNode);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	function input0_change_input_handler() {
    		module.state.frequency = to_number(this.value);
    		$$invalidate(2, module);
    	}

    	function input1_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(2, module);
    	}

    	function input2_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(2, module);
    	}

    	function input3_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(2, module);
    	}

    	function input4_change_handler() {
    		module.state.shape = this.__value;
    		$$invalidate(2, module);
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			$$invalidate(2, module);
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
    		DeleteButton,
    		createNewId,
    		spring,
    		state,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		module,
    		voct,
    		oscNode,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		$opacity,
    		$midi,
    		$context,
    		$modules
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(1, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(4, deleteNode = $$props.deleteNode);
    		if ('voct' in $$props) $$invalidate(10, voct = $$props.voct);
    		if ('oscNode' in $$props) $$invalidate(5, oscNode = $$props.oscNode);
    		if ('opacity' in $$props) $$invalidate(9, opacity = $$props.opacity);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$midi*/ 4096) {
    			if ($midi.voct) $$invalidate(10, voct = $midi.voct);
    		}

    		if ($$self.$$.dirty & /*voct, module*/ 1028) {
    			$$invalidate(5, oscNode.frequency.value = Math.pow(2, voct + module.state.frequency), oscNode);
    		}

    		if ($$self.$$.dirty & /*module*/ 4) {
    			$$invalidate(5, oscNode.type = module.state.shape, oscNode);
    		}

    		if ($$self.$$.dirty & /*moduleNode, $opacity*/ 2050) {
    			if (moduleNode) $$invalidate(1, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}
    	};

    	return [
    		state,
    		moduleNode,
    		module,
    		controlsNode,
    		deleteNode,
    		oscNode,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		voct,
    		$opacity,
    		$midi,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
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
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, { state: 0 });

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

    const { Object: Object_1$6 } = globals;
    const file$6 = "src\\Output.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i][0];
    	child_ctx[9] = list[i][1];
    	return child_ctx;
    }

    // (41:12) {#if m.output}
    function create_if_block$3(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[8] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*id*/ ctx[8];
    			option.value = option.__value;
    			add_location(option, file$6, 41, 12, 1089);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 2 && t_value !== (t_value = /*id*/ ctx[8] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 2 && option_value_value !== (option_value_value = /*id*/ ctx[8])) {
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
    		source: "(41:12) {#if m.output}",
    		ctx
    	});

    	return block;
    }

    // (40:8) {#each Object.entries($modules) as [id, m]}
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
    		source: "(40:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let label0;
    	let select;
    	let option;
    	let t2;
    	let br0;
    	let t3;
    	let label1;
    	let input;
    	let t5;
    	let br1;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*$modules*/ ctx[1]);
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
    			h2.textContent = "Audio Output";
    			t1 = space();
    			label0 = element("label");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option = element("option");
    			t2 = text(" Input");
    			br0 = element("br");
    			t3 = space();
    			label1 = element("label");
    			label1.textContent = "Volume";
    			input = element("input");
    			t5 = space();
    			br1 = element("br");
    			add_location(h2, file$6, 37, 8, 913);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$6, 44, 8, 1167);
    			attr_dev(select, "class", "svelte-19y79nt");
    			if (/*$output*/ ctx[0].state.inputId === void 0) add_render_callback(() => /*select_change_handler*/ ctx[5].call(select));
    			add_location(select, file$6, 38, 15, 951);
    			add_location(label0, file$6, 38, 8, 944);
    			add_location(br0, file$6, 45, 31, 1230);
    			attr_dev(label1, "for", "gain");
    			add_location(label1, file$6, 46, 8, 1244);
    			attr_dev(input, "id", "gain");
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			attr_dev(input, "class", "svelte-19y79nt");
    			add_location(input, file$6, 46, 40, 1276);
    			attr_dev(div, "class", "svelte-19y79nt");
    			add_location(div, file$6, 36, 4, 898);
    			add_location(br1, file$6, 48, 4, 1387);
    			add_location(main, file$6, 35, 0, 886);
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
    			select_option(select, /*$output*/ ctx[0].state.inputId, true);
    			append_dev(label0, t2);
    			append_dev(div, br0);
    			append_dev(div, t3);
    			append_dev(div, label1);
    			append_dev(div, input);
    			set_input_value(input, /*$output*/ ctx[0].state.volume);
    			append_dev(main, t5);
    			append_dev(main, br1);

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
    			if (dirty & /*Object, $modules*/ 2) {
    				each_value = Object.entries(/*$modules*/ ctx[1]);
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

    			if (dirty & /*$output, Object, $modules*/ 3) {
    				select_option(select, /*$output*/ ctx[0].state.inputId);
    			}

    			if (dirty & /*$output, Object, $modules*/ 3) {
    				set_input_value(input, /*$output*/ ctx[0].state.volume);
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
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $output;
    	let $modules;
    	let $context;
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(0, $output = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(1, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(7, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Output', slots, []);
    	let { state = { volume: 0.2, inputId: null } } = $$props;
    	set_store_value(output, $output.state = state, $output);
    	var gainNode = $context.createGain();
    	gainNode.connect($context.destination);
    	var currentInput;
    	const writable_props = ['state'];

    	Object_1$6.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Output> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		$output.state.inputId = select_value(this);
    		output.set($output);
    	}

    	function input_change_input_handler() {
    		$output.state.volume = to_number(this.value);
    		output.set($output);
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(2, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		output,
    		state,
    		gainNode,
    		currentInput,
    		$output,
    		$modules,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(2, state = $$props.state);
    		if ('gainNode' in $$props) $$invalidate(3, gainNode = $$props.gainNode);
    		if ('currentInput' in $$props) $$invalidate(4, currentInput = $$props.currentInput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$output, $modules*/ 3) {
    			if ($output.state.inputId != null) {
    				set_store_value(output, $output.input = $modules[$output.state.inputId], $output);
    			} else {
    				set_store_value(output, $output.input = null, $output);
    			}
    		}

    		if ($$self.$$.dirty & /*$output*/ 1) {
    			$$invalidate(3, gainNode.gain.value = $output.state.volume, gainNode);
    		}

    		if ($$self.$$.dirty & /*$output, currentInput, gainNode*/ 25) {
    			if ($output.input) {
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
    		$output,
    		$modules,
    		state,
    		gainNode,
    		currentInput,
    		select_change_handler,
    		input_change_input_handler
    	];
    }

    class Output extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, { state: 2 });

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

    const { Object: Object_1$5, console: console_1$1 } = globals;
    const file$5 = "src\\VCA.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i][0];
    	child_ctx[31] = list[i][1];
    	return child_ctx;
    }

    function get_each_context_1$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i][0];
    	child_ctx[31] = list[i][1];
    	return child_ctx;
    }

    // (139:12) {#if m.output && id != module.state.id}
    function create_if_block_1$1(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[30] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*id*/ ctx[30];
    			option.value = option.__value;
    			add_location(option, file$5, 139, 12, 4049);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$modules*/ 8 && t_value !== (t_value = /*id*/ ctx[30] + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*$modules*/ 8 && option_value_value !== (option_value_value = /*id*/ ctx[30])) {
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
    		source: "(139:12) {#if m.output && id != module.state.id}",
    		ctx
    	});

    	return block;
    }

    // (138:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1$2(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[31].output && /*id*/ ctx[30] != /*module*/ ctx[1].state.id && create_if_block_1$1(ctx);

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
    			if (/*m*/ ctx[31].output && /*id*/ ctx[30] != /*module*/ ctx[1].state.id) {
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
    		source: "(138:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (147:12) {#if m.state.type == 'adsr' || m.state.type == 'lfo'}
    function create_if_block$2(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[30] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*id*/ ctx[30];
    			option.value = option.__value;
    			add_location(option, file$5, 147, 12, 4454);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$modules*/ 8 && t_value !== (t_value = /*id*/ ctx[30] + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*$modules*/ 8 && option_value_value !== (option_value_value = /*id*/ ctx[30])) {
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
    		source: "(147:12) {#if m.state.type == 'adsr' || m.state.type == 'lfo'}",
    		ctx
    	});

    	return block;
    }

    // (146:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block$3(ctx) {
    	let if_block_anchor;
    	let if_block = (/*m*/ ctx[31].state.type == 'adsr' || /*m*/ ctx[31].state.type == 'lfo') && create_if_block$2(ctx);

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
    			if (/*m*/ ctx[31].state.type == 'adsr' || /*m*/ ctx[31].state.type == 'lfo') {
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
    		source: "(146:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let t0;
    	let div2;
    	let div0;
    	let deletebutton;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[1].state.id + "";
    	let t2;
    	let t3;
    	let h2;
    	let t5;
    	let div1;
    	let label0;
    	let select0;
    	let option0;
    	let t6;
    	let t7;
    	let label1;
    	let select1;
    	let option1;
    	let t8;
    	let br0;
    	let t9;
    	let label2;
    	let input;
    	let t11;
    	let br1;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[17](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[18](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[19](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[20](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 280, y: 310 } };

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[4] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[4];
    	}

    	if (/*deleteNode*/ ctx[5] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[5];
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
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

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
    			div2 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			h2 = element("h2");
    			h2.textContent = "Amplifier";
    			t5 = space();
    			div1 = element("div");
    			label0 = element("label");
    			select0 = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			option0 = element("option");
    			t6 = text(" Input");
    			t7 = space();
    			label1 = element("label");
    			select1 = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option1 = element("option");
    			t8 = text(" Control");
    			br0 = element("br");
    			t9 = space();
    			label2 = element("label");
    			label2.textContent = "Volume";
    			input = element("input");
    			t11 = space();
    			br1 = element("br");
    			attr_dev(div0, "class", "delete svelte-ooopzg");
    			add_location(div0, file$5, 132, 4, 3578);
    			add_location(h1, file$5, 133, 4, 3656);
    			add_location(h2, file$5, 134, 4, 3688);
    			option0.__value = null;
    			option0.value = option0.__value;
    			add_location(option0, file$5, 142, 8, 4127);
    			if (/*module*/ ctx[1].state.inputId === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[23].call(select0));
    			add_location(select0, file$5, 136, 15, 3764);
    			add_location(label0, file$5, 136, 8, 3757);
    			option1.__value = null;
    			option1.value = option1.__value;
    			add_location(option1, file$5, 150, 8, 4532);
    			if (/*module*/ ctx[1].state.cvId === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[26].call(select1));
    			add_location(select1, file$5, 144, 15, 4207);
    			add_location(label1, file$5, 144, 8, 4200);
    			add_location(br0, file$5, 151, 33, 4597);
    			attr_dev(label2, "for", "gain");
    			add_location(label2, file$5, 152, 8, 4611);
    			attr_dev(input, "id", "gain");
    			attr_dev(input, "type", "range");
    			attr_dev(input, "min", "0");
    			attr_dev(input, "max", "1");
    			attr_dev(input, "step", "0.001");
    			add_location(input, file$5, 152, 40, 4643);
    			attr_dev(div1, "id", "controls");
    			add_location(div1, file$5, 135, 4, 3712);
    			attr_dev(div2, "id", "module");
    			attr_dev(div2, "class", "svelte-ooopzg");
    			add_location(div2, file$5, 131, 0, 3541);
    			add_location(br1, file$5, 155, 0, 4755);
    			add_location(main, file$5, 129, 0, 3374);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
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
    			append_dev(div2, h2);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, label0);
    			append_dev(label0, select0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(select0, null);
    				}
    			}

    			append_dev(select0, option0);
    			select_option(select0, /*module*/ ctx[1].state.inputId, true);
    			append_dev(label0, t6);
    			append_dev(div1, t7);
    			append_dev(div1, label1);
    			append_dev(label1, select1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select1, null);
    				}
    			}

    			append_dev(select1, option1);
    			select_option(select1, /*module*/ ctx[1].state.cvId, true);
    			append_dev(label1, t8);
    			append_dev(div1, br0);
    			append_dev(div1, t9);
    			append_dev(div1, label2);
    			append_dev(div1, input);
    			set_input_value(input, /*module*/ ctx[1].state.gain);
    			append_dev(main, t11);
    			append_dev(main, br1);
    			/*main_binding*/ ctx[28](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[8].call(null, div0)),
    					listen_dev(select0, "mouseenter", /*mouseenter_handler*/ ctx[21], false, false, false, false),
    					listen_dev(select0, "mouseleave", /*mouseleave_handler*/ ctx[22], false, false, false, false),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[23]),
    					listen_dev(select1, "mouseenter", /*mouseenter_handler_1*/ ctx[24], false, false, false, false),
    					listen_dev(select1, "mouseleave", /*mouseleave_handler_1*/ ctx[25], false, false, false, false),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[26]),
    					listen_dev(input, "change", /*input_change_input_handler*/ ctx[27]),
    					listen_dev(input, "input", /*input_change_input_handler*/ ctx[27]),
    					action_destroyer(/*setControls*/ ctx[7].call(null, div1)),
    					action_destroyer(/*setModule*/ ctx[6].call(null, div2))
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

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 16) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[4];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 32) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[5];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t2_value !== (t2_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t2, t2_value);

    			if (dirty[0] & /*$modules, module*/ 10) {
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

    			if (dirty[0] & /*module, $modules*/ 10) {
    				select_option(select0, /*module*/ ctx[1].state.inputId);
    			}

    			if (dirty[0] & /*$modules*/ 8) {
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

    			if (dirty[0] & /*module, $modules*/ 10) {
    				select_option(select1, /*module*/ ctx[1].state.cvId);
    			}

    			if (dirty[0] & /*module, $modules*/ 10) {
    				set_input_value(input, /*module*/ ctx[1].state.gain);
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
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			/*main_binding*/ ctx[28](null);
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
    	let $opacity;
    	let $context;
    	let $modules;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(16, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(3, $modules = $$value));
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
    	let deleteNode;
    	let cv_module;
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	var isEnv = false;
    	var currentInput;
    	var currentCvModule;

    	module.update = () => {
    		((($$invalidate(1, module), $$invalidate(0, state)), $$invalidate(3, $modules)), $$invalidate(29, gainNode));
    	};

    	function setModule(node) {
    		$$invalidate(2, moduleNode = node);
    	}

    	function setControls(node) {
    		$$invalidate(4, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(5, deleteNode = node);
    	}

    	let opacity = spring(1, { stiffness: 0.3, damping: 0.3 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(15, $opacity = value));

    	module.fade = () => {
    		opacity.set(0.3);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	let selectingInput = false;
    	const writable_props = ['state'];

    	Object_1$5.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<VCA> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(15, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(4, controlsNode);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		$$invalidate(5, deleteNode);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	const mouseenter_handler = () => {
    		if (!selectingInput) inputsAllHover(module);
    	};

    	const mouseleave_handler = () => {
    		if (!selectingInput) unhover();
    	};

    	function select0_change_handler() {
    		module.state.inputId = select_value(this);
    		((($$invalidate(1, module), $$invalidate(0, state)), $$invalidate(3, $modules)), $$invalidate(29, gainNode));
    	}

    	const mouseenter_handler_1 = () => cvsAllHover(module);
    	const mouseleave_handler_1 = () => unhover();

    	function select1_change_handler() {
    		module.state.cvId = select_value(this);
    		((($$invalidate(1, module), $$invalidate(0, state)), $$invalidate(3, $modules)), $$invalidate(29, gainNode));
    	}

    	function input_change_input_handler() {
    		module.state.gain = to_number(this.value);
    		((($$invalidate(1, module), $$invalidate(0, state)), $$invalidate(3, $modules)), $$invalidate(29, gainNode));
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			((($$invalidate(1, module), $$invalidate(0, state)), $$invalidate(3, $modules)), $$invalidate(29, gainNode));
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		ModuleMovement,
    		DeleteButton,
    		createNewId,
    		cvsAllHover,
    		inputsAllHover,
    		unhover,
    		spring,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		cv_module,
    		gainNode,
    		isEnv,
    		currentInput,
    		currentCvModule,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		selectingInput,
    		$opacity,
    		$context,
    		$modules
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(4, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(5, deleteNode = $$props.deleteNode);
    		if ('cv_module' in $$props) $$invalidate(11, cv_module = $$props.cv_module);
    		if ('gainNode' in $$props) $$invalidate(29, gainNode = $$props.gainNode);
    		if ('isEnv' in $$props) $$invalidate(12, isEnv = $$props.isEnv);
    		if ('currentInput' in $$props) $$invalidate(13, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(14, currentCvModule = $$props.currentCvModule);
    		if ('opacity' in $$props) $$invalidate(9, opacity = $$props.opacity);
    		if ('selectingInput' in $$props) $$invalidate(10, selectingInput = $$props.selectingInput);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*state, $modules*/ 9) {
    			if (state.inputId != null) {
    				$$invalidate(1, module.input = $modules[state.inputId], module);
    			} else {
    				$$invalidate(1, module.input = null, module);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*state, $modules*/ 9) {
    			if (state.cvId != null) {
    				$$invalidate(11, cv_module = $modules[state.cvId]);
    			} else {
    				$$invalidate(11, cv_module = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$modules*/ 8) {
    			{
    				$$invalidate(12, isEnv = false);

    				Object.entries($modules).forEach(m => {
    					if (m[1].state.type == 'adsr') $$invalidate(12, isEnv = true);
    				});
    			}
    		}

    		if ($$self.$$.dirty[0] & /*isEnv*/ 4096) {
    			if (!isEnv) $$invalidate(11, cv_module = null);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(1, module.max_cv = module.state.gain, module);
    		}

    		if ($$self.$$.dirty[0] & /*module, $context*/ 65538) {
    			gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);
    		}

    		if ($$self.$$.dirty[0] & /*module, currentInput*/ 8194) {
    			if (module.input && module.input.output) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(13, currentInput = module.input.output);
    				currentInput.connect(gainNode);
    				if (module.input.input || module.input.inputs) module.input.update();
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(13, currentInput = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*cv_module, $context, currentCvModule, module*/ 83970) {
    			if (cv_module) {
    				gainNode.gain.cancelScheduledValues($context.currentTime);
    				gainNode.gain.setValueAtTime(0, $context.currentTime);

    				if (currentCvModule) {
    					if (currentCvModule.inputs[module.state.id]) delete currentCvModule.inputs[module.state.id];
    				}

    				$$invalidate(14, currentCvModule = cv_module);

    				$$invalidate(
    					14,
    					currentCvModule.inputs[module.state.id] = {
    						cv: gainNode.gain,
    						max_cv: module.state.gain
    					},
    					currentCvModule
    				);
    			} else {
    				gainNode.gain.cancelScheduledValues($context.currentTime);
    				gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);

    				if (currentCvModule) {
    					if (currentCvModule.inputs[module.state.id]) delete currentCvModule.inputs[module.state.id];
    				}

    				$$invalidate(14, currentCvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 32772) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			if (selectingInput) {
    				inputsAllHover(module);
    			} else {
    				unhover();
    			}
    		}
    	};

    	$$invalidate(1, module.cv_in = gainNode.gain, module);
    	console.log(selectingInput);

    	return [
    		state,
    		module,
    		moduleNode,
    		$modules,
    		controlsNode,
    		deleteNode,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		selectingInput,
    		cv_module,
    		isEnv,
    		currentInput,
    		currentCvModule,
    		$opacity,
    		$context,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_nodePos_binding,
    		mouseenter_handler,
    		mouseleave_handler,
    		select0_change_handler,
    		mouseenter_handler_1,
    		mouseleave_handler_1,
    		select1_change_handler,
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

    const { Object: Object_1$4 } = globals;
    const file$4 = "src\\ADSR.svelte";

    function create_fragment$4(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let t0;
    	let div3;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let h2;
    	let t4;
    	let div0;
    	let deletebutton;
    	let t5;
    	let div2;
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
    	let t21;
    	let br;
    	let current;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[15](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[16](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[17](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[18](value);
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

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));

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
    			h2 = element("h2");
    			h2.textContent = "Envelope";
    			t4 = space();
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t5 = space();
    			div2 = element("div");
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
    			add_location(h1, file$4, 88, 8, 2650);
    			add_location(h2, file$4, 89, 8, 2686);
    			attr_dev(div0, "class", "delete svelte-4v52pm");
    			add_location(div0, file$4, 90, 8, 2713);
    			attr_dev(label0, "for", "attack");
    			add_location(label0, file$4, 93, 16, 2882);
    			attr_dev(input0, "id", "attack");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "1");
    			attr_dev(input0, "step", "0.001");
    			add_location(input0, file$4, 93, 73, 2939);
    			attr_dev(label1, "for", "decay");
    			add_location(label1, file$4, 94, 16, 3051);
    			attr_dev(input1, "id", "decay");
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "max", "1");
    			attr_dev(input1, "step", "0.001");
    			add_location(input1, file$4, 94, 70, 3105);
    			attr_dev(label2, "for", "sustain");
    			add_location(label2, file$4, 95, 16, 3215);
    			attr_dev(input2, "id", "sustain");
    			attr_dev(input2, "type", "range");
    			attr_dev(input2, "min", "0");
    			attr_dev(input2, "max", "1");
    			attr_dev(input2, "step", "0.001");
    			add_location(input2, file$4, 95, 88, 3287);
    			attr_dev(label3, "for", "release");
    			add_location(label3, file$4, 96, 16, 3401);
    			attr_dev(input3, "id", "release");
    			attr_dev(input3, "type", "range");
    			attr_dev(input3, "min", "0");
    			attr_dev(input3, "max", "1");
    			attr_dev(input3, "step", "0.001");
    			add_location(input3, file$4, 96, 76, 3461);
    			attr_dev(div1, "class", "params");
    			add_location(div1, file$4, 92, 12, 2844);
    			attr_dev(div2, "id", "controls");
    			add_location(div2, file$4, 91, 8, 2795);
    			attr_dev(div3, "id", "module");
    			attr_dev(div3, "class", "svelte-4v52pm");
    			add_location(div3, file$4, 87, 4, 2609);
    			add_location(br, file$4, 100, 4, 3611);
    			add_location(main, file$4, 85, 0, 2416);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			mount_component(modulemovement, main, null);
    			append_dev(main, t0);
    			append_dev(main, div3);
    			append_dev(div3, h1);
    			append_dev(h1, t1);
    			append_dev(div3, t2);
    			append_dev(div3, h2);
    			append_dev(div3, t4);
    			append_dev(div3, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
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
    			/*main_binding*/ ctx[23](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[10].call(null, div0)),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[19]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[19]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[20]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[20]),
    					listen_dev(input2, "change", /*input2_change_input_handler*/ ctx[21]),
    					listen_dev(input2, "input", /*input2_change_input_handler*/ ctx[21]),
    					listen_dev(input3, "change", /*input3_change_input_handler*/ ctx[22]),
    					listen_dev(input3, "input", /*input3_change_input_handler*/ ctx[22]),
    					action_destroyer(/*setControls*/ ctx[9].call(null, div2)),
    					action_destroyer(/*setModule*/ ctx[8].call(null, div3))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
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

    			if (!updating_deleteNode && dirty & /*deleteNode*/ 16) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[4];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_nodePos && dirty & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);
    			const deletebutton_changes = {};
    			if (dirty & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty & /*attack*/ 32) && t7_value !== (t7_value = /*attack*/ ctx[5].toFixed(2) + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input0, /*module*/ ctx[1].state.attack);
    			}

    			if ((!current || dirty & /*decay*/ 64) && t11_value !== (t11_value = /*decay*/ ctx[6].toFixed(2) + "")) set_data_dev(t11, t11_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input1, /*module*/ ctx[1].state.decay);
    			}

    			if ((!current || dirty & /*module*/ 2) && t15_value !== (t15_value = /*module*/ ctx[1].state.sustain.toFixed(2) + "")) set_data_dev(t15, t15_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input2, /*module*/ ctx[1].state.sustain);
    			}

    			if ((!current || dirty & /*release*/ 128) && t19_value !== (t19_value = /*release*/ ctx[7].toFixed(2) + "")) set_data_dev(t19, t19_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input3, /*module*/ ctx[1].state.release);
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
    			/*main_binding*/ ctx[23](null);
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
    	let $opacity;
    	let $midi;
    	let $context;
    	let $modules;
    	validate_store(midi, 'midi');
    	component_subscribe($$self, midi, $$value => $$invalidate(14, $midi = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(24, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(25, $modules = $$value));
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
    	module.inputs = {};
    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let notePlaying = false;
    	let attack, decay, release;

    	const fireEnv = () => {
    		Object.values(module.inputs).forEach(input => {
    			input.cv.cancelScheduledValues($context.currentTime);
    			input.cv.setValueAtTime(0, $context.currentTime);
    			input.cv.linearRampToValueAtTime(input.max_cv, $context.currentTime + attack);
    			input.cv.linearRampToValueAtTime(input.max_cv * module.state.sustain, $context.currentTime + attack + decay);
    		});
    	};

    	const unFireEnv = () => {
    		Object.values(module.inputs).forEach(input => {
    			input.cv.cancelScheduledValues($context.currentTime);
    			input.cv.setValueAtTime(input.max_cv * module.state.sustain, $context.currentTime);
    			input.cv.linearRampToValueAtTime(0, $context.currentTime + release);
    		});
    	};

    	function setModule(node) {
    		$$invalidate(2, moduleNode = node);
    	}

    	function setControls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(4, deleteNode = node);
    	}

    	let opacity = spring(1, { stiffness: 0.3, damping: 0.3 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(13, $opacity = value));

    	module.fade = () => {
    		opacity.set(0.3);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	const writable_props = ['state'];

    	Object_1$4.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ADSR> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(13, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(3, controlsNode);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		$$invalidate(4, deleteNode);
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
    		DeleteButton,
    		createNewId,
    		inputsAllHover,
    		unhover,
    		spring,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		notePlaying,
    		attack,
    		decay,
    		release,
    		fireEnv,
    		unFireEnv,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		$opacity,
    		$midi,
    		$context,
    		$modules
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(4, deleteNode = $$props.deleteNode);
    		if ('notePlaying' in $$props) $$invalidate(12, notePlaying = $$props.notePlaying);
    		if ('attack' in $$props) $$invalidate(5, attack = $$props.attack);
    		if ('decay' in $$props) $$invalidate(6, decay = $$props.decay);
    		if ('release' in $$props) $$invalidate(7, release = $$props.release);
    		if ('opacity' in $$props) $$invalidate(11, opacity = $$props.opacity);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*module*/ 2) {
    			$$invalidate(5, attack = Math.pow(10, module.state.attack) - 1);
    		}

    		if ($$self.$$.dirty & /*module*/ 2) {
    			$$invalidate(6, decay = Math.pow(10, module.state.decay) - 1);
    		}

    		if ($$self.$$.dirty & /*module*/ 2) {
    			$$invalidate(7, release = Math.pow(10, module.state.release) - 1);
    		}

    		if ($$self.$$.dirty & /*$midi, notePlaying*/ 20480) {
    			if ($midi.trigger && !notePlaying) $$invalidate(12, notePlaying = true);
    		}

    		if ($$self.$$.dirty & /*$midi, notePlaying*/ 20480) {
    			if (!$midi.trigger && notePlaying) $$invalidate(12, notePlaying = false);
    		}

    		if ($$self.$$.dirty & /*notePlaying*/ 4096) {
    			if (notePlaying) fireEnv(); else unFireEnv();
    		}

    		if ($$self.$$.dirty & /*moduleNode, $opacity*/ 8196) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
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
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		notePlaying,
    		$opacity,
    		$midi,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
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
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { state: 0 });

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

    const { Object: Object_1$3 } = globals;
    const file$3 = "src\\VCF.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[34] = list[i][0];
    	child_ctx[35] = list[i][1];
    	return child_ctx;
    }

    function get_each_context_1$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[34] = list[i][0];
    	child_ctx[35] = list[i][1];
    	return child_ctx;
    }

    // (131:20) {#if m.output && id != module.state.id}
    function create_if_block_1(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[34] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*id*/ ctx[34];
    			option.value = option.__value;
    			add_location(option, file$3, 131, 20, 4018);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$modules*/ 16 && t_value !== (t_value = /*id*/ ctx[34] + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*$modules*/ 16 && option_value_value !== (option_value_value = /*id*/ ctx[34])) {
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
    		source: "(131:20) {#if m.output && id != module.state.id}",
    		ctx
    	});

    	return block;
    }

    // (130:16) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1$1(ctx) {
    	let if_block_anchor;
    	let if_block = /*m*/ ctx[35].output && /*id*/ ctx[34] != /*module*/ ctx[1].state.id && create_if_block_1(ctx);

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
    			if (/*m*/ ctx[35].output && /*id*/ ctx[34] != /*module*/ ctx[1].state.id) {
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
    		source: "(130:16) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (139:20) {#if m.state.type == 'adsr' || m.state.type == 'lfo'}
    function create_if_block$1(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[34] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*id*/ ctx[34];
    			option.value = option.__value;
    			add_location(option, file$3, 139, 20, 4487);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*$modules*/ 16 && t_value !== (t_value = /*id*/ ctx[34] + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*$modules*/ 16 && option_value_value !== (option_value_value = /*id*/ ctx[34])) {
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
    		source: "(139:20) {#if m.state.type == 'adsr' || m.state.type == 'lfo'}",
    		ctx
    	});

    	return block;
    }

    // (138:16) {#each Object.entries($modules) as [id, m]}
    function create_each_block$2(ctx) {
    	let if_block_anchor;
    	let if_block = (/*m*/ ctx[35].state.type == 'adsr' || /*m*/ ctx[35].state.type == 'lfo') && create_if_block$1(ctx);

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
    			if (/*m*/ ctx[35].state.type == 'adsr' || /*m*/ ctx[35].state.type == 'lfo') {
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
    		source: "(138:16) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let t0;
    	let div2;
    	let h1;
    	let t1_value = /*module*/ ctx[1].state.id + "";
    	let t1;
    	let t2;
    	let h2;
    	let t4;
    	let div0;
    	let deletebutton;
    	let t5;
    	let div1;
    	let label0;
    	let select0;
    	let option0;
    	let t6;
    	let t7;
    	let label1;
    	let select1;
    	let option1;
    	let t8;
    	let br0;
    	let t9;
    	let label2;
    	let t10;
    	let t11_value = /*frequency*/ ctx[3].toFixed(1) + "";
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
    	let t19;
    	let br2;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[18](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[19](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[20](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[21](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 280, y: 350 } };

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[5] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[5];
    	}

    	if (/*deleteNode*/ ctx[6] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[6];
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
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	let each_value_1 = Object.entries(/*$modules*/ ctx[4]);
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1$1(get_each_context_1$1(ctx, each_value_1, i));
    	}

    	let each_value = Object.entries(/*$modules*/ ctx[4]);
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[30][0]);

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
    			h2.textContent = "Filter";
    			t4 = space();
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t5 = space();
    			div1 = element("div");
    			label0 = element("label");
    			select0 = element("select");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			option0 = element("option");
    			t6 = text(" Input");
    			t7 = space();
    			label1 = element("label");
    			select1 = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option1 = element("option");
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
    			add_location(h1, file$3, 124, 8, 3556);
    			add_location(h2, file$3, 125, 8, 3592);
    			attr_dev(div0, "class", "delete svelte-1uf9ykf");
    			add_location(div0, file$3, 126, 8, 3617);
    			option0.__value = null;
    			option0.value = option0.__value;
    			add_location(option0, file$3, 134, 16, 4120);
    			if (/*module*/ ctx[1].state.inputId === void 0) add_render_callback(() => /*select0_change_handler*/ ctx[24].call(select0));
    			add_location(select0, file$3, 128, 19, 3755);
    			add_location(label0, file$3, 128, 12, 3748);
    			option1.__value = null;
    			option1.value = option1.__value;
    			add_location(option1, file$3, 142, 16, 4589);
    			if (/*module*/ ctx[1].state.cvId === void 0) add_render_callback(() => /*select1_change_handler*/ ctx[27].call(select1));
    			add_location(select1, file$3, 136, 23, 4216);
    			add_location(label1, file$3, 136, 16, 4209);
    			add_location(br0, file$3, 143, 41, 4662);
    			attr_dev(label2, "for", "freq");
    			add_location(label2, file$3, 144, 12, 4680);
    			attr_dev(input0, "id", "freq");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", Math.log2(20));
    			attr_dev(input0, "max", Math.log2(18000));
    			attr_dev(input0, "step", "0.0001");
    			add_location(input0, file$3, 144, 81, 4749);
    			add_location(br1, file$3, 145, 12, 4885);
    			attr_dev(input1, "id", input1_id_value = 'lowpass' + /*module*/ ctx[1].state.id);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "lowpass";
    			input1.value = input1.__value;
    			attr_dev(input1, "class", "svelte-1uf9ykf");
    			add_location(input1, file$3, 146, 16, 4929);
    			attr_dev(label3, "for", label3_for_value = 'lowpass' + /*module*/ ctx[1].state.id);
    			attr_dev(label3, "class", "svelte-1uf9ykf");
    			add_location(label3, file$3, 146, 122, 5035);
    			attr_dev(input2, "id", input2_id_value = 'highpass' + /*module*/ ctx[1].state.id);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "highpass";
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-1uf9ykf");
    			add_location(input2, file$3, 147, 16, 5107);
    			attr_dev(label4, "for", label4_for_value = 'highpass' + /*module*/ ctx[1].state.id);
    			attr_dev(label4, "class", "svelte-1uf9ykf");
    			add_location(label4, file$3, 147, 124, 5215);
    			attr_dev(input3, "id", input3_id_value = 'bandpass' + /*module*/ ctx[1].state.id);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "bandpass";
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-1uf9ykf");
    			add_location(input3, file$3, 148, 16, 5289);
    			attr_dev(label5, "for", label5_for_value = 'bandpass' + /*module*/ ctx[1].state.id);
    			attr_dev(label5, "class", "svelte-1uf9ykf");
    			add_location(label5, file$3, 148, 124, 5397);
    			attr_dev(section, "class", "type svelte-1uf9ykf");
    			add_location(section, file$3, 145, 16, 4889);
    			attr_dev(div1, "id", "controls");
    			add_location(div1, file$3, 127, 8, 3699);
    			attr_dev(div2, "id", "module");
    			attr_dev(div2, "class", "svelte-1uf9ykf");
    			add_location(div2, file$3, 123, 4, 3515);
    			add_location(br2, file$3, 152, 4, 5511);
    			add_location(main, file$3, 121, 0, 3344);
    			binding_group.p(input1, input2, input3);
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
    			append_dev(div2, div0);
    			mount_component(deletebutton, div0, null);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
    			append_dev(div1, label0);
    			append_dev(label0, select0);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				if (each_blocks_1[i]) {
    					each_blocks_1[i].m(select0, null);
    				}
    			}

    			append_dev(select0, option0);
    			select_option(select0, /*module*/ ctx[1].state.inputId, true);
    			append_dev(label0, t6);
    			append_dev(div1, t7);
    			append_dev(div1, label1);
    			append_dev(label1, select1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(select1, null);
    				}
    			}

    			append_dev(select1, option1);
    			select_option(select1, /*module*/ ctx[1].state.cvId, true);
    			append_dev(label1, t8);
    			append_dev(div1, br0);
    			append_dev(div1, t9);
    			append_dev(div1, label2);
    			append_dev(label2, t10);
    			append_dev(label2, t11);
    			append_dev(label2, t12);
    			append_dev(div1, input0);
    			set_input_value(input0, /*module*/ ctx[1].state.voct);
    			append_dev(div1, t13);
    			append_dev(div1, br1);
    			append_dev(div1, section);
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
    			/*main_binding*/ ctx[33](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[9].call(null, div0)),
    					listen_dev(select0, "mouseenter", /*mouseenter_handler*/ ctx[22], false, false, false, false),
    					listen_dev(select0, "mouseleave", /*mouseleave_handler*/ ctx[23], false, false, false, false),
    					listen_dev(select0, "change", /*select0_change_handler*/ ctx[24]),
    					listen_dev(select1, "mouseenter", /*mouseenter_handler_1*/ ctx[25], false, false, false, false),
    					listen_dev(select1, "mouseleave", /*mouseleave_handler_1*/ ctx[26], false, false, false, false),
    					listen_dev(select1, "change", /*select1_change_handler*/ ctx[27]),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[28]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[28]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[29]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[31]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[32]),
    					action_destroyer(/*setControls*/ ctx[8].call(null, div1)),
    					action_destroyer(/*setModule*/ ctx[7].call(null, div2))
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

    			if (!updating_controlsNode && dirty[0] & /*controlsNode*/ 32) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[5];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty[0] & /*deleteNode*/ 64) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[6];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_nodePos && dirty[0] & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			if ((!current || dirty[0] & /*module*/ 2) && t1_value !== (t1_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t1, t1_value);
    			const deletebutton_changes = {};
    			if (dirty[0] & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);

    			if (dirty[0] & /*$modules, module*/ 18) {
    				each_value_1 = Object.entries(/*$modules*/ ctx[4]);
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

    			if (dirty[0] & /*module, $modules*/ 18) {
    				select_option(select0, /*module*/ ctx[1].state.inputId);
    			}

    			if (dirty[0] & /*$modules*/ 16) {
    				each_value = Object.entries(/*$modules*/ ctx[4]);
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

    			if (dirty[0] & /*module, $modules*/ 18) {
    				select_option(select1, /*module*/ ctx[1].state.cvId);
    			}

    			if ((!current || dirty[0] & /*frequency*/ 8) && t11_value !== (t11_value = /*frequency*/ ctx[3].toFixed(1) + "")) set_data_dev(t11, t11_value);

    			if (dirty[0] & /*module, $modules*/ 18) {
    				set_input_value(input0, /*module*/ ctx[1].state.voct);
    			}

    			if (!current || dirty[0] & /*module, $modules*/ 18 && input1_id_value !== (input1_id_value = 'lowpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input1, "id", input1_id_value);
    			}

    			if (dirty[0] & /*module, $modules*/ 18) {
    				input1.checked = input1.__value === /*module*/ ctx[1].state.filterType;
    			}

    			if (!current || dirty[0] & /*module, $modules*/ 18 && label3_for_value !== (label3_for_value = 'lowpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label3, "for", label3_for_value);
    			}

    			if (!current || dirty[0] & /*module, $modules*/ 18 && input2_id_value !== (input2_id_value = 'highpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input2, "id", input2_id_value);
    			}

    			if (dirty[0] & /*module, $modules*/ 18) {
    				input2.checked = input2.__value === /*module*/ ctx[1].state.filterType;
    			}

    			if (!current || dirty[0] & /*module, $modules*/ 18 && label4_for_value !== (label4_for_value = 'highpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label4, "for", label4_for_value);
    			}

    			if (!current || dirty[0] & /*module, $modules*/ 18 && input3_id_value !== (input3_id_value = 'bandpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input3, "id", input3_id_value);
    			}

    			if (dirty[0] & /*module, $modules*/ 18) {
    				input3.checked = input3.__value === /*module*/ ctx[1].state.filterType;
    			}

    			if (!current || dirty[0] & /*module, $modules*/ 18 && label5_for_value !== (label5_for_value = 'bandpass' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label5, "for", label5_for_value);
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
    			destroy_each(each_blocks_1, detaching);
    			destroy_each(each_blocks, detaching);
    			/*main_binding*/ ctx[33](null);
    			binding_group.r();
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
    	let $opacity;
    	let $context;
    	let $modules;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(17, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(4, $modules = $$value));
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
    	let deleteNode;
    	let cv_module;
    	var filterNode = $context.createBiquadFilter();
    	module.output = filterNode;
    	var isEnv = false;
    	var frequency;
    	var currentInput;
    	var currentCvModule;

    	module.update = () => {
    		($$invalidate(1, module), $$invalidate(4, $modules));
    	};

    	function setModule(node) {
    		$$invalidate(2, moduleNode = node);
    	}

    	function setControls(node) {
    		$$invalidate(5, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(6, deleteNode = node);
    	}

    	let opacity = spring(1, { stiffness: 0.3, damping: 0.3 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(16, $opacity = value));

    	module.fade = () => {
    		opacity.set(0.3);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	const writable_props = ['state'];

    	Object_1$3.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCF> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(16, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(5, controlsNode);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		$$invalidate(6, deleteNode);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	const mouseenter_handler = () => inputsAllHover(module);
    	const mouseleave_handler = () => unhover();

    	function select0_change_handler() {
    		module.state.inputId = select_value(this);
    		($$invalidate(1, module), $$invalidate(4, $modules));
    	}

    	const mouseenter_handler_1 = () => cvsAllHover(module);
    	const mouseleave_handler_1 = () => unhover();

    	function select1_change_handler() {
    		module.state.cvId = select_value(this);
    		($$invalidate(1, module), $$invalidate(4, $modules));
    	}

    	function input0_change_input_handler() {
    		module.state.voct = to_number(this.value);
    		($$invalidate(1, module), $$invalidate(4, $modules));
    	}

    	function input1_change_handler() {
    		module.state.filterType = this.__value;
    		($$invalidate(1, module), $$invalidate(4, $modules));
    	}

    	function input2_change_handler() {
    		module.state.filterType = this.__value;
    		($$invalidate(1, module), $$invalidate(4, $modules));
    	}

    	function input3_change_handler() {
    		module.state.filterType = this.__value;
    		($$invalidate(1, module), $$invalidate(4, $modules));
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			($$invalidate(1, module), $$invalidate(4, $modules));
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		ModuleMovement,
    		DeleteButton,
    		createNewId,
    		cvsAllHover,
    		inputsAllHover,
    		unhover,
    		spring,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		cv_module,
    		filterNode,
    		isEnv,
    		frequency,
    		currentInput,
    		currentCvModule,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		$opacity,
    		$context,
    		$modules
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(5, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(6, deleteNode = $$props.deleteNode);
    		if ('cv_module' in $$props) $$invalidate(11, cv_module = $$props.cv_module);
    		if ('filterNode' in $$props) $$invalidate(12, filterNode = $$props.filterNode);
    		if ('isEnv' in $$props) $$invalidate(13, isEnv = $$props.isEnv);
    		if ('frequency' in $$props) $$invalidate(3, frequency = $$props.frequency);
    		if ('currentInput' in $$props) $$invalidate(14, currentInput = $$props.currentInput);
    		if ('currentCvModule' in $$props) $$invalidate(15, currentCvModule = $$props.currentCvModule);
    		if ('opacity' in $$props) $$invalidate(10, opacity = $$props.opacity);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*module, $modules*/ 18) {
    			if (module.state.inputId != null) {
    				$$invalidate(1, module.input = $modules[module.state.inputId], module);
    			} else {
    				$$invalidate(1, module.input = null, module);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*module, $modules*/ 18) {
    			if (module.state.cvId != null) {
    				$$invalidate(11, cv_module = $modules[module.state.cvId]);
    			} else {
    				$$invalidate(11, cv_module = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*$modules*/ 16) {
    			{
    				$$invalidate(13, isEnv = false);

    				Object.entries($modules).forEach(m => {
    					if (m[1].state.type == 'adsr') $$invalidate(13, isEnv = true);
    				});
    			}
    		}

    		if ($$self.$$.dirty[0] & /*isEnv*/ 8192) {
    			if (!isEnv) $$invalidate(11, cv_module = null);
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(3, frequency = Math.pow(2, module.state.voct));
    		}

    		if ($$self.$$.dirty[0] & /*module*/ 2) {
    			$$invalidate(12, filterNode.type = module.state.filterType, filterNode);
    		}

    		if ($$self.$$.dirty[0] & /*filterNode, frequency, $context*/ 135176) {
    			filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
    		}

    		if ($$self.$$.dirty[0] & /*module, currentInput, filterNode*/ 20482) {
    			if (module.input) {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(14, currentInput = module.input.output);
    				currentInput.connect(filterNode);
    				if (module.input.input || module.input.inputs) module.input.update();
    			} else {
    				if (currentInput) currentInput.disconnect();
    				$$invalidate(14, currentInput = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*cv_module, filterNode, $context, currentCvModule, module, frequency*/ 169994) {
    			if (cv_module && cv_module.inputs) {
    				filterNode.frequency.cancelScheduledValues($context.currentTime);
    				filterNode.frequency.setValueAtTime(0, $context.currentTime);

    				if (currentCvModule) {
    					if (currentCvModule.inputs[module.state.id]) delete currentCvModule.inputs[module.state.id];
    				}

    				$$invalidate(15, currentCvModule = cv_module);

    				$$invalidate(
    					15,
    					currentCvModule.inputs[module.state.id] = {
    						cv: filterNode.frequency,
    						max_cv: frequency
    					},
    					currentCvModule
    				);
    			} else {
    				filterNode.frequency.cancelScheduledValues($context.currentTime);
    				filterNode.frequency.setValueAtTime(frequency, $context.currentTime);

    				if (currentCvModule) {
    					if (currentCvModule.inputs[module.state.id]) delete currentCvModule.inputs[module.state.id];
    				}

    				$$invalidate(15, currentCvModule = null);
    			}
    		}

    		if ($$self.$$.dirty[0] & /*moduleNode, $opacity*/ 65540) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		frequency,
    		$modules,
    		controlsNode,
    		deleteNode,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		cv_module,
    		filterNode,
    		isEnv,
    		currentInput,
    		currentCvModule,
    		$opacity,
    		$context,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_nodePos_binding,
    		mouseenter_handler,
    		mouseleave_handler,
    		select0_change_handler,
    		mouseenter_handler_1,
    		mouseleave_handler_1,
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

    const { Object: Object_1$2 } = globals;
    const file$2 = "src\\Mixer.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[22] = list[i];
    	child_ctx[23] = list;
    	child_ctx[24] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i][0];
    	child_ctx[26] = list[i][1];
    	return child_ctx;
    }

    // (90:12) {#if m && m.output && id != module.state.id && (!module.inputs.includes(m) || m == input)}
    function create_if_block(ctx) {
    	let option;
    	let t_value = /*id*/ ctx[25] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*id*/ ctx[25];
    			option.value = option.__value;
    			add_location(option, file$2, 90, 12, 2663);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$modules*/ 8 && t_value !== (t_value = /*id*/ ctx[25] + "")) set_data_dev(t, t_value);

    			if (dirty & /*$modules*/ 8 && option_value_value !== (option_value_value = /*id*/ ctx[25])) {
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
    		source: "(90:12) {#if m && m.output && id != module.state.id && (!module.inputs.includes(m) || m == input)}",
    		ctx
    	});

    	return block;
    }

    // (89:8) {#each Object.entries($modules) as [id, m]}
    function create_each_block_1(ctx) {
    	let show_if = /*m*/ ctx[26] && /*m*/ ctx[26].output && /*id*/ ctx[25] != /*module*/ ctx[1].state.id && (!/*module*/ ctx[1].inputs.includes(/*m*/ ctx[26]) || /*m*/ ctx[26] == /*input*/ ctx[22]);
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
    			if (dirty & /*$modules, module*/ 10) show_if = /*m*/ ctx[26] && /*m*/ ctx[26].output && /*id*/ ctx[25] != /*module*/ ctx[1].state.id && (!/*module*/ ctx[1].inputs.includes(/*m*/ ctx[26]) || /*m*/ ctx[26] == /*input*/ ctx[22]);

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
    		source: "(89:8) {#each Object.entries($modules) as [id, m]}",
    		ctx
    	});

    	return block;
    }

    // (87:4) {#each module.inputs as input, i}
    function create_each_block$1(ctx) {
    	let label;
    	let select;
    	let option;
    	let t0;
    	let t1;
    	let mounted;
    	let dispose;
    	let each_value_1 = Object.entries(/*$modules*/ ctx[3]);
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	function select_change_handler() {
    		/*select_change_handler*/ ctx[18].call(select, /*i*/ ctx[24]);
    	}

    	const block = {
    		c: function create() {
    			label = element("label");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			option = element("option");
    			t0 = text(" Input ");
    			t1 = text(/*i*/ ctx[24]);
    			option.__value = null;
    			option.value = option.__value;
    			add_location(option, file$2, 93, 12, 2745);
    			if (/*module*/ ctx[1].state.inputIds[/*i*/ ctx[24]] === void 0) add_render_callback(select_change_handler);
    			add_location(select, file$2, 87, 15, 2369);
    			add_location(label, file$2, 87, 8, 2362);
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
    			select_option(select, /*module*/ ctx[1].state.inputIds[/*i*/ ctx[24]], true);
    			append_dev(label, t0);
    			append_dev(label, t1);

    			if (!mounted) {
    				dispose = [
    					listen_dev(select, "mouseenter", /*mouseenter_handler*/ ctx[16], false, false, false, false),
    					listen_dev(select, "mouseleave", /*mouseleave_handler*/ ctx[17], false, false, false, false),
    					listen_dev(select, "change", select_change_handler)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*Object, $modules, module*/ 10) {
    				each_value_1 = Object.entries(/*$modules*/ ctx[3]);
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

    			if (dirty & /*module, Object, $modules*/ 10) {
    				select_option(select, /*module*/ ctx[1].state.inputIds[/*i*/ ctx[24]]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(87:4) {#each module.inputs as input, i}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let t0;
    	let div2;
    	let div0;
    	let deletebutton;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[1].state.id + "";
    	let t2;
    	let t3;
    	let h2;
    	let t5;
    	let div1;
    	let t6;
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

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[14](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[15](value);
    	}

    	let modulemovement_props = { nodeSize: { x: 200, y: 320 } };

    	if (/*moduleNode*/ ctx[2] !== void 0) {
    		modulemovement_props.moduleNode = /*moduleNode*/ ctx[2];
    	}

    	if (/*controlsNode*/ ctx[4] !== void 0) {
    		modulemovement_props.controlsNode = /*controlsNode*/ ctx[4];
    	}

    	if (/*deleteNode*/ ctx[5] !== void 0) {
    		modulemovement_props.deleteNode = /*deleteNode*/ ctx[5];
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
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

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
    			div2 = element("div");
    			div0 = element("div");
    			create_component(deletebutton.$$.fragment);
    			t1 = space();
    			h1 = element("h1");
    			t2 = text(t2_value);
    			t3 = space();
    			h2 = element("h2");
    			h2.textContent = "Mixer";
    			t5 = space();
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t6 = space();
    			br = element("br");
    			attr_dev(div0, "class", "delete svelte-when5m");
    			add_location(div0, file$2, 82, 4, 2148);
    			add_location(h1, file$2, 83, 4, 2226);
    			add_location(h2, file$2, 84, 4, 2258);
    			attr_dev(div1, "id", "controls");
    			add_location(div1, file$2, 85, 4, 2278);
    			attr_dev(div2, "id", "module");
    			attr_dev(div2, "class", "svelte-when5m");
    			add_location(div2, file$2, 81, 0, 2111);
    			add_location(br, file$2, 98, 0, 2847);
    			add_location(main, file$2, 79, 0, 1944);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
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
    			append_dev(div2, h2);
    			append_dev(div2, t5);
    			append_dev(div2, div1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				if (each_blocks[i]) {
    					each_blocks[i].m(div1, null);
    				}
    			}

    			append_dev(main, t6);
    			append_dev(main, br);
    			/*main_binding*/ ctx[19](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[8].call(null, div0)),
    					action_destroyer(/*setControls*/ ctx[7].call(null, div1)),
    					action_destroyer(/*setModule*/ ctx[6].call(null, div2))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const modulemovement_changes = {};

    			if (!updating_moduleNode && dirty & /*moduleNode*/ 4) {
    				updating_moduleNode = true;
    				modulemovement_changes.moduleNode = /*moduleNode*/ ctx[2];
    				add_flush_callback(() => updating_moduleNode = false);
    			}

    			if (!updating_controlsNode && dirty & /*controlsNode*/ 16) {
    				updating_controlsNode = true;
    				modulemovement_changes.controlsNode = /*controlsNode*/ ctx[4];
    				add_flush_callback(() => updating_controlsNode = false);
    			}

    			if (!updating_deleteNode && dirty & /*deleteNode*/ 32) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[5];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_nodePos && dirty & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty & /*module*/ 2) && t2_value !== (t2_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t2, t2_value);

    			if (dirty & /*module, inputsAllHover, unhover, Object, $modules*/ 10) {
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
    						each_blocks[i].m(div1, null);
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
    			/*main_binding*/ ctx[19](null);
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
    	let $opacity;
    	let $modules;
    	let $context;
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(3, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(20, $context = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Mixer', slots, []);

    	let { state = {
    		type: 'mixer',
    		id: createNewId(),
    		inputIds: [null, null, null, null],
    		position: { x: 300, y: 100 }
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	var gainNode = $context.createGain();
    	module.output = gainNode;
    	module.inputs = [null, null, null, null];
    	const currentInputs = [null, null, null, null];

    	module.update = () => {
    		(($$invalidate(1, module), $$invalidate(0, state)), $$invalidate(3, $modules));
    	};

    	function setModule(node) {
    		$$invalidate(2, moduleNode = node);
    	}

    	function setControls(node) {
    		$$invalidate(4, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(5, deleteNode = node);
    	}

    	let opacity = spring(1, { stiffness: 0.3, damping: 0.3 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(11, $opacity = value));

    	module.fade = () => {
    		opacity.set(0.3);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	const writable_props = ['state'];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Mixer> was created with unknown prop '${key}'`);
    	});

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(11, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(4, controlsNode);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		$$invalidate(5, deleteNode);
    	}

    	function modulemovement_nodePos_binding(value) {
    		if ($$self.$$.not_equal(state.position, value)) {
    			state.position = value;
    			$$invalidate(0, state);
    		}
    	}

    	const mouseenter_handler = () => inputsAllHover(module);
    	const mouseleave_handler = () => unhover();

    	function select_change_handler(i) {
    		module.state.inputIds[i] = select_value(this);
    		(($$invalidate(1, module), $$invalidate(0, state)), $$invalidate(3, $modules));
    	}

    	function main_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			module.component = $$value;
    			(($$invalidate(1, module), $$invalidate(0, state)), $$invalidate(3, $modules));
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    	};

    	$$self.$capture_state = () => ({
    		modules,
    		context,
    		ModuleMovement,
    		DeleteButton,
    		createNewId,
    		inputsAllHover,
    		unhover,
    		spring,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		gainNode,
    		currentInputs,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		$opacity,
    		$modules,
    		$context
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(4, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(5, deleteNode = $$props.deleteNode);
    		if ('gainNode' in $$props) $$invalidate(21, gainNode = $$props.gainNode);
    		if ('opacity' in $$props) $$invalidate(9, opacity = $$props.opacity);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*state, $modules*/ 9) {
    			state.inputIds.forEach((id, i) => {
    				if (id != null && $modules[id] != null) {
    					$$invalidate(1, module.inputs[i] = $modules[id], module);
    				}
    			});
    		}

    		if ($$self.$$.dirty & /*module, currentInputs*/ 1026) {
    			module.inputs.forEach((input, i) => {
    				if (input) {
    					if (currentInputs[i]) currentInputs[i].disconnect();
    					$$invalidate(10, currentInputs[i] = input.output, currentInputs);
    					currentInputs[i].connect(gainNode);
    				} else {
    					if (currentInputs[i]) currentInputs[i].disconnect();
    					$$invalidate(10, currentInputs[i] = null, currentInputs);
    				}
    			});
    		}

    		if ($$self.$$.dirty & /*moduleNode, $opacity*/ 2052) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		$modules,
    		controlsNode,
    		deleteNode,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		currentInputs,
    		$opacity,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
    		modulemovement_nodePos_binding,
    		mouseenter_handler,
    		mouseleave_handler,
    		select_change_handler,
    		main_binding
    	];
    }

    class Mixer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { state: 0 });

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

    const { Object: Object_1$1 } = globals;
    const file$1 = "src\\LFO.svelte";

    function create_fragment$1(ctx) {
    	let main;
    	let modulemovement;
    	let updating_moduleNode;
    	let updating_controlsNode;
    	let updating_deleteNode;
    	let updating_nodePos;
    	let t0;
    	let div2;
    	let div0;
    	let deletebutton;
    	let t1;
    	let h1;
    	let t2_value = /*module*/ ctx[1].state.id + "";
    	let t2;
    	let t3;
    	let h2;
    	let t5;
    	let div1;
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
    	let t17;
    	let br1;
    	let current;
    	let binding_group;
    	let mounted;
    	let dispose;

    	function modulemovement_moduleNode_binding(value) {
    		/*modulemovement_moduleNode_binding*/ ctx[12](value);
    	}

    	function modulemovement_controlsNode_binding(value) {
    		/*modulemovement_controlsNode_binding*/ ctx[13](value);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		/*modulemovement_deleteNode_binding*/ ctx[14](value);
    	}

    	function modulemovement_nodePos_binding(value) {
    		/*modulemovement_nodePos_binding*/ ctx[15](value);
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

    	modulemovement = new ModuleMovement({
    			props: modulemovement_props,
    			$$inline: true
    		});

    	binding_callbacks.push(() => bind(modulemovement, 'moduleNode', modulemovement_moduleNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'controlsNode', modulemovement_controlsNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'deleteNode', modulemovement_deleteNode_binding));
    	binding_callbacks.push(() => bind(modulemovement, 'nodePos', modulemovement_nodePos_binding));

    	deletebutton = new DeleteButton({
    			props: { module: /*module*/ ctx[1] },
    			$$inline: true
    		});

    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[18][0]);

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
    			h2 = element("h2");
    			h2.textContent = "LFO";
    			t5 = space();
    			div1 = element("div");
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
    			attr_dev(div0, "class", "delete svelte-p0do7j");
    			add_location(div0, file$1, 69, 8, 1745);
    			add_location(h1, file$1, 70, 8, 1827);
    			add_location(h2, file$1, 71, 8, 1863);
    			attr_dev(label0, "for", "freq");
    			add_location(label0, file$1, 73, 12, 1934);
    			attr_dev(input0, "id", "freq");
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0.1");
    			attr_dev(input0, "max", "20");
    			attr_dev(input0, "step", "0.01");
    			add_location(input0, file$1, 73, 88, 2010);
    			add_location(br0, file$1, 74, 12, 2121);
    			attr_dev(input1, "id", input1_id_value = 'sine' + /*module*/ ctx[1].state.id);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "sine";
    			input1.value = input1.__value;
    			attr_dev(input1, "class", "svelte-p0do7j");
    			add_location(input1, file$1, 75, 16, 2166);
    			attr_dev(label1, "for", label1_for_value = 'sine' + /*module*/ ctx[1].state.id);
    			attr_dev(label1, "class", "svelte-p0do7j");
    			add_location(label1, file$1, 75, 111, 2261);
    			attr_dev(input2, "id", input2_id_value = 'triangle' + /*module*/ ctx[1].state.id);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "triangle";
    			input2.value = input2.__value;
    			attr_dev(input2, "class", "svelte-p0do7j");
    			add_location(input2, file$1, 76, 16, 2327);
    			attr_dev(label2, "for", label2_for_value = 'triangle' + /*module*/ ctx[1].state.id);
    			attr_dev(label2, "class", "svelte-p0do7j");
    			add_location(label2, file$1, 76, 120, 2431);
    			attr_dev(input3, "id", input3_id_value = 'sawtooth' + /*module*/ ctx[1].state.id);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "sawtooth";
    			input3.value = input3.__value;
    			attr_dev(input3, "class", "svelte-p0do7j");
    			add_location(input3, file$1, 77, 16, 2505);
    			attr_dev(label3, "for", label3_for_value = 'sawtooth' + /*module*/ ctx[1].state.id);
    			attr_dev(label3, "class", "svelte-p0do7j");
    			add_location(label3, file$1, 77, 119, 2608);
    			attr_dev(input4, "id", input4_id_value = 'square' + /*module*/ ctx[1].state.id);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "square";
    			input4.value = input4.__value;
    			attr_dev(input4, "class", "svelte-p0do7j");
    			add_location(input4, file$1, 78, 16, 2682);
    			attr_dev(label4, "for", label4_for_value = 'square' + /*module*/ ctx[1].state.id);
    			attr_dev(label4, "class", "svelte-p0do7j");
    			add_location(label4, file$1, 78, 115, 2781);
    			attr_dev(section, "class", "shape svelte-p0do7j");
    			add_location(section, file$1, 74, 16, 2125);
    			attr_dev(div1, "id", "controls");
    			add_location(div1, file$1, 72, 8, 1885);
    			attr_dev(div2, "id", "module");
    			attr_dev(div2, "class", "svelte-p0do7j");
    			add_location(div2, file$1, 68, 4, 1704);
    			add_location(br1, file$1, 82, 4, 2891);
    			add_location(main, file$1, 66, 0, 1529);
    			binding_group.p(input1, input2, input3, input4);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
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
    			append_dev(div2, h2);
    			append_dev(div2, t5);
    			append_dev(div2, div1);
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
    			/*main_binding*/ ctx[22](main);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*setDelete*/ ctx[8].call(null, div0)),
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[16]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[16]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[17]),
    					listen_dev(input2, "change", /*input2_change_handler*/ ctx[19]),
    					listen_dev(input3, "change", /*input3_change_handler*/ ctx[20]),
    					listen_dev(input4, "change", /*input4_change_handler*/ ctx[21]),
    					action_destroyer(/*setControls*/ ctx[7].call(null, div1)),
    					action_destroyer(/*setModule*/ ctx[6].call(null, div2))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
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

    			if (!updating_deleteNode && dirty & /*deleteNode*/ 16) {
    				updating_deleteNode = true;
    				modulemovement_changes.deleteNode = /*deleteNode*/ ctx[4];
    				add_flush_callback(() => updating_deleteNode = false);
    			}

    			if (!updating_nodePos && dirty & /*state*/ 1) {
    				updating_nodePos = true;
    				modulemovement_changes.nodePos = /*state*/ ctx[0].position;
    				add_flush_callback(() => updating_nodePos = false);
    			}

    			modulemovement.$set(modulemovement_changes);
    			const deletebutton_changes = {};
    			if (dirty & /*module*/ 2) deletebutton_changes.module = /*module*/ ctx[1];
    			deletebutton.$set(deletebutton_changes);
    			if ((!current || dirty & /*module*/ 2) && t2_value !== (t2_value = /*module*/ ctx[1].state.id + "")) set_data_dev(t2, t2_value);
    			if ((!current || dirty & /*oscNode*/ 32) && t7_value !== (t7_value = /*oscNode*/ ctx[5].frequency.value.toFixed(1) + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*module*/ 2) {
    				set_input_value(input0, /*module*/ ctx[1].state.frequency);
    			}

    			if (!current || dirty & /*module*/ 2 && input1_id_value !== (input1_id_value = 'sine' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input1, "id", input1_id_value);
    			}

    			if (dirty & /*module*/ 2) {
    				input1.checked = input1.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (!current || dirty & /*module*/ 2 && label1_for_value !== (label1_for_value = 'sine' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label1, "for", label1_for_value);
    			}

    			if (!current || dirty & /*module*/ 2 && input2_id_value !== (input2_id_value = 'triangle' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input2, "id", input2_id_value);
    			}

    			if (dirty & /*module*/ 2) {
    				input2.checked = input2.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (!current || dirty & /*module*/ 2 && label2_for_value !== (label2_for_value = 'triangle' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label2, "for", label2_for_value);
    			}

    			if (!current || dirty & /*module*/ 2 && input3_id_value !== (input3_id_value = 'sawtooth' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input3, "id", input3_id_value);
    			}

    			if (dirty & /*module*/ 2) {
    				input3.checked = input3.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (!current || dirty & /*module*/ 2 && label3_for_value !== (label3_for_value = 'sawtooth' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label3, "for", label3_for_value);
    			}

    			if (!current || dirty & /*module*/ 2 && input4_id_value !== (input4_id_value = 'square' + /*module*/ ctx[1].state.id)) {
    				attr_dev(input4, "id", input4_id_value);
    			}

    			if (dirty & /*module*/ 2) {
    				input4.checked = input4.__value === /*module*/ ctx[1].state.shape;
    			}

    			if (!current || dirty & /*module*/ 2 && label4_for_value !== (label4_for_value = 'square' + /*module*/ ctx[1].state.id)) {
    				attr_dev(label4, "for", label4_for_value);
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
    			/*main_binding*/ ctx[22](null);
    			binding_group.r();
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
    	let $opacity;
    	let $context;
    	let $modules;
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(23, $context = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(24, $modules = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('LFO', slots, []);

    	let { state = {
    		type: 'lfo',
    		frequency: 1,
    		shape: 'sine',
    		id: createNewId()
    	} } = $$props;

    	set_store_value(modules, $modules[state.id] = {}, $modules);
    	const module = $modules[state.id];
    	module.state = state;
    	module.inputs = {};
    	let moduleNode;
    	let controlsNode;
    	let deleteNode;
    	let oscNode = $context.createOscillator();
    	let gainNode = $context.createGain();
    	oscNode.start(0);
    	oscNode.connect(gainNode);

    	function setModule(node) {
    		$$invalidate(2, moduleNode = node);
    	}

    	function setControls(node) {
    		$$invalidate(3, controlsNode = node);
    	}

    	function setDelete(node) {
    		$$invalidate(4, deleteNode = node);
    	}

    	let opacity = spring(1, { stiffness: 0.3, damping: 0.3 });
    	validate_store(opacity, 'opacity');
    	component_subscribe($$self, opacity, value => $$invalidate(11, $opacity = value));

    	module.fade = () => {
    		opacity.set(0.3);
    	};

    	module.unfade = () => {
    		opacity.set(1);
    	};

    	const writable_props = ['state'];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<LFO> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function modulemovement_moduleNode_binding(value) {
    		moduleNode = value;
    		($$invalidate(2, moduleNode), $$invalidate(11, $opacity));
    	}

    	function modulemovement_controlsNode_binding(value) {
    		controlsNode = value;
    		$$invalidate(3, controlsNode);
    	}

    	function modulemovement_deleteNode_binding(value) {
    		deleteNode = value;
    		$$invalidate(4, deleteNode);
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
    		ModuleMovement,
    		DeleteButton,
    		createNewId,
    		spring,
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		oscNode,
    		gainNode,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		$opacity,
    		$context,
    		$modules
    	});

    	$$self.$inject_state = $$props => {
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('moduleNode' in $$props) $$invalidate(2, moduleNode = $$props.moduleNode);
    		if ('controlsNode' in $$props) $$invalidate(3, controlsNode = $$props.controlsNode);
    		if ('deleteNode' in $$props) $$invalidate(4, deleteNode = $$props.deleteNode);
    		if ('oscNode' in $$props) $$invalidate(5, oscNode = $$props.oscNode);
    		if ('gainNode' in $$props) $$invalidate(10, gainNode = $$props.gainNode);
    		if ('opacity' in $$props) $$invalidate(9, opacity = $$props.opacity);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*module*/ 2) {
    			$$invalidate(5, oscNode.frequency.value = module.state.frequency, oscNode);
    		}

    		if ($$self.$$.dirty & /*module*/ 2) {
    			$$invalidate(5, oscNode.type = module.state.shape, oscNode);
    		}

    		if ($$self.$$.dirty & /*module, gainNode*/ 1026) {
    			if (module.inputs) Object.values(module.inputs).forEach(input => {
    				$$invalidate(10, gainNode.gain.value = input.max_cv, gainNode);
    				gainNode.connect(input.cv);
    			});
    		}

    		if ($$self.$$.dirty & /*moduleNode, $opacity*/ 2052) {
    			if (moduleNode) $$invalidate(2, moduleNode.style.opacity = `${$opacity}`, moduleNode);
    		}
    	};

    	return [
    		state,
    		module,
    		moduleNode,
    		controlsNode,
    		deleteNode,
    		oscNode,
    		setModule,
    		setControls,
    		setDelete,
    		opacity,
    		gainNode,
    		$opacity,
    		modulemovement_moduleNode_binding,
    		modulemovement_controlsNode_binding,
    		modulemovement_deleteNode_binding,
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

    class LFO extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { state: 0 });

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
    	child_ctx[17] = list[i];
    	return child_ctx;
    }

    // (175:1) {#each mods as m}
    function create_each_block(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*m*/ ctx[17].props];
    	var switch_value = /*m*/ ctx[17].type;

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
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*m*/ ctx[17].props)])
    			: {};

    			if (dirty & /*mods*/ 1 && switch_value !== (switch_value = /*m*/ ctx[17].type)) {
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
    	let button7;
    	let t15;
    	let button8;
    	let t17;
    	let midi;
    	let t18;
    	let output_1;
    	let t19;
    	let div1;
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
    			div1 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(button0, "class", "svelte-1kr57ov");
    			add_location(button0, file, 161, 2, 3219);
    			attr_dev(button1, "class", "svelte-1kr57ov");
    			add_location(button1, file, 162, 2, 3266);
    			attr_dev(button2, "class", "svelte-1kr57ov");
    			add_location(button2, file, 163, 2, 3313);
    			attr_dev(button3, "class", "svelte-1kr57ov");
    			add_location(button3, file, 164, 2, 3380);
    			attr_dev(button4, "class", "svelte-1kr57ov");
    			add_location(button4, file, 165, 2, 3446);
    			attr_dev(button5, "class", "svelte-1kr57ov");
    			add_location(button5, file, 166, 2, 3509);
    			attr_dev(button6, "class", "svelte-1kr57ov");
    			add_location(button6, file, 167, 2, 3575);
    			attr_dev(button7, "class", "svelte-1kr57ov");
    			add_location(button7, file, 168, 2, 3639);
    			attr_dev(button8, "class", "svelte-1kr57ov");
    			add_location(button8, file, 169, 2, 3699);
    			attr_dev(div0, "class", "menu svelte-1kr57ov");
    			add_location(div0, file, 160, 1, 3197);
    			attr_dev(div1, "class", "modules svelte-1kr57ov");
    			add_location(div1, file, 173, 1, 3782);
    			attr_dev(main, "class", "svelte-1kr57ov");
    			add_location(main, file, 159, 0, 3188);
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
    			append_dev(div0, button7);
    			append_dev(div0, t15);
    			append_dev(div0, button8);
    			append_dev(div0, t17);
    			mount_component(midi, div0, null);
    			append_dev(div0, t18);
    			mount_component(output_1, div0, null);
    			append_dev(main, t19);
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
    					listen_dev(button2, "click", /*click_handler*/ ctx[5], false, false, false, false),
    					listen_dev(button3, "click", /*click_handler_1*/ ctx[6], false, false, false, false),
    					listen_dev(button4, "click", /*click_handler_2*/ ctx[7], false, false, false, false),
    					listen_dev(button5, "click", /*click_handler_3*/ ctx[8], false, false, false, false),
    					listen_dev(button6, "click", /*click_handler_4*/ ctx[9], false, false, false, false),
    					listen_dev(button7, "click", /*click_handler_5*/ ctx[10], false, false, false, false),
    					listen_dev(button8, "click", /*clear*/ ctx[4], false, false, false, false)
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
    			if (detaching) detach_dev(main);
    			destroy_component(midi);
    			destroy_component(output_1);
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

    const DEBUG = false;

    function instance($$self, $$props, $$invalidate) {
    	let $output;
    	let $modules;
    	let $context;
    	validate_store(output, 'output');
    	component_subscribe($$self, output, $$value => $$invalidate(11, $output = $$value));
    	validate_store(modules, 'modules');
    	component_subscribe($$self, modules, $$value => $$invalidate(12, $modules = $$value));
    	validate_store(context, 'context');
    	component_subscribe($$self, context, $$value => $$invalidate(13, $context = $$value));
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

    	const debugPatch = [
    		{
    			"type": "vco",
    			"frequency": 0,
    			"shape": "sine",
    			"id": 0,
    			"position": { "x": 308, "y": 102 }
    		},
    		{
    			"type": "vca",
    			"gain": 1,
    			"id": 1,
    			"inputId": null,
    			"cvId": null,
    			"position": { "x": 659, "y": 81 }
    		},
    		{
    			"type": "vcf",
    			"voct": 14.1357092861044,
    			"filterType": "lowpass",
    			"id": 2,
    			"inputId": null,
    			"cvId": null,
    			"position": { "x": 993, "y": 58 }
    		},
    		{
    			"type": "adsr",
    			"attack": 0.1,
    			"decay": 0.1,
    			"sustain": 0.5,
    			"release": 0.1,
    			"id": 3,
    			"position": { "x": 327, "y": 537 }
    		},
    		{
    			"type": "mixer",
    			"id": 4,
    			"inputIds": [null, null, null, null],
    			"position": { "x": 837, "y": 553 }
    		}
    	];
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
