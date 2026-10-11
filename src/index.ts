/**
 * dsh-provider-model-picker — host half.
 *
 * This plugin changes an existing browser surface, so the host half mounts
 * nothing: the Loader row exists so the boot graph carries a client bundle (the
 * `dsh.client` declaration in `package.json` loads `exports["./client"]` into
 * the web GUI), and the browser half reads the per-session model directory that
 * `@deepseek-ai/dsh-client-ui-model-selection` already owns. No route, no
 * service, no Config.
 *
 * @module dsh-provider-model-picker
 */

/** Loader row id; mirrors `cordis.patch.yml`. */
export const name = 'dsh-provider-model-picker'

/** Host plugin body — deliberately empty; see the module doc. */
export function apply(): void {}