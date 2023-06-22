<script>
	import { gain, x, y } from './app.js';


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
		<p>Gain:</p><input id="sliderGain" type=range bind:value={gvalue} on:input={gainChange} step=0.01 min=0 max=1 name='gain'><p>{gvalue}</p>
	</div>
	<div class="slider">
		<p>f1:</p><input type=range bind:value={f1value} on:input={xChange} step=0.01 min=0 max=1 name='f1'><p>{f1value}</p>
	</div>
	<div class="slider">
		<p>f2:</p><input type=range bind:value={f2value} on:input={yChange} step=0.01 min=0 max=1 name='f2'><p>{f2value}</p>
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
		/* margin: 0px 200px ;  */
		user-select: none;

	}
	
	.slider {
		display: flex; 
		flex-direction: row;
		align-items: center; 
		justify-items: center; 
		justify-content: center; 
		gap: 50px; 
	}

	p {
		pointer-events: none;
		width: 3rem;
	}
	
</style>

