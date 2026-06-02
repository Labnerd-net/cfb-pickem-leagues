// Safe wrapper for c.executionCtx.waitUntil that falls back to fire-and-forget
// in Node.js test environments where executionCtx throws when accessed.
export function waitUntil(ctx: unknown, promise: Promise<unknown>): void {
  try {
    const c = ctx as { executionCtx?: { waitUntil(p: Promise<unknown>): void } };
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(promise);
      return;
    }
  } catch {
    // executionCtx not available in this runtime
  }
  promise.catch(() => {});
}
