import PulseChannel from './pulseChannel';
import WaveChannel from './waveChannel';
import NoiseChannel from './noiseChannel';
import { SweepMode } from './constants';
import { AUDIO_REGISTERS, WAVE_RAM_START, WAVE_RAM_END } from './constants';

/** Audio Processing Unit */
export default class APU {
  audioContext: AudioContext;
  masterGain: GainNode;
  leftGain: GainNode;
  rightGain: GainNode;
  splitter: ChannelSplitterNode;
  merger: ChannelMergerNode;

  enabled = false;
  leftVolume = 0;
  rightVolume = 0;

  channel1: PulseChannel;
  channel2: PulseChannel;
  channel3: WaveChannel;
  channel4: NoiseChannel;

  clock = 0;

  constructor() {
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.audioContext.destination);

    this.merger = this.audioContext.createChannelMerger(2);
    this.merger.connect(this.masterGain);

    this.leftGain = this.audioContext.createGain();
    this.leftGain.gain.value = 0;
    this.leftGain.connect(this.merger, 0, 0);

    this.rightGain = this.audioContext.createGain();
    this.rightGain.gain.value = 0;
    this.rightGain.connect(this.merger, 0, 1);

    this.splitter = this.audioContext.createChannelSplitter(2);
    this.splitter.connect(this.leftGain, 0);
    this.splitter.connect(this.rightGain, 1);

    this.channel1 = new PulseChannel(this.audioContext, this.splitter);
    this.channel2 = new PulseChannel(this.audioContext, this.splitter);
    this.channel3 = new WaveChannel(this.audioContext, this.splitter);
    this.channel4 = new NoiseChannel(this.audioContext, this.splitter);
  }

  reset() {
    this.enabled = false;
    this.leftVolume = 0;
    this.rightVolume = 0;
    this.channel1.reset();
    this.channel2.reset();
    this.channel3.reset();
    this.channel4.reset();
    this.masterGain.gain.value = 0;
  }

  updateGain() {
    this.masterGain.gain.value = this.enabled ? 0.25 : 0;
    this.leftGain.gain.value = (this.leftVolume + 1) / 8;
    this.rightGain.gain.value = (this.rightVolume + 1) / 8;
  }

  read(address: number) {
    if (address >= WAVE_RAM_START && address <= WAVE_RAM_END) {
      return this.channel3.wave[address - WAVE_RAM_START];
    }

    switch (address) {
      case AUDIO_REGISTERS.NR50:
        return (this.leftVolume << 4) | this.rightVolume;

      case AUDIO_REGISTERS.NR51:
        return (
          (this.channel4.mixLeft ? 0x80 : 0) |
          (this.channel3.mixLeft ? 0x40 : 0) |
          (this.channel2.mixLeft ? 0x20 : 0) |
          (this.channel1.mixLeft ? 0x10 : 0) |
          (this.channel4.mixRight ? 0x08 : 0) |
          (this.channel3.mixRight ? 0x04 : 0) |
          (this.channel2.mixRight ? 0x02 : 0) |
          (this.channel1.mixRight ? 0x01 : 0)
        );

      case AUDIO_REGISTERS.NR52:
        return (
          (this.enabled ? 0x80 : 0) |
          (this.channel4.enabled ? 0x08 : 0) |
          (this.channel3.enabled ? 0x04 : 0) |
          (this.channel2.enabled ? 0x02 : 0) |
          (this.channel1.enabled ? 0x01 : 0)
        );

      // Channel 1
      case AUDIO_REGISTERS.NR10:
        return (
          (this.channel1.initialPeriodSweepPace << 4) |
          (this.channel1.periodSweepMode === SweepMode.DECREASE ? 0x08 : 0) |
          this.channel1.periodSweepSlope
        );

      case AUDIO_REGISTERS.NR11:
        return (this.channel1.waveDuty << 6) | 0x3f;

      case AUDIO_REGISTERS.NR12:
        return (
          (this.channel1.initialVolume << 4) |
          (this.channel1.initialEnvelopeSweepMode === SweepMode.INCREASE
            ? 0x08
            : 0) |
          this.channel1.initialEnvelopeSweepPace
        );

      case AUDIO_REGISTERS.NR14:
        return this.channel1.enableLengthTimer ? 0x40 : 0;

      // Channel 2
      case AUDIO_REGISTERS.NR21:
        return (this.channel2.waveDuty << 6) | 0x3f;

      case AUDIO_REGISTERS.NR22:
        return (
          (this.channel2.initialVolume << 4) |
          (this.channel2.initialEnvelopeSweepMode === SweepMode.INCREASE
            ? 0x08
            : 0) |
          this.channel2.initialEnvelopeSweepPace
        );

      case AUDIO_REGISTERS.NR24:
        return this.channel2.enableLengthTimer ? 0x40 : 0;

      // Channel 3
      case AUDIO_REGISTERS.NR30:
        return this.channel3.dacEnabled ? 0x80 : 0;

      case AUDIO_REGISTERS.NR32:
        return this.channel3.outputLevel << 5;

      case AUDIO_REGISTERS.NR34:
        return this.channel3.enableLengthTimer ? 0x40 : 0;

      // Channel 4
      case AUDIO_REGISTERS.NR42:
        return (
          (this.channel4.initialVolume << 4) |
          (this.channel4.initialEnvelopeSweepMode === SweepMode.INCREASE
            ? 0x08
            : 0) |
          this.channel4.initialEnvelopeSweepPace
        );

      case AUDIO_REGISTERS.NR43:
        return (
          (this.channel4.clockShift << 4) |
          (this.channel4.lfsrWidth << 3) |
          this.channel4.clockDivider
        );

      case AUDIO_REGISTERS.NR44:
        return this.channel4.enableLengthTimer ? 0x40 : 0;

      default:
        return 0xff;
    }
  }

  write(address: number, value: number) {
    if (address >= WAVE_RAM_START && address <= WAVE_RAM_END) {
      this.channel3.wave[address - WAVE_RAM_START] = value;
      return;
    }

    switch (address) {
      case AUDIO_REGISTERS.NR50:
        this.leftVolume = (value & 0x70) >> 4;
        this.rightVolume = value & 0x07;
        this.updateGain();
        return;

      case AUDIO_REGISTERS.NR51:
        this.channel4.mixLeft = Boolean(value & 0x80);
        this.channel3.mixLeft = Boolean(value & 0x40);
        this.channel2.mixLeft = Boolean(value & 0x20);
        this.channel1.mixLeft = Boolean(value & 0x10);
        this.channel4.mixRight = Boolean(value & 0x08);
        this.channel3.mixRight = Boolean(value & 0x04);
        this.channel2.mixRight = Boolean(value & 0x02);
        this.channel1.mixRight = Boolean(value & 0x01);
        return;

      case AUDIO_REGISTERS.NR52:
        this.enabled = Boolean(value & 0x80);
        this.updateGain();
        return;

      // Channel 1
      case AUDIO_REGISTERS.NR10:
        this.channel1.initialPeriodSweepPace = (value & 0x70) >> 4;
        this.channel1.periodSweepMode =
          value & 0x08 ? SweepMode.DECREASE : SweepMode.INCREASE;
        this.channel1.periodSweepSlope = value & 0x07;
        return;

      case AUDIO_REGISTERS.NR11:
        this.channel1.waveDuty = value >> 6;
        this.channel1.initialLength = 64 - (value & 0x3f);
        return;

      case AUDIO_REGISTERS.NR12:
        this.channel1.initialVolume = value >> 4;
        this.channel1.initialEnvelopeSweepMode =
          value & 0x08 ? SweepMode.INCREASE : SweepMode.DECREASE;
        this.channel1.initialEnvelopeSweepPace = value & 0x07;
        this.channel1.dacEnabled = Boolean(value & 0xf8);
        return;

      case AUDIO_REGISTERS.NR13:
        this.channel1.period = (this.channel1.period & 0xff00) | value;
        return;

      case AUDIO_REGISTERS.NR14:
        this.channel1.enableLengthTimer = Boolean(value & 0x40);
        this.channel1.period =
          ((value & 0x07) << 8) | (this.channel1.period & 0x00ff);

        if (value & 0x80) {
          this.channel1.trigger();
        }
        return;

      // Channel 2
      case AUDIO_REGISTERS.NR21:
        this.channel2.waveDuty = value >> 6;
        this.channel2.initialLength = 64 - (value & 0x3f);
        return;

      case AUDIO_REGISTERS.NR22:
        this.channel2.initialVolume = value >> 4;
        this.channel2.initialEnvelopeSweepMode =
          value & 0x08 ? SweepMode.INCREASE : SweepMode.DECREASE;
        this.channel2.initialEnvelopeSweepPace = value & 0x07;
        this.channel2.dacEnabled = Boolean(value & 0xf8);
        return;

      case AUDIO_REGISTERS.NR23:
        this.channel2.period = (this.channel2.period & 0xff00) | value;
        return;

      case AUDIO_REGISTERS.NR24:
        this.channel2.enableLengthTimer = Boolean(value & 0x40);
        this.channel2.period =
          ((value & 0x07) << 8) | (this.channel2.period & 0x00ff);

        if (value & 0x80) {
          this.channel2.trigger();
        }
        return;

      // Channel 3
      case AUDIO_REGISTERS.NR30:
        this.channel3.dacEnabled = Boolean(value & 0x80);
        return;

      case AUDIO_REGISTERS.NR31:
        this.channel3.initialLength = 256 - value;
        return;

      case AUDIO_REGISTERS.NR32:
        this.channel3.outputLevel = (value & 0x60) >> 5;
        return;

      case AUDIO_REGISTERS.NR33:
        this.channel3.periodValue =
          (this.channel3.periodValue & 0xff00) | value;
        return;

      case AUDIO_REGISTERS.NR34:
        this.channel3.enableLengthTimer = Boolean(value & 0x40);
        this.channel3.periodValue =
          ((value & 0x07) << 8) | (this.channel3.periodValue & 0x00ff);

        if (value & 0x80) {
          this.channel3.trigger();
        }
        return;

      // Channel 4
      case AUDIO_REGISTERS.NR41:
        this.channel4.initialLength = 64 - (value & 0x3f);
        return;

      case AUDIO_REGISTERS.NR42:
        this.channel4.initialVolume = value >> 4;
        this.channel4.initialEnvelopeSweepMode =
          value & 0x08 ? SweepMode.INCREASE : SweepMode.DECREASE;
        this.channel4.initialEnvelopeSweepPace = value & 0x07;
        this.channel4.dacEnabled = Boolean(value & 0xf8);
        return;

      case AUDIO_REGISTERS.NR43:
        this.channel4.clockShift = (value & 0xf0) >> 4;
        this.channel4.lfsrWidth = (value & 0x08) >> 3;
        this.channel4.clockDivider = value & 0x07;
        this.channel4.updateFrequency();
        return;

      case AUDIO_REGISTERS.NR44:
        this.channel4.enableLengthTimer = Boolean(value & 0x40);

        if (value & 0x80) {
          this.channel4.trigger();
        }
        return;
    }
  }

  step() {
    this.clock++;

    if (this.clock % 2 === 0) {
      this.channel1.step();
      this.channel2.step();
      this.channel3.step();
      this.channel4.step();
    }

    if (this.clock % 4 === 0) {
      this.channel1.periodSweep();
    }

    if (this.clock === 8) {
      this.channel1.envelopeSweep();
      this.channel2.envelopeSweep();
      this.channel4.envelopeSweep();
      this.clock = 0;
    }
  }
}
