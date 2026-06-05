import { describe, expect, test } from 'vitest';
import NoiseChannel from '../../src/audio/noiseChannel';
import AudioContext from '../mocks/AudioContext';

describe('NoiseChannel', () => {
  const audioContext = new AudioContext();
  const leftOutput = audioContext.createGain();
  const rightOutput = audioContext.createGain();

  test('sets the sample rate', () => {
    const noiseChannel = new NoiseChannel(audioContext, leftOutput, rightOutput);
    noiseChannel.clockDivider = 4;
    noiseChannel.clockShift = 2;
    noiseChannel.trigger();
    expect(noiseChannel.node.playbackRate.value).toEqual(16384 / 48000);
  });
});
