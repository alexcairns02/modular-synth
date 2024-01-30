<script>
	import { context, modules } from './stores.js';
	import fileDialog from 'file-dialog';
	import MIDI from './MIDI.svelte';
	import VCO from './VCO.svelte';
	import Output from './Output.svelte';
	import VCA from './VCA.svelte';
	import ADSR from './ADSR.svelte';
	import VCF from './VCF.svelte';
	import Mixer from './Mixer.svelte';

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
			module.destroy();
		});
		patch.forEach((module) => {
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
			}
		});
	};

	const save = () => {
		const patch = [];
		Object.entries($modules).forEach(module => {
			patch.push(module[1].state);
		});
		
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
</script>

<main>
	<button on:click={save}>Save patch</button>
	<button on:click={load}>Load patch</button>
	<button on:click={() => addModule(VCO)}>Add Oscillator</button>
	<button on:click={() => addModule(VCA)}>Add Amplifier</button>
	<button on:click={() => addModule(VCF)}>Add Filter</button>
	<button on:click={() => addModule(ADSR)}>Add Envelope</button>
	<button on:click={() => addModule(Mixer)}>Add Mixer</button>
	<MIDI />
	<Output />
	<div class="modules">
	{#each mods as m}
		<svelte:component this={m.type} {...m.props} />
	{/each}
	</div>
</main>

<style>
	.modules {
		text-align: center;
		padding: 1em;
		max-width: 500px;
		margin: 0 auto;
	}
</style>