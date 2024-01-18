<script>
    import { createEventDispatcher } from "svelte";

    export let ctx;
    export let voctIn;

    const dispatch = createEventDispatcher();

    let voct = Math.log2(440);

	let oscNode = ctx.createOscillator();

    $: if (voctIn != null) voct = voctIn;

    $: oscNode.frequency.value = Math.pow(2, voct);
    
    oscNode.start(0);

    const handle = () => dispatch('connect', {output: oscNode});
</script>

<main>
<div>
    <h2>Oscillator</h2>
    <label><input bind:value={voct} type='range' min='2.78135971352466' max='14.78135971352466' step='0.0001'>Frequency</label>
    <section>
        <label>
            <input type='radio' value='sine' bind:group={oscNode.type} /> Sine
        </label>
        <label>
            <input type='radio' value='triangle' bind:group={oscNode.type} /> Triangle
        </label>
        <label>
            <input type='radio' value='sawtooth' bind:group={oscNode.type} /> Sawtooth
        </label>
        <label>
            <input type='radio' value='square' bind:group={oscNode.type} /> Square
        </label>
    </section>
</div> 
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window use:handle />