<script>
    import { modules, context } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, cvsAllHover, inputsAllHover, unhover, setPosition } from './utils.js';
    import { spring } from 'svelte/motion';
    
    export let state = {
        type: 'vcf',
        voct: Math.log2(18000),
        filterType: 'lowpass',
        id: createNewId(),
        inputId: null,
        cvId: null
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;
    
    if (!module.state.position) module.state.position = setPosition();

    let moduleNode;
    let controlsNode;
    let deleteNode

    $: if (module.state.inputId != null) {
        module.input = $modules[module.state.inputId];
    } else {
        module.input = null;
    }

    let cv_module;
    
    $: if (module.state.cvId != null) {
        cv_module = $modules[module.state.cvId];
    } else {
        cv_module = null;
    }

    var filterNode = $context.createBiquadFilter();

    module.output = filterNode;

    var isEnv = false;
    $: {
        isEnv = false;
        Object.entries($modules).forEach(m => {
            if (m[1].state.type == 'adsr') isEnv = true;
        });
    }

    $: if (!isEnv) cv_module = null;

    var frequency;
    $: frequency = Math.pow(2, module.state.voct);

    $: filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
    $: filterNode.type = module.state.filterType;

    var currentInput;

    $: if (module.input) {
        if (currentInput) currentInput.disconnect();
        currentInput = module.input.output;
        currentInput.connect(filterNode);
        if (module.input.input || module.input.inputs) module.input.update();
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
    }

    var currentCvModule;

    $: if (cv_module && cv_module.inputs) {
        filterNode.frequency.cancelScheduledValues($context.currentTime);
        filterNode.frequency.setValueAtTime(0, $context.currentTime);
        if (currentCvModule) {
            if (currentCvModule.inputs[module.state.id]) delete currentCvModule.inputs[module.state.id];
        }
        currentCvModule = cv_module;
        currentCvModule.inputs[module.state.id] = {cv: filterNode.frequency, max_cv: frequency};
    } else {
        filterNode.frequency.cancelScheduledValues($context.currentTime);
        filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
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
        damping: 0.5
    });
    let bobSize = spring(0, {
        stiffness: 0.3,
        damping: 0.2
    });

    $: if (moduleNode) moduleNode.style.opacity = `${$opacity}`;

    module.fade = () => {
        opacity.set(0.2);
    }

    module.halfFade = () => {
        opacity.set(0.8)
    }

    module.unfade = () => {
        opacity.set(1);
    }

    module.bob = () => {
        bobSize.set(10);
        setTimeout(() => {
            bobSize.set(0);
        }, 50);
    }

    module.bob();
</script>

<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode nodeSize={{ x: 280, y: 350 }} bind:nodePos={state.position} bind:bobSize />
    <div id="module" use:setModule>
        <h1>{module.state.id}</h1>
        <h2>Filter</h2>
        <div class="delete" use:setDelete><DeleteButton module={module} /></div>
        <div id="controls" use:setControls>
            <label><select on:mouseenter={() => inputsAllHover(module)} on:mouseleave={() => unhover()} bind:value={module.state.inputId}>
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
            <label for='freq'>Cutoff Frequency ({frequency.toFixed(1)}Hz)</label><input id='freq' bind:value={module.state.voct} type='range' min='{Math.log2(20)}' max='{Math.log2(18000)}' step='0.0001'>
            <br><section class="type">
                <input id={'lowpass'+module.state.id} type='radio' value='lowpass' bind:group={module.state.filterType} /><label for={'lowpass'+module.state.id}>Lowpass</label>
                <input id={'highpass'+module.state.id} type='radio' value='highpass' bind:group={module.state.filterType} /><label for={'highpass'+module.state.id}>Highpass</label>
                <input id={'bandpass'+module.state.id} type='radio' value='bandpass' bind:group={module.state.filterType} /><label for={'bandpass'+module.state.id}>Bandpass</label>
            </section>
        </div>
    </div>
    <br>
</main>

<style>
    #module {
        background-color: #ff9955;
        border-style: solid;
        position: absolute;
        user-select: none;
        border-radius: 50px;
        border-color: #222222;
    }

    .type {
        display: inline-flex;
    }

    .type input[type="radio"] {
        opacity: 0;
        position: fixed;
        width: 0;
    }
    
    .type label {
        margin: auto;
        padding: 5px;
    }

    .type input[type="radio"]:hover + label {
        color: #555555;
    }

    .type input[type="radio"]:active + label {
        color: #ffffff;
    }

    .type input[type="radio"]:checked + label {
        color: #ffffff;
    }

    .delete {
        position: absolute;
        right: 20px;
        top: 20px;
    }
</style>

<svelte:window />