const SCORES = {
  ru: { а: 1, б: 3, в: 1, г: 3, д: 2, е: 1, ё: 3, ж: 5, з: 5, и: 1, й: 4, к: 2, л: 2, м: 2, н: 1, о: 1, п: 2, р: 1, с: 1, т: 1, у: 2, ф: 10, х: 5, ц: 5, ч: 5, ш: 8, щ: 10, ъ: 10, ы: 4, ь: 3, э: 8, ю: 8, я: 3 },
  en: { a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10 }
};

const I18N = {
  ru: {
    title: 'помощник эрудита',
    settingsTitle: 'Настройки',
    languageLabel: 'Язык словаря',
    openSettings: 'Открыть настройки',
    closeSettings: 'Закрыть настройки',
    lettersPlaceholder: 'ваши буквы',
    maskPlaceholder: 'маска (_ и *)',
    emptyPrompt: 'Введите буквы, чтобы увидеть список слов.',
    definitionRu: 'Определение: открытый русский словарь (wordlist-формат).',
    definitionEn: 'Definition: open English dictionary (wordlist format).'
  },
  en: {
    title: 'scrabble helper',
    settingsTitle: 'Settings',
    languageLabel: 'Dictionary language',
    openSettings: 'Open settings',
    closeSettings: 'Close settings',
    lettersPlaceholder: 'your letters',
    maskPlaceholder: 'mask (_ and *)',
    emptyPrompt: 'Enter letters to see the word list.',
    definitionRu: 'Определение: открытый русский словарь (wordlist-формат).',
    definitionEn: 'Definition: open English dictionary (wordlist format).'
  }
};

const state = { language: 'ru', letters: '', mask: '', lengthFilter: null, dictionary: { ru: [], en: [] }, results: [] };

const els = {
  settingsToggle: document.getElementById('settingsToggle'),
  settingsDrawer: document.getElementById('settingsDrawer'),
  settingsClose: document.getElementById('settingsClose'),
  drawerBackdrop: document.getElementById('drawerBackdrop'),
  settingsTitle: document.getElementById('settingsTitle'),
  languageLabel: document.getElementById('languageLabel'),
  appTitle: document.getElementById('appTitle'),
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
  if (!letters) return false;
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
  state.dictionary.ru = parseWordList(ruText, 'ru').map((word) => ({ word, definition: I18N.ru.definitionRu }));
  state.dictionary.en = parseWordList(enText, 'en').map((word) => ({ word, definition: I18N.en.definitionEn }));
}

function updateTexts() {
  const t = I18N[state.language];
  document.documentElement.lang = state.language;
  els.appTitle.textContent = t.title;
  els.settingsTitle.textContent = t.settingsTitle;
  els.languageLabel.textContent = t.languageLabel;
  els.letters.placeholder = t.lettersPlaceholder;
  els.mask.placeholder = t.maskPlaceholder;
  els.settingsToggle.setAttribute('aria-label', t.openSettings);
  els.settingsClose.setAttribute('aria-label', t.closeSettings);
  renderResults();
}

function search() {
  const dict = state.dictionary[state.language];
  const letters = normalize(state.letters, state.language).replace(/[_*]/g, '');
  const mask = normalize(state.mask, state.language);
  const maskRegex = maskToRegExp(mask, state.language);

  let baseResults = [];
  if (letters) {
    baseResults = dict
      .filter(({ word }) => canBuildFromLetters(word, letters))
      .filter(({ word }) => !maskRegex || maskRegex.test(word))
      .map((entry) => ({ ...entry, score: wordScore(entry.word, state.language), length: entry.word.length }));

    baseResults.sort((a, b) => b.score - a.score || b.length - a.length || a.word.localeCompare(b.word));
  }

  const visibleLengths = [...new Set(baseResults.map((entry) => entry.length))].sort((a, b) => a - b);

  if (state.lengthFilter && !visibleLengths.includes(state.lengthFilter)) {
    state.lengthFilter = null;
  }

  let results = baseResults;
  if (state.lengthFilter) results = results.filter((entry) => entry.length === state.lengthFilter);

  state.results = results;
  renderLengthFilters(visibleLengths);
  renderResults();
}

function renderLengthFilters(lengths) {
  if (!lengths.length) {
    els.lengthFilters.innerHTML = '';
    return;
  }

  const buttons = lengths.map((len) => `<button class="length-btn ${state.lengthFilter === len ? 'active' : ''}" data-length="${len}">${len}</button>`);
  els.lengthFilters.innerHTML = buttons.join('');

  els.lengthFilters.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = Number(btn.dataset.length);
      state.lengthFilter = state.lengthFilter === value ? null : value;
      search();
    });
  });
}

function renderResults() {
  const t = I18N[state.language];
  const letters = normalize(state.letters, state.language).replace(/[_*]/g, '');

  if (!letters) {
    els.summary.textContent = t.emptyPrompt;
    els.summary.classList.remove('hidden');
    els.results.innerHTML = '';
    return;
  }

  els.summary.classList.add('hidden');
  els.results.innerHTML = state.results.slice(0, 300).map((entry) => `<li class="result-item">${entry.word}</li>`).join('');
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
  state.lengthFilter = null;
  updateTexts();
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

updateTexts();
await loadDictionaries();
search();
