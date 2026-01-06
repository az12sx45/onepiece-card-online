// public/i18n/i18n.js
(function () {
  const STORAGE_KEY = "op_lang";
  const FALLBACK = "zh-Hant";
  const SUPPORTED = ["zh-Hant", "en", "ja", "ko"];

  function getDicts() {
    return window.__I18N_DICTS || {};
  }

  function getLang() {
    const v = (localStorage.getItem(STORAGE_KEY) || FALLBACK).trim();
    return SUPPORTED.includes(v) ? v : FALLBACK;
  }

  function setLang(lang) {
    const next = SUPPORTED.includes(lang) ? lang : FALLBACK;
    localStorage.setItem(STORAGE_KEY, next);
    // reflect to <html lang="">
    document.documentElement.setAttribute("lang", next);
  }

  function deepGet(obj, path) {
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      cur = cur && Object.prototype.hasOwnProperty.call(cur, p) ? cur[p] : undefined;
      if (cur == null) return undefined;
    }
    return cur;
  }

  function format(str, vars) {
    if (typeof str !== "string") return str;
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? String(vars[k]) : ""));
  }

  function t(key, vars) {
    const dicts = getDicts();
    const lang = getLang();

    let v = deepGet(dicts[lang], key);
    if (v == null) v = deepGet(dicts[FALLBACK], key);
    if (v == null) return key; // last resort
    return format(v, vars);
  }

  function getLangLabel(lang) {
    const dicts = getDicts();
    return dicts?.[lang]?.meta?.label || lang;
  }

  // init html lang
  try { setLang(getLang()); } catch (_) {}

  window.__I18N = { t, getLang, setLang, getLangLabel, SUPPORTED, FALLBACK };
})();
