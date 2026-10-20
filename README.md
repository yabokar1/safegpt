# SafeGPT

A full-stack health-note desk. The React client sends a chart note to the Express API. The API replaces identifiers, runs the summary on that text only, and stores the anonymized note. The raw chart is not written to SQLite.

The original SafeGPT-Backend does this with Presidio and a model on SageMaker. This app is the same boundary, in one process, so the website can run without those services. Set `SAFEGPT_URL` if you want the anonymizer step to call that API instead.

## Run

```bash
npm install
npm run build
npm start
```

Open http://127.0.0.1:4311

`POST /api/reviews` with `{ "protect": false }` is refused. Nothing is stored.
