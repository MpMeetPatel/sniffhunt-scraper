#!/usr/bin/env bun

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { scrapeWithStreaming } from '../../scraper/WebScraper.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({
  path: join(__dirname, '../../../.env'),
  quiet: true,
});

// Tool definitions
const TOOLS = [
  {
    name: 'scrape_website',
    description:
      'Extract, scrape, grab, fetch, pull, harvest, mine, collect, gather, or retrieve content from any website URL. Advanced web scraping with intelligent content extraction, interactive element processing, and data harvesting. Supports comprehensive content mining from web pages, articles, documentation, blogs, and any online content. Perfect for extracting structured data, text content, HTML markup, and processing dynamic websites with JavaScript. Use this for any web content extraction, data scraping, content grabbing, or website data collection tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scrape',
        },
        mode: {
          type: 'string',
          enum: ['normal', 'beast'],
          default: 'beast',
          description:
            "Scraping mode: 'normal' for simple extraction, 'beast' for advanced extraction with interactive elements, JavaScript processing, and comprehensive content harvesting",
        },
        userQuery: {
          type: 'string',
          description:
            'Optional query to focus content extraction, scraping, or data harvesting on specific topics, keywords, or requirements. When provided, automatically uses beast mode for enhanced extraction.',
        },
      },
      required: ['url'],
    },
  },
];

async function main() {
  const server = new Server(
    {
      name: 'sniffhunt-scraper',
      version: '1.0.0',
      description:
        'Advanced web scraping and content extraction server for harvesting, grabbing, and mining website data',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;

    if (name === 'scrape_website') {
      const { url, mode = 'beast', userQuery = '' } = args || {};

      // Force beast mode when userQuery is provided (unless explicitly set to normal)
      const finalMode = userQuery && mode === 'beast' ? 'beast' : mode;

      if (!url) {
        throw new Error('URL is required');
      }

      try {
        // Validate URL format
        new URL(url);
      } catch {
        throw new Error('Invalid URL format');
      }

      try {
        console.error(`[MCP] Starting scrape for ${url} in ${finalMode} mode`);

        const result = await scrapeWithStreaming(
          url,
          null, // outputHtmlFilename - not needed for MCP
          userQuery,
          finalMode,
          null // progressCallback - not needed for MCP
        );

        if (!result.success) {
          throw new Error(result.error || 'Scraping failed');
        }

        console.error(`[MCP] Scraping completed successfully for ${url}`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: result.success,
                  url: url,
                  mode: finalMode,
                  processingTime: result.processingTime,
                  markdownLength: result.markdown?.length || 0,
                  htmlLength: result.html?.length || 0,
                  hasEnhancedError: !!result.enhancedError,
                  enhancedErrorMessage:
                    result.enhancedError?.userMessage || null,
                  markdown: result.markdown,
                  html: result.html,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        console.error(`[MCP] Scraping error for ${url}:`, error);
        throw new Error(
          `Scraping failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP] SniffHunt Scraper MCP Server started');
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.error('[MCP] Server shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[MCP] Server shutting down...');
  process.exit(0);
});

// Start the server
main().catch(error => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
