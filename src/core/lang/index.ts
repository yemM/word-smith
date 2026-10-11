// ─────────────────────────────────────────────────────────────────────────────
// Prose analysis — the language packs
//
// One module per language beside this one, each exporting a WsLanguage, and
// the list of them below. English is the one the plugin has always had.
// ─────────────────────────────────────────────────────────────────────────────

import type { WsLanguage } from './common';
import { LANG_EN } from './en';

export * from './common';
export * from './en';

export const WS_LANGUAGES: readonly WsLanguage[] = [LANG_EN];

export function wsLanguageByCode(code: string | null | undefined) {
	const c = String(code || '').toLowerCase();
	return WS_LANGUAGES.find((l) => l.code === c) || null;
}
