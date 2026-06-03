import { beforeEach, describe, expect, test, vi } from 'vitest';
import Serial from '../../src/serial/serial';
import {
  SERIAL_REGISTERS,
  SERIAL_TRANSFER_CYCLES,
  SERIAL_FAST_TRANSFER_CYCLES,
} from '../../src/serial/constants';
import { Interrupts } from '../../src/cpu/interrupts';
import MMU from '../../src/memory/mmu';
import ExternalMemory from '../../src/memory/externalMemory';
import MOCK_ROM from '../mocks/rom';

describe('Serial', () => {
  let serial: Serial;
  let mmu: MMU;

  beforeEach(() => {
    serial = new Serial();
    mmu = new MMU();
    mmu.externalMemory = new ExternalMemory(MOCK_ROM);
    vi.spyOn(mmu, 'requestInterrupt');
    serial.mmu = mmu;
  });

  test('initializes registers with expected values', () => {
    expect(serial.read(SERIAL_REGISTERS.SB)).toEqual(0x00);
    expect(serial.read(SERIAL_REGISTERS.SC)).toEqual(0x7e);
  });

  test('returns 0xff for other addresses', () => {
    expect(serial.read(0xff03)).toEqual(0xff);
  });

  test('stores the data register', () => {
    serial.write(SERIAL_REGISTERS.SB, 0x42);
    expect(serial.read(SERIAL_REGISTERS.SB)).toEqual(0x42);
  });

  test('completes an internal-clock transfer after the full duration and raises the serial interrupt', () => {
    serial.write(SERIAL_REGISTERS.SC, 0x81); // start transfer, internal clock

    serial.step(SERIAL_TRANSFER_CYCLES - 1);
    expect(serial.read(SERIAL_REGISTERS.SC) & 0x80).toEqual(0x80);
    expect(mmu.requestInterrupt).not.toHaveBeenCalled();

    serial.step(1);
    expect(serial.read(SERIAL_REGISTERS.SC) & 0x80).toEqual(0);
    expect(serial.read(SERIAL_REGISTERS.SB)).toEqual(0xff);
    expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.SERIAL);
  });

  test('does not complete an external-clock transfer on its own', () => {
    serial.write(SERIAL_REGISTERS.SC, 0x80); // start transfer, external clock

    serial.step(SERIAL_TRANSFER_CYCLES * 2);
    expect(serial.read(SERIAL_REGISTERS.SC) & 0x80).toEqual(0x80);
    expect(mmu.requestInterrupt).not.toHaveBeenCalled();
  });

  test('aborts an in-progress transfer when the start flag is cleared', () => {
    serial.write(SERIAL_REGISTERS.SC, 0x81);
    serial.step(SERIAL_TRANSFER_CYCLES - 1);
    serial.write(SERIAL_REGISTERS.SC, 0x01);

    serial.step(SERIAL_TRANSFER_CYCLES);
    expect(mmu.requestInterrupt).not.toHaveBeenCalled();
  });

  describe('CGB clock speed', () => {
    test('reads the clock-speed bit (SC bit 1) back', () => {
      serial.cgbMode = true;
      serial.write(SERIAL_REGISTERS.SC, 0x02);
      expect(serial.read(SERIAL_REGISTERS.SC)).toEqual(0x7e);
      serial.write(SERIAL_REGISTERS.SC, 0x00);
      expect(serial.read(SERIAL_REGISTERS.SC)).toEqual(0x7c);
    });

    test('completes a fast-clock transfer in the shorter duration', () => {
      serial.cgbMode = true;
      serial.write(SERIAL_REGISTERS.SC, 0x83);

      serial.step(SERIAL_FAST_TRANSFER_CYCLES - 1);
      expect(serial.read(SERIAL_REGISTERS.SC) & 0x80).toEqual(0x80);
      expect(mmu.requestInterrupt).not.toHaveBeenCalled();

      serial.step(1);
      expect(serial.read(SERIAL_REGISTERS.SC) & 0x80).toEqual(0);
      expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.SERIAL);
    });

    test('uses the normal duration when the fast-clock bit is clear', () => {
      serial.cgbMode = true;
      serial.write(SERIAL_REGISTERS.SC, 0x81);

      serial.step(SERIAL_FAST_TRANSFER_CYCLES);
      expect(mmu.requestInterrupt).not.toHaveBeenCalled();

      serial.step(SERIAL_TRANSFER_CYCLES - SERIAL_FAST_TRANSFER_CYCLES);
      expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.SERIAL);
    });

    test('is ignored on DMG, which always uses the normal duration', () => {
      serial.write(SERIAL_REGISTERS.SC, 0x83);

      serial.step(SERIAL_FAST_TRANSFER_CYCLES);
      expect(mmu.requestInterrupt).not.toHaveBeenCalled();

      serial.step(SERIAL_TRANSFER_CYCLES - SERIAL_FAST_TRANSFER_CYCLES);
      expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.SERIAL);
    });
  });
});
