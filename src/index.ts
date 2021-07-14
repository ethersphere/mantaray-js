import { nanoid } from 'nanoid/non-secure'
import { MantarayNode } from './node'
import { Bytes } from './types'

function gen32Bytes(): Bytes<32> {
  return new TextEncoder().encode(nanoid(32)) as Bytes<32>
}

function initManifestNode(options?: {obfuscationKey?: Bytes<32>}): MantarayNode {
  const manifestNode = new MantarayNode()
  manifestNode.setObfuscationKey = options?.obfuscationKey || gen32Bytes()

  return manifestNode
}

function test() {
  console.log('test1')
  const node = initManifestNode()
  const randAddress = gen32Bytes()
  node.setEntry = randAddress
  console.log('entry', randAddress)
  const serialized = node.serialize()
  const nodeAgain = new MantarayNode()
  console.log('serialized', serialized)
  nodeAgain.deserialize(serialized)
  console.log('entry again', nodeAgain.getEntry)
}

async function test2() {
  console.log('test2')
  const node = initManifestNode()
  const randAddress = gen32Bytes()
  const path = new TextEncoder().encode('vmi')
  console.log('fork address', randAddress)
  await node.add(path, randAddress, { 
    load: () => new Promise(resolve => resolve(new Uint8Array(2))),
    save: () => new Promise(resolve => resolve)
  })
  console.log('helloka')
  const serialized = node.serialize()
  const nodeAgain = new MantarayNode()
  nodeAgain.deserialize(serialized)
  console.log('forks', nodeAgain.forks)
  console.log('fork address again', nodeAgain.forks![path[0]])
  
  console.log('successful run!')
}

test()
console.log('='.repeat(process.stdout.columns))
test2()
