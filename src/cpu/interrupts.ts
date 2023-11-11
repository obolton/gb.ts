type InterruptNames = 'VBLANK' | 'LCD_STAT' | 'TIMER' | 'SERIAL' | 'JOYPAD';

export type Interrupt = {
  flag: number;
  handlerAddress: number;
};

export const Interrupts: { [key in InterruptNames]: Interrupt } = {
  VBLANK: {
    flag: 0x01,
    handlerAddress: 0x40,
  },
  LCD_STAT: {
    flag: 0x02,
    handlerAddress: 0x48,
  },
  TIMER: {
    flag: 0x04,
    handlerAddress: 0x50,
  },
  SERIAL: {
    flag: 0x08,
    handlerAddress: 0x58,
  },
  JOYPAD: {
    flag: 0x10,
    handlerAddress: 0x60,
  },
};
