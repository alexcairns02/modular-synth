<script>
    export var ctx;
    export var input;

    var gainNode = ctx.createGain();
    gainNode.gain.value = 0.2;
    gainNode.connect(ctx.destination);

    $: if (input) {
        input.connect(gainNode);
    }

    var playing = false;
    var muteUnmute = 'Unmute';

    function toggleMute() {
        if (playing) {
            playing = false;
            muteUnmute = 'Unmute';
            ctx.suspend();
        } else {
            playing = true;
            muteUnmute = 'Mute';
            ctx.resume();
        }
    }
</script>

<main>
    <div>
        <h2>Output</h2>
        <label><input bind:value={gainNode.gain.value} type='range' min='0' max='2' step='0.001'>Gain</label>
        <button on:click="{toggleMute}">{muteUnmute}</button>
    </div>
</main>

<style>
    div {
        border-style: solid;
    }
</style>