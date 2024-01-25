<script>
    import { onDestroy } from "svelte";
    import { modules, context, noModules, midi } from './stores.js';

    const moduleId = $noModules;
    $modules[moduleId] = {};
    $noModules++;
    const module = $modules[moduleId];

    let notePlaying = false;

    let moduleOut = null;

    let attack = 1;
    let decay = 1;
    let sustain = 1;
    let release = 1;

    const fireEnv = () => {
        if (moduleOut && moduleOut.cv_in) {
            let cv_out = moduleOut.cv_in;
            let now = $context.currentTime;
            cv_out.cancelScheduledValues(now);
            cv_out.linearRampToValueAtTime(0, now + 0.01);
            cv_out.linearRampToValueAtTime(moduleOut.max_cv.value, now + attack);
            cv_out.linearRampToValueAtTime(moduleOut.max_cv.value*sustain, now + attack + decay);
        }
    }

    const unFireEnv = () => {
        if (moduleOut && moduleOut.cv_in) {
            let cv_out = moduleOut.cv_in;
            let now = $context.currentTime;
            cv_out.cancelScheduledValues(now);
            cv_out.linearRampToValueAtTime(moduleOut.max_cv.value*sustain, now + 0.01);
            cv_out.linearRampToValueAtTime(0, now + release);
        }
    }

    $: if ($midi.trigger && !notePlaying) notePlaying = true;

    $: if (!$midi.trigger && notePlaying) notePlaying = false;

    $: if (notePlaying) fireEnv(); else unFireEnv(); 

    var currentModuleOut;

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

    
    $: if (moduleOut) {
        currentModuleOut = moduleOut;
        unFireEnv();
    }
    else { reset(); }

    const destroy = () => {
        reset();
        module.component.parentNode.removeChild(module.component);
    };
</script>

<main bind:this={module.component}>
    <div>
        <button class="delete" on:click={destroy}>x</button>
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
        <div class="params">
            <label><input bind:value={attack} type='range' min='0' max='10' step='0.001'>Attack ({attack}s)</label>
            <label><input bind:value={decay} type='range' min='0' max='10' step='0.001'>Decay ({decay}s)</label>
            <label><input bind:value={sustain} type='range' min='0' max='1' step='0.001'>Sustain ({sustain})</label>
            <label><input bind:value={release} type='range' min='0' max='10' step='0.001'>Release ({release}s)</label>
        </div>
    </div>
    <br>
</main>

<style>
    main {
        border-style: solid;
    }

    .params {
        margin-left: 20%;
        text-align: left;
    }
</style>

<svelte:window />