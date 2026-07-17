import en from "./messages/en.json";
import zhCN from "./messages/zh-CN.json";
import type { Locale } from "./config";

export type TranslationKey = keyof typeof en;
export type Messages = Record<TranslationKey, string>;

const dictionaries: Record<Locale, Messages> = {
  en,
  "zh-CN": zhCN,
};

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}
