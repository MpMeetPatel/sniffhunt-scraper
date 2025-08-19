import { getJson, postStream } from './http';

export interface ScrapeRequestBody {
  url: string;
  mode: 'normal' | 'beast';
  query?: string;
}

export interface ScrapingResult {
  markdown: string;
  metadata: {
    url: string;
    query: string;
    mode: string;
    processingTime: number;
    contentLength: { markdown: number };
  };
}

export type StreamMessage = {
  type:
    | 'progress'
    | 'completed'
    | 'error'
    | 'done'
    | 'phase_start'
    | 'phase_end'
    | 'log'
    | 'stream_complete';
  timestamp: string;
  message?: string;
  progress?: number;
  phase?: string;
  level?: 'info' | 'warn' | 'error';
  success?: boolean;
  result?: {
    success: boolean;
    data?: ScrapingResult;
    error?: string;
  };
  error?: {
    message: string;
    code: string;
    details: string;
  };
};

export async function healthCheck(signal?: AbortSignal) {
  return getJson<{ status: 'ok' }>(`/health`, { signal, timeoutMs: 5000 });
}

export async function scrapeStream(
  body: ScrapeRequestBody,
  onMessage: (message: StreamMessage) => void,
  signal?: AbortSignal
) {
  return postStream<StreamMessage>(`/scrape`, body, { onMessage, signal });
}
