import { DatabaseSync } from "node:sqlite"
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import express from "express"
import { anonymize, leaked, summarize } from "./anonymize.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 4311)
const dataDir = path.join(__dirname, "..", "data")
fs.mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(path.join(dataDir, "safegpt.sqlite"))
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    anonymized TEXT NOT NULL,
    summary TEXT NOT NULL,
    replaced INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`)

const sampleCount = db.prepare("SELECT COUNT(*) AS n FROM reviews").get().n
if (sampleCount === 0) {
  db.prepare(
    "INSERT INTO reviews (anonymized, summary, replaced, created_at) VALUES (?, ?, ?, ?)",
  ).run(
    "Patient [NAME_1] was seen for a cough. No direct identifiers were kept in this row.",
    "Summary written from the anonymized text.",
    1,
    new Date().toISOString(),
  )
}

function reviewView(row) {
  return {
    id: Number(row.id),
    anonymized: row.anonymized,
    summary: row.summary,
    replaced: Number(row.replaced),
    createdAt: row.created_at,
  }
}

async function protect(note) {
  if (process.env.SAFEGPT_URL) {
    const response = await fetch(process.env.SAFEGPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: note }),
    })
    if (!response.ok) throw new Error("SafeGPT anonymizer did not accept the note.")
    const data = await response.json()
    return { text: String(data.text || data.anonymized || ""), vault: data.vault || [] }
  }
  return anonymize(note)
}

const app = express()
app.use(express.json({ limit: "64kb" }))

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "safegpt" })
})

app.get("/api/reviews", (_req, res) => {
  const rows = db.prepare("SELECT * FROM reviews ORDER BY id DESC LIMIT 20").all()
  res.json({ reviews: rows.map(reviewView) })
})

app.post("/api/reviews", async (req, res) => {
  const note = String(req.body?.note || "").trim()
  if (note.length < 8 || note.length > 8000) {
    return res.status(400).json({ error: "Paste a chart note." })
  }
  if (req.body?.protect !== true) {
    return res.status(422).json({
      error: "SafeGPT has to run before the agent. The note was not sent and nothing was stored.",
    })
  }

  let protectedNote
  try {
    protectedNote = await protect(note)
  } catch {
    return res.status(502).json({ error: "The anonymizer did not return a result." })
  }

  if (!protectedNote.text || leaked(protectedNote.text, protectedNote.vault)) {
    return res.status(422).json({
      error: "Identifiers were still in the text, so the agent was not called.",
    })
  }

  const summary = summarize(protectedNote.text)
  const created = db.prepare(
    "INSERT INTO reviews (anonymized, summary, replaced, created_at) VALUES (?, ?, ?, ?)",
  ).run(
    protectedNote.text,
    summary.title,
    protectedNote.vault.length,
    new Date().toISOString(),
  )
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(created.lastInsertRowid)
  res.status(201).json({
    review: reviewView(row),
    findings: summary.findings,
    vault: protectedNote.vault,
  })
})

const publicDir = path.join(__dirname, "..", "web", "dist")
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir))
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) return next()
    res.sendFile(path.join(publicDir, "index.html"))
  })
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SafeGPT listening on http://127.0.0.1:${PORT}`)
})
