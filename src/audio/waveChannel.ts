import Channel from './channel';

enum OutputLevel {
  MUTE = 0,
  FULL = 1,
  HALF = 2,
  QUARTER = 3,
}

export default class WaveChannel extends Channel {
  wave = new Uint8Array(16);
  periodValue = 0;
  maxLength = 256;

  audioBufferSourceNode?: AudioBufferSourceNode;

  get outputLevel() {
    switch (this.initialVolume) {
      case 0:
        return OutputLevel.MUTE;
      case 1:
      case 2:
        return OutputLevel.QUARTER;
      case 3:
      case 4:
      case 5:
        return OutputLevel.HALF;
      case 6:
      case 7:
        return OutputLevel.FULL;
      default:
        return OutputLevel.MUTE;
    }
  }

  set outputLevel(value: OutputLevel) {
    switch (value) {
      case OutputLevel.MUTE:
        this.initialVolume = 0;
        break;
      case OutputLevel.FULL:
        this.initialVolume = 7;
        break;
      case OutputLevel.HALF:
        this.initialVolume = 3;
        break;
      case OutputLevel.QUARTER:
        this.initialVolume = 1;
    }
  }

  constructor(audioContext: AudioContext, outputNode: AudioNode) {
    super(audioContext, outputNode);
  }

  reset() {
    super.reset();
    this.wave = new Uint8Array(16);
    this.periodValue = 0;
    this.maxLength = 256;
  }

  trigger() {
    this.audioBufferSourceNode?.disconnect();
    this.audioBufferSourceNode?.stop();

    const buffer = new Float32Array(32);
    for (let i = 0; i < this.wave.length; i++) {
      const value = this.wave[i];
      const sampleIndex = i * 2;
      buffer[sampleIndex] = ((value & 0xf0) >> 4) / 7.5 - 1;
      buffer[sampleIndex + 1] = (value & 0x0f) / 7.5 - 1;
    }
    const sampleRate = 2097152 / (2048 - this.periodValue);
    const audioBuffer = this.audioContext.createBuffer(1, 32, sampleRate);
    audioBuffer.copyToChannel(buffer, 0, 0);
    // this.audioBufferSourceNode.playbackRate.value = (playbackRate / sampleRate) / 1000;
    this.audioBufferSourceNode = this.audioContext.createBufferSource();
    this.audioBufferSourceNode.buffer = audioBuffer;
    this.audioBufferSourceNode.loop = true;
    this.audioBufferSourceNode.start();
    this.audioBufferSourceNode.connect(this.gainNode);

    super.trigger();
  }
}
