<script>
    import { modules, context, noModules, midi } from './stores.js';

    const moduleId = $noModules;
    $modules[moduleId] = {};
    $noModules++;
    const module = $modules[moduleId];

    module.input = null;

    let voct = Math.log2(18000);

    let max_cv = { value: 18000 };

    $: max_cv.value = Math.pow(2, voct);

    var filterNode = $context.createBiquadFilter();

    module.output = filterNode;

    $: module.cv_in = filterNode.frequency;
    $: module.max_cv = max_cv;

    var currentInput;

    $: if (module.input) {
        if (currentInput) currentInput.disconnect();
        currentInput = module.input;
        currentInput.connect(filterNode);
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
    }

    $: filterNode.frequency.setValueAtTime(max_cv.value, $context.currentTime);

    const update = () => {
        module.input = module.input;
    }
</script>

<main>
    <div>
        <h1>{moduleId}</h1>
        <h2>Filter</h2>
        <button on:click={update}>Update</button>
        <label><select bind:value={module.input}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.output && id != moduleId}
            <option value={m.output}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select>Input</label>
        <label><input bind:value={voct} type='range' min='2.78135971352466' max='14.78135971352466' step='0.0001'>Frequency</label>
        <section>
            <label><input type='radio' value='lowpass' bind:group={filterNode.type} /> Lowpass</label>
            <label><input type='radio' value='highpass' bind:group={filterNode.type} /> Highpass</label>
            <label><input type='radio' value='bandpass' bind:group={filterNode.type} /> Bandpass</label>
        </section>
    </div>
    <br>
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window />