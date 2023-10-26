import MBC2 from '../../src/memory/mbc2';
import MOCK_ROM from '../mocks/rom';

describe('MBC2', () => {
  test('supports 512 half bytes of RAM', () => {
    const mbc = new MBC2(MOCK_ROM);
    expect(mbc.ram.length).toEqual(512);
  });

  describe('ROM banking', () => {
    test('reads from the fixed bank', () => {
      const mbc = new MBC2(MOCK_ROM);
      expect(mbc.read(0x0a)).toEqual(MOCK_ROM[0x0a]);
    });

    test('switchable bank defaults to bank 1', () => {
      const mbc = new MBC2(MOCK_ROM);
      expect(mbc.read(0x4000)).toEqual(MOCK_ROM[0x4000]);
    });

    test('switches bank', () => {
      const mbc = new MBC2(MOCK_ROM);
      mbc.write(0x0100, 2);
      expect(mbc.romBank).toEqual(2);
    });

    test('reads from the new bank', () => {
      const mbc = new MBC2(MOCK_ROM);
      mbc.write(0x0100, 2);
      expect(mbc.read(0x4000)).toEqual(MOCK_ROM[0x8000]);
    });

    test('setting bank 0 defaults to bank 1', () => {
      const mbc = new MBC2(MOCK_ROM);
      mbc.write(0x2000, 0);
      expect(mbc.romBank).toEqual(1);
      expect(mbc.read(0x4000)).toEqual(MOCK_ROM[0x4000]);
    });
  });

  describe('RAM banking', () => {
    test('RAM is disabled by default', () => {
      const mbc = new MBC2(MOCK_ROM);
      expect(mbc.ramEnabled).toBe(false);
      expect(mbc.read(0xa000)).toEqual(0xff);
    });

    test('enables RAM when 0x0a is written to lower range', () => {
      const mbc = new MBC2(MOCK_ROM);
      mbc.write(0x0000, 0x0a);
      expect(mbc.ramEnabled).toBe(true);
    });

    test('does not enable RAM when another value is written to lower range', () => {
      const mbc = new MBC2(MOCK_ROM);
      mbc.write(0x0000, 0x01);
      expect(mbc.ramEnabled).toBe(false);
    });

    test('reads and writes to RAM when RAM is enabled', () => {
      const mbc = new MBC2(MOCK_ROM);
      mbc.write(0x0000, 0x0a);
      mbc.write(0xa000, 0x02);
      expect(mbc.read(0xa000)).toEqual(0xf2);
    });

    test('cannot read or write to RAM when RAM is disabled', () => {
      const mbc = new MBC2(MOCK_ROM);
      mbc.write(0x0000, 0x00);
      mbc.write(0xa000, 0x0f);
      expect(mbc.read(0xa000)).toEqual(0xff);
    });
  });
});
