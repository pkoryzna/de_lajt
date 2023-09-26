const AudioContext = window.AudioContext || window.webkitAudioContext;

// todo make this into config object
const samplesPerFullCircle = 1024;
const defaultBassGainVal = 0.8;
const ledCount = 60;
const centerSize = 0.1; //percent of the radius
var blankingFactor = 0.4;

const defaultMidHpfFreq = 400;
const defaultMidLpfFreq = 1200;

const sliceWidth = (Math.PI * 2) / samplesPerFullCircle;
const gapWidth = sliceWidth * 0.1;


const bassStyle = "#ff0000";
const midrangeStyle = "#00ff00";


const canvas = document.querySelector('canvas');
const canvasCtx = canvas.getContext('2d');


// less latency = more better
const audioConstraints = {
    "audio": {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        latency: 0,
    }
};

// nice globals bro lmao
var run = false;
var radius = Math.min(canvas.height, canvas.width) / 2; // px
var samplesDrawn = [
    0,
    samplesPerFullCircle / 2 // + 180 deg
];

/** @type {AudioContext} */
var audioContext;

var bassBufferNode;
var midBufferNode;
var midSpectrumBuf;
var bassSpectrumBuf;

function setupAudioGraph(micStream) {

    bassBufferNode = new AudioWorkletNode(audioContext, "audio-level-worklet");
    midBufferNode = new AudioWorkletNode(audioContext, "audio-level-worklet");
    const bassGainNode = new GainNode(audioContext);
    const globalGain = new GainNode(audioContext);

    const lpf = new BiquadFilterNode(audioContext,
        {
            "type": "lowpass",
            "frequency": 100, // Hz
            "Q": 2.0,
        });


    const midHpf = new BiquadFilterNode(audioContext,
        {
            "type": "highpass",
            "frequency": defaultMidHpfFreq, //Hz
            "Q": 1.0,
        });

    const midLpf = new BiquadFilterNode(audioContext,
        {
            "type": "lowpass",
            "frequency": defaultMidLpfFreq, //Hz
            "Q": 1.0,
        });
    const midBandFilter = midHpf.connect(midLpf);

    micStream.connect(globalGain);
    globalGain.gain.setValueAtTime(5.0, audioContext.currentTime);

    bassGainNode.gain.setValueAtTime(defaultBassGainVal, audioContext.currentTime);

    globalGain.connect(lpf).connect(bassGainNode).connect(bassBufferNode);
    globalGain.connect(midBandFilter).connect(midBufferNode);

    setupReceive();

    run = true;
    return {
        "Input Gain": { param: globalGain.gain, min: 0.1, max: 5, step: 0.05, initialValue: globalGain.gain.value },
        "Bass Gain": { param: bassGainNode.gain, min: 0, max: 15, step: 0.05, initialValue: bassGainNode.gain.value },
        "Bass LPF Freq": { param: lpf.frequency, min: 0, max: 500, step: 5, initialValue: lpf.frequency.value },
        "Midrange LPF Freq (high)": { param: midLpf.frequency, min: 200, max: 4000, step: 50, initialValue: midLpf.frequency.value },
        "Midrange HPF Freq (low)": { param: midHpf.frequency, min: 200, max: 4000, step: 50, initialValue: defaultMidHpfFreq },
    }
};

// Set up receiving Float32Array buffers from the worklet
function setupReceive() {
    bassBufferNode.port.onmessage = (e) => {
        if (e.data instanceof Float32Array) {
            bassSpectrumBuf = e.data;
        } else {
            console.log("wtf? not a Float32Array received", e.data);
        }
    }

    midBufferNode.port.onmessage = (e) => {
        if (e.data instanceof Float32Array) {
            midSpectrumBuf = e.data;
        } else {
            console.log("wtf? not a Float32Array received", e.data);
        }
    }
}

function drawLoop() {
    if (midSpectrumBuf && bassSpectrumBuf) {
        draw(midSpectrumBuf, bassSpectrumBuf);
        if (midSpectrumBuf.length != bassSpectrumBuf.length) {
            console.warn("buffer size mismatch", midSpectrumBuf.length, bassSpectrumBuf.length);
        }
    }

    bassBufferNode.port.postMessage("read");
    midBufferNode.port.postMessage("read");

    if (run) { requestAnimationFrame(drawLoop); }
}



function fakeLedDrawBuffer(ctx, buf, quantize) {
    ctx.globalAlpha = 0.8;
    ctx.lineCap = "round";
    ctx.lineWidth = radius * 0.009;

    // fixme clean this up
    const counterIdx = buf === midSpectrumBuf ? 0 : 1;
    for (var sampleIdx = 0; sampleIdx < buf.length; sampleIdx++) {
        const normalizedValue = buf[sampleIdx];
        ctx.beginPath();
        radius = Math.min(canvas.height, canvas.width) / 2; // px

        const startAngle = sliceWidth * samplesDrawn[counterIdx] - sliceWidth / 2;

        const endAngle = startAngle + sliceWidth;

        const centerOffset = radius * centerSize;
        const outerWidth = radius - centerOffset;

        const arcRadius = (quantize ?
            Math.round(Math.abs(normalizedValue * ledCount)) * (outerWidth / ledCount) :
            Math.abs(outerWidth * normalizedValue)) + centerOffset;

        ctx.arc(canvas.width / 2, canvas.height / 2, arcRadius, startAngle + gapWidth, endAngle - gapWidth);
        ctx.stroke();
        ctx.closePath();

        samplesDrawn[counterIdx]++;
        samplesDrawn[counterIdx] %= samplesPerFullCircle;
    }
}


function blankCanvas() {
    canvasCtx.fillStyle = "#000";
    canvasCtx.globalAlpha = blankingFactor;
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw(midBuf, bassBuf) {
    const ctx = canvasCtx;
    const quantize = true;

    ctx.strokeStyle = midrangeStyle;
    fakeLedDrawBuffer(ctx, midBuf, quantize);
    ctx.strokeStyle = bassStyle;
    fakeLedDrawBuffer(ctx, bassBuf, quantize);

    // ugly hack: blank only on midSpectrumBuf sample count
    if (samplesDrawn[0] == 0) {
        blankCanvas();
    }
}


function startCapturing() {
    if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia(audioConstraints).then((stream) => {
            audioContext = new AudioContext();
            audioContext.audioWorklet.addModule("worklet.js").then(() => {
                const microphone = audioContext.createMediaStreamSource(stream);
                const params = setupAudioGraph(microphone);
                setupKnobs(params, document.getElementById("knobs"));
                console.log("microphone init ok!")
                run = true;
                drawLoop();
            }
            );
        }).catch((err) => {
            console.log("failed to create a media stream source :( ", err)
        });
    } else {
        window.alert("no media devices, it won't work, sorry")
    }

    canvas.removeEventListener("click", startCapturing)
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        canvas.requestFullscreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}


function fillDemoBuffer(buf, offset = 0, scale = 1.0) {
    let millis = new Date().valueOf();
    for (let i = 0; i < samplesPerFullCircle; i++) {
        buf[i] = Math.sin(millis + i / 10 + offset) * scale;
    }
}

const bufA = new Float32Array(samplesPerFullCircle);
const bufB = new Float32Array(samplesPerFullCircle);
function attractMode() {
    if (!run) {
        fillDemoBuffer(bufA);
        fillDemoBuffer(bufB, offset = Math.PI, scale = 0.3);
        draw(bufA, bufB);
        requestAnimationFrame(attractMode);
    }
}

function clamp(val, min, max) {
    if (isNaN(parseInt(val))) return min;
    const lower = Math.max(min, val);
    const upper = Math.min(lower, max);
    return upper;
}

function createKnob(name, desc, min, max, initialValue, step, inputHandler) {
    const slider = document.createElement("input");
    slider.setAttribute("type", "range");
    slider.setAttribute("min", min);
    slider.setAttribute("max", max);
    slider.setAttribute("step", step);
    slider.value = String(initialValue);


    const labelElem = document.createElement("label");
    labelElem.setAttribute("for", slider.name);
    labelElem.appendChild(document.createTextNode(desc));

    const valueTextInput = document.createElement("input");
    valueTextInput.setAttribute("type", "text");
    valueTextInput.value = initialValue;

    // the text box is the golden source for the data
    valueTextInput.setAttribute("name", name);

    valueTextInput.addEventListener("change", e => {
        console.log(e)
        slider.value = clamp(e.target.value, min, max);
        inputHandler(e);
    });

    slider.addEventListener("input", e => {
        console.log(e)
        valueTextInput.value = clamp(e.target.value, min, max);
        inputHandler(e);
    });

    const container = document.createElement("div");
    container.setAttribute("id", `container-${name}`);
    container.appendChild(labelElem);
    container.appendChild(slider);
    container.appendChild(valueTextInput);

    return { container: container, textInputElement: valueTextInput };

}

function setupKnobs(params, targetForm) {
    for (const [key, param] of Object.entries(params)) {
        const { container, } = createKnob(
            key,
            key,
            param.min,
            param.max,
            param.initialValue,
            param.step,
            e => param.param.setValueAtTime(clamp(e.target.value, param.min, param.max), audioContext.currentTime)
        );

        targetForm.appendChild(container);
    }
    const blanking = {
        name: "blankingFactor",
        description: "Blanking factor",
        min: 0.01,
        max: 1.0,
        initialValue: blankingFactor,
        step: 0.05,
    }

    const { container, } = createKnob(
        blanking.name,
        blanking.description,
        blanking.min,
        blanking.max,
        blanking.initialValue,
        blanking.step,
        (e) => { blankingFactor = clamp(parseFloat(e.target.value), blanking.min, blanking.max) }
    );
    targetForm.appendChild(container);

}


const resizeObserver = new ResizeObserver(() => {
    canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
    canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
});

resizeObserver.observe(canvas);
attractMode();

canvas.addEventListener("click", startCapturing);
canvas.addEventListener("dblclick", toggleFullScreen);
