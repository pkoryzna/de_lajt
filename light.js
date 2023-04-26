const AudioContext = window.AudioContext || window.webkitAudioContext;

const audioContext = new AudioContext();
const fftSize = 2048;
const analyserOptions = {
    fftSize: fftSize,
    smoothingTimeConstant: 0.0,
}

const midAnalyser = new AnalyserNode(audioContext, analyserOptions); // TODO bins etc.
const bassAnalyser = new AnalyserNode(audioContext, analyserOptions); // TODO 
const bassGainNode = new GainNode(audioContext);
const globalGain = new GainNode(audioContext);
const canvas = document.querySelector('canvas');
const canvasCtx = canvas.getContext('2d');

const radius = canvas.height / 2; // px

const bassStyle = "#f00";
const wholeStyle = "#0f0";


const bassGainVal = 2.0;


function setup(micStream) {


    const lpf = new BiquadFilterNode(audioContext, {
        "type": "lowpass",
        "frequency": 100, // Hz
        "Q": 10.0,
    });


    const midHpf= new BiquadFilterNode(audioContext,
        {
            "type": "highpass",
            "frequency": 200, //Hz
            "Q": 1.0,
        });

    const midLpf = new BiquadFilterNode(audioContext,
        {
            "type": "lowpass",
            "frequency": 3000, //Hz
            "Q": 1.0,
        });
    const midBandFilter = midHpf.connect(midLpf);

    micStream.connect(globalGain);
    globalGain.gain.setValueAtTime(8.0, audioContext.currentTime);

    bassGainNode.gain.setValueAtTime(bassGainVal, audioContext.currentTime);
    globalGain.connect(lpf).connect(bassGainNode).connect(bassAnalyser);
    globalGain.connect(midBandFilter).connect(midAnalyser);
    const audioDataLengthMs = midAnalyser.frequencyBinCount / audioContext.sampleRate * 1000;

    window.setInterval(draw, audioDataLengthMs);
    console.log("interval", audioDataLengthMs);

    // window.setInterval(() => console.log("FPS: " + fps), 1000);
};


const midSpectrumBuf = new Float32Array(midAnalyser.frequencyBinCount);
const bassSpectrumBuf = new Float32Array(bassAnalyser.frequencyBinCount);
// radians bro
const sliceWidth = (Math.PI * 2) / midSpectrumBuf.length;
const gapWidth = sliceWidth * 0.1;
// const 

// 0,0 transposed to the middle of the canvas
function polarToCanvasCoords(r, angle) {
    return {
        "x": r * Math.cos(angle) + canvas.width / 2,
        "y": r * Math.sin(angle) + canvas.height / 2
    }
}


function simpleDrawBuffer(ctx, buf) {
    ctx.beginPath();
    const firstPoint = polarToCanvasCoords(radius * buf[0], 0);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    buf.forEach((value, index, _) => {
        const { x, y } = polarToCanvasCoords(Math.abs(radius * value), sliceWidth * index);
        ctx.lineTo(x, y);
        // console.log(x,y)
    });
    ctx.stroke();
    ctx.closePath();
}

const ledCount = 60;
const centerOffset = 50; //px

function fakeLedDrawBuffer(ctx, buf, quantize) {
    // const firstPoint = polarToCanvasCoords(radius * buf[0], 0);
    // ctx.moveTo(firstPoint.x, firstPoint.y);

    buf.forEach((value, index, _) => {
        ctx.beginPath();
        ctx.lineCap = "round";
        const startAngle = sliceWidth * index - sliceWidth / 2;
        const endAngle = startAngle + sliceWidth;

        const outerWidth = radius - centerOffset;

        const arcRadius = (quantize ?
            Math.round(Math.abs(value * ledCount)) * (outerWidth / ledCount) :
            Math.abs(outerWidth * value)) + centerOffset;

        ctx.arc(canvas.width / 2, canvas.height / 2, arcRadius, startAngle + gapWidth, endAngle - gapWidth);
        ctx.stroke();
        ctx.closePath();
    })
}

const blankingFactor =  0.5 * (fftSize/2048.0);

function draw() {
    midAnalyser.getFloatTimeDomainData(midSpectrumBuf);
    bassAnalyser.getFloatTimeDomainData(bassSpectrumBuf);
    const ctx = canvasCtx;



    ctx.fillStyle = "#000";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    ctx.lineWidth = 5;
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = wholeStyle;
    fakeLedDrawBuffer(ctx, midSpectrumBuf, true);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = bassStyle;
    fakeLedDrawBuffer(ctx, bassSpectrumBuf, true);
}


function start() {
    if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia({ "audio": true }).then((stream) => {
            const microphone = audioContext.createMediaStreamSource(stream);
            setup(microphone);
            console.log("ok!")
        }).catch((err) => {
            console.log("failed to create a media stream source :( ", err)
        });
    } else {
        window.alert("no media devices, it won't work, sorry")
    }

    canvas.removeEventListener("click", start)
}

canvas.addEventListener("click", start);
// document.querySelector("input[type=range]").addEventListener("")

