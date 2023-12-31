<script>
	import MIDI from './MIDI.svelte';
	import VCO from './VCO.svelte';
	import Output from './Output.svelte';
	import VCA from './VCA.svelte';

    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = new AudioContext();

	let vcaOutput;
	let vcoOutput;
	let voct;
	let vcacv;

	const handleVCO = (event) => {
		vcoOutput = event.detail.output;
	}

	const handleMIDI = (event) => {
		voct = event.detail.output;
	}

	const handleVCA = (event) => {
		vcaOutput = event.detail.output;
	}
</script>

<main>
	<MIDI on:signal={handleMIDI} ></MIDI>
	<VCO bind:ctx bind:voct on:signal={handleVCO} />
	<VCA bind:ctx bind:cv={vcacv} bind:input={vcoOutput} on:signal={handleVCA} />
	<Output bind:ctx bind:input={vcaOutput} />
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