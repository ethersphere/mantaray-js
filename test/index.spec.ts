import { Bee, Utils } from '@ethersphere/bee-js'
import FS from 'fs'
import { join } from 'path'
import { MantarayNode } from '../src'
import { loadAllNodes } from '../src/node'
import type { Reference } from '../src/types'
import { commonMatchers, getSampleMantarayNode } from './utils'

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

/** Uploads the testpage directory with bee-js and return back its root manifest data */
const beeTestPageManifestData = async (): Promise<Uint8Array> => {
  const contentHash = await bee.uploadFilesFromDirectory(process.env.BEE_POSTAGE, join(__dirname, 'testpage'), {
    pin: true,
    indexDocument: 'index.html',
  })

  return bee.downloadData(contentHash) //only download its manifest
}

it('should serialize/deserialize the same as Bee', async () => {
  const data = await beeTestPageManifestData()
  const node = new MantarayNode()
  node.deserialize(data)
  await loadAllNodes(loadFunction, node)
  const serialization = node.serialize()
  // // expect(serialization).toBe(data) -> mantaray-js does not padding the json metadata
  const nodeAgain = new MantarayNode()
  nodeAgain.deserialize(serialization)
  await loadAllNodes(loadFunction, nodeAgain)
  expect(nodeAgain).toStrictEqual(node)
})

it('should construct manifests of testpage folder', async () => {
  const data = await beeTestPageManifestData()
  const node = new MantarayNode()
  node.deserialize(data)
  await loadAllNodes(loadFunction, node)

  const testPage = join(__dirname, 'testpage')
  const indexHtmlBytes = FS.readFileSync(join(testPage, 'index.html'))
  const imageBytes = FS.readFileSync(join(testPage, 'img', 'icon.png'))
  const [indexReference, imageReference, textReference] = await Promise.all([
    bee.uploadData(process.env.BEE_POSTAGE, indexHtmlBytes),
    bee.uploadData(process.env.BEE_POSTAGE, imageBytes),
    bee.uploadData(process.env.BEE_POSTAGE, new Uint8Array([104, 97, 108, 105])),
  ])
  const utf8ToBytes = (value: string): Uint8Array => {
    return new TextEncoder().encode(value)
  }
  const iNode = new MantarayNode()
  iNode.addFork(utf8ToBytes('index.html'), hexToBytes(indexReference), {
    'Content-Type': 'text/html; charset=utf-8',
    Filename: 'index.html',
  })
  iNode.addFork(utf8ToBytes('img/icon.png.txt'), hexToBytes(textReference), {
    'Content-Type': '', // FIXME: The bee node assigns empty string to Content Type in this case
    Filename: 'icon.png.txt',
  })
  iNode.addFork(utf8ToBytes('img/icon.png'), hexToBytes(imageReference), {
    'Content-Type': 'image/png',
    Filename: 'icon.png',
  })
  iNode.addFork(utf8ToBytes('/'), new Uint8Array(32) as Reference, {
    'website-index-document': 'index.html',
  })
  const iNodeRef = await iNode.save(saveFunction)
  expect(Object.keys(iNode.forks)).toStrictEqual(Object.keys(node.forks))
  const marshal = iNode.serialize()
  const iNodeAgain = new MantarayNode()
  iNodeAgain.deserialize(marshal)
  await loadAllNodes(loadFunction, iNodeAgain)
  // check after serialization the object is same
  expect(iNode).toBeEqualNode(iNodeAgain)
  // check bee manifest is equal with the constructed one.
  expect(iNode).toBeEqualNode(node)
  // eslint-disable-next-line no-console
  console.log('Constructed root manifest hash', Utils.Hex.bytesToHex(iNodeRef))
})

it('should remove fork then upload it', async () => {
  const sampleNode = getSampleMantarayNode()
  const node = sampleNode.node
  const path1 = sampleNode.paths[0]
  const path2 = sampleNode.paths[1]
  // save sample node
  const refOriginal = await node.save(saveFunction)
  /** node where the fork set will change */
  const getCheckNode = (): MantarayNode => {
    return node.getForkAtPath(new TextEncoder().encode('path1/valami/')).node
  }
  const checkNode1 = getCheckNode()
  const refCheckNode1 = checkNode1.getContentAddress
  // current forks of node
  expect(Object.keys(checkNode1.forks)).toStrictEqual([String(path1[13]), String(path2[13])])
  node.removePath(path2)
  const refDeleted = await node.save(saveFunction)
  // root reference should remain the same
  expect(refDeleted).toStrictEqual(refOriginal)
  node.load(loadFunction, refDeleted)
  // 'm' key of prefix table disappeared
  const checkNode2 = getCheckNode()
  expect(Object.keys(checkNode2.forks)).toStrictEqual([String(path1[13])])
  // reference should differ because the changed fork set
  const refCheckNode2 = checkNode2.getContentAddress
  expect(refCheckNode2).not.toStrictEqual(refCheckNode1)
})
