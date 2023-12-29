<script>
	import VCO from './VCO.svelte';
	import Output from './Output.svelte';

    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = new AudioContext();

	let input;
	let connected = false;

	const handle = (event) => {
		console.log('hii');
		input = event.detail.o;
		connected = true;
	}
</script>

<main>
	<h1>Modular Synthesiser</h1>
	<VCO bind:ctx on:message={handle} />
	{#if connected}<Output bind:ctx bind:input />{/if}
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
</style>