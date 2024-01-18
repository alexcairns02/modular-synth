<script>
    import { createEventDispatcher } from "svelte";

    export let ctx;
    export let input;

    let max_cv = { value: 18000 };

    const dispatch = createEventDispatcher();

    var filterNode = ctx.createBiquadFilter();

    $: filterNode.frequency.value = max_cv.value;

    $: if (input) input.connect(filterNode);

    const handle = () => dispatch('connect', { output: filterNode, cv_in: filterNode.frequency, max_cv })
</script>

<main>
    <div>
        <h2>Filter</h2>
        <label><input bind:value={max_cv.value} type='range' min='0' max='18000' step='0.001'>Frequency</label>
    </div>
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window use:handle />