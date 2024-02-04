<script>
    import { modules, context, output } from './stores.js';
    
    export const state = {};

    var gainNode = $context.createGain();
    gainNode.gain.value = 0.2;
    gainNode.connect($context.destination);

    $output.input;
    var currentInput;

    $: if ($output.input && $output.input.output) {
        if (currentInput) currentInput.disconnect();
        currentInput = $output.input.output;
        currentInput.connect(gainNode);
        if ($output.input.input || $output.input.inputs) $output.input.update();
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
    }
</script>

<main>
    <div>
        <h2>Output</h2>
        <label><select bind:value={$output.input}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.output}
            <option value={m}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select> Input</label>
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
        background-color: white;    
    }

	input {
		pointer-events: all;
	}
    
	select {
		pointer-events: all;
	}
</style>