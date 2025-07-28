import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeFormat from 'rehype-format';
import rehypeStringify from 'rehype-stringify';
import rehypeRemark from 'rehype-remark';
import rehypeHighlight from 'rehype-highlight';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';

/**
 * Convert HTML to Markdown
 * @param {string} htmlContent - The HTML content to convert
 * @returns {Promise<string>} - The converted markdown content
 */
export async function convertToMarkdown(htmlContent) {
  const markdownProcessor = await unified()
    .use(rehypeParse, { fragment: false })
    .use(rehypeRemark)
    .use(rehypeHighlight, {
      detect: true,
    })
    .use(remarkGfm) // Add GitHub Flavored Markdown support (tables, strikethrough, etc.)
    .use(remarkStringify, {
      bullet: '-',
      fences: true,
      incrementListMarker: false,
      emphasis: '_',
      strong: '*',
    })
    .process(htmlContent);

  return markdownProcessor.toString();
}

/**
 * Fix and format HTML
 * @param {string} htmlContent - The HTML content to fix and format
 * @returns {Promise<string>} - The fixed and formatted HTML content
 */
export async function fixAndFormatHTML(htmlContent) {
  const htmlProcessor = await unified()
    .use(rehypeParse, { fragment: false })
    .use(rehypeFormat)
    .use(rehypeStringify)
    .process(htmlContent);

  return htmlProcessor.toString();
}
