<script>
    import { modules, context, noModules } from './stores.js';

    var gainNode = $context.createGain();
    gainNode.gain.value = 0.2;
    gainNode.connect($context.destination);

    var input;
    var currentInput;

    $: if (input) {
        if (currentInput) currentInput.disconnect();
        currentInput = input;
        currentInput.connect(gainNode);
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
    }
</script>

<main>
    <div>
        <h2>Output</h2>
        <label><select bind:value={input}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.output}
            <option value={m.output}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select>Input</label>
        <label><input bind:value={gainNode.gain.value} type='range' min='0' max='1' step='0.001'>Gain</label>
    </div>
    <br>
</main>

<style>
    div {
        border-style: solid;
        position: absolute;
        width: 250px;
        margin-top: 310px;
        padding: 1%;
    }
</style>