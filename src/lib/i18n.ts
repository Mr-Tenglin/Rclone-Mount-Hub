/**
 * Minimal i18n runtime for Rclone Mount Hub.
 *
 * - Language packs live in the project's `i18n/` folder as JSON files
 *   (one per locale, e.g. `i18n/en.json`, `i18n/zh-Hans.json`).
 *   Packs are discovered automatically via Vite's `import.meta.glob`,
 *   so adding a new locale = dropping a new JSON file in `i18n/`.
 * - `en.json` is the base/default pack: it is the original English UI text.
 * - Every other locale file is a translation that extends/overrides the
 *   English pack (missing keys fall back to English, then to the key path).
 *
 * The active locale is resolved in this order:
 *   1. `settings.language` if the user explicitly picked one in Settings
 *      (persisted via the settings store; "auto" means follow the system);
 *   2. otherwise the system language (navigator.language);
 *   3. otherwise English.
 *
 * Use the `useI18n()` hook in components, or `t()` in plain code:
 *
 *   const { t } = useI18n();
 *   <span>{t("sidebar.nav.overview", { mode: "LAN" })}</span>
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useSettingsStore } from "./store";

// Auto-discover all language packs in the project's i18n folder.
// Vite resolves this to a static import map at build time.
const localeModules = import.meta.glob("../../i18n/*.json", {
  eager: true,
}) as Record<string, { default: unknown }>;

/* ------------------------------------------------------------------ */
/* Locale packs                                                        */
/* ------------------------------------------------------------------ */

/** Base pack (English) — every other pack is merged over it. */
const BASE_LOCALE = "en";

/** Locale code (filename, e.g. "en", "zh-Hans") → pack object. */
const LOCALES: Record<string, Record<string, unknown>> = {};
for (const [path, mod] of Object.entries(localeModules)) {
  const file = path.split("/").pop() ?? "";
  const code = file.replace(/\.json$/i, "");
  LOCALES[code] = (mod.default ?? {}) as Record<string, unknown>;
}

/** Locales with a human-readable name, for the Settings language picker. */
export const SUPPORTED_LOCALES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh-Hans", label: "简体中文" },
  { code: "zh-Hant", label: "繁體中文" },
  { code: "ja", label: "日本語" },
  { code: "es", label: "Español" },
  { code: "ru", label: "Русский" },
];

/** "auto" = follow the system language. */
export const LOCALE_AUTO = "auto";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Flatten a nested locale object into `a.b.c` → value. */
export function flattenPack(
  pack: Record<string, unknown>,
  prefix = ""
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(pack)) {
    const k = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      Object.assign(out, flattenPack(value, k));
    } else if (typeof value === "string") {
      out[k] = value;
    }
  }
  return out;
}

/** Deep-merge `pack` over `base` (pack wins). */
function mergePacks(
  base: Record<string, unknown>,
  pack: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(pack)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = mergePacks(out[key] as Record<string, unknown>, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * "zh-CN" → "zh-hans", "zh-TW" → "zh-hant", "ja-JP" → "ja".
 * Simplified/Traditional Chinese use the -hans/-hant script suffix, so
 * a file named zh-Hans.json is matched from a system tag like zh-CN.
 */
function normalizeTag(tag: string): string {
  const [lang, region] = tag.split(/[-_]/).map((s) => s.toLowerCase());
  if (region === "cn" || region === "tw") {
    if (lang === "zh") return `${lang}-${region === "cn" ? "hans" : "hant"}`;
    // e.g. "zh-CN" for a non-Chinese lang is nonsensical; just use the lang.
    return lang;
  }
  if (lang === "zh") return "zh-hans"; // bare "zh" defaults to simplified
  return lang; // "ja-JP" → "ja", "es-MX" → "es", "ru-RU" → "ru"
}

/**
 * Resolve the best available locale for a system language tag.
 * Falls back to English when no translation exists.
 * Locale codes are matched case-insensitively against the
 * file-derived keys (e.g. "zh-Hans").
 */
export function resolveLocale(systemLanguage: string): string {
  const wanted = normalizeTag(systemLanguage);
  // Case-insensitive lookup against the locale registry keys.
  const match = Object.keys(LOCALES).find(
    (code) => code.toLowerCase() === wanted.toLowerCase()
  );
  if (match) return match;
  // Bare-script fallback: "zh-hans" missing but "zh" exists?
  const scriptless = wanted.split("-")[0];
  const scriptMatch = Object.keys(LOCALES).find(
    (code) => code.toLowerCase() === scriptless.toLowerCase()
  );
  if (scriptMatch) return scriptMatch;
  return BASE_LOCALE;
}

/* ------------------------------------------------------------------ */
/* Flattened pack cache                                                */
/* ------------------------------------------------------------------ */

/** Map a user-provided locale code to the canonical registry key
 *  (case-insensitive), or null when no pack matches. */
function canonicalLocale(code: string): string | null {
  return Object.keys(LOCALES).find(
    (c) => c.toLowerCase() === code.toLowerCase()
  ) ?? null;
}

type PackLookup = Record<string, string>;

const packedCache: Record<string, PackLookup> = {};
function getPacked(locale: string): PackLookup {
  if (!packedCache[locale]) {
    const key = canonicalLocale(locale);
    const pack = key ? LOCALES[key] : LOCALES[BASE_LOCALE];
    packedCache[locale] =
      locale === BASE_LOCALE
        ? flattenPack(LOCALES[BASE_LOCALE])
        : flattenPack(mergePacks(LOCALES[BASE_LOCALE], pack));
  }
  return packedCache[locale];
}

/* ------------------------------------------------------------------ */
/* Locale state (module-level, so hooks re-render on changes)         */
/* ------------------------------------------------------------------ */

/** The user's explicit choice: "" or "auto" = follow the system language. */
let explicitLocale: string = "";

/** Bump counter for external-store subscriptions. */
let version = 0;
const listeners = new Set<() => void>();

function bump() {
  version++;
  for (const fn of listeners) fn();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Set the user's explicit locale choice ("auto"/"" = system). */
export function setExplicitLocale(code: string): void {
  explicitLocale = code;
  bump();
}

export function getExplicitLocale(): string {
  return explicitLocale;
}

/**
 * The currently effective locale:
 * explicit choice (if not auto) → system language → English.
 */
export function effectiveLocale(systemLanguage?: string): string {
  if (explicitLocale && explicitLocale !== LOCALE_AUTO) {
    return explicitLocale;
  }
  const sys =
    systemLanguage ??
    (typeof navigator !== "undefined" ? navigator.language : "en");
  return resolveLocale(sys);
}

/**
 * Effective locale as a value for `useSyncExternalStore`:
 * a stable primitive that only changes when the locale changes.
 */
function getEffectiveLocaleSnapshot(): string {
  return effectiveLocale();
}

/* ------------------------------------------------------------------ */
/* Translate                                                           */
/* ------------------------------------------------------------------ */

/** Look up `key` (locale → English fallback → the key itself), then
 *  substitute `{param}` placeholders. */
function translate(
  locale: string,
  key: string,
  params?: Record<string, string | number>
): string {
  let text: string | undefined = getPacked(locale)[key];
  if (text === undefined && locale !== BASE_LOCALE) {
    text = getPacked(BASE_LOCALE)[key];
  }
  if (text === undefined) text = key; // last resort: show the key

  if (params) {
    for (const [p, v] of Object.entries(params)) {
      // Use split/join to stay compatible with the ES2020 target
      text = text.split(`{${p}}`).join(String(v));
    }
  }
  return text;
}

/** Translate a key using the currently effective locale (non-React code). */
export function t(
  key: string,
  params?: Record<string, string | number>
): string {
  return translate(effectiveLocale(), key, params);
}

/* ------------------------------------------------------------------ */
/* React hook                                                          */
/* ------------------------------------------------------------------ */

/**
 * Returns a `t` bound to the currently selected language, re-rendering
 * automatically when the user changes the language in Settings.
 *
 *   const { t } = useI18n();
 *   <span>{t("sidebar.nav.overview")}</span>
 */
export function useI18n() {
  const language = useSettingsStore((s) => s.settings.language);

  // Keep the module-level explicit-locale in sync with persisted settings.
  useEffect(() => {
    setExplicitLocale(language || LOCALE_AUTO);
  }, [language]);

  const locale = useSyncExternalStore(
    subscribe,
    getEffectiveLocaleSnapshot,
    getEffectiveLocaleSnapshot
  );

  const tBound = useMemo(
    () =>
      (key: string, params?: Record<string, string | number>): string =>
        translate(locale, key, params),
    [locale]
  );

  return { t: tBound, locale };
}
