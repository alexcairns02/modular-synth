<script>
	import { context } from './stores.js';
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

	var modules = [];

	const addModule = (type) => {
		modules.push(type);
		modules = modules;
	}
</script>

<main>
	<button on:click={() => addModule(VCO)}>Add Oscillator</button>
	<button on:click={() => addModule(Mixer)}>Add Mixer</button>
	<button on:click={() => addModule(VCA)}>Add Amplifier</button>
	<button on:click={() => addModule(VCF)}>Add Filter</button>
	<button on:click={() => addModule(ADSR)}>Add Envelope</button>
	<MIDI />
	<Output />
	{#each modules as m}
		<svelte:component this={m} />
	{/each}
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 500px;
		margin: 0 auto;
	}
</style>