<script>
	import { context, modules } from './stores.js';
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

	const addModule = (type) => {
		mods.push(type);
		mods = mods;
	}

	const save = () => {
		Object.entries($modules).forEach(module => {
			console.log(module[1].state)
		});
	}
</script>

<main>
	<button on:click={save}>Save patch</button>
	<button on:click={() => addModule(VCO)}>Add Oscillator</button>
	<button on:click={() => addModule(VCA)}>Add Amplifier</button>
	<button on:click={() => addModule(VCF)}>Add Filter</button>
	<button on:click={() => addModule(ADSR)}>Add Envelope</button>
	<button on:click={() => addModule(Mixer)}>Add Mixer</button>
	<MIDI />
	<Output />
	<div class="modules">
	{#each mods as m}
		<svelte:component this={m} />
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