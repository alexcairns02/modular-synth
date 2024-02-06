<script>
    import { modules, context, output } from './stores.js';
    
    export let state = {
        volume: 0.2,
        inputId: null
    };

    $output.state = state;

    var gainNode = $context.createGain();

    $: gainNode.gain.value = $output.state.volume;

    gainNode.connect($context.destination);

    $: if ($output.state.inputId != null) {
        $output.input = $modules[$output.state.inputId];
    } else {
        $output.input = null;
    }

    var currentInput;

    $: if ($output.input) {
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
        <h2>Audio Output</h2>
        <label><select bind:value={$output.state.inputId}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.output}
            <option value={id}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select> Input</label><br>
        <label for='gain'>Volume</label><input id='gain' bind:value={$output.state.volume} type='range' min='0' max='1' step='0.001'>
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