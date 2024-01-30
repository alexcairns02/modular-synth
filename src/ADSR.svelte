<script>
    import { modules, context, midi } from './stores.js';
    
    export const state = {
        type: 'adsr',
        attack: 0.1,
        decay: 0.1,
        sustain: 0.5,
        release: 0.1,
        id: createNewId()
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    let notePlaying = false;

    let attack, decay, release;

    $: attack = Math.pow(10, module.state.attack) - 1;
    $: decay = Math.pow(10, module.state.decay) - 1;
    $: release = Math.pow(10, module.state.release) - 1;

    const fireEnv = () => {
        if (module.cv) {
            module.cv.cancelScheduledValues($context.currentTime);
            module.cv.setValueAtTime(0, $context.currentTime);
            module.cv.linearRampToValueAtTime(module.max_cv, $context.currentTime + attack);
            module.cv.linearRampToValueAtTime(module.max_cv*module.state.sustain, $context.currentTime + attack + decay);
        }
    }

    const unFireEnv = () => {
        if (module.cv) {
            module.cv.cancelScheduledValues($context.currentTime);
            module.cv.setValueAtTime(module.max_cv*module.state.sustain, $context.currentTime);
            module.cv.linearRampToValueAtTime(0, $context.currentTime + release);
        }
    }

    $: if ($midi.trigger && !notePlaying) notePlaying = true;

    $: if (!$midi.trigger && notePlaying) notePlaying = false;

    $: if (notePlaying) fireEnv(); else unFireEnv();

    const destroy = () => {
        module.cv = null;
        module.max_cv = null;
        module.component.parentNode.removeChild(module.component);
        delete $modules[module.state.id];
        $modules = $modules;
    };

    function createNewId() {
        for (let i=0; i<Object.keys($modules).length+1; i++) {
            if (!$modules[i]) return i;
        }
    }
</script>

<main bind:this={module.component}>
    <div>
        <button class="delete" on:click={destroy}>x</button>
        <h1>{module.state.id}</h1>
        <h2>Envelope</h2>
        <div class="params">
            <label><input bind:value={module.state.attack} type='range' min='0' max='1' step='0.001'>Attack ({attack.toFixed(2)}s)</label>
            <label><input bind:value={module.state.decay} type='range' min='0' max='1' step='0.001'>Decay ({decay.toFixed(2)}s)</label>
            <label><input bind:value={module.state.sustain} type='range' min='0' max='1' step='0.001'>Sustain ({module.state.sustain.toFixed(2)})</label>
            <label><input bind:value={module.state.release} type='range' min='0' max='1' step='0.001'>Release ({release.toFixed(2)}s)</label>
        </div>
    </div>
    <br>
</main>

<style>
    main {
        border-style: solid;
        background-color: lightblue;
    }

    .params {
        margin-left: 20%;
        text-align: left;
    }
</style>

<svelte:window />