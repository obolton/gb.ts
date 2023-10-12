import type { IO } from '../../src/types';

export default class MockIO implements IO {
  values: Uint8Array;

  constructor(length: number = 256) {
    this.values = new Uint8Array(length);
  }

  read = jest.fn((address: number) => {
    return this.values[address] ?? 0xff;
  });

  write = jest.fn((address: number, value: number) => {
    this.values[address] = value;
  });

  set(source: number[], offset = 0) {
    this.values.set(source, offset);
  }

  reset() {
    this.values = new Uint8Array(this.values.length);
  }
}
