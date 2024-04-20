<script>
    import { modules, context, midi, colours, selectingModule, isTyping } from '../stores.js';
    import ModuleMovement from '../ModuleMovement.svelte';
    import DeleteButton from '../DeleteButton.svelte';
    import HelpButton from '../HelpButton.svelte';
    import { createNewId, setPosition } from '../utils.js';
    import { spring } from 'svelte/motion';
    
    export let state = {
        type: 'adsr',
        attack: 0.1,
        decay: 0.1,
        sustain: 0.5,
        release: 0.1,
        id: createNewId(),
        title: 'Envelope'
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;
    module.isAudio = false;
    module.isControl = true;

    if (!module.state.position) module.state.position = setPosition();

    module.outputs = {};

    let maxCvs = {};

    let moduleNode;
    let controlsNode;
    let deleteNode;
    let titleNode;
    let helpBtn;
    let helpDiv;
    let notHelpDiv;

    let nodeSize = { x: 280, y: 400 };

    let notePlaying = false;

    let attack, decay, release;

    $: attack = Math.pow(10, module.state.attack) - 1;
    $: decay = Math.pow(10, module.state.decay) - 1;
    $: release = Math.pow(10, module.state.release) - 1;

    const fireEnv = () => {
        Object.entries(module.outputs).forEach(([id, output]) => {
            output.cancelScheduledValues($context.currentTime);
            output.setValueAtTime(0, $context.currentTime);
            output.linearRampToValueAtTime(maxCvs[id], $context.currentTime + attack);
            output.linearRampToValueAtTime(maxCvs[id]*module.state.sustain, $context.currentTime + attack + decay);
        });
    }

    const unFireEnv = () => {
        Object.entries(module.outputs).forEach(([id, output]) => {
            output.cancelScheduledValues($context.currentTime);
            output.setValueAtTime(maxCvs[id]*module.state.sustain, $context.currentTime);
            output.linearRampToValueAtTime(0, $context.currentTime + release);
        });
    }

    module.addOutput = (id, cv) => {
        module.outputs[id] = cv;
        maxCvs[id] = 1;
        unFireEnv();
    }

    module.removeOutput = (id) => {
        delete module.outputs[id];
    }

    module.setGain = (id, gain) => {
        console.log("h")
        maxCvs[id] = gain;
    }

    $: if ($midi.trigger && !notePlaying) notePlaying = true;

    $: if (!$midi.trigger && notePlaying) notePlaying = false;

    $: if (notePlaying) fireEnv(); else unFireEnv();

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
                if ($selectingModule != null && $modules[$selectingModule].selectingCv) $modules[$selectingModule].select(module.state.id);
            }
        });
    }
    function setControls(node) { controlsNode = node; }
    function setDelete(node) { deleteNode = node; }
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
    function setHelpDiv(node) {
        helpDiv = node;
        helpDiv.style.display = "none";
    }
    function setNotHelpDiv(node) { notHelpDiv = node; }
    
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
        opacity.set(0.8);
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
            nodeSize = { x: 280, y: 650 };
        } else {
            nodeSize = { x: 280, y: 400 };
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
    <ModuleMovement hasTrigger={true} bind:moduleNode bind:controlsNode bind:deleteNode bind:helpBtn bind:nodeSize bind:nodePos={state.position} bind:bobSize />
    <div id="module" use:setModule style={"background-color: " + $colours[module.state.type]}>
        <h1>{module.state.id}</h1>
        <div class="delete" use:setDelete><DeleteButton module={module} /></div>
        <div class="help" use:setHelpBtn><HelpButton module={module} /></div>
        <div id="controls" use:setControls>
            <h2 use:setTitleNode class='editableTitle' bind:textContent={$modules[module.state.id].state.title} contenteditable='true'>{module.state.title}</h2>
            
            <div use:setNotHelpDiv>
            <div class="params">
                <label for='attack'>Attack ({attack.toFixed(2)}s)</label><input id='attack' bind:value={module.state.attack} type='range' min='0' max='1' step='0.001'>
                <label for='decay'>Decay ({decay.toFixed(2)}s)</label><input id='decay' bind:value={module.state.decay} type='range' min='0' max='1' step='0.001'>
                <label for='sustain'>Sustain ({module.state.sustain.toFixed(2)})</label><input id='sustain' bind:value={module.state.sustain} type='range' min='0' max='1' step='0.001'>
                <label for='release'>Release ({release.toFixed(2)}s)</label><input id='release' bind:value={module.state.release} type='range' min='0' max='1' step='0.001'>
            </div>
            </div>
        </div>
        <div use:setHelpDiv>
            <p>
                Can be selected as a Control option on other modules to automate parameters.<br><br>
                When key is pressed, causes connected parameters to rise up to their maximum value and then fall.<br><br>
                Attack - time it takes to rise to the maximum value when key is pressed.<br><br>
                Decay - time it takes to fall to sustained value after maximum reached.<br><br>
                Sustain - proportion of maximum value the parameter is sustained at while key is held.<br><br>
                Release - time it takes to fall to minimum when key is released.<br><br>
            </p>
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