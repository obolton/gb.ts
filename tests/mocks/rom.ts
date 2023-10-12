import { MEMORY_REGISTERS } from '../../src/memory/constants';

const MOCK_ROM = new Uint8Array(0x10000);
for (let i = 0; i < 256; i++) {
  MOCK_ROM[i] = i;
}

// Fill upper ranges with random data
for (let i = 0x1000; i < 0x10000; i++) {
  MOCK_ROM[i] = Math.round(Math.random() * 255);
}

MOCK_ROM[MEMORY_REGISTERS.MBC_TYPE] = 0;
MOCK_ROM[MEMORY_REGISTERS.ROM_SIZE] = 2;
MOCK_ROM[MEMORY_REGISTERS.RAM_SIZE] = 3;

export default MOCK_ROM;
