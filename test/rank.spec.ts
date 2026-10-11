/**
 * The search ranking, against the real implementation.
 *
 * @module dsh-provider-model-picker/test/rank
 */

import { describe, expect, it } from 'vitest'
import { alignmentScore, rankModels } from '../src/client/rank.ts'

const models = [
  { name: 'DeepSeek-V4.1-Pro' },
  { name: 'DeepSeek-V4.1-Flash' },
  { name: 'GLM-4.6' },
  { name: 'deepseek-v4.1-pro-preview' },
]

describe('alignmentScore', () => {
  it('rejects a query that is not an ordered subsequence', () => {
    expect(alignmentScore('deepseek', 'zzz')).toBeUndefined()
    expect(alignmentScore('glm', 'gm4')).toBeUndefined()
    expect(alignmentScore('ab', 'abc')).toBeUndefined()
  })

  it('scores a prefix hit higher than a scattered one', () => {
    const prefix = alignmentScore('deepseek-v4', 'deep')
    const scattered = alignmentScore('deepseek-v4', 'dsk')
    expect(prefix).toBeDefined()
    expect(scattered).toBeDefined()
    expect(prefix!).toBeGreaterThan(scattered!)
  })
})

describe('rankModels', () => {
  it('returns every model for a blank query, in catalog order', () => {
    expect(rankModels(models, '')).toEqual(models)
    expect(rankModels(models, '   ')).toEqual(models)
  })

  it('matches case-insensitively and puts prefix hits first', () => {
    const ranked = rankModels(models, 'DEEP')
    expect(ranked.map((model) => model.name)).toEqual([
      'DeepSeek-V4.1-Pro',
      'DeepSeek-V4.1-Flash',
      'deepseek-v4.1-pro-preview',
    ])
  })

  it('supports nonconsecutive characters in order', () => {
    expect(rankModels(models, 'dsf').map((model) => model.name)).toEqual([
      'DeepSeek-V4.1-Flash',
    ])
    // 'dsp' needs the p after the s, so only the Pro rows can match.
    expect(rankModels(models, 'dsp').map((model) => model.name)).toEqual([
      'DeepSeek-V4.1-Pro',
      'deepseek-v4.1-pro-preview',
    ])
  })

  it('filters everything out when nothing matches', () => {
    expect(rankModels(models, 'zzz')).toEqual([])
  })

  it('survives a missing list and rows without names', () => {
    expect(rankModels(undefined, 'x')).toEqual([])
    expect(rankModels(null, 'x')).toEqual([])
    expect(rankModels([{ name: 'GLM-4.6' }, {}, { id: 'no-name' }] as never, 'glm')).toEqual([
      { name: 'GLM-4.6' },
    ])
    expect(rankModels([{}, { id: 'no-name' }] as never, '')).toHaveLength(2)
  })
})