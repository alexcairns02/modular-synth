<script>
    import { modules, context } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, setPosition } from './utils.js';
    import { spring } from 'svelte/motion';

    export let state = {
        type: 'lfo',
        frequency: 1,
        shape: 'sine',
        id: createNewId(),
        title: 'LFO'
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;
    
    if (!module.state.position) module.state.position = setPosition();

    module.outputs = {};

    let moduleNode;
    let controlsNode;
    let deleteNode;

    let oscNode = $context.createOscillator();

    $: oscNode.frequency.value = module.state.frequency;
    $: oscNode.type = module.state.shape;

    oscNode.start(0);

    module.addOutput = (id, cv) => {
        module.outputs[id] = $context.createGain();
        let output = module.outputs[id];
        oscNode.connect(output);
        output.connect(cv);
    }

    module.removeOutput = (id, cv) => {
        let output = module.outputs[id];
        oscNode.disconnect(output);
        output.disconnect(cv);
        delete module.outputs[id];
    }

    module.setGain = (id, gain) => {
        if (module.outputs[id]) {
            module.outputs[id].gain.value = gain;
        }
    }

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
        stiffness: 0.1,
        damping: 0.5
    });
    let bobSize = spring(0, {
        stiffness: 0.3,
        damping: 0.2
    });

    $: if (moduleNode) moduleNode.style.opacity = `${$opacity}`;

    module.fade = () => {
        opacity.set(0.2);
    }

    module.halfFade = () => {
        opacity.set(0.8);
    }

    module.unfade = () => {
        opacity.set(1);
    }

    module.bob = () => {
        bobSize.set(10);
        setTimeout(() => {
            bobSize.set(0);
        }, 50);
    }

    module.bob();
</script>

<main bind:this={module.component}>
    <ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode bind:nodePos={state.position} nodeSize={{ x: 320, y: 250 }} bind:bobSize />
    <div id="module" use:setModule>
        <div class="delete" use:setDelete><DeleteButton module={module} /></div>
        <h1>{module.state.id}</h1>
        <div id="controls" use:setControls>
            <h2 class='editableTitle' bind:textContent={module.state.title} contenteditable='true'>{module.state.title}</h2>
            <label for="freq">Frequency ({oscNode.frequency.value.toFixed(1)}Hz)</label><input id="freq" bind:value={module.state.frequency} type='range' min='0.1' max='20' step='0.01'>
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
        background-color: #dd88ff;
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

    .editableTitle {
        width: fit-content;
        min-width: 50px;
        max-width: 90%;
        max-height: 28px;
        margin-left: auto;
        margin-right: auto;
        margin-top: -10px;
        margin-bottom: 10px;
        text-overflow: ellipsis;
        overflow: hidden;
        padding: 10px
    }
</style>