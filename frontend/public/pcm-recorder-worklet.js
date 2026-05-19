/**
 * AudioWorklet processor: 把浏览器 Float32 音频转为 16kHz 16bit PCM，
 * 每 100ms（1600 帧 @ 16kHz）发一次 Int16Array 到主线程。
 */
class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = [];
    this._frameCount = 0;
    this._CHUNK = 1600; // 100ms @ 16kHz
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this._buf.push(s < 0 ? s * 0x8000 : s * 0x7fff);
    }
    while (this._buf.length >= this._CHUNK) {
      const chunk = this._buf.splice(0, this._CHUNK);
      this.port.postMessage(new Int16Array(chunk));
    }
    return true;
  }
}

registerProcessor('pcm-recorder', PcmRecorderProcessor);
