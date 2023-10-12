export const WAVE_RAM_START = 0xff30;
export const WAVE_RAM_END = 0xff3f;

export const AUDIO_REGISTERS = {
  NR50: 0xff24,
  NR51: 0xff25,
  NR52: 0xff26,

  NR10: 0xff10,
  NR11: 0xff11,
  NR12: 0xff12,
  NR13: 0xff13,
  NR14: 0xff14,

  NR21: 0xff16,
  NR22: 0xff17,
  NR23: 0xff18,
  NR24: 0xff19,

  NR30: 0xff1a,
  NR31: 0xff1b,
  NR32: 0xff1c,
  NR33: 0xff1d,
  NR34: 0xff1e,

  NR41: 0xff20,
  NR42: 0xff21,
  NR43: 0xff22,
  NR44: 0xff23,
};

export enum SweepMode {
  INCREASE,
  DECREASE,
}
