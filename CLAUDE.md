# CLAUDE.md — Soul Forge Project Notes

## Project Overview

Soul Forge is a DISC-based AI personality calibration system for OpenClaw. It consists of a Skill (SKILL.md), a Bootstrap Hook (handler.js), and runtime data files that together enable personality questionnaire, calibration, and continuous observation.

## Current Status

**MVP Phase 1: COMPLETE** (R35, 2026-02-17 验证通过)
- DISC 8 题问卷 + 4 型模板 + Bootstrap Hook + 状态命令 + Heartbeat 观察
- 22 issues: 20 CLOSED (R35 验证 17 + R36 新增 2 + R37 新增 1), 1 ACCEPTED (BUG-1), 1 ONGOING mitigated (#20 ENOENT, 非阻塞)
- R37 Customer Install 一键化: hooks 自动启用 + Setup.bat 双击入口, 自动化测试 55/55 PASS (#29)
- M1-M14 全部 ✅ (见 Architecture v3.1 Section 19)

**Phase 2: CODE COMPLETE** (2026-02-19 代码实现完成，待测试验证)
- WP0 Foundation: Schema v2 迁移 + Pre-flight Check + modifier 默认值统一 ✅
- WP2 Probing: 三阶段探测 + 双门槛频率控制 + computeProbingControl() ✅
- WP1 Questionnaire: 隐私开场改版 + modifier 副轴映射 + answers_hash + q_version ✅
- WP3 Legacy Users: 老用户检测 + 参数推断 + 融合 UI ✅
- WP4 Reset + Checklist: v2 字段清理 + Section K 补全 + dormant 重激活 ✅
- WP5 Model Adaptation: Section N 模型自识别 + MANDATORY 标记密度审查 ✅
- WP6 Distribution: 安装脚本 v2 config.json 更新 ✅
- 待完成: 问卷内容迭代（32 个场景化选项需人工设计）+ 7 模型跨模型测试

**Next Phase:** Phase 2 测试验证 + 问卷内容设计 + GTM 执行 (Business Plan Section 7.1)

## Directory Structure

```
OpenClaw_Indiviual_SOUL.md/
├── README.md                  # This project's directory guide
├── CLAUDE.md                  # Claude Code project notes (this file)
├── src/                       # Deployable source files
│   ├── skills/soul-forge/SKILL.md
│   ├── hooks/soul-forge-bootstrap/HOOK.md
│   ├── hooks/soul-forge-bootstrap/handler.js
│   ├── .soul_forge/config.json
│   ├── .soul_forge/memory.md
│   ├── HEARTBEAT_SEGMENT.md
│   ├── SOUL.md
│   └── IDENTITY.md
├── mvp/                       # MVP deliverables & test artifacts
│   ├── Soul_Forge_MVP_Install.ps1
│   ├── Soul_Forge_MVP_Test_Guide.md
│   ├── Soul_Forge_Test_Feedback.md
│   └── Soul_Forge_Issue_Record.md
├── docs/                      # Design documents
│   ├── Soul_Forge_Architecture_v3.1.md
│   ├── Soul_Forge_Phase2_Plan.md
│   ├── Soul_Forge_v3_Review.md
│   ├── SoulForge_Business_Plan.md
│   └── archive/               # Superseded documents
└── .claude/                   # Claude Code settings
```

## Deployment Paths

OpenClaw has two important directory levels — do NOT confuse them:

```
CONFIG_DIR  = ~/.openclaw/                    # OpenClaw configuration root
WORKSPACE   = ~/.openclaw/workspace/           # Default agent workspace

Skills  → CONFIG_DIR/skills/     (managed)  or  WORKSPACE/skills/     (workspace)
Hooks   → CONFIG_DIR/hooks/      (managed)  or  WORKSPACE/hooks/      (workspace)
Runtime → WORKSPACE/.soul_forge/  (MUST be in workspace, handler.js uses workspaceDir)
```

## Pre-Test Mandatory Checklist

Before **every** test round (including semi-auto Telegram tests), run these alignment checks:

```
1. diff source SKILL.md vs deployed SKILL.md
   D:\Coding\OpenClaw_Indiviual_SOUL.md\src\skills\soul-forge\SKILL.md
   C:\Users\benja\.openclaw\skills\soul-forge\SKILL.md

2. diff source handler.js vs deployed handler.js
   D:\Coding\OpenClaw_Indiviual_SOUL.md\src\hooks\soul-forge-bootstrap\handler.js
   C:\Users\benja\.openclaw\hooks\soul-forge-bootstrap\handler.js

3. If either differs → cp source to deployed + docker compose down && up -d

4. Verify Docker logs: grep for "loaded 4 internal hook handlers" (not 3)
```

**Why this exists:** BUG-3 regressed twice (R18, R18a) because the C: deployed handler.js was silently overwritten with an older version missing the regex fix. The source (D:) and deployed (C:) directories are independent — edits to one do NOT auto-sync to the other. Every code change must be explicitly copied and verified before testing.

## Known Issues & Fixes

### 2026-02-13: Skills `workspace.dir` config default missing

**File:** `d:\Coding\OpenClaw\src\agents\skills\config.ts`

`DEFAULT_CONFIG_VALUES` was missing `"workspace.dir": true` (hooks had it, skills didn't). Any skill with `requires.config: ["workspace.dir"]` was silently filtered out — the AI never saw the SKILL.md content.

**Fix:** Added `"workspace.dir": true` to the skills `DEFAULT_CONFIG_VALUES`.

### 2026-02-13: .soul_forge/ installed in wrong directory

Original install script placed `.soul_forge/` in `~/.openclaw/.soul_forge/` (CONFIG_DIR root). Correct location is `~/.openclaw/workspace/.soul_forge/` because `handler.js` uses `path.join(workspaceDir, '.soul_forge', ...)`.

## Pitfall Quick Reference

从 36 轮测试中提炼的关键教训，避免重蹈覆辙：

| 坑 | 教训 | 首次出现 | 详情 |
|----|------|---------|------|
| 源码/部署不同步 | D: 和 C: 是独立的，编辑源码后必须 cp + restart | R18 (BUG-3 回归) | CLAUDE.md Pre-Test Checklist |
| INIT 模板污染 | 运行时 snapshot 逻辑会覆写 *_INIT.md，需要 INIT 保护规则 | R29 (#24) | Issue Record #24 |
| memory.md 覆写 | Agent 可能覆写而非追加，需 MANDATORY append-only 规则 | R32 (#25) | Issue Record #25 |
| Agent 绕过架构约束 | Agent 可能直写 config.json 或自修复绕过路由，需 FORBIDDEN + STRICT 规则 | R23-R24 (#22/#23) | Issue Record #22, #23 |
| config_update.md 竞态 | 同会话内多次写 config_update.md 会覆盖，需 Session Merge Rule | R20 (#21) | Issue Record #21 |
| DeepSeek 指令跟随力 | 新增 SKILL.md 指令不一定被 DeepSeek Chat 遵循，需 MANDATORY 标记 + 测试验证 | R24 (T-R18b-3) | Test Feedback R18b |
| WhatIf 副作用泄漏 | -WhatIf / dry-run 路径中所有 I/O（日志、文件写入、提示文案）都须受 `$WhatIfPreference` 保护，否则"预览"仍会落盘 | R36 (#27) | Issue Record #27 |
| 备份无条件覆盖 | 备份目标用 `-Force` 会在 upgrade 场景静默丢失首次原始备份；备份前必须 `Test-Path` 跳过已存在 | R36 (#28) | Issue Record #28 |

## Document Navigation

| 文档 | 位置 | 用途 | 什么时候读 |
|------|------|------|-----------|
| Architecture v3.1 | docs/Soul_Forge_Architecture_v3.1.md | 完整设计规范（2000+ 行） | 需要理解设计决策时 |
| Phase 2 Plan | docs/Soul_Forge_Phase2_Plan.md | Phase 2 规划（29 轮苏格拉底问答确认） | Phase 2 实施、理解 Phase 2 范围时 |
| Business Plan v2.1 | docs/SoulForge_Business_Plan.md | 商业策略 + 市场分析 + 财务预测 | GTM 规划、定价决策时 |
| Issue Record | mvp/Soul_Forge_Issue_Record.md | 22 个 issue 索引 + R1 postmortem | 排查已知问题、避免重复踩坑时 |
| Test Feedback | mvp/Soul_Forge_Test_Feedback.md | 当前状态摘要 + 轮次总结索引 | 了解测试覆盖和当前质量状态时 |
| Test Detail Archive | docs/archive/Test_Feedback_R1-R18d_Detail.md | R1-R18d 逐轮详细日志 | 需要考古具体轮次细节时 |
| Install Script | mvp/Soul_Forge_MVP_Install.ps1 | 开发者本地安装 | 本地部署时 |
| Customer Install | mvp/Soul_Forge_Customer_Install.ps1 | 客户环境安装（通用路径） | 为客户安装服务时 |

## Key Code References

- Skill eligibility: `src/agents/skills/config.ts:shouldIncludeSkill()`
- Skill loading: `src/agents/skills/workspace.ts:loadSkillEntries()`
- Hook eligibility: `src/hooks/config.ts:shouldIncludeHook()`
- Default workspace: `src/agents/workspace.ts:resolveDefaultAgentWorkspaceDir()`
- Config dir: `src/utils.ts:resolveConfigDir()`

## Version Milestones

| 版本 | 日期 | 内容 | 验证 | 快照 |
|------|------|------|------|------|
| MVP Phase 1 | 2026-02-17 | DISC 问卷 + 4 型模板 + Bootstrap Hook + 状态命令 + Heartbeat 观察 | R35 V-1~V-3 全部通过 | docs/archive/MVP_Phase1_Snapshot_20260217/ |
| Customer Install v1 | 2026-02-17 | Customer Install 脚本 3 bug 修复 + 端到端自动化测试 (5 Suites, 41 Assertions) | R36 41/41 PASS | mvp/Test-CustomerInstall.ps1 |
| Customer Install v2 | 2026-02-18 | 一键化: hooks 自动启用 + Setup.bat 双击入口 (7 Suites, 55 Assertions) | R37 55/55 PASS | mvp/Test-CustomerInstall.ps1 |
| Phase 2 Plan | 2026-02-19 | 29 轮苏格拉底问答确认 Phase 2 范围（14 项纳入 / 5 项延后） | — | docs/Soul_Forge_Phase2_Plan.md |
| Phase 2 Code | 2026-02-19 | Schema v2 + 三阶段探测 + 问卷双轴 + 老用户融合 + 模型适配 + Pre-flight Check | 待测试 | — |
