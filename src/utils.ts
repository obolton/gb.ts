import type { AddressRange } from './types';

export function inRange(address: number, range: AddressRange) {
  return address >= range.start && address <= range.end;
}

export function toSignedInt(value: number) {
  if (value > 127) {
    return -((~value + 1) & 0xff);
  } else {
    return value;
  }
}
