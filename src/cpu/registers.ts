import MMU from '../memory/mmu';

export enum Register {
  A = 'a',
  F = 'f',
  B = 'b',
  C = 'c',
  D = 'd',
  E = 'e',
  H = 'h',
  L = 'l',
}

export enum Register16Bit {
  AF = 'af',
  BC = 'bc',
  DE = 'de',
  HL = 'hl',
  SP = 'sp',
}

export enum MemoryReference {
  BC = 'bcReference',
  HL = 'hlReference',
  DE = 'deReference',
}

export type Register8Bit = Register | MemoryReference;

type RegisterInterface = {
  [key in Register | Register16Bit | MemoryReference]: number;
};

export default class Registers implements RegisterInterface {
  private mmu: MMU;

  a = 0x11;
  b = 0x00;
  c = 0x13;
  d = 0x00;
  e = 0xd8;
  f = 0xb0;
  h = 0x01;
  l = 0x4d;
  pc = 0x0100;
  sp = 0xfffe;
  ime = 0;
  halt = false;
  stop = false;

  constructor(mmu: MMU) {
    this.mmu = mmu;
  }

  reset() {
    this.a = 0x11;
    this.b = 0x00;
    this.c = 0x13;
    this.d = 0x00;
    this.e = 0xd8;
    this.f = 0xb0;
    this.h = 0x01;
    this.l = 0x4d;
    this.pc = 0x0100;
    this.sp = 0xfffe;
    this.ime = 0;
    this.halt = false;
    this.stop = false;
  }

  get af() {
    return (this.a << 8) + this.f;
  }

  set af(value: number) {
    this.a = value >> 8;
    this.f = value & 0xf0;
  }

  get bc() {
    return (this.b << 8) + this.c;
  }

  set bc(value: number) {
    this.b = value >> 8;
    this.c = value & 0xff;
  }

  get bcReference() {
    return this.mmu.read(this.bc);
  }

  set bcReference(value: number) {
    this.mmu.write(this.bc, value);
  }

  get de() {
    return (this.d << 8) + this.e;
  }

  set de(value: number) {
    this.d = value >> 8;
    this.e = value & 0xff;
  }
  get deReference() {
    return this.mmu.read(this.de);
  }

  set deReference(value: number) {
    this.mmu.write(this.de, value);
  }

  get hl() {
    return (this.h << 8) + this.l;
  }

  set hl(value: number) {
    this.h = value >> 8;
    this.l = value & 0xff;
  }

  get hlReference() {
    return this.mmu.read(this.hl);
  }

  set hlReference(value: number) {
    this.mmu.write(this.hl, value);
  }
}
