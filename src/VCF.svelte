<script>
    import { modules, context, output } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    
    export let state = {
        type: 'vcf',
        voct: Math.log2(18000),
        filterType: 'lowpass',
        id: createNewId(),
        inputId: null,
        cvId: null
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    let moduleNode;
    let controlsNode;
    let deleteNode

    if (state.inputId != null) {
        module.input = $modules[state.inputId];
    } else {
        module.input = null;
    }

    let cv_module;
    if (state.cvId != null) {
        cv_module = $modules[state.cvId];
    } else {
        cv_module = null;
    }

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
        state.inputId = module.input.state.id;
    } else {
        if (currentInput) currentInput.disconnect();
        currentInput = null;
        state.inputId = null;
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
        state.cvId = cv_module.state.id;
    } else {
        filterNode.frequency.cancelScheduledValues($context.currentTime);
        filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
        if (currentCvModule) {
            currentCvModule.cv = null;
            currentCvModule.max_cv = null;
        }
        currentCvModule = null;
        state.cvId = null;
    }

    module.update = () => {
        module.input = module.input;
    }

    module.destroy = () => {
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

    function setModule(node) {
        moduleNode = node;
    }

    function setControls(node) {
        controlsNode = node;
    }

    function setDelete(node) {
        deleteNode = node;
    }
</script>

<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode nodeSize={{ x: 280, y: 350 }} bind:nodePos={state.position} />
    <div id="module" use:setModule>
        <h1>{module.state.id}</h1>
        <h2>Filter</h2>
        <div class="delete" use:setDelete><DeleteButton module={module} /></div>
        <div id="controls" use:setControls>
            <label><select bind:value={module.input}>
            {#each Object.entries($modules) as [id, m]}
                {#if m.output && id != module.state.id}
                <option value={m}>{id}</option>
                {/if}
            {/each}
            <option value={null}></option>
            </select> Input</label>
            <label><select bind:value={cv_module}>
            {#each Object.entries($modules) as [id, m]}
                {#if m.state.type == 'adsr'}
                <option value={m}>{id}</option>
                {/if}
            {/each}
            <option value={null}></option>
            </select> CV</label><br>
            <label for='freq'>Frequency</label><input id='freq' bind:value={module.state.voct} type='range' min='2.78135971352466' max='14.78135971352466' step='0.0001'>
            <br><section class="type">
                <input id={'lowpass'+module.state.id} type='radio' value='lowpass' bind:group={module.state.filterType} /><label for={'lowpass'+module.state.id}>Lowpass</label>
                <input id={'highpass'+module.state.id} type='radio' value='highpass' bind:group={module.state.filterType} /><label for={'highpass'+module.state.id}>Highpass</label>
                <input id={'bandpass'+module.state.id} type='radio' value='bandpass' bind:group={module.state.filterType} /><label for={'bandpass'+module.state.id}>Bandpass</label>
            </section>
        </div>
    </div>
    <br>
</main>

<style>
    #module {
        background-color: #ff9955;
        border-style: solid;
        position: absolute;
        user-select: none;
        border-radius: 50px;
        border-color: #222222;
    }

    .type {
        display: inline-flex;
    }

    .type input[type="radio"] {
        opacity: 0;
        position: fixed;
        width: 0;
    }
    
    .type label {
        margin: auto;
        padding: 5px;
    }

    .type input[type="radio"]:checked + label {
        color: #ffffff;
    }

    .delete {
        position: absolute;
        right: 20px;
        top: 20px;
    }
</style>

<svelte:window />