<script>
    import { modules, context, midi } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, inputsAllHover, unhover, setPosition } from './utils.js';
    import { spring } from 'svelte/motion';
    
    export let state = {
        type: 'adsr',
        attack: 0.1,
        decay: 0.1,
        sustain: 0.5,
        release: 0.1,
        id: createNewId(),
        title: 'Envelope'
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    if (!module.state.position) module.state.position = setPosition();

    module.inputs = {};

    let moduleNode;
    let controlsNode;
    let deleteNode;

    let notePlaying = false;

    let attack, decay, release;

    $: attack = Math.pow(10, module.state.attack) - 1;
    $: decay = Math.pow(10, module.state.decay) - 1;
    $: release = Math.pow(10, module.state.release) - 1;

    const fireEnv = () => {
        Object.values(module.inputs).forEach((input) => {
            input.cv.cancelScheduledValues($context.currentTime);
            input.cv.setValueAtTime(0, $context.currentTime);
            input.cv.linearRampToValueAtTime(input.max_cv, $context.currentTime + attack);
            input.cv.linearRampToValueAtTime(input.max_cv*module.state.sustain, $context.currentTime + attack + decay);
        });
    }

    const unFireEnv = () => {
        Object.values(module.inputs).forEach((input) => {
            input.cv.cancelScheduledValues($context.currentTime);
            input.cv.setValueAtTime(input.max_cv*module.state.sustain, $context.currentTime);
            input.cv.linearRampToValueAtTime(0, $context.currentTime + release);
        });
    }

    $: if ($midi.trigger && !notePlaying) notePlaying = true;

    $: if (!$midi.trigger && notePlaying) notePlaying = false;

    $: if (notePlaying) fireEnv(); else unFireEnv();

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
    <ModuleMovement hasTrigger={true} bind:moduleNode bind:controlsNode bind:deleteNode nodeSize={{ x: 280, y: 400 }} bind:nodePos={state.position} bind:bobSize />
    <div id="module" use:setModule>
        <h1>{module.state.id}</h1>
        <div class="delete" use:setDelete><DeleteButton module={module} /></div>
        <div id="controls" use:setControls>
            <h2 class='editableTitle' bind:textContent={module.state.title} contenteditable='true'>{module.state.title}</h2>
            <div class="params">
                <label for='attack'>Attack ({attack.toFixed(2)}s)</label><input id='attack' bind:value={module.state.attack} type='range' min='0' max='1' step='0.001'>
                <label for='decay'>Decay ({decay.toFixed(2)}s)</label><input id='decay' bind:value={module.state.decay} type='range' min='0' max='1' step='0.001'>
                <label for='sustain'>Sustain ({module.state.sustain.toFixed(2)})</label><input id='sustain' bind:value={module.state.sustain} type='range' min='0' max='1' step='0.001'>
                <label for='release'>Release ({release.toFixed(2)}s)</label><input id='release' bind:value={module.state.release} type='range' min='0' max='1' step='0.001'>
            </div>
        </div>
    </div>
    <br>
</main>

<style>
    #module {
        background-color: #7788ff;
        border-style: solid;
        position: absolute;
        user-select: none;
        border-radius: 50px;
        border-color: #222222;
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

<svelte:window />