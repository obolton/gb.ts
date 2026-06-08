import { describe, expect, test } from 'vitest';
import MBC1 from '../../src/memory/mbc1';
import { MEMORY_REGISTERS } from '../../src/memory/constants';
import MOCK_ROM from '../mocks/rom';

function createLargeRom() {
  const banks = 64;
  const rom = new Uint8Array(banks * 0x4000);
  rom[MEMORY_REGISTERS.MBC_TYPE] = 1;
  rom[MEMORY_REGISTERS.ROM_SIZE] = 5; // 2 << 5 = 64 banks
  rom[MEMORY_REGISTERS.RAM_SIZE] = 3; // 32 KiB, 4 RAM banks
  for (let bank = 0; bank < banks; bank++) {
    rom[bank * 0x4000] = bank;
  }
  return rom;
}

describe('MBC1', () => {
  describe('RAM size', () => {
    test('creates an MBC with no RAM', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 0;
      const mbc = new MBC1(rom);
      expect(mbc.ram.length).toEqual(0);
    });

    test('creates an MBC with 8 KiB of RAM', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 2;
      const mbc = new MBC1(rom);
      expect(mbc.ram.length).toEqual(8192);
    });

    test('creates an MBC with 32 KiB of RAM', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 3;
      const mbc = new MBC1(rom);
      expect(mbc.ram.length).toEqual(32768);
    });

    test('throws for an unsupported RAM size', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 1;
      expect(() => new MBC1(rom)).toThrow('Unsupported external RAM size');
    });
  });

  describe('ROM banking', () => {
    test('reads from the fixed bank', () => {
      const mbc = new MBC1(MOCK_ROM);
      expect(mbc.read(0x0a)).toEqual(MOCK_ROM[0x0a]);
    });

    test('switchable bank defaults to bank 1', () => {
      const mbc = new MBC1(MOCK_ROM);
      expect(mbc.read(0x4000)).toEqual(MOCK_ROM[0x4000]);
    });

    test('switches bank', () => {
      const mbc = new MBC1(MOCK_ROM);
      mbc.write(0x2000, 2);
      expect(mbc.romBank).toEqual(2);
    });

    test('reads from the new bank', () => {
      const mbc = new MBC1(MOCK_ROM);
      mbc.write(0x2000, 2);
      expect(mbc.read(0x4000)).toEqual(MOCK_ROM[0x8000]);
    });

    test('setting bank 0 defaults to bank 1', () => {
      const mbc = new MBC1(MOCK_ROM);
      mbc.write(0x2000, 0);
      expect(mbc.romBank).toEqual(1);
      expect(mbc.read(0x4000)).toEqual(MOCK_ROM[0x4000]);
    });

    test('selects an upper ROM bank through the 0x4000 register in ROM mode', () => {
      const mbc = new MBC1(createLargeRom());
      mbc.write(0x2000, 2); // lower 5 bits -> bank 2
      mbc.write(0x4000, 1); // upper bits -> romBank = (1 << 5) | 2 = 0x22
      expect(mbc.romBank).toEqual(0x22);
      expect(mbc.read(0x4000)).toEqual(0x22); // bank 34's marker byte
    });
  });

  describe('RAM banking', () => {
    test('RAM is disabled by default', () => {
      const mbc = new MBC1(MOCK_ROM);
      expect(mbc.ramEnabled).toBe(false);
      expect(mbc.read(0xa000)).toEqual(0xff);
    });

    test('enables RAM when 0x0a is written to lower range', () => {
      const mbc = new MBC1(MOCK_ROM);
      mbc.write(0x0000, 0x0a);
      expect(mbc.ramEnabled).toBe(true);
    });

    test('does not enable RAM when another value is written to lower range', () => {
      const mbc = new MBC1(MOCK_ROM);
      mbc.write(0x0000, 0x01);
      expect(mbc.ramEnabled).toBe(false);
    });

    test('reads and writes to RAM when RAM is enabled', () => {
      const mbc = new MBC1(MOCK_ROM);
      mbc.write(0x0000, 0x0a);
      mbc.write(0xa000, 0x0f);
      expect(mbc.read(0xa000)).toEqual(0x0f);
    });

    test('cannot read or write to RAM when RAM is disabled', () => {
      const mbc = new MBC1(MOCK_ROM);
      mbc.write(0x0000, 0x01);
      mbc.write(0xa000, 0x0f);
      expect(mbc.read(0xa000)).toEqual(0xff);
    });

    test('selects a RAM bank', () => {
      const mbc = new MBC1(MOCK_ROM); // 4 RAM banks
      mbc.write(0x4000, 2);
      expect(mbc.ramBank).toEqual(2);
    });

    test('ignores RAM bank writes when the cart has a single RAM bank', () => {
      const rom = new Uint8Array(MOCK_ROM);
      rom[MEMORY_REGISTERS.RAM_SIZE] = 2; // 8 KiB -> 1 RAM bank
      const mbc = new MBC1(rom);
      mbc.write(0x4000, 2);
      expect(mbc.ramBank).toEqual(0);
    });

    test('reads and writes independent RAM banks in advanced mode', () => {
      const mbc = new MBC1(MOCK_ROM);
      mbc.write(0x0000, 0x0a); // enable RAM
      mbc.write(0x6000, 0x01); // advanced (RAM) banking mode

      mbc.write(0x4000, 0x00); // RAM bank 0
      mbc.write(0xa000, 0x11);
      mbc.write(0x4000, 0x02); // RAM bank 2
      mbc.write(0xa000, 0x22);

      expect(mbc.read(0xa000)).toEqual(0x22);
      mbc.write(0x4000, 0x00);
      expect(mbc.read(0xa000)).toEqual(0x11);
    });
  });

  describe('banking mode', () => {
    test('remaps the fixed ROM region using the upper bank bits in advanced mode', () => {
      const mbc = new MBC1(createLargeRom());
      mbc.write(0x4000, 1);
      mbc.write(0x6000, 1); // advanced (RAM) banking mode

      // The fixed region maps to (romBank & 0x60) -> bank 0x20 = 32.
      expect(mbc.read(0x0000)).toEqual(32);
    });

    test('ignores the RAM bank in simple ROM banking mode', () => {
      const mbc = new MBC1(MOCK_ROM);
      mbc.write(0x0000, 0x0a); // enable RAM
      mbc.write(0x6000, 0x01); // advanced mode
      mbc.write(0x4000, 0x01); // RAM bank 1
      mbc.write(0xa000, 0x55);

      mbc.write(0x6000, 0x00); // back to simple ROM banking mode
      expect(mbc.read(0xa000)).toEqual(0x00); // RAM access now uses bank 0
    });
  });
});
