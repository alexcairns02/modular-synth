<script>
    import { createEventDispatcher } from "svelte";

    export let cv = 1;
    export let ctx;
    export let input;

    const dispatch = createEventDispatcher();

    var gainNode = ctx.createGain();
    //gainNode.connect(ctx.destination);

    $: if (input) input.connect(gainNode);
    $: if (cv) gainNode.gain.value = cv;

    const handle = () => dispatch('signal', {output: gainNode});
</script>

<main>
<div>
    <h2>Amplifier</h2>
    <label><input bind:value={cv} type='range' min='0' max='2' step='0.001'>Gain</label>
</div>
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window use:handle />