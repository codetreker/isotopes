# ISO-001: Discord Transport 解耦为内置 Plugin — PRD

日期：2026-04-24 | 状态：Draft

## 背景

Isotopes 当前的 Discord transport（1128 行）与核心代码存在多处硬耦合：核心运行时直接 import Discord 模块、核心类型系统包含 Discord 专有定义、subagent 流式输出通过 Discord 专属上下文注入。这使得：

1. **新增 transport 门槛高**——必须在核心代码里添加硬编码支持，社区无法独立开发 transport plugin
2. **核心代码膨胀**——Discord 专有逻辑（config schema、类型定义、API 路由）散落在核心模块中
3. **维护耦合**——修改 Discord 逻辑需要触碰核心代码，增加回归风险

Isotopes 已有 plugin 系统，支持 `registerTransport`。将 Discord 从硬耦合改为内置 plugin，是 plugin 系统从"能用"到"好用"的关键一步。

## 目标用户

1. **Isotopes 维护者**——需要更清晰的代码边界，降低维护成本和回归风险
2. **社区开发者**——希望为 Isotopes 添加新 transport（Slack、Telegram 等），需要一个经过验证的 transport plugin 范例
3. **现有 Isotopes 用户**——需要无感升级，现有配置和功能不受影响

## 核心需求

### 需求 1: 通用化 Subagent 事件推送

- **用户故事**：作为 transport 开发者，我希望有一套通用的 subagent 事件推送接口，以便我的 transport 能接收 subagent 运行过程中的流式事件（启动、进度、完成），而不必了解 Discord 的实现细节。
- **验收标准**：
  - [ ] 存在通用的 SubagentEventSink 接口，包含 start / sendEvent / finish / getOutputChannelId 方法
  - [ ] 存在通用的 TransportContext 接口，替代当前 Discord 专属的 SubagentDiscordContext
  - [ ] 核心代码（tools.ts、subagent-context.ts）不再 import 任何 Discord 模块
  - [ ] Discord 的 subagent 流式输出功能（创建 thread → 推送事件 → 发总结）行为与解耦前完全一致
  - [ ] `/stop` 命令在 subagent thread 中仍然正常工作（outputChannelId → task → cancel 链路完整）

### 需求 2: Plugin API 支持 Transport 完整能力

- **用户故事**：作为 transport plugin 开发者，我希望通过 plugin API 注册 transport 所需的全部能力（消息推送、subagent sink、react/reply handler），而不需要修改核心代码。
- **验收标准**：
  - [ ] Plugin API 支持注册 subagent event sink 工厂
  - [ ] Plugin API 支持注册 react/reply handler
  - [ ] Transport plugin 可以通过现有 TransportFactoryContext 获取 SessionStoreManager
  - [ ] API server 的 session 相关路由不再硬编码 Discord session stores，改为通过通用机制获取

### 需求 3: Discord Transport 作为内置 Plugin 运行

- **用户故事**：作为 Isotopes 用户，我希望升级后 Discord 功能一切照旧——不需要改配置文件、不丢失聊天会话、不缺失任何功能。
- **验收标准**：
  - [ ] Discord transport 代码从核心模块迁移到 plugin 目录，核心运行时（runtime.ts）不再 import Discord 模块
  - [ ] 现有 `channels.discord` 配置路径继续有效（向后兼容）
  - [ ] 以下功能全部保留且行为不变：
    - DM / Group 消息收发与权限控制
    - Thread bindings（持久化数据不丢失）
    - Subagent 流式输出到 thread
    - `/stop` 取消 subagent
    - Slash commands
    - Message debounce / dedupe
    - Channel history buffer
    - React / Reply tool
  - [ ] 核心类型文件（types.ts）不再包含 Discord 专有类型定义
  - [ ] 核心配置文件（config.ts）不再包含 Discord 专有函数（如 getDiscordToken）
  - [ ] API routes 不再硬编码 `discordSessionStores` 或 `source: "discord"`

### 需求 4: 为社区提供 Transport Plugin 范例

- **用户故事**：作为社区开发者，我希望参考 Discord plugin 的结构和接口来开发自己的 transport plugin，能清楚地知道需要实现哪些接口、如何注册、如何处理 subagent 事件。
- **验收标准**：
  - [ ] Discord plugin 目录结构清晰（独立的 entry、transport、sink、types 等模块）
  - [ ] SubagentEventSink 接口文档明确 event delivery 是 best-effort（不保证送达）
  - [ ] 多个 transport 同时注册 sink 时，运行时按请求来源自动选择对应 transport 的 sink（通过 AsyncLocalStorage 上下文隔离）

## 不在范围

以下内容 **不在本次（v1）交付范围**，将在后续阶段按需推进：

1. **Config 完全迁移**（Phase 3）——将 `channels.discord` 配置路径废弃、全部改为 `plugins.discord.config`。v1 保持双轨兼容即可
2. **Feishu transport plugin 化**——虽然调研建议一起做，但 Feishu 作为独立任务跟踪，不阻塞 Discord 解耦
3. **外部 transport plugin 加载机制**——社区 plugin 的 npm 分发、动态加载等，待 Discord 内置 plugin 验证后再设计
4. **Plugin 间通信机制**——跨 plugin 引用（如其他 plugin 访问 Discord session stores）的通用方案
5. **SubagentEventSink 的重试/缓冲机制**——v1 保持 best-effort，不做消息重试
6. **Config schema 运行时验证**——Plugin 配置可放在 `plugins.<id>.config` 下，但不做 Zod schema 验证

## 成功指标

| 指标 | 目标 |
|------|------|
| 核心代码 Discord 引用数 | 0（runtime.ts、tools.ts、types.ts、config.ts、subagent-context.ts、mention.ts、api/routes.ts 中不再有 Discord import 或硬编码） |
| 现有功能回归 | 0 个功能退化（所有 Discord 功能行为与解耦前一致） |
| 向后兼容 | 现有 `isotopes.yaml` 无需任何修改即可升级 |
| 代码行数 | 核心模块净减少 Discord 相关代码（预计减少 300+ 行） |
| Plugin 范例完整度 | Discord plugin 可作为社区开发新 transport 的参考模板 |

## 交付计划（PR 拆分）

按渐进式交付，每个里程碑独立可合并、可测试。

### 里程碑 1: 通用事件推送基础（PR 1 + PR 2）

**目标**：核心代码不再依赖 Discord 的 subagent 推送实现。

- **PR 1 — 通用 TransportContext**：将 Discord 专属的 subagent 上下文泛化为通用 TransportContext，核心代码改为依赖通用接口。
- **PR 2 — SubagentEventSink 接口**：定义通用 sink 接口，Discord 的流式推送改为该接口的实现；subagent 执行路径统一为通用路径。包含 `/stop` cancel 链路的泛化。

> **产品价值**：即使不做后续 plugin 化，这两个 PR 已经解除了核心代码对 Discord 的直接依赖，也让 Feishu 等其他 transport 可以复用 subagent 流式输出能力。

### 里程碑 2: Plugin API 增强（PR 3）

**目标**：Plugin 系统能承载 transport 的全部能力需求。

- **PR 3 — Plugin API 扩展**：新增 sink 注册、react handler 注册等能力，使 transport plugin 无需修改核心代码即可完整运作。

### 里程碑 3: Discord Plugin 抽取（PR 4）

**目标**：Discord transport 从核心代码彻底独立。

- **PR 4 — Discord 迁移为内置 Plugin**：将 Discord transport 代码迁移到 plugin 目录，核心运行时去除 Discord 硬编码，API routes 解耦。现有配置向后兼容。

> **产品价值**：这是解耦的收口 PR。合并后，核心代码中 Discord 引用数归零，Discord plugin 结构可作为社区范例。

### 可选后续

- **PR 5 — Feishu Plugin 抽取**：验证通用方案对第二个 transport 的适用性（独立任务跟踪）
- **PR 6 — Config 路径迁移**：新增 `plugins.discord.config` 路径，保持对旧路径的 fallback（低优先级）

## 开放问题

1. **Thread bindings 持久化路径**——迁移到 plugin 后，持久化文件路径需与升级前一致，否则用户升级时丢失已有 thread bindings。需要在设计文档中明确迁移策略。
2. **API routes 的 session store 发现机制**——当前 API server 硬编码 Discord session stores，解耦后需要一种通用方式让 API routes 发现各 transport 的 session stores。具体方案待设计文档定义。
3. **`showToolCalls` 配置传递**——当前通过 Discord 专属上下文传递，泛化后需要在 TransportContext 或 sink 工厂中保留该配置通道。
