<script>
    import { modules, context } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, mixerInputHover, unhover, setPosition } from './utils.js';
    import { spring } from 'svelte/motion';

    export let state = {
        type: 'mixer',
        id: createNewId(),
        inputIds: [null, null, null, null],
        title: 'Mixer'
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    if (!module.state.position) module.state.position = setPosition();

    let moduleNode;
    let controlsNode;
    let deleteNode;

    var gainNode = $context.createGain();
    
    module.output = gainNode;

    module.inputs = [null, null, null, null];
    
    $: module.state.inputIds.forEach((id, i) => {
        if (id != null && $modules[id] != null) {
            module.inputs[i] = $modules[id];
        } else {
            module.inputs[i] = null;
        }
        module.inputs = module.inputs;
    });

    const currentInputs = [null, null, null, null];

    $: module.inputs.forEach((input, i) => {
        if (input) {
            if (currentInputs[i]) currentInputs[i].disconnect();
            currentInputs[i] = input.output;
            currentInputs[i].connect(gainNode);
        } else {
            if (currentInputs[i]) currentInputs[i].disconnect();
            currentInputs[i] = null;
        }
    });

    module.update = () => {
        module.inputs = module.inputs;
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
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode nodeSize={{ x: 240, y: 320 }} bind:nodePos={module.state.position} bind:bobSize />
<div id="module" use:setModule>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <div id="controls" use:setControls>
    <h2 class='editableTitle' bind:textContent={module.state.title} contenteditable='true'>{module.state.title}</h2>
    {#each module.state.inputIds as inputId, i}
        <div class='inputDiv' on:mouseenter={() => mixerInputHover(module, inputId)} on:mouseleave={() => unhover()}>
        <label><select bind:value={inputId}>
        {#each Object.entries($modules) as [id, m]}
            {#if id && m && m.output && id != module.state.id && (!module.state.inputIds.includes(id) || id == inputId)}
            <option value={id}>{id} {m.state.title}</option>
            {/if}
        {/each}
            <option value={null}></option>
        </select> Input {i}</label>
        </div>
    {/each}
    </div>
</div>
<br>
</main>

<style>
    #module {
        background-color: #ffff77;
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

    .delete {
        position: absolute;
        right: 20px;
        top: 20px;
    }

    .editableTitle {
        width: fit-content;
        min-width: 50px;
        max-width: 90%;
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