import { MEMORY_RANGES } from './constants';
import { inRange } from '../utils';
import { IO } from '../types';

export default class MBC2 implements IO {
  rom: Uint8Array;
  ram: Uint8Array;

  romBank = 1;
  ramEnabled = false;

  constructor(rom: Uint8Array) {
    this.rom = rom;
    this.ram = new Uint8Array(512);
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
      return this.ram[address & 0x01ff];
    }

    return 0xff;
  }

  write(address: number, value: number) {
    if (inRange(address, MEMORY_RANGES.ROM_FIXED_BANK)) {
      if (address & 0x0100) {
        let bank = value & 0x0f;
        if (bank === 0) {
          bank = 1;
        }
        this.romBank = bank;
      } else {
        this.ramEnabled = value === 0x0a;
      }
      return;
    }

    if (inRange(address, MEMORY_RANGES.EXTRAM) && this.ramEnabled) {
      this.ram[address & 0x01ff] = value & 0x0f;
      return;
    }
  }
}
