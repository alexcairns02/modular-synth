<script>
    import { modules, context, colours, selectingModule, output, isTyping } from '../stores.js';
    import ModuleMovement from '../ModuleMovement.svelte';
    import DeleteButton from '../DeleteButton.svelte';
    import HelpButton from '../HelpButton.svelte';
    import { createNewId, setPosition, cvsAllHover, inputsAllHover, unhover } from '../utils.js';
    import { spring } from 'svelte/motion';
    import Mixer from './Mixer.svelte';

    export let state = {
        type: 'delay',
        id: createNewId(),
        title: 'Delay',
        inputId: null,
        delayTime: 1
    }

    let moduleNode;
    let controlsNode;
    let deleteNode;
    let titleNode;
    let inputBtn;
    let helpBtn;
    let notHelpDiv;
    let helpDiv;

    let nodeSize = { x: 280, y: 420 };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;
    module.isAudio = true;
    module.isControl = false;
    module.showingHelp = false;

    if (!module.state.position) module.state.position = setPosition();

    let mixerNode = $context.createGain();

    let n = 10;

    let delays = [];
    let gains = [];

    for (let i=0; i<n; i++) {
        let delayNode = $context.createDelay(20);
        let gainNode = $context.createGain();

        delayNode.connect(gainNode);
        gainNode.connect(mixerNode);

        delays.push(delayNode);
        gains.push(gainNode);
    }

    module.output = mixerNode;

    $: for (let i=0; i<n; i++) {
        delays[i].delayTime.setValueAtTime(module.state.delayTime*i, $context.currentTime);
    }
    
    for (let i=0; i<n; i++) {
        gains[i].gain.setValueAtTime(1-((i+1)/n), $context.currentTime);
    }

    var currentInput;

    $: if (!module.destroyed) {
        if (module.state.inputId != null && $modules[module.state.inputId] && $modules[module.state.inputId].output) {
            if (currentInput) delays.forEach((delayNode) => {currentInput.disconnect(delayNode)});
            currentInput = $modules[module.state.inputId].output;
            delays.forEach((delayNode) => {currentInput.connect(delayNode)});
            if ($modules[module.state.inputId].input || $modules[module.state.inputId].inputs) $modules[module.state.inputId].update();
        } else {
            if (currentInput) delays.forEach((delayNode) => {currentInput.disconnect(delayNode)});
            currentInput = null;
        }
    }

    module.clearCurrents = () => {
        currentInput = null;
    }

    let moduleIsClicked = false;
    let moduleTyping = false;
    window.addEventListener("mouseup", () => {
        if (moduleIsClicked) moduleIsClicked = false;
    });
    window.addEventListener("mousedown", () => {
        $isTyping = false;
        moduleTyping = false;
        if (titleNode) titleNode.style.outline = "none";
    });

    function setModule(node) {
        moduleNode = node;
        moduleNode.addEventListener("mousedown", () => { moduleIsClicked = true; })
        moduleNode.addEventListener("mouseup", () => {
            if (moduleIsClicked) {
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
            }
        });
    }
    function setControls(node) { controlsNode = node; }
    function setDelete(node) { deleteNode = node; }
    function setInputBtn(node) {
        inputBtn = node;
        inputBtn.addEventListener("mouseenter", () => {
            if ($selectingModule == null) inputBtn.style.opacity = 0.8;
        });
        inputBtn.addEventListener("mouseleave", () => {
            if ($selectingModule == null) inputBtn.style.opacity = 1;
        });
    }
    function setTitleNode(node) {
        titleNode = node;
        titleNode.addEventListener("mouseenter", () => {
            titleNode.style.outline = "2px solid #222222";
        });
        titleNode.addEventListener("mouseleave", () => {
            if (!moduleTyping) titleNode.style.outline = "none";
        });
        titleNode.addEventListener("mousedown", () => {
            setTimeout(() => {
                $isTyping = true;
                moduleTyping = true;
                titleNode.style.outline = "2px solid #222222";
            }, 10);
        });
    }
    function setHelpBtn(node) { helpBtn = node; }
    function setNotHelpDiv(node) { notHelpDiv = node; }
    function setHelpDiv(node) {
        helpDiv = node;
        helpDiv.style.display = "none";
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

    module.toggleHelp = () => {
        module.showingHelp = !module.showingHelp;
        if (notHelpDiv) {
            if (!module.showingHelp) {
                notHelpDiv.style.display = "initial";
            } else {
                notHelpDiv.style.display = "none";
            }
        }
        if (helpDiv) {
            if (module.showingHelp) {
                helpDiv.style.display = "initial";
            } else {
                helpDiv.style.display = "none";
            }
        }

        if (module.showingHelp) {
            nodeSize = { x: 280, y: 420 };
        } else {
            nodeSize = { x: 280, y: 310 };
        }
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

    module.select = (id) => {
        if (module.selectingInput) {
            module.state.inputId = id;
            inputBtn.style.opacity = 1;
            module.selectingInput = false;
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
    }

    $: if (controlsNode && deleteNode) {if ($selectingModule != null) {
        controlsNode.style.pointerEvents = "none";
        deleteNode.style.pointerEvents = "none";
    } else {
        controlsNode.style.pointerEvents = "all";
        deleteNode.style.pointerEvents = "all";
    }}

    module.bob();

</script>

{#if !module.destroyed}
<main bind:this={module.component}>
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode bind:helpBtn bind:nodeSize bind:nodePos={state.position} bind:bobSize />
<div id="module" use:setModule style={"background-color: " + $colours[module.state.type]}>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <div class="help" use:setHelpBtn><HelpButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <div id="controls" use:setControls>
        <h2 use:setTitleNode class='editableTitle' bind:textContent={$modules[module.state.id].state.title} contenteditable='true'>{module.state.title}</h2>
        
        <div use:setNotHelpDiv>
        <div class='inputDiv' on:mouseenter={() => inputsAllHover(module)} on:mouseleave={() => {if ($selectingModule == null) unhover();}}>
        <label><button use:setInputBtn on:click={chooseInput}>
            {#if module.state.inputId != null && $modules[module.state.inputId]}
                {module.state.inputId} {$modules[module.state.inputId].state.title}
            {:else}
                None
            {/if}
        </button> Input</label></div>
        <label for='delayTime'>Delay Time ({module.state.delayTime.toFixed(2)})</label><input id='delayTime' bind:value={module.state.delayTime} type='range' min='0' max='1' step='0.001'>
        </div>
    </div>
    <div use:setHelpDiv>
        <p>Delay
        </p>
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

    p {
        margin-left: auto;
        margin-right: auto;
        width: 224px;
        font-size: 16px;
    }

    .delete {
        position: absolute;
        right: 20px;
        top: 20px;
    }

    .help {
        position: absolute;
        left: 20px;
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
        border-radius: 10px;
    }
</style>

<svelte:window />