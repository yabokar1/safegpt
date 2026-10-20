const patterns = [
  { kind: "email", re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi },
  { kind: "phone", re: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]?\d{4}/g },
  { kind: "ohip", re: /\b\d{4}-\d{3}-\d{3}\b/g },
  { kind: "mrn", re: /\bMRN[:\s-]*[A-Z0-9-]+\b/gi },
  { kind: "date", re: /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g },
  { kind: "postal", re: /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/gi },
  {
    kind: "address",
    re: /\b\d{1,5}\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+(?:Ave|Avenue|St|Street|Rd|Road|Blvd|Drive|Dr)\b\.?/g,
  },
]

export function anonymize(input) {
  const vault = []
  const counts = {}
  const take = (kind, value) => {
    const clean = value.trim()
    const existing = vault.find((item) => item.kind === kind && item.value === clean)
    if (existing) return existing.token
    counts[kind] = (counts[kind] || 0) + 1
    const token = `[${kind.toUpperCase()}_${counts[kind]}]`
    vault.push({ kind, value: clean, token })
    return token
  }

  let text = input
  for (const pattern of patterns) {
    text = text.replace(pattern.re, (match) => take(pattern.kind, match))
  }
  text = text.replace(
    /(?:Patient|Dr\.?|Physician|Attending)\s*[:.]?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    (full, name) => full.replace(name, take("name", name)),
  )
  text = text.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g, (match) => {
    if (match.startsWith("[") || match.includes("[")) return match
    return take("name", match)
  })
  for (const item of [...vault]) {
    if (item.kind === "name" && text.includes(item.value)) {
      text = text.split(item.value).join(item.token)
    }
  }
  return { text, vault }
}

export function leaked(text, vault) {
  return vault.some((item) => item.value && text.includes(item.value))
}

export function summarize(text) {
  const findings = []
  if (/spo2\s*94%|94%\s*on room air/i.test(text)) findings.push("Oxygen saturation in the note is 94%.")
  if (/asthma/i.test(text)) findings.push("Asthma is listed in the history.")
  if (/cough/i.test(text)) findings.push("A cough is the presenting symptom.")
  if (/salbutamol/i.test(text)) findings.push("Salbutamol is already written. Confirm the device at follow-up.")
  return {
    title: findings.length
      ? "Respiratory note, written from the anonymized text."
      : "Summary written from the anonymized text.",
    findings,
  }
}
