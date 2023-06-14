<script>
	import Trackpad from './Trackpad.svelte';
	import Sliders from './Sliders.svelte';
	import { gain, x, y } from './app.js';
	import { setup } from './rnboSetup.js'; 
	import { scaleNumber } from './functions'; 

	$: gainParam = $gain; 
	$: f1Param = scaleNumber($x, [0., 1.], [100, 10000], 0); 
	$: f2Param = scaleNumber($y, [0., 1.], [100, 10000], 0); 

	setup(); 

</script>

<body>
	<Trackpad/> 
	<Sliders/>
</body>