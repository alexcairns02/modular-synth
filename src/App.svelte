<script>
	import VCO from './VCO.svelte';
	import Output from './Output.svelte';

	export let name;
	
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var ctx = new AudioContext();

	var o = ctx.createOscillator();
</script>

<main>
	<VCO bind:ctx bind:o/>
	<Output bind:ctx bind:o/>
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