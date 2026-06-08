/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import PPU, { Mode } from '../../src/graphics/ppu';
import { Interrupts } from '../../src/cpu/interrupts';
import ExternalMemory from '../../src/memory/externalMemory';
import MMU from '../../src/memory/mmu';
import { GRAPHICS_REGISTERS, SCREEN_WIDTH, COLOR_MAP } from '../../src/graphics/constants';
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
      test('defaults to LCD enabled with other flags off', () => {
        expect(ppu.read(GRAPHICS_REGISTERS.LCDC)).toEqual(0x80);
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
      vi.spyOn(mmu, 'dma');
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
        expect(ppu.objectPalette0Colors).toEqual([0, 2, 1, 0]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP0)).toEqual(0x18);
      });

      test('keeps lower two bits readable while color 0 remains transparent', () => {
        ppu.write(GRAPHICS_REGISTERS.OBP0, 0x1b);
        expect(ppu.objectPalette0Colors).toEqual([0, 2, 1, 0]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP0)).toEqual(0x1b);
      });

      test('reads back 0xff even though color 0 is transparent', () => {
        ppu.write(GRAPHICS_REGISTERS.OBP0, 0xff);
        expect(ppu.objectPalette0Colors).toEqual([0, 3, 3, 3]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP0)).toEqual(0xff);
      });
    });

    describe('OBP1', () => {
      test('read and write', () => {
        ppu.write(GRAPHICS_REGISTERS.OBP1, 0x18);
        expect(ppu.objectPalette1Colors).toEqual([0, 2, 1, 0]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP1)).toEqual(0x18);
      });

      test('keeps lower two bits readable while color 0 remains transparent', () => {
        ppu.write(GRAPHICS_REGISTERS.OBP1, 0x1b);
        expect(ppu.objectPalette1Colors).toEqual([0, 2, 1, 0]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP1)).toEqual(0x1b);
      });

      test('reads back 0xff even though color 0 is transparent', () => {
        ppu.write(GRAPHICS_REGISTERS.OBP1, 0xff);
        expect(ppu.objectPalette1Colors).toEqual([0, 3, 3, 3]);
        expect(ppu.read(GRAPHICS_REGISTERS.OBP1)).toEqual(0xff);
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

    describe('DMA', () => {
      test('stores the source and triggers an OAM DMA', () => {
        const dma = vi.spyOn(mmu, 'dma').mockImplementation(() => {});
        ppu.write(GRAPHICS_REGISTERS.DMA, 0xc0);
        expect(ppu.read(GRAPHICS_REGISTERS.DMA)).toEqual(0xc0);
        expect(dma).toHaveBeenCalledWith(0xc0);
        dma.mockRestore();
      });
    });

    describe('VBK', () => {
      beforeEach(() => {
        ppu.cgbMode = true;
      });

      afterEach(() => {
        ppu.cgbMode = false;
      });

      test('reads the VRAM bank with the unused bits set', () => {
        ppu.vramBank = 1;
        expect(ppu.read(GRAPHICS_REGISTERS.VBK)).toEqual(0xff);
        ppu.vramBank = 0;
        expect(ppu.read(GRAPHICS_REGISTERS.VBK)).toEqual(0xfe);
      });

      test('selects the VRAM bank', () => {
        ppu.write(GRAPHICS_REGISTERS.VBK, 0x01);
        expect(ppu.vramBank).toEqual(1);
      });

      test('is ignored outside CGB mode', () => {
        ppu.cgbMode = false;
        ppu.vramBank = 0;
        ppu.write(GRAPHICS_REGISTERS.VBK, 0x01);
        expect(ppu.vramBank).toEqual(0);
      });
    });

    describe('BCPS', () => {
      beforeEach(() => {
        ppu.cgbMode = true;
      });

      afterEach(() => {
        ppu.cgbMode = false;
      });

      test('reads the index and auto-increment flag', () => {
        ppu.backgroundPaletteIndex = 0x05;
        ppu.incrementBackgroundPaletteIndex = true;
        expect(ppu.read(GRAPHICS_REGISTERS.BCPS)).toEqual(0x80 | 0x40 | 0x05);
        ppu.incrementBackgroundPaletteIndex = false;
        expect(ppu.read(GRAPHICS_REGISTERS.BCPS)).toEqual(0x40 | 0x05);
      });

      test('sets the index and auto-increment flag', () => {
        ppu.write(GRAPHICS_REGISTERS.BCPS, 0x80 | 0x10);
        expect(ppu.backgroundPaletteIndex).toEqual(0x10);
        expect(ppu.incrementBackgroundPaletteIndex).toBe(true);
      });

      test('is ignored outside CGB mode', () => {
        ppu.cgbMode = false;
        ppu.backgroundPaletteIndex = 0x20;
        ppu.write(GRAPHICS_REGISTERS.BCPS, 0x05);
        expect(ppu.backgroundPaletteIndex).toEqual(0x20);
      });
    });

    describe('BCPD', () => {
      beforeEach(() => {
        ppu.cgbMode = true;
      });

      afterEach(() => {
        ppu.cgbMode = false;
      });

      test('reads the byte at the current palette index', () => {
        ppu.backgroundPaletteIndex = 0x02;
        ppu.colorBackgroundPalette[0x02] = 0x3c;
        expect(ppu.read(GRAPHICS_REGISTERS.BCPD)).toEqual(0x3c);
      });

      test('writes the palette byte and auto-increments the index', () => {
        ppu.write(GRAPHICS_REGISTERS.BCPS, 0x80 | 0x00); // index 0, auto-increment on
        ppu.write(GRAPHICS_REGISTERS.BCPD, 0xaa);
        expect(ppu.colorBackgroundPalette[0]).toEqual(0xaa);
        expect(ppu.backgroundPaletteIndex).toEqual(1);
      });

      test('does not advance the index when auto-increment is off', () => {
        ppu.write(GRAPHICS_REGISTERS.BCPS, 0x00); // index 0, auto-increment off
        ppu.write(GRAPHICS_REGISTERS.BCPD, 0xbb);
        expect(ppu.colorBackgroundPalette[0]).toEqual(0xbb);
        expect(ppu.backgroundPaletteIndex).toEqual(0);
      });

      test('is ignored outside CGB mode', () => {
        ppu.cgbMode = false;
        ppu.backgroundPaletteIndex = 0;
        ppu.colorBackgroundPalette[0] = 0x11;
        ppu.write(GRAPHICS_REGISTERS.BCPD, 0xcc);
        expect(ppu.colorBackgroundPalette[0]).toEqual(0x11);
      });
    });

    describe('OCPS', () => {
      beforeEach(() => {
        ppu.cgbMode = true;
      });

      afterEach(() => {
        ppu.cgbMode = false;
      });

      test('reads the index and auto-increment flag', () => {
        ppu.objectPaletteIndex = 0x06;
        ppu.incrementObjectPaletteIndex = true;
        expect(ppu.read(GRAPHICS_REGISTERS.OCPS)).toEqual(0x80 | 0x40 | 0x06);
        ppu.incrementObjectPaletteIndex = false;
        expect(ppu.read(GRAPHICS_REGISTERS.OCPS)).toEqual(0x40 | 0x06);
      });

      test('sets the index and auto-increment flag', () => {
        ppu.write(GRAPHICS_REGISTERS.OCPS, 0x80 | 0x12);
        expect(ppu.objectPaletteIndex).toEqual(0x12);
        expect(ppu.incrementObjectPaletteIndex).toBe(true);
      });

      test('is ignored outside CGB mode', () => {
        ppu.cgbMode = false;
        ppu.objectPaletteIndex = 0x20;
        ppu.write(GRAPHICS_REGISTERS.OCPS, 0x07);
        expect(ppu.objectPaletteIndex).toEqual(0x20);
      });
    });

    describe('OCPD', () => {
      beforeEach(() => {
        ppu.cgbMode = true;
      });

      afterEach(() => {
        ppu.cgbMode = false;
      });

      test('reads the byte at the current palette index', () => {
        ppu.objectPaletteIndex = 0x04;
        ppu.colorObjectPalette[0x04] = 0x77;
        expect(ppu.read(GRAPHICS_REGISTERS.OCPD)).toEqual(0x77);
      });

      test('writes the palette byte and auto-increments the index', () => {
        ppu.write(GRAPHICS_REGISTERS.OCPS, 0x80 | 0x00); // index 0, auto-increment on
        ppu.write(GRAPHICS_REGISTERS.OCPD, 0x99);
        expect(ppu.colorObjectPalette[0]).toEqual(0x99);
        expect(ppu.objectPaletteIndex).toEqual(1);
      });

      test('does not advance the index when auto-increment is off', () => {
        ppu.write(GRAPHICS_REGISTERS.OCPS, 0x00); // index 0, auto-increment off
        ppu.write(GRAPHICS_REGISTERS.OCPD, 0x88);
        expect(ppu.colorObjectPalette[0]).toEqual(0x88);
        expect(ppu.objectPaletteIndex).toEqual(0);
      });

      test('is ignored outside CGB mode', () => {
        ppu.cgbMode = false;
        ppu.objectPaletteIndex = 0;
        ppu.colorObjectPalette[0] = 0x22;
        ppu.write(GRAPHICS_REGISTERS.OCPD, 0xdd);
        expect(ppu.colorObjectPalette[0]).toEqual(0x22);
      });
    });

    describe('HDMA', () => {
      beforeEach(() => {
        ppu.cgbMode = true;
      });

      afterEach(() => {
        ppu.cgbMode = false;
      });

      test('reads back the source and destination bytes (HDMA1-4)', () => {
        ppu.vramDmaSource = 0x1234;
        ppu.vramDmaDestination = 0x5678;
        expect(ppu.read(GRAPHICS_REGISTERS.HDMA1)).toEqual(0x12);
        expect(ppu.read(GRAPHICS_REGISTERS.HDMA2)).toEqual(0x34);
        expect(ppu.read(GRAPHICS_REGISTERS.HDMA3)).toEqual(0x56);
        expect(ppu.read(GRAPHICS_REGISTERS.HDMA4)).toEqual(0x78);
      });

      test('assembles the source and destination from byte writes (HDMA1-4)', () => {
        ppu.vramDmaSource = 0;
        ppu.vramDmaDestination = 0;
        ppu.write(GRAPHICS_REGISTERS.HDMA1, 0x12);
        ppu.write(GRAPHICS_REGISTERS.HDMA2, 0x34);
        ppu.write(GRAPHICS_REGISTERS.HDMA3, 0x56);
        ppu.write(GRAPHICS_REGISTERS.HDMA4, 0x78);
        expect(ppu.vramDmaSource).toEqual(0x1234);
        expect(ppu.vramDmaDestination).toEqual(0x5678);
      });

      test('ignores source/destination writes outside CGB mode', () => {
        ppu.cgbMode = false;
        ppu.vramDmaSource = 0;
        ppu.vramDmaDestination = 0;
        ppu.write(GRAPHICS_REGISTERS.HDMA1, 0x12);
        ppu.write(GRAPHICS_REGISTERS.HDMA2, 0x34);
        ppu.write(GRAPHICS_REGISTERS.HDMA3, 0x56);
        ppu.write(GRAPHICS_REGISTERS.HDMA4, 0x78);
        expect(ppu.vramDmaSource).toEqual(0);
        expect(ppu.vramDmaDestination).toEqual(0);
      });

      test('HDMA5 reads the remaining block count during a transfer', () => {
        ppu.vramDmaLength = 4;
        ppu.vramDmaProgress = 1;
        expect(ppu.read(GRAPHICS_REGISTERS.HDMA5)).toEqual(3);
      });

      test('HDMA5 reads 0xff when no transfer is active', () => {
        ppu.vramDmaLength = 0;
        ppu.vramDmaProgress = 0;
        expect(ppu.read(GRAPHICS_REGISTERS.HDMA5)).toEqual(0xff);
      });

      test('HDMA5 starts a general-purpose transfer', () => {
        mmu.write(0xc000, 0x5a);
        ppu.vramDmaSource = 0xc000;
        ppu.vramDmaDestination = 0x8000;
        ppu.write(GRAPHICS_REGISTERS.HDMA5, 0x00); // mode 0, length 0 -> one block
        expect(ppu.vramRead(0, 0)).toEqual(0x5a);
      });

      test('HDMA5 schedules an HBlank transfer', () => {
        ppu.write(GRAPHICS_REGISTERS.HDMA5, 0x80 | 0x03); // mode 1, length 3
        expect(ppu.vramDmaLength).toEqual(4);
        expect(ppu.vramDmaProgress).toEqual(0);
      });

      test('HDMA5 is ignored outside CGB mode', () => {
        ppu.cgbMode = false;
        ppu.vramDmaLength = 0;
        ppu.write(GRAPHICS_REGISTERS.HDMA5, 0x80 | 0x03);
        expect(ppu.vramDmaLength).toEqual(0);
      });
    });

    test('returns 0xff for other addresses', () => {
      expect(ppu.read(0xff4c)).toEqual(0xff);
    });
  });

  describe('modes', () => {
    beforeEach(() => {
      vi.resetAllMocks();
      vi.spyOn(mmu, 'requestInterrupt');
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
        expect(mmu.requestInterrupt).not.toHaveBeenCalledWith(Interrupts.LCD_STAT);
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
        expect(mmu.requestInterrupt).not.toHaveBeenCalledWith(Interrupts.LCD_STAT);
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
        expect(mmu.requestInterrupt).not.toHaveBeenCalledWith(Interrupts.LCD_STAT);
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

  describe('disable', () => {
    beforeEach(() => {
      ppu.enabled = true;
      ppu.objectsEnabled = false;
      ppu.lycInterruptsEnabled = false;
      ppu.oamStatInterruptsEnabled = false;
    });

    test('sets the PPU at LY 0 in mode 0', () => {
      ppu.ly = 100;
      ppu.wly = 50;
      ppu.clock = 30;
      ppu.mode = Mode.RENDER;

      ppu.write(GRAPHICS_REGISTERS.LCDC, 0x00);

      expect(ppu.enabled).toBe(false);
      expect(ppu.ly).toEqual(0);
      expect(ppu.wly).toEqual(0);
      expect(ppu.clock).toEqual(0);
      expect(ppu.mode).toEqual(Mode.HORIZONTAL_BLANK);
    });

    test('reads LY as 0 while off', () => {
      ppu.ly = 100;
      ppu.write(GRAPHICS_REGISTERS.LCDC, 0x00);
      expect(ppu.read(GRAPHICS_REGISTERS.LY)).toEqual(0);
    });

    test('reads mode 0 from STAT while off', () => {
      ppu.mode = Mode.RENDER;
      ppu.write(GRAPHICS_REGISTERS.LCDC, 0x00);
      expect(ppu.read(GRAPHICS_REGISTERS.STAT) & 0x03).toEqual(Mode.HORIZONTAL_BLANK);
    });

    test('halts the PPU', () => {
      ppu.enabled = false;
      ppu.clock = 0;
      ppu.mode = Mode.OAM_SCAN;

      ppu.step(100);

      expect(ppu.clock).toEqual(0);
      expect(ppu.mode).toEqual(Mode.OAM_SCAN);
    });
  });

  describe('enable', () => {
    beforeEach(() => {
      ppu.enabled = true;
      ppu.objectsEnabled = false;
      ppu.lycInterruptsEnabled = false;
      ppu.oamStatInterruptsEnabled = false;
    });

    test('starts a new frame in OAM scan at LY 0', () => {
      ppu.enabled = false;
      ppu.ly = 50;
      ppu.clock = 30;

      ppu.write(GRAPHICS_REGISTERS.LCDC, 0x80);

      expect(ppu.enabled).toBe(true);
      expect(ppu.ly).toEqual(0);
      expect(ppu.clock).toEqual(0);
      expect(ppu.mode).toEqual(Mode.OAM_SCAN);
    });

    test('restarts at LY 0', () => {
      ppu.ly = 100;
      ppu.write(GRAPHICS_REGISTERS.LCDC, 0x00);
      expect(ppu.ly).toEqual(0);

      ppu.write(GRAPHICS_REGISTERS.LCDC, 0x80);
      expect(ppu.enabled).toBe(true);
      expect(ppu.ly).toEqual(0);
      expect(ppu.mode).toEqual(Mode.OAM_SCAN);
    });

    test('does not restart the frame when already enabled', () => {
      ppu.mode = Mode.RENDER;
      ppu.ly = 75;
      ppu.clock = 30;

      ppu.write(GRAPHICS_REGISTERS.LCDC, 0x81);

      expect(ppu.mode).toEqual(Mode.RENDER);
      expect(ppu.ly).toEqual(75);
      expect(ppu.clock).toEqual(30);
      expect(ppu.backgroundWindowEnabled).toBe(true);
    });
  });

  describe('reset', () => {
    test('leaves the LCD enabled', () => {
      ppu.reset();
      expect(ppu.enabled).toBe(true);
      expect(ppu.read(GRAPHICS_REGISTERS.LCDC) & 0x80).toEqual(0x80);
    });
  });

  describe('CGB', () => {
    beforeEach(() => {
      ppu.reset();
      ppu.cgbMode = true;
    });

    afterEach(() => {
      ppu.cgbMode = false;
    });

    test('fetches the tile map index from bank 0 regardless of VBK', () => {
      ppu.tileDataAreaFlag = true;

      ppu.vramWrite(0x10, 0xcd, 0);
      ppu.vramWrite(0x11, 0xab, 0);
      ppu.vramWrite(0x1800, 0x01, 0);
      ppu.vramWrite(0x1800, 0x02, 1);

      ppu.vramBank = 1;

      const [tile] = ppu.getTiles(0x9800, 0, 0, 1);
      expect(tile.data).toEqual(0xabcd);
      expect(tile.palette).toEqual(2);
    });
  });

  describe('rendering', () => {
    function clearOAM() {
      for (let i = 0; i < 0xa0; i++) {
        mmu.write(0xfe00 + i, 0);
      }
    }

    beforeEach(() => {
      ppu.reset();
      ppu.cgbMode = false;
    });

    describe('getTilePixel', () => {
      test('combines the low and high bit planes into a 2bpp color index', () => {
        // low plane (byte at lower address) = 0b10100000, high plane = 0b11000000
        const data = (0b11000000 << 8) | 0b10100000;
        expect(ppu.getTilePixel(data, 0)).toEqual(0b11);
        expect(ppu.getTilePixel(data, 1)).toEqual(0b10);
        expect(ppu.getTilePixel(data, 2)).toEqual(0b01);
        expect(ppu.getTilePixel(data, 3)).toEqual(0b00);
      });
    });

    describe('getTileAddress', () => {
      test('addresses tile data from $8000 in unsigned mode', () => {
        ppu.tileDataAreaFlag = true;
        expect(ppu.getTileAddress(0)).toEqual(0x8000);
        expect(ppu.getTileAddress(255)).toEqual(0x8000 + 255 * 16);
      });

      test('addresses tile data from $9000/$8800 in signed mode', () => {
        ppu.tileDataAreaFlag = false;
        expect(ppu.getTileAddress(0)).toEqual(0x9000);
        expect(ppu.getTileAddress(127)).toEqual(0x9000 + 127 * 16);
        expect(ppu.getTileAddress(128)).toEqual(0x8800);
        expect(ppu.getTileAddress(255)).toEqual(0x8800 + 127 * 16);
      });
    });

    describe('getTiles', () => {
      test('reads a monochrome background tile row with default attributes', () => {
        ppu.tileDataAreaFlag = true;
        // tile map entry 0 -> tile index 2
        ppu.vramWrite(0x1800, 2, 0);
        // tile 2, row 0: low plane 0xff, high plane 0x00
        ppu.vramWrite(2 * 16, 0xff, 0);
        ppu.vramWrite(2 * 16 + 1, 0x00, 0);

        const [tile] = ppu.getTiles(0x9800, 0, 0, 1);
        expect(tile.data).toEqual(0x00ff);
        expect(tile.priority).toBe(false);
        expect(tile.flipX).toBe(false);
        expect(tile.flipY).toBe(false);
        expect(tile.palette).toEqual(0);
      });

      test('returns an empty list without an MMU', () => {
        const saved = ppu.mmu;
        ppu.mmu = undefined;
        expect(ppu.getTiles(0x9800, 0, 0, 32)).toEqual([]);
        ppu.mmu = saved;
      });
    });

    describe('drawBlankScanline', () => {
      test('fills the line with color 0 in monochrome mode', () => {
        ppu.drawBlankScanline();
        expect(ppu.backgroundPixels[0]).toEqual({ color: 0, colorIndex: 0, bgPriority: false });
        expect(ppu.backgroundPixels[SCREEN_WIDTH - 1].color).toEqual(0);
      });

      test('fills the line with white in CGB mode', () => {
        ppu.cgbMode = true;
        ppu.drawBlankScanline();
        expect(ppu.backgroundPixels[0].color).toEqual(0xffff);
      });
    });

    describe('drawMonochromePixel', () => {
      test('writes a grayscale RGBA pixel from COLOR_MAP', () => {
        ppu.drawMonochromePixel(2, 1, 3);
        const offset = (1 * SCREEN_WIDTH + 2) * 4;
        expect(ppu.imageData.data[offset]).toEqual(COLOR_MAP[3]);
        expect(ppu.imageData.data[offset + 1]).toEqual(COLOR_MAP[3]);
        expect(ppu.imageData.data[offset + 2]).toEqual(COLOR_MAP[3]);
        expect(ppu.imageData.data[offset + 3]).toEqual(255);
      });
    });

    describe('drawColorPixel', () => {
      test('expands a 15-bit BGR555 color to 8-bit RGBA', () => {
        ppu.drawColorPixel(0, 0, 31 << 10); // full blue
        expect(ppu.imageData.data[0]).toEqual(0);
        expect(ppu.imageData.data[1]).toEqual(0);
        expect(ppu.imageData.data[2]).toEqual(255);
        expect(ppu.imageData.data[3]).toEqual(255);
      });
    });

    describe('getPixel', () => {
      function bg(colorIndex: number, bgPriority: boolean) {
        return { colorIndex, color: 10, bgPriority };
      }

      function obj(bgPriority: boolean) {
        return { colorIndex: 1, color: 20, bgPriority };
      }

      test('returns the background pixel when there is no object pixel', () => {
        ppu.backgroundPixels[0] = bg(2, false);
        ppu.objectPixels = [];
        expect(ppu.getPixel(0).color).toEqual(10);
      });

      test('returns the object pixel over a transparent background pixel', () => {
        ppu.backgroundWindowEnabled = true;
        ppu.backgroundPixels[0] = bg(0, false);
        ppu.objectPixels[0] = obj(false);
        expect(ppu.getPixel(0).color).toEqual(20);
      });

      test('returns the object pixel when background/window is disabled', () => {
        ppu.backgroundWindowEnabled = false;
        ppu.backgroundPixels[0] = bg(2, true);
        ppu.objectPixels[0] = obj(true);
        expect(ppu.getPixel(0).color).toEqual(20);
      });

      test('returns the object pixel when neither pixel has priority', () => {
        ppu.backgroundWindowEnabled = true;
        ppu.backgroundPixels[0] = bg(2, false);
        ppu.objectPixels[0] = obj(false);
        expect(ppu.getPixel(0).color).toEqual(20);
      });

      test('returns the background pixel when it has priority', () => {
        ppu.backgroundWindowEnabled = true;
        ppu.backgroundPixels[0] = bg(2, true);
        ppu.objectPixels[0] = obj(false);
        expect(ppu.getPixel(0).color).toEqual(10);
      });

      test('returns the background pixel when the object yields to the background', () => {
        ppu.backgroundWindowEnabled = true;
        ppu.backgroundPixels[0] = bg(2, false);
        ppu.objectPixels[0] = obj(true);
        expect(ppu.getPixel(0).color).toEqual(10);
      });
    });

    describe('drawLine', () => {
      test('renders a background line into backgroundPixels', () => {
        ppu.backgroundWindowEnabled = true;
        ppu.tileDataAreaFlag = true;
        ppu.backgroundPalette = [0, 1, 2, 3];
        // tile map entry 0 -> tile 1; tile 1 row 0 -> color index 1 across the row
        ppu.vramWrite(0x1800, 1, 0);
        ppu.vramWrite(0x10, 0xff, 0);
        ppu.vramWrite(0x11, 0x00, 0);

        ppu.drawLine();

        expect(ppu.backgroundPixels[0]).toEqual({ colorIndex: 1, color: 1, bgPriority: false });
        expect(ppu.backgroundPixels[7].colorIndex).toEqual(1);
      });

      test('renders window tiles and advances WLY when the window is active', () => {
        ppu.backgroundWindowEnabled = true;
        ppu.windowEnabled = true;
        ppu.tileDataAreaFlag = true;
        ppu.backgroundPalette = [0, 1, 2, 3];
        ppu.wx = 7; // window starts at screen x 0
        ppu.wy = 0;
        ppu.ly = 0;
        ppu.wly = 0;
        // window map entry 0 -> tile 3; tile 3 row 0 -> color index 2
        ppu.vramWrite(0x1800, 3, 0);
        ppu.vramWrite(3 * 16, 0x00, 0);
        ppu.vramWrite(3 * 16 + 1, 0xff, 0);

        ppu.drawLine();

        expect(ppu.backgroundPixels[0].colorIndex).toEqual(2);
        expect(ppu.backgroundPixels[0].color).toEqual(2);
        expect(ppu.wly).toEqual(1);
      });
    });

    describe('getObjects', () => {
      function writeObject(index: number, y: number, x: number, tile: number, attr: number) {
        const base = 0xfe00 + index * 4;
        mmu.write(base, y);
        mmu.write(base + 1, x);
        mmu.write(base + 2, tile);
        mmu.write(base + 3, attr);
      }

      beforeEach(clearOAM);

      test('collects objects intersecting the current scanline', () => {
        ppu.ly = 0;
        writeObject(0, 16, 8, 5, 0); // y 0, x 0
        const objects = ppu.getObjects();
        expect(objects.length).toEqual(1);
        expect(objects[0]).toMatchObject({ x: 0, y: 0, tile: 5, address: 0xfe00 });
      });

      test('excludes objects that do not intersect the scanline', () => {
        ppu.ly = 0;
        writeObject(0, 32, 8, 5, 0); // y 16, scanline 0 outside [16, 24)
        expect(ppu.getObjects().length).toEqual(0);
      });

      test('includes tall 8x16 objects spanning sixteen rows', () => {
        ppu.objectSizeFlag = true;
        ppu.ly = 10;
        writeObject(0, 16, 8, 0, 0); // y 0, range [0, 16) includes 10
        expect(ppu.getObjects().length).toEqual(1);
      });

      test('caps the objects per scanline at ten', () => {
        ppu.ly = 0;
        for (let i = 0; i < 12; i++) {
          writeObject(i, 16, 8 + i, 0, 0);
        }
        expect(ppu.getObjects().length).toEqual(10);
      });

      test('decodes the object attribute byte', () => {
        ppu.ly = 0;
        writeObject(0, 16, 8, 0xaa, 0xff);
        const [object] = ppu.getObjects();
        expect(object.cgbPalette).toEqual(7);
        expect(object.bank).toEqual(1);
        expect(object.paletteFlag).toBe(true);
        expect(object.flipX).toBe(true);
        expect(object.flipY).toBe(true);
        expect(object.backgroundPriority).toBe(true);
      });

      test('sorts objects by X coordinate in DMG mode', () => {
        ppu.ly = 0;
        writeObject(0, 16, 50, 0, 0); // x 42, lower address
        writeObject(1, 16, 20, 0, 0); // x 12, higher address
        const objects = ppu.getObjects();
        expect(objects[0].address).toEqual(0xfe04);
        expect(objects[1].address).toEqual(0xfe00);
      });

      test('preserves OAM order in CGB mode', () => {
        ppu.cgbMode = true;
        ppu.ly = 0;
        writeObject(0, 16, 50, 0, 0);
        writeObject(1, 16, 20, 0, 0);
        const objects = ppu.getObjects();
        expect(objects[0].address).toEqual(0xfe00);
        expect(objects[1].address).toEqual(0xfe04);
      });

      test('returns an empty list without an MMU', () => {
        const saved = ppu.mmu;
        ppu.mmu = undefined;
        expect(ppu.getObjects()).toEqual([]);
        ppu.mmu = saved;
      });
    });

    describe('drawObjects', () => {
      function placeObject(y: number, x: number, tile: number, attr: number) {
        mmu.write(0xfe00, y);
        mmu.write(0xfe01, x);
        mmu.write(0xfe02, tile);
        mmu.write(0xfe03, attr);
        ppu.objects = ppu.getObjects();
      }

      beforeEach(() => {
        clearOAM();
        ppu.objectPalette0Colors = [0, 1, 2, 3];
        ppu.objectPixels = [];
      });

      test('draws an object into objectPixels', () => {
        ppu.ly = 0;
        placeObject(16, 8, 1, 0); // y 0, x 0, tile 1
        ppu.vramWrite(0x10, 0xff, 0);
        ppu.vramWrite(0x11, 0x00, 0);

        ppu.drawObjects();

        expect(ppu.objectPixels[0]).toEqual({ colorIndex: 1, color: 1, bgPriority: false });
        expect(ppu.objectPixels[7].colorIndex).toEqual(1);
      });

      test('skips transparent object pixels', () => {
        ppu.ly = 0;
        placeObject(16, 8, 1, 0);
        ppu.vramWrite(0x10, 0x00, 0);
        ppu.vramWrite(0x11, 0x00, 0);

        ppu.drawObjects();

        expect(ppu.objectPixels[0]).toBeUndefined();
      });

      test('does not overwrite an already-drawn object pixel', () => {
        ppu.ly = 0;
        const existing = { colorIndex: 2, color: 2, bgPriority: false };
        ppu.objectPixels[0] = existing;
        placeObject(16, 8, 1, 0);
        ppu.vramWrite(0x10, 0xff, 0);
        ppu.vramWrite(0x11, 0x00, 0);

        ppu.drawObjects();

        expect(ppu.objectPixels[0]).toBe(existing);
        expect(ppu.objectPixels[1].colorIndex).toEqual(1);
      });

      test('clips object pixels off the left edge', () => {
        ppu.ly = 0;
        placeObject(16, 4, 1, 0); // x = -4
        ppu.vramWrite(0x10, 0xff, 0);
        ppu.vramWrite(0x11, 0x00, 0);

        ppu.drawObjects();

        expect(ppu.objectPixels[0].colorIndex).toEqual(1); // from k = 4
        expect(ppu.objectPixels[-1]).toBeUndefined();
      });

      test('applies horizontal flip', () => {
        ppu.ly = 0;
        placeObject(16, 8, 1, 0x20); // flipX
        ppu.vramWrite(0x10, 0x80, 0); // only the leftmost source pixel is set
        ppu.vramWrite(0x11, 0x00, 0);

        ppu.drawObjects();

        expect(ppu.objectPixels[0]).toBeUndefined();
        expect(ppu.objectPixels[7].colorIndex).toEqual(1);
      });

      test('applies vertical flip', () => {
        ppu.ly = 0;
        placeObject(16, 8, 1, 0x40); // flipY -> reads row 7
        ppu.vramWrite(0x10, 0x00, 0); // row 0 empty
        ppu.vramWrite(0x1e, 0xff, 0); // row 7 set
        ppu.vramWrite(0x1f, 0x00, 0);

        ppu.drawObjects();

        expect(ppu.objectPixels[0].colorIndex).toEqual(1);
      });

      test('selects the bottom tile of an 8x16 object below row 8', () => {
        ppu.objectSizeFlag = true;
        ppu.ly = 10;
        placeObject(16, 8, 0x10, 0); // tileY 10 -> tile index 0x11
        ppu.vramWrite(0x11 * 16 + (10 % 8) * 2, 0xff, 0);
        ppu.vramWrite(0x11 * 16 + (10 % 8) * 2 + 1, 0x00, 0);

        ppu.drawObjects();

        expect(ppu.objectPixels[0].colorIndex).toEqual(1);
      });

      test('selects the top tile of an 8x16 object above row 8', () => {
        ppu.objectSizeFlag = true;
        ppu.ly = 3;
        placeObject(16, 8, 0x11, 0); // tileY 3 -> tile index 0x10
        ppu.vramWrite(0x10 * 16 + 3 * 2, 0xff, 0);
        ppu.vramWrite(0x10 * 16 + 3 * 2 + 1, 0x00, 0);

        ppu.drawObjects();

        expect(ppu.objectPixels[0].colorIndex).toEqual(1);
      });

      test('uses the CGB object palette and VRAM bank', () => {
        ppu.cgbMode = true;
        ppu.ly = 0;
        placeObject(16, 8, 1, 0x08); // bank 1, palette 0
        ppu.vramWrite(0x10, 0xff, 1);
        ppu.vramWrite(0x11, 0x00, 1);
        ppu.colorObjectPalette[2] = 0x34;
        ppu.colorObjectPalette[3] = 0x12;

        ppu.drawObjects();

        expect(ppu.objectPixels[0].color).toEqual(0x1234);
      });
    });

    describe('renderScanline', () => {
      beforeEach(clearOAM);

      test('renders the background to imageData in monochrome mode', () => {
        ppu.backgroundWindowEnabled = true;
        ppu.objectsEnabled = true;
        ppu.tileDataAreaFlag = true;
        ppu.backgroundPalette = [0, 1, 2, 3];
        ppu.ly = 0;
        ppu.vramWrite(0x1800, 1, 0);
        ppu.vramWrite(0x10, 0xff, 0);
        ppu.vramWrite(0x11, 0x00, 0);

        ppu.renderScanline();

        expect(ppu.imageData.data[0]).toEqual(COLOR_MAP[1]);
      });

      test('renders the background to imageData in CGB mode', () => {
        ppu.cgbMode = true;
        ppu.backgroundWindowEnabled = true;
        ppu.tileDataAreaFlag = true;
        ppu.ly = 0;
        ppu.vramWrite(0x1800, 1, 0); // tile index, bank 0
        ppu.vramWrite(0x1800, 0x00, 1); // attributes, bank 1
        ppu.vramWrite(0x10, 0xff, 0);
        ppu.vramWrite(0x11, 0x00, 0);
        ppu.colorBackgroundPalette[2] = 0xff;
        ppu.colorBackgroundPalette[3] = 0x7f; // palette 0, color index 1 -> 0x7fff (white)

        ppu.renderScanline();

        expect(ppu.imageData.data[0]).toEqual(255);
        expect(ppu.imageData.data[1]).toEqual(255);
        expect(ppu.imageData.data[2]).toEqual(255);
      });

      test('draws a blank scanline when the background is disabled', () => {
        ppu.backgroundWindowEnabled = false;
        ppu.objectsEnabled = false;
        ppu.ly = 0;

        ppu.renderScanline();

        expect(ppu.imageData.data[0]).toEqual(COLOR_MAP[0]);
      });
    });

    describe('VRAM DMA', () => {
      test('runs a general-purpose (mode 0) transfer immediately', () => {
        mmu.write(0xc000, 0xaa);
        mmu.write(0xc001, 0xbb);
        ppu.vramDmaSource = 0xc000;
        ppu.vramDmaDestination = 0x8000;

        ppu.vramDma(0, 0); // (0 + 1) * 0x10 = 16 bytes

        expect(ppu.vramRead(0, 0)).toEqual(0xaa);
        expect(ppu.vramRead(1, 0)).toEqual(0xbb);
        expect(ppu.vramDmaLength).toEqual(0);
        expect(ppu.vramDmaProgress).toEqual(0);
      });

      test('schedules an HBlank (mode 1) transfer', () => {
        ppu.vramDma(1, 3);
        expect(ppu.vramDmaLength).toEqual(4);
        expect(ppu.vramDmaProgress).toEqual(0);
      });

      test('transfers one 16-byte block per hblankDma call', () => {
        for (let i = 0; i < 0x20; i++) {
          mmu.write(0xc000 + i, i);
        }
        ppu.vramDmaSource = 0xc000;
        ppu.vramDmaDestination = 0x8000;
        ppu.vramDmaProgress = 0;

        ppu.hblankDma();
        expect(ppu.vramRead(0, 0)).toEqual(0);
        expect(ppu.vramRead(15, 0)).toEqual(15);
        expect(ppu.vramDmaProgress).toEqual(1);

        ppu.hblankDma();
        expect(ppu.vramRead(16, 0)).toEqual(16);
        expect(ppu.vramDmaProgress).toEqual(2);
      });

      test('stops an hblank block at the $ffff boundary', () => {
        ppu.vramDmaSource = 0xfff0;
        ppu.vramDmaDestination = 0x9ff0;
        ppu.vramDmaProgress = 1; // source offset pushes reads past 0xffff

        ppu.hblankDma();

        expect(ppu.vramDmaProgress).toEqual(1); // returned before incrementing
      });

      test('runs a pending HBlank transfer when entering horizontal blank', () => {
        ppu.cgbMode = true;
        mmu.write(0xc000, 0xa0);
        ppu.vramDmaSource = 0xc000;
        ppu.vramDmaDestination = 0x8000;
        ppu.vramDmaProgress = 0;
        ppu.vramDmaLength = 1; // one block pending

        ppu.horizontalBlankMode();

        expect(ppu.vramRead(0, 0)).toEqual(0xa0);
        expect(ppu.vramDmaProgress).toEqual(1);
      });
    });
  });
});
