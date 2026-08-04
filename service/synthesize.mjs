import { readFileSync, writeFileSync } from 'node:fs';
import { runDraftTurn } from './agent.mjs';
import { commitAll } from './gitops.mjs';

/**
 * Find all lesson cards whose final paragraph is NOT wrapped in <strong>.
 * A valid takeaway is the final <p> child of a lesson card where its entire
 * content is wrapped in <strong> tags.
 *
 * @param {string} html - The HTML content of roys-wisdom.html
 * @returns {Array<{heading: string, cardHtml: string, index: number}>}
 */
export function findCardsMissingTakeaway(html) {
  const lessonRegex = /<div class="lesson">([\s\S]*?)<\/div>/g;
  const cards = [];
  let match;
  let cardIndex = 0;

  while ((match = lessonRegex.exec(html)) !== null) {
    const cardHtml = match[1];
    const headingMatch = cardHtml.match(/<h3>([\s\S]*?)<\/h3>/);
    const heading = headingMatch ? headingMatch[1] : '';

    // Find all <p> tags in order
    const paragraphRegex = /<p>([\s\S]*?)<\/p>/g;
    let lastParagraph = null;
    let paraMatch;

    while ((paraMatch = paragraphRegex.exec(cardHtml)) !== null) {
      lastParagraph = paraMatch[1];
    }

    // Check if the last paragraph is a single <strong> wrapping the entire content
    // Valid: <p><strong>text</strong></p> or <p><strong>text with <a> links</strong></p>
    // Invalid: <p>text</p>, <p>text<strong>partial</strong></p>, <p><strong>partial</strong> text</p>
    if (lastParagraph !== null) {
      const trimmed = lastParagraph.trim();
      const isFullyWrapped = /^<strong>[\s\S]*<\/strong>$/.test(trimmed);

      if (!isFullyWrapped) {
        cards.push({
          heading,
          cardHtml: match[0],
          index: cardIndex,
        });
      }
    } else {
      // No paragraphs at all: card is malformed
      cards.push({
        heading,
        cardHtml: match[0],
        index: cardIndex,
      });
    }

    cardIndex++;
  }

  return cards;
}

/**
 * Escape HTML entities for safe insertion into HTML.
 */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strip conversational wrapper from draft output.
 * Reuses the pattern from server.mjs.
 */
function stripDraftChatter(text) {
  let out = (text || '').trim();
  const lead = /^(here'?s?|here is)\b[^\n]*:\s*$/i;
  const trail = /^(say the word|let me know|tell me which|want me to|i can publish|shall i)\b/i;
  let lines = out.split('\n');
  while (lines.length && (lines[0].trim() === '' || lines[0].trim() === '---' || lead.test(lines[0].trim()))) {
    lines.shift();
  }
  while (lines.length && (lines[lines.length - 1].trim() === '' || lines[lines.length - 1].trim() === '---' || trail.test(lines[lines.length - 1].trim()))) {
    lines.pop();
  }
  return lines.join('\n').trim();
}

/**
 * Insert a takeaway into a lesson card.
 * Appends <p><strong>takeaway</strong></p> as the last child before closing </div>.
 * Preserves indentation style (2 spaces, consistent with the file).
 */
function insertTakeaway(cardHtml, takeaway) {
  // Find the closing </div> and insert before it
  const escapedTakeaway = escapeHtml(takeaway);
  const insertion = `\n          <p><strong>${escapedTakeaway}</strong></p>`;
  return cardHtml.replace('</div>', insertion + '\n        </div>');
}

async function main() {
  const env = process.env;
  const required = ['SITE_DIR', 'SITE_REPO_DIR', 'ANTHROPIC_API_KEY'];
  const missing = required.filter(k => !env[k]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const siteDir = env.SITE_DIR;
  const repoDir = env.SITE_REPO_DIR;
  const wisdomPath = `${siteDir}/roys-wisdom.html`;

  // Read the wisdom file
  let wisdomContent;
  try {
    wisdomContent = readFileSync(wisdomPath, 'utf8');
  } catch (err) {
    console.error(`Failed to read ${wisdomPath}: ${err.message}`);
    process.exit(1);
  }

  // Find cards missing takeaways
  const missingCards = findCardsMissingTakeaway(wisdomContent);

  if (missingCards.length === 0) {
    console.log('nothing to sweep');
    return;
  }

  // Process each missing card
  const results = [];
  for (const card of missingCards) {
    try {
      // Strip HTML tags from heading for display
      const headingText = card.heading
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');

      // Extract existing paragraphs from the card for context
      const paraRegex = /<p>([\s\S]*?)<\/p>/g;
      const paragraphs = [];
      let paraMatch;
      while ((paraMatch = paraRegex.exec(card.cardHtml)) !== null) {
        paragraphs.push(paraMatch[1]);
      }

      // Build the prompt for the draft turn
      const draftPrompt = `This is a lesson card from roycanhelp.org about parenting children with disabilities.

Card heading: ${headingText}

Existing content:
${paragraphs.map(p => p.replace(/<[^>]+>/g, '')).join('\n\n')}

Generate ONE sentence in Roy's voice - a concrete, actionable "do this instead" takeaway. The sentence should be direct advice, not preamble. Output ONLY the sentence.`;

      // Call runDraftTurn (read-only)
      let draftOutput = '';
      const { summary } = await runDraftTurn({
        message: draftPrompt,
        siteDir,
        onText: (text) => {
          draftOutput += text;
        },
      });

      const takeaway = stripDraftChatter(draftOutput || summary || '');

      if (!takeaway) {
        console.error(`Failed to generate takeaway for: ${headingText}`);
        process.exit(1);
      }

      // Update the card in the wisdom content
      const updatedCard = insertTakeaway(card.cardHtml, takeaway);
      wisdomContent = wisdomContent.replace(card.cardHtml, updatedCard);

      results.push({
        heading: headingText,
        takeaway,
      });
    } catch (err) {
      console.error(`Error processing card "${card.heading}": ${err.message}`);
      process.exit(1);
    }
  }

  // Write the updated wisdom file
  try {
    writeFileSync(wisdomPath, wisdomContent);
  } catch (err) {
    console.error(`Failed to write ${wisdomPath}: ${err.message}`);
    process.exit(1);
  }

  // Commit the changes
  const commitHash = await commitAll(repoDir, 'Roy: added missing takeaway lines');

  if (!commitHash) {
    console.error('Sweep completed but no changes were committed');
    process.exit(1);
  }

  console.log(`Completed: ${results.length} card(s) updated`);
  for (const result of results) {
    console.log(`  - ${result.heading}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
