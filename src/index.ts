import { MantarayNode } from './node'
import { Bytes } from './types'
import { gen32Bytes } from './utils'

/** On the returned Mantaray node you can set either its entry or add fork to it */
export function initManifestNode(options?: { obfuscationKey?: Bytes<32> }): MantarayNode {
  const manifestNode = new MantarayNode()
  manifestNode.setObfuscationKey = options?.obfuscationKey || gen32Bytes()

  return manifestNode
}

export * from './node'
export * from './types'
export * as Utils from './utils'
