const AudioContext = window.AudioContext || window.webkitAudioContext;

// todo make this into config object
const samplesPerFullCircle = 2048;
const bassGainVal = 0.8;
const ledCount = 60;
const centerSize = 0.1; //percent of the radius
var blankingFactor = 0.399;

const sliceWidth = (Math.PI * 2) / samplesPerFullCircle;
const gapWidth = sliceWidth * 0.1;


const bassStyle = "#f00";
const midrangeStyle = "#0f0";


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

    const lpf = new BiquadFilterNode(audioContext, {
        "type": "lowpass",
        "frequency": 100, // Hz
        "Q": 5.0,
    });


    const midHpf = new BiquadFilterNode(audioContext,
        {
            "type": "highpass",
            "frequency": 400, //Hz
            "Q": 1.0,
        });

    const midLpf = new BiquadFilterNode(audioContext,
        {
            "type": "lowpass",
            "frequency": 1500, //Hz
            "Q": 1.0,
        });
    const midBandFilter = midHpf.connect(midLpf);

    micStream.connect(globalGain);
    globalGain.gain.setValueAtTime(5.0, audioContext.currentTime);

    bassGainNode.gain.setValueAtTime(bassGainVal, audioContext.currentTime);

    globalGain.connect(lpf).connect(bassGainNode).connect(bassBufferNode);
    globalGain.connect(midBandFilter).connect(midBufferNode);

    setupReceive();

    run = true;
    return {
        gainValue: globalGain.gain,
        bassGainValue: bassGainNode.gain,
        bassLpfFreq: lpf.frequency,
        midLpfFreq: midLpf.frequency,
        midHpfFreq: midHpf.frequency,
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
    ctx.globalCompositeOperation = "screen";
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
        ctx.globalCompositeOperation = "darken";
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
                setupKnobs(params);
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

function setupKnobs(params) {
    function handleAudioParam(paramName) {
        const param = params[paramName];
        const knobName = paramName;
        const knob = document.querySelector(`input[name=${knobName}]`);
        const valueOut = document.querySelector(`output#${knobName}Current`);
        knob.addEventListener("input", (e) => {
            param.setValueAtTime(e.target.value, audioContext.currentTime);
            valueOut.textContent = e.target.value;
        });
    }

    handleAudioParam("gainValue");
    handleAudioParam("bassGainValue");
    handleAudioParam("bassLpfFreq");
    handleAudioParam("midLpfFreq");
    handleAudioParam("midHpfFreq");

    const blankingFactorKnob = document.querySelector(`input[name=blankingFactor]`);
    const blankingFactorKnobValueOut = document.querySelector(`output#blankingFactorCurrent`);
    blankingFactorKnob.addEventListener("input", (e) => {
        blankingFactor = e.target.value;
        blankingFactorKnobValueOut.textContent = e.target.value;
    });

}


const resizeObserver = new ResizeObserver(() => {
    canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
    canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
});

resizeObserver.observe(canvas);
attractMode();

canvas.addEventListener("click", startCapturing);
canvas.addEventListener("dblclick", toggleFullScreen);
