import { Utils } from '@ethersphere/bee-js'
import { MantarayNode, Mantaray0_2, Mantaray1_0, Reference, MetadataMapping } from '../src'
import { gen32Bytes } from '../src/utils'

const { hexToBytes } = Utils.Hex

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

export function getSampleMantarayNode0_2(): { node: MantarayNode<'0.2'>; paths: Uint8Array[] } {
  const node: MantarayNode<'0.2'> = new Mantaray0_2.MantarayNode()
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

type SampleFork1_0 = {
  path: Uint8Array
  entry?: Reference
  nodeMetadata?: MetadataMapping
  forkMetadata?: MetadataMapping
}

type SampleForks1_0 = {
  /** encrypted entry with forkMetadata */
  fork1: SampleFork1_0
  /** edge node with reference */
  fork2: SampleFork1_0
  /** leaf node with nodeMetadata without reference */
  fork3: SampleFork1_0
  /** edge node without reference with node and forkMetadata  */
  fork4: SampleFork1_0
  /** standalone/empty leaf node */
  fork5: SampleFork1_0
}

export function getSampleMantarayNode1_0(): { node: MantarayNode<'1.0'>; forks: SampleForks1_0 } {
  const node: MantarayNode<'1.0'> = new Mantaray1_0.MantarayNode()
  const forks: SampleForks1_0 = {
    fork1: {
      path: new TextEncoder().encode('path1/valami/elso'),
      entry: hexToBytes<32>(
        '7d4ccc856f51d0477fde68f9f06bca97c6cd3b4a86b3369ea6489ceaf7b315577d4ccc856f51d0477fde68f9f06bca97c6cd3b4a86b3369ea6489ceaf7b31557',
      ),
      forkMetadata: { vmi: 'elso' },
    },
    fork2: {
      path: new TextEncoder().encode('path1/valami/masodik'),
      entry: hexToBytes<32>('4a07606f59562544dd37d26a219a65144e8cf3321b21276d8ea8de4af3ecee63'),
    },
    fork3: {
      path: new TextEncoder().encode('path1/valami/masodik.ext'),
      nodeMetadata: { vmi2: 'harmadik' },
    },
    fork4: {
      path: new TextEncoder().encode('path1/valami'),
      forkMetadata: { vmi: 'negy' },
      nodeMetadata: { vmi: 'negy!', vmi2: 123 },
    },
    fork5: {
      path: new TextEncoder().encode('path2'),
    },
  }
  for (const fork of Object.values(forks)) {
    node.addFork(fork.path, {
      entry: fork.entry,
      nodeMetadata: fork.nodeMetadata,
      forkMetadata: fork.forkMetadata,
      autoForkMetadataSize: true,
    })
  }

  return {
    node,
    forks,
  }
}
