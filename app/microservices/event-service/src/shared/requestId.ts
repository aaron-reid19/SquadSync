// Copied into each service's src/shared/ by scripts/sync-shared.sh. Edit the _shared copy.
import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

// Accept an incoming ID only if it looks like one, so clients cannot inject log content.
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/** Reuses a well-formed incoming request ID, otherwise makes a new one. */
export function requestIdFrom(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  return value && VALID_REQUEST_ID.test(value) ? value : randomUUID();
}

/** Probe endpoints are called every few seconds; they are only logged when they fail. */
export function isProbePath(path: string) {
  return path === "/health" || path === "/ready";
}
