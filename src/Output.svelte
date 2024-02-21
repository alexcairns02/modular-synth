<script>
    import { modules, context, output, selectingModule, colours } from './stores.js';
    import { inputsAllHover, unhover } from './utils.js';
    import { spring } from 'svelte/motion';

    export let state = {
        volume: 0.2,
        inputId: null
    };

    let divNode;
    let controlsNode;
    let inputBtn;

    $output.selectingInput = false;

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
        divNode.addEventListener("mousedown", () => {
            if ($selectingModule == "output") {
                $output.select(null);
            }
        });
    };
    const setControls = (node) => { controlsNode = node };
    const setInputBtn = (node) => { inputBtn = node };

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

    function chooseInput() {
        inputsAllHover(null);
        if (!inputBtn) return;
        if (!$output.selectingInput) {
            $output.selectingInput = true;
            inputBtn.style.opacity = 0.5;
            $selectingModule = "output";
        } else {
            $output.selectingInput = false;
        }
    }

    $output.select = (id) => {
        if ($output.selectingInput) {
            $output.state.inputId = id;
            inputBtn.style.opacity = 1;
            $output.selectingInput = false;
        }
        $selectingModule = null;
        unhover();
    }

    $: if (inputBtn) {
        if ($output.state.inputId != null) {
            inputBtn.style.backgroundColor = $colours[$modules[$output.state.inputId].state.type];
        } else {
            inputBtn.style.backgroundColor = "#f0f0f0";
        }
    }

    $: if (controlsNode) {if ($selectingModule != null) {
        controlsNode.style.pointerEvents = "none";
    } else {
        controlsNode.style.pointerEvents = "all";
    }}
</script>

<main>
    <div id='mainDiv' use:setDiv>
        <h2>Audio Output ({connectedString})</h2>
        {#if Object.values($modules).length == 0}<p>Add modules using buttons above</p>
        {:else if $output.state.inputId == null}<p>Select input below</p>
        {/if}
        <div use:setControls>
        <div id='inputDiv' on:mouseenter={() => {inputsAllHover(null)}} on:mouseleave={() => { if ($selectingModule == null) unhover()}}>
        <label><button use:setInputBtn on:click={chooseInput}>
            {#if $output.state.inputId != null && $modules[$output.state.inputId]}
                {$output.state.inputId} {$modules[$output.state.inputId].state.title}
            {:else}
                None
            {/if}
        </button> Input</label>
        </div><br>
        <label for='gain'>Volume</label><input id='gain' bind:value={$output.state.volume} type='range' min='0' max='1' step='0.001'>
        </div>
    </div>
    <br>
</main>

<style>
    #mainDiv {
        border-style: solid;
        position: absolute;
        width: 250px;
        height: 270px;
        bottom: 20px;
        padding: 1%;
        background-color: rgba(255, 255, 255, 0.7);
        pointer-events: all;
    }

    button {
        background-color: #f0f0f0;
        border-radius: 10px;
        border-width: 2px;
        border-style: solid;
        border-color: #222222;
        width: 110px;
        height: 35px;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
    }

    #inputDiv {
        width: fit-content;
        height: fit-content;
        padding: 5px;
        padding-left: 20px;
        padding-right: 20px;
    }
</style>