import Channel from '../../src/audio/channel';
import { SweepMode } from '../../src/audio/constants';
import AudioContext from '../mocks/AudioContext';

describe('Channel', () => {
  const audioContext = new AudioContext();
  const outputNode = audioContext.createGain();
  const channel = new Channel(audioContext, outputNode);

  beforeEach(() => {
    channel.dacEnabled = true;
    channel.mixLeft = true;
    channel.mixRight = true;
    channel.initialVolume = 15;
  });

  describe('trigger', () => {
    test('enables the channel', () => {
      expect(channel.enabled).toBe(false);
      channel.trigger();
      expect(channel.enabled).toBe(true);
    });

    test('sets the volume to the initial volume if enabled and mixed', () => {
      channel.initialVolume = 10;
      channel.trigger();
      expect(channel.gainNode.gain.value).toEqual(10 / 15);
    });

    test('sets the volume to 0 if DAC is disabled', () => {
      channel.dacEnabled = false;
      channel.trigger();
      expect(channel.gainNode.gain.value).toEqual(0);
    });

    test('sets the volume to 0 if not mixed into either channel', () => {
      channel.mixLeft = false;
      channel.mixRight = false;
      channel.trigger();
      expect(channel.gainNode.gain.value).toEqual(0);
    });

    test('pans to the left', () => {
      channel.mixLeft = true;
      channel.mixRight = false;
      channel.trigger();
      expect(channel.stereoPannerNode.pan.value).toEqual(-1);
    });

    test('pans to the center', () => {
      channel.mixLeft = true;
      channel.mixRight = true;
      channel.trigger();
      expect(channel.stereoPannerNode.pan.value).toEqual(0);
    });

    test('pans to the right', () => {
      channel.mixLeft = false;
      channel.mixRight = true;
      channel.trigger();
      expect(channel.stereoPannerNode.pan.value).toEqual(1);
    });
  });

  test('disables', () => {
    const channel = new Channel(audioContext, outputNode);
    channel.trigger();
    channel.disable();
    expect(channel.enabled).toBe(false);
  });

  describe('length timer', () => {
    test('steps if length timer is enabled', () => {
      const channel = new Channel(audioContext, outputNode);
      channel.initialLength = 64;
      channel.enableLengthTimer = true;
      channel.trigger();
      expect(channel.length).toEqual(64);
      channel.step();
      expect(channel.length).toEqual(63);
      channel.step();
      expect(channel.length).toEqual(62);
    });

    test('does not step if length timer is disabled', () => {
      const channel = new Channel(audioContext, outputNode);
      channel.initialLength = 64;
      channel.enableLengthTimer = false;
      channel.trigger();
      expect(channel.length).toEqual(64);
      channel.step();
      expect(channel.length).toEqual(64);
    });

    test('does not step if channel is disabled', () => {
      const channel = new Channel(audioContext, outputNode);
      channel.initialLength = 64;
      channel.length = 64;
      channel.enableLengthTimer = true;
      channel.step();
      expect(channel.length).toEqual(64);
    });

    test('disables the channel if the length reaches 0', () => {
      const channel = new Channel(audioContext, outputNode);
      channel.initialLength = 2;
      channel.enableLengthTimer = true;
      channel.trigger();
      expect(channel.enabled).toBe(true);
      channel.step();
      expect(channel.enabled).toBe(true);
      channel.step();
      expect(channel.enabled).toBe(false);
    });
  });

  describe('envelope sweep', () => {
    test('increases the volume if sweep mode is increase', () => {
      channel.initialEnvelopeSweepPace = 1;
      channel.initialEnvelopeSweepMode = SweepMode.INCREASE;
      channel.initialVolume = 0;
      channel.trigger();
      channel.envelopeSweep();
      expect(channel.volume).toEqual(1);
      expect(channel.gainNode.gain.value).toEqual(1 / 15);
    });

    test('does not increase the volume above the maximum', () => {
      channel.initialEnvelopeSweepPace = 1;
      channel.initialEnvelopeSweepMode = SweepMode.INCREASE;
      channel.initialVolume = 15;
      channel.trigger();
      channel.envelopeSweep();
      expect(channel.volume).toEqual(15);
      expect(channel.gainNode.gain.value).toEqual(1);
    });

    test('decreases the volume if sweep mode is decrease', () => {
      channel.initialEnvelopeSweepPace = 1;
      channel.initialEnvelopeSweepMode = SweepMode.DECREASE;
      channel.initialVolume = 15;
      channel.trigger();
      channel.envelopeSweep();
      expect(channel.volume).toEqual(14);
      expect(channel.gainNode.gain.value).toEqual(14 / 15);
    });

    test('does not decrease the volume below zero', () => {
      channel.initialEnvelopeSweepPace = 1;
      channel.initialEnvelopeSweepMode = SweepMode.DECREASE;
      channel.initialVolume = 0;
      channel.trigger();
      channel.envelopeSweep();
      expect(channel.volume).toEqual(0);
      expect(channel.gainNode.gain.value).toEqual(0);
    });

    test('adjusts the volume at the sweep pace', () => {
      channel.initialEnvelopeSweepPace = 3;
      channel.initialEnvelopeSweepMode = SweepMode.INCREASE;
      channel.initialVolume = 0;
      channel.trigger();
      for (let i = 0; i < 20; i++) {
        expect(channel.volume).toEqual(Math.floor(i / 3));
        expect(channel.gainNode.gain.value).toEqual(Math.floor(i / 3) / 15);
        channel.envelopeSweep();
      }
    });

    test('does not sweep if the sweep pace is zero', () => {
      channel.initialEnvelopeSweepPace = 0;
      channel.initialEnvelopeSweepMode = SweepMode.INCREASE;
      channel.initialVolume = 0;
      channel.trigger();
      channel.envelopeSweep();
      expect(channel.volume).toEqual(0);
      expect(channel.gainNode.gain.value).toEqual(0);
    });
  });
});
