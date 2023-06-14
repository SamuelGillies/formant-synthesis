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

    const gainParam = device.parametersById.get("gain");
    const f1Param = device.parametersById.get("f1");
    const f2Param = device.parametersById.get("f2");

    gainParam.value = 0.; 
    // f1Param.value = f1; 
    // f2Param.value = f2; 

    document.body.onclick = () => {
        context.resume();
    };
};

