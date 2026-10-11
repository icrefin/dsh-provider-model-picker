/**
 * Copy for the provider+model control.
 *
 * `dsh-provider-model-picker` is this plugin's locale namespace:
 * `ctx.locale.register` publishes the dictionaries and `ctx.locale.bind` hands
 * out a translate seat bound to them. The shipped picker's own namespace
 * (`model`) is left untouched, so both surfaces stay independently
 * translatable.
 *
 * @module dsh-provider-model-picker/client/locales
 */

/** English copy. */
export const en = {
  'provider.account': 'DeepSeek Account',
  'trigger.fallback': 'Select model',
  'trigger.loading': 'Loading models…',
  'trigger.selectAria': 'Select model',
  'trigger.aria': 'Select model, current {model}',
  'trigger.ariaEffort': 'Select model, current {model}, reasoning effort {effort}',
  'menu.aria': 'Model and reasoning effort',
  'menu.model': 'Model',
  'menu.effort': 'Effort',
  'menu.loading': 'Refreshing the model list…',
  'effort.providerDefault': 'Default',
  'search.placeholder': 'Search models…',
  'search.clear': 'Clear search',
  'search.empty': 'No matching models.',
  'empty.models': 'No models available.',
  'empty.efforts': 'This model provides no reasoning effort levels.',
  'error.action': 'Model action failed: {message}',
  'error.sessionInUse':
    'This session is already in use, possibly by another running DSH instance (such as dsh web or the desktop app). Quit other running DSH instances and try again.',
  'warning.groupLoad': '{name} failed to load: {message}',
  'action.reload': 'Reload',
  'failure.label': 'picker error',
  'failure.handBack': 'click to use the default picker',
}

/** Simplified Chinese copy. Typed against `en`, so a missing key fails the build. */
export const zh: typeof en = {
  'provider.account': 'DeepSeek 账号',
  'trigger.fallback': '请选择模型',
  'trigger.loading': '正在加载模型…',
  'trigger.selectAria': '请选择模型',
  'trigger.aria': '选择模型，当前 {model}',
  'trigger.ariaEffort': '选择模型，当前 {model}，推理等级 {effort}',
  'menu.aria': '模型与推理等级',
  'menu.model': '模型',
  'menu.effort': '推理等级',
  'menu.loading': '正在刷新模型列表…',
  'effort.providerDefault': 'Default',
  'search.placeholder': '搜索模型…',
  'search.clear': '清除搜索',
  'search.empty': '没有匹配的模型。',
  'empty.models': '没有可用的模型。',
  'empty.efforts': '当前模型未提供推理等级。',
  'error.action': '模型操作失败：{message}',
  'error.sessionInUse':
    '当前会话已被占用，可能是其他正在运行的 DSH 导致的（如其他 dsh web、桌面端），请退出其他正在运行的 DSH 后重试。',
  'warning.groupLoad': '{name} 加载失败：{message}',
  'action.reload': '重新加载',
  'failure.label': '模型选择器错误',
  'failure.handBack': '点击改用默认选择器',
}

/** One key of this plugin's dictionary. */
export type LabelKey = keyof typeof en

/**
 * Translate one key of this plugin's dictionary.
 *
 * Matches the platform's `Translate<K>` seat (`Record<string, unknown>`
 * template params), so the framework's own translate function is assignable to
 * this shape without a cast.
 */
export type Translate = (key: LabelKey, params?: Record<string, unknown>) => string