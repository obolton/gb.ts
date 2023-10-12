import { Interrupts } from '../cpu/interrupts';
import type MMU from '../memory/mmu';
import type APU from '../audio/apu';
import { TIMER_REGISTERS, FREQUENCIES } from './constants';
import type { IO } from '../types';

export default class Timer implements IO {
  mmu?: MMU;
  apu?: APU;

  private div = 0;
  private tima = 0;
  private tma = 0;
  private enabled = false;
  private frequencyMode = 0;
  private divCycles = 0;
  private timaCycles = 0;

  reset() {
    this.div = 0;
    this.tima = 0;
    this.tma = 0;
    this.enabled = false;
    this.frequencyMode = 0;
    this.divCycles = 0;
    this.timaCycles = 0;
  }

  read(address: number) {
    switch (address) {
      case TIMER_REGISTERS.DIV:
        return this.div;

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
    switch (address) {
      case TIMER_REGISTERS.DIV:
        if (this.div & 0x10) {
          this.apu?.step();
        }

        this.div = 0; // Any writes to DIV reset its value to 0
        return;

      case TIMER_REGISTERS.TIMA:
        this.tima = value;
        return;

      case TIMER_REGISTERS.TMA:
        this.tma = value;
        return;

      case TIMER_REGISTERS.TAC:
        this.enabled = Boolean(value & 0x04);
        this.frequencyMode = value & 0x03;
        return;
    }
  }

  step(cycles: number) {
    this.divCycles += cycles;

    while (this.divCycles >= 64) {
      const value = (this.div + 1) & 0xff;

      // Step APU on falling edge of bit 4
      if (this.div & 0x10 && !(value & 0x10)) {
        this.apu?.step();
      }

      this.div = value;
      this.divCycles -= 64;
    }

    if (!this.enabled) {
      return;
    }

    this.timaCycles += cycles;
    const frequency = FREQUENCIES[this.frequencyMode];

    while (this.timaCycles >= frequency) {
      this.timaCycles -= frequency;

      if (this.tima < 0xff) {
        this.tima++;
      } else {
        this.tima = this.tma;
        this.mmu?.requestInterrupt(Interrupts.TIMER);
      }
    }
  }
}
