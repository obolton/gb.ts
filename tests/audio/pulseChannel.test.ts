import { describe, expect, test, vi } from 'vitest';
import PulseChannel from '../../src/audio/pulseChannel';
import { SweepMode } from '../../src/audio/constants';
import AudioContext from '../mocks/AudioContext';

describe('PulseChannel', () => {
  const audioContext = new AudioContext();
  const leftOutput = audioContext.createGain();
  const rightOutput = audioContext.createGain();

  test('sets the frequency', () => {
    const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
    pulseChannel.period = 1024;
    pulseChannel.trigger();
    expect(pulseChannel.node.frequency.value).toEqual(128);
    pulseChannel.period = 0;
    pulseChannel.trigger();
    expect(pulseChannel.node.frequency.value).toEqual(64);
  });

  describe('period sweep', () => {
    test('increases the period if sweep mode is increase', () => {
      const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
      pulseChannel.dacEnabled = true;
      pulseChannel.initialPeriodSweepPace = 1;
      pulseChannel.periodSweepMode = SweepMode.INCREASE;
      pulseChannel.periodSweepSlope = 2;
      pulseChannel.period = 256;
      pulseChannel.trigger();
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(320);
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(400);
    });

    test('decreases the period if sweep mode is decrease', () => {
      const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
      pulseChannel.dacEnabled = true;
      pulseChannel.initialPeriodSweepPace = 1;
      pulseChannel.periodSweepMode = SweepMode.DECREASE;
      pulseChannel.periodSweepSlope = 2;
      pulseChannel.period = 256;
      pulseChannel.trigger();
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(192);
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(144);
    });

    test('sweeps at the sweep pace', () => {
      const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
      pulseChannel.dacEnabled = true;
      pulseChannel.initialPeriodSweepPace = 3;
      pulseChannel.periodSweepMode = SweepMode.INCREASE;
      pulseChannel.periodSweepSlope = 2;
      pulseChannel.period = 256;
      pulseChannel.trigger();
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(256);
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(256);
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(320);
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(320);
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(320);
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(400);
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(400);
    });

    test('disables the channel if the period would overflow', () => {
      const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
      pulseChannel.dacEnabled = true;
      pulseChannel.initialPeriodSweepPace = 1;
      pulseChannel.periodSweepMode = SweepMode.INCREASE;
      pulseChannel.periodSweepSlope = 1;
      pulseChannel.period = 1024;
      pulseChannel.trigger();
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(1536);
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(1536);
      expect(pulseChannel.enabled).toBe(false);
    });

    test('does not adjust the period if the period sweep pace is zero', () => {
      const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
      pulseChannel.dacEnabled = true;
      pulseChannel.initialPeriodSweepPace = 0;
      pulseChannel.periodSweepMode = SweepMode.INCREASE;
      pulseChannel.periodSweepSlope = 1;
      pulseChannel.period = 256;
      pulseChannel.trigger();
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(256);
    });

    test('disables the channel on trigger if the sweep would overflow', () => {
      const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
      pulseChannel.dacEnabled = true;
      pulseChannel.periodSweepMode = SweepMode.INCREASE;
      pulseChannel.periodSweepSlope = 1;
      pulseChannel.period = 2000;
      pulseChannel.trigger();
      expect(pulseChannel.enabled).toBe(false);
    });
  });

  describe('duty cycle', () => {
    test('selects a distinct waveform for each duty cycle', () => {
      const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
      const setPeriodicWave = vi.spyOn(pulseChannel.node, 'setPeriodicWave');

      const waves = [0, 1, 2, 3].map((duty) => {
        pulseChannel.waveDuty = duty;
        pulseChannel.updateDuty();
        return setPeriodicWave.mock.lastCall?.[0];
      });

      expect(new Set(waves).size).toEqual(4);
    });

    test('reuses the same waveform for a given duty cycle', () => {
      const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
      const setPeriodicWave = vi.spyOn(pulseChannel.node, 'setPeriodicWave');

      pulseChannel.waveDuty = 3;
      pulseChannel.updateDuty();
      const wave = setPeriodicWave.mock.lastCall?.[0];

      pulseChannel.waveDuty = 1;
      pulseChannel.updateDuty();
      pulseChannel.waveDuty = 3;
      pulseChannel.updateDuty();

      expect(setPeriodicWave.mock.lastCall?.[0]).toBe(wave);
    });

    test('restores the duty cycle 0 waveform on reset', () => {
      const pulseChannel = new PulseChannel(audioContext, leftOutput, rightOutput);
      const setPeriodicWave = vi.spyOn(pulseChannel.node, 'setPeriodicWave');

      pulseChannel.waveDuty = 0;
      pulseChannel.updateDuty();
      const dutyZeroWave = setPeriodicWave.mock.lastCall?.[0];

      pulseChannel.waveDuty = 3;
      pulseChannel.updateDuty();
      pulseChannel.reset();

      expect(pulseChannel.waveDuty).toEqual(0);
      expect(setPeriodicWave.mock.lastCall?.[0]).toBe(dutyZeroWave);
    });
  });
});
