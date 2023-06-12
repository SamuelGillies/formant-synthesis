<script>
	import { gain, x, y } from './app.js';
	import { scaleNumber } from './functions'; 
	let gvalue = 0, f1value, f2value; 
	
	function gainChange(e) {
		gain.update(x => gvalue); 
	}
	
	function xChange(e) {
		x.update(x => f1value); 
	}
	
	function yChange(e) {
		y.update(y => f2value); 
	}
	
	gain.subscribe(value => {
		gvalue = value;
	});
	
	x.subscribe(value => {
		f1value = value;
	});
	
	y.subscribe(value => {
		f2value = value;
	});

</script>

<div class="sliderContainer">
	<div class="slider">
		<label for='gain'>Gain:</label><input type=range bind:value={gvalue} step=0.01 min=0 max=1 name='gain'><input type=number value={gvalue}>
	</div>
	<div class="slider">
		<label for='f1'>f1:</label><input type=range bind:value={f1value} on:input={xChange} step=0.01 min=0 max=1 name='f1'><input type=number value={f1value}>
	</div>
	<div class="slider">
		<label for='f2'>f2:</label><input type=range bind:value={f2value} on:input={yChange} step=0.01 min=0 max=1 name='f2'><input type=number value={f2value}>
	</div>
</div>

<style>
	* { 
		margin: 0; 
		padding: 0; 
	}
	
	.sliderContainer {
		display: flex; 
		flex-direction: column;
		margin: 0px 200px ; 
	}
	
	.slider {
		display: flex; 
		flex-direction: row;
		align-items: center; 
		justify-items: center; 
		justify-content: center; 
	}
	
	input::-webkit-outer-spin-button,
	input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		width: 50px; 
	}
	
	input[type=range] {
		max-width: 1500px; 
	}
	
	input[type=number] {
		-moz-appearance: textfield;
		width: 50px; 
	}
</style>

