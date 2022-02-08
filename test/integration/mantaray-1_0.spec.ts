import { Bee, Utils } from '@ethersphere/bee-js'
import { Mantaray1_0 } from '../../src'
import { loadAllNodes } from '../../src/node-1_0'
import type { Reference } from '../../src/types'
import { commonMatchers, getSampleMantarayNode1_0 } from '../utils'

commonMatchers()
const beeUrl = process.env.BEE_API_URL || 'http://localhost:1633'
const bee = new Bee(beeUrl)

const hexToBytes = (hexString: string): Reference => {
  return Utils.Hex.hexToBytes(hexString)
}

const saveFunction = async (data: Uint8Array): Promise<Reference> => {
  const hexRef = await bee.uploadData(process.env.BEE_POSTAGE, data)

  return hexToBytes(hexRef)
}

const loadFunction = async (address: Reference): Promise<Uint8Array> => {
  return bee.downloadData(Utils.Hex.bytesToHex(address))
}

describe('Mantaray 1.0 integration tests', () => {
  it('Marshalling whole trie then comparing all nodes with their original', async () => {
    const samples = getSampleMantarayNode1_0()
    const rootNode = samples.node
    const address = await rootNode.save(saveFunction)
    const rootNodeAgain = new Mantaray1_0.MantarayNode()
    await rootNodeAgain.load(loadFunction, address)
    await loadAllNodes(loadFunction, rootNodeAgain)

    // expect(Object.keys(nodeAgain.forks)).toStrictEqual([String(samples.forks.fork1.path[0])]) // first level: 'p'
    // expect(nodeAgain.getIsEdge).toBe(true)
    // expect(nodeAgain.getHasEntry).toBe(false)
    expect(rootNodeAgain).toBeEqualNode1_0(rootNode)
  })
})
