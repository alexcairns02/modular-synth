<script>
    import { modules, context, colours, selectingModule, output, isTyping } from './stores.js';
    import ModuleMovement from './ModuleMovement.svelte';
    import DeleteButton from './DeleteButton.svelte';
    import { createNewId, mixerInputHover, unhover, setPosition } from './utils.js';
    import { spring } from 'svelte/motion';

    export let state = {
        type: 'mixer',
        id: createNewId(),
        inputIds: [null, null, null, null],
        title: 'Mixer'
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;
    module.isAudio = true;
    module.isControl = false;

    if (!module.state.position) module.state.position = setPosition();

    let moduleNode;
    let controlsNode;
    let deleteNode;
    let inputBtns = [null, null, null, null];
    let titleNode;

    module.selectingInput = false;

    var gainNode = $context.createGain();
    
    module.output = gainNode;

    let currentInputs = [null, null, null, null];

    $: module.state.inputIds.forEach((id, i) => {
        if (id != null && $modules[id] && $modules[id].output) {
            if (currentInputs[i]) currentInputs[i].disconnect(gainNode);
            currentInputs[i] = $modules[id].output;
            currentInputs[i].connect(gainNode);
        } else {
            if (currentInputs[i]) currentInputs[i].disconnect(gainNode);
            currentInputs[i] = null;
        }
    });

    module.clearCurrents = () => {
        currentInputs = [null, null, null, null];
    }

    let moduleIsClicked = false;
    let moduleTyping = false;
    window.addEventListener("mouseup", () => {
        if (moduleIsClicked) moduleIsClicked = false;
    });
    window.addEventListener("mousedown", () => {
        $isTyping = false;
        moduleTyping = false;
        titleNode.style.outline = "none";
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
    function setInputBtn(node, i) {
        inputBtns[i] = node;
        inputBtns[i].addEventListener("mouseenter", () => {
            if ($selectingModule == null) inputBtns[i].style.opacity = 0.8;
        });
        inputBtns[i].addEventListener("mouseleave", () => {
            if ($selectingModule == null) inputBtns[i].style.opacity = 1;
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

    module.inputSelecting = null;

    function chooseInput(i) {
        module.inputSelecting = i;
        if (!inputBtns[i]) return;
        mixerInputHover(module, module.state.inputIds[i]);
        if (!module.selectingInput) {
            module.selectingInput = true;
            inputBtns[module.inputSelecting].style.opacity = 0.5;
            $selectingModule = module.state.id;
        } else {
            module.selectingInput = false;
        }
    }

    module.select = (id) => {
        if (module.selectingInput) {
            module.state.inputIds[module.inputSelecting] = id;
            inputBtns[module.inputSelecting].style.opacity = 1;
            module.selectingInput = false;
        }
        $selectingModule = null;
        unhover();
    }

    $: if (!module.destroyed) {
        inputBtns.forEach((btn, i) => {
            if (btn != null) {
                if (module.state.inputIds[i] != null) {
                    btn.style.backgroundColor = $colours[$modules[module.state.inputIds[i]].state.type];
                } else {
                    btn.style.backgroundColor = "#f0f0f0";
                }
            }
        });
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
<ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode nodeSize={{ x: 180, y: 370 }} bind:nodePos={module.state.position} bind:bobSize />
<div id="module" use:setModule style={"background-color: " + $colours[module.state.type]}>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <div id="controls" use:setControls>
    <h2 use:setTitleNode class='editableTitle' bind:textContent={$modules[module.state.id].state.title} contenteditable='true'>{module.state.title}</h2>

    <label for="inputs">Inputs
    <div id="inputs">
    {#each module.state.inputIds as inputId, i}
        <div class='inputDiv' on:mouseenter={() => mixerInputHover(module, inputId)} on:mouseleave={() => {if ($selectingModule == null) unhover();}}>
        <button use:setInputBtn={[i]} on:click={()=>chooseInput(i)}>
            {#if module.state.inputIds[i] != null && $modules[module.state.inputIds[i]]}
                {module.state.inputIds[i]} {$modules[module.state.inputIds[i]].state.title}
            {:else}
                None
            {/if}
        </button>
        </div>
    {/each}
    </div>
    </label>
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

    label {
        line-height: 40px;
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
        border-radius: 10px;
    }
</style>

<svelte:window />