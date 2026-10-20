import { useEffect, useState } from "react"

const sample = `Patient: Amira Hassan
DOB: 1984-03-12
OHIP: 1234-567-890
MRN: MRN-44021
Phone: 416-555-0148
Email: amira.hassan.example@email.test
Address: 88 Danforth Ave, Toronto M4K 1N4

Amira Hassan has had a cough for 3 weeks. SpO2 94% on room air. History of asthma. Prescribed salbutamol. Follow up in 7 days with Dr. Patel.`

type VaultItem = { token: string; kind: string; value: string }
type Review = {
  id: number
  anonymized: string
  summary: string
  replaced: number
  createdAt: string
}
type Result = {
  review: Review
  findings: string[]
  vault: VaultItem[]
}

export default function App() {
  const [note, setNote] = useState(sample)
  const [result, setResult] = useState<Result | null>(null)
  const [history, setHistory] = useState<Review[]>([])
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function loadHistory() {
    const res = await fetch("/api/reviews")
    const data = await res.json()
    setHistory(data.reviews)
  }

  useEffect(() => {
    loadHistory().catch(() => setError("The SafeGPT API did not respond."))
  }, [])

  async function review(protect: boolean) {
    setBusy(true)
    setError("")
    if (!protect) setResult(null)
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note, protect }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "The review was refused.")
        return
      }
      setResult(data)
      await loadHistory()
    } catch {
      setError("The SafeGPT API did not respond.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <header className="nav">
        <a className="brand" href="/">SafeGPT</a>
        <nav>
          <a href="#history">Stored notes</a>
          <a className="pill" href="https://github.com/yabokar1/safegpt">GitHub</a>
        </nav>
      </header>
      <main>
        <p className="kicker">Health notes · private by default</p>
        <h1>The agent reads tokens, not names.</h1>
        <p className="lede">
          The chart is posted to the API. SafeGPT replaces identifiers, the summary is written from that text, and SQLite stores the anonymized note only. The sample is fictional.
        </p>
        <section className="desk">
          <label>
            <span>Chart note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={14} />
          </label>
          <div className="result">
            <div className="result-head">
              <h2>Sent to the agent</h2>
              <div className="actions">
                <button type="button" onClick={() => review(true)} disabled={busy}>
                  Protect and summarize
                </button>
                <button type="button" className="ghost" onClick={() => review(false)} disabled={busy}>
                  Try without SafeGPT
                </button>
              </div>
            </div>
            {error ? <p className="error">{error}</p> : null}
            {result ? (
              <>
                <pre>{result.review.anonymized}</pre>
                <h3>{result.review.summary}</h3>
                <ul>
                  {result.findings.map((finding) => (
                    <li key={finding}>{finding}</li>
                  ))}
                </ul>
                <p className="quiet">{result.vault.length} {result.vault.length === 1 ? "identifier" : "identifiers"} replaced before the summary. The stored row does not keep the original values.</p>
              </>
            ) : (
              <p className="quiet">Run a review. The text on the right is the API response, not a local preview.</p>
            )}
          </div>
        </section>
        <section id="history">
          <h2>Stored on the server</h2>
          <div className="history">
            {history.map((item) => (
              <article key={item.id}>
                <p className="quiet">{item.replaced} {item.replaced === 1 ? "identifier" : "identifiers"} removed · {item.summary}</p>
                <pre>{item.anonymized}</pre>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
