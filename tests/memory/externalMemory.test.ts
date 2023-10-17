import ExternalMemory from '../../src/memory/externalMemory';
import { MEMORY_REGISTERS } from '../../src/memory/constants';
import MBC0 from '../../src/memory/mbc0';
import MBC1 from '../../src/memory/mbc1';
import MBC2 from '../../src/memory/mbc2';
import MBC3 from '../../src/memory/mbc3';
import MBC5 from '../../src/memory/mbc5';
import MOCK_ROM from '../mocks/rom';

describe('ExternalMemory', () => {
  test('reads from memory', () => {
    const externalMemory = new ExternalMemory(MOCK_ROM);
    expect(externalMemory.read(0x03)).toEqual(MOCK_ROM[0x03]);
  });

  test('writes to memory', () => {
    const externalMemory = new ExternalMemory(MOCK_ROM);
    externalMemory.write(0xa000, 0xab);
    expect(externalMemory.read(0xa000)).toEqual(0xab);
  });

  describe('MBCs', () => {
    test('ROM only', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = 0;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC0);
    });

    test.each([0x01, 0x02, 0x03])('MBC1 (%i)', (mbcType) => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = mbcType;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC1);
    });

    test.each([0x05, 0x06])('MBC2 (%i)', (mbcType) => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = mbcType;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC2);
    });

    test.each([0x11, 0x12, 0x13])('MBC3 (%i)', (mbcType) => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = mbcType;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC3);
    });

    test.each([0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e])('MBC5 (%i)', (mbcType) => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = mbcType;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC5);
    });
  });
});
