import { MEMORY_RANGES, MEMORY_REGISTERS } from './constants';
import { inRange } from '../utils';
import { AddressRange, IO } from '../types';

enum Mode {
  ROM,
  RAM,
}

type MBC1_REGISTERS = 'RAM_ENABLE' | 'ROM_BANK' | 'RAM_BANK' | 'BANK_MODE';

const MBC1_RANGES: Record<MBC1_REGISTERS, AddressRange> = {
  RAM_ENABLE: { start: 0x0000, end: 0x1fff },
  ROM_BANK: { start: 0x2000, end: 0x3fff },
  RAM_BANK: { start: 0x4000, end: 0x5fff },
  BANK_MODE: { start: 0x6000, end: 0x7fff },
};

export default class MBC1 implements IO {
  rom: Uint8Array;
  ram: Uint8Array;

  romBanks: number;
  romBank = 1;
  ramBank = 0;
  mode = Mode.ROM;
  ramEnabled = false;

  constructor(rom: Uint8Array) {
    this.rom = rom;
    const romSize = rom[MEMORY_REGISTERS.ROM_SIZE];
    const ramSize = rom[MEMORY_REGISTERS.RAM_SIZE];
    this.romBanks = 0x02 << romSize;

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
      if (this.mode === Mode.ROM) {
        return this.ram[address - MEMORY_RANGES.EXTRAM.start];
      } else {
        return this.ram[
          this.ramBank * 0x2000 + (address - MEMORY_RANGES.EXTRAM.start)
        ];
      }
    }

    return 0xff;
  }

  write(address: number, value: number) {
    if (inRange(address, MBC1_RANGES.RAM_ENABLE)) {
      this.ramEnabled = (value & 0x0f) === 0x0a;
      return;
    }

    if (inRange(address, MBC1_RANGES.ROM_BANK)) {
      let bank = value & 0x1f;
      if (bank === 0) {
        bank = 1;
      }

      this.romBank = (this.romBank & 0x60) | bank;
      return;
    }

    if (inRange(address, MBC1_RANGES.RAM_BANK)) {
      if (this.mode === Mode.ROM) {
        this.romBank = ((value & 0x03) << 5) | (this.romBank & 0x1f);
      } else {
        this.ramBank = value & 0x03;
      }
      return;
    }

    if (inRange(address, MBC1_RANGES.BANK_MODE)) {
      this.mode = value & 0x1 ? Mode.RAM : Mode.ROM;
      return;
    }

    if (inRange(address, MEMORY_RANGES.EXTRAM) && this.ramEnabled) {
      this.ram[this.ramBank * 0x2000 + (address - MEMORY_RANGES.EXTRAM.start)] =
        value;
      return;
    }
  }
}
