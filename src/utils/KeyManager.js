import dotenv from 'dotenv';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config({
  quiet: true,
});

let keys = [];
let state = {};
let currentIndex = 0;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const stateFile = join(__dirname, '../../keys-manager.json');

export function getKey() {
  if (keys.length === 0) {
    keys = Object.keys(process.env)
      .filter(
        key =>
          (key === 'GOOGLE_GEMINI_KEY' ||
            key.startsWith('GOOGLE_GEMINI_KEY')) &&
          process.env[key]
      )
      .sort()
      .map(key => process.env[key]);

    if (keys.length === 0) {
      throw new Error(
        'No API keys found in environment variables (GOOGLE_GEMINI_KEY, GOOGLE_GEMINI_KEY1, GOOGLE_GEMINI_KEY2 etc...)'
      );
    }

    if (keys.length === 1) {
      return keys[0];
    }

    try {
      if (existsSync(stateFile)) {
        const saved = JSON.parse(readFileSync(stateFile, 'utf8'));
        state = saved.state || {};
        currentIndex = saved.currentIndex || 0;
      }
    } catch (e) {
      console.log(e);
    }

    keys.forEach(key => {
      if (!state[key]) {
        state[key] = {
          requests: 0,
          daily: 0,
          lastReset: Date.now(),
          dayReset: getToday(),
        };
      }
    });
  }

  // Fast path for single key
  if (keys.length === 1) {
    return keys[0];
  }

  const now = Date.now();
  const today = getToday();
  let bestKey = null;
  let bestScore = Infinity;

  // Find the best available key
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const s = state[key];

    // Reset counters if needed
    if (now - s.lastReset > 60000) {
      // 1 minute
      s.requests = 0;
      s.lastReset = now;
    }

    if (s.dayReset < today) {
      s.daily = 0;
      s.dayReset = today;
    }

    // Calculate score (lower is better)
    const score = s.requests + s.daily * 0.1;

    if (score < bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  // Use the best key (or fallback to round-robin)
  const selectedKey = bestKey || keys[currentIndex];

  // Update usage
  state[selectedKey].requests++;
  state[selectedKey].daily++;
  currentIndex = (currentIndex + 1) % keys.length;

  // Save state
  try {
    writeFileSync(stateFile, JSON.stringify({ state, currentIndex }));
  } catch (e) {
    // Silent fail - state won't persist but function still works
  }

  return selectedKey;
}

function getToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
