<script>
	import Component from 'svelte-tag';

	import MIDI from './MIDI.svelte';
	import VCO from './VCO.svelte';
	import Output from './Output.svelte';
	import VCA from './VCA.svelte';
	import ADSR from './ADSR.svelte';
	import VCF from './VCF.svelte';

    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = new AudioContext();

	const vco = {
		output: null,
		handle: (event) => {
			vco.output = event.detail.output;
		}
	}

	const midi = {
		comp: MIDI,
		voct: null,
		trigger: null,
		handle: (event) => {
			midi.voct = event.detail.output;
			midi.trigger = event.detail.trigger;
		}
	}

	const vcf = {
		output: null,
		cv: null,
		cvmax: null,
		hasEnv: false,
		handle: (event) => {
			vcf.output = event.detail.output;
			vcf.cv = event.detail.cv_in;
			vcf.cvmax = event.detail.max_cv;
		}
	}

	const vca = {
		output: null,
		cv: null,
		cvmax: null,
		hasEnv: false,
		handle: (event) => {
			vca.output = event.detail.output;
			vca.cv = event.detail.cv_in;
			vca.cvmax = event.detail.max_cv;
		}
	}
</script>

<main>
	<svelte:component this={midi.comp} on:input={midi.handle} />
	<VCO bind:ctx bind:voctIn={midi.voct} on:connect={vco.handle} />
	<br>
	<input type='checkbox' bind:checked={vcf.hasEnv} />
	{#if vcf.hasEnv}
		<ADSR bind:ctx bind:trigger={midi.trigger} bind:cv_out={vcf.cv} bind:max_cv={vcf.cvmax} />
	{/if}
	<VCF bind:ctx bind:input={vco.output} on:connect={vcf.handle} />
	<br>
	<input type='checkbox' bind:checked={vca.hasEnv} />
	{#if vca.hasEnv}
		<ADSR bind:ctx bind:trigger={midi.trigger} bind:cv_out={vca.cv} bind:max_cv={vca.cvmax} />
	{/if}
	<VCA bind:ctx bind:input={vcf.output} on:connect={vca.handle} />
	<br>
	<Output bind:ctx bind:input={vca.output} />
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