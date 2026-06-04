import Channel from './channel';
import { SweepMode } from './constants';

const DUTY_CYCLES = [0.125, 0.25, 0.5, 0.75];
const DUTY_HARMONICS = 64;

export default class PulseChannel extends Channel {
  initialPeriodSweepPace = 0;
  private periodSweepPace = 0;
  periodSweepMode = SweepMode.INCREASE;
  periodSweepSlope = 0;
  private periodPaceCount = 0;
  private periodValue = 0;

  waveDuty = 0;
  private dutyWaves: PeriodicWave[];

  node: OscillatorNode;

  constructor(audioContext: AudioContext, outputNode: AudioNode) {
    super(audioContext, outputNode);

    this.dutyWaves = DUTY_CYCLES.map((duty) => this.createDutyWave(duty));

    this.node = audioContext.createOscillator();
    this.updateDuty();
    this.node.connect(this.gainNode);
    this.node.start();
  }

  private createDutyWave(duty: number): PeriodicWave {
    const cosineTerms = new Float32Array(DUTY_HARMONICS + 1);
    const sineTerms = new Float32Array(DUTY_HARMONICS + 1);

    for (let n = 1; n <= DUTY_HARMONICS; n++) {
      cosineTerms[n] = (2 * Math.sin(2 * Math.PI * n * duty)) / (Math.PI * n);
      sineTerms[n] = (2 * (1 - Math.cos(2 * Math.PI * n * duty))) / (Math.PI * n);
    }

    return this.audioContext.createPeriodicWave(cosineTerms, sineTerms);
  }

  updateDuty() {
    this.node.setPeriodicWave(this.dutyWaves[this.waveDuty]);
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

    if (this.periodSweepSlope !== 0 && this.nextPeriod() > 0x07ff) {
      this.disable();
    }
  }

  private nextPeriod() {
    const direction = this.periodSweepMode === SweepMode.INCREASE ? 1 : -1;
    return Math.floor(this.period + direction * (this.period / (1 << this.periodSweepSlope)));
  }

  periodSweep() {
    if (!this.enabled || this.periodSweepPace === 0) {
      return;
    }

    this.periodPaceCount++;

    if (this.periodPaceCount >= this.periodSweepPace) {
      const newPeriod = this.nextPeriod();

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
