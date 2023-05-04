const MAX_SAMPLES = 2048;

class AudioBufferProcessor extends AudioWorkletProcessor {
    // buffer audio between animation frames in the main thread


    constructor() {
        super();
        this._buffer = new Float32Array(MAX_SAMPLES);
        this._readIdx = 0;
        this._writeIdx = 0;
        // actual number of elements left to read
        this._samplesLeft = 0;

        this.port.onmessage = (e) => {
            if (e.data == "read") {
                this.sendOutSamples();
            }
        }
    }

    process(inputs, outputs, parameters) {
        // write input samples from the first channel into ring buffer

        /** @type {Float32Array} */
        const inputData = inputs[0][0];
        const bufLenBefore = this._samplesLeft;
        if (inputData) {
            for (let sampleIdx = 0; sampleIdx < inputData.length; sampleIdx++) {
                this._buffer[this._writeIdx++] = inputData[sampleIdx];
                this._writeIdx %= this._buffer.length;
                this._samplesLeft++;
                this._samplesLeft %= this._buffer.length;
            }
        }

        // if (bufLenBefore > this._samplesLeft) {
        //     console.warn("buffer overrun! bufLenBefore = ",bufLenBefore," > this._samplesLeft = ", this._samplesLeft);
        // }

        // process forever
        return true;
    }

    sendOutSamples() {
        // Send out samples we collected since last request.

        const outBuffer = new Float32Array(this._samplesLeft);
        // look out for that slightly cursed condition lol
        for (let sampleIdx = 0; this._samplesLeft > 0; sampleIdx++) {
            outBuffer[sampleIdx] = this._buffer[this._readIdx];
            this._readIdx++;
            this._readIdx %= this._buffer.length;
            this._samplesLeft--;
        }

        this.port.postMessage(outBuffer);
    }
}

registerProcessor("audio-level-worklet", AudioBufferProcessor);