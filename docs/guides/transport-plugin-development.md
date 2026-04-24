# Transport Plugin Development Guide

How to add a new chat-platform transport (like Discord or Feishu) to Isotopes using the plugin system.

## Directory Structure

Place your plugin under `src/plugins/<transport-name>/`:

```
src/plugins/myplatform/
  isotopes.plugin.json   # Plugin manifest (required)
  index.ts               # Entry point — exports an IsotopesPlugin
  transport.ts           # Transport logic (connection, message handling)
  manager.ts             # Multi-account manager (if supporting multiple accounts)
  sink.ts                # SubagentEventSink implementation (for streaming sub-agent output)
  types.ts               # Platform-specific config types
  transport.test.ts      # Tests (co-located)
  manager.test.ts
  sink.test.ts
```

See `src/plugins/discord/` as a reference implementation.

## Plugin Manifest

Every plugin needs an `isotopes.plugin.json` in its directory:

```json
{
  "id": "myplatform",
  "name": "MyPlatform Transport",
  "version": "1.0.0",
  "description": "MyPlatform transport plugin for Isotopes",
  "entry": "index.js"
}
```

- `id` — unique identifier, used as the key in `plugins:` config and as the transport name.
- `entry` — path to the compiled entry point (relative to the plugin directory). Note: `.js`, not `.ts`.

The plugin manager discovers plugins by scanning directories for `isotopes.plugin.json` files.

## Entry Point

The entry point must default-export an `IsotopesPlugin` object with a `register` method:

```ts
import type { IsotopesPlugin, TransportFactoryContext } from "../types.js";

const myPlugin: IsotopesPlugin = {
  async register(api) {
    api.registerTransport("myplatform", async (ctx: TransportFactoryContext) => {
      // Build and return a Transport (see below)
    });
  },
};

export default myPlugin;
```

## Plugin API (`IsotopesPluginApi`)

The `api` object passed to `register()` provides:

| Method | Purpose |
|---|---|
| `api.registerTransport(id, factory)` | Register a transport factory under a string key |
| `api.registerTool(toolOrFactory)` | Register custom tools |
| `api.registerUI(config)` | Register a UI panel |
| `api.on(hookName, handler)` | Subscribe to lifecycle hooks (returns unsubscribe fn) |
| `api.getConfig()` | Get plugin-specific config from `isotopes.yaml` → `plugins.<id>.config` |
| `api.log` | Scoped logger (`api.log.info(...)`, `.warn(...)`, `.error(...)`, `.debug(...)`) |

## `TransportFactoryContext`

The transport factory receives a `TransportFactoryContext` with everything needed to wire up:

| Field | Type | Purpose |
|---|---|---|
| `agentManager` | `DefaultAgentManager` | List agents, get agent configs |
| `sessionStoreManager` | `SessionStoreManager` | Get or create per-agent session stores |
| `config` | `IsotopesConfigFile` | Full parsed config (access `config.channels` etc.) |
| `usageTracker` | `UsageTracker` | Track API usage/costs |
| `hooks` | `HookRegistry` | Fire lifecycle hooks |
| `registerSink` | `(factory: SubagentSinkFactory) => void` | Register a sink factory for sub-agent event streaming |
| `registerSessionSource` | `(id, stores) => void` | Register session stores so other systems can access them |

### Config Resolution Pattern

Transport plugins should support two config locations with fallback:

```ts
// 1. Plugin-specific config (plugins.myplatform.config.accounts in isotopes.yaml)
const pluginConfig = api.getConfig();
const platformConfig = pluginConfig?.accounts
  ? { accounts: pluginConfig.accounts as Record<string, MyAccountConfig> }
  : config.channels?.myplatform;  // 2. Legacy location (channels.myplatform)
```

This lets users configure via either `plugins.myplatform.config` (new) or `channels.myplatform` (legacy).

## Transport Return Value

The factory must return an object satisfying the `Transport` interface:

```ts
interface Transport {
  start?(): Promise<void>;
  stop?(): Promise<void>;
  reply?(channelId: string, content: string): Promise<void>;
  react?(channelId: string, messageId: string, emoji: string): Promise<void>;
}
```

At minimum, implement `start()` and `stop()`. Return a no-op transport when config is missing:

```ts
if (!platformConfig) {
  api.log.warn("MyPlatform plugin loaded but no config found — skipping");
  return { start: async () => {}, stop: async () => {} };
}
```

## Session Store Setup

Create a session store per agent and register them as a session source:

```ts
const agentIds = ctx.agentManager.list().map((c) => c.id);
const sessionStores = new Map<string, SessionStore>();
for (const agentId of agentIds) {
  sessionStores.set(agentId, await ctx.sessionStoreManager.getOrCreate(agentId));
}
ctx.registerSessionSource("myplatform", sessionStores);
```

## Implementing `SubagentEventSink`

If your platform supports streaming sub-agent output (e.g., posting progress to a channel), implement `SubagentEventSink` from `src/core/transport-context.ts`:

```ts
interface SubagentEventSink {
  start(taskName: string): Promise<void>;
  sendEvent(event: SubagentEvent): Promise<void>;
  finish(result: SubagentResult): Promise<void>;
  getOutputChannelId?(): string | undefined;
  onCancel?(): void;
}
```

| Method | When Called | What To Do |
|---|---|---|
| `start(taskName)` | Sub-agent begins | Send an initial message; optionally create a thread |
| `sendEvent(event)` | Each sub-agent event (message, tool_use, tool_result, error) | Format and post to channel/thread |
| `finish(result)` | Sub-agent completes | Post summary (success/failure, stats, cost) |
| `getOutputChannelId()` | After start | Return thread/channel ID where events were posted |
| `onCancel()` | Sub-agent cancelled | Clean up resources |

Register the sink factory so the subagent system can create sinks on demand:

```ts
ctx.registerSink((channelId, sessionId) => {
  return new MyPlatformSink(sendMessageFn, channelId, sinkConfig);
});
```

See `src/plugins/discord/sink.ts` (`DiscordSink`) for a complete implementation that handles thread creation, message formatting, and Discord message length limits.

## Testing

- Co-locate tests with source files (`.test.ts` suffix).
- Use Vitest with `globals: true`.
- Mock external SDKs (Discord.js client, HTTP APIs) — don't hit real services in unit tests.
- Test helpers are in `src/core/test-helpers.ts` (`createMockAgentInstance()`, `createMockAgentManager()`, `createMockSessionStore()`).
- Cover at minimum:
  - Transport start/stop lifecycle
  - Message routing to correct agents
  - Sink event formatting and delivery
  - Graceful handling of missing/empty config
- Integration tests (requiring real tokens) go in `tests/integration/` and are excluded from `pnpm test`.

## Enabling in Configuration

Users enable your plugin in `isotopes.yaml`:

```yaml
plugins:
  myplatform:
    enabled: true
    config:
      accounts:
        main:
          token: ${MYPLATFORM_TOKEN}
          defaultAgentId: main

# Or legacy location (still supported via fallback):
channels:
  myplatform:
    accounts:
      main:
        token: ${MYPLATFORM_TOKEN}
        defaultAgentId: main
```
