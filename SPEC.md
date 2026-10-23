# Image Resizer Automation

**Branch:** main (feature branch pending)
**Delivery strategy:** ask-on-risk
**Test runner:** Jest + Supertest (backend), Vitest (frontend)

---

## Summary

Automated image resolution adjustment tool that monitors a source folder, resizes images to a user-specified target resolution, and saves the processed output to a destination folder. Includes a web-based frontend for configuring source/destination paths, target resolution, and monitoring batch progress.

## Primary Objective

Eliminate the manual, repetitive workflow of resizing large image batches by providing an automated pipeline with a simple configuration UI — the user defines the folders and desired resolution once, and the system handles the rest.

## General Context

This project targets users who routinely work with large collections of images (e.g., photographers, content teams, e-commerce operations) and need consistent resolution normalization across batches. The current manual process involves opening each image in an editor, adjusting dimensions, and saving individually — slow and error-prone.

### Architecture Overview

- **Backend:** Node.js with Express API that orchestrates the resize pipeline, watches the source folder, applies transformations via Sharp, and writes results to the destination folder. Exposes REST endpoints for configuration and status.
- **Frontend:** Single-page application (React + Vite + Tailwind) providing a control panel to set source/destination directories, target width/height, format, quality, and to start/stop the automation with live progress feedback.
- **Storage:** No database required. Configuration persisted as JSON on disk; images stored in filesystem folders chosen by the user.
- **Concurrency:** Image processing uses a worker pool with configurable parallelism to avoid blocking the API or saturating I/O.

### Non-Goals

- No cloud storage integration (local filesystem only).
- No image format conversion beyond what Sharp supports natively (no HEIC/WebP encoding edge cases beyond defaults).
- No user authentication (local tool, single-user).

### Success Criteria

1. User can configure source/destination folders and target resolution via the frontend.
2. All supported images in the source folder are resized and saved to the destination folder.
3. Real-time progress (completed/total) is visible during processing.
4. Processing errors (unsupported formats, corrupt files) are reported without halting the batch.
5. The system is idempotent — re-running on the same input produces consistent output.

---

## Specs

### S1 — Image ingestion

The system shall scan the source folder recursively for image files with extensions `.jpg`, `.jpeg`, `.png`, `.webp`, `.tiff`, `.gif`. Hidden files (dot-prefixed) and non-image files shall be ignored.

**Acceptance criteria:**
 A folder containing mixed files yields only supported images in the processing queue.

### S2 — Resolution adjustment

Each image shall be resized to the exact pixel dimensions (width × height) specified by the user. The resize mode `fit: 'inside'` (contain within bounds, preserving aspect ratio) shall be used by default, with an optional `fit: 'fill'` (stretch to exact dimensions) mode selectable in the frontend.

**Acceptance criteria:** Every output image matches the target dimensions (inside mode preserves aspect ratio; fill mode matches exactly).

### S3 — Output persistence

Resized images shall be saved to the destination folder with the same base filename and extension as the source. Existing files in the destination folder shall be overwritten without prompt. The destination folder shall be created automatically if it does not exist.

**Acceptance criteria:** Destination folder contains one resized output per source image, with correct dimensions.

### S4 — Batch monitoring

The frontend shall display real-time progress: number of images processed, total count, current file being processed, and any errors encountered. Updates shall be pushed via WebSocket or polling.

**Acceptance criteria:** User sees live progress that reaches 100% on completion, including per-file error indicators.

### S5 — Error resilience

Processing errors (unsupported format, read/write permission, corrupt file) shall be logged per-file and reported in the frontend without stopping the batch. The system shall continue processing remaining images.

**Acceptance criteria:** A folder with one corrupt image still produces valid output for all other images, with the corrupt file listed as an error.

### S6 — Configuration persistence

Source path, destination path, target width, target height, resize mode, format, and quality settings shall be persisted to a JSON config file on disk. The frontend shall load these values on startup.

**Acceptance criteria:** After a page reload, all previously configured settings are restored.

---

## Tasks

| ID | S# | Route | Description | Status | Commit |
|----|-----|-------|-------------|--------|--------|
| T1 | S1,S2,S3 | delegated | Backend: Express server + Sharp resize pipeline + filesystem watcher | done | `5a34435` |
| T2 | S4 | delegated | Backend: WebSocket endpoint for real-time progress | done | `f545212` |
| T3 | S5 | delegated | Backend: Error handling + per-file error reporting | done | `5a280f8` |
| T4 | S6 | inline | Backend: Config persistence API (GET/PUT /api/config) | done | `d39353c` |
| T5 | S4,S6 | delegated | Frontend: React + Vite + Tailwind config panel with live progress | done | `005afbe` |

## Log

**L1 (2026-10-18):** User request — "Comienza un proyecto utilizando ODD, el cual conste de una automatizacion que busque imagenes de una determinada carpeta y ajuste su resolucion a la que un usuario ingrese, y luego las guarde en otra carpeta, por ello debe tener un apartado frontend (que deberas hacerlo con el stack que creas mas conveniente), y deberas utilizar las herramientas que creas mas eficientes para este tipo de automatizacion. Como utilizaras ODD, deberas generar el SPEC.md general que tenga un breve resumen de la automatizacion, el objetivo principal y luego contexto general de todo el proyecto."

**L2 (2026-10-23):** Implementación completa. T1 (`5a34435`) pipeline Sharp + Express; T2 (`f545212`) WebSocket con RunManager y heartbeat; T3 (`5a280f8`) errores estructurados con `PipelineError`; T4 (`d39353c`) endpoints `GET/PUT /api/config` (el módulo de config existía pero no estaba expuesto por HTTP — hueco cerrado); T5 (`005afbe`) panel React + Vite + Tailwind.

**Verificación final (2026-10-23):** backend 35/35 tests Jest; frontend 24/24 tests Vitest; `vite build` OK. Smoke test end-to-end contra el servidor real: 2 imágenes procesadas, `broken.png` reportado como `CORRUPT_FILE`, archivo oculto y `.txt` ignorados, eventos WS `started → progress×2 → error → done`, dimensiones de salida correctas (`400×267` en modo `inside`, `400×300`).

**Decisión de stack (2026-10-18):**
- **Backend:** Node.js + Express + Sharp + Chokidar (fs watcher) + `ws` (WebSocket). Sharp es la librería más eficiente para redimensionamiento en Node.js — usa libvips en C, mucho más rápido que soluciones JS puras.
- **Frontend:** React + Vite + Tailwind CSS. Vite por su velocidad de desarrollo, Tailwind por UI rápida sin overhead de CSS manual, React por su ecosistema maduro para paneles de control.
- **Tests:** Jest + Supertest (backend), Vitest + Testing Library (frontend).
- **Sin base de datos:** la configuración persiste en JSON en disco; no hay estado relacional.
