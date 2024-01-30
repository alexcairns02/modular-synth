import { writable } from 'svelte/store';

export const modules = writable({});

export const midi = writable({voct: null, trigger: false});

export const context = writable(null);

export const output = writable({});