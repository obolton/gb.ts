import { Interrupts } from '../cpu/interrupts';
import type MMU from '../memory/mmu';
import {
  Button,
  ACTION_BUTTONS,
  DIRECTION_BUTTONS,
  INPUT_REGISTER,
} from './constants';
import { IO } from '../types';

export default class Input implements IO {
  mmu?: MMU;

  buttonStates = [false, false, false, false, false, false];
  selectActionButtons = false;
  selectDirectionButtons = false;

  reset() {
    this.buttonStates = [false, false, false, false, false, false];
    this.selectActionButtons = false;
    this.selectDirectionButtons = false;
  }

  write(address: number, value: number) {
    if (address !== INPUT_REGISTER) {
      return;
    }

    this.selectActionButtons = (value & 0x20) === 0;
    this.selectDirectionButtons = (value & 0x10) === 0;
  }

  read(address: number) {
    if (address !== INPUT_REGISTER) {
      return 0xff;
    }

    if (this.selectActionButtons) {
      return (
        0xc0 |
        (this.selectActionButtons ? 0 : 0x20) |
        (this.selectDirectionButtons ? 0 : 0x10) |
        (this.buttonStates[Button.START] ? 0 : 0x08) |
        (this.buttonStates[Button.SELECT] ? 0 : 0x04) |
        (this.buttonStates[Button.B] ? 0 : 0x02) |
        (this.buttonStates[Button.A] ? 0 : 0x01)
      );
    }

    if (this.selectDirectionButtons) {
      return (
        0xc0 |
        (this.selectActionButtons ? 0 : 0x20) |
        (this.selectDirectionButtons ? 0 : 0x10) |
        (this.buttonStates[Button.DOWN] ? 0 : 0x08) |
        (this.buttonStates[Button.UP] ? 0 : 0x04) |
        (this.buttonStates[Button.LEFT] ? 0 : 0x02) |
        (this.buttonStates[Button.RIGHT] ? 0 : 0x01)
      );
    }

    return 0xff;
  }

  buttonDown(button: Button) {
    this.buttonStates[button] = true;
    if (
      (this.selectDirectionButtons && DIRECTION_BUTTONS.includes(button)) ||
      (this.selectActionButtons && ACTION_BUTTONS.includes(button))
    ) {
      this.mmu?.requestInterrupt(Interrupts.JOYPAD);
    }
  }

  buttonUp(button: Button) {
    this.buttonStates[button] = false;
  }
}
