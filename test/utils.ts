import { MarshalVersion, MantarayNode, Mantaray0_2, Mantaray1_0 } from '../src'
import { gen32Bytes } from '../src/utils'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeEqualNode0_2(compareTo: Mantaray0_2.MantarayNode): R
      toBeEqualNode1_0(compareTo: Mantaray1_0.MantarayNode): R
    }
  }
}

/**
 * Load common own Jest Matchers which can be used to check particular return values.
 */
export function commonMatchers(): void {
  expect.extend({
    toBeEqualNode0_2(received: MantarayNode<'0.2'>, compareTo: MantarayNode<'0.2'>) {
      const result = {
        pass: true,
        message: () => 'Given Manatary nodes are equal',
      }

      try {
        Mantaray0_2.equalNodes(received, compareTo)
      } catch (e) {
        result.pass = false
        result.message = () => e.message
      }

      return result
    },
    toBeEqualNode1_0(received: MantarayNode<'1.0'>, compareTo: MantarayNode<'1.0'>) {
      const result = {
        pass: true,
        message: () => 'Given Manatary nodes are equal',
      }

      try {
        Mantaray1_0.equalNodes(received, compareTo)
      } catch (e) {
        result.pass = false
        result.message = () => e.message
      }

      return result
    },
  })
}

export function getSampleMantarayNode<Version extends MarshalVersion>(version: Version): { node: MantarayNode<Version>; paths: Uint8Array[] } {
  let node: MantarayNode<Version>
  switch(version) {
    case '1.0':
      node = new Mantaray1_0.MantarayNode() as MantarayNode<Version>
    case '0.2':
      node = new Mantaray0_2.MantarayNode() as MantarayNode<Version>
  }
  const randAddress = gen32Bytes()
  node.setEntry = randAddress
  const path1 = new TextEncoder().encode('path1/valami/elso')
  const path2 = new TextEncoder().encode('path1/valami/masodik')
  const path3 = new TextEncoder().encode('path1/valami/masodik.ext')
  const path4 = new TextEncoder().encode('path1/valami')
  const path5 = new TextEncoder().encode('path2')
  node.addFork(path1, randAddress, { vmi: 'elso' })
  node.addFork(path2, randAddress)
  node.addFork(path3, randAddress)
  node.addFork(path4, randAddress, { vmi: 'negy' })
  node.addFork(path5, randAddress)

  return {
    node,
    paths: [path1, path2, path3, path4, path5],
  }
}
