// Copied into each service's src/ because every image builds from its own folder.
// Keep the copies identical: scripts/check-shared.sh fails CI when they drift.

export const isProduction = process.env.NODE_ENV === "production";

// Values from the .env.example files that must never reach production.
const PLACEHOLDER = /change-?me|your-client-id|replace-?me|example\.com/i;

function problemWith(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return "missing";
  if (PLACEHOLDER.test(value)) return "still a placeholder";
  return undefined;
}

/**
 * Checks that required settings are present before the service starts.
 * Production refuses to start; development only warns, so `pnpm dev` keeps working.
 * Only variable names are printed, never their values.
 */
export function assertRequiredConfig(service: string, names: string[]) {
  const problems = names
    .map((name) => ({ name, problem: problemWith(name) }))
    .filter((p): p is { name: string; problem: string } => Boolean(p.problem));
  if (!problems.length) return;

  const list = problems.map((p) => `${p.name} (${p.problem})`).join(", ");
  if (isProduction) {
    throw new Error(`${service}: refusing to start, required configuration is invalid: ${list}`);
  }
  console.warn(`${service}: development mode, these settings are not production-ready: ${list}`);
}
