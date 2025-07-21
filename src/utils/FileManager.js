import fs from 'fs/promises';
import path from 'path';
import { OUTPUT_DIR } from '../../config.js';
import { handleError } from './GlobalErrorHandler.js';

/**
 * Save content to a file
 * @param {string} content - The content to save
 * @param {string} filename - The filename to save as
 * @returns {Promise<boolean>} Success status
 */
export async function saveToFile(content, filename) {
  try {
    // Create output directory if it doesn't exist
    if (OUTPUT_DIR) {
      await fs.mkdir(OUTPUT_DIR, { recursive: true });
    }

    const outputPath = OUTPUT_DIR ? path.join(OUTPUT_DIR, filename) : filename;
    await fs.writeFile(outputPath, content);
    return true;
  } catch (error) {
    await handleError(error, {
      operation: 'saveToFile',
      filename,
      outputDir: OUTPUT_DIR || 'current directory',
      contentLength: content ? content.length : 0,
    });
    return false;
  }
}
