<script>
    import { modules, context, noModules } from './stores.js';

    const moduleId = $noModules;
    $modules[moduleId] = {};
    $noModules++;
    const module = $modules[moduleId];

    var gainNode = $context.createGain();
    gainNode.gain.value = 0.2;
    gainNode.connect($context.destination);

    var currentInput;

    $: if (module.input) {
        if (currentInput) currentInput.disconnect();
        currentInput = module.input;
        currentInput.connect(gainNode);
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
    }

    var playing = false;
    var muteUnmute = 'Unmute';

    function toggleMute() {
        if (playing) {
            playing = false;
            muteUnmute = 'Unmute';
            $context.suspend();
        } else {
            playing = true;
            muteUnmute = 'Mute';
            $context.resume();
        }
    }
</script>

<main>
    <div>
        <h1>{moduleId}</h1>
        <h2>Output</h2>
        <label><select bind:value={module.input}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.output}
            <option value={m.output}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select>Input</label>
        <label><input bind:value={gainNode.gain.value} type='range' min='0' max='1' step='0.001'>Gain</label>
        <button on:click="{toggleMute}">{muteUnmute}</button>
    </div>
    <br>
</main>

<style>
    div {
        border-style: solid;
    }
</style>