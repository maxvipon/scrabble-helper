const SCORES = {
  ru: { а: 1, б: 3, в: 1, г: 3, д: 2, е: 1, ё: 3, ж: 5, з: 5, и: 1, й: 4, к: 2, л: 2, м: 2, н: 1, о: 1, п: 2, р: 1, с: 1, т: 1, у: 2, ф: 10, х: 5, ц: 5, ч: 5, ш: 8, щ: 10, ъ: 10, ы: 4, ь: 3, э: 8, ю: 8, я: 3 },
  en: { a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10 }
};

const state = { language: 'ru', letters: '', mask: '', lengthFilter: null, expanded: null, dictionary: { ru: [], en: [] }, results: [] };

const els = {
  settingsToggle: document.getElementById('settingsToggle'),
  settingsDrawer: document.getElementById('settingsDrawer'),
  settingsClose: document.getElementById('settingsClose'),
  drawerBackdrop: document.getElementById('drawerBackdrop'),
  language: document.getElementById('language'),
  letters: document.getElementById('letters'),
  mask: document.getElementById('mask'),
  lengthFilters: document.getElementById('lengthFilters'),
  results: document.getElementById('results'),
  summary: document.getElementById('summary')
};

function normalize(v, lang) {
  const lower = (v || '').toLowerCase();
  return lang === 'ru' ? lower.replace(/[^а-яё_*]/g, '') : lower.replace(/[^a-z_*]/g, '');
}

function frequencyMap(str) {
  return [...str].reduce((acc, ch) => ((acc[ch] = (acc[ch] || 0) + 1), acc), {});
}

function canBuildFromLetters(word, letters) {
  if (!letters) return true;
  const pool = frequencyMap(letters);
  for (const ch of word) {
    if (!pool[ch]) return false;
    pool[ch] -= 1;
  }
  return true;
}

function maskToRegExp(mask, lang) {
  if (!mask) return null;
  const safe = normalize(mask, lang).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/_/g, '.').replace(/\*/g, '.*');
  return new RegExp(`^${safe}$`);
}

function wordScore(word, lang) {
  const table = SCORES[lang];
  return [...word].reduce((sum, ch) => sum + (table[ch] || 0), 0);
}

function parseWordList(text, lang) {
  const pattern = lang === 'ru' ? /^[а-яё]{2,}$/ : /^[a-z]{2,}$/;
  return text
    .split('\n')
    .map((w) => normalize(w, lang))
    .filter((w) => pattern.test(w));
}

async function loadDictionaries() {
  const [ruRes, enRes] = await Promise.all([fetch('data/ru-open.txt'), fetch('data/en-open.txt')]);
  const [ruText, enText] = await Promise.all([ruRes.text(), enRes.text()]);
  state.dictionary.ru = parseWordList(ruText, 'ru').map((word) => ({ word, definition: 'Определение: открытый русский словарь (wordlist-формат).' }));
  state.dictionary.en = parseWordList(enText, 'en').map((word) => ({ word, definition: 'Definition: open English dictionary (wordlist format).' }));
}

function search() {
  const dict = state.dictionary[state.language];
  const letters = normalize(state.letters, state.language).replace(/[_*]/g, '');
  const maskRegex = maskToRegExp(state.mask, state.language);

  let results = dict
    .filter(({ word }) => canBuildFromLetters(word, letters))
    .filter(({ word }) => !maskRegex || maskRegex.test(word))
    .map((entry) => ({ ...entry, score: wordScore(entry.word, state.language), length: entry.word.length }));

  results.sort((a, b) => b.score - a.score || b.length - a.length || a.word.localeCompare(b.word));
  if (state.lengthFilter) results = results.filter((entry) => entry.length === state.lengthFilter);

  state.results = results;
  renderLengthFilters(dict);
  renderResults();
}

function renderLengthFilters(dict) {
  const lengths = [...new Set(dict.map(({ word }) => word.length))].sort((a, b) => a - b).slice(0, 18);
  const buttons = ['<button class="length-btn ' + (state.lengthFilter === null ? 'active' : '') + '" data-length="all">Все</button>']
    .concat(lengths.map((len) => `<button class="length-btn ${state.lengthFilter === len ? 'active' : ''}" data-length="${len}">${len}</button>`));
  els.lengthFilters.innerHTML = buttons.join('');

  els.lengthFilters.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.length;
      state.lengthFilter = value === 'all' ? null : Number(value);
      search();
    });
  });
}

function renderResults() {
  const mode = state.letters && state.mask ? 'Эрудит (сортировка по очкам)' : 'Словарь';
  const dictSize = state.dictionary[state.language].length;
  els.summary.textContent = `Найдено: ${state.results.length}. Слов в словаре: ${dictSize}. Режим: ${mode}.`;

  els.results.innerHTML = state.results.slice(0, 300).map((entry) => {
    const isOpen = state.expanded === entry.word;
    return `<li class="result-item"><button class="word-btn" data-word="${entry.word}">${entry.word}<span class="score">${entry.score}</span></button><div class="definition ${isOpen ? '' : 'hidden'}">${entry.definition}</div></li>`;
  }).join('');

  els.results.querySelectorAll('.word-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const word = btn.dataset.word;
      state.expanded = state.expanded === word ? null : word;
      renderResults();
    });
  });
}

function openSettingsDrawer() {
  els.settingsDrawer.classList.add('open');
  els.drawerBackdrop.classList.remove('hidden');
  els.settingsDrawer.setAttribute('aria-hidden', 'false');
  els.settingsToggle.setAttribute('aria-expanded', 'true');
}

function closeSettingsDrawer() {
  els.settingsDrawer.classList.remove('open');
  els.drawerBackdrop.classList.add('hidden');
  els.settingsDrawer.setAttribute('aria-hidden', 'true');
  els.settingsToggle.setAttribute('aria-expanded', 'false');
}

els.settingsToggle.addEventListener('click', () => {
  const opened = els.settingsDrawer.classList.contains('open');
  if (opened) closeSettingsDrawer();
  else openSettingsDrawer();
});
els.settingsClose.addEventListener('click', closeSettingsDrawer);
els.drawerBackdrop.addEventListener('click', closeSettingsDrawer);
els.language.addEventListener('change', (e) => {
  state.language = e.target.value;
  state.expanded = null;
  state.lengthFilter = null;
  search();
});
els.letters.addEventListener('input', (e) => {
  state.letters = e.target.value;
  search();
});
els.mask.addEventListener('input', (e) => {
  state.mask = e.target.value;
  search();
});

await loadDictionaries();
search();
