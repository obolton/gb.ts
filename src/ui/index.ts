import GameBoy from '../gb';
import { Button } from '../input/constants';
import './index.css';

const BUTTON_MAPPING = {
  up: Button.UP,
  down: Button.DOWN,
  left: Button.LEFT,
  right: Button.RIGHT,
  a: Button.A,
  b: Button.B,
  start: Button.START,
  select: Button.SELECT,
};

const KEY_MAPPING: { [code: string]: Button } = {
  ArrowUp: Button.UP,
  ArrowDown: Button.DOWN,
  ArrowLeft: Button.LEFT,
  ArrowRight: Button.RIGHT,
  KeyA: Button.A,
  KeyS: Button.B,
  Space: Button.SELECT,
  Enter: Button.START,
};

(function init() {
  const display = document.getElementById('display') as HTMLCanvasElement;
  const fileInput = document.getElementById(
    'romSelectorInput'
  ) as HTMLInputElement;
  const device = document.getElementById('device') as HTMLDivElement;
  const powerButton = document.getElementById(
    'powerButton'
  ) as HTMLButtonElement;
  const controls = document.getElementById('controls') as HTMLDivElement;

  const gameboy = new GameBoy(display);

  // Bind button events
  Object.entries(BUTTON_MAPPING).forEach(([id, button]) => {
    const element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.addEventListener('mousedown', (event) => {
      gameboy.input.buttonDown(button);
      event.preventDefault();
      event.stopPropagation();
    });
    element.addEventListener('touchstart', (event) => {
      gameboy.input.buttonDown(button);
      event.preventDefault();
      event.stopPropagation();
    });
    element.addEventListener('mouseup', (event) => {
      gameboy.input.buttonUp(button);
      event.preventDefault();
      event.stopPropagation();
    });
    element.addEventListener('touchend', (event) => {
      gameboy.input.buttonUp(button);
      event.preventDefault();
      event.stopPropagation();
    });
  });

  // Disable other touch events
  controls.addEventListener('touchstart', (event) => {
    event.preventDefault();
  });

  powerButton.addEventListener('click', () => {
    gameboy.stop();
    display.getContext('2d')?.clearRect(0, 0, display.width, display.height);
    device.classList.remove('on');
    powerButton.disabled = true;
  });

  // Bind key events
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    const button = KEY_MAPPING[event.code];
    if (typeof button !== 'undefined') {
      gameboy.input.buttonDown(button);
      event.preventDefault();
      event.stopPropagation();
    }
  });
  window.addEventListener('keyup', (event: KeyboardEvent) => {
    const button = KEY_MAPPING[event.code];
    if (typeof button !== 'undefined') {
      gameboy.input.buttonUp(button);
      event.preventDefault();
      event.stopPropagation();
    }
  });

  // File selection
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const result = reader.result;
    if (!(result instanceof ArrayBuffer)) {
      throw new Error('Invalid file');
    }
    device.classList.add('on');
    powerButton.disabled = false;
    const rom = new Uint8Array(result);
    try {
      gameboy.start(rom);
    } catch (error) {
      if (error instanceof Error) {
        window.alert(error.message);
        device.classList.remove('on');
        powerButton.disabled = true;
      }
    }
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      reader.readAsArrayBuffer(file);
      fileInput.value = '';
    }
  });
})();
