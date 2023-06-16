<script>
	import Trackpad from './Trackpad.svelte';
	import Sliders from './Sliders.svelte';
	import { gain, x, y } from './app.js';
	import { scaleNumber } from './functions'; 
	import { createDevice } from '@rnbo/js';

	$: gainStore = $gain; 
	$: f1Param = scaleNumber($x, [0., 1.], [100, 10000], 0); 
	$: f2Param = scaleNumber($y, [0., 1.], [100, 10000], 0); 

    // @ts-ignore
    let WAContext = window.AudioContext || window.webkitAudioContext;
    let context = new WAContext();

    const setup = async () => {
        let rawPatcher = await fetch("./src/export/patch.export.json");
        let patcher = await rawPatcher.json();
        let device = await createDevice({ context, patcher });

        device.node.connect(context.destination);

        const gainslider = document.getElementById('sliderGain'); 
		const gainParam = device.parametersById.get("gain");

        gainslider.addEventListener('input', function() { 
			gainParam.value = gainStore;
		});



		document.body.onclick = () => {
            context.resume();
        }; 
    };

	setup(); 

</script>

<body>
	<Trackpad/> 
	<Sliders/>
</body>