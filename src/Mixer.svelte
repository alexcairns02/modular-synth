<script>
    import { createEventDispatcher } from "svelte";

    export let ctx;
    export let in0;
    export let in1;
    export let in2;
    export let in3;

    const dispatch = createEventDispatcher();

    var gainNode = ctx.createGain();
    
    $: if (in0) in0.connect(gainNode);
    $: if (in1) in1.connect(gainNode);
    $: if (in2) in2.connect(gainNode);
    $: if (in3) in3.connect(gainNode);

    const handle = () => dispatch('connect', { output: gainNode });
</script>

<main>
<div>
    <h2>Mixer</h2>
</div>
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window use:handle />