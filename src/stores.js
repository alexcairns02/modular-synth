import { writable } from 'svelte/store';

export const modules = writable({});

export const midi = writable({voct: null, trigger: false});

export const noModules = writable(0);

export const context = writable(null);