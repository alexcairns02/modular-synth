<script>
	import { context, modules, output } from './stores.js';
	import fileDialog from 'file-dialog';
	import MIDI from './MIDI.svelte';
	import Output from './Output.svelte';
	import VCO from './modules/VCO.svelte';
	import VCA from './modules/VCA.svelte';
	import ADSR from './modules/ADSR.svelte';
	import VCF from './modules/VCF.svelte';
	import Mixer from './modules/Mixer.svelte';
    import LFO from './modules/LFO.svelte';
	import Delay from './modules/Delay.svelte';
    import { destroyModule } from './utils.js';

	const DEBUG = false;

	window.mobileCheck = function() {
		let check = false;
		(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
		return check;
	};

	let buttons;

	function setButtons(node) {
		buttons = node;
		buttons.childNodes.forEach((button) => {
			if (button.childNodes.length > 1) {
				button.childNodes.forEach((button) => {
					button.addEventListener("mouseenter", () => {
						button.style.opacity = 0.8;
					});
					button.addEventListener("mouseleave", () => {
						button.style.opacity = 1;
					});
				});
			} else {
				button.addEventListener("mouseenter", () => {
					button.style.opacity = 0.8;
				});
				button.addEventListener("mouseleave", () => {
					button.style.opacity = 1;
				});
			}
		});
	}

    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = new AudioContext();
	$context = ctx;

	var mods = [];

	const addModule = (type, props={}) => {
		mods.push({type, props});
		mods = mods;
	};

	const addPatch = (patch) => {
		Object.values($modules).forEach((module) => {
			destroyModule(module);
		});
		patch.modules.forEach((module) => {
			switch (module.type) {
				case "vco":
					addModule(VCO, {state: module});
					break;
				case "mixer":
					addModule(Mixer, {state: module});
					break;
				case "vca":
					addModule(VCA, {state: module});
					break;
				case "vcf":
					addModule(VCF, {state: module});
					break;
				case "adsr":
					addModule(ADSR, {state: module});
					break;
				case "lfo":
					addModule(LFO, {state: module});
					break;
				case "delay":
					addModule(Delay, {state: module});
					break;
			}
		});
		$output.state = patch.output;
	};

	const save = () => {
		const patchModules = [];
		Object.entries($modules).forEach(module => {
			patchModules.push(module[1].state);
		});
		
		const patch = {output: $output.state, modules: patchModules};

		const json = JSON.stringify(patch);

		var a = document.createElement("a");
		var file = new Blob([json], {type: "text/plain"});
		a.href = URL.createObjectURL(file);
		a.download = "patch.json";
		a.click();
	};

	const load = () => {
		fileDialog().then((files) => {
			try {
				if (files && files.length == 1) {
					const fileReader = new FileReader();
					
					fileReader.onload = (event) => {
						if (typeof event.target.result == "string") {
							const patch = JSON.parse(event.target.result);

							addPatch(patch);
						}
					}

					fileReader.readAsText(files[0]);
				}
			} catch (e) {
				console.log(e);
			}
		})
	};

	const clear = () => addPatch({output: {volume: $output.state.volume, inputId: null}, modules: []});

	const debugPatch = {"output":{"volume":0.2,"inputId":1},"modules":[{"type":"vco","frequency":0,"shape":"sine","id":0,"title":"Oscillator","position":{"x":350,"y":100}},{"type":"vca","gain":1,"id":1,"inputId":0,"cvId":null,"title":"out","position":{"x":656,"y":241}}]};

	if (DEBUG) addPatch({ ...debugPatch });
</script>

<html lang="UTF-8">
<body>
<main>
	{#if !window.mobileCheck()}
	<div class="menu">
		<div use:setButtons>
		<button on:click={save}>Save Patch</button>
		<button on:click={load}>Load Patch</button>
		<button id='vcoBtn' on:click={() => addModule(VCO)}>Add Oscillator</button>
		<button id='vcaBtn' on:click={() => addModule(VCA)}>Add Amplifier</button>
		<button id='vcfBtn' on:click={() => addModule(VCF)}>Add Filter</button>
		<button id='mixerBtn' on:click={() => addModule(Mixer)}>Add Mixer</button>
		<button id='adsrBtn' on:click={() => addModule(ADSR)}>Add Envelope</button>
		<button id='lfoBtn' on:click={() => addModule(LFO)}>Add LFO</button>
		<!--<button id='delayBtn' on:click={() => addModule(Delay)}>Add Delay</button>-->
		<button on:click={clear}>Clear Patch</button>
		<div class="demos">
			<button id='demo1' on:click={() => addPatch({"output":{"volume":0.5,"inputId":8},"modules":[{"type":"vcf","voct":10.5078280948874,"filterType":"lowpass","id":0,"inputId":3,"cvId":1,"title":"Filter","position":{"x":640,"y":528}},{"type":"adsr","attack":0,"decay":0.077,"sustain":0.058,"release":0.035,"id":1,"title":"Envelope","position":{"x":318,"y":513}},{"type":"vco","frequency":0,"detune":0,"shape":"sawtooth","id":2,"title":"Oscillator","cvId":null,"cvId2":null,"position":{"x":302,"y":66}},{"type":"mixer","id":3,"inputIds":[2,4,null,null],"title":"Mixer","position":{"x":979,"y":77}},{"type":"vco","frequency":0,"detune":7,"shape":"sawtooth","id":4,"title":"Oscillator","cvId":null,"cvId2":null,"position":{"x":637,"y":68}},{"type":"vco","frequency":-1.08333333333334,"detune":-2,"shape":"sine","id":5,"title":"Oscillator","cvId":null,"cvId2":null,"position":{"x":311,"y":930}},{"type":"mixer","id":6,"inputIds":[0,7,null,null],"title":"Mixer","position":{"x":321,"y":1384}},{"type":"vca","gain":1,"id":7,"inputId":5,"cvId":1,"title":"Amplifier","position":{"x":661,"y":940}},{"type":"vcf","voct":11.2724280948874,"filterType":"lowpass","id":8,"inputId":6,"cvId":null,"title":"Filter","position":{"x":539,"y":1383}}]})}>Demo 1</button><br>
			<button id='demo2' on:click={() => addPatch({"output":{"volume":0.5,"inputId":3},"modules":[{"type":"vco","frequency":0,"detune":0,"shape":"sawtooth","id":0,"title":"Oscillator","cvId":null,"cvId2":null,"position":{"x":300,"y":53}},{"type":"vco","frequency":0,"detune":10,"shape":"sawtooth","id":1,"title":"Oscillator","cvId":null,"cvId2":null,"position":{"x":639,"y":52}},{"type":"mixer","id":2,"inputIds":[0,1,6,7],"title":"Mixer","position":{"x":310,"y":499}},{"type":"vcf","voct":9.53782809488736,"filterType":"lowpass","id":3,"inputId":2,"cvId":5,"title":"Filter","position":{"x":818,"y":503}},{"type":"adsr","attack":0.443,"decay":0.465,"sustain":0.433,"release":0.387,"id":5,"title":"Envelope","position":{"x":515,"y":501}},{"type":"vco","frequency":0.333333333333324,"detune":0,"shape":"square","id":6,"title":"Oscillator","cvId":null,"cvId2":null,"position":{"x":975,"y":52}},{"type":"vco","frequency":0.333333333333324,"detune":8,"shape":"square","id":7,"title":"Oscillator","cvId":null,"cvId2":null,"position":{"x":1311,"y":53}}]})}>Demo 2</button><br>
			<button id='demo3' on:click={() => addPatch({"output":{"volume":0.5,"inputId":3},"modules":[{"type":"vco","frequency":0,"detune":44,"shape":"sawtooth","id":0,"title":"Oscillator","cvId":2,"cvId2":1,"position":{"x":660,"y":65}},{"type":"lfo","frequency":6.3,"shape":"sine","id":1,"title":"LFO","position":{"x":315,"y":64}},{"type":"adsr","attack":0,"decay":0.041,"sustain":0.5,"release":0.022,"id":2,"title":"Envelope","position":{"x":319,"y":339}},{"type":"vcf","voct":10.5078280948874,"filterType":"lowpass","id":3,"inputId":0,"cvId":null,"title":"Filter","position":{"x":999,"y":64}}]})}>Demo 3</button><br>
		</div>
		</div>
		<MIDI />
		<Output />
	</div>
	<div class="modules">
	{#each mods as m}
		<svelte:component this={m.type} {...m.props} />
	{/each}
	</div>
	{:else}
	<h2>Mobile not yet supported</h2>
	{/if}
</main>
</body>
</html>

<style>
	:global(html) {
		background-color: #f4f4f4;
		opacity: 1;
		background-size: 12px 12px;
		background-image: repeating-linear-gradient(45deg, #f0f0f0 0, #f0f0f0 1.2000000000000002px, #f4f4f4 0, #f4f4f4 50%);
	}

	body {
		margin: 0;
		padding: 0;
	}

	main {
        font-family: "Monaco", monospace;
		font-size: 16px;
		color: "#222222";
		width: 100%;
		height: 100%;
	}

	.modules {
		text-align: center;
		padding: 1em;
		max-width: 500px;
		margin: 0 auto;
	}

	.menu {
		position: fixed;
		z-index: 1;
		pointer-events: none;
		width: 100%;
		height: 100%;
	}

	.demos {
		position: absolute;
		right: 15px;
		top: 0px;
		vertical-align: middle;
	}

	button {
		pointer-events: all;
		padding: 10px;
		background-color: #f0f0f0;
		border: solid #222222 1px;
	}

	#vcoBtn {
		background-color: #ff6666;
	}

	#vcaBtn {
		background-color: #88ff88;
	}

	#vcfBtn {
		background-color: #ff9955;
	}

	#adsrBtn {
		background-color: #7788ff;
	}

	#mixerBtn {
		background-color: #ffff77;
	}

	#lfoBtn {
		background-color: #dd88ff;
	}

	#delayBtn {
		background-color: #bbbbcc;
	}
    
    .inputDiv {
        margin-left: 70px;
        margin-right: 70px;
        padding: 5px;
    }
</style>