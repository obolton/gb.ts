import MBC0 from './mbc0';
import MBC1 from './mbc1';
import MBC2 from './mbc2';
import MBC3 from './mbc3';
import MBC5 from './mbc5';
import { MEMORY_REGISTERS } from './constants';
import { IO } from '../types';

export default class ExternalMemory {
  rom: Uint8Array;
  mbc: IO;

  constructor(rom: Uint8Array) {
    this.rom = rom;
    const mbcType = rom[MEMORY_REGISTERS.MBC_TYPE];

    switch (mbcType) {
      case 0x00:
        this.mbc = new MBC0(rom);
        break;
      case 0x01:
      case 0x02:
      case 0x03:
        this.mbc = new MBC1(rom);
        break;
      case 0x05:
      case 0x06:
        this.mbc = new MBC2(rom);
        break;
      case 0x0f:
      case 0x10:
      case 0x11:
      case 0x12:
      case 0x13:
        this.mbc = new MBC3(rom);
        break;
      case 0x19:
      case 0x1a:
      case 0x1b:
      case 0x1c:
      case 0x1d:
      case 0x1e:
        this.mbc = new MBC5(rom);
        break;
      default:
        throw new Error(`Unsupported MBC type: ${mbcType}`);
    }
  }

  read(address: number) {
    return this.mbc.read(address);
  }

  write(address: number, value: number) {
    return this.mbc.write(address, value);
  }

  getGameTitle() {
    return String.fromCharCode(...this.rom.slice(0x0134, 0x0143));
  }
}
