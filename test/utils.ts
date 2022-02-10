import { Utils } from '@ethersphere/bee-js'
import { MantarayNode, MantarayV0_2, MantarayV1, Reference, MetadataMapping } from '../src'
import { MantarayFork } from '../src/node-v1'
import { equalBytes, gen32Bytes } from '../src/utils'

const { hexToBytes } = Utils.Hex

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeEqualNode0_2(compareTo: MantarayV0_2.MantarayNode): R
      toBeEqualNode1_0(compareTo: MantarayV1.MantarayNode): R
    }
  }
}

class NodesNotSame extends Error {
  constructor(error: string, path: string) {
    super(`"Error: ${error} \n\ton path: ${path}`)
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
        MantarayV0_2.equalNodes(received, compareTo)
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
        equalNodes1_0(received, compareTo)
      } catch (e) {
        result.pass = false
        result.message = () => e.message
      }

      return result
    },
  })
}

export function getSampleMantarayNode0_2(): { node: MantarayNode<'0.2'>; paths: Uint8Array[] } {
  const node: MantarayNode<'0.2'> = new MantarayV0_2.MantarayNode()
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
  /** really long path to create continuous node */
  fork6: SampleFork1_0
}

export function getSampleMantarayNode1_0(): { node: MantarayNode<'1.0'>; forks: SampleForks1_0 } {
  const node: MantarayNode<'1.0'> = new MantarayV1.MantarayNode()
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
    fork6: {
      path: new TextEncoder().encode('path3/reallylongpathtotestcontinuousnodeandasyouseeiamstillwritingthis'),
      entry: hexToBytes<32>(
        '7c4ccc856f51d0477fde68f9f06bca97c6cd3b4a86b3369ea6489ceaf7b315577d4ccc856f51d0477fde68f9f06bca97c6cd3b4a86b3369ea6489ceaf7b31557',
      ),
    },
  }
  for (const fork of Object.values(forks)) {
    node.addFork(fork.path, {
      entry: fork.entry,
      nodeMetadata: fork.nodeMetadata,
      forkMetadata: fork.forkMetadata,
    })
  }

  return {
    node,
    forks,
  }
}

/**
 * Throws an error if the given nodes properties are not equal
 *
 * @param a Mantaray node to compare
 * @param b Mantaray node to compare
 * @param accumulatedPrefix accumulates the prefix during the recursion
 * @throws Error if the two nodes properties are not equal recursively
 */
// eslint-disable-next-line complexity
export const equalNodes1_0 = (a: MantarayNode<'1.0'>, b: MantarayNode<'1.0'>, accumulatedPrefix = ''): void | never => {
  // node flags comparisation
  if (a.isContinuousNode !== b.isContinuousNode) {
    throw new NodesNotSame(
      `Nodes do not have same isContinuousNode flags. a: ${a.isContinuousNode} ; b: ${b.isContinuousNode}`,
      accumulatedPrefix,
    )
  }

  if (a.hasEntry !== b.hasEntry) {
    throw new NodesNotSame(
      `Nodes do not have same hasEntry flags. a: ${a.hasEntry} ; b: ${b.hasEntry}`,
      accumulatedPrefix,
    )
  }

  if (Boolean(a.encEntry) !== Boolean(b.encEntry)) {
    throw new NodesNotSame(
      `Nodes do not have same encEntry flags. a: ${a.encEntry} ; b: ${b.encEntry}\n\tAccumulated prefix: ${accumulatedPrefix}`,
      accumulatedPrefix,
    )
  }

  if (a.isEdge !== b.isEdge) {
    throw new NodesNotSame(`Nodes do not have same isEdge flags. a: ${a.isEdge} ; b: ${b.isEdge}`, accumulatedPrefix)
  }

  if (a.forkMetadataSegmentSize !== b.forkMetadataSegmentSize) {
    throw new NodesNotSame(
      `Nodes do not have same forkMetadataSegmentSize. a: ${a.forkMetadataSegmentSize} ; b: ${b.forkMetadataSegmentSize}`,
      accumulatedPrefix,
    )
  }

  // node metadata comparisation
  if (!a.nodeMetadata !== !b.nodeMetadata) {
    throw new NodesNotSame(
      `One of the nodes does not have nodeMetadata defined. a: ${a.nodeMetadata} b: ${b.nodeMetadata}`,
      accumulatedPrefix,
    )
  }

  if (a.nodeMetadata && b.nodeMetadata) {
    expect(a.nodeMetadata).toStrictEqual(b.nodeMetadata)
  }

  // node metadata comparisation
  if (!a.forkMetadata !== !b.forkMetadata) {
    throw new NodesNotSame(
      `One of the nodes does not have forkMetadata defined. a: ${a.forkMetadata} b: ${b.forkMetadata}`,
      accumulatedPrefix,
    )
  }

  if (a.forkMetadata && b.forkMetadata) {
    expect(a.forkMetadata).toStrictEqual(b.forkMetadata)
  }

  // node entry comparisation
  if (!equalBytes(a.entry || new Uint8Array(0), b.entry || new Uint8Array(0))) {
    throw new NodesNotSame(`Nodes do not have same entries. a: ${a.entry} ; b: ${b.entry}`, accumulatedPrefix)
  }

  if (!a.forks) return

  // node fork comparisation
  const aKeys = Object.keys(a.forks)

  if (!b.forks || aKeys.length !== Object.keys(b.forks).length) {
    throw new NodesNotSame(
      `Nodes do not have same fork length on equality check at prefix ${accumulatedPrefix}`,
      accumulatedPrefix,
    )
  }

  for (const key of aKeys) {
    const aFork: MantarayFork = a.forks[Number(key)]
    const bFork: MantarayFork = b.forks[Number(key)]
    const prefix = aFork.prefix
    const prefixString = new TextDecoder().decode(prefix)

    if (!equalBytes(prefix, bFork.prefix)) {
      throw new NodesNotSame(`Nodes do not have same prefix under the same key "${key}"`, accumulatedPrefix)
    }

    equalNodes1_0(aFork.node, bFork.node, accumulatedPrefix + prefixString)
  }
}
