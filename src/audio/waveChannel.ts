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
  outputLevel = OutputLevel.MUTE;

  audioBufferSourceNode?: AudioBufferSourceNode;

  protected outputGain() {
    switch (this.outputLevel) {
      case OutputLevel.FULL:
        return 1;
      case OutputLevel.HALF:
        return 0.5;
      case OutputLevel.QUARTER:
        return 0.25;
      default:
        return 0;
    }
  }

  reset() {
    super.reset();
    this.periodValue = 0;
    this.outputLevel = OutputLevel.MUTE;
  }

  updateWave() {
    this.audioBufferSourceNode?.disconnect();
    this.audioBufferSourceNode?.stop();

    const buffer = new Float32Array(32);
    for (let i = 0; i < this.wave.length; i++) {
      const value = this.wave[i];
      const sampleIndex = i * 2;
      buffer[sampleIndex] = ((value & 0xf0) >> 4) / 7.5 - 1;
      buffer[sampleIndex + 1] = (value & 0x0f) / 7.5 - 1;
    }
    const audioBuffer = this.audioContext.createBuffer(1, 32, this.audioContext.sampleRate);
    audioBuffer.copyToChannel(buffer, 0, 0);

    this.audioBufferSourceNode = this.audioContext.createBufferSource();
    this.audioBufferSourceNode.buffer = audioBuffer;
    this.audioBufferSourceNode.loop = true;
    this.audioBufferSourceNode.start();
    this.audioBufferSourceNode.connect(this.gainNode);

    this.updateFrequency();
  }

  updateFrequency() {
    if (!this.audioBufferSourceNode) {
      return;
    }

    const sampleRate = 2097152 / (2048 - this.periodValue);
    this.audioBufferSourceNode.playbackRate.value = sampleRate / this.audioContext.sampleRate;
  }

  trigger() {
    this.updateWave();
    super.trigger();
  }
}
