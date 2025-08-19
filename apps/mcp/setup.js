#!/usr/bin/env node

/**
 * Cross-Platform SniffHunt MCP Server Setup Script
 * Works on Windows, macOS, and Linux
 */

import { execSync } from 'child_process';
import { existsSync, chmodSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const MCP_DIR = __dirname;
const DIST_FILE = join(MCP_DIR, 'dist', 'index.js');
const PACKAGE_NAME = 'sniffhunt-scraper-mcp-server';
const IS_WINDOWS = platform() === 'win32';

// Colors (Windows CMD doesn't support ANSI colors well, so we'll detect)
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  purple: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Disable colors on Windows CMD for better compatibility
const color = (colorCode, text) => {
  if (IS_WINDOWS && !process.env.WT_SESSION) {
    return text; // Windows CMD without Windows Terminal
  }
  return `${colorCode}${text}${COLORS.reset}`;
};

// Cross-platform command execution
function execCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      stdio: 'pipe',
      encoding: 'utf8',
      ...options,
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout || '' };
  }
}

// Check if command exists
function commandExists(command) {
  const checkCmd = IS_WINDOWS ? `where ${command}` : `which ${command}`;
  return execCommand(checkCmd).success;
}

// Main setup function
async function setup() {
  console.log(color(COLORS.purple, '🚀 SniffHunt MCP Server Setup'));
  console.log(color(COLORS.blue, '================================'));
  console.log('');

  try {
    // Step 1: Clean previous builds
    console.log(color(COLORS.yellow, '🧹 Cleaning previous builds...'));
    const distDir = join(MCP_DIR, 'dist');
    if (existsSync(distDir)) {
      rmSync(distDir, { recursive: true, force: true });
      console.log(color(COLORS.green, '✅ Cleaned dist directory'));
    }

    // Step 2: Build the package
    console.log(color(COLORS.yellow, '🔨 Building MCP server...'));
    process.chdir(MCP_DIR);

    let buildResult;
    if (commandExists('bun')) {
      buildResult = execCommand('bun run build');
      if (buildResult.success) {
        console.log(color(COLORS.green, '✅ Built with Bun'));
      }
    } else if (commandExists('npm')) {
      buildResult = execCommand('npm run build');
      if (buildResult.success) {
        console.log(color(COLORS.green, '✅ Built with npm'));
      }
    } else {
      throw new Error('Neither Bun nor npm found. Please install one of them.');
    }

    if (!buildResult.success) {
      throw new Error(`Build failed: ${buildResult.error}`);
    }

    // Step 3: Make the built file executable (Unix-like systems only)
    if (!IS_WINDOWS) {
      console.log(color(COLORS.yellow, '🔧 Making dist file executable...'));
      chmodSync(DIST_FILE, '755');
      console.log(color(COLORS.green, `✅ Made ${DIST_FILE} executable`));
    }

    // Step 4: Unlink existing package
    console.log(color(COLORS.yellow, '🔗 Checking for existing links...'));
    const listResult = execCommand('npm list -g --depth=0');
    if (listResult.output.includes(PACKAGE_NAME)) {
      console.log(color(COLORS.cyan, '🔄 Unlinking existing package...'));
      execCommand(`npm unlink -g ${PACKAGE_NAME}`);
      console.log(color(COLORS.green, '✅ Unlinked existing package'));
    } else {
      console.log(color(COLORS.cyan, 'ℹ️  No existing link found'));
    }

    // Step 5: Create fresh link
    console.log(color(COLORS.yellow, '🔗 Creating new global link...'));
    const linkResult = execCommand('npm link');
    if (!linkResult.success) {
      throw new Error(`Failed to link package: ${linkResult.error}`);
    }
    console.log(
      color(COLORS.green, `✅ Package linked globally as: ${PACKAGE_NAME}`)
    );

    // Step 6: Verify the link works
    console.log(color(COLORS.yellow, '🧪 Testing the linked command...'));
    const testCmd = IS_WINDOWS
      ? `where ${PACKAGE_NAME}`
      : `which ${PACKAGE_NAME}`;
    const testResult = execCommand(testCmd);

    if (testResult.success) {
      console.log(
        color(
          COLORS.green,
          `✅ Command '${PACKAGE_NAME}' is available globally`
        )
      );
      console.log(color(COLORS.cyan, `📍 Linked to: ${testResult.output}`));
    } else {
      console.log(
        color(COLORS.red, `❌ Command '${PACKAGE_NAME}' not found in PATH`)
      );
      if (IS_WINDOWS) {
        console.log(
          color(
            COLORS.yellow,
            '⚠️  You may need to restart your terminal or add npm global bin to your PATH'
          )
        );
      } else {
        const npmPrefix =
          execCommand('npm config get prefix').output || '/usr/local';
        console.log(
          color(
            COLORS.cyan,
            `💡 Try adding this to your shell profile: export PATH="${npmPrefix}/bin:$PATH"`
          )
        );
      }
    }

    // Step 7: Display final configuration
    console.log('');
    console.log(
      color(COLORS.green, '🎉 Setup Complete! Your MCP server is ready to use.')
    );
    console.log('');
    console.log(
      color(COLORS.purple, '📋 Copy this configuration to your MCP client:')
    );
    console.log('');
    console.log(
      color(
        COLORS.blue,
        '════════════════════════════════════════════════════════════'
      )
    );

    // Show the recommended NPX configuration
    const config = {
      mcpServers: {
        'sniffhunt-scraper': {
          command: 'npx',
          args: ['-y', PACKAGE_NAME],
          env: {
            GOOGLE_GEMINI_KEY: 'your-api-key-here',
          },
        },
      },
    };

    console.log(JSON.stringify(config, null, 2));
    console.log(
      color(
        COLORS.blue,
        '════════════════════════════════════════════════════════════'
      )
    );
    console.log('');
    console.log(color(COLORS.yellow, '📝 Instructions:'));
    console.log(`${color(COLORS.cyan, '1.')} Copy the configuration above`);
    console.log(
      `${color(COLORS.cyan, '2.')} Replace 'your-api-key-here' with your actual Google Gemini API key`
    );
    console.log(
      `${color(COLORS.cyan, '3.')} Paste it into your MCP client (Cursor, Claude Desktop, etc.)`
    );
    console.log(
      `${color(COLORS.cyan, '4.')} Restart your MCP client (Cursor, Claude Desktop, etc.)`
    );
    console.log(
      `${color(COLORS.cyan, '5.')} 🚀 🚀  Enjoy world's best scraper !! 🚀 🚀 `
    );
    console.log('');
    console.log(
      color(COLORS.green, '🚀 Runtime: Bun (fast startup & execution)')
    );
    console.log(
      color(COLORS.green, '📦 Distribution: NPX (easy installation)')
    );
  } catch (error) {
    console.error(color(COLORS.red, `❌ Setup failed: ${error.message}`));
    process.exit(1);
  }
}

// Run setup
setup().catch(error => {
  console.error(color(COLORS.red, `❌ Fatal error: ${error.message}`));
  process.exit(1);
});
