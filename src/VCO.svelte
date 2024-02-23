<script>
    import { modules, context, midi, colours, selectingModule, output } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, setPosition, cvsAllHover, unhover } from './utils.js';
    import { spring } from 'svelte/motion';

    export let state = {
        type: 'vco',
        frequency: 0,
        shape: 'sine',
        id: createNewId(),
        title: 'Oscillator',
        cvId: null
    };

    let moduleNode;
    let controlsNode;
    let deleteNode;
    let titleNode;
    let cvBtn;

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;

    if (!module.state.position) module.state.position = setPosition();

    module.selectingCv = false;

    let cvModule;
    
    $: if (module.state.cvId != null) {
        cvModule = $modules[module.state.cvId];
    } else {
        cvModule = null;
    }

    let voct = Math.log2(440);

	let oscNode = $context.createOscillator();
    
    module.output = oscNode;
    module.cv = oscNode.frequency;

    $: if ($midi.voct) voct = $midi.voct;

    $: oscNode.frequency.setValueAtTime(Math.pow(2, voct + module.state.frequency), $context.currentTime);
    $: oscNode.type = module.state.shape;
    
    oscNode.start(0);

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
    function setTitleNode(node) { titleNode = node; }
    function setCvBtn(node) {
        cvBtn = node;
        cvBtn.addEventListener("mouseenter", () => {
            if ($selectingModule == null) cvBtn.style.opacity = 0.8;
        });
        cvBtn.addEventListener("mouseleave", () => {
            if ($selectingModule == null) cvBtn.style.opacity = 1;
        });
    }

    var currentCvModule;

    $: if (currentCvModule) {
        currentCvModule.setGain(module.state.id, Math.pow(2, voct + module.state.frequency));
    }

    $: if (!module.destroyed) {
        if (cvModule) {
            oscNode.frequency.cancelScheduledValues($context.currentTime);
            oscNode.frequency.setValueAtTime(0, $context.currentTime);
            if (currentCvModule) {
                if (currentCvModule.outputs[module.state.id]); currentCvModule.removeOutput(module.state.id, module.cv);
            }
            currentCvModule = cvModule;
            if (!currentCvModule.outputs[module.state.id]) currentCvModule.addOutput(module.state.id, module.cv);
        } else {
            oscNode.frequency.cancelScheduledValues($context.currentTime);
            oscNode.frequency.setValueAtTime(Math.pow(2, voct + module.state.frequency), $context.currentTime);
            if (currentCvModule) {
                if (currentCvModule.outputs[module.state.id]) currentCvModule.removeOutput(module.state.id, module.cv);
            }
            currentCvModule = null;
        }
    }
    module.clearCurrents = () => {
        cvModule = null;
        currentCvModule = null;
    }
    
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

    module.bob = () => {
        bobSize.set(10);
        setTimeout(() => {
            bobSize.set(0);
        }, 50);
    }

    module.halfFade = () => {
        opacity.set(0.8)
    }

    module.unfade = () => {
        opacity.set(1);
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
        if (module.selectingCv) {
            module.state.cvId = id;
            cvBtn.style.opacity = 1;
            module.selectingCv = false;
        }
        $selectingModule = null;
        unhover();
    }

    $: if (!module.destroyed) {
        if (cvBtn) {
            if (module.state.cvId != null) {
                cvBtn.style.backgroundColor = $colours[$modules[module.state.cvId].state.type];
            } else {
                cvBtn.style.backgroundColor = "#f0f0f0";
            }
        }
    }

    $: if (controlsNode && deleteNode) {if ($selectingModule != null) {
        controlsNode.style.pointerEvents = "none";
        deleteNode.style.pointerEvents = "none";
    } else {
        controlsNode.style.pointerEvents = "all";
        deleteNode.style.pointerEvents = "all";
    }}

    function titleHighlight() {
        if (titleNode) titleNode.style.borderStyle = "solid";
    }
    function titleUnighlight() {
        if (titleNode) titleNode.style.borderStyle = "none";
    }

    module.bob();
</script>

{#if !module.destroyed}
<main bind:this={module.component}>
    <ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode bind:nodePos={state.position} nodeSize={{ x: 320, y: 320 }} bind:bobSize />
    <div id="module" use:setModule style={"background-color: " + $colours[module.state.type]}>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <div class="controls" use:setControls>
        <h2 class='editableTitle' use:setTitleNode bind:textContent={$modules[module.state.id].state.title} contenteditable='true' >{module.state.title}</h2>
        
        <div class='inputDiv' on:mouseenter={() => {cvsAllHover(module)}} on:mouseleave={() => {if ($selectingModule == null) unhover();}}>
            <label><button use:setCvBtn on:click={chooseCv}>
                {#if module.state.cvId != null && $modules[module.state.cvId]}
                    {module.state.cvId} {$modules[module.state.cvId].state.title}
                {:else}
                    None
                {/if}
        </button> Control</label></div><br>

        <label for="freq">Frequency ({Math.pow(2, voct + module.state.frequency).toFixed(1)}Hz)</label><input id="freq" bind:value={module.state.frequency} type='range' min='-2' max='2' step='0.083333333333333'>
        <br><section class="shape">
            <input id={'sine'+module.state.id} type='radio' value='sine' bind:group={module.state.shape} /><label for={'sine'+module.state.id}>Sine</label>
            <input id ={'triangle'+module.state.id} type='radio' value='triangle' bind:group={module.state.shape} /><label for={'triangle'+module.state.id}>Triangle</label>
            <input id={'sawtooth'+module.state.id} type='radio' value='sawtooth' bind:group={module.state.shape} /><label for={'sawtooth'+module.state.id}>Sawtooth</label>
            <input id={'square'+module.state.id} type='radio' value='square' bind:group={module.state.shape} /><label for={'square'+module.state.id}>Square</label>
        </section>
    </div>
</div>
<br>
</main>
{/if}

<style>
    #module {
        border-style: solid;
        position: absolute;
        user-select: none;
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

    .shape {
        display: inline-flex;
    }

    .shape input[type="radio"] {
        opacity: 0;
        position: fixed;
        width: 0;
    }
    
    .shape label {
        margin: auto;
        padding: 5px;
    }

    .shape input[type="radio"]:hover + label {
        color: #555555;
    }

    .shape input[type="radio"]:active + label {
        color: #ffffff;
    }

    .shape input[type="radio"]:checked + label {
        color: #ffffff;
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
        padding: 10px;
        border-style: none;
        border-radius: 10px;
        border-color: rgba(34, 34, 34, 0.5);
        border-width: 2px;
    }
</style>

<svelte:window />