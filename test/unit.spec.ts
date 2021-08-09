import { initManifestNode, MantarayNode } from '../src'
import { checkForSeparator } from '../src/node'
import { gen32Bytes } from '../src/utils'
import { getSampleMantarayNode } from './utils'

it('should init a single mantaray node with a random address', () => {
  const node = initManifestNode()
  const randAddress = gen32Bytes()
  node.setEntry = randAddress
  const serialized = node.serialize()
  const nodeAgain = new MantarayNode()
  nodeAgain.deserialize(serialized)
  expect(randAddress).toStrictEqual(nodeAgain.getEntry)
})

it('tests getForkAtPath method of node and checkForSeparator function', () => {
  const sampleNode = getSampleMantarayNode()
  const node = sampleNode.node
  expect(() => node.getForkAtPath(new TextEncoder().encode('path/not/exists'))).toThrowError()

  const fork1 = node.getForkAtPath(new TextEncoder().encode('path1/valami/')) // no separator in the descendants
  expect(checkForSeparator(fork1.node)).toBeFalsy()

  const path2 = sampleNode.paths[3] // separator in the descendants
  const fork2 = node.getForkAtPath(path2)
  expect(checkForSeparator(fork2.node)).toBeTruthy()

  const path3 = sampleNode.paths[4] // no separator in the descendants, no forks
  const fork3 = node.getForkAtPath(path3)
  expect(checkForSeparator(fork3.node)).toBeFalsy()
})

it('should throw exception on serialize if there were no storage saves before', () => {
  const node = initManifestNode()
  const randAddress = gen32Bytes()
  const path = new TextEncoder().encode('vmi')
  node.addFork(path, randAddress)
  expect(() => node.serialize()).toThrowError()
})

it('checks the expected structure of the sample mantaray node', () => {
  const sampleNode = getSampleMantarayNode()
  const node = sampleNode.node
  const path1 = sampleNode.paths[0]
  const path2 = sampleNode.paths[1]
  const path3 = sampleNode.paths[2]
  const path5 = sampleNode.paths[4]

  expect(Object.keys(node.forks)).toStrictEqual([String(path1[0])]) // first level: 'p'
  const secondLevelFork = node.forks![path5[0]]
  expect(secondLevelFork.prefix).toStrictEqual(new TextEncoder().encode('path'))
  const secondLevelNode = secondLevelFork.node
  expect(Object.keys(secondLevelNode.forks)).toStrictEqual([String(path1[4]), String(path5[4])]) // second level: '1', '2'
  const thirdLevelFork2 = secondLevelNode.forks[path5[4]]
  expect(thirdLevelFork2.prefix).toStrictEqual(new Uint8Array([path5[4]]))
  const thirdLevelFork1 = secondLevelNode.forks[path1[4]]
  expect(thirdLevelFork1.prefix).toStrictEqual(new TextEncoder().encode('1/valami'))
  const thirdLevelNode1 = thirdLevelFork1.node
  expect(Object.keys(thirdLevelNode1.forks)).toStrictEqual([String(path1[12])]) // third level 1: '/'
  const forthLevelFork1 = thirdLevelNode1.forks![path1[12]]
  expect(forthLevelFork1.prefix).toStrictEqual(new Uint8Array([path1[12]]))
  const fourthLevelNode1 = forthLevelFork1.node
  expect(Object.keys(fourthLevelNode1.forks)).toStrictEqual([String(path1[13]), String(path2[13])]) // fourth level 1: 'e', 'm'
  const fifthLevelFork2 = fourthLevelNode1.forks![path2[13]]
  expect(fifthLevelFork2.prefix).toStrictEqual(new TextEncoder().encode('masodik'))
  const fifthLevelNode2 = fifthLevelFork2.node
  expect(Object.keys(fifthLevelNode2.forks)).toStrictEqual([String(path3[20])]) // fifth level 2: '.'
  const sixthLevelNode1 = fifthLevelNode2.forks[path3[20]]
  expect(sixthLevelNode1.prefix).toStrictEqual(new TextEncoder().encode('.ext'))
})

it('should remove forks', () => {
  const sampleNode = getSampleMantarayNode()
  const node = sampleNode.node
  // save sample node
  const path1 = sampleNode.paths[0]
  const path2 = sampleNode.paths[1]

  // non existing path check
  expect(() => node.removePath(new Uint8Array([0, 1, 2]))).toThrowError()
  // node where the fork set will change
  const checkNode1 = node.getForkAtPath(new TextEncoder().encode('path1/valami/')).node
  // current forks of node
  expect(Object.keys(checkNode1.forks)).toStrictEqual([String(path1[13]), String(path2[13])])
  node.removePath(path2)
  // 'm' key of prefix table disappeared
  expect(Object.keys(checkNode1.forks)).toStrictEqual([String(path1[13])])
})
