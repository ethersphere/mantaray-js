# Changelog

### [1.0.1](https://www.github.com/ethersphere/mantaray-js/compare/v1.0.0...v1.0.1) (2021-08-12)


### Bug Fixes

* path of types in package.json ([#10](https://www.github.com/ethersphere/mantaray-js/issues/10)) ([fa3b96e](https://www.github.com/ethersphere/mantaray-js/commit/fa3b96eca0e1fb682d6322b8541cf6afe548e50f))

## 1.0.0 (2021-08-12)

First version of the `mantaray-js`!

All necessary functionality is available in the package to manipulate the `mantaray` data structure like:

* init Mantaray node
* serialize/deserialize of Mantaray in-memory object
* add forks
* remove path
* add metadata
* add entry
* set obfuscation key
* load from storage
* save to storage recursively
* get fork at an arbitrary path

All of these you can do through the `MantarayNode` and `MantarayFork` abstractions.

1.0.0 version of `mantaray-js` provides the following importables:

* MantarayNode        # class abstracting and manipulating Mantaray Node data
* MantarayFork        # class abstracting and manipulating Mantaray Fork data
* checkForSeparator   # checks for separator character in the node and its descendants prefixes
* initManifestNode    # initialize a manifest node
* loadAllNodes        # loads all mantaray nodes recursively from the storage
* equalNodes          # checks whether the two given Mantaray Nodes objects are equal in the in-memory abstraction level
* Utils               # all used utility functions in the library. Mostly operating on `Uint8Array` objects.
* types*              # not callable, referring all types exported and reachable from the index

### Features

* export functions ([#9](https://www.github.com/ethersphere/mantaray-js/issues/9)) ([1f75690](https://www.github.com/ethersphere/mantaray-js/commit/1f75690dcf8783f13edb0f34f140be69ee6ee0ee))
* get fork at path and check for separator ([#3](https://www.github.com/ethersphere/mantaray-js/issues/3)) ([031d75a](https://www.github.com/ethersphere/mantaray-js/commit/031d75a01849b507388acdda4fb05623febcde7d))
* init ([#1](https://www.github.com/ethersphere/mantaray-js/issues/1)) ([260f042](https://www.github.com/ethersphere/mantaray-js/commit/260f0425f42d650afd0257b900697f5a2d397c68))
