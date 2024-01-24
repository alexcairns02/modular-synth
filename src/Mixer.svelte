<script>
    import { modules, context, noModules } from './stores.js';

    const moduleId = $noModules;
    $modules[moduleId] = {};
    $noModules++;
    const module = $modules[moduleId];

    var gainNode = $context.createGain();
    
    module.output = gainNode;

    module.inputs = [null, null, null, null];

    const currentInputs = [null, null, null, null];

    $: module.inputs.forEach((input, id) => {
        if (input) {
            if (currentInputs[id]) currentInputs[id].output.disconnect();
            currentInputs[id] = input;
            currentInputs[id].output.connect(gainNode);
        } else {
            if (currentInputs[id]) currentInputs[id].output.disconnect();
            currentInputs[id] = null;

        }
    });

    const update = () => {
        module.inputs = module.inputs;
    }
</script>

<main>
<div>
    <h1>{moduleId}</h1>
    <h2>Mixer</h2>
    <button on:click={update}>Update</button>
    {#each module.inputs as input, inpid}
        <label><select bind:value={input}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.output && id != moduleId && (!module.inputs.includes(m) || m == input)}
            <option value={m}>{id}</option>
            {/if}
        {/each}
            <option value={null}></option>
        </select>Input {inpid}</label>
    {/each}
</div>
<br>
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window />