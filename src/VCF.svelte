<script>
    import { createEventDispatcher } from "svelte";

    export let ctx;
    export let input;

    let voct = Math.log2(18000);

    let max_cv = { value: 18000 };

    $: max_cv.value = Math.pow(2, voct);

    const dispatch = createEventDispatcher();

    var filterNode = ctx.createBiquadFilter();

    $: filterNode.frequency.setValueAtTime(max_cv.value, ctx.currentTime);

    $: if (input) input.connect(filterNode);

    const handle = () => dispatch('connect', { output: filterNode, cv_in: filterNode.frequency, max_cv })
</script>

<main>
    <div>
        <h2>Filter</h2>
        <label><input bind:value={voct} type='range' min='2.78135971352466' max='14.78135971352466' step='0.0001'>Frequency</label>
        <section>
            <label>
                <input type='radio' value='lowpass' bind:group={filterNode.type} /> Lowpass
            </label>
            <label>
                <input type='radio' value='highpass' bind:group={filterNode.type} /> Highpass
            </label>
            <label>
                <input type='radio' value='bandpass' bind:group={filterNode.type} /> Bandpass
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