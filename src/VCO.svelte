<script>
    import { modules, context, midi, output } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';

    export let state = {
        type: 'vco',
        frequency: 0,
        shape: 'sine',
        id: createNewId(),
    };

    let moduleNode;
    let controlsNode;

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

    module.destroy = () => {
        module.component.parentNode.removeChild(module.component);
        delete $modules[module.state.id];
        $modules = $modules;
        if ($output.input == module) $output.input = null;
        Object.values($modules).forEach((m) => {
            if (m.input && m.input == module) {
                m.input = null;
                m.update();
            }
            if (m.inputs) {
                m.inputs.forEach((input, i) => {
                    if (input && input.state.id == module.state.id) m.inputs[i] = null;
                });
                m.update();
            }
        });
    };

    function createNewId() {
        for (let i=0; i<Object.keys($modules).length+1; i++) {
            if (!$modules[i]) return i;
        }
    }

    function movement(node) {
        moduleNode = node;
    }

    function controls(node) {
        controlsNode = node;
    }
</script>

<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode bind:nodePos={state.position} />
<div id="module" use:movement>
    <h1>{module.state.id}</h1>
    <h2>Oscillator</h2>
    <div id="controls" use:controls>
        <button class="delete" on:click={module.destroy}>x</button>
        <label><input bind:value={module.state.frequency} type='range' min='-2' max='2' step='0.083333333333333'>Frequency</label>
        <section class="shape">
            <label><input type='radio' value='sine' bind:group={module.state.shape} />Sine</label>
            <label><input type='radio' value='triangle' bind:group={module.state.shape} />Triangle</label>
            <label><input type='radio' value='sawtooth' bind:group={module.state.shape} />Sawtooth</label>
            <label><input type='radio' value='square' bind:group={module.state.shape} />Square</label>
        </section>
    </div>
</div>
<br>
</main>

<style>
    #module {
        border-style: solid;
        background-color: lightcoral;
        position: absolute;
        user-select: none;
    }

    .shape {
        display: flex;
    }
    
    .shape label {
        margin: auto;
    }
</style>

<svelte:window />