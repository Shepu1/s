/**
 * SHEPU ROOMS — custom-emoji.js
 * Custom emoji set from assets/emoji (per-category emoji-map.json).
 * - Picker data: categories, search, unicode insertion.
 * - Renderer: replaces outside unicode emojis with custom images per mapping.
 * Stored messages stay unicode (compatible); display swaps to custom images.
 */

const CustomEmoji = (() => {
  const INDEX_URL = 'assets/emoji/index.json';
  const MAP_SUFFIX = 'emoji-map.json';
  // Known categories (folder names). 'All' is virtual.
  const CATEGORY_ORDER = [
    'face', 'drinks', 'festival', 'fruit', 'love', 'medical',
    'music&games', 'nature', 'people', 'romantic', 'rood',
    'symbol', 'technology', 'vehicle',
  ];

  let _items = [];          // [{file, unicode, category, name, src}]
  let _byUnicode = new Map(); // unicode -> first item (for auto-replace)
  let _byCategory = new Map();
  let _regex = null;
  let _loaded = false;
  let _loadPromise = null;

  function prettyName(cat) {
    return cat.replace('&', ' & ').replace(/\s+/g, ' ')
      .split(' ').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
  }

  function safeSrc(category, file) {
    // Strict allowlist to avoid path injection from JSON data
    if (!/^[A-Za-z0-9 _&+.\-]+$/.test(category)) return null;
    if (!/^[A-Za-z0-9 _+.\-]+\.png$/.test(file)) return null;
    return 'assets/emoji/' + encodeURIComponent(category) + '/' + encodeURIComponent(file);
  }

  function ingest(items) {
    _items = [];
    _byUnicode = new Map();
    _byCategory = new Map();
    for (const e of items) {
      if (!e || typeof e.unicode !== 'string' || !e.unicode) continue;
      if (typeof e.file !== 'string' || typeof e.category !== 'string') continue;
      const src = safeSrc(e.category, e.file);
      if (!src) continue;
      const name = typeof e.name === 'string' && e.name
        ? e.name
        : e.file.replace(/\.png$/i, '').replace(/[_-]+/g, ' ');
      const item = { file: e.file, unicode: e.unicode, category: e.category, name, src };
      _items.push(item);
      // First occurrence wins for auto-replace (duplicates exist across categories)
      if (!_byUnicode.has(e.unicode)) _byUnicode.set(e.unicode, item);
      if (!_byCategory.has(e.category)) _byCategory.set(e.category, []);
      _byCategory.get(e.category).push(item);
    }
    // Longest unicode first so ZWJ/variant sequences match before prefixes
    const keys = [..._byUnicode.keys()].sort((a, b) => b.length - a.length);
    const esc = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    _regex = esc.length ? new RegExp(esc.join('|'), 'gu') : null;
    _loaded = true;
  }

  async function loadFromIndex() {
    const res = await fetch(INDEX_URL, { cache: 'force-cache' });
    if (!res.ok) throw new Error('emoji index HTTP ' + res.status);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('emoji index empty');
    ingest(data);
  }

  async function loadFromMaps() {
    // Fallback when index.json is unavailable: fetch per-folder maps
    const out = [];
    for (const cat of CATEGORY_ORDER) {
      try {
        const url = 'assets/emoji/' + encodeURIComponent(cat) + '/' + MAP_SUFFIX;
        const res = await fetch(url, { cache: 'force-cache' });
        if (!res.ok) continue;
        const map = await res.json();
        for (const [file, unicode] of Object.entries(map || {})) {
          out.push({ file, unicode, category: cat });
        }
      } catch { /* skip missing category */ }
    }
    if (!out.length) throw new Error('no emoji maps found');
    ingest(out);
  }

  function load() {
    if (_loadPromise) return _loadPromise;
    _loadPromise = (async () => {
      try {
        await loadFromIndex();
      } catch (e) {
        console.warn('[CustomEmoji] index failed, trying per-folder maps:', e && e.message);
        await loadFromMaps();
      }
      return _items;
    })();
    return _loadPromise;
  }

  function categories() {
    const present = CATEGORY_ORDER.filter(c => _byCategory.has(c));
    // Include any extra categories found on disk (forward-compatible)
    for (const c of _byCategory.keys()) {
      if (!present.includes(c)) present.push(c);
    }
    return ['All', ...present];
  }

  function itemsByCategory(cat) {
    if (!cat || cat === 'All') return _items;
    return _byCategory.get(cat) || [];
  }

  function search(query, cat) {
    const q = (query || '').trim().toLowerCase();
    const pool = itemsByCategory(cat);
    if (!q) return pool;
    return pool.filter(it =>
      it.name.toLowerCase().includes(q) ||
      it.unicode.includes(q) ||
      it.category.toLowerCase().includes(q)
    );
  }

  function lookup(unicode) {
    return _byUnicode.get(unicode) || null;
  }

  // Replace unicode emojis in ESCAPED html/text with custom <img> tags.
  // Input must already be HTML-escaped (unicode passes through escaping).
  function emojifyEscaped(escaped) {
    if (!escaped || typeof escaped !== 'string' || !_regex) return escaped || '';
    return escaped.replace(_regex, (match) => {
      const it = _byUnicode.get(match);
      if (!it) return match;
      const alt = match.replace(/"/g, '&quot;');
      return `<img src="${it.src}" alt="${alt}" title="${it.name.replace(/"/g, '&quot;')}" class="custom-emoji" loading="lazy" draggable="false" />`;
    });
  }

  return {
    load,
    categories,
    prettyName,
    itemsByCategory,
    search,
    lookup,
    emojifyEscaped,
    isLoaded: () => _loaded,
    count: () => _items.length,
  };
})();

window.CustomEmoji = CustomEmoji;
