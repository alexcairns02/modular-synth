<script>
    import { modules, context, output } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';

    export let state = {
        type: 'mixer',
        id: createNewId(),
        inputIds: [null, null, null, null]
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
    state.inputIds.forEach((id, i) => {
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
            module.state.inputIds[i] = input.state.id;
        } else {
            if (currentInputs[i]) currentInputs[i].disconnect();
            currentInputs[i] = null;
            module.state.inputIds[i] = null;
        }
    });

    module.update = () => {
        module.inputs = module.inputs;
    }

    module.destroy = () => {
        module.component.parentNode.removeChild(module.component);
        delete $modules[module.state.id];
        $modules = $modules;
        if ($output.input == module) $output.input = null;
        Object.values($modules).forEach((m) => {
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
        for (let i=0; i<Object.keys($modules).length+1; i++) {
            if (!$modules[i]) return i;
        }
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
</script>

<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode nodeSize={{ x: 200, y: 320 }} bind:nodePos={state.position} />
<div id="module" use:setModule>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <h2>Mixer</h2>
    <div id="controls" use:setControls>
    {#each module.inputs as input, inpid}
        <label><select bind:value={input}>
        {#each Object.entries($modules) as [id, m]}
            {#if m && m.output && id != module.state.id && (!module.inputs.includes(m) || m == input)}
            <option value={m}>{id}</option>
            {/if}
        {/each}
            <option value={null}></option>
        </select> Input {inpid}</label>
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