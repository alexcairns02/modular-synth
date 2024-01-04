<script>
    import { createEventDispatcher } from "svelte";

    export let ctx;
    export let input;

    let max_cv = {value: 1};

    const dispatch = createEventDispatcher();

    var gainNode = ctx.createGain();

    $: if (input) input.connect(gainNode);

    const handle = () => dispatch('signal', { output: gainNode, cv_in: gainNode.gain, max_cv });
</script>

<main>
<div>
    <h2>Amplifier</h2>
    <label><input bind:value={max_cv.value} type='range' min='0' max='1' step='0.001'>Gain</label>
</div>
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window use:handle />