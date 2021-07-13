import { Reference } from "./types";

export function checkReference(ref: Reference): void | never {
  if(!(ref instanceof Uint8Array)) {
    throw new Error('Given referennce is not an Uint8Array instance.')
  }
  if(ref.length !== 32 && ref.length !== 64) {
    throw new Error(`Wrong reference length. Entry only can be 32 or 64 length in bytes`)
  }
}
