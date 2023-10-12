import ExternalMemory from '../../src/memory/externalMemory';
import { MEMORY_REGISTERS } from '../../src/memory/constants';
import MBC0 from '../../src/memory/mbc0';
import MBC1 from '../../src/memory/mbc1';
import MBC2 from '../../src/memory/mbc2';
import MBC3 from '../../src/memory/mbc3';
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

    test('MBC1', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = 0x01;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC1);
    });

    test('MBC1 + RAM', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = 0x02;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC1);
    });

    test('MBC1 + RAM + Battery', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = 0x03;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC1);
    });

    test('MBC2', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = 0x05;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC2);
    });

    test('MBC2 + Battery', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = 0x06;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC2);
    });

    test('MBC3', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = 0x11;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC3);
    });

    test('MBC3 + RAM', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = 0x12;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC3);
    });

    test('MBC3 + RAM + Battery', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.MBC_TYPE] = 0x13;
      const externalMemory = new ExternalMemory(rom);
      expect(externalMemory.mbc).toBeInstanceOf(MBC3);
    });
  });
});
