<script>
	import MIDI from './MIDI.svelte';
	import VCO from './VCO.svelte';
	import Output from './Output.svelte';
	import VCA from './VCA.svelte';
	import ADSR from './ADSR.svelte';

    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = new AudioContext();

	let vcaOutput1;
	let vcaOutput2;
	let vcoOutput;
	let voct;
	let vcacv1;
	let vcacv2;
	let trigger;

	const handleVCO = (event) => {
		vcoOutput = event.detail.output;
	}

	const handleMIDI = (event) => {
		voct = event.detail.output;
		trigger = event.detail.trigger;
	}

	const handleVCA1 = (event) => {
		vcaOutput1 = event.detail.output;
	}

	const handleVCA2 = (event) => {
		vcaOutput2 = event.detail.output;
	}

	const handleADSR = (event) => {
		vcacv2 = event.detail.output;
	}
</script>

<main>
	<MIDI on:signal={handleMIDI} />
	<VCO bind:ctx bind:voct on:signal={handleVCO} />
	<ADSR bind:ctx bind:trigger bind:input={vcoOutput} on:signal={handleADSR} />
	<VCA bind:ctx bind:cv={vcacv1} bind:input={vcoOutput} on:signal={handleVCA1} />
	<Output bind:ctx bind:input={vcacv2} />
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>