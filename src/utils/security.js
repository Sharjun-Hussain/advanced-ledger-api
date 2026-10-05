const crypto = require('crypto');
require('dotenv').config();

function resolveKey(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // 64-char hex = 32 bytes
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
  // 32-char utf8 = 32 bytes (our generated format)
  const utf8 = Buffer.from(s, 'utf8');
  if (utf8.length === 32) return utf8;
  // base64 that decodes to 32 bytes (44 chars ending with =)
  try {
    const b64 = Buffer.from(s, 'base64');
    if (b64.length === 32) return b64;
  } catch (_) {}
  return null;
}

const KEY_BUF = resolveKey(process.env.ENCRYPTION_KEY);
if (!KEY_BUF) {
  throw new Error(
    'FATAL: ENCRYPTION_KEY env var must be exactly 32 bytes. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'base64\').replace(/[^A-Za-z0-9]/g,\'\').slice(0,32))" ' +
    'and set ENCRYPTION_KEY=<32-char-string> in backend/.env (see .env.example). Refusing to start with insecure default.'
  );
}
const ENCRYPTION_KEY = KEY_BUF;
const IV_LENGTH = 16; // For AES, this is always 16
const MASK = '********';

function encrypt(text) {
    if (!text) return text;
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return text;
    // Fail-closed: never return raw ciphertext as if it were plaintext.
    // Callers must handle null (means: not a valid encrypted payload).
    try {
        let textParts = text.split(':');
        if (textParts.length < 2) return null;
        let iv = Buffer.from(textParts.shift(), 'hex');
        if (iv.length !== IV_LENGTH) return null;
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null;
    }
}

function isMasked(text) {
    return text === MASK;
}

module.exports = {
    encrypt,
    decrypt,
    MASK,
    isMasked
};
