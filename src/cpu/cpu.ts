import MMU from '../memory/mmu';
import PPU from '../graphics/ppu';
import Timer from '../timer/timer';
import { Interrupts } from './interrupts';
import { toSignedInt } from '../utils';
import Registers, {
  Register,
  Register16Bit,
  MemoryReference,
  Register8Bit,
} from './registers';

export default class CPU {
  registers: Registers;
  mmu: MMU;
  ppu?: PPU;
  timer?: Timer;
  ticks = 0;
  frameInterval: number | null;
  doubleSpeed = false;

  constructor(mmu: MMU) {
    this.mmu = mmu;
    this.registers = new Registers(mmu);
    this.frameInterval = null;
  }

  reset() {
    this.registers.reset();
    this.ticks = 0;
    this.doubleSpeed = false;
    clearInterval(this.frameInterval ?? 0);
    this.frameInterval = null;
  }

  run() {
    if (!this.frameInterval) {
      this.frameInterval = window.setInterval(
        this.runFrame.bind(this),
        this.doubleSpeed ? 16 : 8
      );
    }
  }

  runFrame() {
    let frameTicks = 0;
    while (frameTicks < 17556) {
      this.ticks = 0;

      if (!this.registers.stop && !this.registers.halt) {
        const operation = this.mmu.read(this.registers.pc);
        this.registers.pc = (this.registers.pc + 1) & 0xffff;
        this.execute(operation);
      } else {
        this.ticks += 1;
      }

      this.checkInterrupts();

      this.ppu?.step(this.ticks);
      this.timer?.step(this.ticks);

      frameTicks += this.ticks;
    }

    if (this.registers.stop) {
      clearInterval(this.frameInterval || 0);
      this.frameInterval = null;
    }
  }

  execute(operation: number) {
    // prettier-ignore
    switch (operation) {
      // 0
      case 0x00: return this.noop();
      case 0x01: return this.ldImmediateWord(Register16Bit.BC);
      case 0x02: return this.ld(MemoryReference.BC, Register.A, 2);
      case 0x03: return this.inc16Bit(Register16Bit.BC);
      case 0x04: return this.inc(Register.B);
      case 0x05: return this.dec(Register.B);
      case 0x06: return this.ldImmediate(Register.B);
      case 0x07: return this.rlca();
      case 0x08: return this.ldSPToAddress();
      case 0x09: return this.add16Bit(Register16Bit.BC);
      case 0x0A: return this.ld(Register.A, MemoryReference.BC, 2);
      case 0x0B: return this.dec16Bit(Register16Bit.BC);
      case 0x0C: return this.inc(Register.C);
      case 0x0D: return this.dec(Register.C);
      case 0x0E: return this.ldImmediate(Register.C);
      case 0x0F: return this.rrca();

      // 1
      case 0x10: return this.stop();
      case 0x11: return this.ldImmediateWord(Register16Bit.DE);
      case 0x12: return this.ld(MemoryReference.DE, Register.A, 2);
      case 0x13: return this.inc16Bit(Register16Bit.DE);
      case 0x14: return this.inc(Register.D);
      case 0x15: return this.dec(Register.D);
      case 0x16: return this.ldImmediate(Register.D);
      case 0x17: return this.rla();
      case 0x18: return this.jr(true);
      case 0x19: return this.add16Bit(Register16Bit.DE);
      case 0x1A: return this.ld(Register.A, MemoryReference.DE, 2);
      case 0x1B: return this.dec16Bit(Register16Bit.DE);
      case 0x1C: return this.inc(Register.E);
      case 0x1D: return this.dec(Register.E);
      case 0x1E: return this.ldImmediate(Register.E);
      case 0x1F: return this.rra();

      // 2
      case 0x20: return this.jr(!this.zero);
      case 0x21: return this.ldImmediateWord(Register16Bit.HL);
      case 0x22: return this.ldIncrementHL(MemoryReference.HL, Register.A);
      case 0x23: return this.inc16Bit(Register16Bit.HL);
      case 0x24: return this.inc(Register.H);
      case 0x25: return this.dec(Register.H);
      case 0x26: return this.ldImmediate(Register.H);
      case 0x27: return this.daa();
      case 0x28: return this.jr(this.zero);
      case 0x29: return this.add16Bit(Register16Bit.HL);
      case 0x2A: return this.ldIncrementHL(Register.A, MemoryReference.HL);
      case 0x2B: return this.dec16Bit(Register16Bit.HL);
      case 0x2C: return this.inc(Register.L);
      case 0x2D: return this.dec(Register.L);
      case 0x2E: return this.ldImmediate(Register.L);
      case 0x2F: return this.cpl();

      // 3
      case 0x30: return this.jr(!this.carry);
      case 0x31: return this.ldImmediateWord(Register16Bit.SP);
      case 0x32: return this.ldDecrementHL(MemoryReference.HL, Register.A);
      case 0x33: return this.inc16Bit(Register16Bit.SP);
      case 0x34: return this.inc(MemoryReference.HL, 3);
      case 0x35: return this.dec(MemoryReference.HL, 3);
      case 0x36: return this.ldImmediate(MemoryReference.HL, 3);
      case 0x37: return this.scf();
      case 0x38: return this.jr(this.carry);
      case 0x39: return this.add16Bit(Register16Bit.SP);
      case 0x3A: return this.ldDecrementHL(Register.A, MemoryReference.HL);
      case 0x3B: return this.dec16Bit(Register16Bit.SP);
      case 0x3C: return this.inc(Register.A);
      case 0x3D: return this.dec(Register.A);
      case 0x3E: return this.ldImmediate(Register.A);
      case 0x3F: return this.ccf();

      // 4
      case 0x40: return this.ld(Register.B, Register.B);
      case 0x41: return this.ld(Register.B, Register.C);
      case 0x42: return this.ld(Register.B, Register.D);
      case 0x43: return this.ld(Register.B, Register.E);
      case 0x44: return this.ld(Register.B, Register.H);
      case 0x45: return this.ld(Register.B, Register.L);
      case 0x46: return this.ld(Register.B, MemoryReference.HL, 2);
      case 0x47: return this.ld(Register.B, Register.A);
      case 0x48: return this.ld(Register.C, Register.B);
      case 0x49: return this.ld(Register.C, Register.C);
      case 0x4A: return this.ld(Register.C, Register.D);
      case 0x4B: return this.ld(Register.C, Register.E);
      case 0x4C: return this.ld(Register.C, Register.H);
      case 0x4D: return this.ld(Register.C, Register.L);
      case 0x4E: return this.ld(Register.C, MemoryReference.HL, 2);
      case 0x4F: return this.ld(Register.C, Register.A);

      // 5
      case 0x50: return this.ld(Register.D, Register.B);
      case 0x51: return this.ld(Register.D, Register.C);
      case 0x52: return this.ld(Register.D, Register.D);
      case 0x53: return this.ld(Register.D, Register.E);
      case 0x54: return this.ld(Register.D, Register.H);
      case 0x55: return this.ld(Register.D, Register.L);
      case 0x56: return this.ld(Register.D, MemoryReference.HL, 2);
      case 0x57: return this.ld(Register.D, Register.A);
      case 0x58: return this.ld(Register.E, Register.B);
      case 0x59: return this.ld(Register.E, Register.C);
      case 0x5A: return this.ld(Register.E, Register.D);
      case 0x5B: return this.ld(Register.E, Register.E);
      case 0x5C: return this.ld(Register.E, Register.H);
      case 0x5D: return this.ld(Register.E, Register.L);
      case 0x5E: return this.ld(Register.E, MemoryReference.HL, 2);
      case 0x5F: return this.ld(Register.E, Register.A);

      // 6
      case 0x60: return this.ld(Register.H, Register.B);
      case 0x61: return this.ld(Register.H, Register.C);
      case 0x62: return this.ld(Register.H, Register.D);
      case 0x63: return this.ld(Register.H, Register.E);
      case 0x64: return this.ld(Register.H, Register.H);
      case 0x65: return this.ld(Register.H, Register.L);
      case 0x66: return this.ld(Register.H, MemoryReference.HL, 2);
      case 0x67: return this.ld(Register.H, Register.A);
      case 0x68: return this.ld(Register.L, Register.B);
      case 0x69: return this.ld(Register.L, Register.C);
      case 0x6A: return this.ld(Register.L, Register.D);
      case 0x6B: return this.ld(Register.L, Register.E);
      case 0x6C: return this.ld(Register.L, Register.H);
      case 0x6D: return this.ld(Register.L, Register.L);
      case 0x6E: return this.ld(Register.L, MemoryReference.HL, 2);
      case 0x6F: return this.ld(Register.L, Register.A);

      // 7
      case 0x70: return this.ld(MemoryReference.HL, Register.B, 2);
      case 0x71: return this.ld(MemoryReference.HL, Register.C, 2);
      case 0x72: return this.ld(MemoryReference.HL, Register.D, 2);
      case 0x73: return this.ld(MemoryReference.HL, Register.E, 2);
      case 0x74: return this.ld(MemoryReference.HL, Register.H, 2);
      case 0x75: return this.ld(MemoryReference.HL, Register.L, 2);
      case 0x76: return this.halt();
      case 0x77: return this.ld(MemoryReference.HL, Register.A, 2);
      case 0x78: return this.ld(Register.A, Register.B);
      case 0x79: return this.ld(Register.A, Register.C);
      case 0x7A: return this.ld(Register.A, Register.D);
      case 0x7B: return this.ld(Register.A, Register.E);
      case 0x7C: return this.ld(Register.A, Register.H);
      case 0x7D: return this.ld(Register.A, Register.L);
      case 0x7E: return this.ld(Register.A, MemoryReference.HL, 2);
      case 0x7F: return this.ld(Register.A, Register.A);
      
      // 8
      case 0x80: return this.add(this.registers.b);
      case 0x81: return this.add(this.registers.c);
      case 0x82: return this.add(this.registers.d);
      case 0x83: return this.add(this.registers.e);
      case 0x84: return this.add(this.registers.h);
      case 0x85: return this.add(this.registers.l);
      case 0x86: return this.add(this.registers.hlReference, 2);
      case 0x87: return this.add(this.registers.a);
      case 0x88: return this.adc(this.registers.b);
      case 0x89: return this.adc(this.registers.c);
      case 0x8A: return this.adc(this.registers.d);
      case 0x8B: return this.adc(this.registers.e);
      case 0x8C: return this.adc(this.registers.h);
      case 0x8D: return this.adc(this.registers.l);
      case 0x8E: return this.adc(this.registers.hlReference, 2);
      case 0x8F: return this.adc(this.registers.a);
      
      // 9
      case 0x90: return this.sub(this.registers.b);
      case 0x91: return this.sub(this.registers.c);
      case 0x92: return this.sub(this.registers.d);
      case 0x93: return this.sub(this.registers.e);
      case 0x94: return this.sub(this.registers.h);
      case 0x95: return this.sub(this.registers.l);
      case 0x96: return this.sub(this.registers.hlReference, 2);
      case 0x97: return this.sub(this.registers.a);
      case 0x98: return this.sbc(this.registers.b);
      case 0x99: return this.sbc(this.registers.c);
      case 0x9A: return this.sbc(this.registers.d);
      case 0x9B: return this.sbc(this.registers.e);
      case 0x9C: return this.sbc(this.registers.h);
      case 0x9D: return this.sbc(this.registers.l);
      case 0x9E: return this.sbc(this.registers.hlReference, 2);
      case 0x9F: return this.sbc(this.registers.a);
      
      // A
      case 0xA0: return this.and(this.registers.b);
      case 0xA1: return this.and(this.registers.c);
      case 0xA2: return this.and(this.registers.d);
      case 0xA3: return this.and(this.registers.e);
      case 0xA4: return this.and(this.registers.h);
      case 0xA5: return this.and(this.registers.l);
      case 0xA6: return this.and(this.registers.hlReference, 2);
      case 0xA7: return this.and(this.registers.a);
      case 0xA8: return this.xor(this.registers.b);
      case 0xA9: return this.xor(this.registers.c);
      case 0xAA: return this.xor(this.registers.d);
      case 0xAB: return this.xor(this.registers.e);
      case 0xAC: return this.xor(this.registers.h);
      case 0xAD: return this.xor(this.registers.l);
      case 0xAE: return this.xor(this.registers.hlReference, 2);
      case 0xAF: return this.xor(this.registers.a);
      
      // B
      case 0xB0: return this.or(this.registers.b);
      case 0xB1: return this.or(this.registers.c);
      case 0xB2: return this.or(this.registers.d);
      case 0xB3: return this.or(this.registers.e);
      case 0xB4: return this.or(this.registers.h);
      case 0xB5: return this.or(this.registers.l);
      case 0xB6: return this.or(this.registers.hlReference, 2);
      case 0xB7: return this.or(this.registers.a);
      case 0xB8: return this.cp(this.registers.b);
      case 0xB9: return this.cp(this.registers.c);
      case 0xBA: return this.cp(this.registers.d);
      case 0xBB: return this.cp(this.registers.e);
      case 0xBC: return this.cp(this.registers.h);
      case 0xBD: return this.cp(this.registers.l);
      case 0xBE: return this.cp(this.registers.hlReference, 2);
      case 0xBF: return this.cp(this.registers.a);
      
      // C
      case 0xC0: return this.retConditional(!this.zero);
      case 0xC1: return this.pop(Register16Bit.BC);
      case 0xC2: return this.jp(!this.zero);
      case 0xC3: return this.jp(true);
      case 0xC4: return this.call(!this.zero);
      case 0xC5: return this.push(Register16Bit.BC);
      case 0xC6: return this.add(this.fetchImmediate(), 2);
      case 0xC7: return this.rst(0x00);
      case 0xC8: return this.retConditional(this.zero);
      case 0xC9: return this.ret();
      case 0xCA: return this.jp(this.zero);
      case 0xCB: return this.prefixed();
      case 0xCC: return this.call(this.zero);
      case 0xCD: return this.call(true);
      case 0xCE: return this.adc(this.fetchImmediate(), 2);
      case 0xCF: return this.rst(0x08);
      
      // D
      case 0xD0: return this.retConditional(!this.carry);
      case 0xD1: return this.pop(Register16Bit.DE);
      case 0xD2: return this.jp(!this.carry);
      case 0xD3: return this.invalid(operation);
      case 0xD4: return this.call(!this.carry);
      case 0xD5: return this.push(Register16Bit.DE);
      case 0xD6: return this.sub(this.fetchImmediate(), 2);
      case 0xD7: return this.rst(0x10);
      case 0xD8: return this.retConditional(this.carry);
      case 0xD9: return this.reti();
      case 0xDA: return this.jp(this.carry);
      case 0xDB: return this.invalid(operation);
      case 0xDC: return this.call(this.carry);
      case 0xDD: return this.invalid(operation);
      case 0xDE: return this.sbc(this.fetchImmediate(), 2);
      case 0xDF: return this.rst(0x18);

      // E
      case 0xE0: return this.ldToIORegister(this.fetchImmediate(), 3);
      case 0xE1: return this.pop(Register16Bit.HL);
      case 0xE2: return this.ldToIORegister(this.registers.c, 2);
      case 0xE3: return this.invalid(operation);
      case 0xE4: return this.invalid(operation);
      case 0xE5: return this.push(Register16Bit.HL);
      case 0xE6: return this.and(this.fetchImmediate(), 2);
      case 0xE7: return this.rst(0x20);
      case 0xE8: return this.addSPImmediate();
      case 0xE9: return this.jpHL();
      case 0xEA: return this.ldToAddress();
      case 0xEB: return this.invalid(operation);
      case 0xEC: return this.invalid(operation);
      case 0xED: return this.invalid(operation);
      case 0xEE: return this.xor(this.fetchImmediate(), 2);
      case 0xEF: return this.rst(0x28);

      // F
      case 0xF0: return this.ldFromIORegister(this.fetchImmediate(), 3);
      case 0xF1: return this.pop(Register16Bit.AF);
      case 0xF2: return this.ldFromIORegister(this.registers.c, 2);
      case 0xF3: return this.di();
      case 0xF4: return this.invalid(operation);
      case 0xF5: return this.push(Register16Bit.AF);
      case 0xF6: return this.or(this.fetchImmediate(), 2);
      case 0xF7: return this.rst(0x30);
      case 0xF8: return this.ldSPPlusImmediate();
      case 0xF9: return this.ld16Bit(Register16Bit.SP, Register16Bit.HL, 2);
      case 0xFA: return this.ldFromAddress();
      case 0xFB: return this.ei();
      case 0xFC: return this.invalid(operation);
      case 0xFD: return this.invalid(operation);
      case 0xFE: return this.cp(this.fetchImmediate(), 2);
      case 0xFF: return this.rst(0x38);

      default: return this.invalid(operation);
    }
  }

  executePrefixed(operation: number) {
    // prettier-ignore
    switch (operation) {
      // 0
      case 0x00: return this.rlc(Register.B);
      case 0x01: return this.rlc(Register.C);
      case 0x02: return this.rlc(Register.D);
      case 0x03: return this.rlc(Register.E);
      case 0x04: return this.rlc(Register.H);
      case 0x05: return this.rlc(Register.L);
      case 0x06: return this.rlc(MemoryReference.HL, 4);
      case 0x07: return this.rlc(Register.A);
      case 0x08: return this.rrc(Register.B);
      case 0x09: return this.rrc(Register.C);
      case 0x0A: return this.rrc(Register.D);
      case 0x0B: return this.rrc(Register.E);
      case 0x0C: return this.rrc(Register.H);
      case 0x0D: return this.rrc(Register.L);
      case 0x0E: return this.rrc(MemoryReference.HL, 4);
      case 0x0F: return this.rrc(Register.A);

      // 1
      case 0x10: return this.rl(Register.B);
      case 0x11: return this.rl(Register.C);
      case 0x12: return this.rl(Register.D);
      case 0x13: return this.rl(Register.E);
      case 0x14: return this.rl(Register.H);
      case 0x15: return this.rl(Register.L);
      case 0x16: return this.rl(MemoryReference.HL, 4);
      case 0x17: return this.rl(Register.A);
      case 0x18: return this.rr(Register.B);
      case 0x19: return this.rr(Register.C);
      case 0x1A: return this.rr(Register.D);
      case 0x1B: return this.rr(Register.E);
      case 0x1C: return this.rr(Register.H);
      case 0x1D: return this.rr(Register.L);
      case 0x1E: return this.rr(MemoryReference.HL, 4);
      case 0x1F: return this.rr(Register.A);

      // 2
      case 0x20: return this.sla(Register.B);
      case 0x21: return this.sla(Register.C);
      case 0x22: return this.sla(Register.D);
      case 0x23: return this.sla(Register.E);
      case 0x24: return this.sla(Register.H);
      case 0x25: return this.sla(Register.L);
      case 0x26: return this.sla(MemoryReference.HL, 4);
      case 0x27: return this.sla(Register.A);
      case 0x28: return this.sra(Register.B);
      case 0x29: return this.sra(Register.C);
      case 0x2A: return this.sra(Register.D);
      case 0x2B: return this.sra(Register.E);
      case 0x2C: return this.sra(Register.H);
      case 0x2D: return this.sra(Register.L);
      case 0x2E: return this.sra(MemoryReference.HL, 4);
      case 0x2F: return this.sra(Register.A);

      // 3
      case 0x30: return this.swap(Register.B);
      case 0x31: return this.swap(Register.C);
      case 0x32: return this.swap(Register.D);
      case 0x33: return this.swap(Register.E);
      case 0x34: return this.swap(Register.H);
      case 0x35: return this.swap(Register.L);
      case 0x36: return this.swap(MemoryReference.HL, 4);
      case 0x37: return this.swap(Register.A);
      case 0x38: return this.srl(Register.B);
      case 0x39: return this.srl(Register.C);
      case 0x3A: return this.srl(Register.D);
      case 0x3B: return this.srl(Register.E);
      case 0x3C: return this.srl(Register.H);
      case 0x3D: return this.srl(Register.L);
      case 0x3E: return this.srl(MemoryReference.HL, 4);
      case 0x3F: return this.srl(Register.A);

      // 4
      case 0x40: return this.bit(0, Register.B);
      case 0x41: return this.bit(0, Register.C);
      case 0x42: return this.bit(0, Register.D);
      case 0x43: return this.bit(0, Register.E);
      case 0x44: return this.bit(0, Register.H);
      case 0x45: return this.bit(0, Register.L);
      case 0x46: return this.bit(0, MemoryReference.HL, 3);
      case 0x47: return this.bit(0, Register.A);
      case 0x48: return this.bit(1, Register.B);
      case 0x49: return this.bit(1, Register.C);
      case 0x4A: return this.bit(1, Register.D);
      case 0x4B: return this.bit(1, Register.E);
      case 0x4C: return this.bit(1, Register.H);
      case 0x4D: return this.bit(1, Register.L);
      case 0x4E: return this.bit(1, MemoryReference.HL, 3);
      case 0x4F: return this.bit(1, Register.A);

      // 5
      case 0x50: return this.bit(2, Register.B);
      case 0x51: return this.bit(2, Register.C);
      case 0x52: return this.bit(2, Register.D);
      case 0x53: return this.bit(2, Register.E);
      case 0x54: return this.bit(2, Register.H);
      case 0x55: return this.bit(2, Register.L);
      case 0x56: return this.bit(2, MemoryReference.HL, 3);
      case 0x57: return this.bit(2, Register.A);
      case 0x58: return this.bit(3, Register.B);
      case 0x59: return this.bit(3, Register.C);
      case 0x5A: return this.bit(3, Register.D);
      case 0x5B: return this.bit(3, Register.E);
      case 0x5C: return this.bit(3, Register.H);
      case 0x5D: return this.bit(3, Register.L);
      case 0x5E: return this.bit(3, MemoryReference.HL, 3);
      case 0x5F: return this.bit(3, Register.A);

      // 6
      case 0x60: return this.bit(4, Register.B);
      case 0x61: return this.bit(4, Register.C);
      case 0x62: return this.bit(4, Register.D);
      case 0x63: return this.bit(4, Register.E);
      case 0x64: return this.bit(4, Register.H);
      case 0x65: return this.bit(4, Register.L);
      case 0x66: return this.bit(4, MemoryReference.HL, 3);
      case 0x67: return this.bit(4, Register.A);
      case 0x68: return this.bit(5, Register.B);
      case 0x69: return this.bit(5, Register.C);
      case 0x6A: return this.bit(5, Register.D);
      case 0x6B: return this.bit(5, Register.E);
      case 0x6C: return this.bit(5, Register.H);
      case 0x6D: return this.bit(5, Register.L);
      case 0x6E: return this.bit(5, MemoryReference.HL, 3);
      case 0x6F: return this.bit(5, Register.A);

      // 7
      case 0x70: return this.bit(6, Register.B);
      case 0x71: return this.bit(6, Register.C);
      case 0x72: return this.bit(6, Register.D);
      case 0x73: return this.bit(6, Register.E);
      case 0x74: return this.bit(6, Register.H);
      case 0x75: return this.bit(6, Register.L);
      case 0x76: return this.bit(6, MemoryReference.HL, 3);
      case 0x77: return this.bit(6, Register.A);
      case 0x78: return this.bit(7, Register.B);
      case 0x79: return this.bit(7, Register.C);
      case 0x7A: return this.bit(7, Register.D);
      case 0x7B: return this.bit(7, Register.E);
      case 0x7C: return this.bit(7, Register.H);
      case 0x7D: return this.bit(7, Register.L);
      case 0x7E: return this.bit(7, MemoryReference.HL, 3);
      case 0x7F: return this.bit(7, Register.A);

      // 8
      case 0x80: return this.res(0, Register.B);
      case 0x81: return this.res(0, Register.C);
      case 0x82: return this.res(0, Register.D);
      case 0x83: return this.res(0, Register.E);
      case 0x84: return this.res(0, Register.H);
      case 0x85: return this.res(0, Register.L);
      case 0x86: return this.res(0, MemoryReference.HL, 4);
      case 0x87: return this.res(0, Register.A);
      case 0x88: return this.res(1, Register.B);
      case 0x89: return this.res(1, Register.C);
      case 0x8A: return this.res(1, Register.D);
      case 0x8B: return this.res(1, Register.E);
      case 0x8C: return this.res(1, Register.H);
      case 0x8D: return this.res(1, Register.L);
      case 0x8E: return this.res(1, MemoryReference.HL, 4);
      case 0x8F: return this.res(1, Register.A);

      // 9
      case 0x90: return this.res(2, Register.B);
      case 0x91: return this.res(2, Register.C);
      case 0x92: return this.res(2, Register.D);
      case 0x93: return this.res(2, Register.E);
      case 0x94: return this.res(2, Register.H);
      case 0x95: return this.res(2, Register.L);
      case 0x96: return this.res(2, MemoryReference.HL, 4);
      case 0x97: return this.res(2, Register.A);
      case 0x98: return this.res(3, Register.B);
      case 0x99: return this.res(3, Register.C);
      case 0x9A: return this.res(3, Register.D);
      case 0x9B: return this.res(3, Register.E);
      case 0x9C: return this.res(3, Register.H);
      case 0x9D: return this.res(3, Register.L);
      case 0x9E: return this.res(3, MemoryReference.HL, 4);
      case 0x9F: return this.res(3, Register.A);

      // A
      case 0xA0: return this.res(4, Register.B);
      case 0xA1: return this.res(4, Register.C);
      case 0xA2: return this.res(4, Register.D);
      case 0xA3: return this.res(4, Register.E);
      case 0xA4: return this.res(4, Register.H);
      case 0xA5: return this.res(4, Register.L);
      case 0xA6: return this.res(4, MemoryReference.HL, 4);
      case 0xA7: return this.res(4, Register.A);
      case 0xA8: return this.res(5, Register.B);
      case 0xA9: return this.res(5, Register.C);
      case 0xAA: return this.res(5, Register.D);
      case 0xAB: return this.res(5, Register.E);
      case 0xAC: return this.res(5, Register.H);
      case 0xAD: return this.res(5, Register.L);
      case 0xAE: return this.res(5, MemoryReference.HL, 4);
      case 0xAF: return this.res(5, Register.A);

      // B
      case 0xB0: return this.res(6, Register.B);
      case 0xB1: return this.res(6, Register.C);
      case 0xB2: return this.res(6, Register.D);
      case 0xB3: return this.res(6, Register.E);
      case 0xB4: return this.res(6, Register.H);
      case 0xB5: return this.res(6, Register.L);
      case 0xB6: return this.res(6, MemoryReference.HL, 4);
      case 0xB7: return this.res(6, Register.A);
      case 0xB8: return this.res(7, Register.B);
      case 0xB9: return this.res(7, Register.C);
      case 0xBA: return this.res(7, Register.D);
      case 0xBB: return this.res(7, Register.E);
      case 0xBC: return this.res(7, Register.H);
      case 0xBD: return this.res(7, Register.L);
      case 0xBE: return this.res(7, MemoryReference.HL, 4);
      case 0xBF: return this.res(7, Register.A);

      // C
      case 0xC0: return this.set(0, Register.B);
      case 0xC1: return this.set(0, Register.C);
      case 0xC2: return this.set(0, Register.D);
      case 0xC3: return this.set(0, Register.E);
      case 0xC4: return this.set(0, Register.H);
      case 0xC5: return this.set(0, Register.L);
      case 0xC6: return this.set(0, MemoryReference.HL, 4);
      case 0xC7: return this.set(0, Register.A);
      case 0xC8: return this.set(1, Register.B);
      case 0xC9: return this.set(1, Register.C);
      case 0xCA: return this.set(1, Register.D);
      case 0xCB: return this.set(1, Register.E);
      case 0xCC: return this.set(1, Register.H);
      case 0xCD: return this.set(1, Register.L);
      case 0xCE: return this.set(1, MemoryReference.HL, 4);
      case 0xCF: return this.set(1, Register.A);

      // D
      case 0xD0: return this.set(2, Register.B);
      case 0xD1: return this.set(2, Register.C);
      case 0xD2: return this.set(2, Register.D);
      case 0xD3: return this.set(2, Register.E);
      case 0xD4: return this.set(2, Register.H);
      case 0xD5: return this.set(2, Register.L);
      case 0xD6: return this.set(2 ,MemoryReference.HL, 4);
      case 0xD7: return this.set(2, Register.A);
      case 0xD8: return this.set(3, Register.B);
      case 0xD9: return this.set(3, Register.C);
      case 0xDA: return this.set(3, Register.D);
      case 0xDB: return this.set(3, Register.E);
      case 0xDC: return this.set(3, Register.H);
      case 0xDD: return this.set(3, Register.L);
      case 0xDE: return this.set(3, MemoryReference.HL, 4);
      case 0xDF: return this.set(3, Register.A);

      // E
      case 0xE0: return this.set(4, Register.B);
      case 0xE1: return this.set(4, Register.C);
      case 0xE2: return this.set(4, Register.D);
      case 0xE3: return this.set(4, Register.E);
      case 0xE4: return this.set(4, Register.H);
      case 0xE5: return this.set(4, Register.L);
      case 0xE6: return this.set(4, MemoryReference.HL, 4);
      case 0xE7: return this.set(4, Register.A);
      case 0xE8: return this.set(5, Register.B);
      case 0xE9: return this.set(5, Register.C);
      case 0xEA: return this.set(5, Register.D);
      case 0xEB: return this.set(5, Register.E);
      case 0xEC: return this.set(5, Register.H);
      case 0xED: return this.set(5, Register.L);
      case 0xEE: return this.set(5, MemoryReference.HL, 4);
      case 0xEF: return this.set(5, Register.A);

      // F
      case 0xF0: return this.set(6, Register.B);
      case 0xF1: return this.set(6, Register.C);
      case 0xF2: return this.set(6, Register.D);
      case 0xF3: return this.set(6, Register.E);
      case 0xF4: return this.set(6, Register.H);
      case 0xF5: return this.set(6, Register.L);
      case 0xF6: return this.set(6, MemoryReference.HL, 4);
      case 0xF7: return this.set(6, Register.A);
      case 0xF8: return this.set(7, Register.B);
      case 0xF9: return this.set(7, Register.C);
      case 0xFA: return this.set(7, Register.D);
      case 0xFB: return this.set(7, Register.E);
      case 0xFC: return this.set(7, Register.H);
      case 0xFD: return this.set(7, Register.L);
      case 0xFE: return this.set(7, MemoryReference.HL, 4);
      case 0xFF: return this.set(7, Register.A);

      default: return this.invalid(0xCB00 + operation);
    }
  }

  prefixed() {
    const operation = this.mmu.read(this.registers.pc);
    this.registers.pc = (this.registers.pc + 1) & 0xffff;
    this.ticks += 1;
    this.executePrefixed(operation);
  }

  checkInterrupts() {
    const enabledFlags = this.mmu.read(0xffff);
    const firedFlags = this.mmu.read(0xff0f);
    const interrupts = enabledFlags & firedFlags;

    // Resume from HALT
    if (interrupts && this.registers.halt) {
      this.registers.halt = false;
    }

    if (!this.registers.ime) {
      return;
    }

    Object.values(Interrupts).forEach((interrupt) => {
      if (interrupts & interrupt.flag) {
        this.registers.ime = 0;
        this.mmu.write(0xff0f, this.mmu.read(0xff0f) ^ interrupt.flag);
        this.rst(interrupt.handlerAddress);
        this.ticks += 1;
      }
    });
  }

  invalid(opcode: number) {
    this.registers.stop = true;
    throw new Error(`Invalid opcode: ${opcode.toString(16)}`);
  }

  fetchImmediate() {
    const value = this.mmu.read(this.registers.pc);
    this.registers.pc = (this.registers.pc + 1) & 0xffff;
    return value;
  }

  fetchImmediateWord() {
    const value = this.mmu.readWord(this.registers.pc);
    this.registers.pc = (this.registers.pc + 2) & 0xffff;
    return value;
  }

  noop() {
    this.ticks += 1;
  }

  stop() {
    this.registers.pc = (this.registers.pc + 1) & 0xffff;

    // Speed switch
    if (this.mmu.speed & 0x01) {
      this.doubleSpeed = !this.doubleSpeed;
      this.mmu.speed = this.doubleSpeed ? 0x80 : 0;
      const interval = this.doubleSpeed ? 16 : 8;
      clearInterval(this.frameInterval || 0);
      this.frameInterval = window.setInterval(
        this.runFrame.bind(this),
        interval
      );
    } else {
      this.registers.stop = true;
    }
    this.ticks += 1;
  }

  halt() {
    this.registers.halt = true;
    this.ticks += 1;
  }

  // Flags

  get zero() {
    return Boolean(this.registers.f & 0x80);
  }

  set zero(isSet: boolean) {
    this.registers.f = (this.registers.f & 0x7f) | (isSet ? 0x80 : 0);
  }

  get subtraction() {
    return Boolean(this.registers.f & 0x40);
  }

  set subtraction(value: boolean) {
    this.registers.f = (this.registers.f & 0xbf) | (value ? 0x40 : 0);
  }

  get half() {
    return Boolean(this.registers.f & 0x20);
  }

  set half(value: boolean) {
    this.registers.f = (this.registers.f & 0xdf) | (value ? 0x20 : 0);
  }

  get carry() {
    return Boolean(this.registers.f & 0x10);
  }

  set carry(value: boolean) {
    this.registers.f = (this.registers.f & 0xef) | (value ? 0x10 : 0);
  }

  // LD

  ld(destination: Register8Bit, source: Register8Bit, ticks = 1) {
    this.registers[destination] = this.registers[source];
    this.ticks += ticks;
  }

  ld16Bit(destination: Register16Bit, source: Register16Bit, ticks = 1) {
    this.registers[destination] = this.registers[source];
    this.ticks += ticks;
  }

  ldImmediate(register: Register8Bit, ticks = 2) {
    this.registers[register] = this.fetchImmediate();
    this.ticks += ticks;
  }

  ldImmediateWord(register: Register16Bit) {
    this.registers[register] = this.fetchImmediateWord();
    this.ticks += 3;
  }

  ldSPPlusImmediate() {
    const value = toSignedInt(this.fetchImmediate());
    this.half = Boolean(((this.registers.sp & 0x0f) + (value & 0x0f)) & 0x10);
    this.carry = Boolean(
      ((this.registers.sp & 0xff) + (value & 0xff)) & 0x0100
    );
    const sum = this.registers.sp + value;
    this.registers.hl = sum & 0xffff;
    this.zero = false;
    this.subtraction = false;
    this.ticks += 3;
  }

  ldIncrementHL(destination: Register8Bit, source: Register8Bit) {
    this.registers[destination] = this.registers[source];
    this.registers.hl = (this.registers.hl + 1) & 0xffff;
    this.ticks += 2;
  }

  ldDecrementHL(destination: Register8Bit, source: Register8Bit) {
    this.registers[destination] = this.registers[source];
    this.registers.hl = (this.registers.hl - 1) & 0xffff;
    this.ticks += 2;
  }

  ldSPToAddress() {
    const address = this.fetchImmediateWord();
    this.mmu.write(address, this.registers.sp & 0xff);
    this.mmu.write(address + 1, this.registers.sp >> 8);
    this.ticks += 5;
  }

  ldToAddress() {
    this.mmu.write(this.fetchImmediateWord(), this.registers.a);
    this.ticks += 4;
  }

  ldFromAddress() {
    this.registers.a = this.mmu.read(this.fetchImmediateWord());
    this.ticks += 4;
  }

  // IO

  ldToIORegister(value: number, ticks = 2) {
    this.mmu.write(0xff00 + value, this.registers.a);
    this.ticks += ticks;
  }

  ldFromIORegister(value: number, ticks = 2) {
    this.registers.a = this.mmu.read(0xff00 + value);
    this.ticks += ticks;
  }

  // Incrementation

  inc(register: Register8Bit, ticks = 1) {
    const value = this.registers[register];
    const result = (value + 1) & 0xff;
    this.half = Boolean(((value & 0xf) + 1) & 0x10);
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = false;
    this.ticks += ticks;
  }

  inc16Bit(register: Register16Bit) {
    this.registers[register] = (this.registers[register] + 1) & 0xffff;
    this.ticks += 2;
  }

  dec(register: Register8Bit, ticks = 1) {
    const value = this.registers[register];
    const result = (value - 1) & 0xff;
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = true;
    this.half = (value & 0xf) === 0;
    this.ticks += ticks;
  }

  dec16Bit(register: Register16Bit) {
    this.registers[register] = (this.registers[register] - 1) & 0xffff;
    this.ticks += 2;
  }

  // Carry

  scf() {
    this.subtraction = false;
    this.half = false;
    this.carry = true;
    this.ticks += 1;
  }

  ccf() {
    this.subtraction = false;
    this.half = false;
    this.carry = !this.carry;
    this.ticks += 1;
  }

  // Arithmetic

  add(amount: number, ticks = 1) {
    const value = this.registers.a;
    const sum = value + amount;
    this.registers.a = sum & 0xff;
    this.zero = this.registers.a === 0;
    this.subtraction = false;
    this.half = Boolean(((value & 0xf) + (amount & 0xf)) & 0x10);
    this.carry = sum > 0xff;
    this.ticks += ticks;
  }

  addSPImmediate() {
    const value = toSignedInt(this.fetchImmediate());
    this.half = Boolean(((this.registers.sp & 0x0f) + (value & 0x0f)) & 0x10);
    this.carry = Boolean(
      ((this.registers.sp & 0xff) + (value & 0xff)) & 0x0100
    );
    const sum = this.registers.sp + value;
    this.registers.sp = sum & 0xffff;
    this.zero = false;
    this.subtraction = false;
    this.ticks += 4;
  }

  add16Bit(register: Register16Bit) {
    this.half = Boolean(
      ((this.registers.hl & 0x0fff) + (this.registers[register] & 0x0fff)) &
        0x1000
    );
    const sum = this.registers.hl + this.registers[register];
    this.registers.hl = sum & 0xffff;
    this.subtraction = false;
    this.carry = sum > 0xffff;
    this.ticks += 2;
  }

  adc(amount: number, ticks = 1) {
    const value = this.registers.a;
    const sum = value + amount + (this.carry ? 1 : 0);
    this.registers.a = sum & 0xff;
    this.zero = this.registers.a === 0;
    this.subtraction = false;
    this.half = Boolean(
      ((value & 0xf) + (amount & 0xf) + (this.carry ? 1 : 0)) & 0x10
    );
    this.carry = sum > 0xff;
    this.ticks += ticks;
  }

  sub(amount: number, ticks = 1) {
    const value = this.registers.a;
    const result = value - amount;
    this.registers.a = result & 0xff;
    this.zero = this.registers.a === 0;
    this.subtraction = true;
    this.half = (value & 0xf) - (amount & 0xf) < 0;
    this.carry = result < 0;
    this.ticks += ticks;
  }

  sbc(amount: number, ticks = 1) {
    const value = this.registers.a;
    const result = value - amount - (this.carry ? 1 : 0);
    this.registers.a = result & 0xff;
    this.zero = this.registers.a === 0;
    this.subtraction = true;
    this.half = (value & 0xf) - (amount & 0xf) - (this.carry ? 1 : 0) < 0;
    this.carry = result < 0;
    this.ticks += ticks;
  }

  daa() {
    if (this.subtraction) {
      if (this.carry) {
        this.registers.a = (this.registers.a - 0x60) & 0xff;
      }
      if (this.half) {
        this.registers.a = (this.registers.a - 0x06) & 0xff;
      }
    } else {
      if (this.carry || this.registers.a > 0x99) {
        this.registers.a = (this.registers.a + 0x60) & 0xff;
        this.carry = true;
      }
      if (this.half || (this.registers.a & 0x0f) > 0x09) {
        this.registers.a = (this.registers.a + 0x06) & 0xff;
      }
    }
    this.zero = this.registers.a === 0;
    this.half = false;
    this.ticks += 1;
  }

  // Control flow

  jp(condition: boolean) {
    const address = this.fetchImmediateWord();
    if (condition) {
      this.registers.pc = address;
      this.ticks += 4;
    } else {
      this.ticks += 3;
    }
  }

  jpHL() {
    this.registers.pc = this.registers.hl;
    this.ticks += 1;
  }

  jr(condition: boolean) {
    const steps = toSignedInt(this.fetchImmediate());
    if (condition) {
      this.registers.pc += steps;
      this.ticks += 3;
    } else {
      this.ticks += 2;
    }
  }

  call(condition: boolean) {
    const address = this.fetchImmediateWord();
    if (condition) {
      this.registers.sp = (this.registers.sp - 2) & 0xffff;
      this.mmu.writeWord(this.registers.sp, this.registers.pc);
      this.registers.pc = address;
      this.ticks += 6;
    } else {
      this.ticks += 3;
    }
  }

  ret() {
    this.registers.pc = this.mmu.readWord(this.registers.sp);
    this.registers.sp = (this.registers.sp + 2) & 0xffff;
    this.ticks += 4;
  }

  retConditional(condition: boolean) {
    if (condition) {
      this.registers.pc = this.mmu.readWord(this.registers.sp);
      this.registers.sp = (this.registers.sp + 2) & 0xffff;
      this.ticks += 5;
    } else {
      this.ticks += 2;
    }
  }

  reti() {
    this.registers.pc = this.mmu.readWord(this.registers.sp);
    this.registers.sp = (this.registers.sp + 2) & 0xffff;
    this.registers.ime = 1;
    this.ticks += 4;
  }

  rst(address: number) {
    this.registers.sp = (this.registers.sp - 2) & 0xffff;
    this.mmu.writeWord(this.registers.sp, this.registers.pc);
    this.registers.pc = address;
    this.ticks += 4;
  }

  // Interrupts

  di() {
    this.registers.ime = 0;
    this.ticks += 1;
  }

  ei() {
    this.registers.ime = 1;
    this.ticks += 1;
  }

  // CP

  cp(value: number, ticks = 1) {
    this.half = (this.registers.a & 0xf) < (value & 0xf);
    const sum = this.registers.a - value;
    this.zero = sum === 0;
    this.subtraction = true;
    this.carry = sum < 0;
    this.ticks += ticks;
  }

  // Stack

  push(register: Register16Bit) {
    this.registers.sp = (this.registers.sp - 2) & 0xffff;
    this.mmu.writeWord(this.registers.sp, this.registers[register]);
    this.ticks += 4;
  }

  pop(register: Register16Bit) {
    this.registers[register] = this.mmu.readWord(this.registers.sp);
    this.registers.sp = (this.registers.sp + 2) & 0xffff;
    this.ticks += 3;
  }

  // Bitwise operations

  and(value: number, ticks = 1) {
    this.registers.a = this.registers.a & value;
    this.zero = this.registers.a === 0;
    this.subtraction = false;
    this.half = true;
    this.carry = false;
    this.ticks += ticks;
  }

  or(value: number, ticks = 1) {
    this.registers.a = this.registers.a | value;
    this.zero = this.registers.a === 0;
    this.subtraction = false;
    this.half = false;
    this.carry = false;
    this.ticks += ticks;
  }

  xor(value: number, ticks = 1) {
    this.registers.a = this.registers.a ^ value;
    this.zero = this.registers.a === 0;
    this.subtraction = false;
    this.half = false;
    this.carry = false;
    this.ticks += ticks;
  }

  cpl() {
    this.registers.a = ~this.registers.a & 0xff;
    this.subtraction = true;
    this.half = true;
    this.ticks += 1;
  }

  bit(bit: number, register: Register8Bit, ticks = 2) {
    this.zero = (this.registers[register] & (1 << bit)) === 0;
    this.subtraction = false;
    this.half = true;
    this.ticks += ticks;
  }

  res(bit: number, register: Register8Bit, ticks = 2) {
    this.registers[register] &= ~(1 << bit);
    this.ticks += ticks;
  }

  set(bit: number, register: Register8Bit, ticks = 2) {
    this.registers[register] |= 1 << bit;
    this.ticks += ticks;
  }

  swap(register: Register8Bit, ticks = 2) {
    const value = this.registers[register];
    const result = ((value & 0x0f) << 4) + ((value & 0xf0) >> 4);
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = false;
    this.half = false;
    this.carry = false;
    this.ticks += ticks;
  }

  sla(register: Register8Bit, ticks = 2) {
    const value = this.registers[register];
    const carry = Boolean(value & 0x80);
    const result = (value << 1) & 0xff;
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = false;
    this.half = false;
    this.carry = carry;
    this.ticks += ticks;
  }

  sra(register: Register8Bit, ticks = 2) {
    const value = this.registers[register];
    this.carry = Boolean(value & 0x1);
    const result = (value & 0x80) | (value >> 1);
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = false;
    this.half = false;
    this.ticks += ticks;
  }

  srl(register: Register8Bit, ticks = 2) {
    const value = this.registers[register];
    const result = value >> 1;
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = false;
    this.half = false;
    this.carry = Boolean(value & 0x1);
    this.ticks += ticks;
  }

  rlca() {
    const carry = Boolean(this.registers.a & 0x80);
    this.registers.a = ((this.registers.a << 1) & 0xff) + (carry ? 0x1 : 0);
    this.zero = false;
    this.subtraction = false;
    this.half = false;
    this.carry = carry;
    this.ticks += 1;
  }

  rlc(register: Register8Bit, ticks = 2) {
    const value = this.registers[register];
    const carry = Boolean(value & 0x80);
    const result = ((value << 1) & 0xff) + (carry ? 0x1 : 0);
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = false;
    this.half = false;
    this.carry = carry;
    this.ticks += ticks;
  }

  rrc(register: Register8Bit, ticks = 2) {
    const value = this.registers[register];
    const carry = Boolean(value & 1);
    const result = (value >> 1) + (carry ? 0x80 : 0);
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = false;
    this.half = false;
    this.carry = carry;
    this.ticks += ticks;
  }

  rla() {
    const carry = Boolean(this.registers.a & 0x80);
    this.registers.a =
      ((this.registers.a << 1) & 0xff) + (this.carry ? 0x1 : 0);
    this.zero = false;
    this.subtraction = false;
    this.half = false;
    this.carry = carry;
    this.ticks += 1;
  }

  rl(register: Register8Bit, ticks = 2) {
    const value = this.registers[register];
    const carry = Boolean(value & 0x80);
    const result = ((value << 1) & 0xff) + (this.carry ? 0x1 : 0);
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = false;
    this.half = false;
    this.carry = carry;
    this.ticks += ticks;
  }

  rra() {
    const carry = Boolean(this.registers.a & 1);
    this.registers.a = (this.registers.a >> 1) + (this.carry ? 0x80 : 0);
    this.zero = false;
    this.subtraction = false;
    this.half = false;
    this.carry = carry;
    this.ticks += 1;
  }

  rr(register: Register8Bit, ticks = 2) {
    const value = this.registers[register];
    const carry = Boolean(value & 1);
    const result = (value >> 1) + (this.carry ? 0x80 : 0);
    this.registers[register] = result;
    this.zero = result === 0;
    this.subtraction = false;
    this.half = false;
    this.carry = carry;
    this.ticks += ticks;
  }

  rrca() {
    const carry = Boolean(this.registers.a & 1);
    this.registers.a = (this.registers.a >> 1) + (carry ? 0x80 : 0);
    this.zero = false;
    this.subtraction = false;
    this.half = false;
    this.carry = carry;
    this.ticks += 1;
  }
}
