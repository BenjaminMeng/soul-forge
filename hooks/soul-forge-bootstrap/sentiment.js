'use strict';

// ============================================================
// Soul Forge Sentiment Analysis — sentiment.js (CommonJS)
// Lightweight lexicon-based sentiment with negation window.
// Zero dependencies — pure Node.js builtins only.
// ============================================================

const path = require('path');
const fs = require('fs');

// --- Load dictionaries lazily (singleton) ---

let _zhDict = null;
let _enDict = null;

function loadDict(lang) {
  const dictPath = path.join(__dirname, 'sentiments', `${lang}.json`);
  try {
    const raw = fs.readFileSync(dictPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getZhDict() {
  if (!_zhDict) _zhDict = loadDict('zh');
  return _zhDict;
}

function getEnDict() {
  if (!_enDict) _enDict = loadDict('en');
  return _enDict;
}

// --- Chinese negation handling ---

// Full negation words (×-1): reverse polarity
const ZH_FULL_NEGATION = ['不', '没', '没有', '别', '无', '非', '未', '莫', '勿'];
// Degree negation words (×-0.5): soften polarity
const ZH_DEGREE_NEGATION = ['不是很', '不怎么', '不算太', '不太'];
// Window breakers: reset negation state
const ZH_BREAKERS = ['但', '但是', '不过', '然而', '可是', '却', '虽然'];

// Negation lookback window (characters before a sentiment word)
const ZH_NEGATION_WINDOW = 4;

/**
 * Check for Chinese negation preceding a sentiment word.
 * Returns a multiplier: 1 (no negation), -1 (full negation), -0.5 (degree negation)
 */
function zhCheckNegation(text, matchStart) {
  // Extract the window before the match
  const windowStart = Math.max(0, matchStart - ZH_NEGATION_WINDOW);
  const window = text.substring(windowStart, matchStart);

  // Check degree negation first (longer patterns take priority)
  for (const neg of ZH_DEGREE_NEGATION) {
    if (window.includes(neg)) {
      // Check for double negation: another negation before this degree negation
      const negIdx = window.indexOf(neg);
      const preWindow = window.substring(0, negIdx);
      for (const fullNeg of ZH_FULL_NEGATION) {
        if (preWindow.includes(fullNeg)) {
          return 1; // Double negation → positive
        }
      }
      return -0.5;
    }
  }

  // Collect all full negation positions in window
  const negPositions = [];
  for (const neg of ZH_FULL_NEGATION) {
    let searchFrom = 0;
    while (searchFrom < window.length) {
      const idx = window.indexOf(neg, searchFrom);
      if (idx === -1) break;
      negPositions.push({ idx, len: neg.length });
      searchFrom = idx + neg.length;
    }
  }

  if (negPositions.length === 0) return 1; // No negation

  // Deduplicate overlapping positions, count distinct negation instances
  negPositions.sort((a, b) => a.idx - b.idx);
  let distinctCount = 0;
  let lastEnd = -1;
  for (const pos of negPositions) {
    if (pos.idx >= lastEnd) {
      distinctCount++;
      lastEnd = pos.idx + pos.len;
    }
  }

  // Odd number of negations → negate; even → double negation (positive)
  return distinctCount % 2 === 0 ? 1 : -1;
}

/**
 * Analyze Chinese text using sliding window dictionary matching.
 * Matches 2-4 character tokens against the dictionary.
 */
function analyzeZh(text, dict) {
  let score = 0;
  let matchCount = 0;
  let i = 0;

  // Split by breaker words first to create segments
  let segments = [text];
  for (const breaker of ZH_BREAKERS) {
    const newSegments = [];
    for (const seg of segments) {
      const parts = seg.split(breaker);
      newSegments.push(...parts);
    }
    segments = newSegments;
  }

  for (const segment of segments) {
    i = 0;
    while (i < segment.length) {
      let matched = false;

      // Try longest match first (4 chars → 3 → 2)
      for (let len = 4; len >= 2; len--) {
        if (i + len > segment.length) continue;
        const token = segment.substring(i, i + len);
        if (dict[token] !== undefined) {
          const baseScore = dict[token];
          const negMult = zhCheckNegation(segment, i);
          score += baseScore * negMult;
          matchCount++;
          i += len;
          matched = true;
          break;
        }
      }

      if (!matched) i++;
    }
  }

  return { score, matchCount };
}

// --- English negation handling ---

const EN_NEGATION_WORDS = new Set([
  'not', 'no', 'never', "n't", 'neither', 'nobody',
  'nothing', 'without', 'cannot', 'cant', "can't",
  'dont', "don't", 'doesnt', "doesn't", 'didnt', "didn't",
  'wont', "won't", 'shouldnt', "shouldn't", 'isnt', "isn't",
  'arent', "aren't", 'wasnt', "wasn't", 'werent', "weren't",
  'hadnt', "hadn't", 'hasnt', "hasn't", 'havent', "haven't",
  'wouldnt', "wouldn't", 'couldnt', "couldn't", 'mustnt', "mustn't"
]);

const EN_BREAKERS = new Set([
  'but', 'however', 'although', 'though', 'yet', 'nevertheless'
]);

const EN_NEGATION_WINDOW = 3; // tokens after negation word

/**
 * Analyze English text using space-tokenized dictionary matching.
 */
function analyzeEn(text, dict) {
  let score = 0;
  let matchCount = 0;

  // Tokenize: lowercase, split by non-alpha, keep contractions
  const tokens = text.toLowerCase().split(/[^a-z']+/).filter(t => t.length > 0);

  let negationCountdown = 0; // tokens remaining in negation window

  for (const token of tokens) {
    // Breaker word resets negation
    if (EN_BREAKERS.has(token)) {
      negationCountdown = 0;
      continue;
    }

    // Check for negation word
    if (EN_NEGATION_WORDS.has(token)) {
      if (negationCountdown > 0) {
        // Double negation: cancel
        negationCountdown = 0;
      } else {
        negationCountdown = EN_NEGATION_WINDOW;
      }
      continue;
    }

    // Check dictionary
    if (dict[token] !== undefined) {
      const baseScore = dict[token];
      const mult = negationCountdown > 0 ? -1 : 1;
      score += baseScore * mult;
      matchCount++;
      if (negationCountdown > 0) negationCountdown = 0; // Negation consumed
    }

    // Countdown negation window
    if (negationCountdown > 0) negationCountdown--;
  }

  return { score, matchCount };
}

// --- Language detection (simple heuristic) ---

function detectLanguage(text) {
  // Count CJK characters
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length || 1;
  // If >30% CJK characters, treat as Chinese
  return (cjkCount / totalChars) > 0.3 ? 'zh' : 'en';
}

// --- Confidence calculation ---

function computeConfidence(matchCount) {
  if (matchCount < 3) return 'low';
  if (matchCount <= 8) return 'medium';
  return 'high';
}

// --- Vote classification ---

function computeVote(score) {
  if (score > 0.1) return 'positive';
  if (score < -0.1) return 'negative';
  return 'neutral';
}

// --- Main API ---

/**
 * Analyze sentiment of a text string.
 *
 * @param {string} text - Input text (Chinese or English)
 * @returns {{ score: number, vote: string, tokens: number, confidence: string, lang: string }}
 *   score: normalized sentiment score (roughly -1 to +1 range for short text)
 *   vote: 'positive' | 'negative' | 'neutral'
 *   tokens: number of matched sentiment tokens
 *   confidence: 'low' | 'medium' | 'high' (based on match count)
 *   lang: detected language ('zh' | 'en')
 */
function analyze(text) {
  if (!text || typeof text !== 'string') {
    return { score: 0, vote: 'neutral', tokens: 0, confidence: 'low', lang: 'unknown' };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { score: 0, vote: 'neutral', tokens: 0, confidence: 'low', lang: 'unknown' };
  }

  const lang = detectLanguage(trimmed);
  let result;

  if (lang === 'zh') {
    const dict = getZhDict();
    result = analyzeZh(trimmed, dict);
  } else {
    const dict = getEnDict();
    result = analyzeEn(trimmed, dict);
  }

  // Normalize score: divide by match count to keep in reasonable range
  const normalizedScore = result.matchCount > 0
    ? Math.round((result.score / result.matchCount) * 100) / 100
    : 0;

  const confidence = computeConfidence(result.matchCount);
  const vote = computeVote(normalizedScore);

  return {
    score: normalizedScore,
    vote,
    tokens: result.matchCount,
    confidence,
    lang
  };
}

module.exports = { analyze };
