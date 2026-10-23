# cm Geometry + Native Folder Picker

**Objective:** Accept width/height in centimeters (configurable DPI) and let the user pick folders through a native OS dialog.
**Branch:** `feature/cm-geometry-folder-picker`
**Delivery:** work-unit commits on the feature branch; personal repo pushes straight to `main` (no PR slicing).
**Test runner:** Jest + Supertest (backend), Vitest (frontend)

---

## Specs

### S1 — Geometry in centimeters

The Geometry section shall accept width and height in centimeters, including decimal values, replacing the previous pixel inputs.

**Acceptance criteria:** Entering `10` / `7.5` with DPI 300 produces an output image of `1181 × 886` px (inside mode preserves ratio).

### S2 — Configurable DPI

The form shall expose a `Resolución (DPI)` field, prefilled with `300`, accepting integers in `1..1200`. It controls the centimeter-to-pixel conversion: `px = round(cm / 2.54 * dpi)`.

**Acceptance criteria:** Changing DPI changes the produced pixel dimensions; values outside the range are rejected with an inline message.

### S3 — Live pixel preview

The form shall display the computed pixel result (`≈ W × H px`) for the current centimeter and DPI values, updating as they change.

**Acceptance criteria:** With `10 × 7.5 cm @ 300 dpi` the preview reads `≈ 1181 × 886 px`.

### S4 — Persisted config schema v2 with migration

Persisted configuration shall use `schemaVersion: 2` with `widthCm`, `heightCm` and `dpi`. A legacy configuration without `schemaVersion` stores pixels and shall be migrated to centimeters at 300 DPI. A legacy value shall never be reinterpreted as centimeters.

**Acceptance criteria:** A `config.json` containing `{ "width": 800, "height": 600 }` is read as `widthCm ≈ 6.77`, `heightCm ≈ 5.08`, and written back with `schemaVersion: 2`. Reading an already-migrated config changes nothing.

### S5 — Folder picker endpoint

`GET /api/pick-folder?initial=<path>` shall open the native folder dialog and return `200 { path }`, `200 { canceled: true }` when dismissed, `501 { error }` when the platform has no supported dialog, and `408 { error }` after a 5 minute timeout. Arguments are passed to the OS command as an array, never interpolated into a shell string.

**Acceptance criteria:** Each of the four outcomes is produced by an injected fake runner in tests.

### S6 — Folder picker UI

Each folder field shall have an `Elegir…` button that fills the input with the selected path. A cancelled pick leaves the value unchanged; an unsupported platform shows an inline message. The text input stays editable as a fallback.

**Acceptance criteria:** Clicking the button populates the field; cancelling does not alter it; a 501 shows the fallback message.

### S7 — Local-only network binding

The HTTP server shall bind `127.0.0.1` instead of all interfaces.

**Acceptance criteria:** `httpServer.address().address === '127.0.0.1'`.

### S8 — Regression

Discovery, resize modes, per-file structured errors, WebSocket progress, config API and the end-to-end run shall keep passing.

**Acceptance criteria:** Full backend and frontend suites pass, plus the end-to-end test.

---

## Tasks

| ID | S# | Route | Description | Status | Commit |
|----|-----|-------|-------------|--------|--------|
| A1 | S4 | delegated | `src/units/cm.js` plus config schema v2 and legacy migration | done | `9a40628` |
| A2 | S1,S2,S8 | delegated | Boundary conversion in orchestrator; pipeline stays pixel-pure | done | `9a40628` |
| A3 | S1,S2,S3 | delegated | Frontend cm fields, DPI field, live pixel preview, validation | done | `9a40628` |
| B1 | S5 | delegated | `src/folders/pickFolder.js` platform dialogs with injected runner | done | `ae4c9b2` |
| B2 | S5 | delegated | `GET /api/pick-folder` endpoint with timeout and typed errors | done | `ae4c9b2` |
| B3 | S7 | delegated | Bind server to `127.0.0.1` | done | `ae4c9b2` |
| B4 | S6 | delegated | `Elegir…` buttons, api client, cancelled/501 handling | done | `ae4c9b2` |
| C1 | S8 | inline | End-to-end verification and full suite run | done | `e36ba59` |

## Log

**L1 (2026-10-23):** User request — "Haz un plan detallado para que la Geometria se ponga en cm, no en pixeles, luego en el apartado de carpetas, debe haber un boton para poder seleccionar la carpeta."

**L2 (2026-10-23):** DPI decision — configurable form field with default 300, range 1..1200.

**Verified environment:** Linux/GNOME with `/usr/bin/zenity` present; `kdialog`, `yad`, `osascript`, `powershell` absent. `zenity` is the Linux path; other platforms are implemented for portability but untested here.

**Why conversion lives at the boundary:** `resize.js` stays a pure pixel function, so its tests keep asserting pixel behavior and the new unit logic is tested once, in isolation.

**Delivery note:** approximately 600 authored lines forecast across both units; the two work-unit commits are the review slices. Chained PRs do not apply because this personal repo pushes straight to `main`.

**L3 (2026-10-23) — verification outcome.** Independent verifier over `9d5e0fa..ae4c9b2`: S1-S8 PASS, **APPROVED**, zero blockers, three advisories. Probes confirmed the formula parity between backend and frontend, the legacy migration (`800×600 px → 6.77×5.08 cm @ 300 dpi` with the file rewritten as v2), real output dimensions (`400×267` inside, `400×300` fill at `10.16×7.62 cm @ 100 dpi`), byte-identical baseline behavior for process/config/errors, `initialPath` carrying `;`, `$()` and backticks passed as one inert array element to `execFile`, all five endpoint outcomes, and `127.0.0.1` binding.

**L4 (2026-10-23) — advisories corrected in `e36ba59`.**
1. A config carrying `widthCm`/`heightCm` without `schemaVersion` used to fall through to the legacy pixel branch and reset to the `800×600` defaults, silently dropping the centimeters. It now keeps them and is normalized to `schemaVersion: 2`. A real legacy file never has `widthCm`, so the discrimination stays unambiguous.
2. `PUT /api/config` accepted `{dpi:'abc'}` and `{dpi:1500}` with 200 and persisted them, which produced `NaN` pixels downstream. `validateGeometry` now rejects non-numeric, out-of-range or fractional DPI and non-positive or oversized centimeter dimensions with `400` and leaves the file untouched. The form rule in S2 stays as the primary, friendlier gate.
3. The picker fallback copy used Rioplatense voseo; it now reads "Escribe la ruta manualmente."

**L5 (2026-10-23) — final state.** Backend 82/82 tests over 9 suites; frontend 44/44 over 7 files; `vite build` green. Both work-unit commits plus the hardening commit sit on `feature/cm-geometry-folder-picker`; pushes go straight to `main` per the user's preference.
