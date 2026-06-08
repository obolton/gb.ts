import { describe, expect, test, vi } from 'vitest';
import MMU from '../../src/memory/mmu';
import { RAM_BANK_SIZE } from '../../src/memory/constants';
import ExternalMemory from '../../src/memory/externalMemory';
import MOCK_ROM from '../mocks/rom';
import MockIO from '../mocks/MockIO';

describe('MMU', () => {
  const input = new MockIO();
  const timer = new MockIO();
  const apu = new MockIO();
  const ppu = new MockIO();
  const externalMemory = new ExternalMemory(MOCK_ROM);
  const mmu = new MMU();
  mmu.ppu = ppu;
  mmu.apu = apu;
  mmu.timer = timer;
  mmu.input = input;
  mmu.externalMemory = externalMemory;

  test('reads from ROM', () => {
    expect(mmu.read(0x0001)).toEqual(MOCK_ROM[0x0001]);
  });

  test('reads and writes to EXTRAM', () => {
    const spy = vi.spyOn(externalMemory, 'write');
    mmu.write(0xa000, 0x0a);
    expect(spy).toHaveBeenCalledWith(0xa000, 0x0a);
    expect(mmu.read(0xa000)).toEqual(0x0a);
  });

  test('reads and writes to RAM', () => {
    mmu.write(0xc000, 0x0a);
    expect(mmu.ram[0]).toEqual(0x0a);
    expect(mmu.read(0xc000)).toEqual(0x0a);
  });

  test('reads and writes to echo RAM', () => {
    mmu.write(0xe000, 0x0b);
    expect(mmu.ram[0]).toEqual(0x0b);
    expect(mmu.read(0xe000)).toEqual(0x0b);
    expect(mmu.read(0xc000)).toEqual(0x0b);
  });

  test('reads and writes to OAM', () => {
    mmu.write(0xfe00, 0x0a);
    expect(mmu.oam[0]).toEqual(0x0a);
    expect(mmu.read(0xfe00)).toEqual(0x0a);
  });

  describe('prohibited region (0xFEA0-0xFEFF)', () => {
    test('reads return 0x00 instead of throwing', () => {
      expect(mmu.read(0xfea0)).toEqual(0x00);
      expect(mmu.read(0xfeff)).toEqual(0x00);
    });

    test('writes are ignored', () => {
      expect(() => mmu.write(0xfea0, 0x42)).not.toThrow();
      expect(mmu.read(0xfea0)).toEqual(0x00);
    });
  });

  test('reads and writes to HRAM', () => {
    mmu.write(0xff80, 0x0a);
    expect(mmu.hram[0]).toEqual(0x0a);
    expect(mmu.read(0xff80)).toEqual(0x0a);
  });

  test('reads and writes to IE', () => {
    mmu.write(0xffff, 0x0a);
    expect(mmu.ie).toEqual(0x0a);
    expect(mmu.read(0xffff)).toEqual(0xea);
  });

  test('reads and writes to IF', () => {
    mmu.write(0xff0f, 0x0a);
    expect(mmu.if).toEqual(0x0a);
    expect(mmu.read(0xff0f)).toEqual(0xea);
  });

  describe('IO', () => {
    test('reads and writes to input register', () => {
      mmu.write(0xff00, 0x0a);
      expect(input.write).toHaveBeenCalledWith(0xff00, 0x0a);
      input.read.mockReturnValueOnce(0x02);
      expect(mmu.read(0xff00)).toEqual(0x02);
    });

    test('reads and writes to timer register', () => {
      mmu.write(0xff04, 0x0a);
      expect(timer.write).toHaveBeenCalledWith(0xff04, 0x0a);
      timer.read.mockReturnValueOnce(0x02);
      expect(mmu.read(0xff04)).toEqual(0x02);
    });

    test('reads and writes to audio register', () => {
      mmu.write(0xff10, 0x0a);
      expect(apu.write).toHaveBeenCalledWith(0xff10, 0x0a);
      apu.read.mockReturnValueOnce(0x02);
      expect(mmu.read(0xff10)).toEqual(0x02);
    });

    test('reads and writes to LCD register', () => {
      mmu.write(0xff40, 0x0a);
      expect(ppu.write).toHaveBeenCalledWith(0xff40, 0x0a);
      ppu.read.mockReturnValueOnce(0x02);
      expect(mmu.read(0xff40)).toEqual(0x02);
    });

    test('reads and writes to serial register when mounted', () => {
      const serial = new MockIO();
      mmu.serial = serial;
      mmu.write(0xff01, 0x0a);
      expect(serial.write).toHaveBeenCalledWith(0xff01, 0x0a);
      serial.read.mockReturnValueOnce(0x02);
      expect(mmu.read(0xff01)).toEqual(0x02);
      mmu.serial = undefined;
    });

    test('reads and writes the CGB speed register', () => {
      mmu.write(0xff4d, 0x01);
      expect(mmu.speed).toEqual(0x01);
      expect(mmu.read(0xff4d)).toEqual(0x01);
    });

    test('returns 0xff and ignores writes for an unmapped IO register', () => {
      expect(() => mmu.write(0xff7f, 0x0a)).not.toThrow();
      expect(mmu.read(0xff7f)).toEqual(0xff);
    });
  });

  describe('DMA', () => {
    test('copies data to OAM', () => {
      mmu.dma(0x10);
      expect(mmu.oam).toEqual(MOCK_ROM.slice(0x1000, 0x10a0));
    });
  });

  describe('WRAM banking', () => {
    test('selects the WRAM bank via SVBK', () => {
      mmu.write(0xff70, 0x02);
      expect(mmu.ramBank).toEqual(0x02);
      expect(mmu.read(0xff70)).toEqual(0x02);
    });

    test('reads and writes the switchable WRAM bank', () => {
      mmu.write(0xff70, 0x02); // select bank 2
      mmu.write(0xd000, 0x33);
      expect(mmu.ram[2 * RAM_BANK_SIZE]).toEqual(0x33);
      expect(mmu.read(0xd000)).toEqual(0x33);
    });

    test('mirrors the switchable bank through echo RAM', () => {
      mmu.write(0xff70, 0x03); // select bank 3
      mmu.write(0xf000, 0x44); // echo of 0xd000
      expect(mmu.ram[3 * RAM_BANK_SIZE]).toEqual(0x44);
      expect(mmu.read(0xf000)).toEqual(0x44);
      expect(mmu.read(0xd000)).toEqual(0x44);
    });

    test('treats WRAM bank 0 as bank 1', () => {
      mmu.write(0xff70, 0x00); // bank bits 0 -> defaults to 1
      mmu.write(0xd000, 0x55);
      expect(mmu.ram[1 * RAM_BANK_SIZE]).toEqual(0x55);
      expect(mmu.read(0xd000)).toEqual(0x55);

      expect(mmu.read(0xf000)).toEqual(0x55);
      mmu.write(0xf000, 0x66);
      expect(mmu.read(0xd000)).toEqual(0x66);
    });
  });

  describe('guards', () => {
    test('throws when reading before a cartridge is mounted', () => {
      expect(() => new MMU().read(0x0000)).toThrow('No external memory mounted');
    });

    test('throws when writing before a cartridge is mounted', () => {
      expect(() => new MMU().write(0x0000, 0x00)).toThrow('No external memory mounted');
    });

    test('throws when reading an unhandled address', () => {
      const unwired = new MMU();
      unwired.externalMemory = externalMemory;
      expect(() => unwired.read(0x8000)).toThrow('Unknown address');
    });
  });
});
