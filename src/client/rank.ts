/**
 * Fuzzy model ranking for the picker's search field.
 *
 * A port of the shipped client's `rankByName`/`alignmentScore`
 * (`@deepseek-ai/dsh-client-ui-primitives`): the query must be a case-insensitive
 * ordered subsequence of the name, prefix hits rank first, then the strongest
 * alignment score, then catalog order. It is reimplemented here rather than
 * imported so the control keeps working if the primitive is renamed or moved —
 * the plugin only depends on the platform's seed modules (React) and on the
 * model directory's data.
 *
 * @module dsh-provider-model-picker/client/rank
 */

/**
 * Extra weight for matches at a word boundary.
 * @param name - lowercased candidate name.
 * @param index - matched character index.
 * @returns the boundary bonus.
 */
function boundaryBonus(name: string, index: number): number {
  return index === 0 || name.charAt(index - 1) === '-' || name.charAt(index - 1) === '_' ? 8 : 0
}

/**
 * Score the strongest ordered-subsequence alignment in O(name × query).
 * @param name - lowercased candidate name.
 * @param query - lowercased query.
 * @returns the alignment score, or undefined when the query is not a subsequence.
 */
export function alignmentScore(name: string, query: string): number | undefined {
  if (query.length > name.length) return undefined
  const noMatch = Number.NEGATIVE_INFINITY
  let previous = Array.from({ length: name.length }, () => noMatch)
  for (let index = 0; index < name.length; index++) {
    if (name.charAt(index) === query.charAt(0)) {
      previous[index] = 1 + boundaryBonus(name, index) - index
    }
  }
  for (let queryIndex = 1; queryIndex < query.length; queryIndex++) {
    const current = Array.from({ length: name.length }, () => noMatch)
    let left = noMatch
    let leftLeft = noMatch
    let bestGapped = noMatch
    for (let index = 0; index < name.length; index++) {
      if (leftLeft !== noMatch) bestGapped = Math.max(bestGapped, leftLeft + index - 2)
      if (name.charAt(index) === query.charAt(queryIndex)) {
        const bonus = 1 + boundaryBonus(name, index)
        let score = noMatch
        if (left !== noMatch) score = left + bonus + 4
        if (bestGapped !== noMatch) score = Math.max(score, bestGapped + bonus + 1 - index)
        current[index] = score
      }
      leftLeft = left
      left = previous[index] ?? noMatch
    }
    previous = current
  }
  let best = noMatch
  for (const score of previous) best = Math.max(best, score)
  return best === noMatch ? undefined : best
}

/**
 * Rank models by the search query.
 * @param models - candidates in catalog order.
 * @param rawQuery - the typed text; matched case-insensitively.
 * @returns matching models, prefix hits first, then by score, then in input order.
 */
export function rankModels<T extends { readonly name?: string | undefined }>(
  models: readonly T[] | undefined | null,
  rawQuery: string,
): T[] {
  if (!Array.isArray(models)) return []
  const query = rawQuery.trim().toLowerCase()
  if (query === '') return [...models]
  const ranked: { item: T; index: number; prefix: boolean; score: number }[] = []
  models.forEach((model, index) => {
    // A row without a usable name cannot be matched — skip it rather than throw
    // inside the renderer, which would retire the whole seat.
    if (typeof model?.name !== 'string') return
    const name = model.name.toLowerCase()
    const score = alignmentScore(name, query)
    if (score === undefined) return
    ranked.push({ item: model, index, prefix: name.startsWith(query), score })
  })
  ranked.sort(
    (left, right) =>
      Number(right.prefix) - Number(left.prefix) || right.score - left.score || left.index - right.index,
  )
  return ranked.map((match) => match.item)
}