<script>
	import { context, modules, output } from './stores.js';
	import fileDialog from 'file-dialog';
	import MIDI from './MIDI.svelte';
	import VCO from './VCO.svelte';
	import Output from './Output.svelte';
	import VCA from './VCA.svelte';
	import ADSR from './ADSR.svelte';
	import VCF from './VCF.svelte';
	import Mixer from './Mixer.svelte';
    import LFO from './LFO.svelte';
    import { destroyModule } from './utils.js';

	const DEBUG = false;

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

	const debugPatch = [{
		"type": "vco",
		"frequency": 0,
		"shape": "sine",
		"id": 0,
		"position": {
		"x": 308,
		"y": 102
		}
	}, {
		"type": "vca",
		"gain": 1,
		"id": 1,
		"inputId": null,
		"cvId": null,
		"position": {
		"x": 659,
		"y": 81
		}
	},
	{
		"type": "vcf",
		"voct": 14.1357092861044,
		"filterType": "lowpass",
		"id": 2,
		"inputId": null,
		"cvId": null,
		"position": {
		"x": 993,
		"y": 58
		}
	},
	{
		"type": "adsr",
		"attack": 0.1,
		"decay": 0.1,
		"sustain": 0.5,
		"release": 0.1,
		"id": 3,
		"position": {
		"x": 327,
		"y": 537
		}
	},
	{
		"type": "mixer",
		"id": 4,
		"inputIds": [
		null,
		null,
		null,
		null
		],
		"position": {
		"x": 837,
		"y": 553
		}
	}
	]

	if (DEBUG) addPatch(debugPatch);
</script>

<main>
	<div class="menu">
		<button on:click={save}>Save patch</button>
		<button on:click={load}>Load patch</button>
		<button on:click={() => addModule(VCO)}>Add Oscillator</button>
		<button on:click={() => addModule(VCA)}>Add Amplifier</button>
		<button on:click={() => addModule(VCF)}>Add Filter</button>
		<button on:click={() => addModule(ADSR)}>Add Envelope</button>
		<button on:click={() => addModule(Mixer)}>Add Mixer</button>
		<button on:click={() => addModule(LFO)}>Add LFO</button>
		<button on:click={clear}>Clear Patch</button>
		<MIDI />
		<Output />
	</div>
	<div class="modules">
	{#each mods as m}
		<svelte:component this={m.type} {...m.props} />
	{/each}
	</div>
</main>

<style>
	main {
        font-family: "Monaco", monospace;
		color: "#222222";
	}

	.modules {
		text-align: center;
		padding: 1em;
		max-width: 500px;
		margin: 0 auto;
	}

	.menu {
		position: relative;
		z-index: 1;
		pointer-events: none;
	}

	button {
		pointer-events: all;
	}
</style>