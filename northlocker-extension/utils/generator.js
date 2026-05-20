/**
 * Client-side password generator using Web Crypto API.
 * Works offline, no server needed.
 */

const DEBUG = false;

function debug(...args) {
  if (DEBUG) console.log('[NL Generator]', ...args);
}

/** Character pools */
const POOLS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

const WORDLIST = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract', 'absurd', 'abuse',
  'access', 'accident', 'account', 'accuse', 'achieve', 'acid', 'acoustic', 'acquire', 'across', 'act',
  'action', 'actor', 'actress', 'actual', 'adapt', 'add', 'addict', 'address', 'adjust', 'admit',
  'adult', 'advance', 'advice', 'advise', 'aerobic', 'affair', 'afford', 'afraid', 'after', 'against',
  'age', 'agent', 'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
  'alcohol', 'alert', 'alien', 'alike', 'alive', 'all', 'alley', 'allow', 'almost', 'alone',
  'along', 'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among', 'amount',
  'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry', 'animal', 'ankle', 'announce',
  'annual', 'another', 'answer', 'antenna', 'antique', 'anxiety', 'any', 'apart', 'apology', 'appear',
  'apple', 'approve', 'april', 'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed',
  'armor', 'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact', 'artist',
  'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume', 'asthma', 'athlete', 'atom',
  'attack', 'attend', 'attitude', 'attract', 'uncle', 'uncover', 'under', 'undo', 'unfair', 'unfold',
  'unhappy', 'uniform', 'unique', 'unit', 'universe', 'unknown', 'unlock', 'until', 'unusual', 'unveil',
  'update', 'upgrade', 'uphold', 'upon', 'upper', 'upset', 'urban', 'urge', 'usage', 'use',
  'used', 'useful', 'useless', 'usual', 'utility', 'vacant', 'vacuum', 'vague', 'valid', 'valley',
  'valve', 'van', 'vanish', 'vapor', 'various', 'vast', 'vault', 'vector', 'vegetable', 'vehicle',
  'preacher', 'flammable', 'theft', 'stencil', 'stick', 'delicious', 'brink'
];

/**
 * Cryptographically secure random choice from a charset.
 * Uses rejection sampling to avoid modulo bias.
 * @param {string|Array} charset
 * @returns {*}
 */
function secureChoice(charset) {
  const arr = new Uint32Array(1);
  const maxValid = Math.floor(0xFFFFFFFF / charset.length) * charset.length;
  let value;
  do {
    crypto.getRandomValues(arr);
    value = arr[0];
  } while (value >= maxValid);
  return charset[value % charset.length];
}

/**
 * Calculate password strength score (0-4).
 * @param {string} password
 * @returns {number} 0=weak, 1=fair, 2=strong, 3=very strong
 */
function calculateStrength(password) {
  if (!password || password.length < 8) return 0;
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return 0;
  if (score === 2) return 1;
  if (score === 3) return 2;
  return 3;
}

/**
 * Get strength label and CSS class.
 * @param {number} score
 * @returns {{label: string, cls: string}}
 */
function getStrengthInfo(score) {
  const levels = [
    { label: 'WEAK', cls: 'strength-weak' },
    { label: 'FAIR', cls: 'strength-fair' },
    { label: 'STRONG', cls: 'strength-strong' },
    { label: 'VERY STRONG', cls: 'strength-very-strong' },
  ];
  return levels[Math.min(score, 3)];
}

/**
 * Generate a password based on configuration.
 * @param {Object} config
 * @returns {{password: string, strength: number, guaranteed: number}}
 */
function generatePassword(config = {}) {
  const length = config.length || 20;
  const useUpper = config.uppercase !== false;
  const useLower = config.lowercase !== false;
  const useDigits = config.digits !== false;
  const useSymbols = config.symbols !== false;

  const minUpper = useUpper ? (config.minUpper !== undefined ? config.minUpper : 2) : 0;
  const minLower = useLower ? (config.minLower !== undefined ? config.minLower : 2) : 0;
  const minDigits = useDigits ? (config.minDigits !== undefined ? config.minDigits : 2) : 0;
  const minSymbols = useSymbols ? (config.minSymbols !== undefined ? config.minSymbols : 1) : 0;

  const guaranteed = minUpper + minLower + minDigits + minSymbols;
  const result = [];

  // Fill minimums first
  for (let i = 0; i < minUpper; i++) result.push(secureChoice(POOLS.uppercase));
  for (let i = 0; i < minLower; i++) result.push(secureChoice(POOLS.lowercase));
  for (let i = 0; i < minDigits; i++) result.push(secureChoice(POOLS.digits));
  for (let i = 0; i < minSymbols; i++) result.push(secureChoice(POOLS.symbols));

  // Build pool of allowed characters
  let pool = '';
  if (useUpper) pool += POOLS.uppercase;
  if (useLower) pool += POOLS.lowercase;
  if (useDigits) pool += POOLS.digits;
  if (useSymbols) pool += POOLS.symbols;

  // Fill remaining
  for (let i = guaranteed; i < length; i++) {
    result.push(secureChoice(pool || POOLS.lowercase));
  }

  // Fisher-Yates shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const j = arr[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  const password = result.join('');
  const strength = calculateStrength(password);

  return { password, strength, guaranteed };
}

/**
 * Generate a passphrase based on configuration.
 * @param {Object} config
 * @returns {string}
 */
function generatePassphrase(config = {}) {
  const numWords = config.numWords || 6;
  const separator = config.separator || '-';
  const capitalize = !!config.capitalize;
  const includeNumber = !!config.includeNumber;

  const words = [];
  for (let i = 0; i < numWords; i++) {
    let w = secureChoice(WORDLIST);
    if (capitalize) {
      w = w.charAt(0).toUpperCase() + w.slice(1);
    }
    words.push(w);
  }

  if (includeNumber) {
    const randomWordIndex = Math.floor(Math.random() * words.length);
    const digit = Math.floor(Math.random() * 10);
    words[randomWordIndex] += digit;
  }

  return words.join(separator);
}

/**
 * Generate a username based on configuration.
 * @param {Object} config
 * @returns {string}
 */
function generateUsername(config = {}) {
  const type = config.type || 'word';
  const capitalize = !!config.capitalize;
  const includeNumber = !!config.includeNumber;

  let username = '';
  if (type === 'word') {
    let w = secureChoice(WORDLIST);
    if (capitalize) {
      w = w.charAt(0).toUpperCase() + w.slice(1);
    }
    username = w;
  } else {
    const chars = POOLS.lowercase;
    const result = [];
    for (let i = 0; i < 8; i++) {
      result.push(secureChoice(chars));
    }
    let resStr = result.join('');
    if (capitalize) {
      resStr = resStr.charAt(0).toUpperCase() + resStr.slice(1);
    }
    username = resStr;
  }

  if (includeNumber) {
    username += Math.floor(Math.random() * 100);
  }

  return username;
}

/**
 * Default generator configuration.
 */
const DEFAULT_CONFIG = {
  length: 36,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  minUpper: 2,
  minLower: 2,
  minDigits: 0,
  minSymbols: 0,
  numWords: 6,
  separator: '-',
  capitalize: false,
  includeNumber: false,
  usernameType: 'word',
  usernameCapitalize: false,
  usernameIncludeNumber: false
};

/**
 * Load saved generator config from storage.
 * @returns {Promise<Object>}
 */
function loadGeneratorConfig() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get('generator', (data) => {
        let saved = data.generator || { ...DEFAULT_CONFIG };
        resolve(saved);
      });
    } catch {
      resolve({ ...DEFAULT_CONFIG });
    }
  });
}

/**
 * Save generator config to storage.
 * @param {Object} config
 */
function saveGeneratorConfig(config) {
  try {
    chrome.storage.local.set({ generator: config });
  } catch {
    // Storage may not be available
  }
}
