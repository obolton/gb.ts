import { describe, expect, test } from 'vitest';
import WaveChannel from '../../src/audio/waveChannel';
import AudioContext from '../mocks/AudioContext';

describe('WaveChannel', () => {
  const audioContext = new AudioContext();
  const outputNode = audioContext.createGain();

  test('uses a valid buffer rate for very low frequencies', () => {
    const waveChannel = new WaveChannel(audioContext, outputNode);
    waveChannel.periodValue = 0;
    waveChannel.trigger();
    expect(waveChannel.audioBufferSourceNode?.buffer?.sampleRate).toEqual(48000);
    expect(waveChannel.audioBufferSourceNode?.playbackRate.value).toEqual(1024 / 48000);
  });

  test('uses a valid buffer rate for very high frequencies', () => {
    const waveChannel = new WaveChannel(audioContext, outputNode);
    waveChannel.periodValue = 2047;
    waveChannel.trigger();
    expect(waveChannel.audioBufferSourceNode?.buffer?.sampleRate).toEqual(48000);
    expect(waveChannel.audioBufferSourceNode?.playbackRate.value).toEqual(2097152 / 48000);
  });
});
