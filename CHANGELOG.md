# Changelog

## v3.1.1 — 2026-03-22

- Mandatory minimal telemetry (anonymous install count, no conversation data)
- `telemetry_opt_in` defaults to `null` (explicit opt-in required for full telemetry)
- `soul_forge_version` now always reflects the running handler version
- Umami upgrade disclosure added to privacy notice

## v3.1.0 — 2026-02-19

- Schema v2: added `mood_history`, `drift_state`, `pending_changes`, `calibration_baseline`
- Three-phase probing with dual-threshold frequency control
- Questionnaire v2: privacy-first opening, sub-axis mapping, `answers_hash`
- Legacy user detection and parameter inference
- Reset improvements: v2 field cleanup, dormant reactivation
- Model adaptation: self-identification in Section N, MANDATORY marker density
- Pre-flight check on every bootstrap

## v3.0.0 — 2026-02-17 (MVP Phase 1)

- Initial public release
- DISC 8-question questionnaire
- 4 personality templates (D/I/S/C)
- Bootstrap Hook with heartbeat observation
- Status command (`/soul-forge status`)
- One-click customer installer (`node installer.js`)
