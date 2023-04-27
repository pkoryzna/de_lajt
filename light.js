const AudioContext = window.AudioContext || window.webkitAudioContext;

// todo make this into config object
const fftSize = 512;
const bassGainVal = 0.8;
const ledCount = 60;
const centerOffset = 50; //px
const blankingFactor = 0.6 * (fftSize / 2048.0);

const bassStyle = "#f00";
const midrangeStyle = "#0f0";


const canvas = document.querySelector('canvas');
const canvasCtx = canvas.getContext('2d');

const radius = canvas.height / 2; // px

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

var audioContext;
var midAnalyser;
var bassAnalyser;
var midSpectrumBuf;
var bassSpectrumBuf;

function setup(micStream) {

    const analyserOptions = {
        fftSize: fftSize,
        smoothingTimeConstant: 0.0,
    }

    midAnalyser = new AnalyserNode(audioContext, analyserOptions); // TODO bins etc.
    bassAnalyser = new AnalyserNode(audioContext, analyserOptions); // TODO 
    midSpectrumBuf = new Float32Array(midAnalyser.frequencyBinCount);
    bassSpectrumBuf = new Float32Array(bassAnalyser.frequencyBinCount);

    const bassGainNode = new GainNode(audioContext);
    const globalGain = new GainNode(audioContext);

    const lpf = new BiquadFilterNode(audioContext, {
        "type": "lowpass",
        "frequency": 100, // Hz
        "Q": 10.0,
    });


    const midHpf = new BiquadFilterNode(audioContext,
        {
            "type": "highpass",
            "frequency": 200, //Hz
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
    globalGain.gain.setValueAtTime(8.0, audioContext.currentTime);

    bassGainNode.gain.setValueAtTime(bassGainVal, audioContext.currentTime);
    globalGain.connect(lpf).connect(bassGainNode).connect(bassAnalyser);
    globalGain.connect(midBandFilter).connect(midAnalyser);
    const audioDataLengthMs = midAnalyser.frequencyBinCount / audioContext.sampleRate * 1000;

    run = true;
    console.log("calculated analyser sample length", audioDataLengthMs);
    drawLoop();
};

function drawLoop() {
    draw()
    if (run) { requestAnimationFrame(drawLoop); }
}



function fakeLedDrawBuffer(ctx, buf, quantize) {
    const sliceWidth = (Math.PI * 2) / buf.length;
    const gapWidth = sliceWidth * 0.1;

    // const firstPoint = polarToCanvasCoords(radius * buf[0], 0);
    // ctx.moveTo(firstPoint.x, firstPoint.y);
    ctx.lineCap = "round";
    for (var index = 0; index < buf.length; index++) {
        const value = buf[index];
        ctx.beginPath();

        const startAngle = sliceWidth * index - sliceWidth / 2;
        const endAngle = startAngle + sliceWidth;

        const outerWidth = radius - centerOffset;

        const arcRadius = (quantize ?
            Math.round(Math.abs(value * ledCount)) * (outerWidth / ledCount) :
            Math.abs(outerWidth * value)) + centerOffset;

        ctx.arc(canvas.width / 2, canvas.height / 2, arcRadius, startAngle + gapWidth, endAngle - gapWidth);
        ctx.stroke();
        ctx.closePath();
    }
}


function draw() {
    midAnalyser.getFloatTimeDomainData(midSpectrumBuf);
    bassAnalyser.getFloatTimeDomainData(bassSpectrumBuf);
    const ctx = canvasCtx;

    ctx.fillStyle = "#000";
    ctx.globalAlpha = blankingFactor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    ctx.lineWidth = 5;
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = midrangeStyle;
    fakeLedDrawBuffer(ctx, midSpectrumBuf, true);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = bassStyle;
    fakeLedDrawBuffer(ctx, bassSpectrumBuf, true);
}


function start() {
    if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia(audioConstraints).then((stream) => {
            audioContext = new AudioContext();
            audioContext.resume().then(() => {
                const microphone = audioContext.createMediaStreamSource(stream);
                setup(microphone);
                console.log("microphone init ok!")
            }
            );
        }).catch((err) => {
            console.log("failed to create a media stream source :( ", err)
        });
    } else {
        window.alert("no media devices, it won't work, sorry")
    }

    canvas.removeEventListener("click", start)
}

canvas.addEventListener("click", start);
document.querySelector("button").addEventListener("click", start);

