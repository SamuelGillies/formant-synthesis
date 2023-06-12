import { writable } from 'svelte/store';
import { scaleNumber } from './functions'; 

export let gain = writable(0.); 
export let x = writable(0.5); 
export let y = writable(0.5); 

