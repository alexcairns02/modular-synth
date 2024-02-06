<script>
    import { modules, context } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, inputsAllHover, unhover } from './utils.js';
    import { spring } from 'svelte/motion';

    export let state = {
        type: 'mixer',
        id: createNewId(),
        inputIds: [null, null, null, null],
        position: {x: 300, y: 100}
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    let moduleNode;
    let controlsNode;
    let deleteNode;

    var gainNode = $context.createGain();
    
    module.output = gainNode;

    module.inputs = [null, null, null, null];
    
    $: state.inputIds.forEach((id, i) => {
        if (id != null && $modules[id] != null) {
            module.inputs[i] = $modules[id];
        }
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
</script>

<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode nodeSize={{ x: 200, y: 320 }} bind:nodePos={state.position} />
<div id="module" use:setModule>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <h2>Mixer</h2>
    <div id="controls" use:setControls>
    {#each module.inputs as input, i}
        <label><select on:mouseenter={() => inputsAllHover(module)} on:mouseleave={() => unhover()} bind:value={module.state.inputIds[i]}>
        {#each Object.entries($modules) as [id, m]}
            {#if m && m.output && id != module.state.id && (!module.inputs.includes(m) || m == input)}
            <option value={id}>{id}</option>
            {/if}
        {/each}
            <option value={null}></option>
        </select> Input {i}</label>
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

    .delete {
        position: absolute;
        right: 20px;
        top: 20px;
    }
</style>

<svelte:window />