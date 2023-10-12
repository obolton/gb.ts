import { SweepMode } from './constants';

export default class Channel {
  audioContext: AudioContext;
  enabled = false;
  dacEnabled = false;

  mixLeft = false;
  mixRight = false;

  enableLengthTimer = false;
  initialLength = 64;
  length = 0;

  initialEnvelopeSweepMode = SweepMode.INCREASE;
  private envelopeSweepMode = SweepMode.INCREASE;

  initialEnvelopeSweepPace = 0;
  private envelopeSweepPace = 0;
  private envelopePaceCount = 0;

  initialVolume = 0;
  volume = 0;

  gainNode: GainNode;
  stereoPannerNode: StereoPannerNode;

  constructor(audioContext: AudioContext, outputNode: AudioNode) {
    this.audioContext = audioContext;

    this.stereoPannerNode = audioContext.createStereoPanner();
    this.stereoPannerNode.pan.value = 0;
    this.stereoPannerNode.connect(outputNode);

    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(this.stereoPannerNode);
  }

  reset() {
    this.enabled = false;
    this.dacEnabled = false;

    this.mixLeft = false;
    this.mixRight = false;

    this.enableLengthTimer = false;
    this.initialLength = 64;
    this.length = 0;

    this.initialEnvelopeSweepMode = SweepMode.INCREASE;
    this.envelopeSweepMode = SweepMode.INCREASE;

    this.initialEnvelopeSweepPace = 0;
    this.envelopeSweepPace = 0;
    this.envelopePaceCount = 0;

    this.initialVolume = 0;
    this.volume = 0;

    this.gainNode.gain.value = 0;
  }

  updateGain() {
    const volume = this.volume / 0xf;
    this.gainNode.gain.value =
      this.enabled && this.dacEnabled && (this.mixLeft || this.mixRight)
        ? volume
        : 0;

    // Center
    if (this.mixLeft && this.mixRight) {
      this.stereoPannerNode.pan.value = 0;

      // Left
    } else if (this.mixLeft && !this.mixRight) {
      this.stereoPannerNode.pan.value = -1;

      // Right
    } else if (!this.mixLeft && this.mixRight) {
      this.stereoPannerNode.pan.value = 1;

      // Mute
    } else {
      this.stereoPannerNode.pan.value = 0;
    }
  }

  trigger() {
    this.enabled = true;
    this.volume = this.initialVolume;
    this.length = this.initialLength;
    this.envelopeSweepMode = this.initialEnvelopeSweepMode;
    this.envelopeSweepPace = this.initialEnvelopeSweepPace;
    this.envelopePaceCount = 0;
    this.updateGain();
  }

  disable() {
    this.enabled = false;
    this.gainNode.gain.value = 0;
  }

  step() {
    if (!this.enabled || !this.enableLengthTimer) {
      return;
    }

    this.length--;

    if (this.length === 0) {
      this.disable();
    }
  }

  envelopeSweep() {
    if (!this.enabled || this.envelopeSweepPace === 0) {
      return;
    }

    this.envelopePaceCount++;

    if (this.envelopePaceCount >= this.envelopeSweepPace) {
      if (this.envelopeSweepMode === SweepMode.INCREASE && this.volume < 0xf) {
        this.volume++;
      } else if (
        this.envelopeSweepMode === SweepMode.DECREASE &&
        this.volume > 0
      ) {
        this.volume--;
      }

      this.updateGain();
      this.envelopePaceCount = 0;
    }
  }
}
