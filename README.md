# Description

The `mantaray` data-structure is widely used whithin the Swarm ecosystem; just to mention one, `manifests` are built on the mantaray data-structure, which consist of paths and file mappings of all dApps live on Ethereum Swarm.

With this package you can manipulate and interpret mantaray data via `MantarayNode` and `MantarayFork` abstractions.

# Exported Functions and Classes

You can import the followings directly from `mantaray-js`:

* MantarayV0_2        # legacy implementation of the mantaray data-structure, supported by the Bee client.
* MantarayV1          # recent implementation of the mantaray data-structure, currently not supported by the Bee client. This codebase is the reference implementation for [the Mantaray 1.0 SWIP](https://github.com/ethersphere/SWIPs/pull/37).
* initManifestNode    # initialize a manifest node (either `0.2` or `1.0`)
* Utils               # all used utility functions in the library. Mostly operating on `Uint8Array` objects.
* types*              # not callable, referring all types exported and reachable from the index

The `MantarayV1` and `MantarayV0_2` versions have similar exposables:

* MantarayNode        # class abstracting and manipulating Mantaray Node data
* MantarayFork        # class abstracting and manipulating Mantaray Fork data
* loadAllNodes        # loads all mantaray nodes recursively from the storage
* checkForSeparator   # _(only v0.2)_ checks for separator character in the node and its descendants prefixes
* equalNodes          # _(only v0.2)_ checks whether the two given Mantaray Node objects are equal in the in-memory abstraction level

# Basic usage

## Construct Mantaray

```ts
import { initManifestNode, Utils } from 'mantaray-js'

const node = initManifestNode() // by default it gives back 1.0 version of Mantaray
const address1 = Utils.hexToBytes<32>('4a07606f59562544dd37d26a219a65144e8cf3321b21276d8ea8de4af3ecee63')
const address2 = Utils.hexToBytes<32>('0bf983d3bf7d46afad391856f302805cea6d1bdb2df0341a00ae29db42b1eb45')
const address3 = Utils.hexToBytes<32>('5b5a1de0cdbf277446bdfc2b5f03ef12e5da8dfbd5d74ea608b0ff5544d584bd')
const address4 = Utils.hexToBytes<32>('4f64abff074c90d37c82e3e21e4d18fee52eb887a8b163eab167248e1197459e')
const address5 = Utils.hexToBytes<32>('0d7d218dfce224c1b53d7af8fd9cf88e7f053fe978716a768a88a853bd5f1bc7')
const path1 = new TextEncoder().encode('path1/valami/elso')
const path2 = new TextEncoder().encode('path1/valami/masodik')
const path3 = new TextEncoder().encode('path1/valami/masodik.ext')
const path4 = new TextEncoder().encode('path1/valami')
const path5 = new TextEncoder().encode('path2')
node.addFork(path1, {
    entry: address1, // keccak256 hash of any content that can be load from Storage. it acts as reference on the Path.
})
node.addFork(path2, {
    entry: address2,
    nodeMetadata: { vmi: 'elso' } // JSON metadata about the node that will be serialized on node level
})
node.addFork(path3, {
    entry: address3, 
    forkMetadata: { vmi2: 'masodik' } // JSON metadata about the node that will be serialized on fork level
})
node.addFork(path4, {
    entry: address4,
    nodeMetadata: { vmi3: '3' },
    forkMetadata: { vmi3: 'harmadik', vmi: '3!' }
})
node.addFork(path5, {
    nodeMetadata: { metadataAboutPath: 'it is not necessary to save entry for the new node' }
})
node.removePath(path3)
// (...)
```

## Mantaray Storage Operations

```ts
import { MantarayV1 } from 'mantaray-js'

const node = new MantarayV1.MantarayNode()
// here `reference` parameter is a `Reference` type which can be a 32 or 64 bytes Uint8Array
// and `loadFunction` is a [loadFunction: async (address: Reference): Promise<Uint8Array>] typed function
// that returns the serialised raw data of a MantarayNode of the given reference
await node.load(loadFunction, reference)

// Manipulate `node` object then save it again
// (...)

// save into the storage with a storage handler [saveFuncion: async (data: Uint8Array): Promise<Reference>]
const reference = await node.save(saveFunction)
```

# node binary format

The following describes the format of a node binary format.

```
┌────────────────────────────────┐
│    obfuscationKey <32 byte>    │
├────────────────────────────────┤
│ hash("mantaray:1.0") <31 byte> │
├────────────────────────────────┤
│      nodeFeatures <1 byte>     │
├────────────────────────────────┤
│       entry <32/64 byte>       │
├────────────────────────────────┤
│   forksIndexBytes <32 byte>    │
├────────────────────────────────┤
│ ┌────────────────────────────┐ │
│ │           Fork 1           │ │
│ ├────────────────────────────┤ │
│ │            ...             │ │
│ ├────────────────────────────┤ │
│ │           Fork N           │ │ -> where N maximum is 256
│ └────────────────────────────┘ │
├────────────────────────────────┤
│     nodeMetadata <varlen>      │
└────────────────────────────────┘
```

## Fork

```
┌───────────────────────────────┬──────────────────────────────┐
│     prefixLength <1 byte>     │        prefix <31 byte>      │
├───────────────────────────────┴──────────────────────────────┤
│                   reference <32/64 byte>                     │
├──────────────────────────────────────────────────────────────┤
│        forkMetadata <forkMetadataSegmentSize * 32 byte>      │
└──────────────────────────────────────────────────────────────┘
```

If `forkMetadataSegmentSize` is 0, then `forkMetadata` is omitted.
`forkMetadata` has the same length for each fork under one Mantaray node. 

# Testing

The testing needs running Bee client node for integration testing.
You can set `BEE_POSTAGE` environment variable with a valid Postage batch or the test will create one for you.

The default value of the Bee Debug API endpoint is `http://localhost:1635`. 
If your address diverges from that, please, set `BEE_DEBUG_API_URL` system environment variable with yours.

To run test execute

```sh
npm run test
```

## Maintainers

- [nugaon](https://github.com/nugaon)
- [AuHau](https://github.com/AuHau)

See what "Maintainer" means [here](https://github.com/ethersphere/repo-maintainer).
