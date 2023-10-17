import { MEMORY_RANGES, MEMORY_REGISTERS } from './constants';
import { inRange } from '../utils';
import { AddressRange, IO } from '../types';

type MBC5_REGISTERS =
  | 'RAM_ENABLE'
  | 'ROM_BANK_LOW'
  | 'ROM_BANK_HIGH'
  | 'RAM_BANK';

const MBC5_RANGES: Record<MBC5_REGISTERS, AddressRange> = {
  RAM_ENABLE: { start: 0x0000, end: 0x1fff },
  ROM_BANK_LOW: { start: 0x2000, end: 0x2fff },
  ROM_BANK_HIGH: { start: 0x3000, end: 0x3fff },
  RAM_BANK: { start: 0x4000, end: 0x5fff },
};

export default class MBC5 implements IO {
  rom: Uint8Array;
  ram: Uint8Array;

  romBank = 1;
  ramBank = 0;
  ramEnabled = false;

  constructor(rom: Uint8Array) {
    this.rom = rom;
    const ramSize = rom[MEMORY_REGISTERS.RAM_SIZE];

    switch (ramSize) {
      case 0:
        this.ram = new Uint8Array(0);
        break;
      case 2:
        this.ram = new Uint8Array(8192);
        break;
      case 3:
        this.ram = new Uint8Array(32768);
        break;
      case 4:
        this.ram = new Uint8Array(131072);
        break;
      default:
        throw new Error(`Unsupported external RAM size: ${ramSize}`);
    }
  }

  read(address: number) {
    if (inRange(address, MEMORY_RANGES.ROM_FIXED_BANK)) {
      return this.rom[address];
    }

    if (inRange(address, MEMORY_RANGES.ROM_SWITCHABLE_BANK)) {
      return this.rom[
        this.romBank * 0x4000 +
          (address - MEMORY_RANGES.ROM_SWITCHABLE_BANK.start)
      ];
    }

    if (inRange(address, MEMORY_RANGES.EXTRAM) && this.ramEnabled) {
      return this.ram[
        this.ramBank * 0x2000 + (address - MEMORY_RANGES.EXTRAM.start)
      ];
    }

    return 0xff;
  }

  write(address: number, value: number) {
    if (inRange(address, MBC5_RANGES.RAM_ENABLE)) {
      this.ramEnabled = (value & 0x0f) === 0x0a;
      return;
    }

    if (inRange(address, MBC5_RANGES.ROM_BANK_LOW)) {
      this.romBank = (this.romBank & 0x0100) | value;
      return;
    }

    if (inRange(address, MBC5_RANGES.ROM_BANK_HIGH)) {
      this.romBank = ((value & 0x01) << 8) | (this.romBank & 0x0ff);
      return;
    }

    if (inRange(address, MBC5_RANGES.RAM_BANK)) {
      this.ramBank = value & 0x0f;
      return;
    }

    if (inRange(address, MEMORY_RANGES.EXTRAM) && this.ramEnabled) {
      this.ram[this.ramBank * 0x2000 + (address - MEMORY_RANGES.EXTRAM.start)] =
        value;
      return;
    }
  }
}
