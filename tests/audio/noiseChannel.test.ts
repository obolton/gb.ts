import NoiseChannel from '../../src/audio/noiseChannel';
import AudioContext from '../mocks/AudioContext';

describe('NoiseChannel', () => {
  const audioContext = new AudioContext();
  const outputNode = audioContext.createGain();

  test('sets the sample rate', () => {
    const noiseChannel = new NoiseChannel(audioContext, outputNode);
    noiseChannel.clockDivider = 4;
    noiseChannel.clockShift = 2;
    noiseChannel.trigger();
    expect(noiseChannel.node.playbackRate.value).toEqual(16384 / 48000);
  });
});
