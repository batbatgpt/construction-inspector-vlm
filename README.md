# Construction Inspector VLM

A local web application for evidence-led review of construction photographs. Upload several photographs, choose an inspection scope, and receive a structured report separating direct observations, possible interpretations, concerns, unknowns, and useful follow-up actions.

**GPT-6 Astra/Codex was used to develop this application. The finished application uses Google Gemini as its runtime vision-language model. It has no OpenAI runtime dependency.**

## Run locally

Prerequisites: Node.js **22.12 or newer** (Node 24 LTS recommended), npm, and a modern browser. Internet access is needed for dependency installation and Gemini inference.

```sh
npm install
```

Copy `.env.example` to `.env` in the project root. On PowerShell:

```powershell
Copy-Item .env.example .env
```

Edit `.env` locally in your editor:

```dotenv
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
PORT=3001
```

- **GEMINI_API_KEY**: enter your own Google AI API key in the local `.env` file only. Obtain/manage it in [Google AI Studio](https://aistudio.google.com/apikey). Never paste it into chat, source files, browser forms, or a `VITE_*` variable.
- **GEMINI_MODEL**: defaults to `gemini-2.5-flash` if omitted or blank. Change it to a model available to your key that accepts images and supports JSON structured output. Restart after changing either variable.
- **PORT**: optional backend port, default `3001`. The Vite development proxy reads the same setting. Run commands from the project root.

Google documents [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash) as supporting image input and structured output, with a [free tier](https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash). Availability and quotas depend on your account, region, model, and Google's current terms. No paid fallback or automatic model switching is performed.

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. This starts Vite and Express together. Without a key, the interface works and analysis returns a clear configuration error; no fabricated inspection is generated.

For a production build served locally by Express:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001** (or your configured `PORT`). Both servers bind to loopback. This is a personal local demo, not an authenticated public hosting service.

## Using the inspector

1. Add JPEG, PNG, or WebP photographs by drop or file picker. Click a thumbnail to inspect it; remove images individually or clear all.
2. Select one of eight inspection scopes. Add optional context identifying locations or relationships between photographs. Custom Analysis requires a question.
3. Analyze. Inputs are locked during a request; cancellation and New inspection are available. Cancellation stops local waiting but cannot guarantee Gemini stops processing a request already sent.
4. Read the separate result sections. Image-reference buttons and the report's thumbnail strip open the original local photographs.
5. Export JSON, copy report text, or print / save as PDF using the browser. Reports include mode, question, time, photograph count, model, and all result sections. Exports contain no internal prompts or API key; they do not include image bytes.

State is retained in memory while the page is open. Changing photographs, mode, or notes clears the previous report to prevent mismatched evidence references. Export before editing if you need to keep a report. New inspection resets all inspection state; refreshing or closing the page loses it.

## Architecture

React 19 + TypeScript + Vite frontend; Node.js + Express 5 + TypeScript backend; official `@google/genai` SDK; Zod runtime validation; Multer memory uploads; Sharp image decoding/normalization; plain responsive CSS.

```text
client/src/
  App.tsx                 Session state and request lifecycle
  components/             Upload, scope, photo viewer, report sections
  lib/                    API client, upload preflight, report exports
  styles.css              Desktop/mobile layout and print styles
server/
  app.ts                  HTTP routes, multipart limits, safe error boundary
  config.ts               Server environment and default model
  images.ts               Decode, validate, orient, strip metadata, resize
  prompts.ts              Internal grounding and task construction
  gemini.ts               Official SDK request and response validation
  errors.ts               Safe provider-error messages
shared/
  config.ts               Central upload/request limits and UI terminology
  presets.ts              All eight preset labels and prompts
  schema.ts               Shared Zod schemas and inferred TypeScript types
tests/                    Backend, SDK transport, schemas, exports, browser tests
```

### VLM pipeline

`Photographs + inspection scope → POST /api/analyze → validation + normalization → Gemini image/text request + grounding → structured JSON → Zod validation → report`

`POST /api/analyze` accepts multipart fields `mode`, `instruction`, and repeated `images` files, with `X-Inspection-Request: 1`. It returns `{ result, metadata }` or `{ error: { code, message } }`. `GET /api/health` returns server status, whether a key is configured, and model name; never the key.

Each request contains the internal grounding instruction, the selected preset and user context, then numbered text labels and inline images. The implementation uses the installed SDK's typed `models.generateContent`, `responseMimeType`, and `responseJsonSchema` interfaces. See Google's [Generate Content structured-output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

The JSON schema is derived from the same Zod schema used to validate results, limited to Gemini-supported schema keywords. The backend additionally checks field lengths, visual certainty enums, required sections, and unique, valid image references. Missing or malformed results and blocked/truncated responses fail visibly; missing sections are never filled in automatically. SDK retries are disabled so one click does not silently multiply requests.

### Limits and privacy

- Up to **6 photographs**, **4 MiB per file**, **12 MiB total**, **20 megapixels per image**; instruction limit **2,000 characters**. Central definitions are in `shared/config.ts`.
- The server verifies actual decoded type against MIME type, fully decodes each image, rejects animated/multi-page content, applies orientation, strips metadata, flattens transparency to white, and converts to JPEG (quality 90), with a maximum **2,048-pixel edge**. Original browser previews are preserved. Resizing can remove small details; upload closer views when needed.
- Upload buffers stay in server memory, with no filesystem or database storage. Only the configured Gemini API receives image data. There are no analytics, telemetry, external fonts, accounts, or cloud storage.
- Gemini requests time out after two minutes; at most two requests are admitted concurrently. The app makes no background analyses.
- `.env` and `.env.*` are Git-ignored except `.env.example`. Vite receives no key. Responses/logs omit raw provider errors and model HTML is rendered as text. No CORS access is enabled; a required request header blocks cross-origin form submissions.
- Google processes submitted photographs under its API terms. Free-tier data handling may differ from paid services; review [Google's current terms](https://ai.google.dev/gemini-api/terms) before submitting sensitive site photographs.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
# Or all of the above:
npm run check

# One-time browser installation, then desktop/mobile browser tests:
npx playwright install chromium
npm run test:e2e
# After npm run build; checks the built server and browser at four viewport widths:
npm run test:production
```

Browser tests start their own local dev servers on ports 5173/3001 with an explicitly empty key. Stop existing dev servers before running them. Tests cover real missing-key behavior; successful-analysis fixtures exist **only in tests**. The installed SDK's HTTP serialization is tested with a mocked network transport. Automated tests do not prove real Gemini access or inspection quality. Test screenshots, print PDFs, and traces are written under ignored `test-results/`.

## Interpretation limits

This system performs **AI-assisted visual interpretation**. It is not an engineering certification, regulatory determination, or deterministic computer-vision measurement system. A photograph cannot establish structural adequacy, material strength, hidden defects, exact dimensions, workmanship acceptance, contractual status, or schedule performance. Visual certainty describes the clarity of visible evidence, not a probability percentage or severity score.

Multiple images are not presumed to share a place, time, project, or sequence. Grounding prompts instruct Gemini to distinguish observation from inference, resist instructions embedded in images, and request useful evidence where uncertain. These instructions and schema validation cannot guarantee factual accuracy or eliminate model overclaims. Have a qualified person verify relevant findings in context.

**Remaining live verification:** add your key locally, restart, and analyze actual construction photographs. Confirm access/quota for the chosen model and review output grounding against the original images. Live inference cannot be verified without your key.
