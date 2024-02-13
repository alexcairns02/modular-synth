<script>
    import { modules, context } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, cvsAllHover, inputsAllHover, unhover, setPosition } from './utils.js';
    import { spring } from 'svelte/motion';
    import { disconnect } from 'tone';
    
    export let state = {
        type: 'vcf',
        voct: Math.log2(18000),
        filterType: 'lowpass',
        id: createNewId(),
        inputId: null,
        cvId: null,
        title: 'Filter'
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

    let cvModule;
    
    $: if (module.state.cvId != null) {
        cvModule = $modules[module.state.cvId];
    } else {
        cvModule = null;
    }

    var filterNode = $context.createBiquadFilter();

    module.output = filterNode;

    var isEnv = false;
    $: {
        isEnv = false;
        Object.entries($modules).forEach(m => {
            if (m[1].state.type == 'adsr' || m[1].state.type == 'lfo') isEnv = true;
        });
    }

    //$: if (!isEnv) cvModule = null;

    var frequency;
    $: frequency = Math.pow(2, module.state.voct);

    $: filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
    $: filterNode.type = module.state.filterType;

    var currentInput;

    $: if (!module.destroyed) {
        if (module.input) {
            if (currentInput) currentInput.disconnect(filterNode);
            currentInput = module.input.output;
            currentInput.connect(filterNode);
            if (module.input.input || module.input.inputs) module.input.update();
        } else {
            if (currentInput) currentInput.disconnect(filterNode);
            currentInput = null;
        }
    }

    var currentCvModule;

    $: if (currentCvModule) {
        currentCvModule.setGain(module.state.id, frequency);
    }

    function connectCV(e) {
        cvModule = $modules[e.target.selectedOptions[0].value];
        if (cvModule) {
            filterNode.frequency.cancelScheduledValues($context.currentTime);
            filterNode.frequency.setValueAtTime(0, $context.currentTime);
            if (currentCvModule) {
                if (currentCvModule.outputs[module.state.id]); currentCvModule.removeOutput(module.state.id);
            }
            currentCvModule = cvModule;
            if (!currentCvModule.outputs[module.state.id]) currentCvModule.addOutput(module.state.id, filterNode.frequency);
        } else {
            filterNode.frequency.cancelScheduledValues($context.currentTime);
            filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
            if (currentCvModule) {
                if (currentCvModule.outputs[module.state.id]); currentCvModule.removeOutput(module.state.id);
            }
            currentCvModule = null;
        }
    }

    module.clearCurrents = () => {
        currentInput = null;
        cvModule = null;
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
        stiffness: 0.1,
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
        <div class="delete" use:setDelete><DeleteButton module={module} /></div>
        <div id="controls" use:setControls>
            <h2 class='editableTitle' bind:textContent={module.state.title} contenteditable='true'>{module.state.title}</h2>
            <div class='inputDiv' on:mouseenter={() => inputsAllHover(module)} on:mouseleave={() => unhover()}>
            <label><select bind:value={module.state.inputId}>
                {#each Object.entries($modules) as [id, m]}
                    {#if m.output && id != module.state.id}
                    <option value={id}>{id} {m.state.title}</option>
                    {/if}
                {/each}
                <option value={null}></option>
                </select> Input</label></div>
                <div class='inputDiv' on:mouseenter={() => cvsAllHover(module)} on:mouseleave={() => unhover()}>
                <label><select bind:value={module.state.cvId} on:change={connectCV}>
                {#each Object.entries($modules) as [id, m]}
                    {#if m.state.type == 'adsr' || m.state.type == 'lfo'}
                    <option value={id}>{id} {m.state.title}</option>
                    {/if}
                {/each}
                <option value={null}></option>
                </select> Control</label>
                </div><br>
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

    select {
        width: 120px;
        text-overflow: ellipsis;
        overflow: hidden;
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

    .editableTitle {
        width: fit-content;
        min-width: 50px;
        max-width: 90%;
        max-height: 28px;
        margin-left: auto;
        margin-right: auto;
        margin-top: -10px;
        margin-bottom: 10px;
        text-overflow: ellipsis;
        overflow: hidden;
        padding: 10px
    }
</style>

<svelte:window />