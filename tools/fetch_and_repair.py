#!/usr/bin/env python3
"""Fetch eCFR sections and repair quote/answer fields."""
import urllib.request
import html
import re

def fetch_section(title, sec):
    """Fetch a CFR section and return normalized text."""
    part = sec.split('.')[0]
    url = f'https://www.ecfr.gov/api/renderer/v1/content/enhanced/current/title-{title}?part={part}&section={sec}'
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req, timeout=30)
        text = response.read().decode()
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', text)
        # Decode HTML entities
        text = html.unescape(text)
        return text
    except Exception as e:
        print(f"Error fetching {sec}: {e}")
        return ""

def extract_sentences(text):
    """Extract sentences from text."""
    # Split on sentence boundaries
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

def find_matching_text(text, keywords):
    """Find sentences containing the keywords."""
    sentences = extract_sentences(text)
    results = []
    for sentence in sentences:
        if all(kw.lower() in sentence.lower() for kw in keywords):
            results.append(sentence)
    return results

if __name__ == '__main__':
    # Test with a section
    text = fetch_section(34, '300.301')
    print("Sample text length:", len(text))
    print("First 500 chars:", text[:500])
