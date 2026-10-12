/**
 * SHEPU ROOMS — encryption.js
 * Phase 3 module — AES-GCM client-side encryption via Web Crypto API.
 * Provides PBKDF2 passphrase derivation, raw key import/export,
 * and authenticated AES-GCM encryption/decryption.
 */

const Encryption = (() => {
  let _key = null; // CryptoKey

  // ── Derive AES-GCM key from user passphrase ───────────────────
  async function deriveKeyFromPassword(password, saltString = "SHEPU_ROOMS_SALT") {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    _key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: enc.encode(saltString),
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    return _key;
  }

  // ── Generate a new random AES-GCM key ─────────────────────────
  async function generateKey() {
    _key = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    return _key;
  }

  // ── Export key as base64 ──────────────────────────────────────
  async function exportKeyBase64(cryptoKey) {
    const k = cryptoKey || _key;
    if (!k) throw new Error("No key available");
    const raw = await crypto.subtle.exportKey("raw", k);
    return _arrayBufferToBase64(raw);
  }

  // ── Import key from base64 ────────────────────────────────────
  async function importKeyBase64(base64) {
    const raw = _base64ToArrayBuffer(base64);
    _key = await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
    return _key;
  }

  // ── Encrypt plaintext → base64 ciphertext with prefix ─────────
  async function encrypt(plaintext) {
    if (!_key) return plaintext; // If not encrypted, return as is
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = new TextEncoder();
      const ct = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        _key,
        enc.encode(plaintext)
      );
      const combined = new Uint8Array(iv.byteLength + ct.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ct), iv.byteLength);
      return "enc:" + _arrayBufferToBase64(combined.buffer);
    } catch (e) {
      console.warn("Encryption failed:", e);
      return plaintext;
    }
  }

  // ── Decrypt base64 ciphertext → plaintext ─────────────────────
  async function decrypt(text) {
    if (!text || typeof text !== "string" || !text.startsWith("enc:")) {
      return text; // Not encrypted
    }
    if (!_key) {
      return "[Encrypted Message — Enter Passphrase to view]";
    }
    try {
      const base64 = text.substring(4);
      const combined = new Uint8Array(_base64ToArrayBuffer(base64));
      const iv = combined.slice(0, 12);
      const ct = combined.slice(12);
      const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        _key,
        ct
      );
      return new TextDecoder().decode(pt);
    } catch (e) {
      return "[Decryption failed — Incorrect Passphrase]";
    }
  }

  function isActive() { return _key !== null; }
  function clearKey() { _key = null; }

  function _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  function _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  return {
    deriveKeyFromPassword,
    generateKey,
    exportKeyBase64,
    importKeyBase64,
    encrypt,
    decrypt,
    isActive,
    clearKey,
  };
})();

window.Encryption = Encryption;
