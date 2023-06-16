    import { createDevice } from '@rnbo/js';
    import { gain, x, y } from './app.js';


    // @ts-ignore
    let WAContext = window.AudioContext || window.webkitAudioContext;
    let context = new WAContext();

    export const setup = async () => {
        let rawPatcher = await fetch("./src/export/patch.export.json");
        let patcher = await rawPatcher.json();
        let device = await createDevice({ context, patcher });

        device.node.connect(context.destination);

    //     let gainslider = document.getElementById('sliderGain'); 
    //     gainslider.addEventListener('change', changeParam(device, 'gain', gain));
    };


    export function changeParam(device, param, value) {
        const gainParam = device.parametersById.get("gain");
        const f1Param = device.parametersById.get("f1");
        const f2Param = device.parametersById.get("f2");

        if (param == 'gain') {
            gainParam.value = value; 
        } else if (param == 'f1') {
            f1Param.value = value;
        } else if (param == 'f2') {
            f2Param.value = value; 
        }

        document.body.onclick = () => {
            context.resume();
        }; 
    }