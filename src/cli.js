#!/usr/bin/env node

/**
 * Main entry point for the Context Scraper application
 * Provides unified access to CLI, server, and programmatic usage
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json for version info
const packagePath = join(__dirname, '..', 'package.json');
const packageInfo = JSON.parse(readFileSync(packagePath, 'utf8'));

// Help text for the main entry point
const MAIN_HELP_TEXT = `
${packageInfo.name} v${packageInfo.version}
${packageInfo.description}

🌟 World's Best Opensource AI Scraper & URL to Markdown Converter 🌟

Usage:
  node src/index.js <command> [options]
  npm start <command> [options]

Commands:
  cli <url> [options]     Run the CLI scraper (default command)
  server [options]        Start the HTTP API server
  help                    Show this help message

CLI Options (when using 'cli' command or direct URL):
  -o, --output <file>     Output filename (default: scraped)
  -q, --query <text>      Optional user query for focused content extraction
  -m, --mode <mode>       Scraping mode: normal or beast (default: beast)
  -h, --help             Show CLI help

Server Options (when using 'server' command):
  -p, --port <port>       Server port (default: 6000)
  -h, --host <host>       Server host (default: 0.0.0.0)

Examples:
  # CLI Usage (direct URL - default command)
  node src/index.js https://example.com
  node src/index.js https://example.com -o output -q "Find pricing" -m beast
  
  # Explicit CLI command
  node src/index.js cli https://example.com -o custom-output
  
  # Start HTTP server
  node src/index.js server
  node src/index.js server -p 8080
  
  # Using npm scripts
  npm start https://example.com -- -o output
  npm run server

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
  
  📡 Multiple Interfaces:
     • Command Line Interface (CLI)
     • HTTP API Server with streaming
     • Model Context Protocol (MCP) server
     • Programmatic JavaScript API

For detailed documentation, visit: https://github.com/mpmeetpatel/sniffhunt-scraper
`;

// Parse command line arguments
function parseMainArgs() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    return { command: 'help' };
  }
  
  const firstArg = args[0];
  
  // Check for help
  if (firstArg === 'help' || firstArg === '-h' || firstArg === '--help') {
    return { command: 'help' };
  }
  
  // Check for explicit commands
  if (firstArg === 'cli') {
    return { command: 'cli', args: args.slice(1) };
  }
  
  if (firstArg === 'server') {
    return { command: 'server', args: args.slice(1) };
  }
  
  // If first argument looks like a URL, treat as CLI command
  if (firstArg.startsWith('http://') || firstArg.startsWith('https://')) {
    return { command: 'cli', args: args };
  }
  
  // Default to help for unrecognized commands
  return { command: 'help' };
}

// Main function
async function main() {
  const { command, args = [] } = parseMainArgs();
  
  try {
    if (command === 'help') {
      console.log(MAIN_HELP_TEXT);
      process.exit(0);
    } else if (command === 'cli') {
      // Import and run CLI
      // Set process.argv to simulate direct CLI call
      process.argv = ['node', 'src/cli.js', ...args];
      await import('./cli.js');
    } else if (command === 'server') {
      // Import and run server
      console.log('🚀 Starting Context Scraper HTTP API Server...');
      await import('./server.js');
    } else {
      console.error(`Unknown command: ${command}`);
      console.log('\nUse "help" command for usage information');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Export for programmatic usage
export { main };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
