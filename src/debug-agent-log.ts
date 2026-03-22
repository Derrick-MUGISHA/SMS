import { appendFileSync } from 'node:fs';

const LOG_PATH =
  '/home/derrick/Documents/GitHub/SMS/sms/.cursor/debug-d124f0.log';

/** Debug session logging (NDJSON file + optional ingest). Do not log secrets. */
export function agentLog(
  entry: Record<string, unknown> & {
    hypothesisId?: string;
    location: string;
    message: string;
  },
): void {
  const payload = {
    sessionId: 'd124f0',
    timestamp: Date.now(),
    ...entry,
  };
  try {
    appendFileSync(LOG_PATH, `${JSON.stringify(payload)}\n`);
  } catch {
    /* ignore disk errors */
  }
  void fetch(
    'http://127.0.0.1:7773/ingest/8364a819-6a41-4ef9-9cdc-c7cf1862c912',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'd124f0',
      },
      body: JSON.stringify(payload),
    },
  ).catch(() => {});
}
