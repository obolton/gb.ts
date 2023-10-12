import Input from '../../src/input/input';
import { Button, INPUT_REGISTER } from '../../src/input/constants';
import { Interrupts } from '../../src/cpu/interrupts';
import MMU from '../../src/memory/mmu';

describe('Input', () => {
  const mmu = new MMU();

  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('initializes the register to the expected value', () => {
    const input = new Input();
    expect(input.read(INPUT_REGISTER)).toEqual(0xff);
  });

  describe('direction butons', () => {
    const input = new Input();
    input.mmu = mmu;
    input.write(INPUT_REGISTER, 0x20);
    jest.spyOn(mmu, 'requestInterrupt');

    test('right', () => {
      input.buttonDown(Button.RIGHT);
      expect(input.read(INPUT_REGISTER)).toEqual(0xee);
      input.buttonUp(Button.RIGHT);
      expect(input.read(INPUT_REGISTER)).toEqual(0xef);
    });

    test('left', () => {
      input.buttonDown(Button.LEFT);
      expect(input.read(INPUT_REGISTER)).toEqual(0xed);
      input.buttonUp(Button.LEFT);
      expect(input.read(INPUT_REGISTER)).toEqual(0xef);
    });

    test('up', () => {
      input.buttonDown(Button.UP);
      expect(input.read(INPUT_REGISTER)).toEqual(0xeb);
      input.buttonUp(Button.UP);
      expect(input.read(INPUT_REGISTER)).toEqual(0xef);
    });

    test('down', () => {
      input.buttonDown(Button.DOWN);
      expect(input.read(INPUT_REGISTER)).toEqual(0xe7);
      input.buttonUp(Button.DOWN);
      expect(input.read(INPUT_REGISTER)).toEqual(0xef);
    });
  });

  describe('action butons', () => {
    const input = new Input();
    input.mmu = mmu;
    input.write(INPUT_REGISTER, 0x10);

    test('a', () => {
      input.buttonDown(Button.A);
      expect(input.read(INPUT_REGISTER)).toEqual(0xde);
      input.buttonUp(Button.A);
      expect(input.read(INPUT_REGISTER)).toEqual(0xdf);
    });

    test('b', () => {
      input.buttonDown(Button.B);
      expect(input.read(INPUT_REGISTER)).toEqual(0xdd);
      input.buttonUp(Button.B);
      expect(input.read(INPUT_REGISTER)).toEqual(0xdf);
    });

    test('select', () => {
      input.buttonDown(Button.SELECT);
      expect(input.read(INPUT_REGISTER)).toEqual(0xdb);
      input.buttonUp(Button.SELECT);
      expect(input.read(INPUT_REGISTER)).toEqual(0xdf);
    });

    test('start', () => {
      input.buttonDown(Button.START);
      expect(input.read(INPUT_REGISTER)).toEqual(0xd7);
      input.buttonUp(Button.START);
      expect(input.read(INPUT_REGISTER)).toEqual(0xdf);
    });
  });

  it('requests a joypad interrupt', () => {
    const input = new Input();
    input.mmu = mmu;
    input.write(INPUT_REGISTER, 0x10);
    input.buttonDown(Button.A);
    expect(mmu.requestInterrupt).toHaveBeenCalledWith(Interrupts.JOYPAD);
  });

  it('does not request an interrupt if the appropriate button type is not selected', () => {
    const requestInterrupt = jest.fn();
    const input = new Input();
    input.mmu = mmu;
    input.write(INPUT_REGISTER, 0x20);
    input.buttonDown(Button.A);
    expect(requestInterrupt).not.toHaveBeenCalled();
  });
});
