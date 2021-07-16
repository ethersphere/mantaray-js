import { initManifestNode, MantarayNode } from '../src'
import { gen32Bytes } from '../src/utils'

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
