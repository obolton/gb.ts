import { beforeEach, describe, expect, test, vi } from 'vitest';
import GameBoy from '../src/gb';
import AudioContext from './mocks/AudioContext';
import Canvas from './mocks/Canvas';
import MOCK_ROM from './mocks/rom';

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
    test('runs the CPU and marks the system as running', () => {
      const run = vi.spyOn(gameboy.cpu, 'run');
      gameboy.start(MOCK_ROM);
      expect(gameboy.running).toBe(true);
      expect(run).toHaveBeenCalledTimes(1);
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
