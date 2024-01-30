<script>
    import { modules, context, midi, output } from './stores.js';

    export const state = {
        type: 'vco',
        frequency: 0,
        shape: 'sine',
        id: createNewId()
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;
    module.deleted = false;

    let voct = Math.log2(440);

	let oscNode = $context.createOscillator();
    
    module.output = oscNode;

    $: if ($midi.voct) voct = $midi.voct;

    $: oscNode.frequency.value = Math.pow(2, voct + module.state.frequency);
    $: oscNode.type = module.state.shape;
    
    oscNode.start(0);

    const destroy = () => {
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
</script>

<main bind:this={module.component}>
<div>
    <button class="delete" on:click={destroy}>x</button>
    <h1>{module.state.id}</h1>
    <h2>Oscillator</h2>
    <!--<label><input bind:value={voct} type='range' min='2.78135971352466' max='14.78135971352466' step='0.0001'>v/oct</label>-->
    <label><input bind:value={module.state.frequency} type='range' min='-2' max='2' step='0.083333333333333'>Frequency</label>
    <section class="shape">
        <label><input type='radio' value='sine' bind:group={module.state.shape} />Sine</label>
        <label><input type='radio' value='triangle' bind:group={module.state.shape} />Triangle</label>
        <label><input type='radio' value='sawtooth' bind:group={module.state.shape} />Sawtooth</label>
        <label><input type='radio' value='square' bind:group={module.state.shape} />Square</label>
    </section>
</div> 
<br>
</main>

<style>
    div {
        border-style: solid;
        background-color: lightcoral;
    }

    .shape {
        display: flex;
    }
    
    .shape label {
        margin: auto;
    }
</style>

<svelte:window />