import MMU from '../../src/memory/mmu';
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

  test('reads and writes to VRAM', () => {
    mmu.write(0x8000, 0x0a);
    expect(mmu.vram[0]).toEqual(0x0a);
    expect(mmu.read(0x8000)).toEqual(0x0a);
  });

  test('reads and writes to EXTRAM', () => {
    const spy = jest.spyOn(externalMemory, 'write');
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

  test('reads and writes to HRAM', () => {
    mmu.write(0xff80, 0x0a);
    expect(mmu.hram[0]).toEqual(0x0a);
    expect(mmu.read(0xff80)).toEqual(0x0a);
  });

  test('reads and writes to IE', () => {
    mmu.write(0xffff, 0x0a);
    expect(mmu.ie).toEqual(0x0a);
    expect(mmu.read(0xffff)).toEqual(0x0a);
  });

  test('reads and writes to IF', () => {
    mmu.write(0xff0f, 0x0a);
    expect(mmu.if).toEqual(0x0a);
    expect(mmu.read(0xff0f)).toEqual(0x0a);
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
  });

  describe('DMA', () => {
    test('copies data to OAM', () => {
      mmu.dma(0x10);
      expect(mmu.oam).toEqual(MOCK_ROM.slice(0x1000, 0x10a0));
    });
  });
});
