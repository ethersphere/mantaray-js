import { Bee, Utils } from '@ethersphere/bee-js'
import FS from 'fs'
import { join } from 'path'
import { MantarayNode } from '../src'
import { loadAllNodes } from '../src/node'
import type { Reference } from '../src/types'
import { commonMatchers } from './utils'

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

  const testPage = join(__dirname, 'testpage')
  const indexHtmlBytes = FS.readFileSync(join(testPage, 'index.html'))
  const imageBytes = FS.readFileSync(join(testPage, 'img', 'icon.png'))
  const [indexReference, imageReference, haliReference] = await Promise.all([
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
  iNode.addFork(utf8ToBytes('img/icon.png.txt'), hexToBytes(haliReference), {
    'Content-Type': 'text/plain',
    Filename: 'icon.png.txt',
  })
  iNode.addFork(utf8ToBytes('img/icon.png'), hexToBytes(imageReference), {
    'Content-Type': 'image/png',
    Filename: 'icon.png',
  })
  iNode.addFork(utf8ToBytes('/'), hexToBytes(indexReference), {
    'website-index-document': 'index.html',
  })
  const iNodeRef = await iNode.save(saveFunction)
  expect(Object.keys(iNode.forks)).toStrictEqual(Object.keys(node.forks))
  const marshal = iNode.serialize()
  const iNodeAgain = new MantarayNode()
  iNodeAgain.deserialize(marshal)
  await loadAllNodes(loadFunction, iNodeAgain)
  expect(iNode).toBeEqualNode(iNodeAgain)
  // eslint-disable-next-line no-console
  console.log('Constructed root manifest hash', Utils.Hex.bytesToHex(iNodeRef))
})
