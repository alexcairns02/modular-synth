<script>
    import { modules, context, output } from './stores.js';
    
    export const state = {
        type: 'vcf',
        voct: Math.log2(18000),
        filterType: 'lowpass',
        id: createNewId()
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    module.input = null;
    let cv_module = null;

    var filterNode = $context.createBiquadFilter();

    module.output = filterNode;

    var isEnv = false;
    $: {
        isEnv = false;
        Object.entries($modules).forEach(m => {
            if (m[1].state.type == 'adsr') isEnv = true;
        });
    }

    $: if (!isEnv) cv_module = null;

    var frequency;
    $: frequency = Math.pow(2, module.state.voct);

    $: filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
    $: filterNode.type = module.state.filterType;

    var currentInput;

    $: if (module.input) {
        if (currentInput) currentInput.disconnect();
        currentInput = module.input.output;
        currentInput.connect(filterNode);
        if (module.input.input || module.input.inputs) module.input.update();
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
    }

    var currentCvModule;

    $: if (cv_module) {
        filterNode.frequency.cancelScheduledValues($context.currentTime);
        filterNode.frequency.setValueAtTime(0, $context.currentTime);
        if (currentCvModule) {
            currentCvModule.cv = null;
            currentCvModule.max_cv = null;
        }
        currentCvModule = cv_module;
        currentCvModule.cv = filterNode.frequency;
        currentCvModule.max_cv = frequency;
    } else {
        filterNode.frequency.cancelScheduledValues($context.currentTime);
        filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
        if (currentCvModule) {
            currentCvModule.cv = null;
            currentCvModule.max_cv = null;
        }
        currentCvModule = null;
    }

    module.update = () => {
        module.input = module.input;
    }

    const destroy = () => {
        module.component.parentNode.removeChild(module.component);
        delete $modules[module.state.id];
        $modules = $modules;
        if ($output.input == module) $output.input = null;
        Object.values($modules).forEach((m) => {
            if (m.input && m.input == module) {
                m.input = null;
                m.update();
            }
            if (m.inputs) {
                m.inputs.forEach((input, i) => {
                    if (input && input.state.id == module.state.id) m.inputs[i] = null;
                });
                m.update();
            }
        });
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
        <h2>Filter</h2>
        <label><select bind:value={module.input}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.output && id != module.state.id}
            <option value={m}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select>Input</label>
        <label><select bind:value={cv_module}>
        {#each Object.entries($modules) as [id, m]}
            {#if m.state.type == 'adsr'}
            <option value={m}>{id}</option>
            {/if}
        {/each}
        <option value={null}></option>
        </select>CV</label>
        <label><input bind:value={module.state.voct} type='range' min='2.78135971352466' max='14.78135971352466' step='0.0001'>Frequency</label>
        <section>
            <label><input type='radio' value='lowpass' bind:group={module.state.filterType} /> Lowpass</label>
            <label><input type='radio' value='highpass' bind:group={module.state.filterType} /> Highpass</label>
            <label><input type='radio' value='bandpass' bind:group={module.state.filterType} /> Bandpass</label>
        </section>
    </div>
    <br>
</main>

<style>
    div {
        border-style: solid;
        background-color: lightsalmon;
    }
</style>

<svelte:window />