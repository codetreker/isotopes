// src/plugins/feishu/index.ts — Feishu transport plugin entry point
// Registers Feishu as a transport via the Isotopes plugin system.

import type { IsotopesPlugin, TransportFactoryContext } from "../types.js";
import type { Binding, SessionStore } from "../../core/types.js";
import { FeishuTransport } from "./transport.js";
import type { FeishuAccountConfig } from "./types.js";

const feishuPlugin: IsotopesPlugin = {
  async register(api) {
    const pluginConfig = api.getConfig();
    api.registerTransport("feishu", async (ctx: TransportFactoryContext) => {
      const config = ctx.config;
      const feishuConfig = pluginConfig?.accounts
        ? { accounts: pluginConfig.accounts as Record<string, FeishuAccountConfig> }
        : config.channels?.feishu;

      if (!feishuConfig) {
        api.log.warn("Feishu plugin loaded but no Feishu config found — skipping");
        return createNoopTransport();
      }

      const accounts = (feishuConfig.accounts ?? {}) as Record<string, FeishuAccountConfig>;
      if (Object.keys(accounts).length === 0) {
        api.log.warn("channels.feishu present but no accounts configured — skipping");
        return createNoopTransport();
      }

      const agentIds = ctx.agentManager.list().map((c) => c.id);
      const sessionStores = new Map<string, SessionStore>();
      for (const agentId of agentIds) {
        sessionStores.set(agentId, await ctx.sessionStoreManager.getOrCreate(agentId));
      }
      ctx.registerSessionSource("feishu", sessionStores);

      const firstAccount = Object.values(accounts)[0];
      const defaultAgentId = firstAccount?.defaultAgentId || agentIds[0];
      const defaultSessionStore =
        sessionStores.get(defaultAgentId) ?? await ctx.sessionStoreManager.getOrCreate(defaultAgentId);

      const firstAccountId = Object.keys(accounts)[0];
      const transport = new FeishuTransport({
        appId: firstAccount.appId,
        appSecret: firstAccount.appSecret,
        agentManager: ctx.agentManager,
        sessionStore: defaultSessionStore,
        defaultAgentId,
        botOpenId: firstAccount.botOpenId,
        channels: config.channels,
        accountId: firstAccountId,
        bindings: config.bindings as unknown as Binding[],
        usageTracker: ctx.usageTracker,
      });

      return {
        start: async () => {
          await transport.start();
          api.log.info(`Feishu transport started (${Object.keys(accounts).length} account(s))`);
        },
        stop: async () => {
          await transport.stop();
        },
      };
    });
  },
};

export default feishuPlugin;

function createNoopTransport() {
  return {
    start: async () => {},
    stop: async () => {},
  };
}
