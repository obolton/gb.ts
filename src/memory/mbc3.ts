import { MEMORY_RANGES, MEMORY_REGISTERS } from './constants';
import { inRange } from '../utils';
import { AddressRange, IO } from '../types';

// TODO: RTC support

type MBC3_REGISTERS = 'RAM_ENABLE' | 'ROM_BANK' | 'RAM_BANK' | 'BANK_MODE';

const MBC3_RANGES: Record<MBC3_REGISTERS, AddressRange> = {
  RAM_ENABLE: { start: 0x0000, end: 0x1fff },
  ROM_BANK: { start: 0x2000, end: 0x3fff },
  RAM_BANK: { start: 0x4000, end: 0x5fff },
  BANK_MODE: { start: 0x6000, end: 0x7fff },
};

export default class MBC3 implements IO {
  rom: Uint8Array;
  ram: Uint8Array;

  romBanks: number;
  ramBanks: number;
  romBank = 1;
  ramBank = 0;
  ramEnabled = false;

  constructor(rom: Uint8Array) {
    this.rom = rom;
    const romSize = rom[MEMORY_REGISTERS.ROM_SIZE];
    const ramSize = rom[MEMORY_REGISTERS.RAM_SIZE];
    this.romBanks = 0x02 << romSize;

    switch (ramSize) {
      case 0:
        this.ram = new Uint8Array(0);
        this.ramBanks = 0;
        break;
      case 2:
        this.ram = new Uint8Array(8192);
        this.ramBanks = 1;
        break;
      case 3:
        this.ram = new Uint8Array(32768);
        this.ramBanks = 4;
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
    if (inRange(address, MBC3_RANGES.RAM_ENABLE)) {
      this.ramEnabled = (value & 0x0f) === 0x0a;
      return;
    }

    if (inRange(address, MBC3_RANGES.ROM_BANK)) {
      this.romBank = value === 0 ? 1 : value & (this.romBanks - 1);
      return;
    }

    if (inRange(address, MBC3_RANGES.RAM_BANK)) {
      if (value <= 0x03 && this.ramBanks > 1) {
        this.ramBank = value;
      }
      return;
    }

    if (inRange(address, MEMORY_RANGES.EXTRAM) && this.ramEnabled) {
      this.ram[this.ramBank * 0x2000 + (address - MEMORY_RANGES.EXTRAM.start)] =
        value;
      return;
    }
  }
}
