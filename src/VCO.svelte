<script>
    import { createEventDispatcher } from "svelte";

    export let ctx;

    const dispach = createEventDispatcher();

	let o = ctx.createOscillator();

    o.frequency.value = 440;
    o.connect(ctx.destination);
    o.start(0);

    const handle = () => dispach('message', {o});

    console.log('dispatched');
</script>

<main use:handle>
<div>
    <h2>VCO</h2>
    <label><input bind:value={o.frequency.value} type='range' min='20' max='18000' step='1'>Freq</label>
    <section>
        <label>
            <input type='radio' value='sine' bind:group={o.type} /> Sine
        </label>
        <label>
            <input type='radio' value='square' bind:group={o.type} /> Square
        </label>
        <label>
            <input type='radio' value='sawtooth' bind:group={o.type} /> Sawtooth
        </label>
    </section>
</div> 
</main>

<style>
    div {
        border-style: solid;
    }
</style>