// src/transports/feishu.ts — Re-exports from the Feishu plugin for backward compatibility

export {
  FeishuTransport,
  extractTextFromFeishuMessage,
  stripFeishuMentions,
  isBotMentioned,
  shouldRespondToGroupMessage,
  buildFeishuSessionKey,
  resolveAgentId,
} from "../plugins/feishu/transport.js";

export type {
  FeishuTransportConfig,
  FeishuMessageEvent,
  FeishuAccountConfig,
} from "../plugins/feishu/types.js";
