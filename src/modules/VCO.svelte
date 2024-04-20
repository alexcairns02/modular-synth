<script>
    import { modules, context, midi, colours, selectingModule, output, isTyping } from '../stores.js';
    import ModuleMovement from '../ModuleMovement.svelte';
    import DeleteButton from '../DeleteButton.svelte';
    import HelpButton from '../HelpButton.svelte';
    import { createNewId, setPosition, cvsAllHover, unhover } from '../utils.js';
    import { spring } from 'svelte/motion';

    // Default values for module state
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

    // Makes sure unspecified state inputs are set correctly (for old patch saves)
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

    // Module dimensions in px
    let nodeSize = { x: 320, y: 420 };

    // Module data is stored in modules store so that it can be accessed by other components
    $modules[state.id] = {};
    const module = $modules[state.id];
    module.state = state;
    module.isAudio = true; // Lets other modules know that this module outputs audio
    module.isControl = false; // Lets other modules know that this module does not output control signal
    module.showingHelp = false; // Whether the module component is displaying inputs or help info

    // If this is a newly added module, its initial position is calculated and set
    if (!module.state.position) module.state.position = setPosition();

    module.selectingCv = false; // If true, changes the effect of clicking on the module for CV selection

    let freqCvModule;
    let detuneCvModule;
    
    // Reactively sets the correct module as the frequency CV when the frequency CV ID is changed
    $: if (module.state.cvId != null) {
        freqCvModule = $modules[module.state.cvId];
    } else {
        freqCvModule = null;
    }

    // Reactively sets the correct module as the detune CV when the detune CV ID is changed
    $: if (module.state.cvId2 != null) {
        detuneCvModule = $modules[module.state.cvId2];
    } else {
        detuneCvModule = null;
    }

    // Initial frequency is 440Hz (A4)
    let voct = Math.log2(440);

    // Creates the OscillatorNode using the AudioContext
	let oscNode = $context.createOscillator();
    
    // Module's output is set as the OscillatorNode and CV signals are set as its frequency and detune parameters
    module.output = oscNode;
    module.cv = oscNode.frequency;
    module.cv2 = oscNode.detune;

    // Reactively sets our voct when a note input is given
    $: if ($midi.voct) voct = $midi.voct;

    // Reactively sets our frequency for the oscillator to be set to to be the note input frequency + the adjusted frequency from our module frequency parameter
    let totalFrequency
    $: totalFrequency = Math.pow(2, voct + module.state.frequency);

    // Reactively sets the OscillatorNode frequency and detune parameters to be our total frequency and detune respectively
    $: oscNode.frequency.linearRampToValueAtTime(totalFrequency, $context.currentTime + 0.03);
    $: oscNode.detune.linearRampToValueAtTime(module.state.detune, $context.currentTime + 0.03);

    // Reactively changes the OscillatorNode type when our type parameter is changed
    $: oscNode.type = module.state.shape;
    
    // Starts the oscillator
    oscNode.start(0);

    let moduleIsClicked = false; // Whether this module is in the middle of being clicked (mouse down event has occurred but not mouse up yet)
    let moduleTyping = false; // Whether the user is in the middle of changing the module's title

    // Mouse events for the entire window
    window.addEventListener("mouseup", () => {
        if (moduleIsClicked) moduleIsClicked = false;
    });
    window.addEventListener("mousedown", () => {
        $isTyping = false;
        moduleTyping = false;
        if (titleNode) titleNode.style.outline = "none";
    });

    // Sets our module's JS DOM element and adds all necessary event listeners
    function setModule(node) {
        moduleNode = node;
        moduleNode.addEventListener("mousedown", () => { moduleIsClicked = true; })
        moduleNode.addEventListener("mouseup", () => {
            if (moduleIsClicked) {
                // Mouse up event occured in module container after mouse down event in the container, module has been clicked

                if ($selectingModule == "output") {
                    // This module is set as the output component's input
                    $output.select(module.state.id);

                } else if ($selectingModule != null && $modules[$selectingModule].selectingInput
                    && $selectingModule != module.state.id
                    && ($modules[$selectingModule].state.type != "mixer" 
                    || (!$modules[$selectingModule].state.inputIds.includes(module.state.id)
                    || $modules[$selectingModule].state.inputIds[$modules[$selectingModule].inputSelecting] == module.state.id))) 
                {
                    // Module is set as the input of whatever module is trying to select an input
                    $modules[$selectingModule].select(module.state.id);

                } else if ($selectingModule == module.state.id) {
                    // If this is the module that is trying to select and it is clicked, selected input is set to None
                    module.select(null);
                }
            }
        });
    }
    // Sets the control div JS DOM element
    function setControls(node) { controlsNode = node; }
    // Sets the delete button JS DOM element
    function setDelete(node) { deleteNode = node; }
    // Sets the help button JS DOM element
    function setHelpBtn(node) { helpBtn = node; }
    // Sets the title box JS DOM element and adds necessary event listeners
    function setTitleNode(node) {
        titleNode = node;
        titleNode.addEventListener("mouseenter", () => {
            // Creates title box outline when mouse hovered over
            titleNode.style.outline = "2px solid #222222";
        });
        titleNode.addEventListener("mouseleave", () => {
            // Removes title box outline when mouse not hovered over
            if (!moduleTyping) titleNode.style.outline = "none";
        });
        titleNode.addEventListener("mousedown", () => {
            // If title clicked, we are set to title changing module, therefore pressing keys will not trigger note input
            setTimeout(() => {
                $isTyping = true;
                moduleTyping = true;
                titleNode.style.outline = "2px solid #222222";
            }, 10);
        });
    }
    // Sets the frequency CV selector JS DOM element and adds necessary event listeners
    function setFreqCvBtn(node) {
        freqCvBtn = node;
        freqCvBtn.addEventListener("mouseenter", () => {
            // Hovering over selector causes it to become slightly transparent
            if ($selectingModule == null) freqCvBtn.style.opacity = 0.8;
        });
        freqCvBtn.addEventListener("mouseleave", () => {
            // No longer hovering removes transparency
            if ($selectingModule == null) freqCvBtn.style.opacity = 1;
        });
    }
    // Sets the detune CV selector JS DOM element and adds necessary event listeners
    function setDetuneCvBtn(node) {
        detuneCvBtn = node;
        detuneCvBtn.addEventListener("mouseenter", () => {
            // Hovering over selector causes it to become slightly transparent
            if ($selectingModule == null) detuneCvBtn.style.opacity = 0.8;
        });
        detuneCvBtn.addEventListener("mouseleave", () => {
            // No longer hovering removes transparency
            if ($selectingModule == null) detuneCvBtn.style.opacity = 1;
        });
    }
    // Sets the help section div JS DOM element
    function setHelpDiv(node) {
        helpDiv = node;
        // Help div by default is not displayed
        helpDiv.style.display = "none";
    }
    // Sets the regular module parameters div JS DOM element (the non help section)
    function setNotHelpDiv(node) { notHelpDiv = node; }

    var currentFreqCvModule;

    // Reactive code block that is triggered when the frequency CV selector is changed
    $: if (!module.destroyed) {
        if (freqCvModule) {
            // If CV module is selected, we send this modules frequency param to that module to be manipulated
            oscNode.frequency.cancelScheduledValues($context.currentTime);
            oscNode.frequency.linearRampToValueAtTime(0, $context.currentTime);
            if (currentFreqCvModule) {
                if (currentFreqCvModule.outputs[module.state.id+".1"]); currentFreqCvModule.removeOutput(module.state.id+".1", module.cv);
            }
            currentFreqCvModule = freqCvModule;
            if (!currentFreqCvModule.outputs[module.state.id+".1"]) currentFreqCvModule.addOutput(module.state.id+".1", module.cv);
        } else {
            // If no CV module is selected, control of this module's frequency is localised
            oscNode.frequency.cancelScheduledValues($context.currentTime);
            oscNode.frequency.linearRampToValueAtTime(totalFrequency, $context.currentTime);
            if (currentFreqCvModule) {
                if (currentFreqCvModule.outputs[module.state.id+".1"]) currentFreqCvModule.removeOutput(module.state.id+".1", module.cv);
            }
            currentFreqCvModule = null;
        }
    }

    // If there is a frequency CV module, reactively changes the max frequency value of the modulation to what would otherwise be the frequency of the oscillator
    $: if (currentFreqCvModule) {
        currentFreqCvModule.setGain(module.state.id+".1", totalFrequency);
    }

    let currentDetuneCvModule;

    // Reactive code block that is triggered when the detune CV selector is changed
    $: if (!module.destroyed) {
        if (detuneCvModule) {
            // If CV module is selected, we send this modules detune param to that module to be manipulated
            oscNode.detune.cancelScheduledValues($context.currentTime);
            oscNode.detune.linearRampToValueAtTime(0, $context.currentTime + 0.01);
            if (currentDetuneCvModule) {
                if (currentDetuneCvModule.outputs[module.state.id+".2"]); currentDetuneCvModule.removeOutput(module.state.id+".2", module.cv2);
            }
            currentDetuneCvModule = detuneCvModule;
            if (!currentDetuneCvModule.outputs[module.state.id+".2"]) currentDetuneCvModule.addOutput(module.state.id+".2", module.cv2);
        } else {
            // If no CV module is selected, control of this module's detune is localised
            oscNode.detune.cancelScheduledValues($context.currentTime);
            oscNode.detune.linearRampToValueAtTime(module.state.detune, $context.currentTime + 0.01);
            if (currentDetuneCvModule) {
                if (currentDetuneCvModule.outputs[module.state.id+".2"]) currentDetuneCvModule.removeOutput(module.state.id+".2", module.cv2);
            }
            currentDetuneCvModule = null;
        }
    }

    // If there is a detune CV module, reactively changes the max detune value of the modulation to what would otherwise be the detune of the oscillator
    $: if (currentDetuneCvModule) {
        currentDetuneCvModule.setGain(module.state.id+".2", module.state.detune);
    }

    // Globally accessible function resets CV modules to None
    module.clearCurrents = () => {
        freqCvModule = null;
        currentFreqCvModule = null;
        detuneCvModule = null;
        currentDetuneCvModule = null;
    }
    
    // Spring variables for module opacity level and how much to expand when 'bobbing'
    let opacity = spring(1, {
        stiffness: 0.1,
        damping: 0.5
    });
    let bobSize = spring(0, {
        stiffness: 0.3,
        damping: 0.2
    });

    // Reactively sets the modules CSS opacity to our spring
    $: if (moduleNode) moduleNode.style.opacity = `${$opacity}`;

    // Globally accessible function to fade out this module
    module.fade = () => {
        opacity.set(0.2);
    }

    // Globally accessible function to stop fading out this module
    module.unfade = () => {
        opacity.set(1);
    }

    // Globally accessible function to make this module do a 'bob' animation
    module.bob = () => {
        bobSize.set(10);
        setTimeout(() => {
            bobSize.set(0);
        }, 50);
    }

    // Toggles between showing the module's parameters and its help section
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

        // Changes module size accordingly to accomodate its displayed content
        if (module.showingHelp) {
            nodeSize = { x: 320, y: 550 };
        } else {
            nodeSize = { x: 320, y: 420 };
        }
    }

    // Globally accessible module attribute - the CV module we are trying to select (freq or detune)
    module.cvSelecting = null;

    // Switches us into selecting mode
    // i: if 0, we are selecting a freq CV, if 1, we are selecting a detune CV
    function chooseCv(i) {
        module.cvSelecting = i;
        // Fades out unavailable modules for selection
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

    // Globally accessible function that sets this module's input as the module with the given ID
    module.select = (id) => {
        if (module.selectingCv) {
            // Sets the freq CV or detune CV accordingly
            if (module.cvSelecting == 0) {
                module.state.cvId = id;
                freqCvBtn.style.opacity = 1;
            }
            else {
                module.state.cvId2 = id;
                detuneCvBtn.style.opacity = 1;
            }
            // No longer selecting a CV as complete
            module.selectingCv = false;
        }
        // No longer is a module in selecting mode
        $selectingModule = null;

        // Causes faded out modules to unfade
        unhover();
    }

    // Reactively causes selector buttons to change colour to the colour of the selected module or grey if there is None
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

    // If we are in selecting mode, mouse clicks for buttons within the module are disabled
    $: if (controlsNode && deleteNode) {if ($selectingModule != null) {
        controlsNode.style.pointerEvents = "none";
        deleteNode.style.pointerEvents = "none";
    } else {
        controlsNode.style.pointerEvents = "all";
        deleteNode.style.pointerEvents = "all";
    }}
    
    // Causes this module to do a bob animation upon being created
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