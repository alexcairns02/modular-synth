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
</script>

<main>
	<MIDI />
	<Output />
	<VCO />
	<VCO />
	<Mixer />
	<ADSR />
	<VCF />
	<ADSR />
	<VCA />
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 500px;
		margin: 0 auto;
	}
</style>