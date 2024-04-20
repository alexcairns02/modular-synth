import { writable, readable } from 'svelte/store';

// Modules present in the scene
export const modules = writable({});

// Object containing information about note inputs
export const midi = writable({voct: null, trigger: false});

// The AudioContext object used in every module
export const context = writable(null);

// Information about the output module
export const output = writable({});

// Colours responding to each module type
export const colours = readable({
    vco: "#ff6666",
    mixer: "#ffff77",
    vca: "#88ff88",
    vcf: "#ff9955",
    lfo: "#dd88ff",
    adsr: "#7788ff",
    delay: "#bbbbcc",
    noise: "#bb7755",
    input: "#88eeff"
});

// The module that is currently having an input/control be selected
export const selectingModule = writable(null);

// Whether the user is currently editing a module's title
export const isTyping = writable(false);