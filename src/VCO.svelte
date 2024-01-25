<script>
    import { modules, context, noModules, midi } from './stores.js';

    const moduleId = $noModules;
    $modules[moduleId] = {};
    $noModules++;
    const module = $modules[moduleId];

    let voct = Math.log2(440);

    let frequency = 0;

	let oscNode = $context.createOscillator();
    
    module.output = oscNode;

    $: if ($midi.voct) voct = $midi.voct;

    $: oscNode.frequency.value = Math.pow(2, voct + frequency);
    
    oscNode.start(0);

    const destroy = () => {
        module.component.parentNode.removeChild(module.component);
        module.output.disconnect();
        module.output = null;
        $modules = $modules;
    };
</script>

<main bind:this={module.component}>
<div>
    <button class="delete" on:click={destroy}>x</button>
    <h1>{moduleId}</h1>
    <h2>Oscillator</h2>
    <label><input bind:value={voct} type='range' min='2.78135971352466' max='14.78135971352466' step='0.0001'>v/oct</label>
    <label><input bind:value={frequency} type='range' min='-2' max='2' step='0.083333333333333'>Frequency</label>
    <section class="shape">
        <label><input type='radio' value='sine' bind:group={oscNode.type} />Sine</label>
        <label><input type='radio' value='triangle' bind:group={oscNode.type} />Triangle</label>
        <label><input type='radio' value='sawtooth' bind:group={oscNode.type} />Sawtooth</label>
        <label><input type='radio' value='square' bind:group={oscNode.type} />Square</label>
    </section>
</div> 
<br>
</main>

<style>
    div {
        border-style: solid;
    }

    .shape {
        display: flex;
    }
    
    .shape label {
        margin: auto;
    }
</style>

<svelte:window />