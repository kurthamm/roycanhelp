import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addAnchors, faqEntries, applyStructuredData } from '../structured-data.mjs';

const PAGE = `<html><head><title>Roy's Wisdom | Roy Can Help</title><meta name="description" content="Hard-won advice."></head><body><h1>Roy's Wisdom</h1>
<div class="lesson"><h3>Do I need a referral?</h3><p>No, you can refer your own child.</p><p><em>Citation: SC</em></p></div>
<div class="lesson"><h3>I lost the paperwork.</h3><p>It happens.</p></div></body></html>`;

test('anchors are added once and are unique', () => {
  const once = addAnchors(addAnchors(PAGE.replace('I lost the paperwork.', 'Do I need a referral?')));
  assert.equal((once.match(/id="do-i-need-a-referral"/g) ?? []).length, 1);
  assert.match(once, /id="do-i-need-a-referral-2"/);
});

test('only question-shaped lessons become FAQ entries, without citations', () => {
  const faq = faqEntries(PAGE);
  assert.equal(faq.length, 1);
  assert.equal(faq[0].acceptedAnswer.text, 'No, you can refer your own child.');
});

test('applying twice gives the same page and valid JSON-LD', () => {
  const once = applyStructuredData('roys-wisdom.html', PAGE, '2026-10-01');
  const twice = applyStructuredData('roys-wisdom.html', once, '2026-10-01');
  assert.equal(once, twice);
  for (const m of once.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)) JSON.parse(m[1]);
  assert.match(once, /"@type":"FAQPage"/);
  assert.doesNotMatch(once, /Kurt/);
});
