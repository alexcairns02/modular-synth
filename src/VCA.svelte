<script>
    import { modules, context, colours, selectingModule, output } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, cvsAllHover, inputsAllHover, unhover, setPosition } from './utils.js';
    import { spring } from 'svelte/motion';
    
    export let state = {
        type: 'vca',
        gain: 1,
        id: createNewId(),
        inputId: null,
        cvId: null,
        title: 'Amplifier'
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    if (!module.state.position) module.state.position = setPosition();
    
    let moduleNode;
    let controlsNode;
    let deleteNode;
    let inputBtn;
    let cvBtn;

    module.selectingInput = false;
    module.selectingCv = false;

    let cvModule;

    $: if (module.state.cvId != null) {
        cvModule = $modules[module.state.cvId];
    } else {
        cvModule = null;
    }

    var gainNode = $context.createGain();

    module.output = gainNode;
    module.cv = gainNode.gain;

    $: gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);

    var currentInput;

    $: if (!module.destroyed) {
        if (module.state.inputId != null && $modules[module.state.inputId].output) {
            if (currentInput) currentInput.disconnect(gainNode);
            currentInput = $modules[module.state.inputId].output;
            currentInput.connect(gainNode);
            if ($modules[module.state.inputId].input || $modules[module.state.inputId].inputs) $modules[module.state.inputId].update();
        } else {
            if (currentInput) currentInput.disconnect(gainNode);
            currentInput = null;
        }
    }

    var currentCvModule;

    $: if (currentCvModule) {
        currentCvModule.setGain(module.state.id, module.state.gain);
    }

    $: if (!module.destroyed) {
        if (cvModule) {
            gainNode.gain.cancelScheduledValues($context.currentTime);
            gainNode.gain.setValueAtTime(0, $context.currentTime);
            if (currentCvModule) {
                if (currentCvModule.outputs[module.state.id]); currentCvModule.removeOutput(module.state.id, module.cv);
            }
            currentCvModule = cvModule;
            if (!currentCvModule.outputs[module.state.id]) currentCvModule.addOutput(module.state.id, module.cv);
        } else {
            gainNode.gain.cancelScheduledValues($context.currentTime);
            gainNode.gain.setValueAtTime(module.state.gain, $context.currentTime);
            if (currentCvModule) {
                if (currentCvModule.outputs[module.state.id]) currentCvModule.removeOutput(module.state.id, module.cv);
            }
            currentCvModule = null;
        }
    }
    module.clearCurrents = () => {
        currentInput = null;
        cvModule = null;
        currentCvModule = null;
    }

    module.update = () => {
        module.state.inputId = module.state.inputId;
    }

    function setModule(node) {
        moduleNode = node;
        moduleNode.addEventListener("mouseup", () => {
            if ($selectingModule == "output") {
                $output.select(module.state.id);
            } else if ($selectingModule != null && $modules[$selectingModule].selectingInput
                && $selectingModule != module.state.id
                && ($modules[$selectingModule].state.type != "mixer" 
                || (!$modules[$selectingModule].state.inputIds.includes(module.state.id)
                || $modules[$selectingModule].state.inputIds[$modules[$selectingModule].inputSelecting] == module.state.id))) 
            {
                $modules[$selectingModule].select(module.state.id);
            } else if ($selectingModule == module.state.id) {
                module.select(null);
            }
        });
    }
    function setControls(node) { controlsNode = node; }
    function setDelete(node) { deleteNode = node; }
    function setInputBtn(node) { inputBtn = node; }
    function setCvBtn(node) { cvBtn = node; }
    
    let opacity = spring(1, {
        stiffness: 0.1,
        damping: 0.5
    });
    let bobSize = spring(0, {
        stiffness: 0.3,
        damping: 0.2
    });

    $: if (moduleNode) moduleNode.style.opacity = `${$opacity}`;

    module.fade = () => {
        opacity.set(0.2);
    }

    module.halfFade = () => {
        opacity.set(0.8)
    }

    module.unfade = () => {
        opacity.set(1);
    }

    module.bob = () => {
        bobSize.set(10);
        setTimeout(() => {
            bobSize.set(0);
        }, 50);
    }

    function chooseInput() {
        inputsAllHover(module);
        if (!inputBtn) return;
        if (!module.selectingInput) {
            module.selectingInput = true;
            inputBtn.style.opacity = 0.5;
            $selectingModule = module.state.id;
        } else {
            module.selectingInput = false;
        }
    }

    function chooseCv() {
        cvsAllHover(module);
        if (!cvBtn) return;
        if (!module.selectingCv) {
            module.selectingCv = true;
            cvBtn.style.opacity = 0.5;
            $selectingModule = module.state.id;
        } else {
            module.selectingCv = false;
        }
    }

    module.select = (id) => {
        if (module.selectingInput) {
            module.state.inputId = id;
            inputBtn.style.opacity = 1;
            module.selectingInput = false;
        } else if (module.selectingCv) {
            module.state.cvId = id;
            cvBtn.style.opacity = 1;
            module.selectingCv = false;
        }
        $selectingModule = null;
        unhover();
    }

    $: if (!module.destroyed) {
        if (inputBtn) {
            if (module.state.inputId != null) {
                inputBtn.style.backgroundColor = $colours[$modules[module.state.inputId].state.type];
            } else {
                inputBtn.style.backgroundColor = "#f0f0f0";
            }
        }
        if (cvBtn) {
            if (module.state.cvId != null) {
                cvBtn.style.backgroundColor = $colours[$modules[module.state.cvId].state.type];
            } else {
                cvBtn.style.backgroundColor = "#f0f0f0";
            }
        }
    }

    $: if (controlsNode) {if ($selectingModule != null) {
        controlsNode.style.pointerEvents = "none";
    } else {
        controlsNode.style.pointerEvents = "all";
    }}

    module.bob();
</script>

{#if !module.destroyed}
<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode nodeSize={{ x: 280, y: 310 }} bind:nodePos={state.position} bind:bobSize />
<div id="module" use:setModule style={"background-color: " + $colours[module.state.type]}>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <div id="controls" use:setControls>
        <h2 class='editableTitle' bind:textContent={$modules[module.state.id].state.title} contenteditable='true'>{module.state.title}</h2>
        
        <div class='inputDiv' on:mouseenter={() => inputsAllHover(module)} on:mouseleave={() => {if ($selectingModule == null) unhover();}}>
        <label><button use:setInputBtn on:click={chooseInput}>
            {#if module.state.inputId != null && $modules[module.state.inputId]}
                {module.state.inputId} {$modules[module.state.inputId].state.title}
            {:else}
                None
            {/if}
        </button> Input</label></div>

        <div class='inputDiv' on:mouseenter={() => {cvsAllHover(module)}} on:mouseleave={() => {if ($selectingModule == null) unhover();}}>
        <label><button use:setCvBtn on:click={chooseCv}>
            {#if module.state.cvId != null && $modules[module.state.cvId]}
                {module.state.cvId} {$modules[module.state.cvId].state.title}
            {:else}
                None
            {/if}
        </button> Control</label></div><br>
        <label for='gain'>Volume ({module.state.gain.toFixed(2)})</label><input id='gain' bind:value={module.state.gain} type='range' min='0' max='1' step='0.001'>
    </div>
</div>
<br>
</main>
{/if}

<style>
    #module {
        position: absolute;
        user-select: none;
        border-style: solid;
        border-radius: 50px;
        border-color: #222222;
    }

    button {
        background-color: #f0f0f0;
        border-radius: 10px;
        border-width: 2px;
        border-style: solid;
        border-color: #222222;
        width: 110px;
        height: 35px;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
    }

    .delete {
        position: absolute;
        right: 20px;
        top: 20px;
    }

    .editableTitle {
        width: fit-content;
        min-width: 50px;
        max-width: 90%;
        max-height: 28px;
        margin-left: auto;
        margin-right: auto;
        margin-top: -10px;
        margin-bottom: 10px;
        text-overflow: ellipsis;
        overflow: hidden;
        padding: 10px
    }
</style>

<svelte:window on:click={() => {if (module.selectingInput) {}}}/>