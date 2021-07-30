import { MantarayNode, sameNodes } from '../src/node'

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
        sameNodes(received, compareTo)
      } catch (e) {
        result.pass = false
        result.message = () => e.message
      }

      return result
    },
  })
}
