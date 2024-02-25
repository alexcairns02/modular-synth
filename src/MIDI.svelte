<script>
    import { midi, isTyping } from './stores.js';

    let octChanged = false; // Whether key input was an octave change (no note is triggered)

    let keyPressed = false;

    let octave = 4; // Updates when octave is changed
    let newOct = 4; // Only updates when a new note is played

    let frequency = 440;
    let trigger = false;
    
    let note = ''; // The note to be displayed
    
    let octUp = 0;
    let newOctUp = 0;

    function onKeyDown(e) {

        if ($isTyping) return;

        e.preventDefault();

        if (e.repeat) return; // Prevents rapid trigger firing when key held down
        
        octChanged = false;
        octUp = 0;

        keyPressed = true;

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
            case 81: //Q
                frequency = 698.46;
                note = 'F';
                octUp = 1;
                break;
            case 50: //2
                frequency = 739.99;
                note = 'F#/Gb';
                octUp = 1;
                break;
            case 87: //W
                frequency = 783.99;
                note = 'G';
                octUp = 1;
                break;
            case 51: //3
                frequency = 830.61;
                note = 'G#/Ab';
                octUp = 1;
                break;
            case 69: //E
                frequency = 880.00;
                note = 'A';
                octUp = 1;
                break;
            case 52: //4
                frequency = 932.33;
                note = 'A#/Bb';
                octUp = 1;
                break;
            case 82: //R
                frequency = 987.77;
                note = 'B';
                octUp = 1;
                break;
            case 84: //T
                frequency = 1046.50;
                note = 'C';
                octUp = 2;
                break;
            case 54: //6
                frequency = 1108.73;
                note = 'C#/Db';
                octUp = 2;
                break;
            case 89: //Y
                frequency = 1174.66;
                note = 'D';
                octUp = 2;
                break;
            case 55: //7
                frequency = 1244.51;
                note = 'D#/Eb';
                octUp = 2;
                break;
            case 85: //U
                frequency = 1318.51;
                note = 'E';
                octUp = 2;
                break;
            case 73: //I
                frequency = 1396.91;
                note = 'F';
                octUp = 2;
                break;
            case 57: //9
                frequency = 1479.98;
                note = 'F#/Gb';
                octUp = 2;
                break;
            case 79: //O
                frequency = 1567.98;
                note = 'G';
                octUp = 2;
                break;
            case 48: //0
                frequency = 1661.22;
                note = 'G#/Ab';
                octUp = 2;
                break;
            case 80: //P
                frequency = 1760.00;
                note = 'A';
                octUp = 2;
                break;

            case 32: //Space
                trigger = true;

                $midi.voct = null;
                $midi.trigger = trigger;
                return;

            default:
                keyPressed = false;
                break;
        }

        if (!octChanged && keyPressed) {
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

            $midi.voct = Math.log2(frequency);
            $midi.trigger = trigger;
        }

        
    }

    function onKeyUp(e) {
        if (trigger) {
            trigger = false;
            keyPressed = false;

            $midi.voct = null;
            $midi.trigger = trigger;
        }
    }
</script>

<main>
<div>
    <h2>Note Input</h2>
    <p>Play notes by pressing QWERTY keys on keyboard<br>
    (Requires oscillator in patch for output)</p>
    <p>Change octave: '-' and '='<br>
    Noteless trigger: 'SPACE'<br></p>
    <p>Note played: <b class:active={trigger}>{note}{#if note}{newOct+newOctUp}{/if}</b></p>
</div>
<br>
</main>

<style>
    div {
        border-style: solid;
        position: absolute;
        width: 250px;
        padding: 1%;
        background-color: rgba(244, 244, 244, 0.7);
    }

    .active {
        color:red;
    }

    p {
        line-height: 23px;
    }
</style>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />