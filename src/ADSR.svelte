<script>
    import { createEventDispatcher } from "svelte";

    export let ctx;
    export let trigger;
    export let input;

    let attack = 1;
    let decay = 1;
    let sustain = 1;
    let release = 1;

    let dispatch = createEventDispatcher();

    var gainNode = ctx.createGain();
    $: if (input) input.connect(gainNode);

    const handle = () => dispatch('signal', { output: gainNode });

    const fireEnv = () => {
        let now = ctx.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        //gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(1, now + attack);
        gainNode.gain.linearRampToValueAtTime(0, now + attack + release);
    }

    $: if (trigger || !trigger) fireEnv();

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

<svelte:window use:handle />