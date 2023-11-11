import CPU from '../../src/cpu/cpu';
import { Interrupts } from '../../src/cpu/interrupts';
import {
  MemoryReference,
  Register,
  Register8Bit,
} from '../../src/cpu/registers';
import MMU from '../../src/memory/mmu';
import MockIO from '../mocks/MockIO';

jest.useFakeTimers();

const INITIAL_STATE = {
  a: 0,
  f: 0,
  b: 0,
  c: 0,
  d: 0,
  e: 0,
  h: 0,
  l: 0,
  sp: 0xfffe,
  pc: 1,
  ime: 0,
  stop: false,
  halt: false,
  hlReference: 0,
};

describe('CPU', () => {
  const mockIO = new MockIO(65536);
  const mmu = new MMU();
  mmu.ppu = mockIO;
  mmu.apu = mockIO;
  mmu.timer = mockIO;
  mmu.input = mockIO;
  mmu.externalMemory = mockIO;
  const cpu = new CPU(mmu);
  let previousState: ReturnType<typeof getCurrentState>;

  function getCurrentState() {
    const { registers, ticks } = cpu;
    const { a, b, c, d, e, f, h, l, sp, pc, ime, stop, halt, hlReference } =
      registers;
    return {
      a,
      b,
      c,
      d,
      e,
      f,
      h,
      l,
      sp,
      pc,
      ime,
      stop,
      halt,
      ticks,
      hlReference,
    };
  }

  function reset() {
    cpu.reset();
    Object.assign(cpu.registers, { ...INITIAL_STATE });
    cpu.registers.pc = 1;
    mockIO.reset();
  }

  beforeEach(() => {
    reset();
    previousState = getCurrentState();
  });

  describe('instructions', () => {
    test('NOOP', () => {
      cpu.execute(0x00);
      expect(getCurrentState()).toEqual({
        ...previousState,
        ticks: 1,
      });
    });

    test('STOP', () => {
      cpu.execute(0x10);
      expect(getCurrentState()).toEqual({
        ...previousState,
        pc: previousState.pc + 1,
        ticks: 1,
        stop: true,
      });
    });

    test('HALT', () => {
      cpu.execute(0x76);
      expect(getCurrentState()).toEqual({
        ...previousState,
        halt: true,
        ticks: 1,
      });
    });

    describe('LD', () => {
      test.each([
        [Register.B, Register.C, 0x01],
        [Register.D, Register.E, 0x11],
        [Register.H, Register.L, 0x21],
      ])('LD %s, n16', (high: Register, low: Register, opcode) => {
        mockIO.set([1, 2], cpu.registers.pc);
        cpu.execute(opcode);
        expect(getCurrentState()).toEqual({
          ...previousState,
          [high]: 0x02,
          [low]: 0x01,
          pc: previousState.pc + 2,
          ticks: 3,
        });
      });

      test('LD SP, n16', () => {
        mockIO.set([1, 2], cpu.registers.pc);
        cpu.execute(0x31);
        expect(getCurrentState()).toEqual({
          ...previousState,
          sp: 0x0201,
          pc: previousState.pc + 2,
          ticks: 3,
        });
      });

      test('LD [BC], A', () => {
        cpu.registers.a = 0xbc;
        cpu.registers.b = 0x12;
        cpu.registers.c = 0x34;
        cpu.execute(0x02);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0xbc,
          b: 0x12,
          c: 0x34,
          ticks: 2,
        });
        expect(mmu.read(0x1234)).toEqual(0xbc);
      });

      test('LD [DE], A', () => {
        cpu.registers.a = 0xde;
        cpu.registers.d = 0x12;
        cpu.registers.e = 0x34;
        cpu.execute(0x12);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0xde,
          d: 0x12,
          e: 0x34,
          ticks: 2,
        });
        expect(mmu.read(0x1234)).toEqual(0xde);
      });

      test('LD [HL+], A', () => {
        cpu.registers.hl = 0x1234;
        cpu.registers.a = 0x1a;
        cpu.execute(0x22);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x1a,
          h: 0x12,
          l: 0x35,
          ticks: 2,
        });
        expect(mmu.readWord(cpu.registers.hl - 1)).toEqual(0x1a);
      });

      test('LD [HL-], A', () => {
        cpu.registers.hl = 0x1234;
        cpu.registers.a = 0x1a;
        cpu.execute(0x32);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x1a,
          h: 0x12,
          l: 0x33,
          ticks: 2,
        });
        expect(mmu.readWord(cpu.registers.hl + 1)).toEqual(0x1a);
      });

      test('LD [a16], SP', () => {
        mockIO.set([0x34, 0x12], cpu.registers.pc);
        cpu.registers.sp = 0xfffc;
        cpu.execute(0x08);
        expect(getCurrentState()).toEqual({
          ...previousState,
          sp: 0xfffc,
          pc: 3,
          ticks: 5,
        });
        expect(mmu.read(0x1234)).toEqual(0xfc);
        expect(mmu.read(0x1235)).toEqual(0xff);
      });

      test('LD [a16], A', () => {
        cpu.registers.a = 0x0f;
        cpu.registers.pc = 0x1234;
        mockIO.set([0xcd, 0xab], cpu.registers.pc);
        cpu.execute(0xea);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x0f,
          pc: 0x1236,
          ticks: 4,
        });
        expect(mmu.read(0xabcd)).toEqual(0x0f);
      });

      test('LD A, [a16]', () => {
        cpu.registers.pc = 0x1234;
        mockIO.set([0xcd, 0xab], cpu.registers.pc);
        mockIO.set([0xb0], 0xabcd);
        cpu.execute(0xfa);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0xb0,
          pc: 0x1236,
          ticks: 4,
        });
      });

      test('LD [0xff00 + n8], A', () => {
        cpu.registers.a = 0xa0;
        cpu.registers.pc = 0x1234;
        mockIO.set([0x42], 0x1234);
        cpu.execute(0xe0);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0xa0,
          pc: 0x1235,
          ticks: 3,
        });
        expect(mmu.read(0xff42)).toEqual(0xa0);
      });

      test('LD [0xff00 + C], A', () => {
        cpu.registers.a = 0xa1;
        cpu.registers.c = 0x43;
        cpu.execute(0xe2);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0xa1,
          c: 0x43,
          pc: 1,
          ticks: 2,
        });
        expect(mmu.read(0xff43)).toEqual(0xa1);
      });

      test('LD A, [0xff00 + n8]', () => {
        cpu.registers.pc = 0x1234;
        mockIO.set([0x42], 0x1234);
        mmu.write(0xff42, 0x01);
        cpu.execute(0xf0);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x01,
          pc: 0x1235,
          ticks: 3,
        });
      });

      test('LD A, [0xff00 + C]', () => {
        cpu.registers.c = 0x43;
        mmu.write(0xff43, 0x02);
        cpu.execute(0xf2);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x02,
          c: 0x43,
          pc: 1,
          ticks: 2,
        });
      });

      test('LD SP, HL', () => {
        cpu.registers.hl = 0x1234;
        cpu.execute(0xf9);
        expect(getCurrentState()).toEqual({
          ...previousState,
          sp: 0x1234,
          h: 0x12,
          l: 0x34,
          pc: 1,
          ticks: 2,
        });
      });

      test.each([
        [Register.B, 2, 0x06],
        [Register.C, 2, 0x0e],
        [Register.D, 2, 0x16],
        [Register.E, 2, 0x1e],
        [Register.H, 2, 0x26],
        [Register.L, 2, 0x2e],
        [MemoryReference.HL, 3, 0x36],
        [Register.A, 2, 0x3e],
      ])('LD %s, n8', (register: Register8Bit, ticks, opcode) => {
        mockIO.set([0, 1]);
        cpu.execute(opcode);
        expect(getCurrentState()).toMatchObject({
          [register]: 0x01,
          pc: 2,
          ticks: ticks,
        });
      });

      test.each([
        [Register.B, Register.B, 0x40],
        [Register.B, Register.C, 0x41],
        [Register.B, Register.D, 0x42],
        [Register.B, Register.E, 0x43],
        [Register.B, Register.H, 0x44],
        [Register.B, Register.L, 0x45],
        [Register.B, Register.A, 0x47],
        [Register.C, Register.B, 0x48],
        [Register.C, Register.C, 0x49],
        [Register.C, Register.D, 0x4a],
        [Register.C, Register.E, 0x4b],
        [Register.C, Register.H, 0x4c],
        [Register.C, Register.L, 0x4d],
        [Register.C, Register.A, 0x4f],
        [Register.D, Register.B, 0x50],
        [Register.D, Register.C, 0x51],
        [Register.D, Register.D, 0x52],
        [Register.D, Register.E, 0x53],
        [Register.D, Register.H, 0x54],
        [Register.D, Register.L, 0x55],
        [Register.D, Register.A, 0x57],
        [Register.E, Register.B, 0x58],
        [Register.E, Register.C, 0x59],
        [Register.E, Register.D, 0x5a],
        [Register.E, Register.E, 0x5b],
        [Register.E, Register.H, 0x5c],
        [Register.E, Register.L, 0x5d],
        [Register.E, Register.A, 0x5f],
        [Register.H, Register.B, 0x60],
        [Register.H, Register.C, 0x61],
        [Register.H, Register.D, 0x62],
        [Register.H, Register.E, 0x63],
        [Register.H, Register.H, 0x64],
        [Register.H, Register.L, 0x65],
        [Register.H, Register.A, 0x67],
        [Register.L, Register.B, 0x68],
        [Register.L, Register.C, 0x69],
        [Register.L, Register.D, 0x6a],
        [Register.L, Register.E, 0x6b],
        [Register.L, Register.H, 0x6c],
        [Register.L, Register.L, 0x6d],
        [Register.L, Register.A, 0x6f],
        [Register.A, Register.B, 0x78],
        [Register.A, Register.C, 0x79],
        [Register.A, Register.D, 0x7a],
        [Register.A, Register.E, 0x7b],
        [Register.A, Register.H, 0x7c],
        [Register.A, Register.L, 0x7d],
        [Register.A, Register.A, 0x7f],
      ])('LD %s, %s', (to: Register, from: Register, opcode) => {
        cpu.registers[from] = 0x1b;
        cpu.execute(opcode);
        expect(getCurrentState()).toEqual({
          ...previousState,
          [to]: 0x1b,
          [from]: 0x1b,
          pc: 1,
          ticks: 1,
        });
      });

      test.each([
        [Register.B, 0x46],
        [Register.C, 0x4e],
        [Register.D, 0x56],
        [Register.E, 0x5e],
        [Register.H, 0x66],
        [Register.L, 0x6e],
        [Register.A, 0x7e],
      ])('LD %s, [HL]', (to: Register, opcode) => {
        cpu.registers.hl = 0xc000;
        cpu.registers.hlReference = 0x1b;
        cpu.execute(opcode);
        expect(getCurrentState()).toMatchObject({
          [to]: 0x1b,
          pc: 1,
          ticks: 2,
        });
      });

      test('LD A, [BC]', () => {
        cpu.registers.bc = 0xc000;
        cpu.registers.bcReference = 0x1b;
        cpu.execute(0x0a);
        expect(getCurrentState()).toMatchObject({
          a: 0x1b,
          pc: 1,
          ticks: 2,
        });
      });

      test('LD A, [DE]', () => {
        cpu.registers.de = 0xc000;
        cpu.registers.deReference = 0x1b;
        cpu.execute(0x1a);
        expect(getCurrentState()).toMatchObject({
          a: 0x1b,
          pc: 1,
          ticks: 2,
        });
      });

      test('LD A, [HL+]', () => {
        cpu.registers.hl = 0x1234;
        cpu.registers.hlReference = 0x1b;
        cpu.execute(0x2a);
        expect(getCurrentState()).toMatchObject({
          a: 0x1b,
          h: 0x12,
          l: 0x35,
          pc: 1,
          ticks: 2,
        });
      });

      test('LD A, [HL-]', () => {
        cpu.registers.hl = 0x1234;
        cpu.registers.hlReference = 0x1b;
        cpu.execute(0x3a);
        expect(getCurrentState()).toMatchObject({
          a: 0x1b,
          h: 0x12,
          l: 0x33,
          pc: 1,
          ticks: 2,
        });
      });

      test.each([
        [Register.B, 0x70],
        [Register.C, 0x71],
        [Register.D, 0x72],
        [Register.E, 0x73],
        [Register.H, 0x74],
        [Register.L, 0x75],
        [Register.A, 0x77],
      ])('LD [HL], %s', (from: Register, opcode) => {
        cpu.registers.hl = 0xc000;
        cpu.registers[from] = 0xc3;
        cpu.registers.hlReference = 0x00;
        cpu.execute(opcode);
        expect(cpu.registers.hlReference).toEqual(0xc3);
        expect(getCurrentState()).toMatchObject({
          pc: 1,
          ticks: 2,
        });
      });

      describe('LD HL, SP + e8', () => {
        test('with positive value', () => {
          cpu.registers.sp = 0xfff0;
          cpu.registers.pc = 0x1234;
          mockIO.set([0x06], cpu.registers.pc);
          cpu.execute(0xf8);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0xff,
            l: 0xf6,
            sp: 0xfff0,
            pc: 0x1235,
            f: 0x00,
            ticks: 3,
          });
        });

        test('with negative value', () => {
          cpu.registers.sp = 0xfff0;
          cpu.registers.pc = 0x1234;
          mockIO.set([0xfc], cpu.registers.pc);
          cpu.execute(0xf8);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0xff,
            l: 0xec,
            sp: 0xfff0,
            pc: 0x1235,
            f: 0x10,
            ticks: 3,
          });
        });
      });
    });

    describe('INC', () => {
      describe.each([
        [Register.B, Register.C, 0x03],
        [Register.D, Register.E, 0x13],
        [Register.H, Register.L, 0x23],
      ])('INC %s', (high: Register, low: Register, opcode) => {
        test('increments', () => {
          cpu.registers[high] = 0xa1;
          cpu.registers[low] = 0x23;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [high]: 0xa1,
            [low]: 0x24,
            ticks: 2,
            pc: 1,
          });
        });

        test('overflow', () => {
          cpu.registers[high] = 0xff;
          cpu.registers[low] = 0xff;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [high]: 0x00,
            [low]: 0x00,
            ticks: 2,
            pc: 1,
          });
        });
      });

      describe('INC SP', () => {
        test('increments', () => {
          cpu.registers.sp = 0x1234;
          cpu.execute(0x33);
          expect(getCurrentState()).toEqual({
            ...previousState,
            sp: 0x1235,
            ticks: 2,
            pc: 1,
          });
        });

        test('overflow', () => {
          cpu.registers.sp = 0xffff;
          cpu.execute(0x33);
          expect(getCurrentState()).toEqual({
            ...previousState,
            sp: 0x0000,
            ticks: 2,
            pc: 1,
          });
        });
      });

      describe.each([
        [Register.B, 1, 0x04],
        [Register.C, 1, 0x0c],
        [Register.D, 1, 0x14],
        [Register.E, 1, 0x1c],
        [Register.H, 1, 0x24],
        [Register.L, 1, 0x2c],
        [MemoryReference.HL, 3, 0x34],
        [Register.A, 1, 0x3c],
      ])('INC %s', (register: Register8Bit, ticks, opcode) => {
        test('increments', () => {
          cpu.registers[register] = 0x06;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x07,
            f: 0x00,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers[register] = 0xff;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x00,
            f: 0xa0,
            ticks: ticks,
          });
        });

        test('with half carry', () => {
          cpu.registers[register] = 0x0f;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x10,
            f: 0x20,
            ticks: ticks,
          });
        });

        test('overflow', () => {
          cpu.registers[register] = 0xff;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x00,
            f: 0xa0,
            ticks: ticks,
          });
        });
      });
    });

    describe('DEC', () => {
      describe.each([
        [Register.B, Register.C, 0x0b],
        [Register.D, Register.E, 0x1b],
        [Register.H, Register.L, 0x2b],
      ])('DEC %s', (high: Register, low: Register, opcode) => {
        test('decrements', () => {
          cpu.registers[high] = 0xa1;
          cpu.registers[low] = 0x23;
          cpu.execute(opcode);
          expect(getCurrentState()).toMatchObject({
            [high]: 0xa1,
            [low]: 0x22,
            ticks: 2,
            pc: 1,
          });
        });

        test('underflow', () => {
          cpu.registers[high] = 0x00;
          cpu.registers[low] = 0x00;
          cpu.execute(opcode);
          expect(getCurrentState()).toMatchObject({
            [high]: 0xff,
            [low]: 0xff,
            ticks: 2,
            pc: 1,
          });
        });
      });

      describe('DEC SP', () => {
        test('decrements', () => {
          cpu.registers.sp = 0xa123;
          cpu.execute(0x3b);
          expect(getCurrentState()).toEqual({
            ...previousState,
            sp: 0xa122,
            ticks: 2,
            pc: 1,
          });
        });

        test('underflow', () => {
          cpu.registers.sp = 0x0000;
          cpu.execute(0x3b);
          expect(getCurrentState()).toEqual({
            ...previousState,
            sp: 0xffff,
            ticks: 2,
            pc: 1,
          });
        });
      });

      describe.each([
        [Register.B, 1, 0x05],
        [Register.C, 1, 0x0d],
        [Register.D, 1, 0x15],
        [Register.E, 1, 0x1d],
        [Register.H, 1, 0x25],
        [Register.L, 1, 0x2d],
        [MemoryReference.HL, 3, 0x35],
        [Register.A, 1, 0x3d],
      ])('DEC %s', (register: Register8Bit, ticks, opcode) => {
        test('decrements', () => {
          cpu.registers[register] = 0x06;
          cpu.execute(opcode);
          expect(getCurrentState()).toMatchObject({
            [register]: 0x05,
            f: 0x40,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toMatchObject({
            [register]: 0x00,
            f: 0xc0,
            ticks: ticks,
          });
        });

        test('half carries', () => {
          cpu.registers[register] = 0xf0;
          cpu.execute(opcode);
          expect(getCurrentState()).toMatchObject({
            [register]: 0xef,
            f: 0x60,
            ticks: ticks,
          });
        });

        test('underflow', () => {
          cpu.registers[register] = 0x00;
          cpu.execute(opcode);
          expect(getCurrentState()).toMatchObject({
            [register]: 0xff,
            f: 0x60,
            ticks: ticks,
          });
        });
      });
    });

    describe('ADD', () => {
      describe.each([
        [Register.B, 1, 0x80],
        [Register.C, 1, 0x81],
        [Register.D, 1, 0x82],
        [Register.E, 1, 0x83],
        [Register.H, 1, 0x84],
        [Register.L, 1, 0x85],
        [MemoryReference.HL, 2, 0x86],
      ])('ADD %s', (register: Register8Bit, ticks, opcode) => {
        test('adds', () => {
          cpu.registers.a = 0x05;
          cpu.registers[register] = 0x02;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x02,
            a: 0x07,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0xff;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            [register]: 0x01,
            f: 0xb0,
            pc: 1,
            ticks: ticks,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x0f;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x10,
            [register]: 0x01,
            f: 0x20,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0xfc;
          cpu.registers[register] = 0x0f;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0b,
            [register]: 0x0f,
            f: 0x30,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe('ADD A', () => {
        test('adds', () => {
          cpu.registers.a = 0x05;
          cpu.execute(0x87);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0a,
            f: 0x00,
            pc: 1,
            ticks: 1,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x80;
          cpu.execute(0x87);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0x90,
            pc: 1,
            ticks: 1,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x0f;
          cpu.execute(0x87);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x1e,
            f: 0x20,
            pc: 1,
            ticks: 1,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0xf0;
          cpu.execute(0x87);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0xe0,
            f: 0x10,
            pc: 1,
            ticks: 1,
          });
        });
      });

      describe('ADD n8', () => {
        test('adds', () => {
          cpu.registers.a = 0x05;
          cpu.registers.pc = 0x1234;
          mockIO.set([0x02], 0x1234);
          cpu.execute(0xc6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x07,
            f: 0x00,
            pc: 0x1235,
            ticks: 2,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0xff;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xc6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0xb0,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x0f;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xc6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x10,
            f: 0x20,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0xfc;
          mockIO.set([0x0f], cpu.registers.pc);
          cpu.execute(0xc6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0b,
            f: 0x30,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });

      describe.each([
        [Register.B, Register.C, 0x09],
        [Register.D, Register.E, 0x19],
      ])('ADD HL, %s', (high: Register, low: Register, opcode) => {
        test('adds', () => {
          cpu.registers.h = 0xa2;
          cpu.registers.l = 0x05;
          cpu.registers[high] = 0x12;
          cpu.registers[low] = 0x34;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0xb4,
            l: 0x39,
            [high]: 0x12,
            [low]: 0x34,
            pc: 1,
            ticks: 2,
          });
        });

        test('half carries', () => {
          cpu.registers.h = 0x0f;
          cpu.registers.l = 0xff;
          cpu.registers[high] = 0x00;
          cpu.registers[low] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0x10,
            l: 0x00,
            [high]: 0x00,
            [low]: 0x01,
            f: 0x20,
            pc: 1,
            ticks: 2,
          });
        });

        test('carries', () => {
          cpu.registers.h = 0xff;
          cpu.registers.l = 0xff;
          cpu.registers[high] = 0x00;
          cpu.registers[low] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0x00,
            l: 0x00,
            [high]: 0x00,
            [low]: 0x01,
            f: 0x30,
            pc: 1,
            ticks: 2,
          });
        });
      });

      describe('ADD HL, SP', () => {
        test('adds', () => {
          cpu.registers.h = 0xa2;
          cpu.registers.l = 0x05;
          cpu.registers.sp = 0x1234;
          cpu.execute(0x39);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0xb4,
            l: 0x39,
            sp: 0x1234,
            pc: 1,
            ticks: 2,
          });
        });

        test('half carries', () => {
          cpu.registers.h = 0x0f;
          cpu.registers.l = 0xff;
          cpu.registers.sp = 0x0001;
          cpu.execute(0x39);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0x10,
            l: 0x00,
            sp: 0x0001,
            f: 0x20,
            pc: 1,
            ticks: 2,
          });
        });

        test('carries', () => {
          cpu.registers.h = 0xff;
          cpu.registers.l = 0xff;
          cpu.registers.sp = 0x0001;
          cpu.execute(0x39);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0x00,
            l: 0x00,
            sp: 0x0001,
            f: 0x30,
            pc: 1,
            ticks: 2,
          });
        });
      });

      describe('ADD HL, HL', () => {
        test('adds', () => {
          cpu.registers.h = 0x12;
          cpu.registers.l = 0x34;
          cpu.execute(0x29);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0x24,
            l: 0x68,
            f: 0x00,
            pc: 1,
            ticks: 2,
          });
        });

        test('half carries', () => {
          cpu.registers.h = 0x0f;
          cpu.registers.l = 0xff;
          cpu.execute(0x29);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0x1f,
            l: 0xfe,
            f: 0x20,
            pc: 1,
            ticks: 2,
          });
        });

        test('carries', () => {
          cpu.registers.h = 0x80;
          cpu.registers.l = 0x01;
          cpu.execute(0x29);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0x00,
            l: 0x02,
            f: 0x10,
            pc: 1,
            ticks: 2,
          });
        });
      });

      describe('ADD SP, e8', () => {
        test('moves SP backward', () => {
          mockIO.set([0x06], cpu.registers.pc);
          cpu.registers.sp = 0xfff0;
          cpu.execute(0xe8);
          expect(getCurrentState()).toEqual({
            ...previousState,
            sp: 0xfff6,
            pc: previousState.pc + 1,
            f: 0x00,
            ticks: 4,
          });
        });

        test('moves SP forward', () => {
          mockIO.set([0xfc], cpu.registers.pc);
          cpu.registers.sp = 0xfff0;
          cpu.execute(0xe8);
          expect(getCurrentState()).toEqual({
            ...previousState,
            sp: 0xffec,
            pc: previousState.pc + 1,
            f: 0x10,
            ticks: 4,
          });
        });
      });
    });

    describe('ADC', () => {
      describe.each([
        [Register.B, 1, 0x88],
        [Register.C, 1, 0x89],
        [Register.D, 1, 0x8a],
        [Register.E, 1, 0x8b],
        [Register.H, 1, 0x8c],
        [Register.L, 1, 0x8d],
        [MemoryReference.HL, 2, 0x8e],
      ])('ADC %s', (register: Register8Bit, ticks, opcode) => {
        test('adds with carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x10;
          cpu.registers[register] = 0x02;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x02,
            a: 0x08,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('adds without carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x00;
          cpu.registers[register] = 0x02;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x02,
            a: 0x07,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0xfe;
          cpu.registers.f = 0x10;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            [register]: 0x01,
            f: 0xb0,
            pc: 1,
            ticks: ticks,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x0f;
          cpu.registers.f = 0x10;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x11,
            [register]: 0x01,
            f: 0x20,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0xfc;
          cpu.registers.f = 0x10;
          cpu.registers[register] = 0x0f;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0c,
            [register]: 0x0f,
            f: 0x30,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe('ADC A', () => {
        test('adds with carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x10;
          cpu.execute(0x8f);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0b,
            f: 0x00,
            pc: 1,
            ticks: 1,
          });
        });

        test('adds without carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x00;
          cpu.execute(0x8f);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0a,
            f: 0x00,
            pc: 1,
            ticks: 1,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x80;
          cpu.registers.f = 0x00;
          cpu.execute(0x8f);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0x90,
            pc: 1,
            ticks: 1,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x0f;
          cpu.registers.f = 0x10;
          cpu.execute(0x8f);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x1f,
            f: 0x20,
            pc: 1,
            ticks: 1,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0xfc;
          cpu.registers.f = 0x10;
          cpu.execute(0x8f);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0xf9,
            f: 0x30,
            pc: 1,
            ticks: 1,
          });
        });
      });

      describe('ADC n8', () => {
        test('adds with carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x10;
          mockIO.set([0x02], cpu.registers.pc);
          cpu.execute(0xce);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x08,
            f: 0x00,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('adds without carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x00;
          mockIO.set([0x02], cpu.registers.pc);
          cpu.execute(0xce);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x07,
            f: 0x00,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0xfe;
          cpu.registers.f = 0x10;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xce);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0xb0,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x0f;
          cpu.registers.f = 0x10;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xce);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x11,
            f: 0x20,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0xfc;
          cpu.registers.f = 0x10;
          mockIO.set([0x0f], cpu.registers.pc);
          cpu.execute(0xce);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0c,
            f: 0x30,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });
    });

    describe('SUB', () => {
      describe.each([
        [Register.B, 1, 0x90],
        [Register.C, 1, 0x91],
        [Register.D, 1, 0x92],
        [Register.E, 1, 0x93],
        [Register.H, 1, 0x94],
        [Register.L, 1, 0x95],
        [MemoryReference.HL, 2, 0x96],
      ])('SUB %s', (register: Register8Bit, ticks, opcode) => {
        test('subtracts', () => {
          cpu.registers.a = 0x05;
          cpu.registers[register] = 0x02;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x02,
            a: 0x03,
            f: 0x40,
            pc: 1,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x01;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            [register]: 0x01,
            f: 0xc0,
            pc: 1,
            ticks: ticks,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x10;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0f,
            [register]: 0x01,
            f: 0x60,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0x01;
          cpu.registers[register] = 0x0f;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0xf2,
            [register]: 0x0f,
            f: 0x70,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe('SUB A', () => {
        test('subtracts', () => {
          cpu.registers.a = 0x05;
          cpu.execute(0x97);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0xc0,
            pc: 1,
            ticks: 1,
          });
        });
      });

      describe('SUB n8', () => {
        test('subtracts', () => {
          cpu.registers.a = 0x05;
          mockIO.set([0x02], cpu.registers.pc);
          cpu.execute(0xd6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x03,
            f: 0x40,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x01;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xd6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0xc0,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x10;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xd6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0f,
            f: 0x60,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0x01;
          mockIO.set([0x0f], cpu.registers.pc);
          cpu.execute(0xd6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0xf2,
            f: 0x70,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });
    });

    describe('SBC', () => {
      describe.each([
        [Register.B, 1, 0x98],
        [Register.C, 1, 0x99],
        [Register.D, 1, 0x9a],
        [Register.E, 1, 0x9b],
        [Register.H, 1, 0x9c],
        [Register.L, 1, 0x9d],
        [MemoryReference.HL, 2, 0x9e],
      ])('SBC %s', (register: Register8Bit, ticks, opcode) => {
        test('subtracts with carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x10;
          cpu.registers[register] = 0x02;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x02,
            a: 0x02,
            f: 0x40,
            pc: 1,
            ticks: ticks,
          });
        });

        test('subtracts without carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x00;
          cpu.registers[register] = 0x02;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x02,
            a: 0x03,
            f: 0x40,
            pc: 1,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x02;
          cpu.registers.f = 0x10;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            [register]: 0x01,
            f: 0xc0,
            pc: 1,
            ticks: ticks,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x10;
          cpu.registers.f = 0x10;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0e,
            [register]: 0x01,
            f: 0x60,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0x01;
          cpu.registers.f = 0x10;
          cpu.registers[register] = 0x0f;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0xf1,
            [register]: 0x0f,
            f: 0x70,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe('SBC A', () => {
        test('subtracts with carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x10;
          cpu.execute(0x9f);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0xff,
            f: 0x70,
            pc: 1,
            ticks: 1,
          });
        });

        test('subtracts without carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x00;
          cpu.execute(0x9f);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0xc0,
            pc: 1,
            ticks: 1,
          });
        });
      });

      describe('SBC n8', () => {
        test('subtracts with carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x10;
          mockIO.set([0x02], cpu.registers.pc);
          cpu.execute(0xde);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x02,
            f: 0x40,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('subtracts without carry', () => {
          cpu.registers.a = 0x05;
          cpu.registers.f = 0x00;
          mockIO.set([0x02], cpu.registers.pc);
          cpu.execute(0xde);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x03,
            f: 0x40,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x02;
          cpu.registers.f = 0x10;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xde);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0xc0,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0x10;
          cpu.registers.f = 0x10;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xde);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0e,
            f: 0x60,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0x01;
          cpu.registers.f = 0x10;
          mockIO.set([0x0f], cpu.registers.pc);
          cpu.execute(0xde);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0xf1,
            f: 0x70,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });
    });

    describe('DAA', () => {
      test('adjusts for carry after addition', () => {
        cpu.registers.a = 0x01;
        cpu.registers.f = 0x90;
        cpu.execute(0x27);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x61,
          f: 0x10,
          ticks: 1,
        });
      });

      test('adjusts for half-carry after addition', () => {
        cpu.registers.a = 0x01;
        cpu.registers.f = 0x20;
        cpu.execute(0x27);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x07,
          f: 0x00,
          ticks: 1,
        });
      });

      test('adjusts for carry and half-carry after addition', () => {
        cpu.registers.a = 0x01;
        cpu.registers.f = 0x30;
        cpu.execute(0x27);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x67,
          f: 0x10,
          ticks: 1,
        });
      });

      test('adjusts for carry after subtraction', () => {
        cpu.registers.a = 0xa9;
        cpu.registers.f = 0x50;
        cpu.execute(0x27);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x49,
          f: 0x50,
          ticks: 1,
        });
      });

      test('adjusts for half-carry after subtraction', () => {
        cpu.registers.a = 0xa9;
        cpu.registers.f = 0x60;
        cpu.execute(0x27);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0xa3,
          f: 0x40,
          ticks: 1,
        });
      });

      test('adjusts for carry and half-carry after subtraction', () => {
        cpu.registers.a = 0xa9;
        cpu.registers.f = 0x70;
        cpu.execute(0x27);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x43,
          f: 0x50,
          ticks: 1,
        });
      });
    });

    describe('AND', () => {
      describe.each([
        [Register.B, 1, 0xa0],
        [Register.C, 1, 0xa1],
        [Register.D, 1, 0xa2],
        [Register.E, 1, 0xa3],
        [Register.H, 1, 0xa4],
        [Register.L, 1, 0xa5],
        [MemoryReference.HL, 2, 0xa6],
      ])('AND %s', (register: Register8Bit, ticks, opcode) => {
        test('and', () => {
          cpu.registers.a = 0x2f;
          cpu.registers[register] = 0x4d;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x4d,
            a: 0x0d,
            f: 0x20,
            pc: 1,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0xf0;
          cpu.registers[register] = 0x0f;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x0f,
            a: 0x00,
            f: 0xa0,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe('AND A', () => {
        test('and', () => {
          cpu.registers.a = 0x2f;
          cpu.execute(0xa7);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x2f,
            f: 0x20,
            pc: 1,
            ticks: 1,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x00;
          cpu.execute(0xa7);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0xa0,
            pc: 1,
            ticks: 1,
          });
        });
      });

      describe('AND n8', () => {
        test('and', () => {
          cpu.registers.a = 0x2f;
          mockIO.set([0x4d], cpu.registers.pc);
          cpu.execute(0xe6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x0d,
            f: 0x20,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0xf0;
          mockIO.set([0x0f], cpu.registers.pc);
          cpu.execute(0xe6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0xa0,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });
    });

    describe('XOR', () => {
      describe.each([
        [Register.B, 1, 0xa8],
        [Register.C, 1, 0xa9],
        [Register.D, 1, 0xaa],
        [Register.E, 1, 0xab],
        [Register.H, 1, 0xac],
        [Register.L, 1, 0xad],
        [MemoryReference.HL, 2, 0xae],
      ])('XOR %s', (register: Register8Bit, ticks, opcode) => {
        test('xor', () => {
          cpu.registers.a = 0x2f;
          cpu.registers[register] = 0x4d;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x4d,
            a: 0x62,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x0f;
          cpu.registers[register] = 0x0f;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x0f,
            a: 0x00,
            f: 0x80,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe('XOR A', () => {
        test('xor', () => {
          cpu.registers.a = 0x2f;
          cpu.execute(0xaf);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0x80,
            pc: 1,
            ticks: 1,
          });
        });
      });

      describe('XOR n8', () => {
        test('xor', () => {
          cpu.registers.a = 0x2f;
          mockIO.set([0x4d], cpu.registers.pc);
          cpu.execute(0xee);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x62,
            f: 0x00,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x0f;
          mockIO.set([0x0f], cpu.registers.pc);
          cpu.execute(0xee);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0x80,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });
    });

    describe('OR', () => {
      describe.each([
        [Register.B, 1, 0xb0],
        [Register.C, 1, 0xb1],
        [Register.D, 1, 0xb2],
        [Register.E, 1, 0xb3],
        [Register.H, 1, 0xb4],
        [Register.L, 1, 0xb5],
        [MemoryReference.HL, 2, 0xb6],
      ])('OR %s', (register: Register8Bit, ticks, opcode) => {
        test('or', () => {
          cpu.registers.a = 0x2f;
          cpu.registers[register] = 0x4d;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x4d,
            a: 0x6f,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x00;
          cpu.registers[register] = 0x00;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x00,
            a: 0x00,
            f: 0x80,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe('OR A', () => {
        test('or', () => {
          cpu.registers.a = 0x2f;
          cpu.execute(0xb7);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x2f,
            f: 0x00,
            pc: 1,
            ticks: 1,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x00;
          cpu.execute(0xb7);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0x80,
            pc: 1,
            ticks: 1,
          });
        });
      });

      describe('OR n8', () => {
        test('or', () => {
          cpu.registers.a = 0x2f;
          mockIO.set([0x4d], cpu.registers.pc);
          cpu.execute(0xf6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x6f,
            f: 0x00,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('zero', () => {
          cpu.registers.a = 0x00;
          mockIO.set([0x00], cpu.registers.pc);
          cpu.execute(0xf6);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x00,
            f: 0x80,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });
    });

    describe('CP', () => {
      describe.each([
        [Register.B, 1, 0xb8],
        [Register.C, 1, 0xb9],
        [Register.D, 1, 0xba],
        [Register.E, 1, 0xbb],
        [Register.H, 1, 0xbc],
        [Register.L, 1, 0xbd],
        [MemoryReference.HL, 2, 0xbe],
      ])('CP %s', (register: Register8Bit, ticks, opcode) => {
        test('equality', () => {
          cpu.registers.a = 0x01;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x01,
            a: 0x01,
            f: 0xc0,
            pc: 1,
            ticks: ticks,
          });
        });

        test('inequality', () => {
          cpu.registers.a = 0x02;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x01,
            a: 0x02,
            f: 0x40,
            pc: 1,
            ticks: ticks,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0xf0;
          cpu.registers[register] = 0x01;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x01,
            a: 0xf0,
            f: 0x60,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0x02;
          cpu.registers[register] = 0x05;
          cpu.execute(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x05,
            a: 0x02,
            f: 0x70,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe('CP A', () => {
        test('is always equal', () => {
          cpu.registers.a = 0x01;
          cpu.execute(0xbf);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x01,
            f: 0xc0,
            pc: 1,
            ticks: 1,
          });
        });
      });

      describe('CP n8', () => {
        test('equality', () => {
          cpu.registers.a = 0x01;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xfe);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x01,
            f: 0xc0,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('inequality', () => {
          cpu.registers.a = 0x02;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xfe);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x02,
            f: 0x40,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('half carries', () => {
          cpu.registers.a = 0xf0;
          mockIO.set([0x01], cpu.registers.pc);
          cpu.execute(0xfe);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0xf0,
            f: 0x60,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });

        test('carries', () => {
          cpu.registers.a = 0x02;
          mockIO.set([0x05], cpu.registers.pc);
          cpu.execute(0xfe);
          expect(getCurrentState()).toEqual({
            ...previousState,
            a: 0x02,
            f: 0x70,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });
    });

    describe('RLCA', () => {
      test('no carry', () => {
        cpu.registers.a = 0x6c;
        cpu.execute(0x07);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0xd8,
          f: 0x00,
          pc: 1,
          ticks: 1,
        });
      });

      test('carries', () => {
        cpu.registers.a = 0xec;
        cpu.execute(0x07);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0xd9,
          f: 0x10,
          pc: 1,
          ticks: 1,
        });
      });
    });

    describe('RRCA', () => {
      test('no carry', () => {
        cpu.registers.a = 0x6c;
        cpu.execute(0x0f);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x36,
          f: 0x00,
          pc: 1,
          ticks: 1,
        });
      });

      test('carries', () => {
        cpu.registers.a = 0x6d;
        cpu.execute(0x0f);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0xb6,
          f: 0x10,
          pc: 1,
          ticks: 1,
        });
      });
    });

    describe('RLA', () => {
      test('carry in', () => {
        cpu.registers.a = 0x03;
        cpu.registers.f = 0x10;
        cpu.execute(0x17);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x07,
          f: 0x00,
          pc: 1,
          ticks: 1,
        });
      });

      test('carry out', () => {
        cpu.registers.a = 0xcf;
        cpu.registers.f = 0x00;
        cpu.execute(0x17);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x9e,
          f: 0x10,
          pc: 1,
          ticks: 1,
        });
      });
    });

    describe('RRA', () => {
      test('carry in', () => {
        cpu.registers.a = 0x02;
        cpu.registers.f = 0x10;
        cpu.execute(0x1f);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x81,
          f: 0x00,
          pc: 1,
          ticks: 1,
        });
      });

      test('carry out', () => {
        cpu.registers.a = 0x03;
        cpu.registers.f = 0x00;
        cpu.execute(0x1f);
        expect(getCurrentState()).toEqual({
          ...previousState,
          a: 0x01,
          f: 0x10,
          pc: 1,
          ticks: 1,
        });
      });
    });

    test('CPL', () => {
      cpu.registers.a = 0xca;
      cpu.execute(0x2f);
      expect(getCurrentState()).toEqual({
        ...previousState,
        a: 0x35,
        f: 0x60,
        pc: 1,
        ticks: 1,
      });
    });

    test('SCF', () => {
      cpu.registers.f = 0x00;
      cpu.execute(0x37);
      expect(getCurrentState()).toEqual({
        ...previousState,
        f: 0x10,
        pc: 1,
        ticks: 1,
      });
    });

    test('CCF', () => {
      cpu.registers.f = 0x10;
      cpu.execute(0x3f);
      expect(getCurrentState()).toEqual({
        ...previousState,
        f: 0x00,
        pc: 1,
        ticks: 1,
      });
    });

    test.each([
      [0x00, 0xc7],
      [0x08, 0xcf],
      [0x10, 0xd7],
      [0x18, 0xdf],
      [0x20, 0xe7],
      [0x28, 0xef],
      [0x30, 0xf7],
      [0x38, 0xff],
    ])('RST %i', (address, opcode) => {
      cpu.execute(opcode);
      expect(getCurrentState()).toEqual({
        ...previousState,
        pc: address,
        ticks: 4,
        sp: previousState.sp - 2,
      });
    });

    describe('prefixed opcodes', () => {
      test('CBxx', () => {
        jest.spyOn(cpu, 'executePrefixed');
        mockIO.set([0x02], cpu.registers.pc);
        cpu.execute(0xcb);
        expect(cpu.executePrefixed).toHaveBeenCalledWith(0x02);
        expect(getCurrentState()).toMatchObject({
          pc: 2,
          ticks: 3,
        });
      });

      describe.each([
        [Register.B, 2, 0x00],
        [Register.C, 2, 0x01],
        [Register.D, 2, 0x02],
        [Register.E, 2, 0x03],
        [Register.H, 2, 0x04],
        [Register.L, 2, 0x05],
        [MemoryReference.HL, 4, 0x06],
        [Register.A, 2, 0x07],
      ])('RLC %s', (register: Register8Bit, ticks, opcode) => {
        test('no carry', () => {
          cpu.registers[register] = 0x6c;
          cpu.registers.f = 0x00;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0xd8,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carries', () => {
          cpu.registers[register] = 0xec;
          cpu.registers.f = 0x00;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0xd9,
            f: 0x10,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe.each([
        [Register.B, 2, 0x08],
        [Register.C, 2, 0x09],
        [Register.D, 2, 0x0a],
        [Register.E, 2, 0x0b],
        [Register.H, 2, 0x0c],
        [Register.L, 2, 0x0d],
        [MemoryReference.HL, 4, 0x0e],
        [Register.A, 2, 0x0f],
      ])('RRC %s', (register: Register8Bit, ticks, opcode) => {
        test('no carry', () => {
          cpu.registers[register] = 0x6c;
          cpu.registers.f = 0x00;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x36,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carries', () => {
          cpu.registers[register] = 0x6d;
          cpu.registers.f = 0x00;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0xb6,
            f: 0x10,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe.each([
        [Register.B, 2, 0x10],
        [Register.C, 2, 0x11],
        [Register.D, 2, 0x12],
        [Register.E, 2, 0x13],
        [Register.H, 2, 0x14],
        [Register.L, 2, 0x15],
        [MemoryReference.HL, 4, 0x16],
        [Register.A, 2, 0x17],
      ])('RL %s', (register: Register8Bit, ticks, opcode) => {
        test('carry in', () => {
          cpu.registers[register] = 0x03;
          cpu.registers.f = 0x10;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x07,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carry out', () => {
          cpu.registers[register] = 0xcf;
          cpu.registers.f = 0x00;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x9e,
            f: 0x10,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe.each([
        [Register.B, 2, 0x18],
        [Register.C, 2, 0x19],
        [Register.D, 2, 0x1a],
        [Register.E, 2, 0x1b],
        [Register.H, 2, 0x1c],
        [Register.L, 2, 0x1d],
        [MemoryReference.HL, 4, 0x1e],
        [Register.A, 2, 0x1f],
      ])('RR %s', (register: Register8Bit, ticks, opcode) => {
        test('carry in', () => {
          cpu.registers[register] = 0x02;
          cpu.registers.f = 0x10;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x81,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carry out', () => {
          cpu.registers[register] = 0x03;
          cpu.registers.f = 0x00;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x01,
            f: 0x10,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe.each([
        [Register.B, 2, 0x20],
        [Register.C, 2, 0x21],
        [Register.D, 2, 0x22],
        [Register.E, 2, 0x23],
        [Register.H, 2, 0x24],
        [Register.L, 2, 0x25],
        [MemoryReference.HL, 4, 0x26],
        [Register.A, 2, 0x27],
      ])('SLA %s', (register: Register8Bit, ticks, opcode) => {
        test('shift', () => {
          cpu.registers[register] = 0x1b;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x36,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carry out', () => {
          cpu.registers[register] = 0x83;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x06,
            f: 0x10,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe.each([
        [Register.B, 2, 0x28],
        [Register.C, 2, 0x29],
        [Register.D, 2, 0x2a],
        [Register.E, 2, 0x2b],
        [Register.H, 2, 0x2c],
        [Register.L, 2, 0x2d],
        [MemoryReference.HL, 4, 0x2e],
        [Register.A, 2, 0x2f],
      ])('SRA %s', (register: Register8Bit, ticks, opcode) => {
        test('shift', () => {
          cpu.registers[register] = 0xbc;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0xde,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carry out', () => {
          cpu.registers[register] = 0xbd;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0xde,
            f: 0x10,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe.each([
        [Register.B, 2, 0x30],
        [Register.C, 2, 0x31],
        [Register.D, 2, 0x32],
        [Register.E, 2, 0x33],
        [Register.H, 2, 0x34],
        [Register.L, 2, 0x35],
        [MemoryReference.HL, 4, 0x36],
        [Register.A, 2, 0x37],
      ])('SWAP %s', (register: Register8Bit, ticks, opcode) => {
        test('swap', () => {
          cpu.registers[register] = 0x7f;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0xf7,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('zero', () => {
          cpu.registers[register] = 0x00;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x00,
            f: 0x80,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe.each([
        [Register.B, 2, 0x38],
        [Register.C, 2, 0x39],
        [Register.D, 2, 0x3a],
        [Register.E, 2, 0x3b],
        [Register.H, 2, 0x3c],
        [Register.L, 2, 0x3d],
        [MemoryReference.HL, 4, 0x3e],
        [Register.A, 2, 0x3f],
      ])('SRL %s', (register: Register8Bit, ticks, opcode) => {
        test('shift', () => {
          cpu.registers[register] = 0xbc;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x5e,
            f: 0x00,
            pc: 1,
            ticks: ticks,
          });
        });

        test('carry out', () => {
          cpu.registers[register] = 0xbd;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0x5e,
            f: 0x10,
            pc: 1,
            ticks: ticks,
          });
        });
      });

      describe.each([
        [0, Register.B, 2, 0x40],
        [0, Register.C, 2, 0x41],
        [0, Register.D, 2, 0x42],
        [0, Register.E, 2, 0x43],
        [0, Register.H, 2, 0x44],
        [0, Register.L, 2, 0x45],
        [0, MemoryReference.HL, 3, 0x46],
        [0, Register.A, 2, 0x47],
        [1, Register.B, 2, 0x48],
        [1, Register.C, 2, 0x49],
        [1, Register.D, 2, 0x4a],
        [1, Register.E, 2, 0x4b],
        [1, Register.H, 2, 0x4c],
        [1, Register.L, 2, 0x4d],
        [1, MemoryReference.HL, 3, 0x4e],
        [1, Register.A, 2, 0x4f],
        [2, Register.B, 2, 0x50],
        [2, Register.C, 2, 0x51],
        [2, Register.D, 2, 0x52],
        [2, Register.E, 2, 0x53],
        [2, Register.H, 2, 0x54],
        [2, Register.L, 2, 0x55],
        [2, MemoryReference.HL, 3, 0x56],
        [2, Register.A, 2, 0x57],
        [3, Register.B, 2, 0x58],
        [3, Register.C, 2, 0x59],
        [3, Register.D, 2, 0x5a],
        [3, Register.E, 2, 0x5b],
        [3, Register.H, 2, 0x5c],
        [3, Register.L, 2, 0x5d],
        [3, MemoryReference.HL, 3, 0x5e],
        [3, Register.A, 2, 0x5f],
        [4, Register.B, 2, 0x60],
        [4, Register.C, 2, 0x61],
        [4, Register.D, 2, 0x62],
        [4, Register.E, 2, 0x63],
        [4, Register.H, 2, 0x64],
        [4, Register.L, 2, 0x65],
        [4, MemoryReference.HL, 3, 0x66],
        [4, Register.A, 2, 0x67],
        [5, Register.B, 2, 0x68],
        [5, Register.C, 2, 0x69],
        [5, Register.D, 2, 0x6a],
        [5, Register.E, 2, 0x6b],
        [5, Register.H, 2, 0x6c],
        [5, Register.L, 2, 0x6d],
        [5, MemoryReference.HL, 3, 0x6e],
        [5, Register.A, 2, 0x6f],
        [6, Register.B, 2, 0x70],
        [6, Register.C, 2, 0x71],
        [6, Register.D, 2, 0x72],
        [6, Register.E, 2, 0x73],
        [6, Register.H, 2, 0x74],
        [6, Register.L, 2, 0x75],
        [6, MemoryReference.HL, 3, 0x76],
        [6, Register.A, 2, 0x77],
        [7, Register.B, 2, 0x78],
        [7, Register.C, 2, 0x79],
        [7, Register.D, 2, 0x7a],
        [7, Register.E, 2, 0x7b],
        [7, Register.H, 2, 0x7c],
        [7, Register.L, 2, 0x7d],
        [7, MemoryReference.HL, 3, 0x7e],
        [7, Register.A, 2, 0x7f],
      ])('BIT %i, %s', (bit: number, register: Register8Bit, ticks, opcode) => {
        test('bit is set', () => {
          cpu.registers[register] = 1 << bit;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 1 << bit,
            f: 0x20,
            pc: 1,
            ticks: ticks,
          });
        });

        test('bit is clear', () => {
          cpu.registers[register] = 0;
          cpu.executePrefixed(opcode);
          expect(getCurrentState()).toEqual({
            ...previousState,
            [register]: 0,
            f: 0xa0,
            pc: 1,
            ticks: ticks,
          });
        });
      });
    });

    describe.each([
      [0, Register.B, 2, 0x80],
      [0, Register.C, 2, 0x81],
      [0, Register.D, 2, 0x82],
      [0, Register.E, 2, 0x83],
      [0, Register.H, 2, 0x84],
      [0, Register.L, 2, 0x85],
      [0, MemoryReference.HL, 4, 0x86],
      [0, Register.A, 2, 0x87],
      [1, Register.B, 2, 0x88],
      [1, Register.C, 2, 0x89],
      [1, Register.D, 2, 0x8a],
      [1, Register.E, 2, 0x8b],
      [1, Register.H, 2, 0x8c],
      [1, Register.L, 2, 0x8d],
      [1, MemoryReference.HL, 4, 0x8e],
      [1, Register.A, 2, 0x8f],
      [2, Register.B, 2, 0x90],
      [2, Register.C, 2, 0x91],
      [2, Register.D, 2, 0x92],
      [2, Register.E, 2, 0x93],
      [2, Register.H, 2, 0x94],
      [2, Register.L, 2, 0x95],
      [2, MemoryReference.HL, 4, 0x96],
      [2, Register.A, 2, 0x97],
      [3, Register.B, 2, 0x98],
      [3, Register.C, 2, 0x99],
      [3, Register.D, 2, 0x9a],
      [3, Register.E, 2, 0x9b],
      [3, Register.H, 2, 0x9c],
      [3, Register.L, 2, 0x9d],
      [3, MemoryReference.HL, 4, 0x9e],
      [3, Register.A, 2, 0x9f],
      [4, Register.B, 2, 0xa0],
      [4, Register.C, 2, 0xa1],
      [4, Register.D, 2, 0xa2],
      [4, Register.E, 2, 0xa3],
      [4, Register.H, 2, 0xa4],
      [4, Register.L, 2, 0xa5],
      [4, MemoryReference.HL, 4, 0xa6],
      [4, Register.A, 2, 0xa7],
      [5, Register.B, 2, 0xa8],
      [5, Register.C, 2, 0xa9],
      [5, Register.D, 2, 0xaa],
      [5, Register.E, 2, 0xab],
      [5, Register.H, 2, 0xac],
      [5, Register.L, 2, 0xad],
      [5, MemoryReference.HL, 4, 0xae],
      [5, Register.A, 2, 0xaf],
      [6, Register.B, 2, 0xb0],
      [6, Register.C, 2, 0xb1],
      [6, Register.D, 2, 0xb2],
      [6, Register.E, 2, 0xb3],
      [6, Register.H, 2, 0xb4],
      [6, Register.L, 2, 0xb5],
      [6, MemoryReference.HL, 4, 0xb6],
      [6, Register.A, 2, 0xb7],
      [7, Register.B, 2, 0xb8],
      [7, Register.C, 2, 0xb9],
      [7, Register.D, 2, 0xba],
      [7, Register.E, 2, 0xbb],
      [7, Register.H, 2, 0xbc],
      [7, Register.L, 2, 0xbd],
      [7, MemoryReference.HL, 4, 0xbe],
      [7, Register.A, 2, 0xbf],
    ])('RES %i, %s', (bit: number, register: Register8Bit, ticks, opcode) => {
      test('clears bit', () => {
        cpu.registers[register] = 0xff;
        cpu.executePrefixed(opcode);
        expect(getCurrentState()).toEqual({
          ...previousState,
          [register]: 0xff ^ (1 << bit),
          pc: 1,
          ticks: ticks,
        });
      });
    });

    describe.each([
      [0, Register.B, 2, 0xc0],
      [0, Register.C, 2, 0xc1],
      [0, Register.D, 2, 0xc2],
      [0, Register.E, 2, 0xc3],
      [0, Register.H, 2, 0xc4],
      [0, Register.L, 2, 0xc5],
      [0, MemoryReference.HL, 4, 0xc6],
      [0, Register.A, 2, 0xc7],
      [1, Register.B, 2, 0xc8],
      [1, Register.C, 2, 0xc9],
      [1, Register.D, 2, 0xca],
      [1, Register.E, 2, 0xcb],
      [1, Register.H, 2, 0xcc],
      [1, Register.L, 2, 0xcd],
      [1, MemoryReference.HL, 4, 0xce],
      [1, Register.A, 2, 0xcf],
      [2, Register.B, 2, 0xd0],
      [2, Register.C, 2, 0xd1],
      [2, Register.D, 2, 0xd2],
      [2, Register.E, 2, 0xd3],
      [2, Register.H, 2, 0xd4],
      [2, Register.L, 2, 0xd5],
      [2, MemoryReference.HL, 4, 0xd6],
      [2, Register.A, 2, 0xd7],
      [3, Register.B, 2, 0xd8],
      [3, Register.C, 2, 0xd9],
      [3, Register.D, 2, 0xda],
      [3, Register.E, 2, 0xdb],
      [3, Register.H, 2, 0xdc],
      [3, Register.L, 2, 0xdd],
      [3, MemoryReference.HL, 4, 0xde],
      [3, Register.A, 2, 0xdf],
      [4, Register.B, 2, 0xe0],
      [4, Register.C, 2, 0xe1],
      [4, Register.D, 2, 0xe2],
      [4, Register.E, 2, 0xe3],
      [4, Register.H, 2, 0xe4],
      [4, Register.L, 2, 0xe5],
      [4, MemoryReference.HL, 4, 0xe6],
      [4, Register.A, 2, 0xe7],
      [5, Register.B, 2, 0xe8],
      [5, Register.C, 2, 0xe9],
      [5, Register.D, 2, 0xea],
      [5, Register.E, 2, 0xeb],
      [5, Register.H, 2, 0xec],
      [5, Register.L, 2, 0xed],
      [5, MemoryReference.HL, 4, 0xee],
      [5, Register.A, 2, 0xef],
      [6, Register.B, 2, 0xf0],
      [6, Register.C, 2, 0xf1],
      [6, Register.D, 2, 0xf2],
      [6, Register.E, 2, 0xf3],
      [6, Register.H, 2, 0xf4],
      [6, Register.L, 2, 0xf5],
      [6, MemoryReference.HL, 4, 0xf6],
      [6, Register.A, 2, 0xf7],
      [7, Register.B, 2, 0xf8],
      [7, Register.C, 2, 0xf9],
      [7, Register.D, 2, 0xfa],
      [7, Register.E, 2, 0xfb],
      [7, Register.H, 2, 0xfc],
      [7, Register.L, 2, 0xfd],
      [7, MemoryReference.HL, 4, 0xfe],
      [7, Register.A, 2, 0xff],
    ])('SET %i, %s', (bit: number, register: Register8Bit, ticks, opcode) => {
      test('sets bit', () => {
        cpu.registers[register] = 0x00;
        cpu.executePrefixed(opcode);
        expect(getCurrentState()).toEqual({
          ...previousState,
          [register]: 1 << bit,
          pc: 1,
          ticks: ticks,
        });
      });
    });

    test.each([
      [0xd3],
      [0xdb],
      [0xdd],
      [0xe3],
      [0xe4],
      [0xeb],
      [0xec],
      [0xed],
      [0xf4],
      [0xfc],
      [0xfd],
      [-1],
    ])('invalid opcode', (opcode) => {
      expect(() => cpu.execute(opcode)).toThrow();
    });

    describe('flags', () => {
      test('DI', () => {
        cpu.registers.ime = 1;
        cpu.execute(0xf3);
        expect(getCurrentState()).toEqual({
          ...previousState,
          ime: 0,
          pc: 1,
          ticks: 1,
        });
      });

      test('EI', () => {
        cpu.registers.ime = 0;
        cpu.execute(0xfb);
        expect(getCurrentState()).toEqual({
          ...previousState,
          ime: 1,
          pc: 1,
          ticks: 1,
        });
      });
    });

    describe('control flow', () => {
      test.each([
        [Register.B, Register.C, 0xc5],
        [Register.D, Register.E, 0xd5],
        [Register.H, Register.L, 0xe5],
        [Register.A, Register.F, 0xf5],
      ])('PUSH %s', (high, low, opcode) => {
        cpu.registers.sp = 0xfffe;
        cpu.registers[high] = 0x00;
        cpu.registers[low] = 0xa0;
        cpu.execute(opcode);
        expect(getCurrentState()).toEqual({
          ...previousState,
          [high]: 0x00,
          [low]: 0xa0,
          sp: 0xfffc,
          ticks: 4,
        });
        expect(mmu.readWord(0xfffc)).toEqual(0xa0);
      });

      test.each([
        [Register.B, Register.C, 0xc1],
        [Register.D, Register.E, 0xd1],
        [Register.H, Register.L, 0xe1],
        [Register.A, Register.F, 0xf1],
      ])('POP %s', (high, low, opcode) => {
        cpu.registers.sp = 0xfffc;
        mmu.writeWord(cpu.registers.sp, 0xabc0);
        cpu.execute(opcode);
        expect(getCurrentState()).toEqual({
          ...previousState,
          sp: 0xfffe,
          [high]: 0xab,
          [low]: 0xc0,
          ticks: 3,
        });
      });

      describe('JR e8', () => {
        test('jump forward', () => {
          mockIO.set([0x04], cpu.registers.pc);
          cpu.execute(0x18);
          expect(getCurrentState()).toEqual({
            ...previousState,
            pc: previousState.pc + 5,
            ticks: 3,
          });
        });

        test('jump backward', () => {
          mockIO.set([0xfc], cpu.registers.pc);
          cpu.execute(0x18);
          expect(getCurrentState()).toEqual({
            ...previousState,
            pc: previousState.pc - 3,
            ticks: 3,
          });
        });
      });

      describe('JR NZ, e8', () => {
        test('jumps forward if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0x04], cpu.registers.pc);
          cpu.execute(0x20);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: previousState.pc + 5,
            ticks: 3,
          });
        });

        test('jumps backward if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0xfc], cpu.registers.pc);
          cpu.execute(0x20);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: previousState.pc - 3,
            ticks: 3,
          });
        });

        test('does not jump if zero flag is set', () => {
          cpu.registers.f = 0x80;
          mockIO.set([0x04], cpu.registers.pc);
          cpu.execute(0x20);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x80,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });

      describe('JR Z, e8', () => {
        test('jumps forward if zero flag is set', () => {
          cpu.registers.f = 0x80;
          mockIO.set([0x04], cpu.registers.pc);
          cpu.execute(0x28);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x80,
            pc: previousState.pc + 5,
            ticks: 3,
          });
        });

        test('jumps backward if zero flag is set', () => {
          cpu.registers.f = 0x80;
          mockIO.set([0xfc], cpu.registers.pc);
          cpu.execute(0x28);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x80,
            pc: previousState.pc - 3,
            ticks: 3,
          });
        });

        test('does not jump if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0x04], cpu.registers.pc);
          cpu.execute(0x28);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });

      describe('JR NC, e8', () => {
        test('jumps forward carry flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0x04], cpu.registers.pc);
          cpu.execute(0x30);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: previousState.pc + 5,
            ticks: 3,
          });
        });

        test('jumps backward if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0xfc], cpu.registers.pc);
          cpu.execute(0x30);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: previousState.pc - 3,
            ticks: 3,
          });
        });

        test('does not jump if carry flag is set', () => {
          cpu.registers.f = 0x10;
          mockIO.set([0x04], cpu.registers.pc);
          cpu.execute(0x30);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x10,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });

      describe('JR C, e8', () => {
        test('jumps if carry flag is set', () => {
          cpu.registers.f = 0x10;
          mockIO.set([0x04], cpu.registers.pc);
          cpu.execute(0x38);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x10,
            pc: previousState.pc + 5,
            ticks: 3,
          });
        });

        test('jumps backward if zero flag is set', () => {
          cpu.registers.f = 0x10;
          mockIO.set([0xfc], cpu.registers.pc);
          cpu.execute(0x38);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x10,
            pc: previousState.pc - 3,
            ticks: 3,
          });
        });

        test('does not jump if carry flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0x04], cpu.registers.pc);
          cpu.execute(0x38);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: previousState.pc + 1,
            ticks: 2,
          });
        });
      });

      describe('JP a16', () => {
        test('jumps', () => {
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xc3);
          expect(getCurrentState()).toEqual({
            ...previousState,
            pc: 0xabcd,
            ticks: 4,
          });
        });
      });

      describe('JP HL', () => {
        test('jumps', () => {
          cpu.registers.hl = 0xabcd;
          cpu.execute(0xe9);
          expect(getCurrentState()).toEqual({
            ...previousState,
            h: 0xab,
            l: 0xcd,
            pc: 0xabcd,
            ticks: 1,
          });
        });
      });

      describe('JP NZ a16', () => {
        test('jumps if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xc2);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: 0xabcd,
            ticks: 4,
          });
        });

        test('does not jump if zero flag is set', () => {
          cpu.registers.f = 0x80;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xc2);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x80,
            pc: previousState.pc + 2,
            ticks: 3,
          });
        });
      });

      describe('JP Z a16', () => {
        test('jumps if zero flag is set', () => {
          cpu.registers.f = 0x80;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xca);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x80,
            pc: 0xabcd,
            ticks: 4,
          });
        });

        test('does not jump if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xca);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: previousState.pc + 2,
            ticks: 3,
          });
        });
      });

      describe('JP NC a16', () => {
        test('jumps if carry flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xd2);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: 0xabcd,
            ticks: 4,
          });
        });

        test('does not jump if carry flag is set', () => {
          cpu.registers.f = 0x10;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xd2);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x10,
            pc: previousState.pc + 2,
            ticks: 3,
          });
        });
      });

      describe('JP C a16', () => {
        test('jumps if carry flag is set', () => {
          cpu.registers.f = 0x10;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xda);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x10,
            pc: 0xabcd,
            ticks: 4,
          });
        });

        test('does not jump if carry flag is clear', () => {
          cpu.registers.f = 0x00;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xda);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            pc: previousState.pc + 2,
            ticks: 3,
          });
        });
      });

      describe('CALL a16', () => {
        test('calls routine', () => {
          cpu.registers.pc = 0x1234;
          cpu.registers.sp = 0xfffe;
          mockIO.set([0xcd, 0xab], 0x1234);
          cpu.execute(0xcd);
          expect(getCurrentState()).toEqual({
            ...previousState,
            sp: 0xfffc,
            pc: 0xabcd,
            ticks: 6,
          });
          expect(mmu.readWord(cpu.registers.sp)).toEqual(0x1236);
        });
      });

      describe('CALL NZ, a16', () => {
        test('calls routine if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          cpu.registers.sp = 0xfffe;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xc4);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            sp: 0xfffc,
            pc: 0xabcd,
            ticks: 6,
          });
          expect(mmu.readWord(cpu.registers.sp)).toEqual(previousState.pc + 2);
        });

        test('does not call routine if zero flag is set', () => {
          cpu.registers.f = 0x80;
          cpu.registers.sp = 0xfffe;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xc4);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x80,
            sp: 0xfffe,
            pc: previousState.pc + 2,
            ticks: 3,
          });
        });
      });

      describe('CALL Z, a16', () => {
        test('calls routine if zero flag is set', () => {
          cpu.registers.f = 0x80;
          cpu.registers.sp = 0xfffe;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xcc);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x80,
            sp: 0xfffc,
            pc: 0xabcd,
            ticks: 6,
          });
          expect(mmu.readWord(cpu.registers.sp)).toEqual(previousState.pc + 2);
        });

        test('does not call routine if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          cpu.registers.sp = 0xfffe;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xcc);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            sp: 0xfffe,
            pc: previousState.pc + 2,
            ticks: 3,
          });
        });
      });

      describe('CALL NC, a16', () => {
        test('calls routine if carry flag is clear', () => {
          cpu.registers.f = 0x00;
          cpu.registers.sp = 0xfffe;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xd4);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            sp: 0xfffc,
            pc: 0xabcd,
            ticks: 6,
          });
          expect(mmu.readWord(cpu.registers.sp)).toEqual(previousState.pc + 2);
        });

        test('does not call routine if carry flag is set', () => {
          cpu.registers.f = 0x10;
          cpu.registers.sp = 0xfffe;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xd4);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x10,
            sp: 0xfffe,
            pc: previousState.pc + 2,
            ticks: 3,
          });
        });
      });

      describe('CALL C, a16', () => {
        test('calls routine if carry flag is set', () => {
          cpu.registers.f = 0x10;
          cpu.registers.sp = 0xfffe;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xdc);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x10,
            sp: 0xfffc,
            pc: 0xabcd,
            ticks: 6,
          });
          expect(mmu.readWord(cpu.registers.sp)).toEqual(previousState.pc + 2);
        });

        test('does not call routine if carry flag is clear', () => {
          cpu.registers.f = 0x00;
          cpu.registers.sp = 0xfffe;
          mockIO.set([0xcd, 0xab], cpu.registers.pc);
          cpu.execute(0xdc);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            sp: 0xfffe,
            pc: previousState.pc + 2,
            ticks: 3,
          });
        });
      });

      describe('RET', () => {
        test('returns from routine', () => {
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xc9);
          expect(getCurrentState()).toEqual({
            ...previousState,
            sp: 0xfffe,
            pc: 0x1234,
            ticks: 4,
          });
        });
      });

      describe('RET NZ', () => {
        test('returns from routine if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xc0);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            sp: 0xfffe,
            pc: 0x1234,
            ticks: 5,
          });
        });

        test('does not return from routine if zero flag is set', () => {
          cpu.registers.f = 0x80;
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xc0);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x80,
            sp: 0xfffc,
            pc: 0xabcd,
            ticks: 2,
          });
        });
      });

      describe('RET Z', () => {
        test('returns from routine if zero flag is set', () => {
          cpu.registers.f = 0x80;
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xc8);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x80,
            sp: 0xfffe,
            pc: 0x1234,
            ticks: 5,
          });
        });

        test('does not return from routine if zero flag is clear', () => {
          cpu.registers.f = 0x00;
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xc8);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            sp: 0xfffc,
            pc: 0xabcd,
            ticks: 2,
          });
        });
      });

      describe('RET NC', () => {
        test('returns from routine if carry flag is clear', () => {
          cpu.registers.f = 0x00;
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xd0);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            sp: 0xfffe,
            pc: 0x1234,
            ticks: 5,
          });
        });

        test('does not return from routine if carry flag is set', () => {
          cpu.registers.f = 0x10;
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xd0);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x10,
            sp: 0xfffc,
            pc: 0xabcd,
            ticks: 2,
          });
        });
      });

      describe('RET C', () => {
        test('returns from routine if carry flag is set', () => {
          cpu.registers.f = 0x10;
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xd8);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x10,
            sp: 0xfffe,
            pc: 0x1234,
            ticks: 5,
          });
        });

        test('does not return from routine if carry flag is clear', () => {
          cpu.registers.f = 0x00;
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xd8);
          expect(getCurrentState()).toEqual({
            ...previousState,
            f: 0x00,
            sp: 0xfffc,
            pc: 0xabcd,
            ticks: 2,
          });
        });
      });

      describe('RETI', () => {
        test('returns from routine and enables interrupts', () => {
          cpu.registers.pc = 0xabcd;
          cpu.registers.sp = 0xfffc;
          cpu.registers.ime = 0;
          mmu.writeWord(0xfffc, 0x1234);
          cpu.execute(0xd9);
          expect(getCurrentState()).toEqual({
            ...previousState,
            sp: 0xfffe,
            pc: 0x1234,
            ime: 1,
            ticks: 4,
          });
        });
      });
    });
  });

  describe('interrupts', () => {
    test.each(Object.entries(Interrupts))(
      'triggers a %s interrupt if IME and flag is enabled',
      (_, { flag, handlerAddress }) => {
        mmu.write(0xffff, flag);
        mmu.write(0xff0f, flag);
        cpu.registers.ime = 1;
        cpu.checkInterrupts();
        expect(cpu.registers.pc).toEqual(handlerAddress);
      }
    );

    test.each(Object.entries(Interrupts))(
      'does not triggers a %s interrupt if IME is enabled but flag is disabled',
      (_, { flag }) => {
        mmu.write(0xffff, 0x00);
        mmu.write(0xff0f, flag);
        cpu.registers.ime = 1;
        cpu.checkInterrupts();
        expect(cpu.registers.pc).toEqual(previousState.pc);
      }
    );

    test.each(Object.entries(Interrupts))(
      'does not triggers a %s interrupt if flag is enabled but IME is disabled',
      (_, { flag }) => {
        mmu.write(0xffff, flag);
        mmu.write(0xff0f, flag);
        cpu.registers.ime = 0;
        cpu.checkInterrupts();
        expect(cpu.registers.pc).toEqual(previousState.pc);
      }
    );

    test('resumes from HALT', () => {
      mmu.write(0xffff, 0xff);
      mmu.write(0xff0f, 0xff);
      cpu.registers.halt = true;
      cpu.checkInterrupts();
      expect(cpu.registers.halt).toEqual(false);
    });
  });
});
