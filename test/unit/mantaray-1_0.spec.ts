import { initManifestNode, Mantaray1_0 } from '../../src'
import { gen32Bytes } from '../../src/utils'
import { getSampleMantarayNode1_0 } from '../utils'

const { MantarayNode } = Mantaray1_0

describe('Mantaray 1.0 Unit Tests', () => {
  it('should init a single mantaray node with a random address', () => {
    const node = initManifestNode()
    const randAddress = gen32Bytes()
    node.setEntry = randAddress
    const serialized = node.serialize()
    const nodeAgain = new MantarayNode()
    nodeAgain.deserialize(serialized)
    expect(randAddress).toStrictEqual(nodeAgain.getEntry)
  })
  
  it('should throw exception on serialize if there were no storage saves before', () => {
    const node = initManifestNode()
    const randAddress = gen32Bytes()
    const path = new TextEncoder().encode('vmi')
    node.addFork(path, randAddress)
    expect(() => node.serialize()).toThrowError()
  })
  
  it('checks the expected structure of the sample mantaray node', () => {
    const sampleNode = getSampleMantarayNode1_0()
    const node = sampleNode.node
    const { fork1, fork2, fork3, fork5 } = sampleNode.forks
    const path1 = fork1.path
    const path2 = fork2.path
    const path3 = fork3.path
    const path5 = fork5.path
  
    expect(Object.keys(node.forks)).toStrictEqual([String(path1[0])]) // first level: 'p'
    const secondLevelFork = node.forks![path5[0]]
    console.log('secondlevel prefix', new TextDecoder().decode(secondLevelFork.prefix))
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

  it('checks nodeMetadata', () => {
    //TODO
  })
  
  it('should remove forks', () => {
    const sampleNode = getSampleMantarayNode1_0()
    const node = sampleNode.node
    const { fork1, fork2 } = sampleNode.forks
    // save sample node
    const path1 = fork1.path
    const path2 = fork2.path
  
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
})
