<script>
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    let octave = 4;

    let note = 'A';
    let octUp = 0;

    let frequency = 440;

    const handle = () => dispatch('signal', {output: Math.log2(frequency)});

    function onKeyDown(e) {
        let freqChanged = false;
        octUp = 0;

        switch(e.keyCode) {
            case 61: //=
                if (octave < 10) {
                    octave += 1;
                    frequency *= 2;
                }
                break;
            case 173: //-
                if (octave > -2) {
                    octave -= 1;
                    frequency /= 2;
                }
                break;
            
            case 90: //Z
                frequency = 261.63; //C4
                freqChanged = true;
                note = 'C';
                break;
            case 83: //S
                frequency = 277.18;
                freqChanged = true;
                note = 'C#/Db';
                break;
            case 88: //X
                frequency = 293.66; //D4
                freqChanged = true;
                note = 'D';
                break;
            case 68: //D
                frequency = 311.13;
                freqChanged = true;
                note = 'D#/Eb';
                break;
            case 67: //C
                frequency = 329.63; //E4
                freqChanged = true;
                note = 'E';
                break;
            case 86: //V
                frequency = 349.23;
                freqChanged = true;
                note = 'F';
                break;
            case 71: //G
                frequency = 369.99;
                freqChanged = true;
                note = 'F#/Gb';
                break;
            case 66: //B
                frequency = 392.00;
                freqChanged = true;
                note = 'G';
                break;
            case 72: //H
                frequency = 415.30;
                freqChanged = true;
                note = 'G#/Ab';
                break;
            case 78: //N
                frequency = 440.00;
                freqChanged = true;
                note = 'A';
                break;
            case 74: //J
                frequency = 466.16;
                freqChanged = true;
                note = 'A#/Bb';
                break;
            case 77: //M
                frequency = 493.88;
                freqChanged = true;
                note = 'B';
                break;
            case 188: //,
                frequency = 523.25;
                freqChanged = true;
                note = 'C';
                octUp = 1;
                break;
            case 76: //L
                frequency = 554.37;
                freqChanged = true;
                note = 'C#/Db';
                octUp = 1;
                break;
            case 190: //.
                frequency = 587.33;
                freqChanged = true;
                note = 'D';
                octUp = 1;
                break;
            case 59: //;
                frequency = 622.25;
                freqChanged = true;
                note = 'D#/Eb';
                octUp = 1;
                break;
            case 191: ///
                frequency = 659.25;
                freqChanged = true;
                note = 'E';
                octUp = 1;
                break;
        }

        if (freqChanged) {
            if (octave > 4) {
                for (let i=4; i < octave; i++) {
                    frequency *= 2;
                }
            } else {
                for (let i=4; i > octave; i--) {
                    frequency /= 2;
                }
            }
        }

        handle();
    }
</script>

<main>
<div>
    <h2>MIDI</h2>
    <h3>{note}{octave+octUp}</h3>
</div> 
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window on:keydown|preventDefault={onKeyDown} />