<script>
	import MIDI from './MIDI.svelte';
	import VCO from './VCO.svelte';
	import Output from './Output.svelte';

    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = new AudioContext();

	let input;
	let voct;

	const handle = (event) => {
		input = event.detail.output;
	}

	const handleMIDI = (event) => {
		voct = event.detail.output;
	}
</script>

<main>
	<MIDI on:signal={handleMIDI} ></MIDI>
	<VCO bind:ctx bind:voct on:signal={handle} />
	<Output bind:ctx bind:input />
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