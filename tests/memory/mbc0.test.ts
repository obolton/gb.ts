import { describe, expect, test } from 'vitest';
import MBC0 from '../../src/memory/mbc0';
import MOCK_ROM from '../mocks/rom';

describe('MBC0', () => {
  test('reads from ROM', () => {
    const externalMemory = new MBC0(MOCK_ROM);
    expect(externalMemory.read(0x03)).toEqual(MOCK_ROM[0x03]);
  });

  test('reads and writes to RAM', () => {
    const externalMemory = new MBC0(MOCK_ROM);
    externalMemory.write(0xa000, 0xab);
    expect(externalMemory.read(0xa000)).toEqual(0xab);
  });

  test('does not attempt to write to ROM', () => {
    const externalMemory = new MBC0(MOCK_ROM);
    externalMemory.write(0x03, 0xff);
    expect(externalMemory.read(0x03)).toEqual(MOCK_ROM[0x03]);
  });

  test('returns 0xff outside the ROM and RAM ranges', () => {
    const externalMemory = new MBC0(MOCK_ROM);
    expect(externalMemory.read(0xc000)).toEqual(0xff);
  });
});
