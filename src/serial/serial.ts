import { Interrupts } from '../cpu/interrupts';
import { SERIAL_REGISTERS, SERIAL_TRANSFER_CYCLES, SERIAL_FAST_TRANSFER_CYCLES } from './constants';
import type MMU from '../memory/mmu';
import type { IO } from '../types';

export default class Serial implements IO {
  mmu?: MMU;
  cgbMode = false;

  private data = 0x00;
  private enabled = false;
  private internalClock = false;
  private fastClock = false;
  private clock = 0;

  reset() {
    this.data = 0x00;
    this.enabled = false;
    this.internalClock = false;
    this.fastClock = false;
    this.clock = 0;
  }

  read(address: number) {
    switch (address) {
      case SERIAL_REGISTERS.SB:
        return this.data;

      case SERIAL_REGISTERS.SC:
        return (
          (this.enabled ? 0x80 : 0) |
          (this.fastClock ? 0x02 : 0) |
          (this.internalClock ? 0x01 : 0) |
          (this.cgbMode ? 0x7c : 0x7e)
        );

      default:
        return 0xff;
    }
  }

  write(address: number, value: number) {
    switch (address) {
      case SERIAL_REGISTERS.SB:
        this.data = value;
        return;

      case SERIAL_REGISTERS.SC:
        this.enabled = (value & 0x80) !== 0;
        this.fastClock = (value & 0x02) !== 0;
        this.internalClock = (value & 0x01) !== 0;

        if (this.enabled && this.internalClock) {
          this.clock =
            this.cgbMode && this.fastClock ? SERIAL_FAST_TRANSFER_CYCLES : SERIAL_TRANSFER_CYCLES;
        } else {
          this.clock = 0;
        }
        return;
    }
  }

  step(cycles: number) {
    if (this.clock === 0) {
      return;
    }

    this.clock -= cycles;
    if (this.clock > 0) {
      return;
    }

    this.clock = 0;
    this.data = 0xff;
    this.enabled = false;
    this.mmu?.requestInterrupt(Interrupts.SERIAL);
  }
}
