import { initManifestNode, Mantaray1_0 } from '../../src'
import { gen32Bytes } from '../../src/utils'
import { getSampleMantarayNode1_0 } from '../utils'

const { MantarayNode } = Mantaray1_0

/** Used for checking correct serialisation of the node */
function serialiseDeserialise(node: Mantaray1_0.MantarayNode): Mantaray1_0.MantarayNode {
  const serialized = node.serialize()
  const nodeAgain = new MantarayNode()
  nodeAgain.deserialize(serialized)

  return nodeAgain
}

describe('Mantaray 1.0 Unit Tests', () => {
  it('should init a single mantaray node with a random address', () => {
    const node = initManifestNode({ version: '1.0' })
    const randAddress = gen32Bytes()
    node.entry = randAddress
    const obfuscationKey = gen32Bytes()
    node.obfuscationKey = obfuscationKey
    const nodeAgain = serialiseDeserialise(node)
    expect(randAddress).toStrictEqual(nodeAgain.entry)
    expect(obfuscationKey).toStrictEqual(nodeAgain.obfuscationKey)
  })

  it('should throw exception on serialize if there were no storage saves before', () => {
    const node = initManifestNode()
    const randAddress = gen32Bytes()
    const path = new TextEncoder().encode('vmi')
    node.addFork(path, randAddress)
    expect(() => node.serialize()).toThrowError()
  })

  it('tests expected node attributes one-by-one', () => {
    const sampleNode = getSampleMantarayNode1_0()
    const node = sampleNode.node
    const { fork1, fork2, fork3, fork4, fork5 } = sampleNode.forks
    expect(() => node.getForkAtPath(new TextEncoder().encode('path/not/exists'))).toThrowError()

    /// FORK1
    const fork1Object = node.getForkAtPath(fork1.path)
    //entry
    expect(fork1Object.node.entry).toBe(fork1.entry)
    expect(fork1Object.node.encEntry).toBe(true)
    expect(fork1Object.node.hasEntry).toBe(Boolean(fork1.entry))
    expect(fork1Object.node.isValueType()).toBe(Boolean(fork1.entry))
    //forkmetadata and nodemetadata
    expect(fork1Object.node.forkMetadata).toStrictEqual(fork1.forkMetadata)
    expect(fork1Object.node.metadata).toStrictEqual(fork1.forkMetadata)
    expect(fork1Object.node.nodeMetadata).toStrictEqual(fork1.nodeMetadata)
    expect(fork1Object.node.isWithMetadataType()).toBe(true)
    //other attributes
    expect(fork1Object.node.isEdge).toBe(false)
    expect(fork1Object.node.isContinuousNode).toBe(false)
    expect(fork1Object.node.isDirty()).toBe(true)

    //FORK2
    const fork2Object = node.getForkAtPath(fork2.path)
    //entry
    expect(fork2Object.node.entry).toBe(fork2.entry)
    expect(fork2Object.node.encEntry).toBe(false)
    expect(fork2Object.node.hasEntry).toBe(Boolean(fork2.entry))
    expect(fork2Object.node.isValueType()).toBe(Boolean(fork2.entry))
    //forkmetadata and nodemetadata
    expect(fork2Object.node.forkMetadata).toStrictEqual(fork2.forkMetadata)
    expect(fork2Object.node.metadata).toStrictEqual(fork2.forkMetadata)
    expect(fork2Object.node.nodeMetadata).toStrictEqual(fork2.nodeMetadata)
    expect(fork2Object.node.isWithMetadataType()).toBe(false)
    //other attributes
    expect(fork2Object.node.isEdge).toBe(true)
    expect(fork2Object.node.isContinuousNode).toBe(false)
    expect(fork2Object.node.isDirty()).toBe(true)

    //FORK3
    const fork3Object = node.getForkAtPath(fork3.path)
    //entry
    expect(fork3Object.node.entry).toBe(fork3.entry)
    expect(fork3Object.node.encEntry).toBe(false)
    expect(fork3Object.node.hasEntry).toBe(Boolean(fork3.entry))
    expect(fork3Object.node.isValueType()).toBe(Boolean(fork3.entry))
    //forkmetadata and nodemetadata
    expect(fork3Object.node.forkMetadata).toStrictEqual(fork3.forkMetadata)
    expect(fork3Object.node.metadata).toStrictEqual(fork3.nodeMetadata)
    expect(fork3Object.node.nodeMetadata).toStrictEqual(fork3.nodeMetadata)
    expect(fork3Object.node.isWithMetadataType()).toBe(true)
    //other attributes
    expect(fork3Object.node.isEdge).toBe(false)
    expect(fork3Object.node.isContinuousNode).toBe(false)
    expect(fork3Object.node.isDirty()).toBe(true)

    //FORK4
    const fork4Object = node.getForkAtPath(fork4.path)
    //entry
    expect(fork4Object.node.entry).toBe(fork4.entry)
    expect(fork4Object.node.encEntry).toBe(false)
    expect(fork4Object.node.hasEntry).toBe(Boolean(fork4.entry))
    expect(fork4Object.node.isValueType()).toBe(Boolean(fork4.entry))
    //forkmetadata and nodemetadata
    expect(fork4Object.node.forkMetadata).toStrictEqual(fork4.forkMetadata)
    expect(fork4Object.node.metadata).toStrictEqual({ ...fork4.nodeMetadata, ...fork4.forkMetadata }) // has to overwrite nodeMetadata
    expect(fork4Object.node.nodeMetadata).toStrictEqual(fork4.nodeMetadata)
    expect(fork4Object.node.isWithMetadataType()).toBe(true)
    //other attributes
    expect(fork4Object.node.isEdge).toBe(true)
    expect(fork4Object.node.isContinuousNode).toBe(false)
    expect(fork4Object.node.isDirty()).toBe(true)

    //FORK5
    const fork5Object = node.getForkAtPath(fork5.path)
    //entry
    expect(fork5Object.node.entry).toBe(fork5.entry)
    expect(fork5Object.node.encEntry).toBe(false)
    expect(fork5Object.node.hasEntry).toBe(Boolean(fork5.entry))
    expect(fork5Object.node.isValueType()).toBe(Boolean(fork5.entry))
    //forkmetadata and nodemetadata
    expect(fork5Object.node.forkMetadata).toStrictEqual(fork5.forkMetadata)
    expect(fork5Object.node.metadata).toStrictEqual(fork5.forkMetadata)
    expect(fork5Object.node.nodeMetadata).toStrictEqual(fork5.nodeMetadata)
    expect(fork5Object.node.isWithMetadataType()).toBe(false)
    //other attributes
    expect(fork5Object.node.isEdge).toBe(false)
    expect(fork5Object.node.isContinuousNode).toBe(false)
    expect(fork5Object.node.isDirty()).toBe(true)
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
