import type { Locale } from "./config";

export type LocalizedText = Partial<Record<Locale, string>>;

export function resolveLocalizedText(
  value: LocalizedText,
  locale: Locale,
  fallback: Locale = "zh-CN",
) {
  const resolved = value[locale] ?? value[fallback] ?? Object.values(value)[0] ?? "";
  return {
    value: resolved,
    requestedLocale: locale,
    resolvedLocale: value[locale] ? locale : fallback,
    usedFallback: !value[locale],
  };
}
