<script>
    import { modules, context, output } from './stores.js';
    
    export const state = {
        type: 'vca',
        gain: 1,
        id: createNewId()
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    module.input = null;
    let cv_module = null;

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
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
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
    } else {
        gainNode.gain.cancelScheduledValues($context.currentTime);
        gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);
        if (currentCvModule) {
            currentCvModule.cv = null;
            currentCvModule.max_cv = null;
        }
        currentCvModule = null;
    }

    module.update = () => {
        module.input = module.input;
    }

    const destroy = () => {
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
</script>

<main bind:this={module.component}>
<div>
    <button class="delete" on:click={destroy}>x</button>
    <h1>{module.state.id}</h1>
    <h2>Amplifier</h2>
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
<br>
</main>

<style>
    div {
        border-style: solid;
        background-color: lightgreen;
    }
</style>

<svelte:window />