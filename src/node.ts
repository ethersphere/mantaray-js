import { Bytes, MetadataMapping, NodeType, Reference, StorageHandler, StorageLoader as StorageLoader, StorageSaver as StorageSaver } from "./types"
import { checkReference } from "./utils"

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

class PropertyIsUndefined extends Error {
  constructor() {
    super(`Property does not exist in the object`)
  }
}

class Fork {
  /**
   * @param prefix the non-branching part of the subpath
   * @param node in memory structure that represents the Node
   */
  constructor(public prefix: Uint8Array, public node: MantarayNode) {}
}

class MantarayNode {
  /** Used with NodeType type */
  public type?: number
  // public refBytesSize?: number
  public obfuscationKey?: Bytes<32>
  /** reference of a loaded manifest node. if undefined, the node can be handled as `dirty` */
  private contentAddress?: Reference
  /** reference of an content that the manifest refers to */
  public entry?: Reference
  public metadata?: MetadataMapping
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

  public makeValue() {
    if(!this.type) this.type = NodeType.value
    this.type |= NodeType.value
  }

  public makeEdge() {
    if(!this.type) this.type = NodeType.edge
    this.type |= NodeType.edge
  }

  public makeWithPathSeparator() {
    if(!this.type) this.type = NodeType.withPathSeparator
    this.type |= NodeType.withPathSeparator
  }

  public makeWithMetadata() {
    if(!this.type) this.type = NodeType.withMetadata
    this.type |= NodeType.withMetadata
  }

  public makeNotWithPathSeparator() {
    if(!this.type) throw PropertyIsUndefined
    this.type = (NodeType.mask ^ NodeType.withPathSeparator) & this.type
  }

  public makeNotWithMetadata() {
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
  public add(path: Uint8Array, entry: Reference, storage: StorageHandler, metadata: MetadataMapping = {}) {    
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
        newNode.add(rest, entry, storage, metadata)
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
    newNode.add(restPath, entry, storage, metadata)
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
    
    //TODO
    //const prefixIndex = 
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
