// Get createDevice from the rnbo.js library
const { createDevice } = require("@rnbo/js");

// Create AudioContext
let WAContext = window.AudioContext || window.webkitAudioContext;
let context = new WAContext();

const setup = { async () => {
    let rawPatcher = await fetch("patcher.export.json");
    let patcher = await rawPatcher.json();

    let device = await createDevice({ context, patcher });

    // This connects the device to audio output, but you may still need to call context.resume()
    // from a user-initiated function.
    device.node.connect(context.destination);
    }
};

// We can't await an asynchronous function at the top level, so we create an asynchronous
// function setup, and then call it without waiting for the result.

// export async function setup() {
//     const patchExportURL = "export/patch.export.json";

//     // Create AudioContext
//     const WAContext = window.AudioContext || window.webkitAudioContext;
//     const context = new WAContext();

//     // Create gain node and connect it to audio output
//     const outputNode = context.createGain();
//     outputNode.connect(context.destination);
    
//     // Fetch the exported patcher
//     let response, patcher;
//     try {
//         response = await fetch(patchExportURL);
//         patcher = await response.json();
    
//         if (!window.RNBO) {
//             // Load RNBO script dynamically
//             // Note that you can skip this by knowing the RNBO version of your patch
//             // beforehand and just include it using a <script> tag
//             await loadRNBOScript(patcher.desc.meta.rnboversion);
//         }

//     } catch (err) {
//         const errorContext = {
//             error: err
//         };
//         if (response && (response.status >= 300 || response.status < 200)) {
//             errorContext.header = `Couldn't load patcher export bundle`,
//             errorContext.description = `Check app.js to see what file it's trying to load. Currently it's` +
//             ` trying to load "${patchExportURL}". If that doesn't` + 
//             ` match the name of the file you exported from RNBO, modify` + 
//             ` patchExportURL in app.js.`;
//         }
//         if (typeof guardrails === "function") {
//             guardrails(errorContext);
//         } else {
//             throw err;
//         }
//         return;
//     }
    
//     // (Optional) Fetch the dependencies
//     let dependencies = [];
//     try {
//         const dependenciesResponse = await fetch("export/dependencies.json");
//         dependencies = await dependenciesResponse.json();

//         // Prepend "export" to any file dependenciies
//         dependencies = dependencies.map(d => d.file ? Object.assign({}, d, { file: "export/" + d.file }) : d);
//     } catch (e) {}

//     // Create the device
//     let device;
//     try {
//         device = await RNBO.createDevice({ context, patcher });
//     } catch (err) {
//         if (typeof guardrails === "function") {
//             guardrails({ error: err });
//         } else {
//             throw err;
//         }
//         return;
//     }

//     device.node.connect(outputNode);

// };

	
// function loadRNBOScript(version) {
//     return new Promise((resolve, reject) => {
//         if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
//             throw new Error("Patcher exported with a Debug Version!\nPlease specify the correct RNBO version to use in the code.");
//         }
//         const el = document.createElement("script");
//         el.src = "https://c74-public.nyc3.digitaloceanspaces.com/rnbo/" + encodeURIComponent(version) + "/rnbo.min.js";
//         el.onload = resolve;
//         el.onerror = function(err) {
//            console.log(err);
//             reject(new Error("Failed to load rnbo.js v" + version));
//         };
//         document.body.append(el);
//     });
// }

