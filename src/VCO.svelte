<script>
    import { createEventDispatcher } from "svelte";

    export let ctx;
    export let voct;

    const dispatch = createEventDispatcher();

	let o = ctx.createOscillator();

    $: if (voct) o.frequency.value = Math.pow(2, voct);
    o.connect(ctx.destination);
    o.start(0);

    const handle = () => dispatch('signal', {output: o});
</script>

<main>
<div>
    <h2>Oscillator</h2>
    <label><input bind:value={voct} type='range' min='2.78135971352466' max='14.78135971352466' step='0.0001'>Freq</label>
    <section>
        <label>
            <input type='radio' value='sine' bind:group={o.type} /> Sine
        </label>
        <label>
            <input type='radio' value='triangle' bind:group={o.type} /> Triangle
        </label>
        <label>
            <input type='radio' value='sawtooth' bind:group={o.type} /> Sawtooth
        </label>
        <label>
            <input type='radio' value='square' bind:group={o.type} /> Square
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