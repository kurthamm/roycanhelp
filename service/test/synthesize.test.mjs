import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findCardsMissingTakeaway } from '../synthesize.mjs';

test('findCardsMissingTakeaway: card with strong takeaway is not flagged', () => {
  const html = `
    <div class="lesson">
      <h3>Test Card</h3>
      <p>This is the body.</p>
      <p><strong>This is the takeaway.</strong></p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 0, 'Card with strong takeaway should not be flagged');
});

test('findCardsMissingTakeaway: card with plain text last paragraph is flagged', () => {
  const html = `
    <div class="lesson">
      <h3>Test Card</h3>
      <p>This is the body.</p>
      <p>This is plain text, not wrapped in strong.</p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 1, 'Card with plain text last paragraph should be flagged');
  assert.equal(result[0].heading, 'Test Card');
});

test('findCardsMissingTakeaway: card with single paragraph is flagged', () => {
  const html = `
    <div class="lesson">
      <h3>Single Para Card</h3>
      <p>Just one paragraph, not in strong.</p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 1, 'Card with single plain paragraph should be flagged');
  assert.equal(result[0].heading, 'Single Para Card');
});

test('findCardsMissingTakeaway: card with partial strong in last paragraph is flagged', () => {
  const html = `
    <div class="lesson">
      <h3>Partial Strong Card</h3>
      <p>Text with <strong>only partial</strong> strong wrapping.</p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 1, 'Card with partial strong wrapping should be flagged');
});

test('findCardsMissingTakeaway: card with strong containing links is not flagged', () => {
  const html = `
    <div class="lesson">
      <h3>Card with Link</h3>
      <p>Some body text.</p>
      <p><strong>Visit <a href="https://example.com">our site</a> for details.</strong></p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 0, 'Card with strong wrapping entire paragraph including links should not be flagged');
});

test('findCardsMissingTakeaway: multiple cards, mixed results', () => {
  const html = `
    <div class="lesson">
      <h3>Good Card</h3>
      <p>Body text.</p>
      <p><strong>Good takeaway.</strong></p>
    </div>
    <div class="lesson">
      <h3>Missing Takeaway 1</h3>
      <p>Body text.</p>
      <p>Plain text at end.</p>
    </div>
    <div class="lesson">
      <h3>Missing Takeaway 2</h3>
      <p>Single paragraph.</p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 2, 'Should find two cards with missing takeaways');
  assert.equal(result[0].heading, 'Missing Takeaway 1');
  assert.equal(result[1].heading, 'Missing Takeaway 2');
});

test('findCardsMissingTakeaway: handles HTML entities in heading', () => {
  const html = `
    <div class="lesson">
      <h3>Card with &quot;quotes&quot;</h3>
      <p>Body.</p>
      <p>Missing takeaway.</p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 1);
  assert(result[0].heading.includes('&quot;') || result[0].heading.includes('quote'));
});

test('findCardsMissingTakeaway: empty input returns empty array', () => {
  const html = '';
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 0);
});

test('findCardsMissingTakeaway: malformed input does not throw', () => {
  const html = '<div class="lesson"><h3>No close div';
  assert.doesNotThrow(() => {
    findCardsMissingTakeaway(html);
  });
});

test('findCardsMissingTakeaway: card with <em> in strong takeaway is not flagged', () => {
  const html = `
    <div class="lesson">
      <h3>Card with Emphasis</h3>
      <p>Body.</p>
      <p><strong>Do this <em>now</em> instead.</strong></p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 0, 'Strong tag wrapping entire paragraph with nested HTML should not be flagged');
});

test('findCardsMissingTakeaway: card with citation in paragraph before last is not confused', () => {
  const html = `
    <div class="lesson">
      <h3>Citation Card</h3>
      <p>Main content.</p>
      <p><em>Citation: some source</em></p>
      <p><strong>Takeaway.</strong></p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 0, 'Card should check only the last paragraph');
});

test('findCardsMissingTakeaway: indexing tracks multiple cards correctly', () => {
  const html = `
    <div class="lesson">
      <h3>Card 0</h3>
      <p><strong>Good.</strong></p>
    </div>
    <div class="lesson">
      <h3>Card 1</h3>
      <p>Missing.</p>
    </div>
    <div class="lesson">
      <h3>Card 2</h3>
      <p><strong>Good.</strong></p>
    </div>
  `;
  const result = findCardsMissingTakeaway(html);
  assert.equal(result.length, 1);
  assert.equal(result[0].heading, 'Card 1');
  assert.equal(result[0].index, 1);
});

test('a card using the label style takeaway is not flagged', () => {
  const html = `<div class="lesson">
    <h3>I tried to keep a filing cabinet.</h3>
    <p><strong>What happened:</strong> It became a storage unit.</p>
    <p><strong>Do this instead:</strong> Scan everything to a cloud folder.</p>
  </div>`;
  assert.deepEqual(findCardsMissingTakeaway(html), []);
});

test('a card ending in a plain citation line is flagged', () => {
  const html = `<div class="lesson">
    <h3>Something</h3>
    <p><strong>Do this instead:</strong> Ask in writing.</p>
    <p>Citation: 34 CFR 300.301</p>
  </div>`;
  const found = findCardsMissingTakeaway(html);
  assert.equal(found.length, 1);
});
