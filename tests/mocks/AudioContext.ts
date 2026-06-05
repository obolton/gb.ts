class MockAudioNode {
  frequency = { value: 0 };
  connect() {}
}

class MockGainNode extends MockAudioNode {
  gain = { value: 0 };
}

class MockOscillatorNode extends MockAudioNode {
  frequency = { value: 0 };
  start() {}
  setPeriodicWave() {}
}

class MockAudioBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
  }
  copyToChannel() {}
}

class MockAudioBufferSourceNode extends MockAudioNode {
  start() {}
  stop() {}
  disconnect() {}
  playbackRate = { value: 0 };
}

class MockAudioContext {
  sampleRate = 48000;

  resume() {
    return Promise.resolve();
  }

  suspend() {
    return Promise.resolve();
  }

  createGain() {
    return new MockGainNode();
  }
  createChannelMerger() {
    return new MockAudioNode();
  }
  createOscillator() {
    return new MockOscillatorNode();
  }
  createPeriodicWave() {
    return {};
  }
  createBuffer(numberOfChannels: number, length: number, sampleRate: number) {
    return new MockAudioBuffer(numberOfChannels, length, sampleRate);
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
}

export default MockAudioContext as unknown as typeof AudioContext;
