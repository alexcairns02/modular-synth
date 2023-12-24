<script>
    export var ctx;
    export var o;

    o.frequency.value = 440;
    o.connect(ctx.destination);
    var started = false;

    function startOsc() {
        if (!started) {
            started = true;
            o.start(0);
        }
    }
</script>

<main>
<div>
    <h2>VCO</h2>
	{#if !started}<button on:click="{startOsc}">Start</button>{/if}
    <label><input bind:value={o.frequency.value} type='range' min='20' max='18000' step='1'>Freq</label>
    <section>
        <label>
            <input type='radio' value='sine' bind:group={o.type} /> Sine
        </label>
        <label>
            <input type='radio' value='square' bind:group={o.type} /> Square
        </label>
        <label>
            <input type='radio' value='sawtooth' bind:group={o.type} /> Sawtooth
        </label>
    </section>
</div> 
</main>

<style>
    div {
        border-style: solid;
    }
</style>