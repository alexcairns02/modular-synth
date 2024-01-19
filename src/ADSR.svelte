<script>
    import { onDestroy } from "svelte";

    export let ctx;
    export let trigger;
    export let cv_out;
    export let max_cv;

    let attack = 1;
    let decay = 1;
    let sustain = 1;
    let release = 1;

    const fireEnv = () => {
        if (cv_out) {
            let now = ctx.currentTime;
            cv_out.cancelScheduledValues(now);
            cv_out.setValueAtTime(0, now);
            cv_out.linearRampToValueAtTime(max_cv.value, now + attack);
            cv_out.linearRampToValueAtTime(0, now + attack + release);
        }
    }

    $: if (trigger) fireEnv();

    onDestroy(() => {
        cv_out.cancelScheduledValues(ctx.currentTime);
        cv_out.setValueAtTime(max_cv.value, ctx.currentTime);
    });

</script>

<main>
    <div>
        <h2>Envelope</h2>
        <label><input bind:value={attack} type='range' min='0' max='1' step='0.001'>Attack</label>
        <!--<label><input bind:value={decay} type='range' min='0' max='1' step='0.001'>Decay</label>-->
        <!--<label><input bind:value={sustain} type='range' min='0' max='1' step='0.001'>Sustain</label>-->
        <label><input bind:value={release} type='range' min='0' max='1' step='0.001'>Release</label>
    </div>
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window />