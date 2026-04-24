// src/core/transport-context.test.ts — Tests for transport context
import { describe, it, expect, vi } from "vitest";
import {
  runWithTransportContext,
  runWithTransportContextAsync,
  getTransportContext,
  hasTransportContext,
  type TransportContext,
} from "./transport-context.js";

describe("TransportContext", () => {
  const mockContext: TransportContext = {
    sendMessage: vi.fn().mockResolvedValue({ id: "msg-123" }),
    createThread: vi.fn().mockResolvedValue({ id: "thread-456" }),
    channelId: "channel-789",
    showToolCalls: true,
  };

  describe("runWithTransportContext", () => {
    it("provides context within the callback", () => {
      runWithTransportContext(mockContext, () => {
        expect(hasTransportContext()).toBe(true);
        const ctx = getTransportContext();
        expect(ctx).toBeDefined();
        expect(ctx?.channelId).toBe("channel-789");
        expect(ctx?.showToolCalls).toBe(true);
      });
    });

    it("returns undefined outside the context", () => {
      expect(hasTransportContext()).toBe(false);
      expect(getTransportContext()).toBeUndefined();
    });

    it("returns the result of the callback", () => {
      const result = runWithTransportContext(mockContext, () => {
        return "hello";
      });
      expect(result).toBe("hello");
    });
  });

  describe("runWithTransportContextAsync", () => {
    it("provides context within async callback", async () => {
      await runWithTransportContextAsync(mockContext, async () => {
        expect(hasTransportContext()).toBe(true);
        const ctx = getTransportContext();
        expect(ctx).toBeDefined();
        expect(ctx?.channelId).toBe("channel-789");
      });
    });

    it("returns the result of the async callback", async () => {
      const result = await runWithTransportContextAsync(mockContext, async () => {
        return "async-result";
      });
      expect(result).toBe("async-result");
    });

    it("context is available in nested async calls", async () => {
      await runWithTransportContextAsync(mockContext, async () => {
        const nestedCheck = async () => {
          return hasTransportContext();
        };
        const hasContext = await nestedCheck();
        expect(hasContext).toBe(true);
      });
    });
  });

  describe("nested contexts", () => {
    it("inner context overrides outer context", () => {
      const innerContext: TransportContext = {
        ...mockContext,
        channelId: "inner-channel",
      };

      runWithTransportContext(mockContext, () => {
        expect(getTransportContext()?.channelId).toBe("channel-789");

        runWithTransportContext(innerContext, () => {
          expect(getTransportContext()?.channelId).toBe("inner-channel");
        });

        expect(getTransportContext()?.channelId).toBe("channel-789");
      });
    });
  });
});
