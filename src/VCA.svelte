<script>
    import { modules, context, output } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    
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

    if (state.inputId != null) {
        module.input = $modules[state.inputId];
    } else {
        module.input = null;
    }

    let cv_module;
    if (state.cvId != null) {
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

    $: if (module.input) {
        if (currentInput) currentInput.disconnect();
        currentInput = module.input.output;
        currentInput.connect(gainNode);
        if (module.input.input || module.input.inputs) module.input.update();
        module.state.inputId = module.input.state.id;
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
        module.state.inputId = null;
    }

    var currentCvModule;

    $: if (cv_module) {
        gainNode.gain.cancelScheduledValues($context.currentTime);
        gainNode.gain.setValueAtTime(0, $context.currentTime);
        if (currentCvModule) {
            currentCvModule.cv = null;
            currentCvModule.max_cv = null;
        }
        currentCvModule = cv_module;
        currentCvModule.cv = gainNode.gain;
        currentCvModule.max_cv = module.state.gain;
        module.state.cvId = cv_module.state.id;
    } else {
        gainNode.gain.cancelScheduledValues($context.currentTime);
        gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);
        if (currentCvModule) {
            currentCvModule.cv = null;
            currentCvModule.max_cv = null;
        }
        currentCvModule = null;
        module.state.cvId = null;
    }

    module.update = () => {
        module.input = module.input;
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

    function movement(node) {
        moduleNode = node;
    }

    function controls(node) {
        controlsNode = node;
    }
</script>

<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode nodeSize={{ x: 300, y: 350 }} bind:nodePos={state.position} />
<div id="module" use:movement>
    <h1>{module.state.id}</h1>
    <h2>Amplifier</h2>
    <div id="controls" use:controls>
        <button class="delete" on:click={module.destroy}>x</button>
        <label><select bind:value={module.input}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.output && id != module.state.id}
            <option value={m}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select>Input</label>
        <label><select bind:value={cv_module}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.state.type == 'adsr'}
            <option value={m}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select>CV</label>
        <label><input bind:value={module.state.gain} type='range' min='0' max='1' step='0.001'>Gain</label>
    </div>
</div>
<br>
</main>

<style>
    #module {
        background-color: lightgreen;
        border-style: solid;
        position: absolute;
        user-select: none;
    }
</style>

<svelte:window />