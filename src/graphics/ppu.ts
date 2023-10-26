import { Interrupts } from '../cpu/interrupts';
import MMU from '../memory/mmu';
import {
  COLOR_MAP,
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  GRAPHICS_REGISTERS,
} from './constants';

export enum Mode {
  HORIZONTAL_BLANK,
  VERTICAL_BLANK,
  OAM_SCAN,
  RENDER,
}

type ObjectAttributes = {
  address: number;
  x: number;
  y: number;
  tile: number;
  paletteFlag: boolean;
  flipX: boolean;
  flipY: boolean;
  backgroundPriority: boolean;
};

/** Picture Processing Unit */
export default class PPU {
  mmu?: MMU;

  context: CanvasRenderingContext2D;
  imageData: ImageData;

  objects: ObjectAttributes[] = [];
  backgroundPixels = new Array<number>(SCREEN_WIDTH);
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
  }

  reset() {
    this.objects = [];
    this.backgroundPixels = new Array<number>(SCREEN_WIDTH);
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

    this.lycInterruptsEnabled = false;
    this.oamStatInterruptsEnabled = false;
    this.verticalBlankStatInterruptsEnabled = false;
    this.horizontalBlankStatInterruptsEnabled = false;
  }

  read(address: number) {
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
      default:
        return 0xff;
    }
  }

  write(address: number, value: number) {
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
    }
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

  renderScanline() {
    if (this.backgroundWindowEnabled) {
      this.drawBackground();

      if (
        this.windowEnabled &&
        this.wx < SCREEN_WIDTH + 7 &&
        this.wy < SCREEN_HEIGHT &&
        this.ly >= this.wy
      ) {
        this.drawWindow();
      }
    } else {
      this.drawBlankScanline();
    }

    if (this.objectsEnabled) {
      this.drawObjects();
    }
  }

  drawPixel(x: number, y: number, color: number) {
    const offset = (y * SCREEN_WIDTH + x) * 4;
    const value = COLOR_MAP[color];
    this.imageData.data[offset] = value;
    this.imageData.data[offset + 1] = value;
    this.imageData.data[offset + 2] = value;
    this.imageData.data[offset + 3] = 255;
  }

  drawBlankScanline() {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      this.backgroundPixels[x] = 0;
      this.drawPixel(x, this.ly, 0);
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
  ) {
    if (!this.mmu) {
      return [];
    }
    const tiles = [];
    for (let i = 0; i < max; i++) {
      const mapAddress = tileMapAddress + row * 32 + i;
      const tileDataIndex = this.mmu.read(mapAddress);
      const address = this.getTileAddress(tileDataIndex);
      tiles[i] = this.mmu.readWord(address + rowInTile * 2);
    }
    return tiles;
  }

  getTilePixel(tileData: number, x: number) {
    const high = tileData >> 8;
    const low = tileData & 255;
    return ((low >> (7 - x)) & 1) + (((high >> (7 - x)) & 1) << 1);
  }

  drawBackground() {
    if (!this.mmu) {
      return;
    }

    const y = (this.ly + this.scy) % 256;
    const tileMap = this.backgroundTileMapAreaFlag ? 0x9c00 : 0x9800;
    const tiles = this.getTiles(tileMap, y >> 3, y % 8, 32);

    for (let displayX = 0; displayX < SCREEN_WIDTH; displayX++) {
      const x = (this.scx + displayX) % 256;
      const pixel = this.getTilePixel(tiles[x >> 3], x % 8);
      this.backgroundPixels[displayX] = pixel;
      this.drawPixel(displayX, this.ly, this.backgroundPalette[pixel]);
    }
  }

  drawWindow() {
    if (!this.mmu) {
      return;
    }

    const tileMap = this.windowTileMapAreaFlag ? 0x9c00 : 0x9800;
    const tiles = this.getTiles(tileMap, this.wly >> 3, this.wly % 8, 20);

    for (let i = Math.max(this.wx - 7, 0); i < SCREEN_WIDTH; i++) {
      const x = i - this.wx + 7;
      const pixel = this.getTilePixel(tiles[x >> 3], x % 8);
      this.backgroundPixels[i] = pixel;
      this.drawPixel(i, this.ly, this.backgroundPalette[pixel]);
    }

    this.wly++;
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
          paletteFlag: Boolean(attributes & 0x10),
          flipX: Boolean(attributes & 0x20),
          flipY: Boolean(attributes & 0x40),
          backgroundPriority: Boolean(attributes & 0x80),
        };

        objects.push(object);
      }
    }
    objects.sort((a, b) => (a.x === b.x ? a.address - b.address : a.x - b.x));
    return objects;
  }

  drawObjects() {
    if (!this.mmu) {
      return;
    }

    const objectPixels: number[] = [];
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

      const tileAddress = 0x8000 + tileIndex * 16;
      const tileData = this.mmu.readWord(tileAddress + (tileY % 8) * 2);

      for (let k = 0; k < 8; k++) {
        const x = object.x + k;

        if (x < 0 || x >= SCREEN_WIDTH) {
          continue;
        }

        if (typeof objectPixels[x] !== 'undefined') {
          continue;
        }

        if (object.backgroundPriority && this.backgroundPixels[x] !== 0) {
          continue;
        }

        const pixel = this.getTilePixel(tileData, object.flipX ? 7 - k : k);
        objectPixels[x] = pixel;

        if (pixel > 0) {
          this.drawPixel(x, this.ly, palette[pixel]);
        }
      }
    }
  }
}
