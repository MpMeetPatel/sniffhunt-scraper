import 'dotenv/config';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import { serve } from '@hono/node-server';
// @ts-ignore - Importing from workspace dependency
import { scrapeWithStreaming } from 'scraper/WebScraper.js';
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

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '/*',
  cors({
    origin: [
      'http://localhost:6001',
      'http://127.0.0.1:6001',
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      process.env.CORS_ORIGIN || '*',
    ],
    allowHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
  })
);

// Health check endpoint
app.get('/', c => {
  return c.json({
    status: 'healthy',
    service: 'sniffhunt-scraper-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/health', c => {
  return c.json({
    status: 'healthy',
    service: 'sniffhunt-scraper-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: {
      googleApiKeyExists: !!process.env.GOOGLE_GEMINI_KEY,
    },
  });
});

// Main scraping endpoint with streaming
app.post('/scrape', async c => {
  try {
    const body = await c.req.json();
    const validatedData = ScrapeRequestSchema.parse(body);

    const { url, output, query, mode } = validatedData;

    // Set headers for Server-Sent Events
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Headers', 'Cache-Control');
    c.header('X-Accel-Buffering', 'no');

    // For streaming response, we need to use Server-Sent Events
    return stream(c, async stream => {
      let scrapingResult = null;
      let hasError = false;

      try {
        const progressCallback = (progress: any) => {
          stream.write(
            `data: ${JSON.stringify({
              type: 'progress',
              timestamp: new Date().toISOString(),
              ...progress,
            })}\n\n`
          );
        };

        scrapingResult = await scrapeWithStreaming(
          url,
          output,
          query,
          mode,
          progressCallback
        );
      } catch (error: any) {
        hasError = true;
        console.error('Scraping error:', error);

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
    });
  } catch (error: any) {
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

app.post('/scrape-sync', async c => {
  try {
    const body = await c.req.json();
    const validatedData = ScrapeRequestSchema.parse(body);

    const { url, output, query, mode } = validatedData;

    const scrapingResult = await scrapeWithStreaming(
      url,
      output,
      query,
      mode,
      null
    );

    if (scrapingResult && scrapingResult.success) {
      return c.json({
        success: true,
        data: {
          markdown: scrapingResult.markdown,
          html: scrapingResult.html,
          metadata: {
            url: url,
            query: query,
            mode: mode,
            processingTime: scrapingResult.processingTime,
            contentLength: scrapingResult.markdown?.length || 0,
          },
        },
      });
    } else {
      return c.json(
        {
          success: false,
          error: scrapingResult?.error || 'Scraping failed',
          enhancedError: scrapingResult?.enhancedError || null,
        },
        500
      );
    }
  } catch (error: any) {
    console.error('Sync scraping error:', error);
    return c.json(
      {
        success: false,
        error: error.message,
        details: error.errors || error.message,
      },
      400
    );
  }
});

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
          'POST /scrape-sync',
        ],
        timestamp: new Date().toISOString(),
      },
    },
    404
  );
});

const port = process.env.PORT || 8080;

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m',
};

serve(
  {
    fetch: app.fetch,
    port: Number(port),
    hostname: '0.0.0.0',
  },
  info => {
    // Suppress default Hono server startup message
  }
);

console.log(`${colors.blue}${'═'.repeat(80)}${colors.reset}`);
console.log(
  `${colors.green}${colors.bright}✅ SniffHunt Scraper API Server${colors.reset} ${colors.dim}running on${colors.reset} ${colors.cyan}http://localhost:${port}${colors.reset}`
);
console.log(`${colors.blue}${'═'.repeat(80)}${colors.reset}`);

console.log(
  `\n${colors.yellow}${colors.bright}📡 API USAGE EXAMPLES${colors.reset}`
);
console.log(`${colors.blue}${'─'.repeat(80)}${colors.reset}`);
console.log(`${colors.white}Normal Mode:${colors.reset}`);
console.log(
  `${colors.dim}curl -X POST ${colors.cyan}http://localhost:${port}/scrape${colors.reset} ${colors.dim}-H "Content-Type: application/json" -d '{"url": "https://example.com", "mode": "normal"}'${colors.reset}`
);
console.log('');
console.log(`${colors.white}Beast Mode with Query:${colors.reset}`);
console.log(
  `${colors.dim}curl -X POST ${colors.cyan}http://localhost:${port}/scrape${colors.reset} ${colors.dim}-H "Content-Type: application/json" -d '{"url": "https://anu-vue.netlify.app/guide/components/alert.html", "mode": "beast", "query": "Outlined Alert Code snippets"}'${colors.reset}`
);
console.log(`${colors.blue}${'─'.repeat(80)}${colors.reset}`);

console.log(
  `\n${colors.cyan}${colors.bright}🔧 MCP SERVER SETUP INSTRUCTIONS${colors.reset}`
);
console.log(`${colors.blue}${'═'.repeat(80)}${colors.reset}`);
console.log('');
console.log(
  `${colors.yellow}${colors.bright}STEP 1:${colors.reset} ${colors.white}Build the MCP server${colors.reset}`
);
console.log(
  `${colors.dim}   └─${colors.reset} ${colors.green}cd apps/mcp && bun run build${colors.reset}`
);
console.log('');
console.log(
  `${colors.yellow}${colors.bright}STEP 2:${colors.reset} ${colors.white}Setup MCP configuration${colors.reset}`
);
console.log(
  `${colors.dim}   └─${colors.reset} ${colors.green}bun run setup:mcp${colors.reset}`
);
console.log('');
console.log(
  `${colors.yellow}${colors.bright}STEP 3:${colors.reset} ${colors.white}The setup script will automatically:${colors.reset}`
);
console.log(
  `${colors.dim}   ├─${colors.reset} ${colors.magenta}Build the MCP server${colors.reset}`
);
console.log(
  `${colors.dim}   ├─${colors.reset} ${colors.magenta}Configuration example in your MCP client${colors.reset}`
);
console.log(
  `${colors.dim}   └─${colors.reset} ${colors.magenta}Provide usage examples${colors.reset}`
);
