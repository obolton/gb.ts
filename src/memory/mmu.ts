import { MEMORY_RANGES, RAM_BANK_SIZE } from './constants';
import { inRange } from '../utils';
import { IO } from '../types';
import type { Interrupt } from '../cpu/interrupts';

/** Memory Management Unit */
export default class MMU {
  ppu?: IO;
  apu?: IO;
  timer?: IO;
  input?: IO;
  externalMemory?: IO;

  ram: Uint8Array;
  oam: Uint8Array;
  hram: Uint8Array;
  ie: number;
  if: number;
  ramBank: number;
  speed: number;

  constructor() {
    this.ram = new Uint8Array(32768);
    this.oam = new Uint8Array(160);
    this.hram = new Uint8Array(126);
    this.ie = 0x00;
    this.if = 0x00;
    this.ramBank = 1;
    this.speed = 0;
  }

  reset() {
    this.ram = new Uint8Array(32768);
    this.oam = new Uint8Array(160);
    this.hram = new Uint8Array(126);
    this.ie = 0x00;
    this.if = 0x00;
    this.ramBank = 1;
    this.speed = 0;
  }

  read(address: number) {
    if (!this.externalMemory) {
      throw new Error('No external memory mounted');
    }

    if (inRange(address, MEMORY_RANGES.ROM)) {
      return this.externalMemory.read(address);
    }

    if (inRange(address, MEMORY_RANGES.VRAM) && this.ppu) {
      return this.ppu.read(address);
    }

    if (inRange(address, MEMORY_RANGES.EXTRAM)) {
      return this.externalMemory.read(address);
    }

    if (inRange(address, MEMORY_RANGES.RAM_FIXED)) {
      return this.ram[address - MEMORY_RANGES.RAM_FIXED.start];
    }

    if (inRange(address, MEMORY_RANGES.RAM_SWITCHABLE)) {
      const bank = this.ramBank & 0x07 || 1;
      return this.ram[
        bank * RAM_BANK_SIZE + (address - MEMORY_RANGES.RAM_SWITCHABLE.start)
      ];
    }

    if (inRange(address, MEMORY_RANGES.ECHO_RAM_FIXED)) {
      return this.ram[address - MEMORY_RANGES.ECHO_RAM_FIXED.start];
    }

    if (inRange(address, MEMORY_RANGES.ECHO_RAM_SWITCHABLE)) {
      const bank = this.ramBank & 0x07 || 1;
      return this.ram[
        bank * RAM_BANK_SIZE +
          (address - MEMORY_RANGES.ECHO_RAM_SWITCHABLE.start)
      ];
    }

    if (inRange(address, MEMORY_RANGES.OAM)) {
      return this.oam[address - MEMORY_RANGES.OAM.start];
    }

    if (inRange(address, MEMORY_RANGES.IO)) {
      if (address === MEMORY_RANGES.SPEED.start) {
        return this.speed;
      }

      if (inRange(address, MEMORY_RANGES.INPUT) && this.input) {
        return this.input.read(address);
      }

      if (inRange(address, MEMORY_RANGES.TIMER) && this.timer) {
        return this.timer.read(address);
      }

      if (inRange(address, MEMORY_RANGES.AUDIO) && this.apu) {
        return this.apu.read(address);
      }

      if (inRange(address, MEMORY_RANGES.LCD) && this.ppu) {
        return this.ppu.read(address);
      }

      if (address === MEMORY_RANGES.SVBK.start) {
        return this.ramBank;
      }

      if (address === MEMORY_RANGES.IF.start) {
        return this.if | 0xe0;
      }

      return 0xff;
    }

    if (inRange(address, MEMORY_RANGES.HRAM)) {
      return this.hram[address - MEMORY_RANGES.HRAM.start];
    }

    if (address === MEMORY_RANGES.IE.start) {
      return this.ie | 0xe0;
    }

    throw new Error(`Unknown address: ${address.toString(16)}`);
  }

  readWord(address: number) {
    return (this.read((address + 1) & 0xffff) << 8) | this.read(address);
  }

  write(address: number, value: number) {
    if (!this.externalMemory) {
      throw new Error('No external memory mounted');
    }

    if (inRange(address, MEMORY_RANGES.ROM)) {
      this.externalMemory.write(address, value);
      return;
    }

    if (inRange(address, MEMORY_RANGES.VRAM) && this.ppu) {
      this.ppu.write(address, value);
      return;
    }

    if (inRange(address, MEMORY_RANGES.EXTRAM)) {
      this.externalMemory.write(address, value);
      return;
    }

    if (inRange(address, MEMORY_RANGES.RAM_FIXED)) {
      this.ram[address - MEMORY_RANGES.RAM_FIXED.start] = value;
      return;
    }

    if (inRange(address, MEMORY_RANGES.RAM_SWITCHABLE)) {
      const bank = this.ramBank & 0x07 || 1;
      this.ram[
        bank * RAM_BANK_SIZE + (address - MEMORY_RANGES.RAM_SWITCHABLE.start)
      ] = value;
      return;
    }

    if (inRange(address, MEMORY_RANGES.ECHO_RAM_FIXED)) {
      this.ram[address - MEMORY_RANGES.ECHO_RAM_FIXED.start] = value;
      return;
    }

    if (inRange(address, MEMORY_RANGES.ECHO_RAM_SWITCHABLE)) {
      const bank = this.ramBank & 0x07 || 1;
      this.ram[
        bank * RAM_BANK_SIZE +
          (address - MEMORY_RANGES.ECHO_RAM_SWITCHABLE.start)
      ] = value;
      return;
    }

    if (inRange(address, MEMORY_RANGES.OAM)) {
      this.oam[address - MEMORY_RANGES.OAM.start] = value;
      return;
    }

    if (inRange(address, MEMORY_RANGES.IO)) {
      if (address === MEMORY_RANGES.SPEED.start) {
        this.speed = value;
        return;
      }

      if (inRange(address, MEMORY_RANGES.INPUT) && this.input) {
        return this.input.write(address, value);
      }

      if (inRange(address, MEMORY_RANGES.TIMER) && this.timer) {
        return this.timer.write(address, value);
      }

      if (inRange(address, MEMORY_RANGES.AUDIO) && this.apu) {
        return this.apu.write(address, value);
      }

      if (inRange(address, MEMORY_RANGES.LCD) && this.ppu) {
        return this.ppu.write(address, value);
      }

      if (address === MEMORY_RANGES.SVBK.start) {
        this.ramBank = value;
        return;
      }

      if (address === MEMORY_RANGES.IF.start) {
        this.if = value;
        return;
      }

      return;
    }

    if (inRange(address, MEMORY_RANGES.HRAM)) {
      this.hram[address - MEMORY_RANGES.HRAM.start] = value;
      return;
    }

    if (address === MEMORY_RANGES.IE.start) {
      this.ie = value;
      return;
    }
  }

  writeWord(address: number, value: number) {
    this.write(address, value & 0xff);
    this.write((address + 1) & 0xffff, value >> 8);
  }

  dma(source: number) {
    for (let i = 0; i < 160; i++) {
      this.write(0xfe00 + i, this.read((source << 8) + i));
    }
  }

  requestInterrupt(interrupt: Interrupt) {
    this.write(0xff0f, this.read(0xff0f) | interrupt.flag);
  }
}
