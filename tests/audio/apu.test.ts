import APU from '../../src/audio/apu';
import { AUDIO_REGISTERS } from '../../src/audio/constants';
import { SweepMode } from '../../src/audio/constants';
import AudioContext from '../mocks/AudioContext';

global.AudioContext = AudioContext;

const WAVE = [0, 16, 255, 64, 255, 64, 32, 8, 0, 96, 80, 0, 0, 128, 255, 64];

describe('APU', () => {
  const apu = new APU();

  describe('global registers', () => {
    test('NR50: left and right volume', () => {
      apu.write(AUDIO_REGISTERS.NR50, 0x25);
      expect(apu.leftVolume).toEqual(2);
      expect(apu.leftGain.gain.value).toEqual(3 / 8);
      expect(apu.rightVolume).toEqual(5);
      expect(apu.rightGain.gain.value).toEqual(6 / 8);
      expect(apu.read(AUDIO_REGISTERS.NR50)).toEqual(0x25);
    });

    test('NR51: panning', () => {
      apu.write(AUDIO_REGISTERS.NR51, 0x97);
      expect(apu.channel1.mixLeft).toBe(true);
      expect(apu.channel1.mixRight).toBe(true);
      expect(apu.channel2.mixLeft).toBe(false);
      expect(apu.channel2.mixRight).toBe(true);
      expect(apu.channel3.mixLeft).toBe(false);
      expect(apu.channel3.mixRight).toBe(true);
      expect(apu.channel4.mixLeft).toBe(true);
      expect(apu.channel4.mixRight).toBe(false);
      expect(apu.read(AUDIO_REGISTERS.NR51)).toEqual(0x97);
    });

    test('NR53: sound on/off', () => {
      expect(apu.enabled).toBe(false);
      expect(apu.masterGain.gain.value).toEqual(0);
      apu.write(AUDIO_REGISTERS.NR52, 0x89);
      expect(apu.enabled).toBe(true);
      expect(apu.masterGain.gain.value).toEqual(0.25);
      expect(apu.read(AUDIO_REGISTERS.NR52)).toEqual(0xf0);
    });
  });

  describe('channel 1: pulse channel with period sweep', () => {
    describe('NR10: period sweep', () => {
      test('sweep pace', () => {
        apu.write(AUDIO_REGISTERS.NR10, 0x20);
        expect(apu.channel1.initialPeriodSweepPace).toEqual(2);
        expect(apu.read(AUDIO_REGISTERS.NR10)).toEqual(0xa0);
      });

      describe('sweep direction', () => {
        test('sets to increase', () => {
          apu.write(AUDIO_REGISTERS.NR10, 0x00);
          expect(apu.channel1.periodSweepMode).toEqual(SweepMode.INCREASE);
          expect(apu.read(AUDIO_REGISTERS.NR10)).toEqual(0x80);
        });

        test('sets to decrease', () => {
          apu.write(AUDIO_REGISTERS.NR10, 0x08);
          expect(apu.channel1.periodSweepMode).toEqual(SweepMode.DECREASE);
          expect(apu.read(AUDIO_REGISTERS.NR10)).toEqual(0x88);
        });
      });

      test('sweep slope', () => {
        apu.write(AUDIO_REGISTERS.NR10, 0x03);
        expect(apu.channel1.periodSweepSlope).toEqual(3);
        expect(apu.read(AUDIO_REGISTERS.NR10)).toEqual(0x83);
      });
    });

    describe('NR11: length timer and duty cycle', () => {
      test('length timer', () => {
        apu.write(AUDIO_REGISTERS.NR11, 0x13);
        expect(apu.channel1.initialLength).toEqual(45);
        expect(apu.read(AUDIO_REGISTERS.NR11)).toEqual(0x3f);
      });
    });

    describe('NR12: volume and envelope', () => {
      test('volume', () => {
        apu.write(AUDIO_REGISTERS.NR12, 0x80);
        expect(apu.channel1.initialVolume).toEqual(8);
        expect(apu.read(AUDIO_REGISTERS.NR12)).toEqual(0x80);
      });

      describe('sweep direction', () => {
        test('sets to increase', () => {
          apu.write(AUDIO_REGISTERS.NR12, 0x08);
          expect(apu.channel1.initialEnvelopeSweepMode).toEqual(
            SweepMode.INCREASE
          );
          expect(apu.read(AUDIO_REGISTERS.NR12)).toEqual(0x08);
        });

        test('sets to decrease', () => {
          apu.write(AUDIO_REGISTERS.NR12, 0x00);
          expect(apu.channel1.initialEnvelopeSweepMode).toEqual(
            SweepMode.DECREASE
          );
          expect(apu.read(AUDIO_REGISTERS.NR12)).toEqual(0x00);
        });
      });

      test('sweep slope', () => {
        apu.write(AUDIO_REGISTERS.NR12, 0x03);
        expect(apu.channel1.initialEnvelopeSweepPace).toEqual(3);
        expect(apu.read(AUDIO_REGISTERS.NR12)).toEqual(0x03);
      });

      test('enables the DAC if bits 3-7 are non-zero', () => {
        apu.write(AUDIO_REGISTERS.NR12, 0x0f);
        expect(apu.channel1.dacEnabled).toBe(true);
      });

      test('disables the DAC if bits 3-7 are zero', () => {
        apu.write(AUDIO_REGISTERS.NR12, 0x07);
        expect(apu.channel1.dacEnabled).toBe(false);
      });
    });

    test('NR13: period low', () => {
      apu.channel1.period = 0x05ff;
      apu.write(AUDIO_REGISTERS.NR13, 0xa3);
      expect(apu.channel1.period).toEqual(0x05a3);
      expect(apu.read(AUDIO_REGISTERS.NR13)).toEqual(0xff);
    });

    describe('NR14: period high and control', () => {
      test('period high', () => {
        apu.channel1.period = 0x050a;
        apu.write(AUDIO_REGISTERS.NR14, 0x02);
        expect(apu.channel1.period).toEqual(0x020a);
      });

      describe('length timer', () => {
        test('enables length timer', () => {
          apu.write(AUDIO_REGISTERS.NR14, 0x40);
          expect(apu.channel1.enableLengthTimer).toBe(true);
          expect(apu.read(AUDIO_REGISTERS.NR14)).toEqual(0x40);
        });

        test('disables length timer', () => {
          apu.write(AUDIO_REGISTERS.NR14, 0x00);
          expect(apu.channel1.enableLengthTimer).toBe(false);
          expect(apu.read(AUDIO_REGISTERS.NR14)).toEqual(0x00);
        });
      });

      test('trigger', () => {
        jest.spyOn(apu.channel1, 'trigger');
        expect(apu.channel1.enabled).toBe(false);
        apu.write(AUDIO_REGISTERS.NR14, 0x80);
        expect(apu.channel1.enabled).toBe(true);
        expect(apu.channel1.trigger).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('channel 2: pulse channel without period sweep', () => {
    describe('NR21: length timer and duty cycle', () => {
      test('length timer', () => {
        apu.write(AUDIO_REGISTERS.NR21, 0x13);
        expect(apu.channel2.initialLength).toEqual(45);
        expect(apu.read(AUDIO_REGISTERS.NR21)).toEqual(0x3f);
      });
    });

    describe('NR22: volume and envelope', () => {
      test('volume', () => {
        apu.write(AUDIO_REGISTERS.NR22, 0x80);
        expect(apu.channel2.initialVolume).toEqual(8);
        expect(apu.read(AUDIO_REGISTERS.NR22)).toEqual(0x80);
      });

      describe('sweep direction', () => {
        test('sets to increase', () => {
          apu.write(AUDIO_REGISTERS.NR22, 0x08);
          expect(apu.channel2.initialEnvelopeSweepMode).toEqual(
            SweepMode.INCREASE
          );
          expect(apu.read(AUDIO_REGISTERS.NR22)).toEqual(0x08);
        });

        test('sets to decrease', () => {
          apu.write(AUDIO_REGISTERS.NR22, 0x00);
          expect(apu.channel2.initialEnvelopeSweepMode).toEqual(
            SweepMode.DECREASE
          );
          expect(apu.read(AUDIO_REGISTERS.NR22)).toEqual(0x00);
        });
      });

      test('sweep slope', () => {
        apu.write(AUDIO_REGISTERS.NR22, 0x03);
        expect(apu.channel2.initialEnvelopeSweepPace).toEqual(3);
        expect(apu.read(AUDIO_REGISTERS.NR22)).toEqual(0x03);
      });

      test('enables the DAC if bits 3-7 are non-zero', () => {
        apu.write(AUDIO_REGISTERS.NR22, 0x0f);
        expect(apu.channel2.dacEnabled).toBe(true);
      });

      test('disables the DAC if bits 3-7 are zero', () => {
        apu.write(AUDIO_REGISTERS.NR22, 0x07);
        expect(apu.channel2.dacEnabled).toBe(false);
      });
    });

    test('NR23: period low', () => {
      apu.channel2.period = 0x05ff;
      apu.write(AUDIO_REGISTERS.NR23, 0xa3);
      expect(apu.channel2.period).toEqual(0x05a3);
      expect(apu.read(AUDIO_REGISTERS.NR23)).toEqual(0xff);
    });

    describe('NR24: period high and control', () => {
      test('period high', () => {
        apu.channel2.period = 0x050a;
        apu.write(AUDIO_REGISTERS.NR24, 0x02);
        expect(apu.channel2.period).toEqual(0x020a);
      });

      describe('length timer', () => {
        test('enables length timer', () => {
          apu.write(AUDIO_REGISTERS.NR24, 0x40);
          expect(apu.channel2.enableLengthTimer).toBe(true);
          expect(apu.read(AUDIO_REGISTERS.NR24)).toEqual(0x40);
        });

        test('disables length timer', () => {
          apu.write(AUDIO_REGISTERS.NR24, 0x00);
          expect(apu.channel2.enableLengthTimer).toBe(false);
          expect(apu.read(AUDIO_REGISTERS.NR24)).toEqual(0x00);
        });
      });

      test('trigger', () => {
        jest.spyOn(apu.channel2, 'trigger');
        expect(apu.channel2.enabled).toBe(false);
        apu.write(AUDIO_REGISTERS.NR24, 0x80);
        expect(apu.channel2.enabled).toBe(true);
        expect(apu.channel2.trigger).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('channel 3: wave channel', () => {
    describe('NR30: DAC enable', () => {
      it('enables DAC', () => {
        apu.write(AUDIO_REGISTERS.NR30, 0x80);
        expect(apu.channel3.dacEnabled).toBe(true);
        expect(apu.read(AUDIO_REGISTERS.NR30)).toEqual(0xff);
      });

      it('disables DAC', () => {
        apu.write(AUDIO_REGISTERS.NR30, 0x00);
        expect(apu.channel3.dacEnabled).toBe(false);
        expect(apu.read(AUDIO_REGISTERS.NR30)).toEqual(0x7f);
      });
    });

    test('NR31: length timer', () => {
      apu.write(AUDIO_REGISTERS.NR31, 0x13);
      expect(apu.channel3.initialLength).toEqual(237);
      expect(apu.read(AUDIO_REGISTERS.NR31)).toEqual(0xff);
    });

    describe('NR32: output level', () => {
      it('mutes', () => {
        apu.write(AUDIO_REGISTERS.NR32, 0x00);
        expect(apu.channel3.initialVolume).toEqual(0);
        expect(apu.read(AUDIO_REGISTERS.NR32)).toEqual(0x9f);
      });

      it('sets output level to 100%', () => {
        apu.write(AUDIO_REGISTERS.NR32, 0x20);
        expect(apu.channel3.initialVolume).toEqual(7);
        expect(apu.read(AUDIO_REGISTERS.NR32)).toEqual(0xbf);
      });

      it('sets output level to 50%', () => {
        apu.write(AUDIO_REGISTERS.NR32, 0x40);
        expect(apu.channel3.initialVolume).toEqual(3);
        expect(apu.read(AUDIO_REGISTERS.NR32)).toEqual(0xdf);
      });

      it('sets output level to 25%', () => {
        apu.write(AUDIO_REGISTERS.NR32, 0x60);
        expect(apu.channel3.initialVolume).toEqual(1);
        expect(apu.read(AUDIO_REGISTERS.NR32)).toEqual(0xff);
      });
    });

    test('NR33: period low', () => {
      apu.channel3.periodValue = 0x05ff;
      apu.write(AUDIO_REGISTERS.NR33, 0xa3);
      expect(apu.channel3.periodValue).toEqual(0x05a3);
      expect(apu.read(AUDIO_REGISTERS.NR33)).toEqual(0xff);
    });

    describe('NR34: period high and control', () => {
      test('period high', () => {
        apu.channel3.periodValue = 0x050a;
        apu.write(AUDIO_REGISTERS.NR34, 0x02);
        expect(apu.channel3.periodValue).toEqual(0x020a);
      });

      describe('length timer', () => {
        test('enables length timer', () => {
          apu.write(AUDIO_REGISTERS.NR34, 0x40);
          expect(apu.channel3.enableLengthTimer).toBe(true);
          expect(apu.read(AUDIO_REGISTERS.NR34)).toEqual(0x40);
        });

        test('disables length timer', () => {
          apu.write(AUDIO_REGISTERS.NR34, 0x00);
          expect(apu.channel3.enableLengthTimer).toBe(false);
          expect(apu.read(AUDIO_REGISTERS.NR34)).toEqual(0x00);
        });
      });

      test('trigger', () => {
        jest.spyOn(apu.channel3, 'trigger');
        expect(apu.channel3.enabled).toBe(false);
        apu.write(AUDIO_REGISTERS.NR34, 0x80);
        expect(apu.channel3.enabled).toBe(true);
        expect(apu.channel3.trigger).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('channel 4: noise channel', () => {
    test('NR41: length timer', () => {
      apu.write(AUDIO_REGISTERS.NR41, 0x13);
      expect(apu.channel4.initialLength).toEqual(45);
      expect(apu.read(AUDIO_REGISTERS.NR41)).toEqual(0xff);
    });

    describe('NR42: volume and envelope', () => {
      test('volume', () => {
        apu.write(AUDIO_REGISTERS.NR42, 0x80);
        expect(apu.channel4.initialVolume).toEqual(8);
        expect(apu.read(AUDIO_REGISTERS.NR42)).toEqual(0x80);
      });

      describe('sweep direction', () => {
        test('sets to increase', () => {
          apu.write(AUDIO_REGISTERS.NR42, 0x08);
          expect(apu.channel4.initialEnvelopeSweepMode).toEqual(
            SweepMode.INCREASE
          );
          expect(apu.read(AUDIO_REGISTERS.NR42)).toEqual(0x08);
        });

        test('sets to decrease', () => {
          apu.write(AUDIO_REGISTERS.NR42, 0x00);
          expect(apu.channel4.initialEnvelopeSweepMode).toEqual(
            SweepMode.DECREASE
          );
          expect(apu.read(AUDIO_REGISTERS.NR42)).toEqual(0x00);
        });
      });

      test('sweep slope', () => {
        apu.write(AUDIO_REGISTERS.NR42, 0x03);
        expect(apu.channel4.initialEnvelopeSweepPace).toEqual(3);
        expect(apu.read(AUDIO_REGISTERS.NR42)).toEqual(0x03);
      });

      test('enables the DAC if bits 3-7 are non-zero', () => {
        apu.write(AUDIO_REGISTERS.NR42, 0x0f);
        expect(apu.channel4.dacEnabled).toBe(true);
      });

      test('disables the DAC if bits 3-7 are zero', () => {
        apu.write(AUDIO_REGISTERS.NR42, 0x07);
        expect(apu.channel4.dacEnabled).toBe(false);
      });
    });

    describe('NR43: frequency and randomness', () => {
      test('clock shift', () => {
        apu.write(AUDIO_REGISTERS.NR43, 0xa0);
        expect(apu.channel4.clockShift).toEqual(0xa);
        expect(apu.read(AUDIO_REGISTERS.NR43)).toEqual(0xa0);
      });

      describe('LFSR width', () => {
        test('sets to 7 bits', () => {
          apu.write(AUDIO_REGISTERS.NR43, 0x08);
          expect(apu.channel4.lfsrWidth).toEqual(1);
          expect(apu.read(AUDIO_REGISTERS.NR43)).toEqual(0x08);
        });

        test('sets to 15 bits', () => {
          apu.write(AUDIO_REGISTERS.NR43, 0x00);
          expect(apu.channel4.lfsrWidth).toEqual(0);
          expect(apu.read(AUDIO_REGISTERS.NR43)).toEqual(0x00);
        });
      });

      test('clock divider', () => {
        apu.write(AUDIO_REGISTERS.NR43, 0x02);
        expect(apu.channel4.clockDivider).toEqual(2);
        expect(apu.read(AUDIO_REGISTERS.NR43)).toEqual(0x02);
      });
    });

    describe('NR44: control', () => {
      describe('length timer', () => {
        test('enables length timer', () => {
          apu.write(AUDIO_REGISTERS.NR44, 0x40);
          expect(apu.channel4.enableLengthTimer).toBe(true);
          expect(apu.read(AUDIO_REGISTERS.NR44)).toEqual(0x7f);
        });

        test('disables length timer', () => {
          apu.write(AUDIO_REGISTERS.NR44, 0x00);
          expect(apu.channel4.enableLengthTimer).toBe(false);
          expect(apu.read(AUDIO_REGISTERS.NR44)).toEqual(0x3f);
        });
      });

      test('trigger', () => {
        jest.spyOn(apu.channel4, 'trigger');
        expect(apu.channel4.enabled).toBe(false);
        apu.write(AUDIO_REGISTERS.NR44, 0x80);
        expect(apu.channel4.enabled).toBe(true);
        expect(apu.channel4.trigger).toHaveBeenCalledTimes(1);
      });
    });
  });

  test('wave RAM', () => {
    for (let i = 0; i < 16; i++) {
      apu.write(0xff30 + i, WAVE[i]);
    }
    for (let j = 0; j < 16; j++) {
      expect(apu.read(0xff30 + j)).toEqual(WAVE[j]);
    }
  });

  describe('clock', () => {
    test('steps length timer every 2 ticks', () => {
      jest.spyOn(apu.channel1, 'step');
      jest.spyOn(apu.channel2, 'step');
      jest.spyOn(apu.channel3, 'step');
      jest.spyOn(apu.channel4, 'step');

      apu.clock = 0;

      for (let i = 0; i < 16; i++) {
        const calls = Math.floor(i / 2);
        expect(apu.channel1.step).toHaveBeenCalledTimes(calls);
        expect(apu.channel2.step).toHaveBeenCalledTimes(calls);
        expect(apu.channel3.step).toHaveBeenCalledTimes(calls);
        expect(apu.channel4.step).toHaveBeenCalledTimes(calls);
        apu.step();
      }
    });

    test('steps channel 1 period sweep every 4 ticks', () => {
      jest.spyOn(apu.channel1, 'periodSweep');

      apu.clock = 0;

      for (let i = 0; i < 16; i++) {
        const calls = Math.floor(i / 4);
        expect(apu.channel1.periodSweep).toHaveBeenCalledTimes(calls);
        apu.step();
      }
    });

    test('steps channel 1, 2 and 4 envelope sweep every 8 ticks', () => {
      jest.spyOn(apu.channel1, 'envelopeSweep');
      jest.spyOn(apu.channel2, 'envelopeSweep');
      jest.spyOn(apu.channel4, 'envelopeSweep');

      apu.clock = 0;

      for (let i = 0; i < 64; i++) {
        const calls = Math.floor(i / 8);
        expect(apu.channel1.envelopeSweep).toHaveBeenCalledTimes(calls);
        expect(apu.channel2.envelopeSweep).toHaveBeenCalledTimes(calls);
        expect(apu.channel4.envelopeSweep).toHaveBeenCalledTimes(calls);
        apu.step();
      }
    });
  });
});
