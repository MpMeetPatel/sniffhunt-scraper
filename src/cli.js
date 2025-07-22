#!/usr/bin/env node

/**
 * Command Line Interface for the SniffHunt Scraper
 * Provides CLI access to web scraping functionality
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { scrape, SCRAPING_MODES } from './WebScraper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packagePath = join(__dirname, '..', 'package.json');
const packageInfo = JSON.parse(readFileSync(packagePath, 'utf8'));

const CLI_HELP_TEXT = `
${packageInfo.name} v${packageInfo.version}
${packageInfo.description}

🌟 World's Best Opensource AI Scraper & URL to Markdown Converter 🌟

Usage:
  node src/cli.js <url> [options]
  pnpm cli <url> [options]

Options:
  -o, --output <file>     Output filename (default: scraped)
  -q, --query <text>      Optional user query for focused content extraction
  -m, --mode <mode>       Scraping mode: normal or beast (default: beast)
  -h, --help             Show this help message

Scraping Modes:
  normal                  Fast AI-powered extraction with dynamic content handling
  beast                   Human-like browser automation for interactive elements

Examples:
  # Basic scraping
  node src/cli.js https://example.com
  pnpm cli https://example.com
  
  # Custom output filename
  node src/cli.js https://example.com -o my-output
  
  # With user query for focused extraction
  node src/cli.js https://docs.example.com -q "API documentation"
  
  # Using normal mode
  node src/cli.js https://example.com -m normal
  
  # Complete example
  node src/cli.js https://example.com -o pricing -q "Find pricing information" -m beast

Features:
  🚀 Two Scraping Modes:
     • Normal Mode: AI-powered extraction with dynamic content handling
     • Beast Mode: Human-like browser automation for interactive elements

  🎯 Smart Content Extraction:
     • Static HTML content
     • Dynamic content from user interactions
     • Lazy-loaded content via infinite scroll
     • Interactive elements (tabs, accordions, modals, dropdowns)
     • Server-rendered content revealed through interactions

  🤖 AI-Powered Features:
     • Interactive element detection and automation
     • Query-focused content extraction
     • Intelligent content combination
     • Markdown optimization

For detailed documentation, visit: https://github.com/mpmeetpatel/sniffhunt-scraper
`;

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseCliArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return { showHelp: true };
  }

  const result = {
    url: null,
    output: 'scraped',
    query: '',
    mode: 'beast',
    showHelp: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      result.showHelp = true;
      return result;
    } else if (arg === '-o' || arg === '--output') {
      if (i + 1 < args.length) {
        result.output = args[i + 1];
        i += 2;
      } else {
        throw new Error(`Missing value for ${arg}`);
      }
    } else if (arg === '-q' || arg === '--query') {
      if (i + 1 < args.length) {
        result.query = args[i + 1];
        i += 2;
      } else {
        throw new Error(`Missing value for ${arg}`);
      }
    } else if (arg === '-m' || arg === '--mode') {
      if (i + 1 < args.length) {
        const mode = args[i + 1].toLowerCase();
        if (mode !== 'normal' && mode !== 'beast') {
          throw new Error(`Invalid mode: ${mode}. Must be 'normal' or 'beast'`);
        }
        result.mode = mode;
        i += 2;
      } else {
        throw new Error(`Missing value for ${arg}`);
      }
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!result.url) {
      // First non-option argument is the URL
      result.url = arg;
      i++;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!result.url && !result.showHelp) {
    throw new Error('URL is required');
  }

  return result;
}

/**
 * Main CLI function
 */
async function runCli() {
  try {
    const args = parseCliArgs();

    if (args.showHelp) {
      console.log(CLI_HELP_TEXT);
      process.exit(0);
    }

    try {
      new URL(args.url);
      // eslint-disable-next-line no-unused-vars
    } catch (_) {
      console.error(`❌ Invalid URL: ${args.url}`);
      process.exit(1);
    }

    console.log(`🚀 Starting SniffHunt Scraper...`);
    console.log(`📡 URL: ${args.url}`);
    console.log(`📁 Output: ${args.output}`);
    console.log(`🤖 Mode: ${args.mode}`);
    if (args.query) {
      console.log(`🔍 Query: ${args.query}`);
    }
    console.log('');

    const mode =
      args.mode === 'normal' ? SCRAPING_MODES.NORMAL : SCRAPING_MODES.BEAST;

    const success = await scrape(args.url, args.output, args.query, mode);

    if (success) {
      console.log(`\n✅ Scraping completed successfully!`);
      console.log(`📁 Files saved with prefix: ${args.output}`);
      process.exit(0);
    } else {
      console.log(`\n❌ Scraping failed. Check the logs above for details.`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.log('\nUse --help for usage information');
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export { runCli };

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}
