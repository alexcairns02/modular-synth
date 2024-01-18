
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
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
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

    /*
    Usage - convert svelte app to web component
    import component from "svelte-tag"
    new component({component:App,tagname:"hello-world",href="/your/stylesheet.css",attributes:["name"]})
    */

    function createSlots(slots) {
      const svelteSlots = {};
      for (const slotName in slots) {
        svelteSlots[slotName] = [createSlotFn(slots[slotName])];
      }
      function createSlotFn(element) {
        return function() {
          return {
            c: noop,
            m: function mount(target, anchor) {
              insert(target, element.cloneNode(true), anchor); 
            },
            d: function destroy(detaching) { 
              if (detaching && element.innerHTML){ 
                detach(element);
              } 
            },
            l: noop,
          };
        }
      }
      return svelteSlots;
    }

    function Component(opts){
      class Wrapper extends HTMLElement{

        constructor() {
          super();
          this.slotcount = 0;
          let root = opts.shadow ? this.attachShadow({ mode: 'open' }) : this;
          // link generated style
          if(opts.href && opts.shadow){
            let link = document.createElement('link');
            link.setAttribute("href",opts.href);
            link.setAttribute("rel","stylesheet");
            root.appendChild(link);    
          }
          if(opts.shadow){
            this._root = document.createElement('div');
            root.appendChild(this._root);
          }else {
            this._root = root;
          }
        }

        static get observedAttributes() {
          return opts.attributes || []
        }

        connectedCallback(){
          let props = opts.defaults ? opts.defaults : {};
          let slots;
          props.$$scope = {};
          Array.from(this.attributes).forEach( attr => props[attr.name] = attr.value );
          props.$$scope = {};
          if(opts.shadow){
            slots = this.getShadowSlots();
            let props = opts.defaults ? opts.defaults : {};
            props.$$scope = {};
            this.observer = new MutationObserver(this.processMutations.bind(this,{root:this._root,props}));
            this.observer.observe(this,{childList: true, subtree: true, attributes: false});
          }else {
            slots = this.getSlots();
          }
          this.slotcount = Object.keys(slots).length;
          props.$$slots = createSlots(slots);
          this.elem = new opts.component({	target: this._root,	props});
        }

        disconnectedCallback(){
          if(this.observe){
            this.observer.disconnect();
          }
          try{ this.elem.$destroy();}catch(err){} // detroy svelte element when removed from dom
        }
        
        unwrap(from){
          let node = document.createDocumentFragment();
          while (from.firstChild) {
            node.appendChild(from.removeChild(from.firstChild));
          }
          return node
        }

        getSlots(){
          const namedSlots = this.querySelectorAll('[slot]');
          let slots = {};
          namedSlots.forEach(n=>{
            slots[n.slot] = this.unwrap(n);
            this.removeChild(n);
          });
          if(this.innerHTML.length){
            slots.default = this.unwrap(this);
            this.innerHTML = "";
          }
          return slots
        }

        getShadowSlots(){
          const namedSlots = this.querySelectorAll('[slot]');
          let slots = {};
          let htmlLength = this.innerHTML.length;
          namedSlots.forEach(n=>{
            slots[n.slot] = document.createElement("slot");
            slots[n.slot].setAttribute("name",n.slot);
            htmlLength-=n.outerHTML.length;
          });
          if(htmlLength>0){
            slots.default = document.createElement("slot");
          }
          return slots
        }

        processMutations({root,props},mutations){
          for(let mutation of mutations){
            if(mutation.type=="childList"){
              let slots = this.getShadowSlots();
              if(Object.keys(slots).length){
                props.$$slots = createSlots(slots);
                this.elem.$set({"$$slots":createSlots(slots)});
                // do full re-render on slot count change - needed for tabs component
                if(this.slotcount != Object.keys(slots).length){
                  Array.from(this.attributes).forEach( attr => props[attr.name] = attr.value );
                  this.slotcount = Object.keys(slots).length;
                  root.innerHTML = "";
                  this.elem = new opts.component({	target: root,	props});
                }
              }
            }
          }
        }

        attributeChangedCallback(name, oldValue, newValue) {
          if(this.elem && newValue!=oldValue){
            this.elem.$set({[name]:newValue});
          }
        }
      }  
      window.customElements.define(opts.tagname, Wrapper);
    }

    /* src\MIDI.svelte generated by Svelte v3.59.2 */
    const file$6 = "src\\MIDI.svelte";

    function create_fragment$6(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let br;
    	let t2;
    	let h3;
    	let t3;
    	let t4_value = /*newOct*/ ctx[0] + /*newoctUp*/ ctx[2] + "";
    	let t4;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "MIDI";
    			t1 = text("\r\n    Play notes by pressing keys on keyboard. Row Z-/ is white notes, row A-' is black notes.\r\n    ");
    			br = element("br");
    			t2 = text("Press - to lower octave and = to raise octave. Press space to trigger envelope without giving note input.\r\n    ");
    			h3 = element("h3");
    			t3 = text(/*note*/ ctx[1]);
    			t4 = text(t4_value);
    			add_location(h2, file$6, 161, 4, 4372);
    			add_location(br, file$6, 163, 4, 4485);
    			add_location(h3, file$6, 164, 4, 4600);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$6, 160, 0, 4361);
    			add_location(main, file$6, 159, 0, 4353);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, br);
    			append_dev(div, t2);
    			append_dev(div, h3);
    			append_dev(h3, t3);
    			append_dev(h3, t4);

    			if (!mounted) {
    				dispose = listen_dev(window, "keydown", prevent_default(/*onKeyDown*/ ctx[3]), false, true, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*note*/ 2) set_data_dev(t3, /*note*/ ctx[1]);
    			if (dirty & /*newOct, newoctUp*/ 5 && t4_value !== (t4_value = /*newOct*/ ctx[0] + /*newoctUp*/ ctx[2] + "")) set_data_dev(t4, t4_value);
    		},
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
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('MIDI', slots, []);
    	const dispatch = createEventDispatcher();
    	let trigger = false;
    	let freqChanged = false;
    	let octave = 4;
    	let newOct = 4;
    	let note = 'A';
    	let octUp = 0;
    	let newoctUp = 0;
    	let frequency = 440;
    	const handle = () => dispatch('input', { output: Math.log2(frequency), trigger });

    	function onKeyDown(e) {
    		if (e.repeat) return;
    		freqChanged = false;
    		octUp = 0;

    		switch (e.keyCode) {
    			case 61:
    				//=
    				if (octave < 10) {
    					octave += 1;
    					frequency *= 2;
    				}
    				break;
    			case 173:
    				//-
    				if (octave > -2) {
    					octave -= 1;
    					frequency /= 2;
    				}
    				break;
    			case 90:
    				//Z
    				frequency = 261.63;
    				freqChanged = true;
    				$$invalidate(1, note = 'C');
    				break;
    			case 83:
    				//S
    				frequency = 277.18;
    				freqChanged = true;
    				$$invalidate(1, note = 'C#/Db');
    				break;
    			case 88:
    				//X
    				frequency = 293.66;
    				freqChanged = true;
    				$$invalidate(1, note = 'D');
    				break;
    			case 68:
    				//D
    				frequency = 311.13;
    				freqChanged = true;
    				$$invalidate(1, note = 'D#/Eb');
    				break;
    			case 67:
    				//C
    				frequency = 329.63;
    				freqChanged = true;
    				$$invalidate(1, note = 'E');
    				break;
    			case 86:
    				//V
    				frequency = 349.23;
    				freqChanged = true;
    				$$invalidate(1, note = 'F');
    				break;
    			case 71:
    				//G
    				frequency = 369.99;
    				freqChanged = true;
    				$$invalidate(1, note = 'F#/Gb');
    				break;
    			case 66:
    				//B
    				frequency = 392.00;
    				freqChanged = true;
    				$$invalidate(1, note = 'G');
    				break;
    			case 72:
    				//H
    				frequency = 415.30;
    				freqChanged = true;
    				$$invalidate(1, note = 'G#/Ab');
    				break;
    			case 78:
    				//N
    				frequency = 440.00;
    				freqChanged = true;
    				$$invalidate(1, note = 'A');
    				break;
    			case 74:
    				//J
    				frequency = 466.16;
    				freqChanged = true;
    				$$invalidate(1, note = 'A#/Bb');
    				break;
    			case 77:
    				//M
    				frequency = 493.88;
    				freqChanged = true;
    				$$invalidate(1, note = 'B');
    				break;
    			case 188:
    				//,
    				frequency = 523.25;
    				freqChanged = true;
    				$$invalidate(1, note = 'C');
    				octUp = 1;
    				break;
    			case 76:
    				//L
    				frequency = 554.37;
    				freqChanged = true;
    				$$invalidate(1, note = 'C#/Db');
    				octUp = 1;
    				break;
    			case 190:
    				//.
    				frequency = 587.33;
    				freqChanged = true;
    				$$invalidate(1, note = 'D');
    				octUp = 1;
    				break;
    			case 59:
    				//;
    				frequency = 622.25;
    				freqChanged = true;
    				$$invalidate(1, note = 'D#/Eb');
    				octUp = 1;
    				break;
    			case 191:
    				///
    				frequency = 659.25;
    				freqChanged = true;
    				$$invalidate(1, note = 'E');
    				octUp = 1;
    				break;
    			case 32:
    				//Space
    				trigger = !trigger;
    				dispatch('signal', {
    					output: null, //C4
    					//D4
    					//E4
    					trigger
    				});
    				return;
    		}

    		if (freqChanged) {
    			if (octave > 4) {
    				for (let i = 4; i < octave; i++) {
    					frequency *= 2;
    				}
    			} else {
    				for (let i = 4; i > octave; i--) {
    					frequency /= 2;
    				}
    			}

    			trigger = !trigger;
    			$$invalidate(0, newOct = octave);
    			$$invalidate(2, newoctUp = octUp);
    		}

    		handle();
    	}

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<MIDI> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		dispatch,
    		trigger,
    		freqChanged,
    		octave,
    		newOct,
    		note,
    		octUp,
    		newoctUp,
    		frequency,
    		handle,
    		onKeyDown
    	});

    	$$self.$inject_state = $$props => {
    		if ('trigger' in $$props) trigger = $$props.trigger;
    		if ('freqChanged' in $$props) freqChanged = $$props.freqChanged;
    		if ('octave' in $$props) octave = $$props.octave;
    		if ('newOct' in $$props) $$invalidate(0, newOct = $$props.newOct);
    		if ('note' in $$props) $$invalidate(1, note = $$props.note);
    		if ('octUp' in $$props) octUp = $$props.octUp;
    		if ('newoctUp' in $$props) $$invalidate(2, newoctUp = $$props.newoctUp);
    		if ('frequency' in $$props) frequency = $$props.frequency;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [newOct, note, newoctUp, onKeyDown];
    }

    class MIDI extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "MIDI",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\VCO.svelte generated by Svelte v3.59.2 */
    const file$5 = "src\\VCO.svelte";

    function create_fragment$5(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let label0;
    	let input0;
    	let t2;
    	let t3;
    	let section;
    	let label1;
    	let input1;
    	let t4;
    	let t5;
    	let label2;
    	let input2;
    	let t6;
    	let t7;
    	let label3;
    	let input3;
    	let t8;
    	let t9;
    	let label4;
    	let input4;
    	let t10;
    	let binding_group;
    	let mounted;
    	let dispose;
    	binding_group = init_binding_group(/*$$binding_groups*/ ctx[7][0]);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Oscillator";
    			t1 = space();
    			label0 = element("label");
    			input0 = element("input");
    			t2 = text("Frequency");
    			t3 = space();
    			section = element("section");
    			label1 = element("label");
    			input1 = element("input");
    			t4 = text(" Sine");
    			t5 = space();
    			label2 = element("label");
    			input2 = element("input");
    			t6 = text(" Triangle");
    			t7 = space();
    			label3 = element("label");
    			input3 = element("input");
    			t8 = text(" Sawtooth");
    			t9 = space();
    			label4 = element("label");
    			input4 = element("input");
    			t10 = text(" Square");
    			add_location(h2, file$5, 23, 4, 464);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "2.78135971352466");
    			attr_dev(input0, "max", "14.78135971352466");
    			attr_dev(input0, "step", "0.0001");
    			add_location(input0, file$5, 24, 11, 496);
    			add_location(label0, file$5, 24, 4, 489);
    			attr_dev(input1, "type", "radio");
    			input1.__value = "sine";
    			input1.value = input1.__value;
    			add_location(input1, file$5, 27, 12, 658);
    			add_location(label1, file$5, 26, 8, 637);
    			attr_dev(input2, "type", "radio");
    			input2.__value = "triangle";
    			input2.value = input2.__value;
    			add_location(input2, file$5, 30, 12, 773);
    			add_location(label2, file$5, 29, 8, 752);
    			attr_dev(input3, "type", "radio");
    			input3.__value = "sawtooth";
    			input3.value = input3.__value;
    			add_location(input3, file$5, 33, 12, 896);
    			add_location(label3, file$5, 32, 8, 875);
    			attr_dev(input4, "type", "radio");
    			input4.__value = "square";
    			input4.value = input4.__value;
    			add_location(input4, file$5, 36, 12, 1019);
    			add_location(label4, file$5, 35, 8, 998);
    			add_location(section, file$5, 25, 4, 618);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$5, 22, 0, 453);
    			add_location(main, file$5, 21, 0, 445);
    			binding_group.p(input1, input2, input3, input4);
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
    			append_dev(label0, input0);
    			set_input_value(input0, /*voct*/ ctx[0]);
    			append_dev(label0, t2);
    			append_dev(div, t3);
    			append_dev(div, section);
    			append_dev(section, label1);
    			append_dev(label1, input1);
    			input1.checked = input1.__value === /*oscNode*/ ctx[1].type;
    			append_dev(label1, t4);
    			append_dev(section, t5);
    			append_dev(section, label2);
    			append_dev(label2, input2);
    			input2.checked = input2.__value === /*oscNode*/ ctx[1].type;
    			append_dev(label2, t6);
    			append_dev(section, t7);
    			append_dev(section, label3);
    			append_dev(label3, input3);
    			input3.checked = input3.__value === /*oscNode*/ ctx[1].type;
    			append_dev(label3, t8);
    			append_dev(section, t9);
    			append_dev(section, label4);
    			append_dev(label4, input4);
    			input4.checked = input4.__value === /*oscNode*/ ctx[1].type;
    			append_dev(label4, t10);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*handle*/ ctx[2].call(null, window)),
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
    			if (dirty & /*voct*/ 1) {
    				set_input_value(input0, /*voct*/ ctx[0]);
    			}

    			if (dirty & /*oscNode*/ 2) {
    				input1.checked = input1.__value === /*oscNode*/ ctx[1].type;
    			}

    			if (dirty & /*oscNode*/ 2) {
    				input2.checked = input2.__value === /*oscNode*/ ctx[1].type;
    			}

    			if (dirty & /*oscNode*/ 2) {
    				input3.checked = input3.__value === /*oscNode*/ ctx[1].type;
    			}

    			if (dirty & /*oscNode*/ 2) {
    				input4.checked = input4.__value === /*oscNode*/ ctx[1].type;
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
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCO', slots, []);
    	let { ctx } = $$props;
    	let { voctIn } = $$props;
    	const dispatch = createEventDispatcher();
    	let voct = Math.log2(440);
    	let oscNode = ctx.createOscillator();
    	oscNode.start(0);
    	const handle = () => dispatch('connect', { output: oscNode });

    	$$self.$$.on_mount.push(function () {
    		if (ctx === undefined && !('ctx' in $$props || $$self.$$.bound[$$self.$$.props['ctx']])) {
    			console.warn("<VCO> was created without expected prop 'ctx'");
    		}

    		if (voctIn === undefined && !('voctIn' in $$props || $$self.$$.bound[$$self.$$.props['voctIn']])) {
    			console.warn("<VCO> was created without expected prop 'voctIn'");
    		}
    	});

    	const writable_props = ['ctx', 'voctIn'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCO> was created with unknown prop '${key}'`);
    	});

    	const $$binding_groups = [[]];

    	function input0_change_input_handler() {
    		voct = to_number(this.value);
    		($$invalidate(0, voct), $$invalidate(4, voctIn));
    	}

    	function input1_change_handler() {
    		oscNode.type = this.__value;
    		(($$invalidate(1, oscNode), $$invalidate(0, voct)), $$invalidate(4, voctIn));
    	}

    	function input2_change_handler() {
    		oscNode.type = this.__value;
    		(($$invalidate(1, oscNode), $$invalidate(0, voct)), $$invalidate(4, voctIn));
    	}

    	function input3_change_handler() {
    		oscNode.type = this.__value;
    		(($$invalidate(1, oscNode), $$invalidate(0, voct)), $$invalidate(4, voctIn));
    	}

    	function input4_change_handler() {
    		oscNode.type = this.__value;
    		(($$invalidate(1, oscNode), $$invalidate(0, voct)), $$invalidate(4, voctIn));
    	}

    	$$self.$$set = $$props => {
    		if ('ctx' in $$props) $$invalidate(3, ctx = $$props.ctx);
    		if ('voctIn' in $$props) $$invalidate(4, voctIn = $$props.voctIn);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		ctx,
    		voctIn,
    		dispatch,
    		voct,
    		oscNode,
    		handle
    	});

    	$$self.$inject_state = $$props => {
    		if ('ctx' in $$props) $$invalidate(3, ctx = $$props.ctx);
    		if ('voctIn' in $$props) $$invalidate(4, voctIn = $$props.voctIn);
    		if ('voct' in $$props) $$invalidate(0, voct = $$props.voct);
    		if ('oscNode' in $$props) $$invalidate(1, oscNode = $$props.oscNode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*voctIn*/ 16) {
    			if (voctIn != null) $$invalidate(0, voct = voctIn);
    		}

    		if ($$self.$$.dirty & /*voct*/ 1) {
    			$$invalidate(1, oscNode.frequency.value = Math.pow(2, voct), oscNode);
    		}
    	};

    	return [
    		voct,
    		oscNode,
    		handle,
    		ctx,
    		voctIn,
    		input0_change_input_handler,
    		input1_change_handler,
    		$$binding_groups,
    		input2_change_handler,
    		input3_change_handler,
    		input4_change_handler
    	];
    }

    class VCO extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, { ctx: 3, voctIn: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCO",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get ctx() {
    		throw new Error("<VCO>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ctx(value) {
    		throw new Error("<VCO>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get voctIn() {
    		throw new Error("<VCO>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set voctIn(value) {
    		throw new Error("<VCO>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Output.svelte generated by Svelte v3.59.2 */

    const file$4 = "src\\Output.svelte";

    function create_fragment$4(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let label;
    	let input_1;
    	let t2;
    	let t3;
    	let button;
    	let t4;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Output";
    			t1 = space();
    			label = element("label");
    			input_1 = element("input");
    			t2 = text("Gain");
    			t3 = space();
    			button = element("button");
    			t4 = text(/*muteUnmute*/ ctx[1]);
    			add_location(h2, file$4, 30, 8, 583);
    			attr_dev(input_1, "type", "range");
    			attr_dev(input_1, "min", "0");
    			attr_dev(input_1, "max", "2");
    			attr_dev(input_1, "step", "0.001");
    			add_location(input_1, file$4, 31, 15, 615);
    			add_location(label, file$4, 31, 8, 608);
    			add_location(button, file$4, 32, 8, 719);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$4, 29, 4, 568);
    			add_location(main, file$4, 28, 0, 556);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, label);
    			append_dev(label, input_1);
    			set_input_value(input_1, /*gainNode*/ ctx[0].gain.value);
    			append_dev(label, t2);
    			append_dev(div, t3);
    			append_dev(div, button);
    			append_dev(button, t4);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input_1, "change", /*input_1_change_input_handler*/ ctx[5]),
    					listen_dev(input_1, "input", /*input_1_change_input_handler*/ ctx[5]),
    					listen_dev(button, "click", /*toggleMute*/ ctx[2], false, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*gainNode*/ 1) {
    				set_input_value(input_1, /*gainNode*/ ctx[0].gain.value);
    			}

    			if (dirty & /*muteUnmute*/ 2) set_data_dev(t4, /*muteUnmute*/ ctx[1]);
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
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Output', slots, []);
    	let { ctx } = $$props;
    	let { input } = $$props;
    	var gainNode = ctx.createGain();
    	var playing = false;
    	var muteUnmute = 'Unmute';

    	function toggleMute() {
    		if (playing) {
    			playing = false;
    			$$invalidate(1, muteUnmute = 'Unmute');
    			ctx.suspend();
    		} else {
    			playing = true;
    			$$invalidate(1, muteUnmute = 'Mute');
    			ctx.resume();
    		}
    	}

    	$$self.$$.on_mount.push(function () {
    		if (ctx === undefined && !('ctx' in $$props || $$self.$$.bound[$$self.$$.props['ctx']])) {
    			console.warn("<Output> was created without expected prop 'ctx'");
    		}

    		if (input === undefined && !('input' in $$props || $$self.$$.bound[$$self.$$.props['input']])) {
    			console.warn("<Output> was created without expected prop 'input'");
    		}
    	});

    	const writable_props = ['ctx', 'input'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Output> was created with unknown prop '${key}'`);
    	});

    	function input_1_change_input_handler() {
    		gainNode.gain.value = to_number(this.value);
    		$$invalidate(0, gainNode);
    	}

    	$$self.$$set = $$props => {
    		if ('ctx' in $$props) $$invalidate(3, ctx = $$props.ctx);
    		if ('input' in $$props) $$invalidate(4, input = $$props.input);
    	};

    	$$self.$capture_state = () => ({
    		ctx,
    		input,
    		gainNode,
    		playing,
    		muteUnmute,
    		toggleMute
    	});

    	$$self.$inject_state = $$props => {
    		if ('ctx' in $$props) $$invalidate(3, ctx = $$props.ctx);
    		if ('input' in $$props) $$invalidate(4, input = $$props.input);
    		if ('gainNode' in $$props) $$invalidate(0, gainNode = $$props.gainNode);
    		if ('playing' in $$props) playing = $$props.playing;
    		if ('muteUnmute' in $$props) $$invalidate(1, muteUnmute = $$props.muteUnmute);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*input, gainNode, ctx*/ 25) {
    			if (input) {
    				input.connect(gainNode);
    				gainNode.connect(ctx.destination);
    			}
    		}
    	};

    	return [gainNode, muteUnmute, toggleMute, ctx, input, input_1_change_input_handler];
    }

    class Output extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { ctx: 3, input: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Output",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get ctx() {
    		throw new Error("<Output>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ctx(value) {
    		throw new Error("<Output>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get input() {
    		throw new Error("<Output>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<Output>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\VCA.svelte generated by Svelte v3.59.2 */
    const file$3 = "src\\VCA.svelte";

    function create_fragment$3(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let label;
    	let input_1;
    	let t2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Amplifier";
    			t1 = space();
    			label = element("label");
    			input_1 = element("input");
    			t2 = text("Gain");
    			add_location(h2, file$3, 21, 4, 484);
    			attr_dev(input_1, "type", "range");
    			attr_dev(input_1, "min", "0");
    			attr_dev(input_1, "max", "1");
    			attr_dev(input_1, "step", "0.001");
    			add_location(input_1, file$3, 22, 11, 515);
    			add_location(label, file$3, 22, 4, 508);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$3, 20, 0, 473);
    			add_location(main, file$3, 19, 0, 465);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, label);
    			append_dev(label, input_1);
    			set_input_value(input_1, /*max_cv*/ ctx[0].value);
    			append_dev(label, t2);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*handle*/ ctx[1].call(null, window)),
    					listen_dev(input_1, "change", /*input_1_change_input_handler*/ ctx[4]),
    					listen_dev(input_1, "input", /*input_1_change_input_handler*/ ctx[4])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*max_cv*/ 1) {
    				set_input_value(input_1, /*max_cv*/ ctx[0].value);
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCA', slots, []);
    	let { ctx } = $$props;
    	let { input } = $$props;
    	let max_cv = { value: 1 };
    	const dispatch = createEventDispatcher();
    	var gainNode = ctx.createGain();

    	const handle = () => dispatch('connect', {
    		output: gainNode,
    		cv_in: gainNode.gain,
    		max_cv
    	});

    	$$self.$$.on_mount.push(function () {
    		if (ctx === undefined && !('ctx' in $$props || $$self.$$.bound[$$self.$$.props['ctx']])) {
    			console.warn("<VCA> was created without expected prop 'ctx'");
    		}

    		if (input === undefined && !('input' in $$props || $$self.$$.bound[$$self.$$.props['input']])) {
    			console.warn("<VCA> was created without expected prop 'input'");
    		}
    	});

    	const writable_props = ['ctx', 'input'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCA> was created with unknown prop '${key}'`);
    	});

    	function input_1_change_input_handler() {
    		max_cv.value = to_number(this.value);
    		$$invalidate(0, max_cv);
    	}

    	$$self.$$set = $$props => {
    		if ('ctx' in $$props) $$invalidate(2, ctx = $$props.ctx);
    		if ('input' in $$props) $$invalidate(3, input = $$props.input);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		ctx,
    		input,
    		max_cv,
    		dispatch,
    		gainNode,
    		handle
    	});

    	$$self.$inject_state = $$props => {
    		if ('ctx' in $$props) $$invalidate(2, ctx = $$props.ctx);
    		if ('input' in $$props) $$invalidate(3, input = $$props.input);
    		if ('max_cv' in $$props) $$invalidate(0, max_cv = $$props.max_cv);
    		if ('gainNode' in $$props) $$invalidate(6, gainNode = $$props.gainNode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*max_cv, ctx*/ 5) {
    			gainNode.gain.setValueAtTime(max_cv.value, ctx.currentTime);
    		}

    		if ($$self.$$.dirty & /*input*/ 8) {
    			if (input) input.connect(gainNode);
    		}
    	};

    	return [max_cv, handle, ctx, input, input_1_change_input_handler];
    }

    class VCA extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { ctx: 2, input: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCA",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get ctx() {
    		throw new Error("<VCA>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ctx(value) {
    		throw new Error("<VCA>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get input() {
    		throw new Error("<VCA>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<VCA>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\ADSR.svelte generated by Svelte v3.59.2 */
    const file$2 = "src\\ADSR.svelte";

    function create_fragment$2(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let label0;
    	let input0;
    	let t2;
    	let t3;
    	let label1;
    	let input1;
    	let t4;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Envelope";
    			t1 = space();
    			label0 = element("label");
    			input0 = element("input");
    			t2 = text("Attack");
    			t3 = space();
    			label1 = element("label");
    			input1 = element("input");
    			t4 = text("Release");
    			add_location(h2, file$2, 34, 8, 824);
    			attr_dev(input0, "type", "range");
    			attr_dev(input0, "min", "0");
    			attr_dev(input0, "max", "1");
    			attr_dev(input0, "step", "0.001");
    			add_location(input0, file$2, 35, 15, 858);
    			add_location(label0, file$2, 35, 8, 851);
    			attr_dev(input1, "type", "range");
    			attr_dev(input1, "min", "0");
    			attr_dev(input1, "max", "1");
    			attr_dev(input1, "step", "0.001");
    			add_location(input1, file$2, 38, 15, 1172);
    			add_location(label1, file$2, 38, 8, 1165);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$2, 33, 4, 809);
    			add_location(main, file$2, 32, 0, 797);
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
    			append_dev(label0, input0);
    			set_input_value(input0, /*attack*/ ctx[0]);
    			append_dev(label0, t2);
    			append_dev(div, t3);
    			append_dev(div, label1);
    			append_dev(label1, input1);
    			set_input_value(input1, /*release*/ ctx[1]);
    			append_dev(label1, t4);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_input_handler*/ ctx[6]),
    					listen_dev(input0, "input", /*input0_change_input_handler*/ ctx[6]),
    					listen_dev(input1, "change", /*input1_change_input_handler*/ ctx[7]),
    					listen_dev(input1, "input", /*input1_change_input_handler*/ ctx[7])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*attack*/ 1) {
    				set_input_value(input0, /*attack*/ ctx[0]);
    			}

    			if (dirty & /*release*/ 2) {
    				set_input_value(input1, /*release*/ ctx[1]);
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ADSR', slots, []);
    	let { ctx } = $$props;
    	let { trigger } = $$props;
    	let { cv_out } = $$props;
    	let { max_cv } = $$props;
    	let attack = 1;
    	let decay = 1;
    	let sustain = 1;
    	let release = 1;

    	const fireEnv = () => {
    		if (cv_out) {
    			let now = ctx.currentTime;
    			cv_out.cancelScheduledValues(now);
    			cv_out.setValueAtTime(0, now);
    			cv_out.linearRampToValueAtTime(max_cv.value, now + attack);
    			cv_out.linearRampToValueAtTime(0, now + attack + release);
    		}
    	};

    	onDestroy(() => {
    		cv_out.cancelScheduledValues(ctx.currentTime);
    		cv_out.setValueAtTime(max_cv.value, ctx.currentTime);
    	});

    	$$self.$$.on_mount.push(function () {
    		if (ctx === undefined && !('ctx' in $$props || $$self.$$.bound[$$self.$$.props['ctx']])) {
    			console.warn("<ADSR> was created without expected prop 'ctx'");
    		}

    		if (trigger === undefined && !('trigger' in $$props || $$self.$$.bound[$$self.$$.props['trigger']])) {
    			console.warn("<ADSR> was created without expected prop 'trigger'");
    		}

    		if (cv_out === undefined && !('cv_out' in $$props || $$self.$$.bound[$$self.$$.props['cv_out']])) {
    			console.warn("<ADSR> was created without expected prop 'cv_out'");
    		}

    		if (max_cv === undefined && !('max_cv' in $$props || $$self.$$.bound[$$self.$$.props['max_cv']])) {
    			console.warn("<ADSR> was created without expected prop 'max_cv'");
    		}
    	});

    	const writable_props = ['ctx', 'trigger', 'cv_out', 'max_cv'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ADSR> was created with unknown prop '${key}'`);
    	});

    	function input0_change_input_handler() {
    		attack = to_number(this.value);
    		$$invalidate(0, attack);
    	}

    	function input1_change_input_handler() {
    		release = to_number(this.value);
    		$$invalidate(1, release);
    	}

    	$$self.$$set = $$props => {
    		if ('ctx' in $$props) $$invalidate(2, ctx = $$props.ctx);
    		if ('trigger' in $$props) $$invalidate(3, trigger = $$props.trigger);
    		if ('cv_out' in $$props) $$invalidate(4, cv_out = $$props.cv_out);
    		if ('max_cv' in $$props) $$invalidate(5, max_cv = $$props.max_cv);
    	};

    	$$self.$capture_state = () => ({
    		onDestroy,
    		ctx,
    		trigger,
    		cv_out,
    		max_cv,
    		attack,
    		decay,
    		sustain,
    		release,
    		fireEnv
    	});

    	$$self.$inject_state = $$props => {
    		if ('ctx' in $$props) $$invalidate(2, ctx = $$props.ctx);
    		if ('trigger' in $$props) $$invalidate(3, trigger = $$props.trigger);
    		if ('cv_out' in $$props) $$invalidate(4, cv_out = $$props.cv_out);
    		if ('max_cv' in $$props) $$invalidate(5, max_cv = $$props.max_cv);
    		if ('attack' in $$props) $$invalidate(0, attack = $$props.attack);
    		if ('decay' in $$props) decay = $$props.decay;
    		if ('sustain' in $$props) sustain = $$props.sustain;
    		if ('release' in $$props) $$invalidate(1, release = $$props.release);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*trigger*/ 8) {
    			if (trigger || !trigger) fireEnv();
    		}
    	};

    	return [
    		attack,
    		release,
    		ctx,
    		trigger,
    		cv_out,
    		max_cv,
    		input0_change_input_handler,
    		input1_change_input_handler
    	];
    }

    class ADSR extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { ctx: 2, trigger: 3, cv_out: 4, max_cv: 5 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ADSR",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get ctx() {
    		throw new Error("<ADSR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ctx(value) {
    		throw new Error("<ADSR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get trigger() {
    		throw new Error("<ADSR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set trigger(value) {
    		throw new Error("<ADSR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cv_out() {
    		throw new Error("<ADSR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cv_out(value) {
    		throw new Error("<ADSR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get max_cv() {
    		throw new Error("<ADSR>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set max_cv(value) {
    		throw new Error("<ADSR>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\VCF.svelte generated by Svelte v3.59.2 */
    const file$1 = "src\\VCF.svelte";

    function create_fragment$1(ctx) {
    	let main;
    	let div;
    	let h2;
    	let t1;
    	let label;
    	let input_1;
    	let t2;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div = element("div");
    			h2 = element("h2");
    			h2.textContent = "Filter";
    			t1 = space();
    			label = element("label");
    			input_1 = element("input");
    			t2 = text("Frequency");
    			add_location(h2, file$1, 21, 8, 496);
    			attr_dev(input_1, "type", "range");
    			attr_dev(input_1, "min", "0");
    			attr_dev(input_1, "max", "18000");
    			attr_dev(input_1, "step", "0.001");
    			add_location(input_1, file$1, 22, 15, 528);
    			add_location(label, file$1, 22, 8, 521);
    			attr_dev(div, "class", "svelte-49prnq");
    			add_location(div, file$1, 20, 4, 481);
    			add_location(main, file$1, 19, 0, 469);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div);
    			append_dev(div, h2);
    			append_dev(div, t1);
    			append_dev(div, label);
    			append_dev(label, input_1);
    			set_input_value(input_1, /*max_cv*/ ctx[0].value);
    			append_dev(label, t2);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(/*handle*/ ctx[1].call(null, window)),
    					listen_dev(input_1, "change", /*input_1_change_input_handler*/ ctx[5]),
    					listen_dev(input_1, "input", /*input_1_change_input_handler*/ ctx[5])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*max_cv*/ 1) {
    				set_input_value(input_1, /*max_cv*/ ctx[0].value);
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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('VCF', slots, []);
    	let { ctx } = $$props;
    	let { input } = $$props;
    	let max_cv = { value: 18000 };
    	const dispatch = createEventDispatcher();
    	var filterNode = ctx.createBiquadFilter();

    	const handle = () => dispatch('connect', {
    		output: filterNode,
    		cv_in: filterNode.frequency,
    		max_cv
    	});

    	$$self.$$.on_mount.push(function () {
    		if (ctx === undefined && !('ctx' in $$props || $$self.$$.bound[$$self.$$.props['ctx']])) {
    			console.warn("<VCF> was created without expected prop 'ctx'");
    		}

    		if (input === undefined && !('input' in $$props || $$self.$$.bound[$$self.$$.props['input']])) {
    			console.warn("<VCF> was created without expected prop 'input'");
    		}
    	});

    	const writable_props = ['ctx', 'input'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<VCF> was created with unknown prop '${key}'`);
    	});

    	function input_1_change_input_handler() {
    		max_cv.value = to_number(this.value);
    		$$invalidate(0, max_cv);
    	}

    	$$self.$$set = $$props => {
    		if ('ctx' in $$props) $$invalidate(2, ctx = $$props.ctx);
    		if ('input' in $$props) $$invalidate(3, input = $$props.input);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		ctx,
    		input,
    		max_cv,
    		dispatch,
    		filterNode,
    		handle
    	});

    	$$self.$inject_state = $$props => {
    		if ('ctx' in $$props) $$invalidate(2, ctx = $$props.ctx);
    		if ('input' in $$props) $$invalidate(3, input = $$props.input);
    		if ('max_cv' in $$props) $$invalidate(0, max_cv = $$props.max_cv);
    		if ('filterNode' in $$props) $$invalidate(4, filterNode = $$props.filterNode);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*max_cv*/ 1) {
    			$$invalidate(4, filterNode.frequency.value = max_cv.value, filterNode);
    		}

    		if ($$self.$$.dirty & /*input, filterNode*/ 24) {
    			if (input) input.connect(filterNode);
    		}
    	};

    	return [max_cv, handle, ctx, input, filterNode, input_1_change_input_handler];
    }

    class VCF extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { ctx: 2, input: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "VCF",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get ctx() {
    		throw new Error("<VCF>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ctx(value) {
    		throw new Error("<VCF>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get input() {
    		throw new Error("<VCF>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set input(value) {
    		throw new Error("<VCF>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\App.svelte generated by Svelte v3.59.2 */
    const file = "src\\App.svelte";

    // (61:1) {#if vcf.hasEnv}
    function create_if_block_1(ctx) {
    	let adsr;
    	let updating_ctx;
    	let updating_trigger;
    	let updating_cv_out;
    	let updating_max_cv;
    	let current;

    	function adsr_ctx_binding(value) {
    		/*adsr_ctx_binding*/ ctx[8](value);
    	}

    	function adsr_trigger_binding(value) {
    		/*adsr_trigger_binding*/ ctx[9](value);
    	}

    	function adsr_cv_out_binding(value) {
    		/*adsr_cv_out_binding*/ ctx[10](value);
    	}

    	function adsr_max_cv_binding(value) {
    		/*adsr_max_cv_binding*/ ctx[11](value);
    	}

    	let adsr_props = {};

    	if (/*ctx*/ ctx[0] !== void 0) {
    		adsr_props.ctx = /*ctx*/ ctx[0];
    	}

    	if (/*midi*/ ctx[2].trigger !== void 0) {
    		adsr_props.trigger = /*midi*/ ctx[2].trigger;
    	}

    	if (/*vcf*/ ctx[3].cv !== void 0) {
    		adsr_props.cv_out = /*vcf*/ ctx[3].cv;
    	}

    	if (/*vcf*/ ctx[3].cvmax !== void 0) {
    		adsr_props.max_cv = /*vcf*/ ctx[3].cvmax;
    	}

    	adsr = new ADSR({ props: adsr_props, $$inline: true });
    	binding_callbacks.push(() => bind(adsr, 'ctx', adsr_ctx_binding));
    	binding_callbacks.push(() => bind(adsr, 'trigger', adsr_trigger_binding));
    	binding_callbacks.push(() => bind(adsr, 'cv_out', adsr_cv_out_binding));
    	binding_callbacks.push(() => bind(adsr, 'max_cv', adsr_max_cv_binding));

    	const block = {
    		c: function create() {
    			create_component(adsr.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(adsr, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const adsr_changes = {};

    			if (!updating_ctx && dirty & /*ctx*/ 1) {
    				updating_ctx = true;
    				adsr_changes.ctx = /*ctx*/ ctx[0];
    				add_flush_callback(() => updating_ctx = false);
    			}

    			if (!updating_trigger && dirty & /*midi*/ 4) {
    				updating_trigger = true;
    				adsr_changes.trigger = /*midi*/ ctx[2].trigger;
    				add_flush_callback(() => updating_trigger = false);
    			}

    			if (!updating_cv_out && dirty & /*vcf*/ 8) {
    				updating_cv_out = true;
    				adsr_changes.cv_out = /*vcf*/ ctx[3].cv;
    				add_flush_callback(() => updating_cv_out = false);
    			}

    			if (!updating_max_cv && dirty & /*vcf*/ 8) {
    				updating_max_cv = true;
    				adsr_changes.max_cv = /*vcf*/ ctx[3].cvmax;
    				add_flush_callback(() => updating_max_cv = false);
    			}

    			adsr.$set(adsr_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(adsr.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(adsr.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(adsr, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(61:1) {#if vcf.hasEnv}",
    		ctx
    	});

    	return block;
    }

    // (67:1) {#if vca.hasEnv}
    function create_if_block(ctx) {
    	let adsr;
    	let updating_ctx;
    	let updating_trigger;
    	let updating_cv_out;
    	let updating_max_cv;
    	let current;

    	function adsr_ctx_binding_1(value) {
    		/*adsr_ctx_binding_1*/ ctx[15](value);
    	}

    	function adsr_trigger_binding_1(value) {
    		/*adsr_trigger_binding_1*/ ctx[16](value);
    	}

    	function adsr_cv_out_binding_1(value) {
    		/*adsr_cv_out_binding_1*/ ctx[17](value);
    	}

    	function adsr_max_cv_binding_1(value) {
    		/*adsr_max_cv_binding_1*/ ctx[18](value);
    	}

    	let adsr_props = {};

    	if (/*ctx*/ ctx[0] !== void 0) {
    		adsr_props.ctx = /*ctx*/ ctx[0];
    	}

    	if (/*midi*/ ctx[2].trigger !== void 0) {
    		adsr_props.trigger = /*midi*/ ctx[2].trigger;
    	}

    	if (/*vca*/ ctx[4].cv !== void 0) {
    		adsr_props.cv_out = /*vca*/ ctx[4].cv;
    	}

    	if (/*vca*/ ctx[4].cvmax !== void 0) {
    		adsr_props.max_cv = /*vca*/ ctx[4].cvmax;
    	}

    	adsr = new ADSR({ props: adsr_props, $$inline: true });
    	binding_callbacks.push(() => bind(adsr, 'ctx', adsr_ctx_binding_1));
    	binding_callbacks.push(() => bind(adsr, 'trigger', adsr_trigger_binding_1));
    	binding_callbacks.push(() => bind(adsr, 'cv_out', adsr_cv_out_binding_1));
    	binding_callbacks.push(() => bind(adsr, 'max_cv', adsr_max_cv_binding_1));

    	const block = {
    		c: function create() {
    			create_component(adsr.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(adsr, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const adsr_changes = {};

    			if (!updating_ctx && dirty & /*ctx*/ 1) {
    				updating_ctx = true;
    				adsr_changes.ctx = /*ctx*/ ctx[0];
    				add_flush_callback(() => updating_ctx = false);
    			}

    			if (!updating_trigger && dirty & /*midi*/ 4) {
    				updating_trigger = true;
    				adsr_changes.trigger = /*midi*/ ctx[2].trigger;
    				add_flush_callback(() => updating_trigger = false);
    			}

    			if (!updating_cv_out && dirty & /*vca*/ 16) {
    				updating_cv_out = true;
    				adsr_changes.cv_out = /*vca*/ ctx[4].cv;
    				add_flush_callback(() => updating_cv_out = false);
    			}

    			if (!updating_max_cv && dirty & /*vca*/ 16) {
    				updating_max_cv = true;
    				adsr_changes.max_cv = /*vca*/ ctx[4].cvmax;
    				add_flush_callback(() => updating_max_cv = false);
    			}

    			adsr.$set(adsr_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(adsr.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(adsr.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(adsr, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(67:1) {#if vca.hasEnv}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let switch_instance;
    	let t0;
    	let vco_1;
    	let updating_ctx;
    	let updating_voctIn;
    	let t1;
    	let br0;
    	let t2;
    	let input0;
    	let t3;
    	let t4;
    	let vcf_1;
    	let updating_ctx_1;
    	let updating_input;
    	let t5;
    	let br1;
    	let t6;
    	let input1;
    	let t7;
    	let t8;
    	let vca_1;
    	let updating_ctx_2;
    	let updating_input_1;
    	let t9;
    	let br2;
    	let t10;
    	let output;
    	let updating_ctx_3;
    	let updating_input_2;
    	let current;
    	let mounted;
    	let dispose;
    	var switch_value = /*midi*/ ctx[2].comp;

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = construct_svelte_component_dev(switch_value, switch_props());

    		switch_instance.$on("input", function () {
    			if (is_function(/*midi*/ ctx[2].handle)) /*midi*/ ctx[2].handle.apply(this, arguments);
    		});
    	}

    	function vco_1_ctx_binding(value) {
    		/*vco_1_ctx_binding*/ ctx[5](value);
    	}

    	function vco_1_voctIn_binding(value) {
    		/*vco_1_voctIn_binding*/ ctx[6](value);
    	}

    	let vco_1_props = {};

    	if (/*ctx*/ ctx[0] !== void 0) {
    		vco_1_props.ctx = /*ctx*/ ctx[0];
    	}

    	if (/*midi*/ ctx[2].voct !== void 0) {
    		vco_1_props.voctIn = /*midi*/ ctx[2].voct;
    	}

    	vco_1 = new VCO({ props: vco_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(vco_1, 'ctx', vco_1_ctx_binding));
    	binding_callbacks.push(() => bind(vco_1, 'voctIn', vco_1_voctIn_binding));

    	vco_1.$on("connect", function () {
    		if (is_function(/*vco*/ ctx[1].handle)) /*vco*/ ctx[1].handle.apply(this, arguments);
    	});

    	let if_block0 = /*vcf*/ ctx[3].hasEnv && create_if_block_1(ctx);

    	function vcf_1_ctx_binding(value) {
    		/*vcf_1_ctx_binding*/ ctx[12](value);
    	}

    	function vcf_1_input_binding(value) {
    		/*vcf_1_input_binding*/ ctx[13](value);
    	}

    	let vcf_1_props = {};

    	if (/*ctx*/ ctx[0] !== void 0) {
    		vcf_1_props.ctx = /*ctx*/ ctx[0];
    	}

    	if (/*vco*/ ctx[1].output !== void 0) {
    		vcf_1_props.input = /*vco*/ ctx[1].output;
    	}

    	vcf_1 = new VCF({ props: vcf_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(vcf_1, 'ctx', vcf_1_ctx_binding));
    	binding_callbacks.push(() => bind(vcf_1, 'input', vcf_1_input_binding));

    	vcf_1.$on("connect", function () {
    		if (is_function(/*vcf*/ ctx[3].handle)) /*vcf*/ ctx[3].handle.apply(this, arguments);
    	});

    	let if_block1 = /*vca*/ ctx[4].hasEnv && create_if_block(ctx);

    	function vca_1_ctx_binding(value) {
    		/*vca_1_ctx_binding*/ ctx[19](value);
    	}

    	function vca_1_input_binding(value) {
    		/*vca_1_input_binding*/ ctx[20](value);
    	}

    	let vca_1_props = {};

    	if (/*ctx*/ ctx[0] !== void 0) {
    		vca_1_props.ctx = /*ctx*/ ctx[0];
    	}

    	if (/*vcf*/ ctx[3].output !== void 0) {
    		vca_1_props.input = /*vcf*/ ctx[3].output;
    	}

    	vca_1 = new VCA({ props: vca_1_props, $$inline: true });
    	binding_callbacks.push(() => bind(vca_1, 'ctx', vca_1_ctx_binding));
    	binding_callbacks.push(() => bind(vca_1, 'input', vca_1_input_binding));

    	vca_1.$on("connect", function () {
    		if (is_function(/*vca*/ ctx[4].handle)) /*vca*/ ctx[4].handle.apply(this, arguments);
    	});

    	function output_ctx_binding(value) {
    		/*output_ctx_binding*/ ctx[21](value);
    	}

    	function output_input_binding(value) {
    		/*output_input_binding*/ ctx[22](value);
    	}

    	let output_props = {};

    	if (/*ctx*/ ctx[0] !== void 0) {
    		output_props.ctx = /*ctx*/ ctx[0];
    	}

    	if (/*vca*/ ctx[4].output !== void 0) {
    		output_props.input = /*vca*/ ctx[4].output;
    	}

    	output = new Output({ props: output_props, $$inline: true });
    	binding_callbacks.push(() => bind(output, 'ctx', output_ctx_binding));
    	binding_callbacks.push(() => bind(output, 'input', output_input_binding));

    	const block = {
    		c: function create() {
    			main = element("main");
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			t0 = space();
    			create_component(vco_1.$$.fragment);
    			t1 = space();
    			br0 = element("br");
    			t2 = space();
    			input0 = element("input");
    			t3 = space();
    			if (if_block0) if_block0.c();
    			t4 = space();
    			create_component(vcf_1.$$.fragment);
    			t5 = space();
    			br1 = element("br");
    			t6 = space();
    			input1 = element("input");
    			t7 = space();
    			if (if_block1) if_block1.c();
    			t8 = space();
    			create_component(vca_1.$$.fragment);
    			t9 = space();
    			br2 = element("br");
    			t10 = space();
    			create_component(output.$$.fragment);
    			add_location(br0, file, 58, 1, 1260);
    			attr_dev(input0, "type", "checkbox");
    			add_location(input0, file, 59, 1, 1267);
    			add_location(br1, file, 64, 1, 1509);
    			attr_dev(input1, "type", "checkbox");
    			add_location(input1, file, 65, 1, 1516);
    			add_location(br2, file, 70, 1, 1758);
    			attr_dev(main, "class", "svelte-1h6otfa");
    			add_location(main, file, 55, 0, 1121);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			if (switch_instance) mount_component(switch_instance, main, null);
    			append_dev(main, t0);
    			mount_component(vco_1, main, null);
    			append_dev(main, t1);
    			append_dev(main, br0);
    			append_dev(main, t2);
    			append_dev(main, input0);
    			input0.checked = /*vcf*/ ctx[3].hasEnv;
    			append_dev(main, t3);
    			if (if_block0) if_block0.m(main, null);
    			append_dev(main, t4);
    			mount_component(vcf_1, main, null);
    			append_dev(main, t5);
    			append_dev(main, br1);
    			append_dev(main, t6);
    			append_dev(main, input1);
    			input1.checked = /*vca*/ ctx[4].hasEnv;
    			append_dev(main, t7);
    			if (if_block1) if_block1.m(main, null);
    			append_dev(main, t8);
    			mount_component(vca_1, main, null);
    			append_dev(main, t9);
    			append_dev(main, br2);
    			append_dev(main, t10);
    			mount_component(output, main, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*input0_change_handler*/ ctx[7]),
    					listen_dev(input1, "change", /*input1_change_handler*/ ctx[14])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (dirty & /*midi*/ 4 && switch_value !== (switch_value = /*midi*/ ctx[2].comp)) {
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

    					switch_instance.$on("input", function () {
    						if (is_function(/*midi*/ ctx[2].handle)) /*midi*/ ctx[2].handle.apply(this, arguments);
    					});

    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, main, t0);
    				} else {
    					switch_instance = null;
    				}
    			}

    			const vco_1_changes = {};

    			if (!updating_ctx && dirty & /*ctx*/ 1) {
    				updating_ctx = true;
    				vco_1_changes.ctx = /*ctx*/ ctx[0];
    				add_flush_callback(() => updating_ctx = false);
    			}

    			if (!updating_voctIn && dirty & /*midi*/ 4) {
    				updating_voctIn = true;
    				vco_1_changes.voctIn = /*midi*/ ctx[2].voct;
    				add_flush_callback(() => updating_voctIn = false);
    			}

    			vco_1.$set(vco_1_changes);

    			if (dirty & /*vcf*/ 8) {
    				input0.checked = /*vcf*/ ctx[3].hasEnv;
    			}

    			if (/*vcf*/ ctx[3].hasEnv) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*vcf*/ 8) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(main, t4);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			const vcf_1_changes = {};

    			if (!updating_ctx_1 && dirty & /*ctx*/ 1) {
    				updating_ctx_1 = true;
    				vcf_1_changes.ctx = /*ctx*/ ctx[0];
    				add_flush_callback(() => updating_ctx_1 = false);
    			}

    			if (!updating_input && dirty & /*vco*/ 2) {
    				updating_input = true;
    				vcf_1_changes.input = /*vco*/ ctx[1].output;
    				add_flush_callback(() => updating_input = false);
    			}

    			vcf_1.$set(vcf_1_changes);

    			if (dirty & /*vca*/ 16) {
    				input1.checked = /*vca*/ ctx[4].hasEnv;
    			}

    			if (/*vca*/ ctx[4].hasEnv) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*vca*/ 16) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(main, t8);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			const vca_1_changes = {};

    			if (!updating_ctx_2 && dirty & /*ctx*/ 1) {
    				updating_ctx_2 = true;
    				vca_1_changes.ctx = /*ctx*/ ctx[0];
    				add_flush_callback(() => updating_ctx_2 = false);
    			}

    			if (!updating_input_1 && dirty & /*vcf*/ 8) {
    				updating_input_1 = true;
    				vca_1_changes.input = /*vcf*/ ctx[3].output;
    				add_flush_callback(() => updating_input_1 = false);
    			}

    			vca_1.$set(vca_1_changes);
    			const output_changes = {};

    			if (!updating_ctx_3 && dirty & /*ctx*/ 1) {
    				updating_ctx_3 = true;
    				output_changes.ctx = /*ctx*/ ctx[0];
    				add_flush_callback(() => updating_ctx_3 = false);
    			}

    			if (!updating_input_2 && dirty & /*vca*/ 16) {
    				updating_input_2 = true;
    				output_changes.input = /*vca*/ ctx[4].output;
    				add_flush_callback(() => updating_input_2 = false);
    			}

    			output.$set(output_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			transition_in(vco_1.$$.fragment, local);
    			transition_in(if_block0);
    			transition_in(vcf_1.$$.fragment, local);
    			transition_in(if_block1);
    			transition_in(vca_1.$$.fragment, local);
    			transition_in(output.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			transition_out(vco_1.$$.fragment, local);
    			transition_out(if_block0);
    			transition_out(vcf_1.$$.fragment, local);
    			transition_out(if_block1);
    			transition_out(vca_1.$$.fragment, local);
    			transition_out(output.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			if (switch_instance) destroy_component(switch_instance);
    			destroy_component(vco_1);
    			if (if_block0) if_block0.d();
    			destroy_component(vcf_1);
    			if (if_block1) if_block1.d();
    			destroy_component(vca_1);
    			destroy_component(output);
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
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	window.AudioContext = window.AudioContext || window.webkitAudioContext;
    	var ctx = new AudioContext();

    	const vco = {
    		output: null,
    		handle: event => {
    			$$invalidate(1, vco.output = event.detail.output, vco);
    		}
    	};

    	const midi = {
    		comp: MIDI,
    		voct: null,
    		trigger: null,
    		handle: event => {
    			$$invalidate(2, midi.voct = event.detail.output, midi);
    			$$invalidate(2, midi.trigger = event.detail.trigger, midi);
    		}
    	};

    	const vcf = {
    		output: null,
    		cv: null,
    		cvmax: null,
    		hasEnv: false,
    		handle: event => {
    			$$invalidate(3, vcf.output = event.detail.output, vcf);
    			$$invalidate(3, vcf.cv = event.detail.cv_in, vcf);
    			$$invalidate(3, vcf.cvmax = event.detail.max_cv, vcf);
    		}
    	};

    	const vca = {
    		output: null,
    		cv: null,
    		cvmax: null,
    		hasEnv: false,
    		handle: event => {
    			$$invalidate(4, vca.output = event.detail.output, vca);
    			$$invalidate(4, vca.cv = event.detail.cv_in, vca);
    			$$invalidate(4, vca.cvmax = event.detail.max_cv, vca);
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	function vco_1_ctx_binding(value) {
    		ctx = value;
    		$$invalidate(0, ctx);
    	}

    	function vco_1_voctIn_binding(value) {
    		if ($$self.$$.not_equal(midi.voct, value)) {
    			midi.voct = value;
    			$$invalidate(2, midi);
    		}
    	}

    	function input0_change_handler() {
    		vcf.hasEnv = this.checked;
    		$$invalidate(3, vcf);
    	}

    	function adsr_ctx_binding(value) {
    		ctx = value;
    		$$invalidate(0, ctx);
    	}

    	function adsr_trigger_binding(value) {
    		if ($$self.$$.not_equal(midi.trigger, value)) {
    			midi.trigger = value;
    			$$invalidate(2, midi);
    		}
    	}

    	function adsr_cv_out_binding(value) {
    		if ($$self.$$.not_equal(vcf.cv, value)) {
    			vcf.cv = value;
    			$$invalidate(3, vcf);
    		}
    	}

    	function adsr_max_cv_binding(value) {
    		if ($$self.$$.not_equal(vcf.cvmax, value)) {
    			vcf.cvmax = value;
    			$$invalidate(3, vcf);
    		}
    	}

    	function vcf_1_ctx_binding(value) {
    		ctx = value;
    		$$invalidate(0, ctx);
    	}

    	function vcf_1_input_binding(value) {
    		if ($$self.$$.not_equal(vco.output, value)) {
    			vco.output = value;
    			$$invalidate(1, vco);
    		}
    	}

    	function input1_change_handler() {
    		vca.hasEnv = this.checked;
    		$$invalidate(4, vca);
    	}

    	function adsr_ctx_binding_1(value) {
    		ctx = value;
    		$$invalidate(0, ctx);
    	}

    	function adsr_trigger_binding_1(value) {
    		if ($$self.$$.not_equal(midi.trigger, value)) {
    			midi.trigger = value;
    			$$invalidate(2, midi);
    		}
    	}

    	function adsr_cv_out_binding_1(value) {
    		if ($$self.$$.not_equal(vca.cv, value)) {
    			vca.cv = value;
    			$$invalidate(4, vca);
    		}
    	}

    	function adsr_max_cv_binding_1(value) {
    		if ($$self.$$.not_equal(vca.cvmax, value)) {
    			vca.cvmax = value;
    			$$invalidate(4, vca);
    		}
    	}

    	function vca_1_ctx_binding(value) {
    		ctx = value;
    		$$invalidate(0, ctx);
    	}

    	function vca_1_input_binding(value) {
    		if ($$self.$$.not_equal(vcf.output, value)) {
    			vcf.output = value;
    			$$invalidate(3, vcf);
    		}
    	}

    	function output_ctx_binding(value) {
    		ctx = value;
    		$$invalidate(0, ctx);
    	}

    	function output_input_binding(value) {
    		if ($$self.$$.not_equal(vca.output, value)) {
    			vca.output = value;
    			$$invalidate(4, vca);
    		}
    	}

    	$$self.$capture_state = () => ({
    		Component,
    		MIDI,
    		VCO,
    		Output,
    		VCA,
    		ADSR,
    		VCF,
    		ctx,
    		vco,
    		midi,
    		vcf,
    		vca
    	});

    	$$self.$inject_state = $$props => {
    		if ('ctx' in $$props) $$invalidate(0, ctx = $$props.ctx);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		ctx,
    		vco,
    		midi,
    		vcf,
    		vca,
    		vco_1_ctx_binding,
    		vco_1_voctIn_binding,
    		input0_change_handler,
    		adsr_ctx_binding,
    		adsr_trigger_binding,
    		adsr_cv_out_binding,
    		adsr_max_cv_binding,
    		vcf_1_ctx_binding,
    		vcf_1_input_binding,
    		input1_change_handler,
    		adsr_ctx_binding_1,
    		adsr_trigger_binding_1,
    		adsr_cv_out_binding_1,
    		adsr_max_cv_binding_1,
    		vca_1_ctx_binding,
    		vca_1_input_binding,
    		output_ctx_binding,
    		output_input_binding
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
