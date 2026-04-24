// src/plugins/discord/index.ts — Discord transport plugin entry point
// Registers Discord as a transport via the Isotopes plugin system.

import type { IsotopesPlugin, TransportFactoryContext } from "../types.js";
import type { DiscordAccountConfig } from "../../core/types.js";
import { DiscordTransportManager } from "./manager.js";
import { ThreadBindingManager } from "../../core/thread-bindings.js";
import { getThreadBindingsPath } from "../../core/paths.js";
import type { SessionStore } from "../../core/types.js";

const discordPlugin: IsotopesPlugin = {
  async register(api) {
    const pluginConfig = api.getConfig();
    api.registerTransport("discord", async (ctx: TransportFactoryContext) => {
      const config = ctx.config;
      const discordConfig = pluginConfig?.accounts
        ? { accounts: pluginConfig.accounts as Record<string, DiscordAccountConfig> }
        : config.channels?.discord;

      if (!discordConfig) {
        api.log.warn("Discord plugin loaded but no Discord config found — skipping");
        return createNoopTransport();
      }

      const accounts = discordConfig.accounts ?? {};
      if (Object.keys(accounts).length === 0) {
        api.log.warn("channels.discord present but no accounts configured — skipping");
        return createNoopTransport();
      }

      const agentIds = ctx.agentManager.list().map((c) => c.id);
      const sessionStores = new Map<string, SessionStore>();
      for (const agentId of agentIds) {
        sessionStores.set(agentId, await ctx.sessionStoreManager.getOrCreate(agentId));
      }
      ctx.registerSessionSource("discord", sessionStores);

      const firstAccount = Object.values(accounts)[0];
      const defaultAgentId = firstAccount?.defaultAgentId || agentIds[0];
      const defaultSessionStore =
        sessionStores.get(defaultAgentId) ?? await ctx.sessionStoreManager.getOrCreate(defaultAgentId);

      const threadBindingManager = new ThreadBindingManager({ persistPath: getThreadBindingsPath() });
      await threadBindingManager.load({ clearStale: true });
      if (threadBindingManager.size > 0) {
        api.log.info(`Loaded ${threadBindingManager.size} persisted thread binding(s)`);
      }

      const discordManager = new DiscordTransportManager({
        accounts,
        shared: {
          agentManager: ctx.agentManager,
          sessionStore: defaultSessionStore,
          sessionStoreForAgent: (agentId: string) =>
            ctx.sessionStoreManager.peek(agentId) ?? sessionStores.get(agentId) ?? defaultSessionStore,
          channels: config.channels,
          threadBindingManager,
          usageTracker: ctx.usageTracker,
        },
      });

      const anyThreadBindings = Object.values(accounts).some((a) => a.threadBindings?.enabled);
      if (anyThreadBindings) {
        api.log.info("Discord thread bindings enabled");
      }

      return {
        start: async () => {
          await discordManager.start();
          api.log.info(`Discord transport started (${discordManager.size} account(s))`);
        },
        stop: async () => {
          await discordManager.stop();
        },
        _manager: discordManager,
      } as DiscordPluginTransport;
    });
  },
};

export default discordPlugin;

interface DiscordPluginTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  _manager: DiscordTransportManager;
}

function createNoopTransport() {
  return {
    start: async () => {},
    stop: async () => {},
  };
}
