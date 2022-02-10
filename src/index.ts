import { MantarayNode as MantarayNode0_2 } from './node'
import { MantarayNode as MantarayNode1_0 } from './node-1_0'
import { Bytes, MarshalVersion } from './types'
import { gen32Bytes } from './utils'

/** On the returned Mantaray node you can set either its entry or add fork to it */
export function initManifestNode<Version extends MarshalVersion>(options?: {
  obfuscationKey?: Bytes<32>
  version?: Version
}): MantarayNode<Version> {
  const obfuscationKey: Bytes<32> = options?.obfuscationKey || gen32Bytes()
  const version: MarshalVersion = options?.version ? options!.version : '1.0'

  if (version === '0.2') {
    const manifestNode0_2 = new MantarayNode0_2()
    manifestNode0_2.setObfuscationKey = obfuscationKey

    return manifestNode0_2 as MantarayNode<Version>
  }

  if (version === '1.0') {
    const manifestNode1_0 = new MantarayNode1_0()
    manifestNode1_0.obfuscationKey = obfuscationKey

    return manifestNode1_0 as MantarayNode<Version>
  }

  throw new Error('Not implemented')
}

export type MantarayNode<Version extends MarshalVersion | undefined = undefined> = Version extends '0.2'
  ? MantarayNode0_2
  : Version extends '1.0'
  ? MantarayNode1_0
  : Version extends undefined
  ? MantarayNode0_2 | MantarayNode1_0
  : never

export * as Mantaray0_2 from './node'
export * from './types'
export * as Utils from './utils'
export * as Mantaray1_0 from './node-1_0'
