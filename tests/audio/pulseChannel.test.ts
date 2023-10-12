import PulseChannel from '../../src/audio/pulseChannel';
import { SweepMode } from '../../src/audio/constants';
import AudioContext from '../mocks/AudioContext';

describe('PulseChannel', () => {
  const audioContext = new AudioContext();
  const outputNode = audioContext.createGain();

  test('sets the frequency', () => {
    const pulseChannel = new PulseChannel(audioContext, outputNode);
    pulseChannel.period = 1024;
    pulseChannel.trigger();
    expect(pulseChannel.node.frequency.value).toEqual(128);
    pulseChannel.period = 0;
    pulseChannel.trigger();
    expect(pulseChannel.node.frequency.value).toEqual(64);
  });

  describe('period sweep', () => {
    test('increases the period if sweep mode is increase', () => {
      const pulseChannel = new PulseChannel(audioContext, outputNode);
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
      const pulseChannel = new PulseChannel(audioContext, outputNode);
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
      const pulseChannel = new PulseChannel(audioContext, outputNode);
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
      const pulseChannel = new PulseChannel(audioContext, outputNode);
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
      const pulseChannel = new PulseChannel(audioContext, outputNode);
      pulseChannel.initialPeriodSweepPace = 0;
      pulseChannel.periodSweepMode = SweepMode.INCREASE;
      pulseChannel.periodSweepSlope = 1;
      pulseChannel.period = 256;
      pulseChannel.trigger();
      pulseChannel.periodSweep();
      expect(pulseChannel.period).toEqual(256);
    });
  });
});
