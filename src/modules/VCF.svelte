<script>
    import { modules, context, colours, selectingModule, output, isTyping } from '../stores.js';
    import ModuleMovement from '../ModuleMovement.svelte';
    import DeleteButton from '../DeleteButton.svelte';
    import HelpButton from '../HelpButton.svelte';
    import { createNewId, cvsAllHover, inputsAllHover, unhover, setPosition } from '../utils.js';
    import { spring } from 'svelte/motion';
    
    export let state = {
        type: 'vcf',
        voct: Math.log2(18000),
        filterType: 'lowpass',
        id: createNewId(),
        inputId: null,
        cvId: null,
        title: 'Filter'
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
    let inputBtn;
    let cvBtn;
    let titleNode;
    let helpBtn;
    let helpDiv;
    let notHelpDiv;

    let nodeSize = { x: 280, y: 350 };

    module.selectingInput = false;
    module.selectingCv = false;

    let cvModule;
    
    $: if (module.state.cvId != null) {
        cvModule = $modules[module.state.cvId];
    } else {
        cvModule = null;
    }

    var filterNode = $context.createBiquadFilter();

    module.output = filterNode;
    module.cv = filterNode.frequency;

    var frequency;
    $: frequency = Math.pow(2, module.state.voct);

    $: filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
    $: filterNode.type = module.state.filterType;

    var currentInput;

    $: if (!module.destroyed) {
        if (module.state.inputId != null && $modules[module.state.inputId] && $modules[module.state.inputId].output) {
            let input = $modules[module.state.inputId]
            if (currentInput) currentInput.disconnect(filterNode);
            currentInput = input.output;
            currentInput.connect(filterNode);
        } else {
            if (currentInput) currentInput.disconnect(filterNode);
            currentInput = null;
        }
    }

    var currentCvModule;

    $: if (!module.destroyed) {
        if (cvModule) {
            filterNode.frequency.cancelScheduledValues($context.currentTime);
            filterNode.frequency.setValueAtTime(0, $context.currentTime);
            if (currentCvModule) {
                if (currentCvModule.outputs[module.state.id+".1"]); currentCvModule.removeOutput(module.state.id+".1", module.cv);
            }
            currentCvModule = cvModule;
            if (!currentCvModule.outputs[module.state.id+".1"]) currentCvModule.addOutput(module.state.id+".1", module.cv);
        } else {
            filterNode.frequency.cancelScheduledValues($context.currentTime);
            filterNode.frequency.setValueAtTime(frequency, $context.currentTime);
            if (currentCvModule) {
                if (currentCvModule.outputs[module.state.id+".1"]); currentCvModule.removeOutput(module.state.id+".1", module.cv);
            }
            currentCvModule = null;
        }
    }

    $: if (currentCvModule) {
        currentCvModule.setGain(module.state.id+".1", frequency);
    }

    module.clearCurrents = () => {
        currentInput = null;
        cvModule = null;
        currentCvModule = null;
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
    function setCvBtn(node) {
        cvBtn = node;
        cvBtn.addEventListener("mouseenter", () => {
            if ($selectingModule == null) cvBtn.style.opacity = 0.8;
        });
        cvBtn.addEventListener("mouseleave", () => {
            if ($selectingModule == null) cvBtn.style.opacity = 1;
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
            nodeSize = { x: 280, y: 560 };
        } else {
            nodeSize = { x: 280, y: 350 };
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
        <h1>{module.state.id}</h1>
        <div class="delete" use:setDelete><DeleteButton module={module} /></div>
        <div class="help" use:setHelpBtn><HelpButton module={module} /></div>
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
        
                <div class='inputDiv' on:mouseenter={() => {cvsAllHover(module)}} on:mouseleave={() => {if ($selectingModule == null) unhover();}}>
                <label><button use:setCvBtn on:click={chooseCv}>
                    {#if module.state.cvId != null && $modules[module.state.cvId]}
                        {module.state.cvId} {$modules[module.state.cvId].state.title}
                    {:else}
                        None
                    {/if}
                </button> Control</label></div><br>

            <label for='freq'>Cutoff Frequency ({frequency.toFixed(1)}Hz)</label><input id='freq' bind:value={module.state.voct} type='range' min='{Math.log2(20)}' max='{Math.log2(18000)}' step='0.0001'>
            <br><section class="type">
                <input id={'lowpass'+module.state.id} type='radio' value='lowpass' bind:group={module.state.filterType} /><label for={'lowpass'+module.state.id}>Lowpass</label>
                <input id={'highpass'+module.state.id} type='radio' value='highpass' bind:group={module.state.filterType} /><label for={'highpass'+module.state.id}>Highpass</label>
                <input id={'bandpass'+module.state.id} type='radio' value='bandpass' bind:group={module.state.filterType} /><label for={'bandpass'+module.state.id}>Bandpass</label>
            </section>
            </div>
        </div>
        <div use:setHelpDiv>
            <p>Changes the timbre of an input signal by cutting out a range of frequencies.<br><br>
                Cutoff frequency changes the range of frequencies that are cut out, and can be automated with a Control module.<br><br>
                Lowpass mode cuts out frequencies above the cutoff.<br><br>
                Highpass mode cuts out frequencies below the cutoff.<br><br>
                Bandpass mode only preserves frequencies near to the cutoff.<br><br>
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

    .type input[type="radio"]:hover + label {
        color: #555555;
    }

    .type input[type="radio"]:active + label {
        color: #ffffff;
    }

    .type input[type="radio"]:checked + label {
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