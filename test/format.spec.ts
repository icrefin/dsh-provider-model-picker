/**
 * The label rules — the reason this plugin exists.
 *
 * These drive the real `format.ts` module: every expectation below is the
 * string the composer's trigger would render for that directory snapshot.
 *
 * @module dsh-provider-model-picker/test/format
 */

import { describe, expect, it } from 'vitest'
import {
  carries,
  choiceOf,
  effortLabel,
  effortRows,
  fill,
  modelChoices,
  modelLabel,
  orderProviders,
  providerLabel,
  selectionFor,
  triggerAria,
  type DirectoryState,
  type LabelCopy,
  type ProviderGroup,
} from '../src/client/format.ts'
import { emptyState } from './support.ts'

const copy: LabelCopy = {
  account: 'DeepSeek Account',
  loading: 'Loading models…',
  fallback: 'Select model',
  providerDefault: 'Default',
}

/** A third-party provider, the case the screenshot asked about. */
const demo: ProviderGroup = {
  id: 'deepseek-demo',
  name: 'DeepSeek Demo',
  models: [
    { id: 'deepseek-v4.1-flash', name: 'DeepSeek-V4.1-Flash' },
    { id: 'deepseek-v4.1-pro', name: 'DeepSeek-V4.1-Pro' },
  ],
}

const account: ProviderGroup = {
  id: 'deepseek-account',
  name: 'ignored-catalog-name',
  models: [{ id: 'deepseek-chat', name: 'DeepSeek-V3.2' }],
}

const thinkModel: ProviderGroup = {
  id: 'deepseek-official',
  name: 'DeepSeek',
  models: [
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek-R1',
      reasoning: {
        defaultEffort: 'high',
        efforts: [
          { id: 'low', name: 'Low' },
          { id: 'high', name: 'High' },
        ],
      },
    },
  ],
}

describe('providerLabel', () => {
  it('localizes the account provider and keeps every catalog name', () => {
    expect(providerLabel(account, copy.account)).toBe('DeepSeek Account')
    expect(providerLabel(demo, copy.account)).toBe('DeepSeek Demo')
  })

  it('falls back to the provider id when the catalog carries no name', () => {
    expect(providerLabel({ id: 'custom-endpoint', name: '' }, copy.account)).toBe('custom-endpoint')
  })
})

describe('orderProviders', () => {
  it('puts the account provider first and the official one second', () => {
    const ordered = orderProviders([demo, thinkModel, account])
    expect(ordered.map((group) => group.id)).toEqual([
      'deepseek-account',
      'deepseek-official',
      'deepseek-demo',
    ])
  })
})

describe('modelLabel', () => {
  it('names the provider beside the loaded model', () => {
    const state = emptyState({
      current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' },
      groups: [demo],
      status: 'ready',
    })
    expect(modelLabel(state, copy)).toBe('DeepSeek Demo/DeepSeek-V4.1-Flash')
  })

  it('uses the localized account name for the account provider', () => {
    const state = emptyState({
      current: { provider: 'deepseek-account', model: 'deepseek-chat' },
      groups: [account],
      status: 'ready',
    })
    expect(modelLabel(state, copy)).toBe('DeepSeek Account/DeepSeek-V3.2')
  })

  it('keeps the provider prefix when the model left the catalog', () => {
    const state = emptyState({
      current: { provider: 'deepseek-demo', model: 'retired-model' },
      groups: [demo],
      status: 'ready',
    })
    expect(modelLabel(state, copy)).toBe('DeepSeek Demo/retired-model')
  })

  it('falls back to the raw provider id for an unknown provider', () => {
    const state = emptyState({
      current: { provider: 'removed-provider', model: 'ghost' },
      groups: [demo],
      status: 'ready',
    })
    expect(modelLabel(state, copy)).toBe('removed-provider/ghost')
  })

  it('keeps the loading and unset labels the shipped control used', () => {
    expect(modelLabel(emptyState({ status: 'loading' }), copy)).toBe('Loading models…')
    expect(modelLabel(emptyState({ status: 'ready' }), copy)).toBe('Select model')
  })
})

describe('effortLabel', () => {
  it('reads the advertised default, an explicit choice, and a retired effort', () => {
    const ready: DirectoryState = emptyState({
      current: { provider: 'deepseek-official', model: 'deepseek-reasoner' },
      groups: [thinkModel],
      status: 'ready',
    })
    expect(effortLabel(ready, copy)).toBe('High')
    expect(
      effortLabel(
        { ...ready, current: { provider: 'deepseek-official', model: 'deepseek-reasoner', reasoningEffort: 'low' } },
        copy,
      ),
    ).toBe('Low')
    expect(
      effortLabel(
        { ...ready, current: { provider: 'deepseek-official', model: 'deepseek-reasoner', reasoningEffort: 'x-high' } },
        copy,
      ),
    ).toBe('x-high')
  })

  it('says Default when the adapter names no default, and nothing for a model without reasoning', () => {
    const noDefault: ProviderGroup = {
      id: 'deepseek-official',
      name: 'DeepSeek',
      models: [{ id: 'plain', name: 'Plain', reasoning: { efforts: [{ id: 'low', name: 'Low' }] } }],
    }
    const state = emptyState({
      current: { provider: 'deepseek-official', model: 'plain' },
      groups: [noDefault],
      status: 'ready',
    })
    expect(effortLabel(state, copy)).toBe('Default')

    const noReasoning = emptyState({
      current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' },
      groups: [demo],
      status: 'ready',
    })
    expect(effortLabel(noReasoning, copy)).toBeUndefined()
  })

  it('retains the last known effort for a model that is no longer listed', () => {
    const state = emptyState({
      current: { provider: 'gone', model: 'gone' },
      groups: [],
      status: 'ready',
      retainedEffort: 'High',
    })
    expect(effortLabel(state, copy)).toBe('High')
  })
})

describe('catalog projection', () => {
  it('flattens rows account-first and carries each model default effort', () => {
    const choices = modelChoices([demo, thinkModel, account])
    expect(choices.map((choice) => choice.selection.provider)).toEqual([
      'deepseek-account',
      'deepseek-official',
      'deepseek-demo',
      'deepseek-demo',
    ])
    const reasoner = choices.find((choice) => choice.model.id === 'deepseek-reasoner')
    expect(reasoner?.selection).toEqual({
      provider: 'deepseek-official',
      model: 'deepseek-reasoner',
      reasoningEffort: 'high',
    })
    const flash = choices.find((choice) => choice.model.id === 'deepseek-v4.1-flash')
    expect(flash?.selection).toEqual({ provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' })
  })

  it('finds a row by selection and reports a missing one', () => {
    const choices = modelChoices([demo])
    const row = choices[0]
    expect(row).toBeDefined()
    expect(choiceOf(choices, { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' })).toBe(row)
    expect(choiceOf(choices, { provider: 'deepseek-demo', model: 'nope' })).toBeUndefined()
    expect(choiceOf(choices, null)).toBeUndefined()
  })

  it('matches rows by provider and model, never by effort', () => {
    const selection = { provider: 'a', model: 'b', reasoningEffort: 'low' }
    expect(carries(selection, { provider: 'a', model: 'b' })).toBe(true)
    expect(carries(selection, { provider: 'a', model: 'b', reasoningEffort: 'high' })).toBe(true)
    expect(carries(selection, { provider: 'a', model: 'c' })).toBe(false)
    expect(carries(selection, null)).toBe(false)
  })

  it('omits the default effort for a model that advertises none', () => {
    expect(selectionFor(demo, demo.models[0]!)).toEqual({
      provider: 'deepseek-demo',
      model: 'deepseek-v4.1-flash',
    })
  })
})

describe('effortRows', () => {
  it('adds a provider-default row only when no default is advertised', () => {
    expect(
      effortRows({ defaultEffort: 'high', efforts: [{ id: 'high', name: 'High' }] }, 'Default'),
    ).toEqual([{ key: 'effort:high', effort: 'high', label: 'High' }])
    expect(effortRows({ efforts: [{ id: 'low', name: 'Low' }] }, 'Default')).toEqual([
      { key: 'provider-default', effort: undefined, label: 'Default' },
      { key: 'effort:low', effort: 'low', label: 'Low' },
    ])
    expect(effortRows(undefined, 'Default')).toEqual([])
  })
})

describe('triggerAria', () => {
  const aria = {
    model: 'Select model, current {model}',
    effort: 'Select model, current {model}, reasoning effort {effort}',
    select: 'Select model',
  }

  it('announces the same provider-qualified name the trigger shows', () => {
    const state = emptyState({
      current: { provider: 'deepseek-demo', model: 'deepseek-v4.1-flash' },
      groups: [demo],
      status: 'ready',
    })
    expect(triggerAria(state, copy, aria)).toBe(
      'Select model, current DeepSeek Demo/DeepSeek-V4.1-Flash',
    )
  })

  it('includes the effort when the model advertises one', () => {
    const state = emptyState({
      current: { provider: 'deepseek-official', model: 'deepseek-reasoner' },
      groups: [thinkModel],
      status: 'ready',
    })
    expect(triggerAria(state, copy, aria)).toBe(
      'Select model, current DeepSeek/DeepSeek-R1, reasoning effort High',
    )
  })

  it('keeps the unset and loading names', () => {
    expect(triggerAria(emptyState({ status: 'ready' }), copy, aria)).toBe('Select model')
    expect(triggerAria(emptyState({ status: 'loading' }), copy, aria)).toBe('Loading models…')
  })
})

describe('fill', () => {
  it('substitutes every occurrence of a placeholder', () => {
    expect(fill('{a} and {a} plus {b}', { a: 'one', b: 'two' })).toBe('one and one plus two')
  })
})

describe('catalogue shapes this plugin did not expect', () => {
  // The snapshot crosses a plugin boundary. Anything malformed must degrade to
  // an empty or id-labelled row: a throw here happens inside the renderer,
  // which retires the whole seat and hands the composer back to the shipped
  // picker.
  it('survives a missing or non-array group list', () => {
    expect(orderProviders(undefined as never)).toEqual([])
    expect(orderProviders(null as never)).toEqual([])
    expect(modelChoices(undefined as never)).toEqual([])
    expect(
      modelLabel({ ...emptyState({ status: 'ready' }), groups: null as never }, copy),
    ).toBe('Select model')
  })

  it('survives a group without models, name or id', () => {
    const broken = [
      { id: 'no-models', name: 'No Models' },
      { name: 'No Id', models: [] },
      null,
    ] as never as ProviderGroup[]
    expect(() => modelChoices(broken)).not.toThrow()
    expect(modelChoices(broken)).toEqual([])
    expect(providerLabel({ name: '' } as never, copy.account)).toBe('unknown')
    expect(providerLabel(null as never, copy.account)).toBe('unknown')
  })

  it('survives a model without a name or id', () => {
    const group = { id: 'g', name: 'G', models: [{ id: 'm1' }, { name: 'M2' }] } as never as ProviderGroup
    expect(() => modelChoices([group])).not.toThrow()
    expect(modelChoices([group]).map((choice) => choice.selection.model)).toEqual(['m1', 'unknown'])
    const state = emptyState({
      current: { provider: 'g', model: 'm1' },
      groups: [group],
      status: 'ready',
    })
    expect(() => modelLabel(state, copy)).not.toThrow()
    expect(modelLabel(state, copy)).toBe('G/undefined')
  })

  it('survives reasoning metadata without an efforts array', () => {
    const group = {
      id: 'g',
      name: 'G',
      models: [{ id: 'm', name: 'M', reasoning: { defaultEffort: 'high' } }],
    } as never as ProviderGroup
    expect(() => effortRows({ defaultEffort: 'high' } as never, 'Default')).not.toThrow()
    expect(effortRows({ defaultEffort: 'high' } as never, 'Default')).toEqual([])
    const state = emptyState({
      current: { provider: 'g', model: 'm', reasoningEffort: 'low' },
      groups: [group],
      status: 'ready',
    })
    expect(() => effortLabel(state, copy)).not.toThrow()
    expect(effortLabel(state, copy)).toBe('low')
  })

  it('survives a selection payload that lost its ids', () => {
    const broken = { id: 'g', name: 'G', models: [{ id: 'm', name: 'M' }] } as never as ProviderGroup
    expect(selectionFor(broken, {} as never)).toEqual({ provider: 'g', model: 'unknown' })
    expect(selectionFor({} as never, {} as never)).toEqual({ provider: 'unknown', model: 'unknown' })
  })
})