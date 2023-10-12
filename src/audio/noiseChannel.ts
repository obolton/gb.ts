import Channel from './channel';

export default class NoiseChannel extends Channel {
  clockShift = 0;
  lfsrWidth = 0;
  clockDivider = 0;

  node: AudioBufferSourceNode;

  constructor(audioContext: AudioContext, outputNode: AudioNode) {
    super(audioContext, outputNode);

    const buffer = new Float32Array(audioContext.sampleRate);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.random() > 0.5 ? 1 : 0;
    }
    const audioBuffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate,
      audioContext.sampleRate
    );
    audioBuffer.copyToChannel(buffer, 0, 0);

    this.node = audioContext.createBufferSource();
    this.node.buffer = audioBuffer;
    this.node.loop = true;
    this.node.start();
    this.node.connect(this.gainNode);
  }

  reset() {
    super.reset();
    this.clockShift = 0;
    this.lfsrWidth = 0;
    this.clockDivider = 0;
  }

  trigger() {
    this.updateFrequency();
    super.trigger();
  }

  updateFrequency() {
    const clockDivider = this.clockDivider === 0 ? 0.5 : this.clockDivider;
    const sampleRate = 262144 / (clockDivider * (1 << this.clockShift));
    this.node.playbackRate.value = sampleRate / this.audioContext.sampleRate;
  }
}
