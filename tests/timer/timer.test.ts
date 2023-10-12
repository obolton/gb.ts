import Timer from '../../src/timer/timer';
import { FREQUENCIES, TIMER_REGISTERS } from '../../src/timer/constants';
import MMU from '../../src/memory/mmu';
import ExternalMemory from '../../src/memory/externalMemory';
import MOCK_ROM from '../mocks/rom';

jest.mock('../../src/audio/apu');

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

  test.each(FREQUENCIES.map((frequency, mode) => [frequency, mode]))(
    'steps the TIMA register at %i cycles',
    (frequency, mode) => {
      const timer = new Timer();
      timer.write(TIMER_REGISTERS.TAC, 0x04 | mode);
      timer.step(frequency - 1);
      expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x00);
      timer.step(1);
      expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x01);
      timer.step(frequency);
      expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x02);
      timer.step(frequency * 2);
      expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x04);
    }
  );

  test('does not step the TIMA register when disabled', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TAC, 0x00);
    timer.step(1000);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x00);
  });

  test('resets TIMA to the value of TMA when it overflows', () => {
    const timer = new Timer();
    timer.write(TIMER_REGISTERS.TIMA, 0xff);
    timer.write(TIMER_REGISTERS.TMA, 0x0f);
    timer.write(TIMER_REGISTERS.TAC, 0x04);
    timer.step(256);
    expect(timer.read(TIMER_REGISTERS.TIMA)).toEqual(0x0f);
  });

  test('requests a timer interrupt when TIMA overflows', () => {
    const timer = new Timer();
    const mmu = new MMU();
    mmu.externalMemory = new ExternalMemory(MOCK_ROM);
    jest.spyOn(mmu, 'requestInterrupt');
    timer.mmu = mmu;
    timer.write(TIMER_REGISTERS.TIMA, 0xff);
    timer.write(TIMER_REGISTERS.TAC, 0x04);
    expect(mmu.requestInterrupt).not.toHaveBeenCalled();
    timer.step(256);
    expect(mmu.requestInterrupt).toHaveBeenCalledWith({
      flag: 0x04,
      handlerAddress: 0x50,
    });
  });
});
