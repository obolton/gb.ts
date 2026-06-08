import { describe, expect, test, vi } from 'vitest';
import Timer from '../../src/timer/timer';
import { TIMA_BITS, TIMER_REGISTERS } from '../../src/timer/constants';
import APU from '../../src/audio/apu';
import MMU from '../../src/memory/mmu';
import ExternalMemory from '../../src/memory/externalMemory';
import MOCK_ROM from '../mocks/rom';

vi.mock('../../src/audio/apu');

describe('Timer', () => {
  test('initializes registers with expected values', () => {
    const timer = new Timer();
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x00);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x00);
    expect(timer.read(TIMER_REGISTERS.TMA)).toEqual(0x00);
    expect(timer.read(TIMER_REGISTERS.TAC)).toEqual(0xf8);
  });

  test('returns 0xff for other addresses', () => {
    const timer = new Timer();
    expect(timer.read(0xff03)).toEqual(0xff);
  });

  test('steps the DIV timer', () => {
    const timer = new Timer();
    timer.step(2);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x00);
    timer.step(60);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x00);
    timer.step(2);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x01);
    timer.step(64);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x02);
    timer.step(150);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x04);
  });

  test('clears the DIV register on write', () => {
    const timer = new Timer();
    timer.step(128);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x02);
    timer.write(TIMER_REGISTERS.DIV, 0x0a);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x00);
  });

  test('increments TIMA when DIV reset drops the selected timer bit', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TAC, 0x05);
    timer.step(2);
    timer.write(TIMER_REGISTERS.DIV, 0x00);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x01);
  });

  test('steps the APU when DIV reset drops the frame sequencer bit', () => {
    const timer = new Timer();
    const apu = { step: vi.fn<() => void>() };
    timer.apu = apu as unknown as APU;

    timer.step(1024);
    timer.write(TIMER_REGISTERS.DIV, 0x00);

    expect(apu.step).toHaveBeenCalledTimes(1);
  });

  test('uses frame sequencer bit 13 to step the APU in double-speed mode', () => {
    const timer = new Timer();
    const mmu = new MMU();
    mmu.speed = 0x80; // double speed
    timer.mmu = mmu;

    const apu = new APU();
    const step = vi.spyOn(apu, 'step');
    timer.apu = apu;

    timer.step(2048); // counter reaches bit 13 (0x2000)
    timer.write(TIMER_REGISTERS.DIV, 0x00); // reset drops bit 13

    expect(step).toHaveBeenCalledTimes(1);
  });

  test('writes to the TIMA register', () => {
    const timer = new Timer();
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x00);
    timer.write(TIMER_REGISTERS.TIMA, 0x0a);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x0a);
  });

  test('writes to the TMA register', () => {
    const timer = new Timer();
    expect(timer.read(TIMER_REGISTERS.TMA)).toEqual(0x00);
    timer.write(TIMER_REGISTERS.TMA, 0x0a);
    expect(timer.read(TIMER_REGISTERS.TMA)).toEqual(0x0a);
  });

  test('writes to the TAC register', () => {
    const timer = new Timer();
    expect(timer.read(TIMER_REGISTERS.TAC)).toEqual(0xf8);
    timer.write(TIMER_REGISTERS.TAC, 0x06);
    expect(timer.read(TIMER_REGISTERS.TAC)).toEqual(0xfe);
  });

  test('increments TIMA when TAC disables a high selected timer bit', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TAC, 0x05);
    timer.step(2);
    timer.write(TIMER_REGISTERS.TAC, 0x00);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x01);
  });

  test('increments TIMA when TAC switches from a high bit to a low bit', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TAC, 0x05);
    timer.step(2);
    timer.write(TIMER_REGISTERS.TAC, 0x06);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x01);
  });

  // Each selected counter bit b falls every 2^(b+1) T-cycles = 2^(b-1) M-cycles.
  test.each(TIMA_BITS.map((bit, mode) => [1 << (bit - 1), mode]))(
    'steps the TIMA register every %i M-cycles',
    (period, mode) => {
      const timer = new Timer();
      timer.write(TIMER_REGISTERS.TAC, 0x04 | mode);
      timer.step(period - 1);
      expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x00);
      timer.step(1);
      expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x01);
      timer.step(period);
      expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x02);
      timer.step(period * 2);
      expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x04);
    }
  );

  test('does not step the TIMA register when disabled', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TAC, 0x00);
    timer.step(1000);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x00);
  });

  test('reloads TIMA from TMA one M-cycle after it overflows', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TIMA, 0xff);
    timer.write(TIMER_REGISTERS.TMA, 0x0f);
    timer.write(TIMER_REGISTERS.TAC, 0x04);
    timer.step(256);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x00);
    timer.step(1);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x0f);
  });

  test('requests a timer interrupt one M-cycle after TIMA overflows', () => {
    const timer = new Timer();
    const mmu = new MMU();
    mmu.externalMemory = new ExternalMemory(MOCK_ROM);
    vi.spyOn(mmu, 'requestInterrupt');
    timer.mmu = mmu;
    timer.write(TIMER_REGISTERS.TIMA, 0xff);
    timer.write(TIMER_REGISTERS.TAC, 0x04);
    expect(mmu.requestInterrupt).not.toHaveBeenCalled();
    timer.step(256);
    expect(mmu.requestInterrupt).not.toHaveBeenCalled();
    timer.step(1);
    expect(mmu.requestInterrupt).toHaveBeenCalledWith({
      flag: 0x04,
      handlerAddress: 0x50,
    });
  });

  test('cancels a pending overflow reload when TIMA is written during the delay', () => {
    const timer = new Timer();
    const mmu = new MMU();
    mmu.externalMemory = new ExternalMemory(MOCK_ROM);
    vi.spyOn(mmu, 'requestInterrupt');
    timer.mmu = mmu;

    timer.write(TIMER_REGISTERS.TIMA, 0xff);
    timer.write(TIMER_REGISTERS.TMA, 0x0f);
    timer.write(TIMER_REGISTERS.TAC, 0x04);
    timer.step(256);
    timer.write(TIMER_REGISTERS.TIMA, 0x42);
    timer.step(1);

    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x42);
    expect(mmu.requestInterrupt).not.toHaveBeenCalled();
  });

  test('ignores TIMA writes during the reload cycle', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TIMA, 0xff);
    timer.write(TIMER_REGISTERS.TMA, 0x0f);
    timer.write(TIMER_REGISTERS.TAC, 0x04);
    timer.step(257);
    timer.write(TIMER_REGISTERS.TIMA, 0x42);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x0f);
  });

  test('copies TMA writes to TIMA during the reload cycle', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TIMA, 0xff);
    timer.write(TIMER_REGISTERS.TMA, 0x0f);
    timer.write(TIMER_REGISTERS.TAC, 0x04);
    timer.step(257);
    timer.write(TIMER_REGISTERS.TMA, 0x42);
    expect(timer.read(TIMER_REGISTERS.TMA)).toEqual(0x42);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x42);
  });

  test('does not advance while stopped', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TAC, 0x05);
    timer.step(2);
    timer.stop();

    const div = timer.read(TIMER_REGISTERS.DIV);
    const tima = timer.read(TIMER_REGISTERS.TIMA);
    timer.step(1000);

    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(div);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(tima);

    timer.resume();
    timer.step(64);
    expect(timer.read(TIMER_REGISTERS.DIV)).not.toEqual(div);
  });

  test('resets the divider when stopped', () => {
    const timer = new Timer();
    timer.step(64);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x01);
    timer.stop();
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x00);
  });

  test('resets the divider and keeps running on a speed switch', () => {
    const timer = new Timer();
    timer.step(64);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x01);

    timer.speedSwitch();
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x00);

    timer.step(64);
    expect(timer.read(TIMER_REGISTERS.DIV)).toEqual(0x01);
  });
});
