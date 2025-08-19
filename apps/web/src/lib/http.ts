// Lightweight HTTP helpers centralizing base URL, timeouts, and streaming

const DEFAULT_BASE_URL = 'http://localhost:8080';

export const API_BASE_URL: string =
  // Allow override via env at build-time (must be static access for Vite)
  (import.meta.env.VITE_API_URL as string | undefined) || DEFAULT_BASE_URL;

// Accept any JSON-serializable body; callers provide their own types
type JsonLike = unknown;

export interface GetJsonOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export async function getJson<T = unknown>(
  path: string,
  options: GetJsonOptions = {}
): Promise<T> {
  const { signal, timeoutMs, headers } = options;

  // Compose signal with timeout if provided
  let composedSignal = signal;
  let timeoutController: AbortController | null = null;
  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
      const timeoutSignal: AbortSignal = AbortSignal.timeout(timeoutMs);
      composedSignal = mergeAbortSignals(signal, timeoutSignal);
    } else {
      timeoutController = new AbortController();
      composedSignal = mergeAbortSignals(signal, timeoutController.signal);
      setTimeout(() => timeoutController?.abort(), timeoutMs);
    }
  }

  const res = await fetch(new URL(path, API_BASE_URL), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...headers,
    },
    signal: composedSignal,
  });

  if (!res.ok) {
    const text = await safeReadText(res);
    throw httpError(res.status, res.statusText, text);
  }

  // Attempt JSON first; fall back to text
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

export interface PostStreamOptions<TMessage = unknown> {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  // Called for each parsed SSE JSON line
  onMessage: (message: TMessage) => void;
}

// Handles text/event-stream-like payloads from a POST endpoint
export async function postStream<TMessage = unknown>(
  path: string,
  body: JsonLike,
  options: PostStreamOptions<TMessage>
): Promise<void> {
  const res = await fetch(new URL(path, API_BASE_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream, application/json',
      ...options.headers,
    },
    body: JSON.stringify(body ?? {}),
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await safeReadText(res);
    throw httpError(res.status, res.statusText, text);
  }

  if (!res.body) {
    throw new Error('No response body received');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line) continue;
        // Support both SSE lines prefixed with "data: " and raw JSON-per-line
        const trimmed = line.startsWith('data: ')
          ? line.slice(6).trim()
          : line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as TMessage;
          options.onMessage(parsed);
        } catch {
          // Ignore non-JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function httpError(status: number, statusText: string, body?: string) {
  const error = new Error(
    `HTTP ${status}: ${statusText}${body ? ` — ${truncate(body, 300)}` : ''}`
  );
  // @ts-expect-error augment error
  error.status = status;
  // @ts-expect-error augment error
  error.statusText = statusText;
  return error;
}

async function safeReadText(res: Response): Promise<string | undefined> {
  try {
    return await res.text();
  } catch {
    return undefined;
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Utility to merge multiple AbortSignals into one that aborts when any input aborts
function mergeAbortSignals(
  a?: AbortSignal,
  b?: AbortSignal
): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;
  const controller = new AbortController();
  const onAbortA = () => controller.abort(a.reason);
  const onAbortB = () => controller.abort(b.reason);
  if (a.aborted) {
    controller.abort(a.reason);
  } else if (b.aborted) {
    controller.abort(b.reason);
  } else {
    a.addEventListener('abort', onAbortA, { once: true });
    b.addEventListener('abort', onAbortB, { once: true });
  }
  return controller.signal;
}
