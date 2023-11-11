/** @jest-environment jsdom */

import PPU, { Mode } from '../../src/graphics/ppu';
import { Interrupts } from '../../src/cpu/interrupts';
import ExternalMemory from '../../src/memory/externalMemory';
import MMU from '../../src/memory/mmu';
import { GRAPHICS_REGISTERS } from '../../src/graphics/constants';
import MOCK_ROM from '../mocks/rom';
import Canvas from '../mocks/Canvas';
import MockIO from '../mocks/MockIO';

describe('PPU', () => {
  const canvas = new Canvas();
  const externalMemory = new ExternalMemory(MOCK_ROM);
  const mmu = new MMU();
  mmu.apu = new MockIO();
  mmu.timer = new MockIO();
  mmu.input = new MockIO();
  mmu.externalMemory = externalMemory;
  const ppu = new PPU(canvas);
  mmu.ppu = ppu;
  ppu.mmu = mmu;

  describe('VRAM', () => {
    test('reads and writes to VRAM', () => {
      mmu.write(0x8000, 0x0a);
      expect(ppu.vram[0]).toEqual(0x0a);
      expect(ppu.read(0x8000)).toEqual(0x0a);
    });
  });

  describe('registers', () => {
    describe('LCDC', () => {
      test('defaults flags to off', () => {
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x00);
      });

      test('enables', () => {
        ppu.write(GRAPHICS_REGISTERS.LCDC, 0x80);
        expect(ppu.enabled).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x80);
      });

      test('disables', () => {
        ppu.write(GRAPHICS_REGISTERS.LCDC, 0x00);
        expect(ppu.enabled).toBe(false);
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x00);
      });

      test('sets the window tile map area flag', () => {
        expect(ppu.windowTileMapAreaFlag).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.LCDC, 0x40);
        expect(ppu.windowTileMapAreaFlag).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x40);
      });

      test('enables the window', () => {
        expect(ppu.windowEnabled).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.LCDC, 0x20);
        expect(ppu.windowEnabled).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x20);
      });

      test('sets the tile data area flag', () => {
        expect(ppu.tileDataAreaFlag).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.LCDC, 0x10);
        expect(ppu.tileDataAreaFlag).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x10);
      });

      test('sets the background tile map area flag', () => {
        expect(ppu.backgroundTileMapAreaFlag).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.LCDC, 0x08);
        expect(ppu.backgroundTileMapAreaFlag).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x08);
      });

      test('sets the object size flag', () => {
        expect(ppu.objectSizeFlag).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.LCDC, 0x04);
        expect(ppu.objectSizeFlag).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x04);
      });

      test('enables objects', () => {
        expect(ppu.objectsEnabled).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.LCDC, 0x02);
        expect(ppu.objectsEnabled).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x02);
      });

      test('enables background and window', () => {
        expect(ppu.backgroundWindowEnabled).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.LCDC, 0x01);
        expect(ppu.backgroundWindowEnabled).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x01);
      });
    });

    describe('STAT', () => {
      test('defaults flags to off and LYC = LY to true', () => {
        expect(ppu.read(GRAPHICS_REGISTERS.STAT)).toEqual(0x84);
      });

      test('enables LYC interrupts', () => {
        expect(ppu.lycInterruptsEnabled).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.STAT, 0x40);
        expect(ppu.lycInterruptsEnabled).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x40).toEqual(0x40);
      });

      test('enables OAM STAT interrupts', () => {
        expect(ppu.oamStatInterruptsEnabled).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.STAT, 0x20);
        expect(ppu.oamStatInterruptsEnabled).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x20).toEqual(0x20);
      });

      test('enables VBLANK STAT interrupts', () => {
        expect(ppu.verticalBlankStatInterruptsEnabled).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.STAT, 0x10);
        expect(ppu.verticalBlankStatInterruptsEnabled).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x10).toEqual(0x10);
      });

      test('enables HBLANK STAT interrupts', () => {
        expect(ppu.horizontalBlankStatInterruptsEnabled).toBe(false);
        ppu.write(GRAPHICS_REGISTERS.STAT, 0x08);
        expect(ppu.horizontalBlankStatInterruptsEnabled).toBe(true);
        expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x08).toEqual(0x08);
      });

      describe('LYC=LY flag', () => {
        test('is set when LYC = LY', () => {
          ppu.write(GRAPHICS_REGISTERS.LYC, 0);
          expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x04).toEqual(0x04);
        });

        test('is cleared when LYC != LY', () => {
          ppu.write(GRAPHICS_REGISTERS.LYC, 1);
          expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x04).toEqual(0x00);
        });
      });

      describe('mode', () => {
        test('HBLANK', () => {
          ppu.mode = Mode.HORIZONTAL_BLANK;
          expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x03).toEqual(0x00);
        });

        test('VBLANK', () => {
          ppu.mode = Mode.VERTICAL_BLANK;
          expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x03).toEqual(0x01);
        });

        test('OAM', () => {
          ppu.mode = Mode.OAM_SCAN;
          expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x03).toEqual(0x02);
        });

        test('VRAM', () => {
          ppu.mode = Mode.RENDER;
          expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x03).toEqual(0x03);
        });
      });
    });

    describe('SCY', () => {
      test('defaults to zero', () => {
        expect(ppu.scy).toEqual(0);
        expect(ppu.read(GRAPHICS_REGISTERS.SCY)).toEqual(0x00);
      });

      test('read and write', () => {
        ppu.write(GRAPHICS_REGISTERS.SCY, 0x08);
        expect(ppu.scy).toEqual(8);
        expect(ppu.read(GRAPHICS_REGISTERS.SCY)).toEqual(0x08);
      });
    });

    describe('SCX', () => {
      test('defaults to zero', () => {
        expect(ppu.scx).toEqual(0);
        expect(ppu.read(GRAPHICS_REGISTERS.SCX)).toEqual(0x00);
      });

      test('read and write', () => {
        ppu.write(GRAPHICS_REGISTERS.SCX, 0x08);
        expect(ppu.scx).toEqual(8);
        expect(ppu.read(GRAPHICS_REGISTERS.SCX)).toEqual(0x08);
      });
    });

    describe('LY', () => {
      test('defaults to zero', () => {
        expect(ppu.ly).toEqual(0);
        expect(ppu.read(GRAPHICS_REGISTERS.LY)).toEqual(0x00);
      });

      test('read', () => {
        ppu.ly = 7;
        expect(ppu.read(GRAPHICS_REGISTERS.LY)).toEqual(0x07);
      });

      test('read only', () => {
        ppu.ly = 7;
        ppu.write(GRAPHICS_REGISTERS.LY, 0x08);
        expect(ppu.read(GRAPHICS_REGISTERS.LY)).toEqual(0x07);
      });
    });

    describe('LYC', () => {
      test('read and write', () => {
        ppu.write(GRAPHICS_REGISTERS.LYC, 0x08);
        expect(ppu.lyc).toEqual(8);
        expect(ppu.read(GRAPHICS_REGISTERS.LYC)).toEqual(0x08);
      });
    });

    test('DMA', () => {
      jest.spyOn(mmu, 'dma');
      ppu.write(GRAPHICS_REGISTERS.DMA, 0x01);
      expect(mmu.dma).toHaveBeenCalledTimes(1);
      expect(ppu.read(GRAPHICS_REGISTERS.DMA)).toEqual(0x01);
    });

    describe('BGP', () => {
      test('read and write', () => {
        ppu.write(GRAPHICS_REGISTERS.BGP, 0x1b);
        expect(ppu.backgroundPalette).toEqual([3, 2, 1, 0]);
        expect(ppu.read(GRAPHICS_REGISTERS.BGP)).toEqual(0x1b);
      });
    });

    describe('OBP0', () => {
      test('read and write', () => {
        ppu.write(GRAPHICS_REGISTERS.OBP0, 0x18);
        expect(ppu.objectPalette0).toEqual([0, 2, 1, 0]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP0)).toEqual(0x18);
      });

      test('ignores lower two bits', () => {
        ppu.write(GRAPHICS_REGISTERS.OBP0, 0x1b);
        expect(ppu.objectPalette0).toEqual([0, 2, 1, 0]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP0)).toEqual(0x18);
      });
    });

    describe('OBP1', () => {
      test('read and write', () => {
        ppu.write(GRAPHICS_REGISTERS.OBP1, 0x18);
        expect(ppu.objectPalette1).toEqual([0, 2, 1, 0]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP1)).toEqual(0x18);
      });

      test('ignores lower two bits', () => {
        ppu.write(GRAPHICS_REGISTERS.OBP1, 0x1b);
        expect(ppu.objectPalette1).toEqual([0, 2, 1, 0]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP1)).toEqual(0x18);
      });
    });

    describe('WY', () => {
      test('defaults to zero', () => {
        expect(ppu.wy).toEqual(0);
        expect(ppu.read(GRAPHICS_REGISTERS.WY)).toEqual(0x00);
      });

      test('read and write', () => {
        ppu.write(GRAPHICS_REGISTERS.WY, 0x08);
        expect(ppu.wy).toEqual(8);
        expect(ppu.read(GRAPHICS_REGISTERS.WY)).toEqual(0x08);
      });
    });

    describe('WX', () => {
      test('defaults to zero', () => {
        expect(ppu.wx).toEqual(0);
        expect(ppu.read(GRAPHICS_REGISTERS.WX)).toEqual(0x00);
      });

      test('read and write', () => {
        ppu.write(GRAPHICS_REGISTERS.WX, 0x08);
        expect(ppu.wx).toEqual(8);
        expect(ppu.read(GRAPHICS_REGISTERS.WX)).toEqual(0x08);
      });
    });

    test('returns 0xff for other addresses', () => {
      expect(ppu.read(0xff4c)).toEqual(0xff);
    });
  });

  describe('modes', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.spyOn(mmu, 'requestInterrupt');
      ppu.enabled = true;
      ppu.objectsEnabled = true;
      ppu.windowEnabled = true;
      ppu.backgroundWindowEnabled = true;
    });

    test('steps the clock', () => {
      expect(ppu.clock).toEqual(0);
      ppu.step(2);
      expect(ppu.clock).toEqual(2);
      ppu.step(3);
      expect(ppu.clock).toEqual(5);
    });

    describe('horizontal blank mode', () => {
      test('enters mode', () => {
        ppu.horizontalBlankMode();
        expect(ppu.mode).toEqual(Mode.HORIZONTAL_BLANK);
      });

      test('requests an LCD STAT interrupt if relevant flag is set', () => {
        ppu.horizontalBlankStatInterruptsEnabled = true;
        ppu.horizontalBlankMode();
        expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.LCD_STAT);
      });

      test('does not request an LCD STAT interrupt if flag is clear', () => {
        ppu.horizontalBlankStatInterruptsEnabled = false;
        ppu.horizontalBlankMode();
        expect(mmu.requestInterrupt).not.toHaveBeenCalledWith(
          Interrupts.LCD_STAT
        );
      });

      test('transitions to OAM scan mode after 51 cycles if LY < 143', () => {
        ppu.ly = 10;
        ppu.horizontalBlankMode();
        ppu.step(50);
        expect(ppu.mode).toEqual(Mode.HORIZONTAL_BLANK);
        ppu.step(1);
        expect(ppu.mode).toEqual(Mode.OAM_SCAN);
      });

      test('transitions to vertical blank mode after 51 cycles if LY = 143', () => {
        ppu.ly = 143;
        ppu.horizontalBlankMode();
        ppu.step(50);
        expect(ppu.mode).toEqual(Mode.HORIZONTAL_BLANK);
        ppu.step(1);
        expect(ppu.mode).toEqual(Mode.VERTICAL_BLANK);
      });

      test('requests an LCD STAT interrupt if LYC = LY and the flag is set', () => {
        ppu.ly = 10;
        ppu.lyc = 11;
        ppu.lycInterruptsEnabled = true;
        ppu.horizontalBlankMode();
        ppu.step(51);
        expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.LCD_STAT);
      });

      test('does not request an LCD STAT interrupt if LYC = LY but the flag is clear', () => {
        ppu.ly = 10;
        ppu.lyc = 11;
        ppu.lycInterruptsEnabled = false;
        ppu.horizontalBlankMode();
        ppu.step(51);
        expect(mmu.requestInterrupt).not.toHaveBeenCalled();
      });
    });

    describe('vertical blank mode', () => {
      test('enters mode', () => {
        ppu.verticalBlankMode();
        expect(ppu.mode).toEqual(Mode.VERTICAL_BLANK);
      });

      test('requests an LCD STAT interrupt if relevant flag is set', () => {
        ppu.verticalBlankStatInterruptsEnabled = true;
        ppu.verticalBlankMode();
        expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.LCD_STAT);
      });

      test('does not request an LCD STAT interrupt if flag is clear', () => {
        ppu.verticalBlankStatInterruptsEnabled = false;
        ppu.verticalBlankMode();
        expect(mmu.requestInterrupt).not.toHaveBeenCalledWith(
          Interrupts.LCD_STAT
        );
      });

      test('requests a VBLANK interrupt', () => {
        ppu.verticalBlankStatInterruptsEnabled = true;
        ppu.verticalBlankMode();
        expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.VBLANK);
      });

      test('transitions to OAM scan mode after 1140 cycles', () => {
        ppu.ly = 144;
        ppu.verticalBlankMode();
        for (let i = 0; i < 10; i++) {
          expect(ppu.mode).toEqual(Mode.VERTICAL_BLANK);
          ppu.step(114);
        }
        expect(ppu.mode).toEqual(Mode.OAM_SCAN);
      });
    });

    describe('OAM scan mode', () => {
      test('enters mode', () => {
        ppu.oamScanMode();
        expect(ppu.mode).toEqual(Mode.OAM_SCAN);
      });

      test('requests an LCD STAT interrupt if relevant flag is set', () => {
        ppu.oamStatInterruptsEnabled = true;
        ppu.oamScanMode();
        expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.LCD_STAT);
      });

      test('does not request an LCD STAT interrupt if flag is clear', () => {
        ppu.oamStatInterruptsEnabled = false;
        ppu.oamScanMode();
        expect(mmu.requestInterrupt).not.toHaveBeenCalledWith(
          Interrupts.LCD_STAT
        );
      });

      test('transitions to render mode after 20 cycles', () => {
        ppu.oamScanMode();
        ppu.step(19);
        expect(ppu.mode).toEqual(Mode.OAM_SCAN);
        ppu.step(1);
        expect(ppu.mode).toEqual(Mode.RENDER);
      });
    });

    describe('render mode', () => {
      test('enters mode', () => {
        ppu.renderMode();
        expect(ppu.mode).toEqual(Mode.RENDER);
      });

      test('transitions to horizontal blank mode after 43 cycles', () => {
        ppu.renderMode();
        ppu.step(42);
        expect(ppu.mode).toEqual(Mode.RENDER);
        ppu.step(1);
        expect(ppu.mode).toEqual(Mode.HORIZONTAL_BLANK);
      });
    });
  });
});
