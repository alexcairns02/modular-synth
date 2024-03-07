<script>
    import { modules, context, colours, selectingModule, isTyping } from '../stores.js';
    import ModuleMovement from '../ModuleMovement.svelte';
    import DeleteButton from '../DeleteButton.svelte';
    import { createNewId, setPosition } from '../utils.js';
    import { spring } from 'svelte/motion';
    import HelpButton from '../HelpButton.svelte';

    export let state = {
        type: 'lfo',
        frequency: 1,
        shape: 'sine',
        id: createNewId(),
        title: 'LFO'
    };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;
    module.isAudio = false;
    module.isControl = true;
    
    if (!module.state.position) module.state.position = setPosition();

    module.outputs = {};

    let moduleNode;
    let controlsNode;
    let deleteNode;
    let titleNode;
    let helpBtn;
    let helpDiv;
    let notHelpDiv;

    let nodeSize = { x: 320, y: 250 };

    let oscNode = $context.createOscillator();

    let frequency;

    $: frequency = Math.pow(20, module.state.frequency - 1);

    $: oscNode.frequency.value = frequency;
    $: oscNode.type = module.state.shape;

    oscNode.start(0);

    module.addOutput = (id, cv) => {
        module.outputs[id] = $context.createGain();
        let output = module.outputs[id];
        oscNode.connect(output);
        output.connect(cv);
    }

    module.removeOutput = (id, cv) => {
        let output = module.outputs[id];
        oscNode.disconnect(output);
        output.disconnect(cv);
        delete module.outputs[id];
    }

    module.setGain = (id, gain) => {
        if (module.outputs[id]) {
            module.outputs[id].gain.linearRampToValueAtTime(gain, $context.currentTime + 0.01);
        }
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
            nodeSize = { x: 320, y: 400 };
        } else {
            nodeSize = { x: 320, y: 250 };
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
    <ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode bind:helpBtn bind:nodePos={state.position} bind:nodeSize bind:bobSize />
    <div id="module" use:setModule style={"background-color: " + $colours[module.state.type]}>
        <div class="delete" use:setDelete><DeleteButton module={module} /></div>
        <div class="help" use:setHelpBtn><HelpButton module={module} /></div>
        <h1>{module.state.id}</h1>
        <div id="controls" use:setControls>
            <h2 use:setTitleNode class='editableTitle' bind:textContent={$modules[module.state.id].state.title} contenteditable='true'>{module.state.title}</h2>
            
            <div use:setNotHelpDiv>
            <label for="freq">Frequency ({oscNode.frequency.value.toFixed(2)}Hz)</label><input id="freq" bind:value={module.state.frequency} type='range' min='0.001' max='2' step='0.001'>
            <br><section class="shape">
                <input id={'sine'+module.state.id} type='radio' value='sine' bind:group={module.state.shape} /><label for={'sine'+module.state.id}>Sine</label>
                <input id ={'triangle'+module.state.id} type='radio' value='triangle' bind:group={module.state.shape} /><label for={'triangle'+module.state.id}>Triangle</label>
                <input id={'sawtooth'+module.state.id} type='radio' value='sawtooth' bind:group={module.state.shape} /><label for={'sawtooth'+module.state.id}>Sawtooth</label>
                <input id={'square'+module.state.id} type='radio' value='square' bind:group={module.state.shape} /><label for={'square'+module.state.id}>Square</label>
            </section>
            </div>
        </div>
        <div use:setHelpDiv>
            <p>
                Low Frequency Oscillator.<br><br>
                Can be selected as a Control option on other modules to automate parameters.<br><br>
                Causes the value of connected parameters to rise and fall periodically.<br><br>
                Frequency parameter determines the rate at which the LFO oscillates.<br><br>
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
        width: 256px;
        font-size: 16px;
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