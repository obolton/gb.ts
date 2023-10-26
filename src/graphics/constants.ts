export const SCREEN_WIDTH = 160;
export const SCREEN_HEIGHT = 144;

export const VRAM_BANK_SIZE = 0x2000;

export const COLOR_MAP = [0xff, 0xc0, 0x60, 0x00];

export const GRAPHICS_REGISTERS = {
  LCDC: 0xff40,
  STAT: 0xff41,
  SCY: 0xff42,
  SCX: 0xff43,
  LY: 0xff44,
  LYC: 0xff45,
  DMA: 0xff46,
  BGP: 0xff47,
  OBP0: 0xff48,
  OBP1: 0xff49,
  WY: 0xff4a,
  WX: 0xff4b,
};
