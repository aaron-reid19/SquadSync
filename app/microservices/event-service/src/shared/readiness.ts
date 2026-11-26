// Copied into each service's src/shared/ by scripts/sync-shared.sh. Edit the _shared copy.

/**
 * A dependency check. Critical checks decide readiness (503 when failing);
 * non-critical checks are only reported, so an optional dependency such as
 * SMTP cannot take login down.
 */
export interface ReadinessCheck {
  critical: boolean;
  run: () => Promise<"ok" | "not_configured">;
}

export type CheckStatus = "ok" | "not_configured" | "failed";

export interface ReadinessResult {
  ok: boolean;
  statusCode: 200 | 503;
  checks: Record<string, CheckStatus>;
  /** Failure reasons for the server log only; never send these to clients. */
  failures: Record<string, string>;
}

const TIMEOUT_MS = Number(process.env.READINESS_TIMEOUT_MS) || 2000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function runReadiness(checks: Record<string, ReadinessCheck>): Promise<ReadinessResult> {
  const entries = await Promise.all(
    Object.entries(checks).map(async ([name, check]) => {
      try {
        return { name, check, status: (await withTimeout(check.run(), TIMEOUT_MS)) as CheckStatus };
      } catch (error) {
        return { name, check, status: "failed" as const, reason: error instanceof Error ? error.message : "unknown error" };
      }
    }),
  );

  const result: ReadinessResult = { ok: true, statusCode: 200, checks: {}, failures: {} };
  for (const entry of entries) {
    result.checks[entry.name] = entry.status;
    if (entry.status === "failed") {
      result.failures[entry.name] = "reason" in entry ? entry.reason ?? "unknown error" : "unknown error";
      if (entry.check.critical) {
        result.ok = false;
        result.statusCode = 503;
      }
    }
  }
  return result;
}

/** Remembers a successful result for `ttlMs` so frequent probes don't hammer a dependency. */
export function cacheSuccess(run: ReadinessCheck["run"], ttlMs: number): ReadinessCheck["run"] {
  let okUntil = 0;
  let last: "ok" | "not_configured" = "ok";
  return async () => {
    if (Date.now() < okUntil) return last;
    last = await run();
    okUntil = Date.now() + ttlMs;
    return last;
  };
}

/** PostgreSQL is reachable and answering queries. */
export function postgresCheck(pool: { query: (sql: string) => Promise<unknown> }): ReadinessCheck {
  return {
    critical: true,
    run: async () => {
      await pool.query("SELECT 1");
      return "ok";
    },
  };
}

/** The identity service publishes at least one signing key, so tokens can be verified. */
export function jwksCheck(url: string | undefined): ReadinessCheck {
  return {
    critical: true,
    run: cacheSuccess(async () => {
      if (!url) throw new Error("IDENTITY_JWKS_URL is not set");
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw new Error(`JWKS returned HTTP ${response.status}`);
      const body = (await response.json()) as { keys?: unknown[] };
      if (!Array.isArray(body.keys) || body.keys.length === 0) throw new Error("JWKS has no keys");
      return "ok";
    }, 30_000),
  };
}
