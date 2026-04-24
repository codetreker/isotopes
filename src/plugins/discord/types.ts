// src/plugins/discord/types.ts — Discord-specific configuration types
// Extracted from src/core/types.ts as part of the Discord plugin decoupling (ISO-001.4).

import type { ReplyToMode } from "../../transports/reply-directive.js";

/** Per-account Discord context configuration */
export interface DiscordAccountContextConfig {
  historyTurns?: number;
  channelHistory?: boolean;
  channelHistoryLimit?: number;
  dedupe?: boolean;
  debounce?: boolean;
  debounceWindowMs?: number;
  pruning?: {
    protectRecent?: number;
    headChars?: number;
    tailChars?: number;
  };
}

/** Per-account Discord subagent streaming configuration */
export interface DiscordAccountSubagentStreamingConfig {
  enabled?: boolean;
  showToolCalls?: boolean;
}

/** Discord account configuration within the channels section */
export interface DiscordAccountConfig {
  /** Bot token (literal). Prefer `tokenEnv` for secrets. */
  token?: string;
  /** Env var name to read the bot token from. */
  tokenEnv?: string;
  /** Default agent ID for messages on this account. */
  defaultAgentId?: string;
  /** Channel/guild ID -> agent ID overrides. */
  agentBindings?: Record<string, string>;
  /** DM access control. */
  dmAccess?: {
    /** "disabled" (default) = ignore all DMs, "allowlist" = only from listed user IDs. */
    policy?: "disabled" | "allowlist";
    /** Discord user IDs allowed to DM when policy is "allowlist". */
    allowlist?: string[];
  };
  /** Group (guild) access control — parallel to `dmAccess`. */
  groupAccess?: {
    /** "allowlist" (default) = only listed channels/guilds, "disabled" = ignore all guild messages, "open" = accept all guild channels. */
    policy?: "disabled" | "allowlist" | "open";
    /** Channel IDs allowed when policy is "allowlist". */
    channelAllowlist?: string[];
    /** Guild (server) IDs allowed when policy is "allowlist". */
    guildAllowlist?: string[];
  };
  /** Per-guild configuration keyed by guild ID */
  guilds?: Record<string, import("../../core/types.js").GuildConfig>;
  /** Thread binding configuration for auto-binding threads to agent sessions */
  threadBindings?: import("../../core/types.js").ThreadBindingConfig;
  /** Subagent streaming behavior for this account. */
  subagentStreaming?: DiscordAccountSubagentStreamingConfig;
  /** Whether to respond to messages from other bots. Default: false */
  allowBots?: boolean;
  /** Context management configuration for this account. */
  context?: DiscordAccountContextConfig;
  /** Discord user IDs allowed to execute slash commands on this account. */
  adminUsers?: string[];
  replyToMode?: ReplyToMode;
}
