import { Bytes, MarshalVersion, MetadataMapping, NodeType, Reference, StorageHandler, StorageLoader, StorageSaver } from "./types"
import { checkBytes, checkReference, encryptDecrypt, equalBytes, findIndexOfArray, flattenBytesArray, keccak256Hash } from "./utils"

const pathSeparator = '/'

type ForkMapping = { [key: number]: Fork }

const nodeForkSizes = {
  nodeType: 1,
  prefixLength: 1,
  /** Bytes length before `reference` */
  preReference: 32,
  metadata: 2,
  header: (): number => nodeForkSizes.nodeType + nodeForkSizes.prefixLength, // 2
  prefixMaxSize: (): number => nodeForkSizes.preReference - nodeForkSizes.header(), // 30
} as const

const nodeHeaderSizes = {
  obfuscationKey: 32,
  versionHash: 31,
  /** Its value represents how long is the `entry` in bytes */
  refBytes: 1,
  full: (): number => {
    return nodeHeaderSizes.obfuscationKey + nodeHeaderSizes.versionHash + nodeHeaderSizes.refBytes
  }
} as const

class NotFoundError extends Error {
  constructor() {
    super('Not found')
  }
}

class EmptyPathError extends Error {
  constructor() {
    super('Empty path')
  }
}

class MetadataIsTooLarge extends Error {
  constructor() {
    super('Metadata is too large')
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

class Fork {
  /**
   * @param prefix the non-branching part of the subpath
   * @param node in memory structure that represents the Node
   */
  constructor(public prefix: Uint8Array, public node: MantarayNode) {}

  public serialize(): Uint8Array {
    const nodeType = this.node.getType
    
    const prefixLengthBytes = new Uint8Array(1)
    prefixLengthBytes[0] = this.prefix.length
    
    const prefixBytes = new Uint8Array(nodeForkSizes.prefixMaxSize())
    prefixBytes.set(this.prefix)
    
    console.log('hello3', this.node.getEntry)
    let entry: Reference
    try {
      entry = this.node.getEntry // checked at set whether it corresponds to the valid format
    } catch(e) {
      entry = new Uint8Array(32) as Bytes<32>
    }
    
    if(this.node.IsWithMetadataType()) throw NotImplemented

    return new Uint8Array([
      nodeType,
      ...prefixLengthBytes,
      ...prefixBytes,
      ...entry
    ])
  }

  public static deserialize(data: Uint8Array, withMetadata = false): Fork {
    if(withMetadata) throw NotImplemented

    const nodeType = data[0]
    const prefixLength = data[1]

    if ( prefixLength === 0 || prefixLength > nodeForkSizes.prefixMaxSize()) {
      throw Error(`Invalid prefix length of fork ${prefixLength}`)
    }

    const headerSize = nodeForkSizes.header()
    const prefix = data.slice(headerSize, headerSize + headerSize + prefixLength)
    const node = new MantarayNode()
    node.setEntry = data.slice(nodeForkSizes.preReference) as Bytes<32> | Bytes<64>
    node.setType = nodeType

    return new Fork(prefix, node)
  }
}

export class MantarayNode {
  /** Used with NodeType type */
  private type?: number
  private obfuscationKey?: Bytes<32>
  /** reference of a loaded manifest node. if undefined, the node can be handled as `dirty` */
  private contentAddress?: Reference
  /** reference of an content that the manifest refers to */
  private entry?: Reference
  private metadata?: MetadataMapping
  /** Forks of the manifest. Has to be initialized with `{}` on load even if there were no forks */
  public forks?: ForkMapping

  /// Setters/getters

  public set setContentAddress(contentAddress: Reference) {
    checkReference(contentAddress)

    this.contentAddress = contentAddress
  }

  public set setEntry(entry: Reference) {
    checkReference(entry)

    this.entry = entry
    this.makeDirty()
  }

  public set setType(type: number) {
    if(type > 255) throw Error(`Node type representation cannot be greater than 255`)

    this.type = type
  }  

  public set setObfuscationKey(obfuscationKey: Bytes<32>) {
    if(!(obfuscationKey instanceof Uint8Array)) {
      throw new Error('Given obfuscationKey is not an Uint8Array instance.')
    }
    if(obfuscationKey.length !== 32) {
      throw new Error(`Wrong obfuscationKey length. Entry only can be 32 length in bytes`)
    }
    
    this.obfuscationKey = obfuscationKey
    this.makeDirty()
  }

  public set setMetadata(metadata: MetadataMapping) {
    this.metadata = metadata
    this.makeWithMetadata()
    this.makeDirty()
  }

  public get getObfuscationKey(): Bytes<32> {
    if(!this.obfuscationKey) throw PropertyIsUndefined

    return this.obfuscationKey
  }

  public get getEntry(): Reference {
    if(!this.entry) throw PropertyIsUndefined

    return this.entry
  }

  public get getContentAddress(): Reference { 
    if(!this.contentAddress) throw PropertyIsUndefined

    return this.contentAddress
  }

  public get getMetadata(): MetadataMapping{
    if(!this.getMetadata) throw PropertyIsUndefined

    return this.getMetadata
  }

  public get getType(): number {
    if(!this.type) throw PropertyIsUndefined
    if(this.type > 255) throw ('Property "type" in Node is greater than 255')

    return this.type
  }

  /// Node type related functions
  /// dirty flag is not necessary to be set

  public isValueType(): boolean {
    if(!this.type) throw PropertyIsUndefined
    const typeMask = this.type & NodeType.value

    return typeMask === NodeType.value
  }

  public isEdgeType(): boolean {
    if(!this.type) throw PropertyIsUndefined
    const typeMask = this.type & NodeType.edge

    return typeMask === NodeType.edge
  }

  public isWithPathSeparatorType(): boolean {
    if(!this.type) throw PropertyIsUndefined
    const typeMask = this.type & NodeType.withPathSeparator

    return typeMask === NodeType.withPathSeparator
  }

  public IsWithMetadataType(): boolean {
    if(!this.type) throw PropertyIsUndefined
    const typeMask = this.type & NodeType.withMetadata

    return typeMask === NodeType.withMetadata
  }

  private makeValue() {
    if(!this.type) this.type = NodeType.value
    this.type |= NodeType.value
  }

  private makeEdge() {
    if(!this.type) this.type = NodeType.edge
    this.type |= NodeType.edge
  }

  private makeWithPathSeparator() {
    if(!this.type) this.type = NodeType.withPathSeparator
    this.type |= NodeType.withPathSeparator
  }

  private makeWithMetadata() {
    if(!this.type) this.type = NodeType.withMetadata
    this.type |= NodeType.withMetadata
  }

  private makeNotWithPathSeparator() {
    if(!this.type) throw PropertyIsUndefined
    this.type = (NodeType.mask ^ NodeType.withPathSeparator) & this.type
  }

  private makeNotWithMetadata() {
    if(!this.type) throw PropertyIsUndefined
    this.type = (NodeType.mask ^ NodeType.withMetadata) & this.type
  }

  private updateWithPathSeparator(path: Uint8Array) {
    if(new TextDecoder().decode(path).includes(pathSeparator)) {
      this.makeWithPathSeparator()
    } else {
      this.makeNotWithPathSeparator()
    }
  }

  /// BL methods

  /**
   * 
   * @param path path sting represented in bytes. can be 0 length, then `entry` will be the current node's entry 
   * @param entry 
   * @param metadata 
   * @param storage 
   */
  public async add(path: Uint8Array, entry: Reference, storage: StorageHandler, metadata: MetadataMapping = {}) {    
    if(path.length === 0) {
      this.setEntry = entry
      if (Object.keys(metadata).length > 0) {
        this.setMetadata = metadata
      }
      this.makeDirty()

      return
    }

    if(this.isDirty() && !this.forks) this.forks = {}

    if(!this.forks) throw Error(`Fork mapping is not defined in the manifest`)

    const fork = this.forks[path[0]]

    if(!fork) {
      const newNode = new MantarayNode()

      if(this.obfuscationKey) {
        newNode.setObfuscationKey = this.obfuscationKey
      }

      if(path.length > nodeForkSizes.prefixMaxSize()) {
        const prefix = path.slice(0, nodeForkSizes.prefixMaxSize())
        const rest = path.slice(0, nodeForkSizes.prefixMaxSize())
        await newNode.add(rest, entry, storage, metadata)
        newNode.updateWithPathSeparator(prefix)
        this.forks[path[0]] = new Fork(prefix, newNode)
        this.makeEdge()

        return
      }

      newNode.setEntry = entry

      if(Object.keys(metadata).length > 0) {
        newNode.setMetadata = metadata
      }
      
      newNode.makeValue() // is it related to the setEntry?
      newNode.updateWithPathSeparator(path)
      console.log('hello2', newNode.getEntry)
      this.forks[path[0]] = new Fork(path, newNode)
      this.makeEdge()

      return
    }

    const commonPath = common(fork.prefix, path)
    const restPath = fork.prefix.slice(commonPath.length)
    let newNode = fork.node

    if(restPath.length > 0) {
      // move current common prefix node
      newNode = new MantarayNode()
      if(this.obfuscationKey) {
        newNode.setObfuscationKey = this.obfuscationKey
      }
      fork.node.updateWithPathSeparator(restPath)
      newNode.forks = {} //TODO setter
      newNode.forks[restPath[0]] = new Fork(restPath, fork.node)
      newNode.makeEdge()
      // if common path is full path new node is value type
      if (path.length === commonPath.length) {
        newNode.makeValue()
      }
    }

    // NOTE: special case on edge split
    newNode.updateWithPathSeparator(path)
    // add new for shared prefix
    await newNode.add(restPath, entry, storage, metadata)
    this.forks[path[0]] = new Fork(commonPath, newNode)
    this.makeEdge()

    this.makeDirty()
  }

  /** removes a path from the node */
  public remove(path: Uint8Array, storage: StorageHandler) {
    if (path.length === 0) throw EmptyPathError

    if(!this.forks) throw Error(`Fork mapping is not defined in the manifest`)

    const fork = this.forks[path[0]]
    
    if (!fork) throw NotFoundError
    
    const prefixIndex = findIndexOfArray(path, fork.prefix)
    
    if(prefixIndex === -1) throw NotFoundError

    const rest = path.slice(fork.prefix.length)

    if(rest.length === 0) {
      // full path matched
      delete this.forks[path[0]]
      
      return
    }

    fork.node.remove(rest, storage)
  }

  public async load(storageLoader: StorageLoader, reference: Reference | undefined): Promise<void> {
    if(!reference) throw Error('Reference is undefined at manifest load')

    const data = await storageLoader(reference)
    //TODO deserialize
    
    this.makeDirty()
  }

  /** Saves dirty flagged ManifestNode and its forks recursively */
  public async save(storageSaver: StorageSaver): Promise<Reference> {
    if(!this.isDirty()) {
      if (!this.contentAddress) throw Error('There is no content address of a manifest node that is not necessary to be saved.')

      return this.contentAddress
    }
    
    // save forks first recursively
    const savePromises: Promise<Reference>[] = []

    if (!this.forks) this.forks = {} // there were no intention to define fork(s)
    for(const fork of Object.values(this.forks)) {
      savePromises.push(fork.node.save(storageSaver))
    }
    await Promise.all(savePromises)

    // save the actual manifest as well
    const data = new Uint8Array(21) //TODO serialize
    const reference = await storageSaver(data)
    
    this.makeDirty()

    return reference
  }

  public isDirty(): boolean {
    return this.contentAddress === undefined
  }

  public makeDirty() {
    this.contentAddress = undefined
  }

  public serialize() {
    if(!this.obfuscationKey) throw new UndefinedField('obfuscationKey')
    if(!this.forks) {
      if(!this.entry) throw new UndefinedField('entry')
      this.forks = {} //if there were no forks initialized it is not indended to be
    }
    if(!this.entry) this.entry = new Uint8Array(32) as Bytes<32> // at directoties

    /// Header
    const version: MarshalVersion = '0.2'
    const versionBytes: Bytes<31> = serializeVersion(version)
    const referenceLengthBytes: Bytes<1> = serializeReferenceLength(this.entry)

    /// Entry is already in byte version

    /// ForksIndexBytes
    const index = new IndexBytes()
    for(const forkIndex of Object.keys(this.forks)) {
      index.setByte(+forkIndex)
    }
    const indexBytes = index.getBytes

    /// Forks
    const forkSerializations: Uint8Array[] = []
    
    index.foreEach(byte => {
      const fork = this.forks![byte]
      if(!fork) throw Error(`Fork indexing error: fork has not found under ${byte} index`)
      forkSerializations.push(fork.serialize())
    })

    const bytes = new Uint8Array([
      ...this.obfuscationKey,
      ...versionBytes,
      ...referenceLengthBytes,
      ...this.entry,
      ...indexBytes,
      ...flattenBytesArray(forkSerializations)
    ])

    /// Encryption
    /// perform XOR encryption on bytes after obfuscation key
    encryptDecrypt(this.obfuscationKey, bytes, this.obfuscationKey.length)

    return bytes
  }

  public deserialize(data: Uint8Array) {
    const nodeHeaderSize = nodeHeaderSizes.full()
    if (data.length < nodeHeaderSize) throw Error('serialised input too short')

    this.obfuscationKey = new Uint8Array(data.slice(0, nodeHeaderSizes.obfuscationKey)) as Bytes<32>
    // perform XOR decryption on bytes after obfuscation key
    encryptDecrypt(this.obfuscationKey, data, this.obfuscationKey.length)
    console.log('decrypted', data)

    const versionHash = data.slice(nodeHeaderSizes.obfuscationKey, nodeHeaderSizes.obfuscationKey + nodeHeaderSizes.versionHash)

    if(equalBytes(versionHash, serializeVersion('0.1'))) throw NotImplemented
    else if (equalBytes(versionHash, serializeVersion('0.2'))) {
        const refBytesSize = data[nodeHeaderSize - 1]
        const entry = data.slice(nodeHeaderSize, nodeHeaderSize + refBytesSize)
        this.setEntry = entry as Reference
        let offset = nodeHeaderSize + refBytesSize
        // Currently we don't persist the root nodeType when we marshal the manifest, as a result
        // the root nodeType information is lost on Unmarshal. This causes issues when we want to
        // perform a path 'Walk' on the root. If there is more than 1 fork, the root node type
        // is an edge, so we will deduce this information from index byte array
        if (data.slice(offset, offset + 32) === new Uint8Array(32)) {
          this.type = NodeType.edge
        }
        this.forks = {}
        const indexForks = new IndexBytes()
        indexForks.setBytes = data.slice(offset, offset + 32) as Bytes<32>
        offset += 32
        
        indexForks.foreEach(byte => {
          let fork: Fork

          if (data.length < offset + nodeForkSizes.nodeType) throw Error(`There is not enough size to read nodeType of fork at offset ${offset}`)

          const nodeType = data.slice(offset, offset + nodeForkSizes.nodeType)
          const nodeForkSize = nodeForkSizes.preReference + refBytesSize

          if(nodeTypeIsWithMetadataType(nodeType[0])) {
            throw NotImplemented
          } else {
            if (data.length < offset + nodeForkSizes.preReference + refBytesSize) {
              throw Error(`There is not enough size to read fork at offset ${offset}`)
            }

            fork = Fork.deserialize(data.slice(offset, offset + nodeForkSize))
          }

          this.forks![byte] = fork
          
          offset += nodeForkSize
        })
    } else {
      throw Error('Wrong mantaray version')
    }
  }
}

export function nodeTypeIsWithMetadataType(nodeType: number): boolean {
	return nodeType === NodeType.withMetadata
}

/**
 * 
 * @returns MantarayNode which only has
 */
export function initNodeByRef(ref: Reference): MantarayNode {
	const node = new MantarayNode()
  node.setContentAddress = ref

  return node
}

export function common(a: Uint8Array, b: Uint8Array): Uint8Array {
	let c = new Uint8Array(0)
  
  for (let i = 0; i < a.length && i < b.length && a[i] == b[i]; i++) {
		c = new Uint8Array([...c, a[i] ])
	}

	return c
}

/** 
 * The hash length has to be 31 instead of 32 that comes from the keccak hash function
 */
function serializeVersion(version: MarshalVersion): Bytes<31> {
  const versionName = 'mantaray'
  const versionSeparator = ':'
  const hashBytes = keccak256Hash(versionName + versionSeparator + version)
  
  return hashBytes.slice(0, 31) as Bytes<31>
}

function serializeReferenceLength(entry: Reference): Bytes<1> {
  const referenceLength = entry.length
  if(referenceLength !== 32 && referenceLength !== 64) {
    throw new Error(`Wrong referenceLength. It can be only 32 or 64. Got: ${referenceLength}`)
  }
  const bytes = new Uint8Array(1)
  bytes[0] = referenceLength

  return bytes as Bytes<1>
}

class IndexBytes {
  private bytes: Bytes<32>

  public constructor() {
    this.bytes = new Uint8Array(32) as Bytes<32>
  }

  public get getBytes(): Bytes<32> {
    return new Uint8Array([...this.bytes]) as Bytes<32>
  }

  public set setBytes(bytes: Bytes<32>) {
    checkBytes<32>(bytes, 32)

    this.bytes = new Uint8Array([...bytes]) as Bytes<32>
  }

  /**
   * 
   * @param byte is number max 255
   */
  public setByte(byte: number) {
    if(byte > 255) throw Error(`IndexBytes setByte error: ${byte} is greater than 255`)  
    this.bytes[Math.floor(byte / 8)] |= 1 << (byte % 8)
  }

  /**
   * checks the given byte is mapped in the Bytes<32> index
   * 
   * @param byte is number max 255
   */
  public checkBytePresent(byte: number): boolean {
    return ((this.bytes[Math.floor(byte/8)] >> (byte % 8)) & 1) > 0
  }

  /** Iterates through on the indexed byte values */
  public foreEach(hook: (byte: number) => void) {
    for(let i = 0; i <= 255; i++) {
      if (this.checkBytePresent(i)) {
        hook(i)
      }
    }
  }
}

