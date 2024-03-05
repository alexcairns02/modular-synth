<script>
    import { modules, context, midi, colours, selectingModule, output, isTyping } from '../stores.js';
    import ModuleMovement from '../ModuleMovement.svelte';
    import DeleteButton from '../DeleteButton.svelte';
    import HelpButton from '../HelpButton.svelte';
    import { createNewId, setPosition, cvsAllHover, unhover } from '../utils.js';
    import { spring } from 'svelte/motion';

    export let state = {
        type: 'vco',
        frequency: 0,
        detune: 0,
        shape: 'sine',
        id: createNewId(),
        title: 'Oscillator',
        cvId: null,
        cvId2: null
    };

    if (state.cvId2 == undefined) state.cvId2 = null;
    if (state.detune == undefined) state.detune = 0;

    let moduleNode;
    let controlsNode;
    let deleteNode;
    let titleNode;
    let freqCvBtn;
    let detuneCvBtn;
    let helpBtn;
    let notHelpDiv;
    let helpDiv;

    let nodeSize = { x: 320, y: 420 };

    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;
    module.isAudio = true;
    module.isControl = false;
    module.showingHelp = false;

    if (!module.state.position) module.state.position = setPosition();

    module.selectingCv = false;

    let freqCvModule;
    let detuneCvModule;
    
    $: if (module.state.cvId != null) {
        freqCvModule = $modules[module.state.cvId];
    } else {
        freqCvModule = null;
    }

    $: if (module.state.cvId2 != null) {
        detuneCvModule = $modules[module.state.cvId2];
    } else {
        detuneCvModule = null;
    }

    let voct = Math.log2(440);

	let oscNode = $context.createOscillator();
    
    module.output = oscNode;
    module.cv = oscNode.frequency;
    module.cv2 = oscNode.detune;

    $: if ($midi.voct) voct = $midi.voct;

    let totalFrequency
    $: totalFrequency = Math.pow(2, voct + module.state.frequency);

    $: oscNode.frequency.linearRampToValueAtTime(totalFrequency, $context.currentTime + 0.03);
    $: oscNode.detune.linearRampToValueAtTime(module.state.detune, $context.currentTime + 0.03);
    $: oscNode.type = module.state.shape;
    
    oscNode.start(0);

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
    function setHelpBtn(node) { helpBtn = node; }
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
    function setFreqCvBtn(node) {
        freqCvBtn = node;
        freqCvBtn.addEventListener("mouseenter", () => {
            if ($selectingModule == null) freqCvBtn.style.opacity = 0.8;
        });
        freqCvBtn.addEventListener("mouseleave", () => {
            if ($selectingModule == null) freqCvBtn.style.opacity = 1;
        });
    }
    function setDetuneCvBtn(node) {
        detuneCvBtn = node;
        detuneCvBtn.addEventListener("mouseenter", () => {
            if ($selectingModule == null) detuneCvBtn.style.opacity = 0.8;
        });
        detuneCvBtn.addEventListener("mouseleave", () => {
            if ($selectingModule == null) detuneCvBtn.style.opacity = 1;
        });
    }
    function setHelpDiv(node) {
        helpDiv = node;
        helpDiv.style.display = "none";
    }
    function setNotHelpDiv(node) { notHelpDiv = node; }

    var currentFreqCvModule;

    $: if (!module.destroyed) {
        if (freqCvModule) {
            oscNode.frequency.cancelScheduledValues($context.currentTime);
            oscNode.frequency.linearRampToValueAtTime(0, $context.currentTime);
            if (currentFreqCvModule) {
                if (currentFreqCvModule.outputs[module.state.id+".1"]); currentFreqCvModule.removeOutput(module.state.id+".1", module.cv);
            }
            currentFreqCvModule = freqCvModule;
            if (!currentFreqCvModule.outputs[module.state.id+".1"]) currentFreqCvModule.addOutput(module.state.id+".1", module.cv);
        } else {
            oscNode.frequency.cancelScheduledValues($context.currentTime);
            oscNode.frequency.linearRampToValueAtTime(totalFrequency, $context.currentTime);
            if (currentFreqCvModule) {
                if (currentFreqCvModule.outputs[module.state.id+".1"]) currentFreqCvModule.removeOutput(module.state.id+".1", module.cv);
            }
            currentFreqCvModule = null;
        }
    }

    $: if (currentFreqCvModule) {
        currentFreqCvModule.setGain(module.state.id+".1", totalFrequency);
    }

    let currentDetuneCvModule;

    $: if (!module.destroyed) {
        if (detuneCvModule) {
            oscNode.detune.cancelScheduledValues($context.currentTime);
            oscNode.detune.linearRampToValueAtTime(0, $context.currentTime + 0.01);
            if (currentDetuneCvModule) {
                if (currentDetuneCvModule.outputs[module.state.id+".2"]); currentDetuneCvModule.removeOutput(module.state.id+".2", module.cv2);
            }
            currentDetuneCvModule = detuneCvModule;
            if (!currentDetuneCvModule.outputs[module.state.id+".2"]) currentDetuneCvModule.addOutput(module.state.id+".2", module.cv2);
        } else {
            oscNode.detune.cancelScheduledValues($context.currentTime);
            oscNode.detune.linearRampToValueAtTime(module.state.detune, $context.currentTime + 0.01);
            if (currentDetuneCvModule) {
                if (currentDetuneCvModule.outputs[module.state.id+".2"]) currentDetuneCvModule.removeOutput(module.state.id+".2", module.cv2);
            }
            currentDetuneCvModule = null;
        }
    }

    $: if (currentDetuneCvModule) {
        currentDetuneCvModule.setGain(module.state.id+".2", module.state.detune);
    }

    module.clearCurrents = () => {
        freqCvModule = null;
        currentFreqCvModule = null;
        detuneCvModule = null;
        currentDetuneCvModule = null;
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
            nodeSize = { x: 320, y: 550 };
        } else {
            nodeSize = { x: 320, y: 420 };
        }
    }

    module.cvSelecting = null;

    function chooseCv(i) {
        module.cvSelecting = i;
        cvsAllHover(module, i);
        if (!freqCvBtn) return;
        if (!module.selectingCv) {
            module.selectingCv = true;
            if (module.cvSelecting == 0) {
                freqCvBtn.style.opacity = 0.5;
            } else {
                detuneCvBtn.style.opacity = 0.5;
            }
            $selectingModule = module.state.id;
        } else {
            module.selectingCv = false;
        }
    }

    module.select = (id) => {
        if (module.selectingCv) {
            if (module.cvSelecting == 0) {
                module.state.cvId = id;
                freqCvBtn.style.opacity = 1;
            }
            else {
                module.state.cvId2 = id;
                detuneCvBtn.style.opacity = 1;
            }
            module.selectingCv = false;
        }
        $selectingModule = null;
        unhover();
    }

    $: if (!module.destroyed) {
        if (freqCvBtn) {
            if (module.state.cvId != null) {
                freqCvBtn.style.backgroundColor = $colours[$modules[module.state.cvId].state.type];
            } else {
                freqCvBtn.style.backgroundColor = "#f0f0f0";
            }
        }
        if (detuneCvBtn) {
            if (module.state.cvId2 != null) {
                detuneCvBtn.style.backgroundColor = $colours[$modules[module.state.cvId2].state.type];
            } else {
                detuneCvBtn.style.backgroundColor = "#f0f0f0";
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
    <ModuleMovement bind:moduleNode bind:controlsNode bind:deleteNode bind:helpBtn bind:nodePos={state.position} bind:nodeSize bind:bobSize />
    <div id="module" use:setModule style={"background-color: " + $colours[module.state.type]}>
    <div class="delete" use:setDelete><DeleteButton module={module} /></div>
    <div class="help" use:setHelpBtn><HelpButton module={module} /></div>
    <h1>{module.state.id}</h1>
    <div class="controls" use:setControls>
        <h2 class='editableTitle' use:setTitleNode bind:textContent={$modules[module.state.id].state.title} contenteditable='true' >{module.state.title}</h2>

        <div use:setNotHelpDiv>
        <div class='inputDiv' on:mouseenter={() => {cvsAllHover(module, 0)}} on:mouseleave={() => {if ($selectingModule == null) unhover();}}>
            <label><button use:setFreqCvBtn on:click={() => chooseCv(0)}>
                {#if module.state.cvId != null && $modules[module.state.cvId]}
                    {module.state.cvId} {$modules[module.state.cvId].state.title}
                {:else}
                    None
                {/if}
        </button> Control</label></div>
        <label for="freq">Frequency ({totalFrequency.toFixed(1)}Hz)</label><input id="freq" bind:value={module.state.frequency} type='range' min='-2' max='2' step='0.083333333333333'>
        <br><br>

        <div class='inputDiv' on:mouseenter={() => {cvsAllHover(module, 1)}} on:mouseleave={() => {if ($selectingModule == null) unhover();}}>
            <label><button use:setDetuneCvBtn on:click={() => chooseCv(1)}>
                {#if module.state.cvId2 != null && $modules[module.state.cvId2]}
                    {module.state.cvId2} {$modules[module.state.cvId2].state.title}
                {:else}
                    None
                {/if}
        </button> Control</label></div>
        <label for="detune">Detune ({module.state.detune} cents)</label><input id="detune" bind:value={module.state.detune} type='range' min='-100' max='100' step='1'>

        <br><section class="shape">
            <input id={'sine'+module.state.id} type='radio' value='sine' bind:group={module.state.shape} /><label for={'sine'+module.state.id}>Sine</label>
            <input id ={'triangle'+module.state.id} type='radio' value='triangle' bind:group={module.state.shape} /><label for={'triangle'+module.state.id}>Triangle</label>
            <input id={'sawtooth'+module.state.id} type='radio' value='sawtooth' bind:group={module.state.shape} /><label for={'sawtooth'+module.state.id}>Sawtooth</label>
            <input id={'square'+module.state.id} type='radio' value='square' bind:group={module.state.shape} /><label for={'square'+module.state.id}>Square</label>
        </section>
        </div>
    </div>
    <div use:setHelpDiv>
        <p>Produces a basic sound wave - the primary starting module of most synth patches.<br><br>
            Pressing keyboard keys changes the pitch of the sound wave, following a piano-like arrangement.<br><br>
            Frequency parameter also changes the pitch, and can be automated with its Control selector.<br><br>
            Detune parameter causes subtle pitch adjustment, and can also be automated.<br><br>
            Selecting an LFO for Detune Control causes vibrato effect.<br><br>

        </p>
    </div>
</div>
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

<svelte:window />