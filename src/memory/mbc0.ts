import { MEMORY_RANGES } from './constants';
import { inRange } from '../utils';
import { IO } from '../types';

export default class MBC0 implements IO {
  rom: Uint8Array;
  ram: Uint8Array;

  constructor(rom: Uint8Array) {
    this.rom = rom;
    this.ram = new Uint8Array(8192);
  }

  read(address: number) {
    if (inRange(address, MEMORY_RANGES.ROM)) {
      return this.rom[address];
    }

    if (inRange(address, MEMORY_RANGES.EXTRAM)) {
      return this.ram[address - MEMORY_RANGES.EXTRAM.start];
    }

    return 0xff;
  }

  write(address: number, value: number) {
    if (inRange(address, MEMORY_RANGES.EXTRAM)) {
      this.ram[address - MEMORY_RANGES.EXTRAM.start] = value;
    }
  }
}
