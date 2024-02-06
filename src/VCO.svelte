<script>
    import { modules, context, midi } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId } from './utils.js';
    import { spring } from 'svelte/motion';

    export let state = {
        type: 'vco',
        frequency: 0,
        shape: 'sine',
        id: createNewId(),
    };

    let moduleNode;
    let controlsNode;
    let deleteNode;

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    let voct = Math.log2(440);

	let oscNode = $context.createOscillator();
    
    module.output = oscNode;

    $: if ($midi.voct) voct = $midi.voct;

    $: oscNode.frequency.value = Math.pow(2, voct + module.state.frequency);
    $: oscNode.type = module.state.shape;
    
    oscNode.start(0);

    function setModule(node) {
        moduleNode = node;
    }

    function setControls(node) {
        controlsNode = node;
    }

    function setDelete(node) {
        deleteNode = node;
    }
    
    let opacity = spring(1, {
        stiffness: 0.3,
        damping: 0.3
    });

    $: if (moduleNode) moduleNode.style.opacity = `${$opacity}`;

    module.fade = () => {
        opacity.set(0.3);
    }

    module.unfade = () => {
        opacity.set(1);
    }
</script>

<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode bind:nodePos={state.position} nodeSize={{ x: 320, y: 250 }} />
<div id="module" use:setModule>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <h2>Oscillator</h2>
    <div id="controls" use:setControls>
        <label for="freq">Frequency ({oscNode.frequency.value.toFixed(1)}Hz)</label><input id="freq" bind:value={module.state.frequency} type='range' min='-2' max='2' step='0.083333333333333'>
        <br><section class="shape">
            <input id={'sine'+module.state.id} type='radio' value='sine' bind:group={module.state.shape} /><label for={'sine'+module.state.id}>Sine</label>
            <input id ={'triangle'+module.state.id} type='radio' value='triangle' bind:group={module.state.shape} /><label for={'triangle'+module.state.id}>Triangle</label>
            <input id={'sawtooth'+module.state.id} type='radio' value='sawtooth' bind:group={module.state.shape} /><label for={'sawtooth'+module.state.id}>Sawtooth</label>
            <input id={'square'+module.state.id} type='radio' value='square' bind:group={module.state.shape} /><label for={'square'+module.state.id}>Square</label>
        </section>
    </div>
</div>
<br>
</main>

<style>
    #module {
        border-style: solid;
        background-color: #ff6666;
        position: absolute;
        user-select: none;
        border-radius: 50px;
        border-color: #222222;
    }

    .shape {
        display: inline-flex;
    }

    .shape input[type="radio"] {
        opacity: 0;
        position: fixed;
        width: 0;
    }
    
    .shape label {
        margin: auto;
        padding: 5px;
    }

    .shape input[type="radio"]:hover + label {
        color: #555555;
    }

    .shape input[type="radio"]:active + label {
        color: #ffffff;
    }

    .shape input[type="radio"]:checked + label {
        color: #ffffff;
    }

    .delete {
        position: absolute;
        right: 20px;
        top: 20px;
    }
</style>

<svelte:window />