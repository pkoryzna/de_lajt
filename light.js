const AudioContext = window.AudioContext || window.webkitAudioContext;

// todo make this into config object
const fftSize = 512;
const bassGainVal = 0.8;
const ledCount = 60;
const centerSize = 0.1; //percent of the radius
const blankingFactor = 0.6 * (fftSize / 2048.0);

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
var audioContext;
var midAnalyser;
var bassAnalyser;
var midSpectrumBuf;
var bassSpectrumBuf;

function setupAudioGraph(micStream) {

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
        "Q": 5.0,
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
};

function drawLoop() {
    midAnalyser.getFloatTimeDomainData(midSpectrumBuf);
    bassAnalyser.getFloatTimeDomainData(bassSpectrumBuf);
    draw(midSpectrumBuf, bassSpectrumBuf);
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
        radius = Math.min(canvas.height, canvas.width) / 2; // px
        const startAngle = sliceWidth * index - sliceWidth / 2;
        const endAngle = startAngle + sliceWidth;
        const centerOffset = radius * centerSize;
        const outerWidth = radius - centerOffset;

        const arcRadius = (quantize ?
            Math.round(Math.abs(value * ledCount)) * (outerWidth / ledCount) :
            Math.abs(outerWidth * value)) + centerOffset;

        ctx.arc(canvas.width / 2, canvas.height / 2, arcRadius, startAngle + gapWidth, endAngle - gapWidth);
        ctx.stroke();
        ctx.closePath();
    }
}


function draw(midBuf, bassBuf) {
    const ctx = canvasCtx;

    ctx.fillStyle = "#000";
    ctx.globalAlpha = blankingFactor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);


    ctx.lineWidth = radius * 0.009;
    ctx.globalAlpha = 1.0;
    ctx.strokeStyle = midrangeStyle;
    fakeLedDrawBuffer(ctx, midBuf, true);
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = bassStyle;
    fakeLedDrawBuffer(ctx, bassBuf, true);
}


function startCapturing() {
    if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia(audioConstraints).then((stream) => {
            audioContext = new AudioContext();
            audioContext.resume().then(() => {
                const microphone = audioContext.createMediaStreamSource(stream);
                setupAudioGraph(microphone);
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
    for (let i = 0; i < fftSize * 2; i++) {
        buf[i] = Math.sin(millis + i / 10 + offset) * scale;
    }
}

const bufA = new Float32Array(fftSize * 2);
const bufB = new Float32Array(fftSize * 2);
function attractMode() {
    if (!run) {
        fillDemoBuffer(bufA);
        fillDemoBuffer(bufB, offset = Math.PI, scale = 0.3);
        draw(bufA, bufB);
        requestAnimationFrame(attractMode);
    }
}


const resizeObserver = new ResizeObserver(() => {
    canvas.width = Math.round(canvas.clientWidth * devicePixelRatio);
    canvas.height = Math.round(canvas.clientHeight * devicePixelRatio);
});

resizeObserver.observe(canvas);
attractMode();

canvas.addEventListener("click", startCapturing);
canvas.addEventListener("dblclick", toggleFullScreen);
