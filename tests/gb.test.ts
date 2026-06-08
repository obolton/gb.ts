import { beforeEach, describe, expect, test, vi } from 'vitest';
import GameBoy from '../src/gb';
import AudioContext from './mocks/AudioContext';
import Canvas from './mocks/Canvas';
import MOCK_ROM from './mocks/rom';
import { Button } from '../src/input/constants';

globalThis.AudioContext = AudioContext;

vi.useFakeTimers();

describe('GameBoy', () => {
  const canvas = new Canvas();
  let gameboy: GameBoy;

  beforeEach(() => {
    gameboy = new GameBoy(canvas);
  });

  describe('wiring', () => {
    test('connects the MMU to each subsystem', () => {
      expect(gameboy.mmu.apu).toBe(gameboy.apu);
      expect(gameboy.mmu.ppu).toBe(gameboy.ppu);
      expect(gameboy.mmu.timer).toBe(gameboy.timer);
      expect(gameboy.mmu.input).toBe(gameboy.input);
      expect(gameboy.mmu.serial).toBe(gameboy.serial);
    });

    test('connects the timer to the APU', () => {
      expect(gameboy.timer.apu).toBe(gameboy.apu);
    });
  });

  describe('start', () => {
    test('starts the scheduler and marks the system as running', () => {
      const start = vi.spyOn(gameboy.scheduler, 'start');
      gameboy.start(MOCK_ROM);
      expect(gameboy.running).toBe(true);
      expect(start).toHaveBeenCalledTimes(1);
    });

    test('configures CGB mode from the ROM header', () => {
      gameboy.start(MOCK_ROM);
      expect(gameboy.cgbMode).toBe(false);
      expect(gameboy.ppu.cgbMode).toBe(false);
      expect(gameboy.serial.cgbMode).toBe(false);
    });

    test('throws if already running', () => {
      gameboy.start(MOCK_ROM);
      expect(() => gameboy.start(MOCK_ROM)).toThrow('Already running');
    });
  });

  describe('stop', () => {
    test('marks the system as not running', () => {
      gameboy.start(MOCK_ROM);
      gameboy.stop();
      expect(gameboy.running).toBe(false);
    });

    test('resets the subsystems', () => {
      const reset = vi.spyOn(gameboy.apu, 'reset');
      gameboy.start(MOCK_ROM);
      gameboy.stop();
      expect(reset).toHaveBeenCalled();
    });
  });

  describe('scheduling', () => {
    test('pauses the scheduler when the CPU enters a low-power STOP', () => {
      gameboy.start(MOCK_ROM);
      const pause = vi.spyOn(gameboy.scheduler, 'pause');
      gameboy.cpu.stop();
      expect(pause).toHaveBeenCalled();
    });

    test('resumes the scheduler on a joypad press', () => {
      gameboy.start(MOCK_ROM);
      const resume = vi.spyOn(gameboy.scheduler, 'resume');
      gameboy.input.selectActionButtons = true;
      gameboy.input.buttonDown(Button.A);
      expect(resume).toHaveBeenCalled();
    });
  });

  describe('visibility', () => {
    test('suspends audio when the tab is hidden', () => {
      gameboy.start(MOCK_ROM);
      const suspend = vi.spyOn(gameboy.apu, 'suspend');
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(suspend).toHaveBeenCalled();
    });

    test('resumes audio and resyncs the scheduler when the tab is shown', () => {
      gameboy.start(MOCK_ROM);
      const resume = vi.spyOn(gameboy.apu, 'resume');
      const resync = vi.spyOn(gameboy.scheduler, 'resync');
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(resume).toHaveBeenCalled();
      expect(resync).toHaveBeenCalled();
    });

    test('ignores non-visibilitychange events', () => {
      const suspend = vi.spyOn(gameboy.apu, 'suspend');
      const resume = vi.spyOn(gameboy.apu, 'resume');
      gameboy.handleEvent(new Event('click'));
      expect(suspend).not.toHaveBeenCalled();
      expect(resume).not.toHaveBeenCalled();
    });
  });

  describe('game title', () => {
    test('is undefined before a ROM is started', () => {
      expect(gameboy.getGameTitle()).toBeUndefined();
    });

    test('reflects the loaded ROM', () => {
      gameboy.start(MOCK_ROM);
      expect(typeof gameboy.getGameTitle()).toBe('string');
    });
  });
});
