<script>
    import { createEventDispatcher } from "svelte";

    export let ctx;

    const dispach = createEventDispatcher();

	let o = ctx.createOscillator();

    let octave = 0;

    let note = 'A';
    let octUp = 0;

    o.frequency.value = 440;
    o.connect(ctx.destination);
    o.start(0);

    const handle = () => dispach('signal', {output: o});

    function onKeyDown(e) {
        let freqChanged = false;
        octUp = 0;

        switch(e.keyCode) {
            case 61: //=
                octave += 1;
                break;
            case 173: //-
                octave -= 1;
                break;
            
            case 90: //Z
                o.frequency.value = 261.63; //C4
                freqChanged = true;
                note = 'C';
                break;
            case 83: //S
                o.frequency.value = 277.18;
                freqChanged = true;
                note = 'C#/Db';
                break;
            case 88: //X
                o.frequency.value = 293.66; //D4
                freqChanged = true;
                note = 'D';
                break;
            case 68: //D
                o.frequency.value = 311.13;
                freqChanged = true;
                note = 'D#/Eb';
                break;
            case 67: //C
                o.frequency.value = 329.63; //E4
                freqChanged = true;
                note = 'E';
                break;
            case 86: //V
                o.frequency.value = 349.23;
                freqChanged = true;
                note = 'F';
                break;
            case 71: //G
                o.frequency.value = 369.99;
                freqChanged = true;
                note = 'F#/Gb';
                break;
            case 66: //B
                o.frequency.value = 392.00;
                freqChanged = true;
                note = 'G';
                break;
            case 72: //H
                o.frequency.value = 415.30;
                freqChanged = true;
                note = 'G#/Ab';
                break;
            case 78: //N
                o.frequency.value = 440.00;
                freqChanged = true;
                note = 'A';
                break;
            case 74: //J
                o.frequency.value = 466.16;
                freqChanged = true;
                note = 'A#/Bb';
                break;
            case 77: //M
                o.frequency.value = 493.88;
                freqChanged = true;
                note = 'B';
                break;
            case 188: //,
                o.frequency.value = 523.25;
                freqChanged = true;
                note = 'C';
                octUp = 1;
                break;
            case 76: //L
                o.frequency.value = 554.37;
                freqChanged = true;
                note = 'C#/Db';
                octUp = 1;
                break;
            case 190: //.
                o.frequency.value = 587.33;
                freqChanged = true;
                note = 'D';
                octUp = 1;
                break;
            case 59: //;
                o.frequency.value = 622.25;
                freqChanged = true;
                note = 'D#/Eb';
                octUp = 1;
                break;
            case 191: ///
                o.frequency.value = 659.25;
                freqChanged = true;
                note = 'E';
                octUp = 1;
                break;
        }

        if (freqChanged) {
            if (octave > 0) {
                for (let i=0; i < octave; i++) {
                    o.frequency.value *= 2;
                }
            } else {
                for (let i=0; i > octave; i--) {
                    o.frequency.value /= 2;
                }
            }
        }
    }
</script>

<main>
<div>
    <h2>VCO</h2>
    <h3>{note}{octave+4+octUp}</h3>
    <label><input bind:value={o.frequency.value} type='range' min='20' max='18000' step='1'>Freq</label>
    <section>
        <label>
            <input type='radio' value='sine' bind:group={o.type} /> Sine
        </label>
        <label>
            <input type='radio' value='triangle' bind:group={o.type} /> Triangle
        </label>
        <label>
            <input type='radio' value='sawtooth' bind:group={o.type} /> Sawtooth
        </label>
        <label>
            <input type='radio' value='square' bind:group={o.type} /> Square
        </label>
    </section>
</div> 
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window use:handle on:keydown|preventDefault={onKeyDown} />