# Description

With this package you can manipulate and interpret mantaray data via `MantarayNode` and `MantarayFork` abstractions.

# node binary format

The following describes the format of a node binary format.

```
┌────────────────────────────────┐
│    obfuscationKey <32 byte>    │
├────────────────────────────────┤
│ hash("mantaray:0.1") <31 byte> │
├────────────────────────────────┤
│     refBytesSize <1 byte>      │
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
│ │           Fork N           │ │
│ └────────────────────────────┘ │
└────────────────────────────────┘
```

## Fork

```
┌───────────────────┬───────────────────────┬──────────────────┐
│ nodeType <1 byte> │ prefixLength <1 byte> │ prefix <30 byte> │
├───────────────────┴───────────────────────┴──────────────────┤
│                    reference <32/64 bytes>                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Fork with metadata

```
┌───────────────────┬───────────────────────┬──────────────────┐
│ nodeType <1 byte> │ prefixLength <1 byte> │ prefix <30 byte> │
├───────────────────┴───────────────────────┴──────────────────┤
│                    reference <32/64 bytes>                   │
│                                                              │
├─────────────────────────────┬────────────────────────────────┤
│ metadataBytesSize <2 bytes> │     metadataBytes <varlen>     │
├─────────────────────────────┘                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Maintainers

- [nugaon](https://github.com/nugaon)
- [AuHau](https://github.com/AuHau)

See what "Maintainer" means [here](https://github.com/ethersphere/repo-maintainer).
