<script>
	import MIDI from './MIDI.svelte';
	import VCO from './VCO.svelte';
	import Output from './Output.svelte';
	import VCA from './VCA.svelte';
	import ADSR from './ADSR.svelte';
	import VCF from './VCF.svelte';

    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = new AudioContext();

	let vcaOutput1;
	let vcaOutput2;
	let vcoOutput;
	let vcaInputCv;
	let voct;
	let vcacv1;
	let vcaInputMax;
	let vcacv2;
	let trigger;
	let vcfOutput;
	let vcfInputCv;
	let vcfInputMax;

	const handleVCO = (event) => {
		vcoOutput = event.detail.output;
	}

	const handleMIDI = (event) => {
		voct = event.detail.output;
		trigger = event.detail.trigger;
	}

	const handleVCA = (event) => {
		vcaOutput1 = event.detail.output;
		vcaInputCv = event.detail.cv_in;
		vcaInputMax = event.detail.max_cv;
	}

	const handleVCF = (event) => {
		vcfOutput = event.detail.output;
		vcfInputCv = event.detail.cv_in;
		vcfInputMax = event.detail.max_cv;
	}
</script>

<main>
	<MIDI on:signal={handleMIDI} />
	<VCO bind:ctx bind:voctIn={voct} on:signal={handleVCO} />
	<br>
	<ADSR bind:ctx bind:trigger bind:cv_out={vcfInputCv} bind:max_cv={vcfInputMax} />
	<VCF bind:ctx bind:input={vcaOutput1} on:signal={handleVCF} />
	<br>
	<ADSR bind:ctx bind:trigger bind:cv_out={vcaInputCv} bind:max_cv={vcaInputMax} />
	<VCA bind:ctx bind:input={vcoOutput} on:signal={handleVCA} />
	<br>
	<Output bind:ctx bind:input={vcfOutput} />
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