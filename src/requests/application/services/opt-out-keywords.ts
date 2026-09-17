/**
 * Explicit WhatsApp opt-out keywords, checked independently of which
 * IntentDetectionPort adapter is configured (local or LLM) — this is a hard
 * business rule that must never depend on classifier availability or quality.
 */
const OPT_OUT_PATTERNS = [
  // "BAJA" alone is too ambiguous in this domain (e.g. "baja tensión" for an electrician
  // request) — only match it as part of the actual unsubscribe phrase: "dar de baja",
  // "darme de baja" (formal) or "dame de baja" (informal imperative, very common in es-AR).
  /\bDA(?:R(?:ME)?|ME)\s+DE\s+BAJA\b/i,
  /\bSTOP\b/i,
  /\bCANCELAR\s+SUSCRIPCI[OÓ]N\b/i,
];

export function isExplicitOptOutKeyword(text: string): boolean {
  if (!text) {
    return false;
  }
  const normalized = text.trim();
  return OPT_OUT_PATTERNS.some((pattern) => pattern.test(normalized));
}
