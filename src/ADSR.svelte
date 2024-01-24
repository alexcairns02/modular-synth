<script>
    import { onDestroy } from "svelte";
    import { modules, context, noModules, midi } from './stores.js';

    const moduleId = $noModules;
    $modules[moduleId] = {};
    $noModules++;
    const module = $modules[moduleId];

    let notePlaying = false;

    let moduleOut;

    let attack = 1;
    let decay = 1;
    let sustain = 1;
    let release = 1;

    const fireEnv = () => {
        if (moduleOut && moduleOut.cv_in) {
            let cv_out = moduleOut.cv_in;
            let now = $context.currentTime;
            cv_out.cancelScheduledValues(now);
            cv_out.setValueAtTime(0, now);
            cv_out.linearRampToValueAtTime(moduleOut.max_cv.value, now + attack);
            cv_out.linearRampToValueAtTime(moduleOut.max_cv.value*sustain, now + attack + decay);
        }
    }

    const unFireEnv = () => {
        if (moduleOut && moduleOut.cv_in) {
            let cv_out = moduleOut.cv_in;
            let now = $context.currentTime;
            cv_out.cancelScheduledValues(now);
            cv_out.linearRampToValueAtTime(0, now + release);
        }
    }

    $: if ($midi.trigger && !notePlaying) notePlaying = true;

    $: if (!$midi.trigger && notePlaying) notePlaying = false;

    $: if (notePlaying) fireEnv(); else unFireEnv(); 

    var currentModuleOut;

    $: if (moduleOut) currentModuleOut = moduleOut;

    const reset = () => {
        if (currentModuleOut) {
            let cv_out = currentModuleOut.cv_in;
            let now = $context.currentTime;
            cv_out.cancelScheduledValues(now);
            cv_out.setValueAtTime(currentModuleOut.max_cv.value, now);
        }
    }

    const update = () => {
        moduleOut = moduleOut;
    }

    $: if (!moduleOut) reset();

    onDestroy(reset);

</script>

<main>
    <div>
        <h1>{moduleId}</h1>
        <h2>Envelope</h2>
        <button on:click={update}>Update</button>
        <label><select bind:value={moduleOut}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.cv_in && m.max_cv}
            <option value={m}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select>Output</label>
        <label><input bind:value={attack} type='range' min='0' max='1' step='0.001'>Attack</label>
        <label><input bind:value={decay} type='range' min='0' max='1' step='0.001'>Decay</label>
        <label><input bind:value={sustain} type='range' min='0' max='1' step='0.001'>Sustain</label>
        <label><input bind:value={release} type='range' min='0' max='1' step='0.001'>Release</label>
    </div>
    <br>
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window />