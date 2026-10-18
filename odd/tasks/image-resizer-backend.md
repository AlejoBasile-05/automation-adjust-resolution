# Image Resizer Backend — Feature Document

**Objective:** Express server + Sharp resize pipeline + filesystem watcher (S1-S3)
**Branch:** `feature/backend-pipeline`
**Route:** inline (single unit, ~250-350 authored lines)
**Test runner:** Jest + Supertest
**Created:** 2026-10-18

---

## Specs

> Source: SPEC.md S1-S3

### S1 — Image ingestion

The system shall scan the source folder recursively for image files with extensions `.jpg`, `.jpeg`, `.png`, `.webp`, `.tiff`, `.gif`. Hidden files (dot-prefixed) and non-image files shall be ignored.

**Acceptance criteria:** A folder containing mixed files yields only supported images in the processing queue.

### S2 — Resolution adjustment

Each image shall be resized to the exact pixel dimensions (width × height) specified by the user. The resize mode `fit: 'inside'` (contain within bounds, preserving aspect ratio) shall be used by default, with an optional `fit: 'fill'` (stretch to exact dimensions) mode selectable in the frontend.

**Acceptance criteria:** Every output image matches the target dimensions (inside mode preserves aspect ratio; fill mode matches exactly).

### S3 — Output persistence

Resized images shall be saved to the destination folder with the same base filename and extension as the source. Existing files in the destination folder shall be overwritten without prompt. The destination folder shall be created automatically if it does not exist.

**Acceptance criteria:** Destination folder contains one resized output per source image, with correct dimensions.

---

## Tasks

| ID | S# | Route | Description | Status | Commit |
|----|-----|-------|-------------|--------|--------|
| T1.1 | S1 | inline | File discovery: recursive scan, filter supported extensions, skip hidden files | pending | — |
| T1.2 | S2 | inline | Sharp resize: `inside` + `fill` modes, quality/format options from config | pending | — |
| T1.3 | S3 | inline | Output writer: preserve filename/extension, mkdir -p, overwrite existing | pending | — |
| T1.4 | S1-S3 | inline | Pipeline orchestrator: discovery → resize → write, progress events via EventEmitter | pending | — |
| T1.5 | S1-S3 | inline | Express app + Supertest: POST /api/process endpoint, unit tests per S# | pending | — |

## Log

**L1 (2026-10-18):** User request — "Haz un plan detallado de la primera tarea."

**Plan rationale:**
- Single inline unit: T1 is one cohesive behavior (pipeline endpoint) — no writer reason.
- EventEmitter decouples Sharp pipeline from HTTP layer, enabling WebSocket reuse in T2.
- Sharp metadata (`.metadata()`) used in tests to verify output dimensions deterministically.
- mkdir recursive for S3 — Node 14.14+ stable API, no dependency needed.
- No new dependencies beyond express, sharp, supertest, jest (all standard, minimal surface).

**File layout (planned):**
```
src/
  app.js              — Express app factory (T1.5)
  server.js           — HTTP listener bootstrap
  pipeline/
    discover.js       — S1: recursive scan + filter (T1.1)
    resize.js         — S2: Sharp transform (T1.2)
    writer.js         — S3: mkdir + write (T1.3)
    orchestrator.js   — EventEmitter pipeline (T1.4)
  config.js           — load/save config JSON (S6, T4 in this batch)
test/
  pipeline.test.js    — Supertest + Jest per S1-S3 (T1.5)
```
