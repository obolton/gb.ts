import { Interrupts } from '../cpu/interrupts';
import { TIMER_REGISTERS, TIMA_BITS } from './constants';
import type MMU from '../memory/mmu';
import type APU from '../audio/apu';
import type { IO } from '../types';

export default class Timer implements IO {
  mmu?: MMU;
  apu?: APU;

  private counter = 0;
  private tima = 0;
  private tma = 0;
  private enabled = false;
  private frequencyMode = 0;
  private overflowPending = false;
  private reloading = false;
  private stopped = false;

  private get apuBit() {
    return (this.mmu?.speed ?? 0) & 0x80 ? 13 : 12;
  }

  reset() {
    this.counter = 0;
    this.tima = 0;
    this.tma = 0;
    this.enabled = false;
    this.frequencyMode = 0;
    this.overflowPending = false;
    this.reloading = false;
    this.stopped = false;
  }

  read(address: number) {
    switch (address) {
      case TIMER_REGISTERS.DIV:
        return (this.counter >> 8) & 0xff;

      case TIMER_REGISTERS.TIMA:
        return this.tima;

      case TIMER_REGISTERS.TMA:
        return this.tma;

      case TIMER_REGISTERS.TAC:
        return 0xf8 | (this.enabled ? 0x04 : 0) | this.frequencyMode;

      default:
        return 0xff;
    }
  }

  write(address: number, value: number) {
    value &= 0xff;

    switch (address) {
      case TIMER_REGISTERS.DIV:
        this.setCounter(0);
        return;

      case TIMER_REGISTERS.TIMA:
        if (this.reloading) {
          return;
        }

        this.tima = value;
        this.overflowPending = false;
        return;

      case TIMER_REGISTERS.TMA:
        this.tma = value;
        if (this.reloading) {
          this.tima = value;
        }
        return;

      case TIMER_REGISTERS.TAC: {
        const oldInput = this.timerInput();
        this.enabled = Boolean(value & 0x04);
        this.frequencyMode = value & 0x03;
        this.tickTima(oldInput);
        return;
      }
    }
  }

  stop() {
    this.setCounter(0);
    this.stopped = true;
  }

  resume() {
    this.stopped = false;
  }

  speedSwitch() {
    this.setCounter(0);
    this.stopped = false;
  }

  step(cycles: number) {
    if (this.stopped) {
      return;
    }

    for (let i = 0; i < cycles; i++) {
      this.stepCycle();
    }
  }

  private stepCycle() {
    this.reloading = false;

    if (this.overflowPending) {
      this.overflowPending = false;
      this.reloading = true;
      this.tima = this.tma;
      this.mmu?.requestInterrupt(Interrupts.TIMER);
    }

    this.setCounter(this.counter + 4);
  }

  private setCounter(value: number) {
    const oldApuInput = this.apuInput();
    const oldTimerInput = this.timerInput();

    this.counter = value & 0xffff;

    if (oldApuInput && !this.apuInput()) {
      this.apu?.step();
    }

    this.tickTima(oldTimerInput);
  }

  private tickTima(oldInput: boolean) {
    if (oldInput && !this.timerInput()) {
      this.incrementTima();
    }
  }

  private timerInput() {
    return this.enabled && Boolean(this.counter & (1 << TIMA_BITS[this.frequencyMode]));
  }

  private apuInput() {
    return Boolean(this.counter & (1 << this.apuBit));
  }

  private incrementTima() {
    if (this.tima < 0xff) {
      this.tima++;
    } else {
      this.tima = 0;
      this.overflowPending = true;
    }
  }
}
