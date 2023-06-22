<script>
	import Trackpad from './Trackpad.svelte';
	import Sliders from './Sliders.svelte';
	import { gain, x, y } from './app.js';
	import { scaleNumber } from './functions'; 
	import { createDevice } from '@rnbo/js';

    // @ts-ignore
    let WAContext = window.AudioContext || window.webkitAudioContext;
    let context = new WAContext();

    const setup = async () => {
        let rawPatcher = await fetch("./src/export/patch.export.json");
        let patcher = await rawPatcher.json();
        let device = await createDevice({ context, patcher });

        device.node.connect(context.destination);

		const gainParam = device.parametersById.get("gain");
		const f1Param = device.parametersById.get("f1");
        const f2Param = device.parametersById.get("f2");

		gain.subscribe(value => {
			gainParam.value = value;
		});
		
		x.subscribe(value => {
			f1Param.value = scaleNumber(value, [0., 1.], [100, 10000], 0);
		});

		y.subscribe(value => {
			f2Param.value = scaleNumber(value, [0., 1.], [100, 10000], 0);
		});

		document.body.onclick = () => {
            context.resume();
        }; 
    };

	setup(); 

</script>

<body>
	<Sliders/>
	<Trackpad/> 
</body>