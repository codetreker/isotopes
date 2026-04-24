// src/core/transport-context.ts — AsyncLocalStorage context for transport integration
// Provides a way to pass transport channel/thread context through async chains.

import { AsyncLocalStorage } from "node:async_hooks";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Placeholder for SubagentEventSink (defined in Step 2) */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SubagentEventSink {}

/** Function to send a message to a channel */
export type SendMessageFn = (channelId: string, content: string) => Promise<{ id: string }>;

/** Function to create a thread from a message */
export type CreateThreadFn = (channelId: string, name: string, messageId: string) => Promise<{ id: string }>;

/**
 * Transport context passed through AsyncLocalStorage.
 * When present, subagent will stream output to the transport.
 */
export interface TransportContext {
  sendMessage: SendMessageFn;
  createThread?: CreateThreadFn;
  channelId: string;
  sessionId?: string;
  createSink?: () => SubagentEventSink;
  showToolCalls?: boolean;
  onComplete?: (outputChannelId: string) => void | Promise<void>;
}

// Backward-compat alias
export type SubagentDiscordContext = TransportContext;

// ---------------------------------------------------------------------------
// AsyncLocalStorage
// ---------------------------------------------------------------------------

const transportContextStorage = new AsyncLocalStorage<TransportContext>();

export function runWithTransportContext<T>(
  context: TransportContext,
  fn: () => T,
): T {
  return transportContextStorage.run(context, fn);
}

export async function runWithTransportContextAsync<T>(
  context: TransportContext,
  fn: () => Promise<T>,
): Promise<T> {
  return transportContextStorage.run(context, fn);
}

export function getTransportContext(): TransportContext | undefined {
  return transportContextStorage.getStore();
}

export function hasTransportContext(): boolean {
  return transportContextStorage.getStore() !== undefined;
}

// Backward-compat re-exports
export const runWithSubagentContext = runWithTransportContext;
export const runWithSubagentContextAsync = runWithTransportContextAsync;
export const getSubagentContext = getTransportContext;
export const hasSubagentContext = hasTransportContext;
