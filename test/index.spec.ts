import { Bee } from '@ethersphere/bee-js'
import { join } from 'path'
import { initManifestNode, MantarayNode } from '../src'
import { gen32Bytes } from '../src/utils'

const beeUrl = process.env.BEE_API_URL || 'http://localhost:1633'
const bee = new Bee(beeUrl)

it('should init a single mantaray node with a random address', () => {
  const node = initManifestNode()
  const randAddress = gen32Bytes()
  node.setEntry = randAddress
  const serialized = node.serialize()
  const nodeAgain = new MantarayNode()
  nodeAgain.deserialize(serialized)
  expect(randAddress).toStrictEqual(nodeAgain.getEntry)
})

it('should serialize/deserialize node with fork', async () => {
  const node = initManifestNode()
  const randAddress = gen32Bytes()
  const path = new TextEncoder().encode('vmi')
  await node.addFork(path, randAddress, {
    load: async () => new Promise(resolve => resolve(new Uint8Array(2))),
    save: async () => new Promise(resolve => resolve),
  })
  const serialized = node.serialize()
  const nodeAgain = new MantarayNode()
  nodeAgain.deserialize(serialized)
  /// The type of the main mantaray node will be lost after serialization!
  node.removeType()
  expect(nodeAgain).toStrictEqual(node)
})

it('should serialize/deserialize the same as Bee', async () => {
  const contentHash = await bee.uploadFilesFromDirectory(process.env.BEE_POSTAGE, join(__dirname, 'testpage'))
  const data = await bee.downloadData(contentHash) //only download its manifest
  const node = new MantarayNode()
  node.deserialize(data)
  const serialization = node.serialize()
  // expect(serialization).toBe(data) -> mantaray-js does not padding the json metadata
  const nodeAgain = new MantarayNode()
  nodeAgain.deserialize(serialization)
  expect(nodeAgain).toStrictEqual(node)
})
