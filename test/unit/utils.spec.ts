import { serializeMetadataInSegment } from '../../src/utils'

describe('utils', () => {
  it('serializeMetadataInSegment', () => {
    const testMetadata = { valami: 'test' }
    const metadataSegment = serializeMetadataInSegment(testMetadata, 1)
    expect(metadataSegment.length).toBe(32)
    const metadataSegment2 = serializeMetadataInSegment(undefined, 10)
    expect(metadataSegment2.length).toBe(320)
    expect(() => serializeMetadataInSegment(testMetadata, 0)).toThrowError(
      /^serialized metadata does not fit into the reserved/,
    )
  })
})
