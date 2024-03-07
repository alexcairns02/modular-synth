<script>
    import { midi, isTyping } from './stores.js';

    const noteKeys = {
        90: {code: 90, frequency: 261.63, note: 'C', octUp: 0}, // Z
        83: {code: 83, frequency: 277.18, note: 'C#/Db', octUp: 0}, // S
        88: {code: 88, frequency: 293.66, note: 'D', octUp: 0}, // X
        68: {code: 68, frequency: 311.13, note: 'D#/Eb', octUp: 0}, // D
        67: {code: 67, frequency: 329.63, note: 'E', octUp: 0}, // C
        86: {code: 86, frequency: 349.23, note: 'F', octUp: 0}, // V
        71: {code: 71, frequency: 369.99, note: 'F#/Gb', octUp: 0}, // G
        66: {code: 66, frequency: 392.00, note: 'G', octUp: 0}, // B
        72: {code: 72, frequency: 415.30, note: 'G#/Ab', octUp: 0}, // H
        78: {code: 78, frequency: 440.00, note: 'A', octUp: 0}, // N
        74: {code: 74, frequency: 466.16, note: 'A#/Bb', octUp: 0}, // J
        77: {code: 77, frequency: 493.88, note: 'B', octUp: 0}, // M
        188: {code: 188, frequency: 523.25, note: 'C', octUp: 1}, // ,
        76: {code: 76, frequency: 554.37, note: 'C#/Db', octUp: 1}, // L
        190: {code: 190, frequency: 587.33, note: 'D', octUp: 1}, // .
        59: {code: 59, frequency: 622.25, note: 'D#/Eb', octUp: 1}, // ;
        191: {code: 191, frequency: 659.25, note: 'E', octUp: 1}, // /
        81: {code: 81, frequency: 698.46, note: 'F', octUp: 1}, // Q
        50: {code: 50, frequency: 739.99, note: 'F#/Gb', octUp: 1}, // 2
        87: {code: 87, frequency: 783.99, note: 'G', octUp: 1}, // W
        51: {code: 51, frequency: 830.61, note: 'G#/Ab', octUp: 1}, // 3
        69: {code: 69, frequency: 880.00, note: 'A', octUp: 1}, // E
        52: {code: 52, frequency: 932.33, note: 'A#/Bb', octUp: 1}, // 4
        82: {code: 82, frequency: 987.77, note: 'B', octUp: 1}, // R
        84: {code: 84, frequency: 1046.50, note: 'C', octUp: 2}, // T
        54: {code: 54, frequency: 1108.73, note: 'C#/Db', octUp: 2}, // 6
        89: {code: 89, frequency: 1174.66, note: 'D', octUp: 2}, // Y
        55: {code: 55, frequency: 1244.51, note: 'D#/Eb', octUp: 2}, // 7
        85: {code: 85, frequency: 1318.51, note: 'E', octUp: 2}, // U
        73: {code: 73, frequency: 1396.91, note: 'F', octUp: 2}, // I
        57: {code: 57, frequency: 1479.98, note: 'F#/Gb', octUp: 2}, // 9
        79: {code: 79, frequency: 1567.98, note: 'G', octUp: 2}, // O
        48: {code: 48, frequency: 1661.22, note: 'G#/Ab', octUp: 2}, // 0
        80: {code: 80, frequency: 1760.00, note: 'A', octUp: 2}, // P
    };

    let currentlyPressed = [];

    let octChanged = false; // Whether key input was an octave change (no note is triggered)

    let keyPressed = false;

    let octave = 4; // Updates when octave is changed
    let newOct = 4; // Only updates when a new note is played

    let frequency = 440;
    let trigger = false;
    
    let note = ''; // The note to be displayed
    
    let octUp = 0;
    let newOctUp = 0;

    function isPressed(inp) {
        let result = false;
        currentlyPressed.forEach((key) => {
            if (key.code == inp.code) result = true;
        });
        return result;
    }

    function onKeyDown(e) {

        if ($isTyping) return; // We don't trigger midi input on key presses if a module's title is being changed

        e.preventDefault();

        if (e.repeat) return; // Prevents rapid trigger firing when key held down
        
        octChanged = false;
        octUp = 0;

        keyPressed = true;

        let inp;

        if (Object.keys(noteKeys).includes(String(e.keyCode))) {
            inp = noteKeys[e.keyCode];
            if (!isPressed(inp)) currentlyPressed.push(inp);
        }

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
        }

        updateOutput();
    }

    function onKeyUp(e) {
        let indexToRemove = null;
        currentlyPressed.forEach((inp, i) => {
            if (inp.code == e.keyCode) {
                indexToRemove = i;
            }
        });
        if (indexToRemove != null) currentlyPressed.splice(indexToRemove, 1);

        updateOutput();
    }

    function updateOutput() {
        $midi.trigger = currentlyPressed.length > 0;
        if ($midi.trigger) {
            let top = currentlyPressed[currentlyPressed.length-1];

            newOct = octave;
            newOctUp = top.octUp;
            note = top.note;
            trigger = true;

            let frequency = top.frequency;
            if (octave > 4) {
                for (let i=4; i < octave; i++) {
                    frequency *= 2;
                }
            } else {
                for (let i=4; i > octave; i--) {
                    frequency /= 2;
                }
            }

            $midi.voct = Math.log2(frequency);
        } else {
            $midi.voct = null;
            trigger = false;
        }
    }
</script>

<main>
<div>
    <h2>Note Input</h2>
    <p>Play notes by pressing QWERTY keys on keyboard<br>
    (Requires oscillator in patch for output)</p>
    <p>Change octave: '-' and '='<br></p>
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