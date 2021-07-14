import type { Message } from 'js-sha3';
import { keccak256 } from 'js-sha3';
import { Bytes, Reference } from "./types";

export function checkReference(ref: Reference): void | never {
  if(!(ref instanceof Uint8Array)) {
    throw new Error('Given referennce is not an Uint8Array instance.')
  }
  if(ref.length !== 32 && ref.length !== 64) {
    throw new Error(`Wrong reference length. Entry only can be 32 or 64 length in bytes`)
  }
}

export function checkBytes<Length extends number>(bytes: unknown, length: number): asserts bytes is Bytes<Length> {
  if(!(bytes instanceof Uint8Array)) throw Error('Cannot set given bytes, because is not an Uint8Array type')
  if(bytes.length !== 32) throw Error(`Cannot set given bytes, because it does not have ${length} length. Got ${bytes.length}`)
}

/**
 * Finds starting index `searchFor` in `element` Uin8Arrays
 * 
 * If `searchFor` is not found in `element` it returns -1
 * 
 * @param element 
 * @param searchFor 
 * @returns starting index of `searchFor` in `element`
 */
export function findIndexOfArray(element: Uint8Array, searchFor: Uint8Array): number {
  for(let i = 0; i < element.length - searchFor.length; i++) {
    let j = 0
    while(j < searchFor.length) {
      if(element[i + j] !== searchFor[j++]) break
    }

    if(j === searchFor.length) return i
  }

  return -1
}

/** Overwrites `a` bytearrays elements with elements of `b` starts from `i` */
export function overwriteBytes(a: Uint8Array, b: Uint8Array, i = 0) {
  if(a.length < b.length + i) throw Error(`Cannot copy bytes because the base byte array length is lesser (${a.length}) than the others (${b.length})`)

  for(let index = 0; index < b.length; index++) {
    a[index + i] = b[index]
  }
}

/** 
 * Flattens the given array that consist of Uint8Arrays. 
 */
export function flattenBytesArray(bytesArray: Uint8Array[]): Uint8Array {
  if(bytesArray.length === 0) return new Uint8Array(0)

  const bytesLength = bytesArray.map(v => v.length).reduce((sum, v) => sum += v)
  const flattenBytes = new Uint8Array(bytesLength)
  let nextWriteIndex = 0
  for(const b of bytesArray) {
    overwriteBytes(flattenBytes, b, nextWriteIndex)
    nextWriteIndex += b.length
  }
  
  return flattenBytes
}

export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if(a.length !== b.length) return false
  
  return a.every((byte, index) => b[index] === byte)
}

/**
 * runs a XOR operation on data, encrypting it if it
 * hasn't already been, and decrypting it if it has, using the key provided.
 */
export function encryptDecrypt(key: Uint8Array, data: Uint8Array, startIndex = 0, endIndex?: number) {
  endIndex ||= data.length

  for(let i = startIndex; i < endIndex; i += key.length) {
    const maxChunkIndex = i + key.length 
    const encryptionChunkEndIndex = maxChunkIndex <= data.length ? maxChunkIndex : data.length
    const encryptionChunk = data.slice(i, encryptionChunkEndIndex)
    for(let j = 0; j < encryptionChunk.length; j++) {
      encryptionChunk[j] = Number(encryptionChunk[j]) ^ Number(key[j % key.length])
    }
    data.set(encryptionChunk, i)
  }
}

export function keccak256Hash(...messages: Message[]): Bytes<32> {
  const hasher = keccak256.create()

  messages.forEach(bytes => hasher.update(bytes))

  return Uint8Array.from(hasher.digest()) as Bytes<32>
}
