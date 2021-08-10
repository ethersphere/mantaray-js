import { equalNodes, MantarayNode } from '../src/node'
import { gen32Bytes } from '../src/utils'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeEqualNode(compareTo: MantarayNode): R
    }
  }
}

/**
 * Load common own Jest Matchers which can be used to check particular return values.
 */
export function commonMatchers(): void {
  expect.extend({
    toBeEqualNode(received: MantarayNode, compareTo: MantarayNode) {
      const result = {
        pass: true,
        message: () => 'Given Manatary nodes are equal',
      }

      try {
        equalNodes(received, compareTo)
      } catch (e) {
        result.pass = false
        result.message = () => e.message
      }

      return result
    },
  })
}

export function getSampleMantarayNode(): { node: MantarayNode; paths: Uint8Array[] } {
  const node = new MantarayNode()
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
