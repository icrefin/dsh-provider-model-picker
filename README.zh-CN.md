# dsh-provider-model-picker

**Provider + Model** —— 让输入框的模型控件把 provider 写在 model 旁边：`DeepSeek Demo/DeepSeek-V4.1-Flash`，而不是 `DeepSeek-V4.1-Flash`。

[English](README.md) | **简体中文**

[![License](https://img.shields.io/github/license/icrefin/dsh-provider-model-picker?style=flat-square)](LICENSE)
[![Release](https://img.shields.io/github/v/release/icrefin/dsh-provider-model-picker?style=flat-square)](https://github.com/icrefin/dsh-provider-model-picker/releases/tag/v0.3.6)
[![CI](https://img.shields.io/github/actions/workflow/status/icrefin/dsh-provider-model-picker/ci.yml?branch=main&style=flat-square)](https://github.com/icrefin/dsh-provider-model-picker/actions/workflows/ci.yml)
[![Last commit](https://img.shields.io/github/last-commit/icrefin/dsh-provider-model-picker?style=flat-square)](https://github.com/icrefin/dsh-provider-model-picker/commits/main)
[![Stars](https://img.shields.io/github/stars/icrefin/dsh-provider-model-picker?style=flat-square)](https://github.com/icrefin/dsh-provider-model-picker/stargazers)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/icrefin/dsh-provider-model-picker/pulls)
[![Node](https://img.shields.io/badge/node-%3E%3D22.17-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![dsh](https://img.shields.io/badge/dsh-0.2.1--rc.5-4B5563?style=flat-square)](https://github.com/deepseek-ai/deepseek-harness)

## 它消除的歧义

随包发布的控件只打印目录里的模型名，一旦两个 provider 提供同名模型，或者当前会话用的
并不是你以为的那个模型，这个名字就说不清楚了。本插件把控件留在原处，只补上它缺的那一条信息。

```
                                    before                  after
   ┌──────────────────────────────┐  ┌───────────────────┐  ┌──────────────────────────────────┐
   │  Ask anything…               │  │ DeepSeek-V4.1-F… ▾│  │ DeepSeek Demo/DeepSeek-V4.1-F… ▾ │
   │                              │  └───────────────────┘  └──────────────────────────────────┘
   │  📊  DeepSeek-V4.1-Flash  ▾  │  ⤴ the trigger this plugin re-registers
   └──────────────────────────────┘
```

## 它贡献了什么

| 界面 | 作用 |
|---|---|
| `conversation.input.model` | 以比随包控件更低的 priority 重新注册，渲染本插件的触发器（`Provider/Model` 加推理等级）和它的两级菜单 |
| locale 命名空间 `dsh-provider-model-picker` | 控件的英文与简体中文文案 |
| 输入框行的 CSS 变量 | 与随包控件一样遵循宿主的 `--dsh-composer-model-text-display` / `--dsh-composer-model-icon-display` 紧凑开关 |

没有宿主路由、没有服务、没有 Config：宿主这一半（`exports["."]`）存在的唯一目的，就是让
Loader 行能带上浏览器这一半（`exports["./client"]`）。

## 标签规则

| 目录状态 | 触发器显示 |
|---|---|
| 模型已在目录中加载 | `Provider/Model` —— 目录里的 provider 名称；账号 provider 则显示本地化的 **DeepSeek Account** |
| 模型不在目录中（被移除，或它所属的分组加载失败） | `Provider/model-id`，分组名已知时用分组名，否则用原始 provider id |
| 目录尚未加载 | 随包控件的退化形式：先 `Loading models…`，再 `Select model` |

推理等级在标签旁边保留自己的说明文字
（`DeepSeek Demo/DeepSeek-V4.1-Pro · High`），触发器的无障碍名称和 tooltip 用的也是同一个带
provider 的字符串。

**不声明任何推理等级的模型，既不会有说明文字，也不会有 Effort 行** —— 控件只提供 adapter 真正
发布出来的东西，与随包控件完全一致，因为宿主会拒绝 adapter 从未声明过的等级。对
`dsh-llm-pi-ai` 这类路由来说，这个能力就是模型条目上的 `reasoningEfforts`
（省略该字段即保留已安装目录自带的元数据）：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      baidu-team:
        models:
          - id: deepseek-v4.1-flash
            name: BD DeepSeek-V4.1-Flash
            # level name → the wire value dispatch sends; only `off` may be empty
            reasoningEfforts:
              low: low
              medium: medium
              high: high
```

等级名是 `off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。声明它们属于宿主配置的
改动，而不是插件的改动：声明之后，同样的等级会同时出现在 `/model` 和本控件的 Effort 行里。

## 截图

![输入框的模型控件：触发器显示 DeepSeek Demo/DeepSeek-V4.1-Flash，并展开了根面板与模型面板](docs/images/provider-model-control.png)

两个面板都来自 `tools/preview.mjs`，它用一份假目录在 GUI 之外渲染构建好的 bundle。左侧，
触发器写着 provider，根面板可以继续进入 Model 和 Effort；右侧，模型面板列出了每个 provider
分组——而 **DeepSeek Demo 和 Baidu Team 都提供 `DeepSeek-V4.1-Flash`**，光看模型名是分不出来的。

## 影子机制是怎么工作的

`conversation.input.model` 是一个 **`single`** slot —— 每个格子只允许一个占用者，而 slot 注册表
渲染的是**存活条目中 priority 最低的那个**，同时保留 priority 较高的那一条作为兜底。随包控件
（`@deepseek-ai/dsh-client-ui-model-selection`）用默认的 `0` 注册，本插件用 `-1`。

这个选择带来三件事：

- **随包控件仍然装着。** 它没有被移除，所以引用它的其他东西都不会断，`/model` 命令弹层也原封不动。
- **崩溃时是回退，而不是空白。** 注册表会监管各条目；渲染抛异常的组件让出格子，随包触发器重新出现。
- **数据是共用的。** 这里的菜单和 `/model` 读的是同一个按会话的目录实例
  （`ctx.modelDirectories`），所以在一处切换，另一处显示的就会是新的。

如果已经有别的占用者持有 `priority: -1`，注册会被拒绝 —— 插件只记录日志，把随包控件留在原处，
而不是去破坏输入框自己的注册。

因为给这个位置当影子就意味着要接管它，插件也把选择器一并带上了：根面板的 Model/Effort 两格、
按 provider 分组的模型列表、超过四个模型时出现的搜索框、推理等级、选择中的 spinner、键盘导航
（`↑`/`↓` 在行间移动，`Tab` 接受当前行或退出已进入的面板，`Escape` 返回上一级/关闭），以及菜单内
带 Reload 按钮的错误条。

注册由 effect 持有，effect 会把 slot 自己的 disposer 交回来：卸载插件时占用者会被移除，而不是在
注册表里留下一条死条目——那时随包控件会重新渲染。

### 为什么声明两个从不读取的服务

`inject` 里列了 `remote` 和 `remote.session`，而本插件从不直接碰它们。它们是为**被调用方**准备的，
不是为调用方。

`ctx.modelDirectories` 是一个 cordis **service proxy**：调用期间它把 `this` 重新绑定到**调用方的**
context。`directoryFor()` 会用 `this.ctx.remote.session` 构造某个会话的目录——但只在**缓存未命中**
时，也就是某个会话被任何界面第一次调用时。于是这次调用成功还是失败，取决于**谁先问**：

| 该会话谁先调用 | 结果 |
|---|---|
| 随包控件或 `/model` 弹层（它们声明了 `remote.session`） | 目录被构建并缓存；之后任何地方再调用都是缓存命中 |
| 本插件，在 `priority: -1`，早于随包条目渲染 | `cannot get property "remote.session" without inject` |

这解释了那个缺陷为什么看上去时有时无、且与具体会话相关：哪个会话的目录碰巧是热的，哪个就正常；
而**切换会话**——新会话，这个条目先上——每次都会失败。随包的那个包出于同样的原因也声明了这两个服务。

`test/support.ts` 在它的目录替身里强制执行这条规则，所以去掉任何一个声明都会让测试失败，而不是让 GUI 失败。

## 环境要求

- **Node.js >= 22.17** 与 **pnpm 11.20.0** —— 通过 `packageManager` 固定的版本，`corepack enable` 会自动采用。
- **DeepSeek Harness `>=0.2.1-rc.5 <0.2.2-0`**，本插件的 peer 依赖和 `SlotMap` 类型都是针对这个区间（验证于 0.2.1-rc.5）编写的。
  slot id 或选项写错，typecheck 就会失败。
- **随包模型选择器保持启用**，因为这个控件读的正是它发布的按会话目录服务。
- **`lib/` 不入库。** 发布的源码树只有 TypeScript，因此安装 bundle 之前请先构建。

## 安装

```sh
git clone https://github.com/icrefin/dsh-provider-model-picker.git
cd dsh-provider-model-picker
pnpm install
pnpm build                       # tsc -> lib/, tsdown -> lib/client.js
sh scripts/install.sh            # packs dist/dsh-provider-model-picker-0.3.5.tgz, prints the install steps
```

`pnpm check` 跑的就是 CI 那一整套——先对宿主这一半和浏览器这一半执行 `tsc`，再构建 bundle，
最后跑 6 个文件里的 81 个 vitest 用例：

```sh
pnpm check                       # typecheck both halves, build, 81 tests
```

在 **Settings → Plugins** 里安装这个 tarball，或者用 CLI 管理的 profile：

```sh
sh scripts/install.sh --profile <profile>
```

给正在运行的 profile 添加 bundle 需要**重启**：harness 在启动时就算好了模块解析，运行期间装进去的条目
在下次启动前会一直报 "failed to import"。

profile 固定本地安装的方式，带来三条规则：

- **profile 存的是 tarball 路径**，不是包本身：它的 `package.json` 里会写入
  `"dsh-provider-model-picker": "file:…/dist/dsh-provider-model-picker-<version>.tgz"`。
  删除或替换这个文件，会让**下一次**安装在更新任何东西之前就以 `ENOENT` 失败。请保留这个 tarball，
  或者先移除 bundle，再安装新版本。
- **每次改动都要升版本号。** 重装同一个版本是静默无操作。
- **装进正在运行的 profile 的客户端这一半，不一定能到达已打开的页面。** 宿主行会立刻生效，但页面只加载
  它启动图里交给它的那些 bundle。如果安装后输入框还显示旧控件，先刷新窗口，还不行就重启应用。

## 使用与配置

无需配置：本插件没有 Loader 配置、没有设置区块，也不保存任何状态。装上之后，输入框的模型控件就是带
provider 的那个；`/model` 照常工作，并且读同一个按会话目录，所以在任一处切换，另一处显示的就是新的。

| 操作 | 结果 |
|---|---|
| 点击触发器 | 根面板：**Model**（当前的 `Provider/Model`）与 **Effort**（当前等级，仅限声明了等级的模型） |
| Model → 某个 provider 分组 | 该 provider 的模型，按目录顺序，账号 provider 在最前 |
| 在搜索框里输入 | 超过四个模型时出现；按名称做大小写无关的有序子序列匹配，前缀命中优先 |
| Effort → 某个等级 | 用同一个 provider 和 model 重新提交新的等级 |
| `↑` / `↓` | 在行间移动，两端循环 |
| `Tab` | 接受当前获得焦点的行；`Shift+Tab` 退出已进入的面板 |
| `Escape` | 先退回根面板，再关闭并把焦点还给触发器 |
| 已提交的选择 | 待定行上出现 spinner，直到宿主给出结果；被拒绝时菜单保持打开，显示原因和 Reload 按钮 |

## 失败处理

注册表会让渲染抛异常的条目退役，并把格子重新渲染到下一个幸存者上——对这个位置来说就是随包控件。
这个回退是对的，但它是静默的：原因只会进页面 console，而打不开开发者工具的用户看不到。所以这个位置
会自己上报，两条失败路径也刻意做得不一样：

- **接线失败**——注入入口无法解析该会话的模型目录，或某个服务的应答出乎意料——会打印
  `picker error: <reason> — click to use the default picker`，并且**一直留在那里**。注入工厂是本插件在
  自己组件树之外唯一的调用点，那里抛异常会让这个位置在没有任何屏上解释的情况下退役；因此该工厂的每一步
  都被保护起来，结果变成一条消息。点击这条消息会抛异常，正是这一步把格子交还给随包控件。
- **选择器内部渲染崩溃**由本插件自己的边界捕获，并同样显示出来。两条消息都不会自动消失：几秒后就消失的原因
  没人能据此行动，而静默回退与"插件什么也没做"无法区分。点击会把格子交给随包控件，这是条目从这里退役的唯一方式。
- 注册时打印 `console.info('[dsh-provider-model-picker] shadowed …')`，失败时打印
  `console.error('[dsh-provider-model-picker] …')`，都带插件名，因此在开发者工具里能回答"我看的到底是哪个选择器"。

目录 store 的读取同样走保护（`getSnapshot`/`subscribe`）：切换会话可能在活组件底下拆掉会话作用域，而那次读取
里的异常发生在渲染器内部——会让**每个**会话的这个位置退役，而不只是消失的那个。

目录快照里读出的每个值在使用前也都会做规范化（`asArray`、id 兜底、name 兜底）：快照跨了插件边界，
本版本没有预料到的形状必须退化成空行，而不是在渲染器里抛异常、赔上整个位置。这次规范化修掉了第一个实机缺陷
——0.2.0 注册成功、渲染了一次，随后在一个它没预料到的目录形状上抛异常并退役。

## 限制

- **要求随包选择器处于启用状态。** 目录服务（`ctx.modelDirectories`）属于
  `@deepseek-ai/dsh-client-ui-model-selection`；这个 bundle 被禁用就没有目录可读，本控件也就无从选择。
  该依赖声明在 `dsh.client.inject` 里。
- **菜单是本插件自己的。** 它把随包控件的标记和 CSS 复制到自己的 `dpmp-` 前缀下，而不是 import
  `@deepseek-ai/dsh-client-ui-primitives`，这样某个 primitive 改版不会让这个位置变空白——代价是要手工跟平台的菜单样式。
- **有一个 priority 被预留。** `-1` 是这个位置的影子 priority；另一个插件占了它时，谁赢谁让取决于加载顺序，输的那个会记日志。

## 常见问题

**安装之后，输入框还显示光秃秃的模型名。**
浏览器这一半还没到达已打开的页面。先刷新窗口，还不行就重启应用。如果依然不出现，可能已经有别的占用者持有
`priority: -1`——插件会打印 `[dsh-provider-model-picker] the model seat could not be shadowed`，
并把随包控件留在原处。

**控件显示 `picker error: …`。**
那是接线失败的界面。它在你点击之前不会消失，点击即把格子交还给随包控件。页面 console 里带有完整原因，
前缀是 `[dsh-provider-model-picker]`。

**触发器显示 `Provider/model-id`，而不是模型的显示名。**
保存的选择已经不在已加载的目录里了：它所属的 provider 分组加载失败，或者该模型已被移除。菜单的警告条
会写出加载失败的 provider 名；整个目录加载失败时则会出现带 Reload 按钮的错误条。

**没有 Effort 行。**
那个模型没有声明任何推理等级，所以没有可选项。在宿主配置里给该模型声明 `reasoningEfforts`（见上文），
这一行就会出现——在这里和 `/model` 里都会。

**我看的到底是哪个选择器？**
本插件的条目注册时会打印 `console.info('[dsh-provider-model-picker] shadowed "conversation.input.model" at
priority -1')`，每次失败时 `console.error` 也会带上插件名。如果只在看到随包的消息，说明本插件没有注册成功。

## 许可证

MIT —— 见 [LICENSE](./LICENSE)。

> 如果这个控件让你不用再猜某个会话到底在哪个 provider 上，一颗 ⭐ star 能帮更多 DSH 用户发现它。

<sub>面向 DeepSeek Harness 0.2.1-rc.5 的独立插件 · MIT 许可。</sub>
