import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import { scrapeWithStreaming } from './WebScraper.js';
import { serve } from '@hono/node-server';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Request validation schema
const ScrapeRequestSchema = z.object({
  url: z.string().url('Invalid URL format'),
  output: z.string().optional().default('scraped'),
  query: z.string().optional().default(''),
  mode: z.enum(['normal', 'beast']).optional().default('beast'),
});

// Initialize Hono app
const app = new Hono();

// Middleware
app.use(
  '*',
  cors({
    origin: ['*'], // Configure appropriately for production
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
  })
);

app.use('*', logger());

// Health check endpoint
app.get('/', c => {
  return c.json({
    status: 'healthy',
    service: 'context-scraper',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/health', c => {
  return c.json({
    status: 'healthy',
    checks: {
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: {
        googleApiKeyExists: !!process.env.GOOGLE_GEMINI_KEY,
        googleApiKeyLength: process.env.GOOGLE_GEMINI_KEY?.length || 0,
        googleApiKeyPrefix:
          process.env.GOOGLE_GEMINI_KEY?.substring(0, 10) || 'undefined',
      },
    },
  });
});

// Main scraping endpoint with streaming
app.post('/scrape', async c => {
  try {
    // Validate request body
    const body = await c.req.json();
    const validatedData = ScrapeRequestSchema.parse(body);

    const { url, output, query, mode } = validatedData;

    // For streaming response, we need to use Server-Sent Events
    return stream(
      c,
      async stream => {
        let scrapingResult = null;
        let hasError = false;

        try {
          // Start the scraping process with streaming callback
          const progressCallback = progress => {
            // Stream progress updates (not the actual content)
            stream.write(
              `data: ${JSON.stringify({
                type: 'progress',
                timestamp: new Date().toISOString(),
                ...progress,
              })}\n\n`
            );
          };

          // Execute scraping with streaming progress
          scrapingResult = await scrapeWithStreaming(
            url,
            output,
            query,
            mode,
            progressCallback
          );
        } catch (error) {
          hasError = true;
          console.error('Scraping error:', error);

          // Send error through stream
          stream.write(
            `data: ${JSON.stringify({
              type: 'error',
              timestamp: new Date().toISOString(),
              error: {
                message: error.message,
                code: error.code || 'SCRAPING_FAILED',
                details: error.details || 'An error occurred during scraping',
              },
            })}\n\n`
          );
        }

        if (!hasError && scrapingResult) {
          stream.write(
            `data: ${JSON.stringify({
              type: 'completed',
              timestamp: new Date().toISOString(),
              result: {
                success: scrapingResult.success,
                data: {
                  markdown: scrapingResult.markdown,
                  metadata: {
                    url: url,
                    output: output,
                    query: query,
                    mode: mode,
                    processingTime: scrapingResult.processingTime,
                    contentLength: {
                      markdown: scrapingResult.markdown?.length || 0,
                    },
                  },
                },
                enhancedError: scrapingResult.enhancedError || null,
              },
            })}\n\n`
          );
        } else if (!hasError) {
          // Send failure result
          stream.write(
            `data: ${JSON.stringify({
              type: 'completed',
              timestamp: new Date().toISOString(),
              result: {
                success: false,
                error: 'Scraping completed but no data was extracted',
              },
            })}\n\n`
          );
        }

        // Close the stream
        stream.write(
          `data: ${JSON.stringify({
            type: 'done',
            timestamp: new Date().toISOString(),
          })}\n\n`
        );
      },
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control',
          'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
      }
    );
  } catch (error) {
    console.error('Request validation error:', error);

    return c.json(
      {
        success: false,
        error: {
          message: 'Invalid request data',
          details: error.errors || error.message,
          timestamp: new Date().toISOString(),
        },
      },
      400
    );
  }
});

// Error handling middleware
app.onError((err, c) => {
  console.error('Application error:', err);

  return c.json(
    {
      success: false,
      error: {
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
      },
    },
    500
  );
});

// 404 handler
app.notFound(c => {
  return c.json(
    {
      success: false,
      error: {
        message: 'Endpoint not found',
        availableEndpoints: [
          'GET /',
          'GET /health',
          'POST /scrape',
        ],
        timestamp: new Date().toISOString(),
      },
    },
    404
  );
});

const port = process.env.PORT || 6000;

serve({
  fetch: app.fetch,
  port: port,
  host: '0.0.0.0',
});

console.log(`✅ Context Scraper API server running on http://0.0.0.0:${port} or http://localhost:${port}`);
// example curl usage
console.log(`\nExample curl usage: \n`);
console.log(
  `curl -X POST http://localhost:${port}/scrape -H "Content-Type: application/json" -d '{"url": "https://example.com", "mode": "normal"}'`
);
console.log(
  `curl -X POST http://localhost:${port}/scrape -H "Content-Type: application/json" -d '{"url": "https://anu-vue.netlify.app/guide/components/alert.html", "mode": "beast", "query": "Outlined Alert Code snippets"}'`
);

// Log MCP Configuration
const mcpServerPath = resolve(__dirname, '..', 'mcp', 'src', 'index.js');
const mcpConfig = {
  mcpServers: {
    'sniffhunt-scraper': {
      command: 'node',
      args: [mcpServerPath],
    },
  },
};

console.log('----------------------------------------------------');
console.log('\n🔧 MCP Configuration (copy & paste):');
console.log(JSON.stringify(mcpConfig, null, 2));
console.log('----------------------------------------------------');

console.log('\nTry some examples in your MCP Client:\n');
console.log('scrape https://example.com using beast mode');
console.log('Parse https://example.com in normal mode');
console.log(
  'Extract https://anu-vue.netlify.app/guide/components/alert.html in beast mode & grab the "Outlined Alert Code snippets"'
);

// Export the app
export { app };
