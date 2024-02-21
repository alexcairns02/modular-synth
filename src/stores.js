import { writable, readable } from 'svelte/store';

export const modules = writable({});

export const midi = writable({voct: null, trigger: false});

export const context = writable(null);

export const output = writable({});

export const colours = readable({
    vco: "#ff6666",
    mixer: "#ffff77",
    vca: "#88ff88",
    vcf: "#ff9955",
    lfo: "#dd88ff",
    adsr: "#7788ff",
});

export const interactionLock = writable(false);

export const selectingModule = writable(null);