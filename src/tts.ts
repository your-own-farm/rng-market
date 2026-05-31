// ── Text-to-Speech via the Web Speech API ────────────────────────────────────
// Built into every modern browser — no install, no cost, works offline once the
// voice is cached. Falls back silently on unsupported devices.

import { Locale, BCP47 } from "./i18n";

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function isSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, locale: Locale): boolean {
  if (!isSupported()) return false;
  // Cancel anything currently playing — the user pressed a new "speak" button.
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = BCP47[locale];
  u.rate = 0.95;
  u.pitch = 1;
  u.volume = 1;

  // Try to pick a matching voice. Voices load asynchronously on first call;
  // re-query if empty.
  const pickVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const exact = voices.find((v) => v.lang === BCP47[locale]);
    const lang2 = voices.find((v) => v.lang.startsWith(locale));
    const voice = exact ?? lang2;
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  };

  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = pickVoice;
  } else {
    pickVoice();
  }

  currentUtterance = u;
  return true;
}

export function stop() {
  if (isSupported()) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

export function isSpeaking(): boolean {
  return isSupported() && window.speechSynthesis.speaking;
}
