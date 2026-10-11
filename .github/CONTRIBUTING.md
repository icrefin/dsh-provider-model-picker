# Contributing to icrefin/dsh-provider-model-picker

Thanks for taking the time to contribute. This document covers the repository
**dsh-provider-model-picker** owned by `icrefin`.

## Ways to contribute

- Report a bug using the *Bug report* issue form.
- Request a feature using the *Feature request* issue form.
- Improve documentation, examples, or translations.
- Send a pull request that fixes or implements something on the issue tracker.

If you plan a large change, open an issue first so we can agree on the design
before you write the implementation.

## Before you start

1. Search existing issues and pull requests to avoid duplicates.
2. Read the [Code of Conduct](CODE_OF_CONDUCT.md).
3. Check the README for supported versions and prerequisites.

## Development setup

This is a TypeScript package built with pnpm. It needs **Node >= 22.17.0** and
**pnpm 11.8.0**, the version pinned in `package.json` through `packageManager`
(`corepack enable` picks it up). The `@deepseek-ai/dsh-*` peer dependencies are
published on npm, so a clean checkout really does install.

```bash
git clone https://github.com/icrefin/dsh-provider-model-picker.git
cd dsh-provider-model-picker
git switch main

corepack enable
pnpm install
pnpm check          # tsc over both halves, the bundle build, then vitest
```

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | `tsc` over the host half and, separately, over the browser half |
| `pnpm test` | `vitest run` — 81 tests in the six `test/*.spec.ts` files |
| `pnpm check` | `pnpm typecheck && pnpm build && pnpm test` — run this before opening a pull request |
| `pnpm build` | `tsc -p tsconfig.build.json` then `tsdown` (`lib/`, `lib/client.js`) |
| `pnpm pack` | `pnpm build`, then `pnpm pack --pack-destination dist/` |

`lib/` and `dist/` are build products and are not committed. `pnpm check` builds
before it tests, which is why the bundle spec has something to load.

### What each suite covers

| File | Cases | Covers |
| --- | --- | --- |
| `test/format.spec.ts` | 25 | the label rule, catalog projection, effort rows, aria strings, and the malformed snapshot shapes a plugin boundary can produce |
| `test/rank.spec.ts` | 7 | the fuzzy ranking behind the model search field |
| `test/render.spec.ts` | 9 | what the trigger actually renders, through React's static renderer over a directory double |
| `test/interaction.spec.ts` | 20 | the real component in jsdom: open, drill, choose a model, choose an effort, search, keyboard walk, and both failure faces |
| `test/seat.spec.ts` | 16 | the seat registration driven through the plugin's real `apply`: shadow priority, session wiring, teardown, and the refusal path |
| `test/bundle.spec.ts` | 4 | the built `lib/client.js` loaded behind a fake `window.__ModuleLoader__`, which is the only check on the loader banner |

### Preview harness

`tools/preview.mjs` renders the built browser bundle outside the GUI and
screenshots it: it loads `lib/client.js` through a stub `window.__ModuleLoader__`,
calls the plugin's `apply` with a minimal fake client context, mounts the
recorded seat over a fake catalog where two providers offer a model of the same
name, and captures the trigger with the root pane open and the model pane open.

```bash
node tools/preview.mjs --out /tmp/pm-preview    # writes index.html + the PNG
node tools/preview.mjs --png docs/images/provider-model-control.png
node tools/preview.mjs --open                   # ...and opens the PNG
```

It builds the bundle when `lib/client.js` is missing, and it needs Google Chrome
(or Chromium/Edge) on the host plus the `react` and `react-dom` dev dependencies
(the UMD builds the harness page loads). It never reads a DSH profile.

### Dev profile

`scripts/dev-profile.sh` brings up an isolated harness home under `.dev-home/`,
which never touches the profile the desktop app uses:

```bash
scripts/dev-profile.sh boot 19531   # isolated dsh home under .dev-home/, own port
scripts/dev-profile.sh dump         # the composed row
scripts/dev-profile.sh remove       # delete .dev-home/
```

## Branch and commit conventions

- Branch from `main`; keep one topic per branch (`fix/...`, `feat/...`, `docs/...`).
- Keep commits small and focused.
- Write imperative, scoped commit messages, e.g. `fix(label): keep the provider name when the group is gone`.
- Rebase onto the latest `main` before requesting review; avoid merge commits inside the PR branch.

## Pull requests

Every pull request must:

- Explain **what** changed and **why**.
- Link the issue it closes (`Closes #123`).
- Pass CI.
- Update documentation whenever user-facing text or behavior changes — including
  both the English and the Chinese copy in `src/client/locales.ts`, because the
  control renders whichever locale the host has active.
- Contain no secrets, tokens, private keys, internal hostnames, or personal data.
- State the license of any newly added dependency and confirm it is compatible with
  this project's `MIT` license.

Use the repository's pull request template. Do not delete checklist items without
explaining why.

## Reporting bugs

A useful bug report contains:

- The version, commit SHA, or release tag of the plugin you tested.
- The DeepSeek Harness build you ran it against, and how the plugin was installed.
- Operating system and runtime version.
- **Which providers and models were configured** — the provider ids and model ids
  involved matter, because the label depends on both.
- **What the control showed versus what the menu offered**, since the point of
  the plugin is the difference between them.
- A screenshot of the control with secrets redacted.
- Exact reproduction steps, expected result, and actual result.
- Logs with secrets and personal data removed.

Report security vulnerabilities privately — see [SECURITY.md](SECURITY.md). Never open
a public issue for a vulnerability.

## Coding style

- Match the style of the surrounding code; do not reformat unrelated files.
- Add or update tests for behavior changes.
- Keep public APIs documented.
- Prefer clear names over comments that restate the code.
- Do not add a dependency for something the standard library already does.
- Keep the two halves apart: `src/index.ts` runs on the host (it only carries the
  Loader row), `src/client/*` runs in the browser, and the snapshot shape the
  browser half reads is described structurally in `src/client/format.ts` rather
  than imported from the shipped picker's internals.
- Never import `@deepseek-ai/dsh-client-ui-primitives`, and never let the
  component throw out of the seat: a throw retires the entry for the whole page.
  Degrade to an empty row instead.
- The render and interaction specs run against doubles and never touch a real
  profile or a real model directory. Keep it that way.

## Sign-off

Every commit must carry a `Signed-off-by:` line, added by `git commit -s`. It is
your certification of the [Developer Certificate of Origin 1.1](https://developercertificate.org):
that you wrote the contribution or otherwise have the right to submit it under
this repository's license.

## Review process

Maintainers review pull requests as time allows. Expect at least one round of
feedback. Address comments with follow-up commits or a rebase, then re-request review.
A pull request inactive for 60 days without response may be closed.

## License

By contributing, you agree that your contributions are licensed under the `MIT`
license of this repository — inbound contributions are licensed outbound under
the same terms. Do not paste code you cannot license under these terms.

## Questions

Open an issue, or start a discussion in the repository's *Discussions* tab.

---

# 为 icrefin/dsh-provider-model-picker 贡献

感谢你抽出时间参与贡献。本文适用于 `icrefin` 名下的仓库 **dsh-provider-model-picker**。

## 贡献方式

- 用 *Bug report* 表单报告问题。
- 用 *Feature request* 表单提出需求。
- 改进文档、示例或翻译。
- 提交 pull request，修复或实现 issue 中的事项。

如果改动较大，请先开 issue 讨论设计，以免实现在错误的方向上白费功夫。

## 开始之前

1. 先搜索已有的 issue 和 pull request，避免重复。
2. 阅读[行为准则](CODE_OF_CONDUCT.md)。
3. 查看 README 中说明的支持版本与前置条件。

## 开发环境

本项目是用 pnpm 构建的 TypeScript 包，需要 **Node >= 22.17.0** 与
**pnpm 11.8.0**（`package.json` 的 `packageManager` 字段已固定该版本，
`corepack enable` 会自动采用）。`@deepseek-ai/dsh-*` 这些 peer 依赖已发布到 npm，
因此在干净的检出上可以直接安装。

```bash
git clone https://github.com/icrefin/dsh-provider-model-picker.git
cd dsh-provider-model-picker
git switch main

corepack enable
pnpm install
pnpm check          # 先 tsc 检查两侧，再构建 bundle，最后跑 vitest
```

| 命令 | 作用 |
| --- | --- |
| `pnpm typecheck` | 分别对宿主侧与浏览器侧执行 `tsc` |
| `pnpm test` | `vitest run` —— 六个 `test/*.spec.ts` 文件共 81 个测试 |
| `pnpm check` | `pnpm typecheck && pnpm build && pnpm test` —— 提 PR 前请跑这个 |
| `pnpm build` | 先 `tsc -p tsconfig.build.json`，再 `tsdown`（产物为 `lib/`、`lib/client.js`） |
| `pnpm pack` | 先 `pnpm build`，再 `pnpm pack --pack-destination dist/` |

`lib/` 与 `dist/` 是构建产物，不纳入版本库。`pnpm check` 会先构建再测试，
所以 bundle 那个测试才有东西可加载。

### 各测试文件覆盖什么

| 文件 | 用例数 | 覆盖内容 |
| --- | --- | --- |
| `test/format.spec.ts` | 25 | 标签规则、目录投影、Effort 行、aria 字符串，以及插件边界可能产生的畸形快照形状 |
| `test/rank.spec.ts` | 7 | 模型搜索框背后的模糊排序 |
| `test/render.spec.ts` | 9 | 用 React 静态渲染器加目录替身，检查触发器真正渲染出的内容 |
| `test/interaction.spec.ts` | 20 | jsdom 里的真实组件：打开、进入下一级、选择模型、选择等级、搜索、键盘走位，以及两种失败界面 |
| `test/seat.spec.ts` | 16 | 通过插件真实的 `apply` 驱动注册：影子 priority、会话接线、卸载，以及被拒绝的分支 |
| `test/bundle.spec.ts` | 4 | 在假的 `window.__ModuleLoader__` 之后加载构建好的 `lib/client.js`，这是对 loader banner 唯一的检查 |

### 预览工具

`tools/preview.mjs` 在 GUI 之外渲染构建好的浏览器 bundle 并截图：它通过一个桩
`window.__ModuleLoader__` 加载 `lib/client.js`，用一份最小的假客户端 context 调用插件的
`apply`，再把注册到的控件挂载到一份假目录上——其中两个 provider 提供同名模型——最后分别截下
根面板打开的触发器和模型面板打开的触发器。

```bash
node tools/preview.mjs --out /tmp/pm-preview    # writes index.html + the PNG
node tools/preview.mjs --png docs/images/provider-model-control.png
node tools/preview.mjs --open                   # ...and opens the PNG
```

`lib/client.js` 缺失时它会先构建；它还需要宿主机上有 Google Chrome（或 Chromium/Edge），
以及 `react` 和 `react-dom` 两个 dev 依赖（预览页加载的正是它们的 UMD 构建）。它不会读取任何
DSH profile。

### 开发用 profile

`scripts/dev-profile.sh` 会在 `.dev-home/` 下拉起一个隔离的 harness home，
绝不会碰桌面应用使用的那个 profile：

```bash
scripts/dev-profile.sh boot 19531   # isolated dsh home under .dev-home/, own port
scripts/dev-profile.sh dump         # the composed row
scripts/dev-profile.sh remove       # delete .dev-home/
```

## 分支与提交规范

- 从 `main` 拉分支，一个分支只做一件事（`fix/...`、`feat/...`、`docs/...`）。
- 提交粒度尽量小。
- 提交信息用祈使句并带范围，例如 `fix(label): keep the provider name when the group is gone`。
- 请求评审前先 rebase 到最新的 `main`；PR 分支内避免合并提交。

## Pull request 要求

每个 pull request 必须：

- 说明改了**什么**、**为什么**改。
- 关联对应 issue（`Closes #123`）。
- 通过 CI。
- 当用户可见文案或行为变化时更新文档，包括 `src/client/locales.ts` 里的中英文文案——
  控件渲染的是宿主当前启用的语言。
- 不含任何密钥、令牌、私钥、内网主机名或个人数据。
- 说明新增依赖的许可证，并确认与本项目的 `MIT` 许可证兼容。

请使用仓库的 pull request 模板；不要在没有说明理由的情况下删除检查项。

## 报告 bug

一份有效的 bug 报告应包含：

- 你测试的插件版本号、commit SHA 或发布标签。
- 你运行它所用的 DeepSeek Harness 版本，以及插件的安装方式。
- 操作系统与运行时版本。
- **配置了哪些 provider 和 model** —— 相关的 provider id 与 model id 很重要，因为标签同时取决于两者。
- **控件显示了什么、菜单里提供了什么** —— 本插件的价值就在这两者的差异上。
- 一张已脱敏的控件截图。
- 精确的复现步骤、期望结果与实际结果。
- 去除密钥与个人信息后的日志。

安全漏洞请私下报告，见 [SECURITY.md](SECURITY.md)。切勿为漏洞开公开 issue。

## 代码风格

- 与周边代码风格保持一致；不要顺手重排无关文件。
- 行为变更需要新增或更新测试。
- 公开 API 必须有文档。
- 命名要清晰，避免复述代码的注释。
- 标准库已能实现的功能，不要新增依赖。
- 保持两侧分离：`src/index.ts` 跑在宿主侧（它只负责带上 Loader 行），`src/client/*`
  跑在浏览器侧，浏览器侧读取的快照形状用结构化类型描述在 `src/client/format.ts` 里，
  而不是 import 随包选择器的内部实现。
- 不要 import `@deepseek-ai/dsh-client-ui-primitives`，也不要让组件把异常抛出这个位置：
  一次抛出会让整个页面的条目退役。请退化成空行。
- 渲染与交互测试跑在替身上，绝不接触真实 profile 或真实模型目录。请保持这一点。

## Sign-off

每个提交都必须带 `Signed-off-by:` 行，由 `git commit -s` 添加。它是对
[开发者原创声明 1.1（DCO）](https://developercertificate.org) 的确认：你撰写或拥有该贡献的提交权，
并同意按本仓库的许可证授权。

## 评审流程

维护者会在时间允许时评审 pull request，通常至少有一轮反馈。请通过后续提交响应意见，
或推送 rebase 后重新请求评审。超过 60 天无回应的 pull request 可能被关闭。

## 许可证

参与贡献即表示你同意自己的贡献按本仓库的 `MIT` 许可证授权——进来的贡献以同样的条款出去。
请勿粘贴你无权按此条款授权的代码。

## 疑问

请开 issue，或在仓库的 *Discussions* 标签页发起讨论。
