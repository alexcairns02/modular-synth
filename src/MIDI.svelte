<script>
    import { createEventDispatcher } from "svelte";

    const dispatch = createEventDispatcher();

    let octChanged = false; // Whether key input was an octave change (no note is triggered)

    let octave = 4; // Updates when octave is changed
    let newOct = 4; // Only updates when a new note is played

    let frequency = 440;
    let trigger = false;
    
    let note = 'A'; // The note to be displayed
    
    let octUp = 0;
    let newOctUp = 0;

    function onKeyDown(e) {

        if (e.repeat) return // Prevents rapid trigger firing when key held down
        
        octChanged = false;
        octUp = 0;

        switch(e.keyCode) {
            case 61: //=
                octChanged = true;
                if (octave < 10) {
                    octave += 1;
                    frequency *= 2;
                }
                break;
            case 173: //-
                octChanged = true;
                if (octave > -2) {
                    octave -= 1;
                    frequency /= 2;
                }
                break;
            
            case 90: //Z
                frequency = 261.63; //C4
                note = 'C';
                break;
            case 83: //S
                frequency = 277.18;
                note = 'C#/Db';
                break;
            case 88: //X
                frequency = 293.66; //D4
                note = 'D';
                break;
            case 68: //D
                frequency = 311.13;
                note = 'D#/Eb';
                break;
            case 67: //C
                frequency = 329.63; //E4
                note = 'E';
                break;
            case 86: //V
                frequency = 349.23;
                note = 'F';
                break;
            case 71: //G
                frequency = 369.99;
                note = 'F#/Gb';
                break;
            case 66: //B
                frequency = 392.00;
                note = 'G';
                break;
            case 72: //H
                frequency = 415.30;
                note = 'G#/Ab';
                break;
            case 78: //N
                frequency = 440.00;
                note = 'A';
                break;
            case 74: //J
                frequency = 466.16;
                note = 'A#/Bb';
                break;
            case 77: //M
                frequency = 493.88;
                note = 'B';
                break;
            case 188: //,
                frequency = 523.25;
                note = 'C';
                octUp = 1;
                break;
            case 76: //L
                frequency = 554.37;
                note = 'C#/Db';
                octUp = 1;
                break;
            case 190: //.
                frequency = 587.33;
                note = 'D';
                octUp = 1;
                break;
            case 59: //;
                frequency = 622.25;
                note = 'D#/Eb';
                octUp = 1;
                break;
            case 191: ///
                frequency = 659.25;
                note = 'E';
                octUp = 1;
                break;

            case 32: //Space
                trigger = true;
                dispatch('input', {output: null, trigger: trigger });
                return;
        }

        if (!octChanged) {
            if (octave > 4) {
                for (let i=4; i < octave; i++) {
                    frequency *= 2;
                }
            } else {
                for (let i=4; i > octave; i--) {
                    frequency /= 2;
                }
            }

            trigger = true;

            newOct = octave;
            newOctUp = octUp;

            dispatch('input', {output: Math.log2(frequency), trigger: trigger });
        }

        
    }

    function onKeyUp(e) {
        trigger = false;
        dispatch('input', {output: null, trigger: trigger });
    }
</script>

<main>
<div>
    <h2>MIDI</h2>
    Play notes by pressing keys on keyboard. Row Z-/ is white notes, row A-' is black notes.
    <br>Press - to lower octave and = to raise octave. Press space to trigger envelope without giving note input.
    <h3>{note}{newOct+newOctUp}</h3>
</div> 
</main>

<style>
    div {
        border-style: solid;
    }
</style>

<svelte:window on:keydown|preventDefault={onKeyDown} on:keyup|preventDefault={onKeyUp} />