/**
 * Presentation model for the composer's provider+model control.
 *
 * Everything here is pure: it turns the host's per-session model directory
 * snapshot into the strings and row lists the control renders, so the label
 * rules (the point of this plugin) are testable without a browser.
 *
 * The shapes mirror the directory snapshot published by
 * `@deepseek-ai/dsh-client-ui-model-selection` — the plugin deliberately reads
 * that service through a structural type rather than importing its internals,
 * so a rename inside the shipped package cannot break the build.
 *
 * @module dsh-provider-model-picker/client/format
 */

/** The provider id the shipped client special-cases with a localized name. */
export const ACCOUNT_PROVIDER_ID = 'deepseek-account'

/** One adapter-advertised reasoning level. */
export interface EffortLevel {
  /** Adapter-owned effort id, stored with the selection. */
  readonly id: string
  /** Display name for the level. */
  readonly name: string
}

/** Reasoning metadata for one model; absent when the adapter advertises none. */
export interface ReasoningInfo {
  /** Effort applied when the selection carries none. */
  readonly defaultEffort?: string | undefined
  /** Levels this model accepts, in adapter order. */
  readonly efforts: readonly EffortLevel[]
}

/** One selectable model inside a provider group. */
export interface ModelInfo {
  /** Provider-owned model id, stored with the selection. */
  readonly id: string
  /** Catalog display name. */
  readonly name: string
  /** Reasoning metadata, when advertised. */
  readonly reasoning?: ReasoningInfo | undefined
}

/** One provider and the models it offers. */
export interface ProviderGroup {
  /** Provider id, e.g. `deepseek-demo`. */
  readonly id: string
  /** Catalog display name, e.g. `DeepSeek Demo`. */
  readonly name: string
  /** Models in catalog order. */
  readonly models: readonly ModelInfo[]
}

/** A provider whose catalog failed to load; listed but never selectable. */
export interface ProviderFailure {
  /** Provider id. */
  readonly id: string
  /** Provider display name. */
  readonly name: string
  /** Why the group is missing. */
  readonly message: string
}

/** A complete provider/model/reasoning selection. */
export interface Selection {
  /** Provider id. */
  readonly provider: string
  /** Provider-owned model id. */
  readonly model: string
  /** Chosen reasoning effort, when the user picked one. */
  readonly reasoningEffort?: string | undefined
}

/** The directory snapshot both entries render from. */
export interface DirectoryState {
  /** Durable current selection, or null before one exists. */
  readonly current: Selection | null
  /** Whether the saved selection exists in the loaded catalog. */
  readonly routable?: boolean | null | undefined
  /** Loaded provider groups. */
  readonly groups: readonly ProviderGroup[]
  /** Providers whose catalog failed to load. */
  readonly failures: readonly ProviderFailure[]
  /** Load lifecycle of the shared catalog. */
  readonly status: 'idle' | 'loading' | 'ready' | 'selecting' | 'error'
  /** Selection submitted but not settled, when any. */
  readonly pending: Selection | null
  /** Catalog load failure message, when any. */
  readonly error: string | null
  /** Last advertised effort name for a model that is no longer routable. */
  readonly retainedEffort?: string | undefined
}

/** One model row: its provider, its model, and the selection it submits. */
export interface ModelChoice {
  /** Owning provider group. */
  readonly group: ProviderGroup
  /** The model. */
  readonly model: ModelInfo
  /** Complete selection this row submits. */
  readonly selection: Selection
}

/** One effort row. */
export interface EffortRow {
  /** Stable row key. */
  readonly key: string
  /** Effort id, or undefined for the provider default. */
  readonly effort: string | undefined
  /** Display name. */
  readonly label: string
}

/** Copy the control needs from the locale namespace. */
export interface LabelCopy {
  /** Localized name of the account provider. */
  readonly account: string
  /** Shown while the catalog is still loading. */
  readonly loading: string
  /** Shown when no session has ever chosen a model. */
  readonly fallback: string
  /** Caption for the provider-default effort. */
  readonly providerDefault: string
}

/**
 * Put the account provider first and the official provider second, preserving
 * every other relative order (the shipped picker's ordering, ported so both
 * surfaces list the same providers in the same sequence).
 *
 * @param groups - provider groups in catalog order.
 * @returns a sorted copy; model order within each group is unchanged.
 */
export function orderProviders(groups: readonly ProviderGroup[]): ProviderGroup[] {
  const rankOf = (id: string | undefined): number =>
    id === ACCOUNT_PROVIDER_ID ? 0 : id === 'deepseek-official' ? 1 : 2
  return [...asArray(groups)].sort((left, right) => rankOf(left?.id) - rankOf(right?.id))
}

/**
 * Read a value that must be an array, whatever the caller actually published.
 *
 * The directory snapshot crosses a plugin boundary, so a shape this plugin did
 * not expect must degrade to "no rows" rather than throw inside the renderer —
 * a throw there retires the whole seat, and the shipped picker comes back.
 *
 * @param value - the candidate.
 * @returns the value when it is an array, otherwise an empty one.
 */
function asArray<T>(value: readonly T[] | undefined | null): readonly T[] {
  return Array.isArray(value) ? value : []
}

/**
 * Read a provider's model list defensively.
 * @param group - the provider group.
 * @returns the models it advertises, or none.
 */
function modelsOf(group: ProviderGroup): readonly ModelInfo[] {
  return asArray(group?.models)
}

/**
 * The provider's display name: the catalog name, the account's localized name,
 * and finally the raw id — a provider with no name still gets a label.
 *
 * @param provider - the provider group or failure row.
 * @param account - localized name of the account provider.
 * @returns the provider name to show.
 */
export function providerLabel(
  provider: { readonly id?: string | undefined; readonly name?: string | undefined } | undefined,
  account: string,
): string {
  if (provider === undefined || provider === null) return 'unknown'
  const id = typeof provider.id === 'string' && provider.id.length > 0 ? provider.id : 'unknown'
  if (id === ACCOUNT_PROVIDER_ID) return account
  return typeof provider.name === 'string' && provider.name.length > 0 ? provider.name : id
}

/**
 * The selection one catalog row submits: the provider/model pair plus the
 * model's own default effort, when it advertises one.
 *
 * @param group - the row's provider.
 * @param model - the row's model.
 * @returns a complete selection for that row.
 */
export function selectionFor(group: ProviderGroup, model: ModelInfo): Selection {
  const defaultEffort = model?.reasoning?.defaultEffort
  return {
    provider: typeof group?.id === 'string' && group.id.length > 0 ? group.id : 'unknown',
    model: typeof model?.id === 'string' ? model.id : 'unknown',
    ...(defaultEffort === undefined ? {} : { reasoningEffort: defaultEffort }),
  }
}

/**
 * Flatten the loaded directory into selectable model rows.
 * @param groups - provider groups in catalog order.
 * @returns one choice per model, provider-grouped and account-first.
 */
export function modelChoices(groups: readonly ProviderGroup[]): ModelChoice[] {
  const choices: ModelChoice[] = []
  for (const group of orderProviders(groups)) {
    for (const model of modelsOf(group)) {
      choices.push({ group, model, selection: selectionFor(group, model) })
    }
  }
  return choices
}

/**
 * Find the loaded row a stored selection addresses.
 * @param choices - the flattened catalog.
 * @param selection - the stored provider/model pair.
 * @returns the row, or undefined when the model is gone from the catalog.
 */
export function choiceOf(
  choices: readonly ModelChoice[],
  selection: Selection | null,
): ModelChoice | undefined {
  if (selection === null) return undefined
  return choices.find(
    (choice) =>
      choice.selection.provider === selection.provider && choice.selection.model === selection.model,
  )
}

/**
 * The model half of the trigger text. This is the plugin's whole point: a
 * loaded selection reads `Provider/Model` instead of the bare model name, and
 * an unloaded one keeps the shipped degenerate forms.
 *
 * @param state - the directory snapshot.
 * @param copy - localized captions.
 * @returns the text to show in the trigger's model slot.
 */
export function modelLabel(state: DirectoryState, copy: LabelCopy): string {
  const current = state?.current ?? null
  const groups = asArray(state?.groups)
  const choice = choiceOf(modelChoices(groups), current)
  if (choice !== undefined) {
    return `${providerLabel(choice.group, copy.account)}/${choice.model.name}`
  }
  if (current === null) {
    return state?.status === 'loading' ? copy.loading : copy.fallback
  }
  // A saved selection the catalog no longer lists: name the provider when the
  // group is known (its catalog failed, or it vanished), else show the raw id.
  const group = groups.find((candidate) => candidate?.id === current.provider)
  const provider = group === undefined ? current.provider : providerLabel(group, copy.account)
  return `${provider}/${current.model}`
}

/**
 * The effort half of the trigger text.
 * @param state - the directory snapshot.
 * @param copy - localized captions.
 * @returns the effort caption, or undefined when the model advertises none.
 */
export function effortLabel(state: DirectoryState, copy: LabelCopy): string | undefined {
  const reasoning = choiceOf(modelChoices(asArray(state?.groups)), state?.current ?? null)?.model
    ?.reasoning
  if (reasoning === undefined) return state?.retainedEffort
  const effort = state?.current?.reasoningEffort ?? reasoning.defaultEffort
  if (effort === undefined) return copy.providerDefault
  return asArray(reasoning.efforts).find((level) => level?.id === effort)?.name ?? effort
}

/**
 * The effort rows for one model: a provider-default row when the adapter names
 * no default, then every advertised level.
 *
 * @param reasoning - the current model's reasoning metadata.
 * @param providerDefault - localized caption for the default row.
 * @returns the rows, empty when the model advertises no reasoning support.
 */
export function effortRows(
  reasoning: ReasoningInfo | undefined,
  providerDefault: string,
): EffortRow[] {
  if (reasoning === undefined) return []
  return [
    ...(reasoning.defaultEffort === undefined
      ? [{ key: 'provider-default', effort: undefined, label: providerDefault }]
      : []),
    ...asArray(reasoning.efforts)
      .filter((level) => level !== undefined && level !== null)
      .map((level) => ({
        key: `effort:${String(level.id)}`,
        effort: level.id,
        label: typeof level.name === 'string' ? level.name : String(level.id),
      })),
  ]
}

/**
 * Whether a row carries the given value — the check mark and the pending
 * spinner both key off this, so the same selection lights both surfaces.
 *
 * @param selection - the row's selection.
 * @param current - the value to compare against.
 * @returns whether the row carries that provider/model pair.
 */
export function carries(selection: Selection, current: Selection | null): boolean {
  return current !== null && selection.provider === current.provider && selection.model === current.model
}

/**
 * The trigger's accessible name, assembled from the same strings it displays.
 *
 * @param state - the directory snapshot.
 * @param copy - localized captions.
 * @param aria - the three aria templates: model only, with effort, and unset.
 * @returns the accessible name for the trigger button.
 */
export function triggerAria(
  state: DirectoryState,
  copy: LabelCopy,
  aria: {
    /** Template with `{model}`. */
    readonly model: string
    /** Template with `{model}` and `{effort}`. */
    readonly effort: string
    /** Used when no session has chosen a model. */
    readonly select: string
  },
): string {
  if (state.current === null && state.status === 'loading') return copy.loading
  if (state.current === null) return aria.select
  const model = modelLabel(state, copy)
  const effort = effortLabel(state, copy)
  if (effort === undefined) return aria.model.replace('{model}', model)
  return aria.effort.replace('{model}', model).replace('{effort}', effort)
}

/**
 * Render one template with named substitutions.
 * @param template - copy containing `{name}` placeholders.
 * @param values - replacement values by placeholder name.
 * @returns the filled template.
 */
export function fill(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  let out = template
  for (const [name, value] of Object.entries(values)) out = out.split(`{${name}}`).join(value)
  return out
}