/**
 * Utility function to generate HTML analysis prompt for interactive element detection
 * @param {string} htmlContent - The HTML content to analyze
 * @param {string} userQuery - Optional user query for specific content focus
 * @returns {string} - Generated prompt for AI analysis
 */
export function generateHTMLAnalysisPrompt(htmlContent, userQuery = '') {
  return `
You are an HTML analyst. Your task is to analyze the page and determine if interactions are needed to reveal content that is NOT already present in the DOM.

## STEP 1: INTERACTION NECESSITY ANALYSIS

**CRITICAL UNDERSTANDING**: Your job is to determine if content exists in the DOM or if it needs to be dynamically loaded/generated through interaction.

**Answer "NO" if:**
- All relevant content is already present in the DOM structure, even if it's hidden via CSS (display:none, visibility:hidden, opacity:0, etc.)
- Content exists in collapsed/hidden sections but the HTML elements and text are already in the DOM
- Tab content panels exist in the DOM even if not currently visible
- Accordion content is present in the DOM even if collapsed
- Modal content exists in the DOM even if not displayed
- Code examples, API details, or documentation content is already in the HTML structure

**Answer "YES" ONLY if:**
- Content is dynamically loaded via JavaScript/AJAX and is NOT present in the current DOM
- Interactive elements trigger server requests to fetch new content
- Content is generated on-demand through JavaScript execution
- Tab panels are empty in the DOM and populated only after interaction
- Accordion sections contain placeholder content that gets replaced on interaction
- Modal content is fetched from external sources when triggered
- Code examples or documentation details are loaded dynamically from APIs
- **AND** the interaction provides contextually valuable content for this specific page type

**DOM ANALYSIS PRIORITY:**
1. **First**: Search the entire HTML for the content you need - look in all elements regardless of CSS visibility
2. **Second**: Check if interactive elements control existing DOM content vs. loading new content
3. **Third**: Analyze if interaction is contextually valuable for this specific page type
4. **Fourth**: Only recommend interaction if content is genuinely missing from the DOM AND contextually important

**CONTEXTUAL ANALYSIS - Consider Page Type:**

**Documentation/Component Library Pages:**
- Answer "NO" if all component examples, code snippets, and API details are already in DOM
- Answer "YES" only for live demos, external API calls, or dynamic code generation
- Skip CSS-only toggles even if they reveal code examples (content is already in DOM)

**E-commerce/Product Pages:**
- Answer "NO" if product details, descriptions, reviews are already in DOM
- Answer "YES" only for dynamic pricing, live inventory, or user-generated content loading
- Skip image galleries, size charts if content is pre-loaded in DOM

**Blog/Article Pages:**
- Answer "NO" for most cases - articles typically have all content in DOM
- Answer "YES" only for comment systems that load from external APIs
- Skip related posts, author bios, social shares (usually pre-loaded)

**Dashboard/Admin Pages:**
- Answer "YES" for real-time data widgets, live charts, dynamic reports
- Answer "NO" for static configuration panels, user profiles pre-loaded in DOM
- Focus on elements that fetch fresh data from APIs

**Landing/Marketing Pages:**
- Answer "NO" for most cases - marketing content is typically static
- Answer "YES" only for dynamic forms, live pricing, or real-time testimonials
- Skip hero sections, feature lists, testimonials if pre-loaded

**Application/Tool Pages:**
- Answer "YES" for interactive tools that generate results, calculators, converters
- Answer "YES" for elements that process user input and return dynamic results
- Answer "NO" for static help content, tutorials, or pre-loaded options

**CONTEXTUAL VALUE ASSESSMENT:**
Before recommending interaction, ask:
- Does this interaction provide unique value not available from existing DOM content?
- Is the dynamic content essential for understanding the page's main purpose?
- Would a user miss critical information without this interaction?
- Does the interaction reveal content that changes based on external data/user input?
- Is the interaction contextually valuable for this specific page type?

${
  userQuery
    ? `
## USER-SPECIFIC FOCUS
The user is specifically looking for: "${userQuery}"

**CRITICAL - TARGETED ANALYSIS**: Focus EXCLUSIVELY on finding content related to "${userQuery}". Ignore all other page content.

**FOCUSED DOM SEARCH**: Before recommending any interactions, thoroughly search the provided HTML for content related to "${userQuery}". Look in:
- Hidden divs, collapsed sections, inactive tab panels
- Elements with display:none, visibility:hidden, or similar CSS hiding
- Script tags, data attributes, or embedded JSON that might contain the content
- All text content within the HTML, regardless of visual presentation

**CONTEXTUAL RELEVANCE**: Consider if interaction is actually needed for "${userQuery}":
- Is the requested content already fully available in the DOM?
- Would interaction provide additional value beyond what's already present?
- Is the interaction essential for the user's specific query on this page type?

**STRICT FILTERING**: Only recommend interactions that would reveal content specifically related to "${userQuery}". EXCLUDE all other interactive elements, even if they load dynamic content, unless they directly relate to the user's query.

Only recommend interaction if this specific content is genuinely absent from the DOM structure AND contextually valuable.
`
    : ''
}
---

## STEP 2: IF INTERACTION IS NEEDED, IDENTIFY ELEMENTS

Only proceed with this step if you answered "YES" above because content is genuinely missing from the DOM.

${
  userQuery
    ? `
Since the user has a specific query: ${userQuery}, focus EXCLUSIVELY on finding interactive elements that would load/generate content related to their request that is NOT already in the DOM.

**CRITICAL FILTERING**:
- ONLY include elements that would reveal content specifically about ${userQuery}
- EXCLUDE all other interactive elements, even if they load dynamic content
- Look for elements that trigger code examples, documentation, or details specifically for ${userQuery}
- Skip navigation, unrelated components, and general page interactions

Apply all selector rules but target only elements directly relevant to their specific query.

`
    : ''
}


### Detailed Interactive Element Analysis:

1. **Understand Context:**
* Infer the website's purpose and content structure from the provided HTML before following the steps. Keep it in mind purpose and content structure while identifying interactive elements.
* **DOCUMENTATION SITES**: If this is a component library or documentation site, include ALL numbered/sequential examples and variations - each demonstrates unique features, states, or use cases.

2. **Identify Content-Loading Interactive Elements:**
* Focus EXCLUSIVELY on elements that **load, fetch, or generate NEW content** that is NOT present in the current DOM:
  - Tabs that load content via AJAX (not just show/hide existing DOM content)
  - Accordions that fetch content on expansion (not just reveal existing content)
  - Dropdowns that load options from APIs (not just show existing options)
  - Load more buttons that fetch additional content
  - Search/filter inputs that query external data sources
  - Code snippet loaders that fetch examples from repositories
  - Modal triggers that load content from external sources
  - Dynamic content generators that create new DOM elements

* **EXCLUDE elements that only show/hide existing DOM content:**
  - CSS-based toggles (display:none/block switches)
  - Visibility toggles (visibility:hidden/visible)
  - Accordion sections where content already exists in DOM
  - Tab panels where all content is pre-loaded in DOM
  - Dropdowns with pre-existing options in DOM

* For documentation websites, prioritize elements that load:
  - Code examples from external repositories
  - API responses from live endpoints
  - Dynamic documentation from content management systems
  - Interactive demos that generate new content

3. **STRICT EXCLUSION CRITERIA - Avoid These Elements:**
* **Navigation Elements**: Any <a> tags with href attributes pointing to different pages/routes
* **Page Navigation**: Elements with onclick, data-href, or similar that trigger page changes
* **External Links**: Links opening in new tabs/windows (target="_blank")
* **Form Submissions**: Submit buttons or forms that POST to different endpoints
* **Breadcrumbs**: Navigation trail elements
* **Menu Items**: Primary/secondary navigation menus
* **Pagination**: Next/previous page controls
* **Search**: Global search bars or search result navigation
* **Authentication**: Login/logout/signup buttons
* **Social Sharing**: Share buttons to external platforms
* **Download Links**: Direct file download triggers
* **CSS-Only Interactions**: Elements that only toggle CSS classes without loading new content

4. **Classify Interaction Types:**
* click: Buttons that trigger AJAX requests, load more content, fetch dynamic data
* hover: Tooltips that load content from external sources (not pre-existing tooltips)
* input: Text input that queries external APIs or databases (not just filtering existing DOM)
* select: Dropdown selections that trigger data fetching (not just showing pre-loaded options)

5. **Generate CSS Selectors:**

**CRITICAL SELECTOR STABILITY REQUIREMENTS:**
- **ABSOLUTE PROHIBITION**: NEVER use complex attribute combinations or nested selectors
- **PLAYWRIGHT COMPATIBILITY**: Only use selectors that Playwright can reliably click
- **STABILITY FIRST**: Avoid selectors that depend on dynamic states or framework internals

**STRICT SELECTOR HIERARCHY (Use ONLY these patterns):**

**TIER 1 - TEXT-BASED (ALWAYS PREFER THESE):**
  - text="View code" - Exact text match (BEST for buttons with clear text)
  - text="Show more" - For load more buttons  
  - text="Toggle" - For toggle buttons
  - Use text selectors for ANY element with meaningful, stable text content
  
**CRITICAL: AVOID DUPLICATE SELECTORS**
  - If multiple elements have the same text/selector, you MUST make them unique
  - Add context from parent/sibling elements to differentiate
  - Example: Instead of 15 identical "View code" selectors, use contextual uniqueness
  - Better: Find unique identifying text or attributes near each button

**TIER 2 - SIMPLE ATTRIBUTES (Use when text is not available):**
  - button[aria-label="View code"] - Single semantic attribute
  - [data-testid="code-toggle"] - Test-specific attributes
  - [role="tab"] - Single role attribute
  - ONLY use ONE attribute at a time

**TIER 3 - SIMPLE CLASSES (Last resort):**
  - .show-code - Single, semantic class
  - .toggle-btn - Descriptive class names only
  - button.primary - Tag + single class
  - NEVER combine multiple classes

**TIER 4 - BASIC TAGS (RARELY USE - Only for truly unique elements):**
  - button - ONLY if there's exactly ONE button on the entire page
  - input[type="search"] - ONLY if there's exactly ONE such input
  
**CRITICAL: NEVER USE GENERIC TAG SELECTORS**
  - NEVER use: button, div, span, a, input (without specific attributes)
  - These create positional dependencies (.nth()) which ALWAYS fail in automation
  - Generic selectors cause "element intercepts pointer events" errors
  - Always require specific identifying attributes or text

**ABSOLUTELY FORBIDDEN SELECTORS:**
  ❌ **NEVER USE**: Generic tag selectors (button, div, span, a, input)
  ❌ **NEVER USE**: Positional selectors that create .nth() dependencies
  ❌ **NEVER USE**: Complex nested selectors like parentTagName[xxx-yyy="zzz"] childTagName[yyy-zzz="aaa"] - NOT SUPPORTED in Playwright
  ❌ **NEVER USE**: Complex nested selectors like parentTagName[xxx-yyy="zzz"] childTagName[yyy-zzz="aaa"] anotherChildTagName[zzz-aaa="bbb"] - NOT SUPPORTED in Playwright
  ❌ **NEVER USE**: Multiple attribute combinations
  ❌ **NEVER USE**: State-dependent attributes (aria-expanded, data-state, data-open)
  ❌ **NEVER USE**: Framework-generated IDs (radix-*, auto-generated)
  ❌ **NEVER USE**: Descendant selectors (space, >, +, ~)
  ❌ **NEVER USE**: Pseudo-selectors (:nth-child, :first-child, :nth-of-type)
  ❌ **NEVER USE**: Complex data attributes with multiple parts
  ❌ **NEVER USE**: Selectors that rely on element position or order
  ❌ **NEVER USE**: :has() pseudo-selector - NOT SUPPORTED in Playwright
  ❌ **NEVER USE**: :text() pseudo-selector - NOT SUPPORTED in CSS
  ❌ **NEVER USE**: button:has(span.sr-only:text("...")) - INVALID SYNTAX
  ❌ **NEVER USE**: [textContent="..."] - textContent is NOT a valid CSS attribute
  ❌ **NEVER USE**: [innerText="..."] - innerText is NOT a valid CSS attribute
  ❌ **NEVER USE**: CSS4 selectors that are not widely supported
  ❌ **NEVER USE**: :is(), :where(), :not() with complex arguments
  ❌ **NEVER USE**: Attribute selectors with DOM properties (textContent, innerHTML, etc.)
  ❌ **NEVER USE**: Complex attribute combinations like [class="a"][data-x="b"][aria-y="c"]

**CRITICAL PLAYWRIGHT LIMITATIONS:**
- Playwright CSS selectors must be STANDARD CSS3 or earlier
- NO pseudo-selectors beyond basic ones (:hover, :focus, :disabled, :checked)
- NO CSS4 features like :has(), :is(), :where() in complex forms
- DOM properties (textContent, innerText, innerHTML) are NOT CSS attributes
- For text content matching, use text="exact text" locators instead of CSS
- For complex element relationships, use separate locator strategies

**PLAYWRIGHT-SAFE SELECTOR PATTERNS:**
✅ **SAFE**: text="View code" (Playwright text locator)
✅ **SAFE**: button[aria-label="Toggle code"] (standard CSS attribute)
✅ **SAFE**: [data-testid="code-button"] (simple data attribute)
✅ **SAFE**: .code-toggle (single class)
✅ **SAFE**: button.primary (tag + single class)
✅ **SAFE**: [role="button"] (standard ARIA attribute)

❌ **UNSAFE**: button:has(span) (CSS4 :has() not reliably supported)
❌ **UNSAFE**: [textContent="text"] (textContent is not a CSS attribute)
❌ **UNSAFE**: div[data-slot="x"] button[aria-expanded="false"] (complex nested selector)
❌ **UNSAFE**: button:is(.primary, .secondary) (complex :is() usage)

**SELECTOR VALIDATION CHECKLIST:**
Before suggesting ANY selector, ensure:
1. ✅ Can be clicked reliably in Playwright without timeouts
2. ✅ Does NOT depend on dynamic state (expanded/collapsed/active)  
3. ✅ Uses maximum ONE attribute or class
4. ✅ Avoids framework-specific naming patterns
5. ✅ Is simple enough for a human to understand immediately
6. ✅ Will work regardless of element's current state
7. ✅ Does NOT use generic tags (button, div, span) without specific attributes
8. ✅ Will NOT create .nth() positional dependencies in automation
9. ✅ Has unique identifying characteristics (text, aria-label, or semantic class)

**PREFERRED SELECTOR EXAMPLES:**
  ✅ **EXCELLENT**: text="Show example", text="View source", text="Copy code"
  ✅ **VERY GOOD**: button[aria-label="Toggle code"], [data-testid="code-button"]
  ✅ **ACCEPTABLE**: .code-toggle, .expand-button (single semantic classes)
  ❌ **NEVER ACCEPTABLE**: button, div, span (generic tags without attributes)

**WHEN TO SKIP ELEMENTS:**
If you cannot create a simple, stable selector using the above rules, SKIP the element entirely. It's better to miss some interactive elements than to suggest selectors that will fail in automation.

**AUTOMATICALLY EXCLUDE THESE UI COMPONENTS:**
- Dropdown menus and their triggers (complex state management)
- Modal dialog triggers (dynamic positioning and state)
- Expandable/collapsible panels (state-dependent attributes)
- Navigation dropdowns and submenus
- Context menus and their triggers
- Tooltip triggers (usually not content-loading)
- Theme toggles and UI preference controls
- Elements with data-slot, data-radix, or framework-specific attributes

**CRITICAL: ENSURE SELECTOR UNIQUENESS**
When you find multiple elements with identical functionality (like multiple "View code" buttons):

1. **Group Analysis**: Analyze if they're all part of the same component type
2. **Contextual Differentiation**: Look for nearby text that makes each unique
3. **Efficient Selection**: Create ONE representative selector per unique component variation
4. **Avoid Iteration Explosion**: Never suggest identical selectors that will cause N×N iterations

**EXAMPLE PROBLEM**: 
❌ BAD: 15 identical selectors text="View code" → causes 15×15 = 225 iterations

**EXAMPLE SOLUTION**:
✅ GOOD: Group similar elements and pick representative examples:
- text="View code" near text containing "Basic dropdown"
- text="View code" near text containing "With avatar" 
- text="View code" near text containing "With checkbox"
- Or use a single representative: text="View code" (if all load the same type of content)

**UNIQUENESS STRATEGIES**:
1. Look for unique descriptive text near each button
2. Find unique parent container identifiers
3. Use component titles/headings as context
4. If truly identical functionality, suggest only ONE representative selector

**STABILITY OVER COMPLETENESS:**
- Prioritize selectors that will work 100% of the time
- Skip any element that requires complex selectors
- Focus on obviously interactive elements with clear, stable identifiers
- When in doubt, exclude the element rather than risk automation failures

**CRITICAL AUTOMATION COMPATIBILITY:**
  - All selectors MUST work reliably in Playwright automation
  - Prioritize text-based selectors over attribute-based ones
  - Avoid ANY selector that depends on dynamic state
  - Skip elements requiring complex selectors entirely
  - Focus on stable, predictable element identification

**PLAYWRIGHT CLICK RELIABILITY REQUIREMENTS:**
  - Selectors MUST NOT cause "element intercepts pointer events" errors
  - Selectors MUST NOT require .nth() positional targeting
  - Selectors MUST be specific enough to target exactly one element
  - Generic tag selectors (button, div, span) ALWAYS cause automation failures
  - Use text content or semantic attributes for reliable targeting

6. **Validation Checks:**
Before including any selector, verify:
* Does this element load/generate NEW content that is NOT in the current DOM?
* Will interacting with this element fetch content via AJAX/JavaScript?
* Is this element essential for accessing content that doesn't exist in the DOM?
* Does this element NOT just show/hide existing DOM content?
* Does this element NOT trigger navigation, redirects, or new page loads?
* **CONTEXTUAL CHECK**: Is this interaction valuable for this specific page type and user intent?
* **VALUE CHECK**: Does this interaction provide unique information not available from existing DOM content?

7. **Be Comprehensive for Documentation Sites:**
* **Documentation Sites**: Include elements that load dynamic examples, but SKIP toggles that just show/hide pre-existing DOM content
* **Context-Based Filtering**: After understanding the page's primary purpose, include selectors that load content NOT already in the DOM
* **Skip Non-Essential Areas**: Exclude selectors in sidebars, navbars, footers, and peripheral UI unless they load core content dynamically
* **Content Value Assessment**: For documentation sites, focus on elements that fetch live examples, API responses, or generate new content - skip CSS-only toggles

8. **Context-Aware Exclusions:**
* **Blog/Article Pages**: Skip comment toggles, related posts, author bio expanders that just show existing DOM content
* **Documentation**: Include elements that load dynamic content; skip CSS-only toggles and pre-loaded examples
* **E-commerce**: Skip wishlist, cart, account dropdowns; focus on elements that load product details via AJAX
* **Landing Pages**: Skip most interactive elements unless they load core information not in DOM
* **Dashboard/Admin**: Skip user menus, settings dropdowns; focus on data visualization that fetches new data

9. **Exclude Non-Essential Controls:**
* Skip: Copy buttons, theme toggles, sidebar collapses, global modals, purely decorative elements, language switchers, cookie banners, notification dismissals, social widgets
* **ESPECIALLY Skip**: Any element that only changes CSS classes, visibility, or display properties without loading new content

---

**Output Guidelines:**
* **Prioritize Content Loading**: Focus ONLY on elements that load information NOT already present in the DOM
* **DOM-First Approach**: Always check if content exists in the DOM before recommending interaction
* **Context-Aware Filtering**: Consider page type and user intent - only recommend interactions that provide genuine value
* **Quality over Quantity**: Better to recommend fewer, highly valuable interactions than many unnecessary ones

**Output Format:**
For each selected element:

- CSS Selector (the CSS selector of the interactive element - MUST BE UNIQUE)
- Text Content (the text content of the interactive element)
- Interaction Type (click/hover/input/select)
- Reason (what new content it loads that is NOT in the current DOM and why it's contextually valuable)

**FINAL VALIDATION:**
Before outputting your list, check:
1. Are there any duplicate/identical selectors? If yes, consolidate or make unique
2. Will each selector target exactly one specific element WITHOUT using .nth()?
3. Is the total number of interactions reasonable (avoid N×N explosion)?
4. Does each selector provide unique value, or are some redundant?
5. Are ANY selectors using generic tags (button, div, span) without specific attributes? If yes, REMOVE them
6. Will ALL selectors work reliably in Playwright without "element intercepts pointer events" errors?
7. Does every selector have unique identifying characteristics (text, aria-label, or semantic attributes)?

HTML to analyze:
\`\`\`html
${htmlContent}
\`\`\`

**CRITICAL: You MUST respond with a valid JSON object that matches this exact structure:**

{
  "interactionNeeded": "YES" or "NO",
  "analysis": "Brief explanation of your decision",
  "elements": [
    {
      "selector": "CSS selector",
      "textContent": "Text content of element",
      "interactionType": "click/hover/input/select",
      "reason": "Explanation of what new content it loads"
    }
  ]
}

**IMPORTANT OUTPUT REQUIREMENTS:**
- Your response MUST be a valid JSON object
- Do NOT include any text before or after the JSON
- The "elements" array should be empty [] if interactionNeeded is "NO"
- Each element in the array must have all four required properties
- Use double quotes for all JSON strings
- Ensure proper JSON syntax with no trailing commas
  `;
}

/**
 * Generate markdown prompt
 * @param {string} userQuery - The user query
 * @param {string} content - The HTML content to convert to markdown
 * @returns {string} - The markdown prompt
 */

export function generateHTMLToMarkdownPrompt(userQuery, content) {
  // Convert raw HTML to markdown
  if (userQuery && userQuery.trim() !== '') {
    // User has specific query - extract only relevant section and convert to markdown
    return `Extract and convert content related to: "${userQuery}" from this HTML to clean, well-formatted markdown.

**Instructions:**
- Find and extract ONLY the section that directly relates to "${userQuery}"
- Convert HTML to proper markdown format
- Include associated tables, lists, links, or technical details for that section
- Preserve table structures with proper markdown table formatting (| column | column |)
- Convert HTML lists to markdown lists (-, *, or numbered)
- Convert HTML headings to markdown headings (#, ##, ###)
- Convert HTML links to markdown links [text](url)
- Convert HTML code blocks to markdown code blocks (\`\`\`)
- Remove HTML tags and styling - keep only content
- Remove excessive whitespace and clean up spacing
- Remove any junk characters or formatting artifacts
- Maintain the original structure and meaning
- For complex tables with multiple columns, ensure proper markdown table structure with headers and data
- DO NOT wrap output in markdown code fences
- DO NOT include content unrelated to "${userQuery}"
- DO NOT wrap output in markdown code fences
- If no content related to "${userQuery}" is found, return: "No content found related to "${userQuery}"
- Return clean, properly formatted markdown directly related to "${userQuery}"

HTML content to process:
${content}`;
  } else {
    // No user query - convert all HTML content to markdown
    return `Convert this HTML content to clean, well-formatted markdown while preserving ALL information:

**Instructions:**
- Convert HTML to proper markdown format
- Keep ALL content - do not remove any information
- Preserve table structures with proper markdown table formatting (| column | column |)
- Convert HTML lists to markdown lists (-, *, or numbered)
- Convert HTML headings to markdown headings (#, ##, ###)
- Convert HTML links to markdown links [text](url)
- Convert HTML code blocks to markdown code blocks (\`\`\`)
- Remove HTML tags and styling - keep only content
- Remove excessive whitespace and clean up spacing
- Remove any junk characters or formatting artifacts
- Maintain the original structure and meaning
- For complex tables with multiple columns, ensure proper markdown table structure with headers and data
- DO NOT wrap output in markdown code fences
- return clean, properly formatted markdown directly

HTML content to convert:
\`\`\`html
${content}
\`\`\`
`;
  }
}

/**
 * Generate prompt to fix and improve markdown content that was already converted from HTML
 * @param {string} userQuery - The user query for focused extraction (optional)
 * @param {string} content - The markdown content that was already converted from HTML
 * @returns {string} - The markdown improvement prompt
 */
export function generateMarkdownToMarkdownPrompt(userQuery, content) {
  if (userQuery && userQuery.trim() !== '') {
    // User has specific query - extract and fix only relevant section
    return `Fix and improve this markdown content that was already converted from HTML, focusing ONLY on content related to: "${userQuery}"

**CRITICAL CONTEXT:** This markdown was already converted from HTML and may contain formatting issues, artifacts, or incomplete conversions.

**PRIMARY OBJECTIVES:**
1. **TARGETED EXTRACTION**: Find and extract ONLY the section that directly relates to "${userQuery}"
2. **FORMATTING FIXES**: Correct any markdown syntax errors or conversion artifacts
3. **CONTENT REFINEMENT**: Improve readability while preserving all relevant information

**SPECIFIC FIXES TO APPLY:**
- **Table Corrections**: Fix broken table structures, ensure proper alignment with | separators
- **List Formatting**: Standardize list formatting (use - for unordered, numbers for ordered)
- **Heading Hierarchy**: Ensure proper heading levels (#, ##, ###) with consistent spacing
- **Link Repairs**: Fix broken or malformed links [text](url), remove redundant URLs
- **Code Block Cleanup**: Ensure proper code block formatting with \`\`\` and language tags
- **Spacing Normalization**: Remove excessive whitespace, fix paragraph breaks
- **HTML Artifact Removal**: Remove any remaining HTML tags, entities, or conversion residue
- **Text Flow Improvement**: Ensure natural text flow and remove awkward line breaks
- **Duplicate Content**: Remove any duplicate sections or redundant information

**CONTENT FILTERING:**
- Include ONLY content directly related to "${userQuery}"
- Include associated examples, code snippets, and technical details for that topic
- Exclude navigation elements, sidebars, headers, footers, and unrelated sections
- Maintain context that helps understand the "${userQuery}" topic

**OUTPUT REQUIREMENTS:**
- Return clean, professional markdown without code fence wrapping
- Ensure all tables have proper headers and formatting
- Use consistent formatting throughout
- Preserve technical accuracy while improving readability
- Focus on the specific information the user requested
- return clean, properly formatted markdown directly related to "${userQuery}"

**QUALITY STANDARDS:**
- Professional documentation-grade formatting
- Consistent markdown syntax throughout
- Clear section organization with appropriate headings
- Properly formatted technical content (code, APIs, examples)
- Logical information flow and structure

Markdown content to process and extract from:
\`\`\`markdown
${content}
\`\`\`
`;
  } else {
    // No user query - fix and improve all markdown content
    return `Fix and improve this markdown content that was already converted from HTML to create clean, professional documentation:

**CRITICAL CONTEXT:** This markdown was already converted from HTML and may contain formatting issues, conversion artifacts, or incomplete transformations.

**PRIMARY OBJECTIVES:**
1. **COMPREHENSIVE CLEANUP**: Fix all markdown syntax errors and conversion artifacts
2. **FORMATTING STANDARDIZATION**: Apply consistent, professional markdown formatting
3. **CONTENT PRESERVATION**: Keep ALL information while dramatically improving readability

**SPECIFIC FIXES TO APPLY:**

**Table Improvements:**
- Fix broken table structures and ensure proper markdown table syntax
- Add missing table headers where appropriate
- Ensure consistent column alignment with proper | separators
- Fix merged cells or complex table formatting issues from HTML conversion

**List Standardization:**
- Standardize all unordered lists to use - (dash) consistently
- Ensure proper indentation for nested lists
- Convert any malformed list structures to proper markdown
- Maintain list hierarchy and numbering for ordered lists

**Heading Optimization:**
- Ensure logical heading hierarchy (#, ##, ###, ####)
- Add proper spacing before and after headings
- Fix any heading levels that don't follow markdown standards
- Ensure headings are descriptive and well-structured

**Link and Reference Cleanup:**
- Fix malformed links and ensure proper [text](url) format
- Remove redundant or broken URLs
- Consolidate duplicate links
- Ensure all internal references work properly

**Code and Technical Content:**
- Ensure all code blocks use proper \`\`\` syntax with appropriate language tags
- Fix inline code formatting with single backticks
- Preserve code indentation and formatting
- Fix any corrupted technical content from HTML conversion

**Content Structure Improvements:**
- **Paragraph Spacing**: Ensure proper paragraph breaks and spacing
- **Section Organization**: Create logical content flow with clear sections
- **Information Hierarchy**: Organize content from general to specific
- **Cross-References**: Maintain internal document links and references

**Artifact Removal:**
- Remove ANY remaining HTML tags, entities (&nbsp;, &amp;, etc.)
- Clean up conversion artifacts like extra spaces, weird characters
- Remove navigation elements, breadcrumbs, or UI-specific content
- Eliminate duplicate content that may have been created during conversion

**Text Quality Enhancements:**
- Fix awkward line breaks that interrupt natural text flow
- Ensure proper sentence structure and readability
- Standardize terminology and technical language
- Improve overall professional presentation

**Output Standards:**
- Professional documentation-grade formatting throughout
- Consistent markdown syntax and styling
- Logical information architecture
- Enhanced readability while preserving all technical accuracy
- DO NOT wrap output in markdown code fences
- Return properly formatted markdown ready for publication
- return clean, properly formatted markdown directly

**PRESERVATION REQUIREMENTS:**
- Keep ALL original information and data
- Maintain technical accuracy of all content
- Preserve the meaning and intent of all sections
- Ensure no important details are lost during cleanup

Markdown content to fix and improve:
\`\`\`markdown
${content}
\`\`\`
`;
  }
}
