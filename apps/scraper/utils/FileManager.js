import fs from 'fs/promises';
import path from 'path';
import { handleError } from './GlobalErrorHandler.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Save content to a file
 * @param {string} content - The content to save
 * @param {string} filename - The filename to save as
 * @returns {Promise<boolean>} Success status
 */
export async function saveToFile(content, filename) {
  try {
    // Always use the repository root directory
    const outputDir = path.join(__dirname, '../../../');

    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, content);
    return true;
  } catch (error) {
    await handleError(error, {
      operation: 'saveToFile',
      filename,
      outputDir: 'root directory',
      contentLength: content ? content.length : 0,
    });
    return false;
  }
}
