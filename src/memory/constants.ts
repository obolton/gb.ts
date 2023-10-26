import { AddressRange } from '../types';

export const MEMORY_REGISTERS = {
  MBC_TYPE: 0x0147,
  ROM_SIZE: 0x0148,
  RAM_SIZE: 0x0149,
};

type MemoryType =
  | 'ROM'
  | 'VRAM'
  | 'EXTRAM'
  | 'RAM'
  | 'ECHO_RAM'
  | 'OAM'
  | 'IO'
  | 'HRAM'
  | 'IF'
  | 'IE'
  | 'ROM_FIXED_BANK'
  | 'ROM_SWITCHABLE_BANK'
  | 'INPUT'
  | 'TIMER'
  | 'AUDIO'
  | 'LCD'
  | 'SPEED';

export const MEMORY_RANGES: Record<MemoryType, AddressRange> = {
  ROM: { start: 0x0000, end: 0x7fff },
  VRAM: { start: 0x8000, end: 0x9fff },
  EXTRAM: { start: 0xa000, end: 0xbfff },
  RAM: { start: 0xc000, end: 0xdfff },
  ECHO_RAM: { start: 0xe000, end: 0xfdff },
  OAM: { start: 0xfe00, end: 0xfe9f },
  IO: { start: 0xff00, end: 0xff7f },
  HRAM: { start: 0xff80, end: 0xfffe },
  IF: { start: 0xff0f, end: 0xff0f },
  IE: { start: 0xffff, end: 0xffff },
  ROM_FIXED_BANK: { start: 0x0000, end: 0x3fff },
  ROM_SWITCHABLE_BANK: { start: 0x4000, end: 0x7fff },
  INPUT: { start: 0xff00, end: 0xff00 },
  TIMER: { start: 0xff04, end: 0xff07 },
  AUDIO: { start: 0xff10, end: 0xff3f },
  LCD: { start: 0xff40, end: 0xff4b },
  SPEED: { start: 0xff4d, end: 0xff4d },
};
