import { Interrupts } from '../cpu/interrupts';
import MMU from '../memory/mmu';
import { MEMORY_RANGES } from '../memory/constants';
import {
  COLOR_MAP,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  GRAPHICS_REGISTERS,
  VRAM_BANK_SIZE,
} from './constants';
import { inRange } from '../utils';

export enum Mode {
  HORIZONTAL_BLANK,
  VERTICAL_BLANK,
  OAM_SCAN,
  RENDER,
}

type TileAttributes = {
  priority: boolean;
  flipY: boolean;
  flipX: boolean;
  palette: number;
  data: number;
};

type ObjectAttributes = {
  address: number;
  x: number;
  y: number;
  tile: number;
  paletteFlag: boolean;
  flipX: boolean;
  flipY: boolean;
  backgroundPriority: boolean;
  bank: number;
  cgbPalette: number;
};

type PixelInfo = {
  colorIndex: number;
  color: number;
  bgPriority: boolean;
};

/** Picture Processing Unit */
export default class PPU {
  mmu?: MMU;
  cgbMode: boolean = false;

  context: CanvasRenderingContext2D;
  imageData: ImageData;

  vram: Uint8Array;
  vramBank = 0;

  objects: ObjectAttributes[] = [];
  backgroundPixels = new Array<PixelInfo>(SCREEN_WIDTH);
  objectPixels = new Array<PixelInfo>(SCREEN_WIDTH);
  clock = 0;
  dma = 0xff;

  backgroundWindowEnabled = false;
  objectsEnabled = false;
  objectSizeFlag = false;
  backgroundTileMapAreaFlag = false;
  tileDataAreaFlag = false;
  windowEnabled = false;
  windowTileMapAreaFlag = false;
  enabled = false;

  mode = Mode.HORIZONTAL_BLANK;
  ly = 0;
  lyc = 0x00;
  scx = 0;
  scy = 0;
  wx = 0;
  wy = 0;
  wly = 0;
  backgroundPalette = [0, 0, 0, 0];
  objectPalette0 = [0, 0, 0, 0];
  objectPalette1 = [0, 0, 0, 0];

  // Color
  colorBackgroundPalette = new Uint8Array(64).fill(255);
  backgroundPaletteIndex = 0;
  incrementBackgroundPaletteIndex = false;

  colorObjectPalette = new Uint8Array(64).fill(255);
  objectPaletteIndex = 0;
  incrementObjectPaletteIndex = false;

  vramDmaSource = 0x0000;
  vramDmaDestination = 0x0000;
  vramDmaLength = 0;
  vramDmaProgress = 0;

  lycInterruptsEnabled = false;
  oamStatInterruptsEnabled = false;
  verticalBlankStatInterruptsEnabled = false;
  horizontalBlankStatInterruptsEnabled = false;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Invalid canvas context');
    }

    this.context = context;
    this.imageData = context.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);

    this.vram = new Uint8Array(VRAM_BANK_SIZE * 2);
  }

  reset() {
    this.vram = new Uint8Array(VRAM_BANK_SIZE * 2);
    this.vramBank = 0;

    this.objects = [];
    this.backgroundPixels = new Array<PixelInfo>(SCREEN_WIDTH);
    this.objectPixels = new Array<PixelInfo>(SCREEN_WIDTH);
    this.clock = 0;

    this.backgroundWindowEnabled = false;
    this.objectsEnabled = false;
    this.objectSizeFlag = false;
    this.backgroundTileMapAreaFlag = false;
    this.tileDataAreaFlag = false;
    this.windowEnabled = false;
    this.windowTileMapAreaFlag = false;
    this.enabled = false;

    this.mode = Mode.HORIZONTAL_BLANK;
    this.ly = 0;
    this.lyc = 0x00;
    this.scx = 0;
    this.scy = 0;
    this.wx = 0;
    this.wy = 0;
    this.wly = 0;
    this.backgroundPalette = [0, 0, 0, 0];
    this.objectPalette0 = [0, 0, 0, 0];
    this.objectPalette1 = [0, 0, 0, 0];

    this.colorBackgroundPalette = new Uint8Array(64).fill(255);
    this.backgroundPaletteIndex = 0;
    this.incrementBackgroundPaletteIndex = false;

    this.colorObjectPalette = new Uint8Array(64).fill(255);
    this.objectPaletteIndex = 0;
    this.incrementObjectPaletteIndex = false;

    this.vramDmaSource = 0x0000;
    this.vramDmaDestination = 0x0000;
    this.vramDmaLength = 0;
    this.vramDmaProgress = 0;

    this.lycInterruptsEnabled = false;
    this.oamStatInterruptsEnabled = false;
    this.verticalBlankStatInterruptsEnabled = false;
    this.horizontalBlankStatInterruptsEnabled = false;
  }

  read(address: number) {
    if (inRange(address, MEMORY_RANGES.VRAM)) {
      return this.vramRead(address - MEMORY_RANGES.VRAM.start);
    }

    switch (address) {
      case GRAPHICS_REGISTERS.LCDC:
        return (
          (this.enabled ? 0x80 : 0) |
          (this.windowTileMapAreaFlag ? 0x40 : 0) |
          (this.windowEnabled ? 0x20 : 0) |
          (this.tileDataAreaFlag ? 0x10 : 0) |
          (this.backgroundTileMapAreaFlag ? 0x08 : 0) |
          (this.objectSizeFlag ? 0x04 : 0) |
          (this.objectsEnabled ? 0x02 : 0) |
          (this.backgroundWindowEnabled ? 0x01 : 0)
        );
      case GRAPHICS_REGISTERS.STAT:
        return (
          0x80 |
          (this.lycInterruptsEnabled ? 0x40 : 0) |
          (this.oamStatInterruptsEnabled ? 0x20 : 0) |
          (this.verticalBlankStatInterruptsEnabled ? 0x10 : 0) |
          (this.horizontalBlankStatInterruptsEnabled ? 0x08 : 0) |
          (this.lyc === this.ly ? 0x04 : 0) |
          this.mode
        );
      case GRAPHICS_REGISTERS.SCY:
        return this.scy;
      case GRAPHICS_REGISTERS.SCX:
        return this.scx;
      case GRAPHICS_REGISTERS.LY:
        return this.ly;
      case GRAPHICS_REGISTERS.LYC:
        return this.lyc;
      case GRAPHICS_REGISTERS.DMA:
        return this.dma;
      case GRAPHICS_REGISTERS.BGP:
        return (
          (this.backgroundPalette[3] << 6) |
          (this.backgroundPalette[2] << 4) |
          (this.backgroundPalette[1] << 2) |
          this.backgroundPalette[0]
        );
      case GRAPHICS_REGISTERS.OBP0:
        return (
          (this.objectPalette0[3] << 6) |
          (this.objectPalette0[2] << 4) |
          (this.objectPalette0[1] << 2) |
          this.objectPalette0[0]
        );
      case GRAPHICS_REGISTERS.OBP1:
        return (
          (this.objectPalette1[3] << 6) |
          (this.objectPalette1[2] << 4) |
          (this.objectPalette1[1] << 2) |
          this.objectPalette1[0]
        );
      case GRAPHICS_REGISTERS.WY:
        return this.wy;
      case GRAPHICS_REGISTERS.WX:
        return this.wx;
      case GRAPHICS_REGISTERS.VBK:
        return this.vramBank | 0xfe;
      case GRAPHICS_REGISTERS.BCPS:
        return (
          (this.incrementBackgroundPaletteIndex ? 0x80 : 0) |
          0x40 |
          this.backgroundPaletteIndex
        );
      case GRAPHICS_REGISTERS.BCPD:
        return this.colorBackgroundPalette[this.backgroundPaletteIndex];
      case GRAPHICS_REGISTERS.OCPS:
        return (
          (this.incrementObjectPaletteIndex ? 0x80 : 0) |
          0x40 |
          this.objectPaletteIndex
        );
      case GRAPHICS_REGISTERS.OCPD:
        return this.colorObjectPalette[this.objectPaletteIndex];
      case GRAPHICS_REGISTERS.HDMA1:
        return this.vramDmaSource >> 8;
      case GRAPHICS_REGISTERS.HDMA2:
        return this.vramDmaSource & 0x00ff;
      case GRAPHICS_REGISTERS.HDMA3:
        return this.vramDmaDestination >> 8;
      case GRAPHICS_REGISTERS.HDMA4:
        return this.vramDmaDestination & 0x00ff;
      case GRAPHICS_REGISTERS.HDMA5:
        return this.vramDmaProgress >= this.vramDmaLength
          ? 0xff
          : this.vramDmaLength - this.vramDmaProgress;
      default:
        return 0xff;
    }
  }

  write(address: number, value: number) {
    if (inRange(address, MEMORY_RANGES.VRAM)) {
      this.vramWrite(address - MEMORY_RANGES.VRAM.start, value);
      return;
    }

    switch (address) {
      case GRAPHICS_REGISTERS.LCDC:
        this.enabled = Boolean(value & 0x80);
        this.windowTileMapAreaFlag = Boolean(value & 0x40);
        this.windowEnabled = Boolean(value & 0x20);
        this.tileDataAreaFlag = Boolean(value & 0x10);
        this.backgroundTileMapAreaFlag = Boolean(value & 0x08);
        this.objectSizeFlag = Boolean(value & 0x04);
        this.objectsEnabled = Boolean(value & 0x02);
        this.backgroundWindowEnabled = Boolean(value & 0x01);
        return;
      case GRAPHICS_REGISTERS.STAT:
        this.lycInterruptsEnabled = Boolean(value & 0x40);
        this.oamStatInterruptsEnabled = Boolean(value & 0x20);
        this.verticalBlankStatInterruptsEnabled = Boolean(value & 0x10);
        this.horizontalBlankStatInterruptsEnabled = Boolean(value & 0x08);
        return;
      case GRAPHICS_REGISTERS.SCY:
        this.scy = value;
        return;
      case GRAPHICS_REGISTERS.SCX:
        this.scx = value;
        return;
      case GRAPHICS_REGISTERS.LYC:
        this.lyc = value;
        return;
      case GRAPHICS_REGISTERS.DMA:
        this.dma = value;
        this.mmu?.dma(value);
        return;
      case GRAPHICS_REGISTERS.BGP:
        this.backgroundPalette = [
          value & 0x3,
          (value >> 2) & 0x3,
          (value >> 4) & 0x3,
          (value >> 6) & 0x3,
        ];
        return;
      case GRAPHICS_REGISTERS.OBP0:
        this.objectPalette0 = [
          0, // Transparent
          (value >> 2) & 0x3,
          (value >> 4) & 0x3,
          (value >> 6) & 0x3,
        ];
        return;
      case GRAPHICS_REGISTERS.OBP1:
        this.objectPalette1 = [
          0, // Transparent
          (value >> 2) & 0x3,
          (value >> 4) & 0x3,
          (value >> 6) & 0x3,
        ];
        return;
      case GRAPHICS_REGISTERS.WY:
        this.wy = value;
        return;
      case GRAPHICS_REGISTERS.WX:
        this.wx = value;
        return;
      case GRAPHICS_REGISTERS.VBK:
        if (!this.cgbMode) {
          return;
        }
        this.vramBank = value;
        return;
      case GRAPHICS_REGISTERS.BCPS:
        if (!this.cgbMode) {
          return;
        }
        this.backgroundPaletteIndex = value & 0x3f;
        this.incrementBackgroundPaletteIndex = Boolean(value & 0x80);
        return;
      case GRAPHICS_REGISTERS.BCPD:
        if (!this.cgbMode) {
          return;
        }
        this.colorBackgroundPalette[this.backgroundPaletteIndex] = value;
        if (this.incrementBackgroundPaletteIndex) {
          this.backgroundPaletteIndex =
            (this.backgroundPaletteIndex + 1) & 0x3f;
        }
        return;
      case GRAPHICS_REGISTERS.OCPS:
        if (!this.cgbMode) {
          return;
        }
        this.objectPaletteIndex = value & 0x3f;
        this.incrementObjectPaletteIndex = Boolean(value & 0x80);
        return;
      case GRAPHICS_REGISTERS.OCPD:
        if (!this.cgbMode) {
          return;
        }
        this.colorObjectPalette[this.objectPaletteIndex] = value;
        if (this.incrementObjectPaletteIndex) {
          this.objectPaletteIndex = (this.objectPaletteIndex + 1) & 0x3f;
        }
        return;
      case GRAPHICS_REGISTERS.HDMA1:
        if (!this.cgbMode) {
          return;
        }
        this.vramDmaSource = (value << 8) | (this.vramDmaSource & 0x00ff);
        return;
      case GRAPHICS_REGISTERS.HDMA2:
        if (!this.cgbMode) {
          return;
        }
        this.vramDmaSource = (this.vramDmaSource & 0xff00) | value;
        return;
      case GRAPHICS_REGISTERS.HDMA3:
        if (!this.cgbMode) {
          return;
        }
        this.vramDmaDestination =
          (value << 8) | (this.vramDmaDestination & 0x00ff);
        return;
      case GRAPHICS_REGISTERS.HDMA4:
        if (!this.cgbMode) {
          return;
        }
        this.vramDmaDestination = (this.vramDmaDestination & 0xff00) | value;
        return;
      case GRAPHICS_REGISTERS.HDMA5:
        if (!this.cgbMode) {
          return;
        }
        this.vramDma((value & 0x80) >> 7, value & 0x7f);
        return;
    }
  }

  vramRead(address: number, bank = this.vramBank & 0x01) {
    return this.vram[bank * VRAM_BANK_SIZE + address];
  }

  vramReadWord(address: number, bank = this.vramBank & 0x01) {
    return (
      (this.vramRead(address + 1, bank) << 8) | this.vramRead(address, bank)
    );
  }

  vramWrite(address: number, value: number, bank = this.vramBank & 0x01) {
    this.vram[bank * VRAM_BANK_SIZE + address] = value;
  }

  step(count: number) {
    this.clock += count;

    switch (this.mode) {
      case Mode.HORIZONTAL_BLANK:
        if (this.clock >= 51) {
          this.ly++;
          this.checkLYInterrupt();

          if (this.ly < SCREEN_HEIGHT) {
            this.oamScanMode();
          } else {
            this.verticalBlankMode();
          }
        }
        break;

      case Mode.VERTICAL_BLANK:
        if (this.clock >= 114) {
          this.ly++;
          this.checkLYInterrupt();
          this.clock = 0;

          if (this.ly === SCREEN_HEIGHT + 10) {
            this.resetMode();
          }
        }
        break;

      case Mode.OAM_SCAN:
        if (this.clock >= 20) {
          this.renderMode();
        }
        break;

      case Mode.RENDER:
        if (this.clock >= 43) {
          this.horizontalBlankMode();
        }
        break;
    }
  }

  resetMode() {
    this.ly = 0;
    this.wly = 0;
    this.checkLYInterrupt();
    this.oamScanMode();
    this.clock = 0;
  }

  horizontalBlankMode() {
    this.mode = Mode.HORIZONTAL_BLANK;

    if (this.cgbMode && this.vramDmaProgress < this.vramDmaLength) {
      this.hblankDma();
    }

    if (this.horizontalBlankStatInterruptsEnabled) {
      this.mmu?.requestInterrupt(Interrupts.LCD_STAT);
    }

    this.clock = 0;
  }

  verticalBlankMode() {
    this.mode = Mode.VERTICAL_BLANK;

    if (this.enabled) {
      this.context.putImageData(this.imageData, 0, 0);
    }

    if (this.verticalBlankStatInterruptsEnabled) {
      this.mmu?.requestInterrupt(Interrupts.LCD_STAT);
    }

    this.mmu?.requestInterrupt(Interrupts.VBLANK);
    this.clock = 0;
  }

  oamScanMode() {
    this.mode = Mode.OAM_SCAN;
    if (this.oamStatInterruptsEnabled) {
      this.mmu?.requestInterrupt(Interrupts.LCD_STAT);
    }
    if (this.objectsEnabled) {
      this.objects = this.getObjects();
    }
    this.clock = 0;
  }

  renderMode() {
    this.mode = Mode.RENDER;
    this.renderScanline();
    this.clock = 0;
  }

  checkLYInterrupt() {
    if (this.lycInterruptsEnabled && this.lyc === this.ly) {
      this.mmu?.requestInterrupt(Interrupts.LCD_STAT);
    }
  }

  getPixel(x: number) {
    const bgPixel = this.backgroundPixels[x];
    const objectPixel = this.objectPixels[x];

    if (!objectPixel) {
      return bgPixel;
    }

    if (
      bgPixel.colorIndex === 0 ||
      !this.backgroundWindowEnabled ||
      (!bgPixel.bgPriority && !objectPixel.bgPriority)
    ) {
      return objectPixel;
    }

    return bgPixel;
  }

  renderScanline() {
    this.backgroundPixels = [];
    this.objectPixels = [];
    if (this.backgroundWindowEnabled || this.cgbMode) {
      this.drawLine();
    } else {
      this.drawBlankScanline();
    }

    if (this.objectsEnabled) {
      this.drawObjects();
    }

    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const pixel = this.getPixel(x);

      if (this.cgbMode) {
        this.drawColorPixel(x, this.ly, pixel.color);
      } else {
        this.drawMonochromePixel(x, this.ly, pixel.color);
      }
    }
  }

  drawMonochromePixel(x: number, y: number, color: number) {
    const offset = (y * SCREEN_WIDTH + x) * 4;
    const value = COLOR_MAP[color];
    this.imageData.data[offset] = value;
    this.imageData.data[offset + 1] = value;
    this.imageData.data[offset + 2] = value;
    this.imageData.data[offset + 3] = 255;
  }

  drawColorPixel(x: number, y: number, color: number) {
    const offset = (y * SCREEN_WIDTH + x) * 4;
    const red = color & 0x001f;
    const green = (color >> 5) & 0x001f;
    const blue = (color >> 10) & 0x001f;
    this.imageData.data[offset] = (red << 3) | (red >> 2);
    this.imageData.data[offset + 1] = (green << 3) | (green >> 2);
    this.imageData.data[offset + 2] = (blue << 3) | (blue >> 2);
    this.imageData.data[offset + 3] = 255;
  }

  drawBlankScanline() {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      this.backgroundPixels[x] = {
        color: this.cgbMode ? 0xffff : 0,
        colorIndex: 0,
        bgPriority: false,
      };
    }
  }

  getTileAddress(index: number) {
    if (this.tileDataAreaFlag) {
      return 0x8000 + index * 16;
    }
    if (index < 128) {
      return 0x9000 + index * 16;
    } else {
      return 0x8800 + (index - 128) * 16;
    }
  }

  getTiles(
    tileMapAddress: number,
    row: number,
    rowInTile: number,
    max: number
  ): TileAttributes[] {
    if (!this.mmu) {
      return [];
    }
    const tiles = [];
    for (let i = 0; i < max; i++) {
      const mapAddress = tileMapAddress + row * 32 + i;
      const tileDataIndex = this.mmu.read(mapAddress);

      if (this.cgbMode) {
        const tileAttributes = this.vramRead(
          mapAddress - MEMORY_RANGES.VRAM.start,
          1
        );

        const bank = (tileAttributes & 0x08) >> 3;
        const flipY = Boolean(tileAttributes & 0x40);

        const address =
          this.getTileAddress(tileDataIndex) +
          (flipY ? 7 - rowInTile : rowInTile) * 2 -
          MEMORY_RANGES.VRAM.start;

        tiles[i] = {
          priority: Boolean(tileAttributes & 0x80),
          flipY: Boolean(tileAttributes & 0x40),
          flipX: Boolean(tileAttributes & 0x20),
          palette: tileAttributes & 0x07,
          data: this.vramReadWord(address, bank),
        };
      } else {
        const address =
          this.getTileAddress(tileDataIndex) +
          rowInTile * 2 -
          MEMORY_RANGES.VRAM.start;
        tiles[i] = {
          priority: false,
          flipY: false,
          flipX: false,
          palette: 0,
          data: this.vramReadWord(address, 0),
        };
      }
    }
    return tiles;
  }

  getTilePixel(tileData: number, x: number) {
    const high = tileData >> 8;
    const low = tileData & 255;
    return ((low >> (7 - x)) & 1) + (((high >> (7 - x)) & 1) << 1);
  }

  getBackgroundColor(palette: number, colorIndex: number) {
    const offset = palette * 8 + colorIndex * 2;
    return (
      (this.colorBackgroundPalette[offset + 1] << 8) +
      this.colorBackgroundPalette[offset]
    );
  }

  getObjectColor(palette: number, colorIndex: number) {
    const offset = palette * 8 + colorIndex * 2;
    return (
      (this.colorObjectPalette[offset + 1] << 8) +
      this.colorObjectPalette[offset]
    );
  }

  drawLine() {
    const bgY = (this.ly + this.scy) % 256;
    const bgTileMap = this.backgroundTileMapAreaFlag ? 0x9c00 : 0x9800;
    const bgTiles = this.getTiles(bgTileMap, bgY >> 3, bgY % 8, 32);

    const drawWindow =
      this.windowEnabled &&
      this.wx < SCREEN_WIDTH + 7 &&
      this.wy < SCREEN_HEIGHT &&
      this.ly >= this.wy;

    const windowTileMap = this.windowTileMapAreaFlag ? 0x9c00 : 0x9800;
    const windowTiles = drawWindow
      ? this.getTiles(windowTileMap, this.wly >> 3, this.wly % 8, 20)
      : [];

    for (let x = 0; x < SCREEN_WIDTH; x++) {
      const bgX = (this.scx + x) & 255;
      const windowX = x - (this.wx - 7);
      const useWindowTile = drawWindow && windowX >= 0;

      const tile = useWindowTile
        ? windowTiles[windowX >> 3]
        : bgTiles[bgX >> 3];

      const tilePixelX = (useWindowTile ? windowX : bgX) % 8;

      const color = this.getTilePixel(
        tile.data,
        tile.flipX ? 7 - tilePixelX : tilePixelX
      );
      this.backgroundPixels[x] = {
        colorIndex: color,
        color: this.cgbMode
          ? this.getBackgroundColor(tile.palette, color)
          : this.backgroundPalette[color],
        bgPriority: tile.priority,
      };
    }

    if (drawWindow) {
      this.wly++;
    }
  }

  getObjects(): ObjectAttributes[] {
    if (!this.mmu) {
      return [];
    }

    const objectSize = this.objectSizeFlag ? 16 : 8;
    const objects: ObjectAttributes[] = [];

    for (let i = 0xfe00; i <= 0xfe9f && objects.length < 10; i += 4) {
      const y = this.mmu.read(i) - 16;

      if (this.ly >= y && this.ly < y + objectSize) {
        const x = this.mmu.read(i + 1) - 8;
        const attributes = this.mmu.read(i + 3);
        const tile = this.mmu.read(i + 2);

        const object = {
          address: i,
          y,
          x,
          tile,
          cgbPalette: attributes & 0x07,
          bank: (attributes & 0x08) >> 3,
          paletteFlag: Boolean(attributes & 0x10),
          flipX: Boolean(attributes & 0x20),
          flipY: Boolean(attributes & 0x40),
          backgroundPriority: Boolean(attributes & 0x80),
        };

        objects.push(object);
      }
    }
    objects.sort((a, b) =>
      a.x === b.x || this.cgbMode ? a.address - b.address : a.x - b.x
    );
    return objects;
  }

  drawObjects() {
    const objectSize = this.objectSizeFlag ? 16 : 8;

    for (let j = 0; j < this.objects.length; j++) {
      const object = this.objects[j];

      const palette = object.paletteFlag
        ? this.objectPalette1
        : this.objectPalette0;
      const tileY = object.flipY
        ? objectSize - (this.ly - object.y) - 1
        : this.ly - object.y;

      let tileIndex = object.tile;
      if (this.objectSizeFlag) {
        if (tileY < 8) {
          tileIndex &= 0xfe;
        } else {
          tileIndex |= 0x01;
        }
      }

      const bank = this.cgbMode ? object.bank : 0;
      const tileAddress = tileIndex * 16 + (tileY % 8) * 2;
      const tileData = this.vramReadWord(tileAddress, bank);

      for (let k = 0; k < 8; k++) {
        const x = object.x + k;

        if (x < 0 || x >= SCREEN_WIDTH) {
          continue;
        }

        if (typeof this.objectPixels[x] !== 'undefined') {
          continue;
        }

        const colorIndex = this.getTilePixel(
          tileData,
          object.flipX ? 7 - k : k
        );

        if (colorIndex === 0) {
          continue;
        }

        this.objectPixels[x] = {
          colorIndex,
          color: this.cgbMode
            ? this.getObjectColor(object.cgbPalette, colorIndex)
            : palette[colorIndex],
          bgPriority: object.backgroundPriority,
        };
      }
    }
  }

  vramDma(mode: number, length: number) {
    if (mode === 0) {
      this.generalPurposeDma(length);
    } else {
      this.vramDmaProgress = 0;
      this.vramDmaLength = length + 1;
    }
  }

  generalPurposeDma(length: number) {
    if (!this.mmu) {
      return;
    }
    const transferLength = (length + 1) * 0x10;
    const source = this.vramDmaSource & 0xfff0;
    const destination = this.vramDmaDestination & 0x1ff0;
    for (let i = 0; i < transferLength; i++) {
      this.vramWrite(destination + i, this.mmu.read(source + i));
    }
    this.vramDmaProgress = 0;
    this.vramDmaLength = 0;
  }

  hblankDma() {
    if (!this.mmu) {
      return;
    }
    const offset = this.vramDmaProgress * 0x10;
    const source = (this.vramDmaSource & 0xfff0) + offset;
    const destination = (this.vramDmaDestination & 0x1ff0) + offset;

    for (let i = 0; i < 0x10; i++) {
      // Overflow
      if (source + i > 0xffff || destination + i > 0xffff) {
        return;
      }
      this.vramWrite(destination + i, this.mmu.read(source + i));
    }

    this.vramDmaProgress++;
  }
}
