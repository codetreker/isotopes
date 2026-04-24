// src/plugins/feishu/types.ts — Feishu-specific types

import type {
  Binding,
  ChannelsConfig,
  SessionStore,
} from "../../core/types.js";
import type { DefaultAgentManager } from "../../core/agent-manager.js";
import type { ContextConfigFile } from "../../core/config.js";
import type { UsageTracker } from "../../core/usage-tracker.js";

/** Configuration for the Feishu (Lark) transport. */
export interface FeishuTransportConfig {
  /** Feishu app ID from Developer Console */
  appId: string;
  /** Feishu app secret from Developer Console */
  appSecret: string;
  agentManager: DefaultAgentManager;
  sessionStore: SessionStore;
  /** Default agent ID to use for incoming messages */
  defaultAgentId?: string;
  /** Bot's open_id — required for detecting @mentions in group chats */
  botOpenId?: string;
  /** Channels config for per-group settings (e.g. requireMention) */
  channels?: ChannelsConfig;
  /** The account ID this bot is running as (for group config lookup) */
  accountId?: string;
  /** Agent ↔ channel bindings for routing messages to agents */
  bindings?: Binding[];
  /** Legacy per-bot agent bindings: { [botOpenId]: agentId } */
  agentBindings?: Record<string, string>;
  /** Context management configuration */
  context?: ContextConfigFile;
  /** Usage tracker for per-session/global token accumulation */
  usageTracker?: UsageTracker;
}

/** Shape of the `im.message.receive_v1` event data from the Feishu SDK. */
export interface FeishuMessageEvent {
  sender: {
    sender_id?: {
      union_id?: string;
      user_id?: string;
      open_id?: string;
    };
    sender_type: string;
    tenant_key?: string;
  };
  message: {
    message_id: string;
    root_id?: string;
    parent_id?: string;
    create_time: string;
    chat_id: string;
    chat_type: string;
    message_type: string;
    content: string;
    mentions?: Array<{
      key: string;
      id: {
        union_id?: string;
        user_id?: string;
        open_id?: string;
      };
      name: string;
    }>;
  };
}

/** Per-account Feishu configuration within the channels/plugin config section. */
export interface FeishuAccountConfig {
  appId: string;
  appSecret: string;
  defaultAgentId?: string;
  botOpenId?: string;
}
