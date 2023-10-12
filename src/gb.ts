import MMU from './memory/mmu';
import CPU from './cpu/cpu';
import PPU from './graphics/ppu';
import APU from './audio/apu';
import Timer from './timer/timer';
import Input from './input/input';
import ExternalMemory from './memory/externalMemory';

export default class GameBoy {
  display: HTMLCanvasElement;
  mmu: MMU;
  cpu: CPU;
  ppu: PPU;
  apu: APU;
  timer: Timer;
  input: Input;
  externalMemory?: ExternalMemory;
  running = false;

  constructor(display: HTMLCanvasElement) {
    this.display = display;

    this.mmu = new MMU();

    this.apu = new APU();

    this.timer = new Timer();
    this.timer.apu = this.apu;
    this.timer.mmu = this.mmu;

    this.input = new Input();
    this.input.mmu = this.mmu;

    this.ppu = new PPU(this.display);
    this.ppu.mmu = this.mmu;

    this.mmu.ppu = this.ppu;
    this.mmu.apu = this.apu;
    this.mmu.timer = this.timer;
    this.mmu.input = this.input;

    this.cpu = new CPU(this.mmu);
    this.cpu.ppu = this.ppu;
    this.cpu.timer = this.timer;
  }

  start(rom: Uint8Array) {
    if (this.running) {
      throw new Error('Already running');
    }

    this.mmu.externalMemory = new ExternalMemory(rom);
    this.cpu.run();
    this.running = true;
  }

  stop() {
    this.mmu.reset();
    this.cpu.reset();
    this.timer.reset();
    this.input.reset();
    this.ppu.reset();
    this.apu.reset();
    this.running = false;
  }
}
