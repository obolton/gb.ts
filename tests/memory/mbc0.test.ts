import MBC0 from '../../src/memory/mbc0';
import MOCK_ROM from '../mocks/rom';

describe('MBC0', () => {
  it('reads from ROM', () => {
    const externalMemory = new MBC0(MOCK_ROM);
    expect(externalMemory.read(0x03)).toEqual(MOCK_ROM[0x03]);
  });

  it('reads and writes to RAM', () => {
    const externalMemory = new MBC0(MOCK_ROM);
    externalMemory.write(0xa000, 0xab);
    expect(externalMemory.read(0xa000)).toEqual(0xab);
  });

  it('does not attempt to write to ROM', () => {
    const externalMemory = new MBC0(MOCK_ROM);
    externalMemory.write(0x03, 0xff);
    expect(externalMemory.read(0x03)).toEqual(MOCK_ROM[0x03]);
  });
});
