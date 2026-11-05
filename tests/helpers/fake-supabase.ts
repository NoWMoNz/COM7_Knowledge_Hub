import { vi } from "vitest";

export type Call = { method: string; args: unknown[] };
export type Result = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
export type Handler = (table: string, calls: Call[]) => Result | undefined;

/**
 * Minimal chainable stand-in for a Supabase client. Every query-builder call is recorded; awaiting the chain
 * (or .single()/.maybeSingle()) asks `handler(table, calls)` for the result. Unhandled queries resolve to empty data.
 */
export function fakeSupabase(handler: Handler, rpcHandler: (name: string, args: unknown) => Result = () => ({ data: null, error: null })) {
  const log: { table: string; calls: Call[] }[] = [];
  const rpcLog: { name: string; args: unknown }[] = [];
  const storageDownload = vi.fn(async () => ({ data: new Blob(["x"]), error: null as null | { message: string } }));
  const storageUpload = vi.fn(async () => ({ data: { path: "p" }, error: null as null | { message: string } }));

  const from = (table: string) => {
    const calls: Call[] = [];
    const settle = () => {
      log.push({ table, calls: [...calls] });
      const r = handler(table, calls) ?? {};
      return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
    };
    const chain: Record<string, unknown> = new Proxy({}, {
      get(_t, prop: string) {
        if (prop === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(settle()).then(res, rej);
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return chain;
        };
      },
    });
    return chain;
  };

  return {
    client: {
      from,
      rpc: async (name: string, args: unknown) => {
        rpcLog.push({ name, args });
        const r = rpcHandler(name, args);
        return { data: r.data ?? null, error: r.error ?? null };
      },
      storage: { from: () => ({ download: storageDownload, upload: storageUpload, remove: vi.fn(async () => ({ error: null })), createSignedUrl: vi.fn(async () => ({ data: { signedUrl: "https://signed.example/x" }, error: null })) }) },
    },
    log,
    rpcLog,
    storageDownload,
    storageUpload,
    /** Calls made against `table` with the given method name (e.g. "update"). */
    ops: (table: string, method: string) => log.filter((l) => l.table === table).flatMap((l) => l.calls.filter((c) => c.method === method)),
  };
}
