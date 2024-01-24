<script>
    import { modules, context, noModules, midi } from './stores.js';

    const moduleId = $noModules;
    $modules[moduleId] = {};
    $noModules++;
    const module = $modules[moduleId];

    module.input = null;

    let max_cv = {value: 1};

    var gainNode = $context.createGain();

    module.output = gainNode;

    $: module.cv_in = gainNode.gain;
    $: module.max_cv = max_cv;

    var currentInput;

    $: if (module.input) {
        if (currentInput) currentInput.disconnect();
        currentInput = module.input;
        currentInput.connect(gainNode);
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
    }

    $: gainNode.gain.setValueAtTime(max_cv.value, $context.currentTime);

    const update = () => {
        module.input = module.input;
    }
</script>

<main>
<div>
    <h1>{moduleId}</h1>
    <h2>Amplifier</h2>
    <button on:click={update}>Update</button>
    <label><select bind:value={module.input}>
    {#each Object.entries($modules) as [id, m]}
        {#if m.output && id != moduleId}
        <option value={m.output}>{id}</option>
        {/if}
    {/each}
    <option value={null}></option>
    </select>Input</label>
    <label><input bind:value={max_cv.value} type='range' min='0' max='1' step='0.001'>Gain</label>
</div>
<br>
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window />