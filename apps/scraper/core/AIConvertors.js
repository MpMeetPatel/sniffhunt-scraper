import dotenv from 'dotenv';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LLM_MODEL_CONFIG } from '../config.js';
import {
  generateHTMLToMarkdownPrompt,
  generateMarkdownToMarkdownPrompt,
} from '../utils/AIPrompts.js';
import { handleError } from '../utils/GlobalErrorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({
  path: join(__dirname, '../../../.env'),
  quiet: true,
});

/**
 * Convert HTML to markdown using AI with progress indicators
 * @param {string} htmlContent - The HTML content to convert
 * @param {string} userQuery - Optional user query for specific content focus
 * @param {Function} progressCallback - Optional progress callback for streaming updates
 * @returns {Promise<string>} - The AI-converted markdown content
 */
export async function convertAndImproveMarkdownFromHTML(
  htmlContent,
  userQuery = '',
  progressCallback = null
) {
  if (!htmlContent.trim()) {
    return '';
  }

  // Helper function to log with streaming support
  const logWithStreaming = (message, level = 'info') => {
    console.log(
      `${level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '🤖'} ${message}`
    );
    if (progressCallback) {
      progressCallback({
        type: 'log',
        level,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Initialize Google AI
  const google = createGoogleGenerativeAI({
    apiKey: LLM_MODEL_CONFIG.apiKey,
  });

  let streamingComplete = false;
  let convertedMarkdown = '';

  try {
    logWithStreaming('Starting HTML to Markdown conversion with AI');

    const { textStream } = await streamText({
      model: google(LLM_MODEL_CONFIG.smallModel ?? 'gemini-2.5-flash'),
      temperature: 0.9,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 1024,
          },
        },
      },
      prompt: generateHTMLToMarkdownPrompt(userQuery, htmlContent),
      onFinish: result => {
        streamingComplete = true;
        convertedMarkdown = result.text ?? 'AI no data error';
      },
    });

    // Process the streaming response without showing text in CLI
    for await (const _ of textStream) {
      console.log('🤖 AI Analysis generating markdown response...');
    }

    while (!streamingComplete) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!streamingComplete) {
      logWithStreaming('AI streaming timeout, using partial result', 'warn');
    }

    if (!convertedMarkdown.trim()) {
      logWithStreaming('AI returned empty markdown', 'error');
      return '';
    }

    // Log completion
    logWithStreaming(
      `HTML to Markdown conversion complete! Generated ${convertedMarkdown.length} characters`
    );

    return convertedMarkdown;
  } catch (error) {
    logWithStreaming(`AI conversion failed: ${error.message}`, 'error');

    await handleError(error, {
      operation: 'convertAndImproveMarkdown',
      htmlLength: htmlContent.length,
      userQuery: userQuery || 'none',
      modelUsed: LLM_MODEL_CONFIG.smallModel ?? 'gemini-2.5-flash',
    });

    // Return empty string if AI fails
    return '';
  }
}

/**
 * Convert Markdown to markdown using AI with progress indicators
 * @param {string} markdownContent - The markdown content to convert
 * @param {string} userQuery - Optional user query for specific content focus
 * @param {Function} progressCallback - Optional progress callback for streaming updates
 * @returns {Promise<string>} - The AI-converted markdown content
 */
export async function convertAndImproveMarkdownFromMarkdown(
  markdownContent,
  userQuery = '',
  progressCallback = null
) {
  if (!markdownContent.trim()) {
    return '';
  }

  // Helper function to log with streaming support
  const logWithStreaming = (message, level = 'info') => {
    console.log(
      `${level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '🤖'} ${message}`
    );
    if (progressCallback) {
      progressCallback({
        type: 'log',
        level,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  };

  // Initialize Google AI
  const google = createGoogleGenerativeAI({
    apiKey: LLM_MODEL_CONFIG.apiKey,
  });

  let streamingComplete = false;
  let convertedMarkdown = '';

  try {
    // Start AI operation with progress indicators
    logWithStreaming('Starting Markdown improvement with AI');

    const { textStream } = await streamText({
      model: google(LLM_MODEL_CONFIG.smallModel ?? 'gemini-2.5-flash'),
      temperature: 0.9,
      providerOptions: {
        google: {
          thinkingConfig: {
            thinkingBudget: 1024,
          },
        },
      },
      prompt: generateMarkdownToMarkdownPrompt(userQuery, markdownContent),
      onFinish: result => {
        streamingComplete = true;
        convertedMarkdown = result.text ?? 'AI no data error';
      },
    });

    // Process the streaming response without showing text in CLI
    for await (const _ of textStream) {
      console.log('🤖 AI Analysis generating markdown response...');
    }

    while (!streamingComplete) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!streamingComplete) {
      logWithStreaming('AI streaming timeout, using partial result', 'warn');
    }

    if (!convertedMarkdown.trim()) {
      logWithStreaming('AI returned empty Markdown', 'error');
      return '';
    }

    // Complete the AI operation
    logWithStreaming(
      `Markdown improvement complete! Generated ${convertedMarkdown.length} characters`
    );

    return convertedMarkdown;
  } catch (error) {
    logWithStreaming(
      `AI Markdown improvement failed: ${error.message}`,
      'error'
    );

    await handleError(error, {
      operation: 'convertAndImproveMarkdown',
      markdownLength: markdownContent.length,
      userQuery: userQuery || 'none',
      modelUsed: LLM_MODEL_CONFIG.smallModel ?? 'gemini-2.5-flash',
    });

    // Return empty string if AI fails
    return '';
  }
}
