<script>
    import { modules, context } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, cvsAllHover, inputsAllHover, unhover } from './utils.js';
    import { spring } from 'svelte/motion';
    
    export let state = {
        type: 'vca',
        gain: 1,
        id: createNewId(),
        inputId: null,
        cvId: null
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    let moduleNode;
    let controlsNode;
    let deleteNode;

    $: if (state.inputId != null) {
        module.input = $modules[state.inputId];
    } else {
        module.input = null;
    }

    let cv_module;

    $: if (state.cvId != null) {
        cv_module = $modules[state.cvId];
    } else {
        cv_module = null;
    }

    var gainNode = $context.createGain();

    module.output = gainNode;

    var isEnv = false;
    $: {
        isEnv = false;
        Object.entries($modules).forEach(m => {
            if (m[1].state.type == 'adsr') isEnv = true;
        });
    }

    $: if (!isEnv) cv_module = null;

    $: module.cv_in = gainNode.gain;
    $: module.max_cv = module.state.gain;

    $: gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);

    var currentInput;

    $: if (module.input && module.input.output) {
        if (currentInput) currentInput.disconnect();
        currentInput = module.input.output;
        currentInput.connect(gainNode);
        if (module.input.input || module.input.inputs) module.input.update();
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
    }

    var currentCvModule;

    $: if (cv_module) {
        gainNode.gain.cancelScheduledValues($context.currentTime);
        gainNode.gain.setValueAtTime(0, $context.currentTime);
        if (currentCvModule) {
            if (currentCvModule.inputs[module.state.id]) delete currentCvModule.inputs[module.state.id];
        }
        currentCvModule = cv_module;
        currentCvModule.inputs[module.state.id] = {cv: gainNode.gain, max_cv: module.state.gain};
    } else {
        gainNode.gain.cancelScheduledValues($context.currentTime);
        gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);
        if (currentCvModule) {
            if (currentCvModule.inputs[module.state.id]) delete currentCvModule.inputs[module.state.id];
        }
        currentCvModule = null;
    }

    module.update = () => {
        module.input = module.input;
    }

    function setModule(node) {
        moduleNode = node;
    }

    function setControls(node) {
        controlsNode = node;
    }

    function setDelete(node) {
        deleteNode = node;
    }
    
    let opacity = spring(1, {
        stiffness: 0.3,
        damping: 0.3
    });

    $: if (moduleNode) moduleNode.style.opacity = `${$opacity}`;

    module.fade = () => {
        opacity.set(0.3);
    }

    module.unfade = () => {
        opacity.set(1);
    }

    let selectingInput = false;

    $: console.log(selectingInput)

    $: if (selectingInput) {
        inputsAllHover(module);
    } else {
        unhover();
    }
</script>

<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode nodeSize={{ x: 280, y: 310 }} bind:nodePos={state.position} />
<div id="module" use:setModule>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <h2>Amplifier</h2>
    <div id="controls" use:setControls>
        <label><select on:mouseenter={() => {if (!selectingInput) inputsAllHover(module)}} on:mouseleave={() => {if (!selectingInput) unhover()}} bind:value={module.state.inputId}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.output && id != module.state.id}
            <option value={id}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select> Input</label>
        <label><select on:mouseenter={() => cvsAllHover(module)} on:mouseleave={() => unhover()} bind:value={module.state.cvId}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.state.type == 'adsr' || m.state.type == 'lfo'}
            <option value={id}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select> Control</label><br>
        <label for='gain'>Volume</label><input id='gain' bind:value={module.state.gain} type='range' min='0' max='1' step='0.001'>
    </div>
</div>
<br>
</main>

<style>
    #module {
        background-color: #88ff88;
        border-style: solid;
        position: absolute;
        user-select: none;
        border-radius: 50px;
        border-color: #222222;
    }

    .delete {
        position: absolute;
        right: 20px;
        top: 20px;
    }
</style>

<svelte:window />