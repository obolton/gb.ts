import MBC5 from '../../src/memory/mbc5';
import { MEMORY_REGISTERS } from '../../src/memory/constants';
import MOCK_ROM from '../mocks/rom';

describe('MBC5', () => {
  describe('RAM size', () => {
    test('creates an MBC with no RAM', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 0;
      const mbc = new MBC5(rom);
      expect(mbc.ram.length).toEqual(0);
    });

    test('creates an MBC with 8 KiB of RAM', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 2;
      const mbc = new MBC5(rom);
      expect(mbc.ram.length).toEqual(8192);
    });

    test('creates an MBC with 32 KiB of RAM', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 3;
      const mbc = new MBC5(rom);
      expect(mbc.ram.length).toEqual(32768);
    });

    test('creates an MBC with 128 KiB of RAM', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 4;
      const mbc = new MBC5(rom);
      expect(mbc.ram.length).toEqual(131072);
    });

    test('throws for an unsupported RAM size', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 1;
      expect(() => new MBC5(rom)).toThrow();
    });
  });

  describe('ROM banking', () => {
    test('reads from the fixed bank', () => {
      const mbc = new MBC5(MOCK_ROM);
      expect(mbc.read(0x0a)).toEqual(MOCK_ROM[0x0a]);
    });

    test('switchable bank defaults to bank 1', () => {
      const mbc = new MBC5(MOCK_ROM);
      expect(mbc.read(0x4000)).toEqual(MOCK_ROM[0x4000]);
    });

    test('switches bank lower range', () => {
      const mbc = new MBC5(MOCK_ROM);
      mbc.write(0x2000, 2);
      expect(mbc.romBank).toEqual(2);
    });

    test('switches bank higher range', () => {
      const mbc = new MBC5(MOCK_ROM);
      mbc.write(0x2000, 2);
      mbc.write(0x3000, 1);
      expect(mbc.romBank).toEqual(258);
    });

    test('reads from the new bank', () => {
      const mbc = new MBC5(MOCK_ROM);
      mbc.write(0x2000, 2);
      expect(mbc.read(0x4000)).toEqual(MOCK_ROM[0x8000]);
    });

    test('setting bank 0 uses bank 0', () => {
      const mbc = new MBC5(MOCK_ROM);
      mbc.write(0x2000, 0);
      expect(mbc.romBank).toEqual(0);
      expect(mbc.read(0x4000)).toEqual(MOCK_ROM[0x0000]);
    });
  });

  describe('RAM banking', () => {
    test('RAM is disabled by default', () => {
      const mbc = new MBC5(MOCK_ROM);
      expect(mbc.ramEnabled).toBe(false);
      expect(mbc.read(0xa000)).toEqual(0xff);
    });

    test('enables RAM when 0x0a is written to lower range', () => {
      const mbc = new MBC5(MOCK_ROM);
      mbc.write(0x0000, 0x0a);
      expect(mbc.ramEnabled).toBe(true);
    });

    test('does not enable RAM when another value is written to lower range', () => {
      const mbc = new MBC5(MOCK_ROM);
      mbc.write(0x0000, 0x01);
      expect(mbc.ramEnabled).toBe(false);
    });

    test('reads and writes to RAM when RAM is enabled', () => {
      const mbc = new MBC5(MOCK_ROM);
      mbc.write(0x0000, 0x0a);
      mbc.write(0xa000, 0x0f);
      expect(mbc.read(0xa000)).toEqual(0x0f);
    });

    test('cannot read or write to RAM when RAM is disabled', () => {
      const mbc = new MBC5(MOCK_ROM);
      mbc.write(0x0000, 0x01);
      mbc.write(0xa000, 0x0f);
      expect(mbc.read(0xa000)).toEqual(0xff);
    });
  });
});
