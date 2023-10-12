import Channel from './channel';
import { SweepMode } from './constants';

export default class PulseChannel extends Channel {
  initialPeriodSweepPace = 0;
  private periodSweepPace = 0;
  periodSweepMode = SweepMode.INCREASE;
  periodSweepSlope = 0;
  private periodPaceCount = 0;
  private periodValue = 0;

  waveDuty = 0;

  node: OscillatorNode;

  constructor(audioContext: AudioContext, outputNode: AudioNode) {
    super(audioContext, outputNode);

    this.node = audioContext.createOscillator();
    this.node.type = 'square';
    this.node.connect(this.gainNode);
    this.node.start();
  }

  reset() {
    super.reset();
    this.initialPeriodSweepPace = 0;
    this.periodSweepPace = 0;
    this.periodSweepMode = SweepMode.INCREASE;
    this.periodSweepSlope = 0;
    this.periodPaceCount = 0;
    this.periodValue = 0;
    this.waveDuty = 0;
  }

  set period(value: number) {
    this.periodValue = value;
    this.node.frequency.value = 131072 / (2048 - value);
  }

  get period() {
    return this.periodValue;
  }

  trigger() {
    this.periodSweepPace = this.initialPeriodSweepPace;
    this.periodPaceCount = 0;

    super.trigger();
  }

  periodSweep() {
    if (!this.enabled || this.periodSweepPace === 0) {
      return;
    }

    this.periodPaceCount++;

    if (this.periodPaceCount >= this.periodSweepPace) {
      const direction = this.periodSweepMode === SweepMode.INCREASE ? 1 : -1;
      const newPeriod = Math.floor(
        this.period + direction * (this.period / (1 << this.periodSweepSlope))
      );

      // Disable the period if the new value would overflow even if the slope is disabled
      if (newPeriod > 0x07ff) {
        this.disable();
        return;
      }

      if (this.periodSweepSlope !== 0) {
        this.period = newPeriod;
      }

      // Reload the sweep pace
      this.periodSweepPace = this.initialPeriodSweepPace;
      this.periodPaceCount = 0;
    }
  }
}
