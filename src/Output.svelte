<script>
    import { modules, context, output } from './stores.js';
    import { inputsAllHover, moduleInUse, unhover } from './utils.js';
    import { spring } from 'svelte/motion';

    export let state = {
        volume: 0.2,
        inputId: null
    };

    let divNode;

    $output.state = state;

    var gainNode = $context.createGain();

    $: gainNode.gain.value = $output.state.volume;

    gainNode.connect($context.destination);

    $: if ($output.state.inputId) {
        $output.input = $modules[$output.state.inputId];
    } else {
        $output.input = null;
    }

    var currentInput;

    $: if ($output.input) {
        if (currentInput) currentInput.disconnect(gainNode);
        currentInput = $output.input.output;
        currentInput.connect(gainNode);
        if ($output.input.input || $output.input.inputs) $output.input.update();
    } else {
        if (currentInput) currentInput.disconnect(gainNode);
        currentInput = null;
    }

    const setDiv = (node) => {
        divNode = node;
    };

    let redness = spring(0, {
        stiffness: 0.05,
        damping: 0.3
    });

    $: if (divNode) divNode.style.backgroundColor = `rgba(255, ${255-$redness}, ${255-$redness}, 0.7)`;

    let loaded = false;

    let connectedString = "disconnected";

    setTimeout(() => {
        loaded = true;
    }, 500);

    $: if (loaded && $output.state.inputId == null) {
        redness.set(255);
        connectedString = "disconnected";
    } else {
        redness.set(0);
        connectedString = "connected";
    }

    let isAudioSource = false;

    $: { Object.values($modules).forEach((m) => {
        if (m.state.type == 'vco') {
            isAudioSource = true;
            return;
        }
    }); isAudioSource = false; };
</script>

<main>
    <div id='mainDiv' use:setDiv>
        <h2>Audio Output ({connectedString})</h2>
        {#if Object.values($modules).length == 0}<p>Add modules using buttons above</p>
        {:else if $output.state.inputId == null}<p>Select input below</p>
        {/if}
        <div id='inputDiv' on:mouseenter={() => {inputsAllHover(null)}} on:mouseleave={unhover}>
        <label><select bind:value={$output.state.inputId}>
        {#each Object.entries($modules) as [id, m]}
            {#if (m.output && !moduleInUse(m) || id == $output.state.inputId)}
            <option value={id}>{id} {m.state.title}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select> Input</label>
        </div><br>
        <label for='gain'>Volume</label><input id='gain' bind:value={$output.state.volume} type='range' min='0' max='1' step='0.001'>
    </div>
    <br>
</main>

<style>
    #mainDiv {
        border-style: solid;
        position: absolute;
        width: 250px;
        height: 270px;
        margin-top: 310px;
        padding: 1%;
        background-color: rgba(255, 255, 255, 0.7);
    }

    select {
        width: 120px;
        text-overflow: ellipsis;
        overflow: hidden;
    }

	input {
		pointer-events: all;
	}
    
	select {
		pointer-events: all;
	}

    #inputDiv {
        pointer-events: all;
        width: fit-content;
        height: fit-content;
        padding: 5px;
        padding-left: 20px;
        padding-right: 20px;
    }
</style>