import { Bytes, MarshalVersion, MetadataMapping, NodeType, Reference, StorageLoader, StorageSaver } from './types'
import {
  checkReference,
  common,
  encryptDecrypt,
  equalBytes,
  findIndexOfArray,
  flattenBytesArray,
  fromBigEndian,
  gen32Bytes,
  IndexBytes,
  serializeVersion,
  toBigEndianFromUint16,
} from './utils'

type ForkMapping = { [key: number]: MantarayFork }
type RecursiveSaveReturnType = { reference: Reference; changed: boolean }

const nodeForkSizes = {
  prefixLength: 1,
  /** Bytes length before `reference` */
  preReference: 32,
  prefixMax: 31,
  // Mantaray reference is either 32 or 64 bytes long
} as const

const nodeHeaderSizes = {
  obfuscationKey: 32,
  versionHash: 31,
  /** 3 bit flags + 5 bit forkMetadataSegmentSize */
  nodeFeatures: 1,
  full: (): number => {
    return nodeHeaderSizes.obfuscationKey + nodeHeaderSizes.versionHash + nodeHeaderSizes.nodeFeatures
  },
  // entry is either 32 or 64 bytes long
} as const

/// ERRORS

class NotFoundError extends Error {
  constructor(remainingPathBytes: Uint8Array, checkedPrefixBytes?: Uint8Array) {
    const remainingPath = new TextDecoder().decode(remainingPathBytes)
    const prefixInfo = checkedPrefixBytes
      ? `Prefix on lookup: ${new TextDecoder().decode(checkedPrefixBytes)}`
      : 'No fork on the level'
    super(`Path has not found in the manifest. Remaining path on lookup: ${remainingPath}. ${prefixInfo}`)
  }
}

class EmptyPathError extends Error {
  constructor() {
    super('Empty path')
  }
}

class UndefinedField extends Error {
  constructor(field: string) {
    super(`"${field}" field is not initialized.`)
  }
}

class PropertyIsUndefined extends Error {
  constructor() {
    super(`Property does not exist in the object`)
  }
}

class NotImplemented extends Error {
  constructor() {
    super('Not Implemented')
  }
}

// LOGIC

export class MantarayFork {
  /**
   * @param prefix the non-branching part of the subpath
   * @param node in memory structure that represents the Node
   */
  constructor(public prefix: Uint8Array, public node: MantarayNode, public forkMetadata: MetadataMapping = {}) {}

  public getMetadata(): MetadataMapping {
    return {
      ...this.forkMetadata,
      ...this.node.getNodeMetadata,
    }
  }

  /** The obfuscation on the data happens in node serialisation */
  public serialize(): Uint8Array {
    const prefixLengthBytes = new Uint8Array(1)
    prefixLengthBytes[0] = this.prefix.length // on addFork it is always trimmed under `prefixMax`

    const prefixBytes = new Uint8Array(nodeForkSizes.prefixMax)
    prefixBytes.set(this.prefix)

    const entry: Reference | undefined = this.node.getContentAddress

    if (!entry) throw Error('cannot serialize MantarayFork because it does not have contentAddress')

    const data = new Uint8Array([...prefixLengthBytes, ...prefixBytes, ...entry])

    if (this.node.getForkMetadataSegmentSize > 0) {
      const jsonString = JSON.stringify(this.forkMetadata)
      const metadataBytes = new Uint8Array(this.node.getForkMetadataSegmentSize * 32)
      metadataBytes.set(new TextEncoder().encode(jsonString))

      return new Uint8Array([...data, ...metadataBytes])
    }

    return data
  }

  public static deserialize(
    data: Uint8Array,
    encEntry: boolean,
  ): MantarayFork {
    const prefixLength = data[0]

    if (prefixLength === 0 || prefixLength > nodeForkSizes.prefixMax) {
      throw Error(`Prefix length of fork is greater than ${nodeForkSizes.prefixMax}. Got: ${prefixLength}`)
    }

    const prefix = data.slice(nodeForkSizes.prefixLength, nodeForkSizes.prefixLength + prefixLength)
    const node = new MantarayNode()
    const fork = new MantarayFork(prefix, node)
    const entryLength = encEntry ? 64 : 32
    node.setContentAddress = data.slice(nodeForkSizes.preReference, nodeForkSizes.preReference + entryLength) as Bytes<32> | Bytes<64>
    
    const metadataBytes = data.slice(nodeForkSizes.preReference + entryLength)
    if (metadataBytes.length > 0) {
      const jsonString = new TextDecoder().decode(metadataBytes)
      fork.forkMetadata = JSON.parse(jsonString)
    }

    return fork
  }
}

export class MantarayNode {
  private obfuscationKey: Bytes<32>
  /** whether the node has entry field */
  private hasEntry: boolean
  /** the entry field is an encrypted reference and 64 bytes long */
  private encEntry: boolean
  /** whether the node has additional forks or not */
  private isEdge: boolean
  /** reference of a loaded manifest node. if undefined, the node can be handled as `dirty` */
  private contentAddress?: Reference
  /** reference of a content that the manifest refers to */
  private entry?: Reference
  private nodeMetadata?: MetadataMapping
  /** this value * the segment size (32) gives the reserved bytesize for metadata under each forkdata */
  private forkMetadataSegmentSize: number
  /** 
   * whether the node act as a continuous node because the childnode prefix is too long
   * information requires parent node fetch
   */
  public isContinuousNode: boolean
  /** Forks of the manifest. Has to be initialized with `{}` on load even if there were no forks */
  public forks?: ForkMapping

  public constructor() {
    this.hasEntry = false
    this.encEntry = false
    this.isEdge = false
    this.isContinuousNode = true
    this.forkMetadataSegmentSize = 0
    this.obfuscationKey = new Uint8Array(32) as Bytes<32>
  }

  /// Setters/getters

  public set setContentAddress(contentAddress: Reference) {
    checkReference(contentAddress)

    this.contentAddress = contentAddress
  }

  public set setEntry(entry: Reference) {
    checkReference(entry)

    this.entry = entry
    this.hasEntry = true
    if(entry.length === 64) this.encEntry = true
    this.makeDirty()
  }

  public set setObfuscationKey(obfuscationKey: Bytes<32>) {
    if (!(obfuscationKey instanceof Uint8Array)) {
      throw new Error('Given obfuscationKey is not an Uint8Array instance.')
    }

    if (obfuscationKey.length !== 32) {
      throw new Error(`Wrong obfuscationKey length. Entry only can be 32 length in bytes`)
    }

    this.obfuscationKey = obfuscationKey
    this.makeDirty()
  }

  public set setNodeMetadata(metadata: MetadataMapping) {
    this.nodeMetadata = metadata
    this.makeDirty()
  }

  public set setForkMetadataSegmentSize(value: number) {
    if (value > 31) throw new Error(`forkMetadataSegmentSize is greater than 31. Got: ${value}`)
  }

  public get getObfuscationKey(): Bytes<32> | undefined {
    return this.obfuscationKey
  }

  public get getEntry(): Reference | undefined {
    return this.entry
  }

  public get getContentAddress(): Reference | undefined {
    return this.contentAddress
  }

  public get getNodeMetadata(): MetadataMapping | undefined {
    return this.nodeMetadata
  }

  public get getForkMetadataSegmentSize(): number {
    return this.forkMetadataSegmentSize
  }

  public get getIsEdge(): boolean {
    return this.isEdge
  }

  public get getHasEntry(): boolean {
    return this.hasEntry
  }

  public get getEncEntry(): boolean {
    return this.encEntry
  }

  /// Node type related functions
  /// dirty flag is not necessary to be set

  public isValueType(): boolean {
    return this.hasEntry
  }

  public isWithMetadataType(): boolean {
    return Object.keys(this.nodeMetadata || {}).length > 0
  }

  /// Other Utility methods

  /** byte length until the fork array */
  public nodeHeaderSize(): number {
    let size = 64 // obfuscationKey (32) + versionHash (31) + nodeFeatures (1)
    if(this.hasEntry) {
      size += 32
      if(this.encEntry) {
        size += 32
      }
    }
    if(this.isEdge) {
      size += 32
    }

    return size
  }

  /// BL methods

  public addFork(
    path: Uint8Array, 
    attributes?: { 
      entry?: Reference, 
      nodeMetadata?: MetadataMapping, 
      forkMetadata?: MetadataMapping,
    }): void
  {
    const entry: Reference | undefined = attributes?.entry
    const nodeMetadata: MetadataMapping = attributes?.nodeMetadata || {}
    const forkMetadata: MetadataMapping = attributes?.forkMetadata || {}
    //TODO handle forkmetadata

    if (path.length === 0) {
      if(entry) this.setEntry = entry

      if (Object.keys(nodeMetadata).length > 0) {
        this.setNodeMetadata = nodeMetadata
      }

      return
    }

    if (this.isDirty() && !this.forks) this.forks = {}

    if (!this.forks) throw Error(`Fork mapping is not defined in the manifest`)

    const fork = this.forks[path[0]]

    if (!fork) {
      const newNode = new MantarayNode()

      if (this.obfuscationKey) {
        newNode.setObfuscationKey = gen32Bytes()
      }

      // Continuous node
      if (path.length > nodeForkSizes.prefixMax) {
        const prefix = path.slice(0, nodeForkSizes.prefixMax)
        const rest = path.slice(nodeForkSizes.prefixMax)
        newNode.addFork(rest, attributes)
        newNode.isContinuousNode = true
        this.forks[path[0]] = new MantarayFork(prefix, newNode, forkMetadata)
        this.isEdge = true
        this.makeDirty()

        return
      }
      // create non-continuous node
      if(entry) newNode.setEntry = entry

      if (Object.keys(nodeMetadata).length > 0) {
        newNode.setNodeMetadata = nodeMetadata
      }

      this.forks[path[0]] = new MantarayFork(path, newNode, forkMetadata)
      this.makeDirty()
      this.isEdge = true

      return
    }

    /// Case when there is an existing fork for the given (sub)path

    const commonPath = common(fork.prefix, path)
    /** restPath of the existing fork's path that differs from the new path */
    const restPath = fork.prefix.slice(commonPath.length)
    let newNode = fork.node

    // create new parent node where the path starts to differ in the current node's prefix
    // this parent node will have two children: the current node and the new node with the given path
    if (restPath.length > 0) {
      // create new node for the common path
      newNode = new MantarayNode()
      newNode.setObfuscationKey = this.obfuscationKey ? gen32Bytes() : new Uint8Array(32) as Bytes<32>
      newNode.forks = {}
      //TODO handle continuous node (shorten path)
      newNode.forks[restPath[0]] = new MantarayFork(restPath, fork.node, forkMetadata) // copy old parent node to its remaining path
      newNode.isEdge = true
    }

    // NOTE: special case on edge split
    // newNode will be the common path edge node
    // newNode's prefix is a subset of the given `path`, here the desired fork will be added with the truncated path
    newNode.addFork(path.slice(commonPath.length), attributes)
    this.forks[path[0]] = new MantarayFork(commonPath, newNode, forkMetadata)
    this.isEdge = true

    this.makeDirty()
  }

  /**
   * Gives back a MantarayFork under the given path
   *
   * @param path valid path within the MantarayNode
   * @returns MantarayFork with the last unique prefix and its node
   * @throws error if there is no node under the given path
   */
  public getForkAtPath(path: Uint8Array): MantarayFork {
    if (path.length === 0) throw EmptyPathError

    if (!this.forks) throw Error(`Fork mapping is not defined in the manifest`)

    const fork = this.forks[path[0]]

    if (!fork) throw new NotFoundError(path)

    const prefixIndex = findIndexOfArray(path, fork.prefix)

    if (prefixIndex === -1) throw new NotFoundError(path, fork.prefix)

    const rest = path.slice(fork.prefix.length)

    if (rest.length === 0) return fork

    return fork.node.getForkAtPath(rest)
  }

  /**
   * Removes a path from the node
   *
   * @param path Uint8Array of the path of the node intended to remove
   */
  public removePath(path: Uint8Array): void {
    if (path.length === 0) throw EmptyPathError

    if (!this.forks) throw Error(`Fork mapping is not defined in the manifest`)

    const fork = this.forks[path[0]]

    if (!fork) throw new NotFoundError(path)

    const prefixIndex = findIndexOfArray(path, fork.prefix)

    if (prefixIndex === -1) throw new NotFoundError(path, fork.prefix)

    const rest = path.slice(fork.prefix.length)

    if (rest.length === 0) {
      // full path matched
      this.makeDirty()
      delete this.forks[path[0]]

      return
    }

    fork.node.removePath(rest)
  }

  public async load(storageLoader: StorageLoader, reference: Reference): Promise<void> {
    if (!reference) throw Error('Reference is undefined at manifest load')

    const data = await storageLoader(reference)
    this.deserialize(data)

    this.setContentAddress = reference
  }

  /**
   * Saves dirty flagged ManifestNodes and its forks recursively
   * @returns Reference of the top manifest node.
   */
  public async save(storageSaver: StorageSaver): Promise<Reference> {
    const { reference } = await this.recursiveSave(storageSaver)

    return reference
  }

  public isDirty(): boolean {
    return this.contentAddress === undefined
  }

  public makeDirty(): void {
    this.contentAddress = undefined
  }

  public serialize(): Uint8Array {
    const obfuscationKey = this.obfuscationKey || new Uint8Array(32)

    if (!this.forks) {
      if (!this.entry) throw new UndefinedField('entry')
      this.forks = {} //if there were no forks initialized it is not indended to be
    }

    /// Header
    const version: MarshalVersion = '1.0'
    const versionBytes: Bytes<31> = serializeVersion(version)
    const nodeFeatures: Bytes<1> = this.serializeFeatures()

    /// Entry
    const entry = this.entry || new Uint8Array()

    /// Forks and ForkIndexBytes

    /// ForksIndexBytes
    let indexBytes: Bytes<32> | Bytes<0> = new Uint8Array() as Bytes<0>
    const forkSerializations: Uint8Array[] = []
    if(this.isEdge) {
      const index = new IndexBytes()
      for (const forkIndex of Object.keys(this.forks)) {
        index.setByte(Number(forkIndex))
      }
      indexBytes = index.getBytes

      /// Forks
      index.forEach(byte => {
        const fork = this.forks![byte]

        if (!fork) throw Error(`Fork indexing error: fork has not found under ${byte} index`)
        forkSerializations.push(fork.serialize())
      })
    }

    /// NodeMetadata
    let nodeMetadataBytes = new Uint8Array(0)
    if (this.nodeMetadata) {
      const jsonString = JSON.stringify(this.nodeMetadata)
      nodeMetadataBytes = new TextEncoder().encode(jsonString)
    }

    const bytes = new Uint8Array([
      ...obfuscationKey,
      ...versionBytes,
      ...nodeFeatures,
      ...entry,
      ...indexBytes,
      ...flattenBytesArray(forkSerializations),
      ...nodeMetadataBytes,
    ])

    /// Encryption
    /// perform XOR encryption on bytes after obfuscation key
    encryptDecrypt(obfuscationKey, bytes, obfuscationKey.length)

    return bytes
  }

  public serializeFeatures(): Bytes<1> {
    if (this.encEntry && !this.hasEntry) {
      throw new Error('encEntry is true when hasEntry is false at serialisation')
    }

    let nodeFeautes = this.forkMetadataSegmentSize
    // add flags
    nodeFeautes = nodeFeautes << 1
    nodeFeautes += this.isEdge ? 1 : 0
    nodeFeautes = nodeFeautes << 1
    nodeFeautes += this.encEntry ? 1 : 0
    nodeFeautes = nodeFeautes << 1
    nodeFeautes += this.hasEntry ? 1 : 0

    const bytes = new Uint8Array(1) as Bytes<1>
    bytes[0] = nodeFeautes

    return bytes
  }

  public deserialize(data: Uint8Array): void {
    /// Header
    const nodeHeaderSize = nodeHeaderSizes.full()

    if (data.length < nodeHeaderSize) throw Error('The serialised input is too short')

    this.obfuscationKey = new Uint8Array(data.slice(0, nodeHeaderSizes.obfuscationKey)) as Bytes<32>
    // perform XOR decryption on bytes after obfuscation key
    encryptDecrypt(this.obfuscationKey, data, this.obfuscationKey.length)

    const versionHash = data.slice(
      nodeHeaderSizes.obfuscationKey,
      nodeHeaderSizes.obfuscationKey + nodeHeaderSizes.versionHash,
    )

    if (!equalBytes(versionHash, serializeVersion('1.0'))) {
      throw new Error('The data is not Mantaray 1.0')
    }

    const nodeFeaturesByte = data[nodeHeaderSize - 1]
    this.deserializeFeatures(nodeFeaturesByte)
    
    /// Entry
    let refBytesSize = 0
    if (this.hasEntry) {
      if(this.encEntry) {
        refBytesSize = 64
      } else {
        refBytesSize = 32
      }
      this.setEntry = data.slice(nodeHeaderSize, nodeHeaderSize + refBytesSize) as Reference
    }
    let offset = nodeHeaderSize + refBytesSize

    /// Fork
    if (this.isEdge) {
      /// Fork Bytes index mapping
      const indexBytes = data.slice(offset, offset + 32) as Bytes<32>
      const indexForks = new IndexBytes()
      indexForks.setBytes = indexBytes
      offset += 32

      /// Forks
      this.forks = {}
      const forkSize = nodeForkSizes.preReference + refBytesSize + this.forkMetadataSegmentSize * 32
      indexForks.forEach(byte => {
        if (data.length < offset + forkSize) {
          throw Error(`There is not enough size to read fork data at offset ${offset}`)
        }

        const forkBytes = data.slice(offset, offset + forkSize)
        const fork = MantarayFork.deserialize(forkBytes, this.encEntry)
  
        this.forks![byte] = fork
  
        offset += refBytesSize
      })
    }

    /// NodeMetadata
    if (data.length > offset) {
      const jsonString = new TextDecoder().decode(data.slice(offset))
      try {
        this.nodeMetadata = JSON.parse(jsonString)
      } catch(e) {
        throw new Error(`The byte array is not a valid JSON object in the Mantaray object`)
      }
    }
  }

  public deserializeFeatures(nodeFeaturesByte: number) {
    // deserialize flags
    this.hasEntry = nodeFeaturesByte % 2 === 1
    nodeFeaturesByte = nodeFeaturesByte >> 1
    this.encEntry = nodeFeaturesByte % 2 === 1
    nodeFeaturesByte = nodeFeaturesByte >> 1
    this.isEdge = nodeFeaturesByte % 2 === 1
    nodeFeaturesByte = nodeFeaturesByte >> 1

    // deserialize segmentsize
    this.setForkMetadataSegmentSize = nodeFeaturesByte
  }

  private async recursiveSave(storageSaver: StorageSaver): Promise<RecursiveSaveReturnType> {
    // save forks first recursively
    const savePromises: Promise<RecursiveSaveReturnType>[] = []

    if (!this.forks) this.forks = {} // there were no intention to define fork(s)
    for (const fork of Object.values(this.forks)) {
      savePromises.push(fork.node.recursiveSave(storageSaver))
    }
    const savedReturns = await Promise.all(savePromises)

    if (this.contentAddress && savedReturns.every(v => !v.changed)) {
      return { reference: this.contentAddress, changed: false }
    }

    // save the actual manifest as well
    const data = this.serialize()
    const reference = await storageSaver(data)

    this.setContentAddress = reference

    return { reference, changed: true }
  }
}

/** loads all nodes recursively */
export async function loadAllNodes(storageLoader: StorageLoader, node: MantarayNode): Promise<void> {
  if (!node.forks) return

  for (const fork of Object.values(node.forks)) {
    if (fork.node.getEntry) await fork.node.load(storageLoader, fork.node.getEntry)
    await loadAllNodes(storageLoader, fork.node)
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
export const equalNodes = (a: MantarayNode, b: MantarayNode, accumulatedPrefix = ''): void | never => {
  // node flags comparisation
  if (a.isContinuousNode !== b.isContinuousNode) {
    throw new Error(`Nodes do not have same isContinuousNode flags: a ${a.isContinuousNode} ; b: ${b.isContinuousNode}`)
  }
  if (a.getHasEntry !== b.getHasEntry) {
    throw new Error(`Nodes do not have same hasEntry flags: a ${a.getHasEntry} ; b: ${b.getHasEntry}`)
  }
  if (a.getEncEntry != b.getEncEntry) {
    throw new Error(`Nodes do not have same encEntry flags: a ${a.getEncEntry} ; b: ${b.getEncEntry}`)
  }
  if (a.getIsEdge !== b.getIsEdge) {
    throw new Error(`Nodes do not have same isEdge flags: a ${a.getIsEdge} ; b: ${b.getIsEdge}`)
  }
  if(a.getForkMetadataSegmentSize !== b.getForkMetadataSegmentSize) {
    throw new Error(`Nodes do not have same forkMetadataSegmentSize: a ${a.getForkMetadataSegmentSize} ; b: ${b.getForkMetadataSegmentSize}`)
  }

  // node metadata comparisation
  if (!a.getNodeMetadata !== !b.getNodeMetadata) {
    throw Error(`One of the nodes do not have metadata defined. \n a: ${a.getNodeMetadata} \n b: ${b.getNodeMetadata}`)
  } else if (a.getNodeMetadata && b.getNodeMetadata) {
    //TODO deep equation
  }

  // node entry comparisation
  if (equalBytes(a.getEntry || new Uint8Array(0), b.getEntry || new Uint8Array(0))) {
    throw Error(`Nodes do not have same entries. \n a: ${a.getEntry} \n b: ${a.getEntry}`)
  }

  if (!a.forks) return

  // node fork comparisation
  const aKeys = Object.keys(a.forks)

  if (!b.forks || aKeys.length !== Object.keys(b.forks).length) {
    throw Error(`Nodes do not have same fork length on equality check at prefix ${accumulatedPrefix}`)
  }

  for (const key of aKeys) {
    const aFork: MantarayFork = a.forks[Number(key)]
    const bFork: MantarayFork = b.forks[Number(key)]
    const prefix = aFork.prefix
    const prefixString = new TextDecoder().decode(prefix)

    if (!equalBytes(prefix, bFork.prefix)) {
      throw Error(`Nodes do not have same prefix under the same key "${key}" at prefix ${accumulatedPrefix}`)
    }

    //TODO fork metadata deep equation

    equalNodes(aFork.node, bFork.node, accumulatedPrefix + prefixString)
  }
}