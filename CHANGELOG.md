# Changelog

## v3.2.1 — 2026-04-15

- Fix: `SOUL_FORGE_VERSION` constant bumped to `3.2.1` to match `version.json`
  修复：`SOUL_FORGE_VERSION` 常量升至 `3.2.1` 以匹配 `version.json`

- Fix: auto-update now persists `soul_forge_version` and `last_update_check` to
  disk after download completes (was lost due to async/sync race condition)
  修复：自动更新完成后正确将 `soul_forge_version` 和 `last_update_check` 写入磁盘
  （此前因异步/同步竞态问题导致这两个字段无法持久化）

## v3.2.0 — 2026-04-15

- Memory Evolution L2: `insights.md` as stable memory layer (distilled from
  `memory.md` via L1→L2 pipeline: companion/relationship/exemplar_candidate types)
  记忆进化 L2：`insights.md` 作为稳定记忆层（从 `memory.md` 经 L1→L2 蒸馏）

- Companion Insights injected at conversation start (top of bootstrap context,
  MANDATORY prefix per line)
  对话开始时注入伴侣洞察（位于 bootstrap 上下文顶部，每行附 MANDATORY 前缀）

- Relationship Highlights section added to injection (top 3 by importance,
  after Active Modifiers)
  注入中新增关系高亮区（按重要性取前 3 条，位于 Active Modifiers 之后）

- New memory types: `companion`, `relationship`, `exemplar_candidate`
  新增记忆类型：`companion`、`relationship`、`exemplar_candidate`

- Observation format extended with `importance` field (high|medium|low)
  观察条目格式新增 `importance` 字段（high|medium|low）

- DISC personality templates externalized to `hooks/soul-forge-bootstrap/templates/`
  DISC 人格模板外化为独立文件，位于 `hooks/soul-forge-bootstrap/templates/`

- SKILL.md size reduction (lower token usage)
  SKILL.md 精简（降低 token 消耗）

- `SOUL_TEMPLATE_VERSION` bumped to `2` (forces SOUL.md rebuild for existing users)
  `SOUL_TEMPLATE_VERSION` 升至 `2`（触发存量用户 SOUL.md 重建）

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
