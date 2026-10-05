import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { voiceCheck } from '../voice-check.mjs';

const site = html => { const d = mkdtempSync(join(tmpdir(), 'voice-')); writeFileSync(join(d, 'a.html'), html); return d; };

test('clean text passes, including words that only contain a rule word', () => {
  assert.deepEqual(voiceCheck(site('<p>A child with autism, a skidding car, and a kidney.</p>')), []);
});

test('each of Roy\'s rules is caught', () => {
  const msgs = voiceCheck(site('<p>The kid is an autistic child. Inspiration porn is bad — really. That is crap.</p>')).join('\n');
  assert.match(msgs, /never use the word "kid"/);
  assert.match(msgs, /people-first/);
  assert.match(msgs, /"porn"/);
  assert.match(msgs, /em dashes/);
  assert.match(msgs, /clean language/);
});

test('markup, scripts and attributes are not scanned', () => {
  assert.deepEqual(voiceCheck(site('<script>var kid = 1;</script><a class="kid" href="kids.html">child</a>')), []);
});

test('mild put-downs and anything close to abortion are caught', () => {
  const msgs = voiceCheck(site('<p>What a stupid idea. A hell of a mess. The abortion debate. Prenatal testing results.</p>')).join('\n');
  assert.match(msgs, /mild put-downs/);
  assert.match(msgs, /clean language/);
  assert.match(msgs, /close to abortion/);
});

test('ordinary words that contain a rule word are fine', () => {
  assert.deepEqual(voiceCheck(site('<p>Hello. The class passed the test. A shellfish allergy, a hellenic course, an assessment.</p>')), []);
});
