class MockAudioNode {
  frequency = { value: 0 };
  connect() {}
}

class MockGainNode extends MockAudioNode {
  gain = { value: 0 };
}

class MockPannerNode extends MockAudioNode {
  pan = { value: 0 };
}

class MockOscillatorNode extends MockAudioNode {
  frequency = { value: 0 };
  start() {}
  setPeriodicWave() {}
}

class MockAudioBuffer {
  copyToChannel() {}
}

class MockAudioBufferSourceNode extends MockAudioNode {
  start() {}
  playbackRate = { value: 0 };
}

class MockAudioContext {
  sampleRate = 48000;

  createGain() {
    return new MockGainNode();
  }
  createChannelMerger() {
    return new MockAudioNode();
  }
  createChannelSplitter() {
    return new MockAudioNode();
  }
  createStereoPanner() {
    return new MockPannerNode();
  }
  createOscillator() {
    return new MockOscillatorNode();
  }
  createPeriodicWave() {
    return {};
  }
  createBuffer() {
    return new MockAudioBuffer();
  }
  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }
}

export default MockAudioContext as unknown as typeof AudioContext;
