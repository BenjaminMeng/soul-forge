# Soul Forge — Test Feedback & Resolution Log

**Created:** 2026-02-13
**Status:** Active (continuously updated with each test round)

---

## Phase 2 — Current Status (Updated: 2026-03-11)

**Phase 2 代码已提交 (commit 43675a5) 并部署至 ~/.openclaw/**
**自动化测试 R38: 静态 26/26 + 单元 61/61 = 87/87 PASS**

### Phase 2 自动化测试覆盖 (R38, 2026-03-11)

| 范围 | 测试 | 结果 |
|------|------|------|
| T-WP5-1: Section N 存在性 | 4 assertions | ✅ 全通过 |
| T-WP5-2: MANDATORY/FORBIDDEN/STRICT 密度 (36 total) | 6 assertions | ✅ 全通过 |
| T-WP0-1: Source config.json v2 最小化 | 3 assertions | ✅ 全通过 |
| handler.js Phase 2 函数存在性 (9项) | 9 assertions | ✅ 全通过 |
| T-WP6-1/2: Customer Install v2 config + 升级跳过逻辑 | 4 assertions | ✅ 全通过 |
| T-WP0-2: Schema v1→v2 迁移 (10个场景) | 10 assertions | ✅ 全通过 |
| T-WP0-4: Pre-flight SOUL.md 缺失警告 | 1 assertion | ✅ 全通过 |
| T-WP0-6: 未来版本警告 | 1 assertion | ✅ 全通过 |
| T-WP3-1/2: Legacy user 检测 (4个场景) | 4 assertions | ✅ 全通过 |
| T-WP2-1/2/3: 三阶段探测 (8个场景) | 8 assertions | ✅ 全通过 |
| T-WP2-4/5: 频率控制边界 | 3 assertions | ✅ 全通过 |
| T-WP2-7: 探测 config_update 解析 | 4 assertions | ✅ 全通过 |
| T-WP1-3: 问卷 config_update 解析 | 3 assertions | ✅ 全通过 |
| 完整 config_update 解析 (DISC+Modifiers+Reason) | 5 assertions | ✅ 全通过 |
| T-WP4-1: Reset → dormant 字段清理 | 8 assertions | ✅ 全通过 |
| T-WP4-2: Dormant → calibrated 重激活 | 5 assertions | ✅ 全通过 |
| T-WP2-6: probe_session_count 边界 | 2 assertions | ✅ 全通过 |
| T-WP0-5: Modifier 默认值 (全 1) | 2 assertions | ✅ 全通过 |
| T-WP1-5: q_version 不匹配检测逻辑 | 3 assertions | ✅ 全通过 |
| T-WP1-6: answers_hash 解析保存 | 1 assertion | ✅ 全通过 |

**待手动测试 (需要 OpenClaw Agent 运行):**
- T-WP1-1/2/4/7: 问卷 UI + Modifier 信号提取 + AI 视角 + 触发类型
- T-WP2-8: Agent 探测伪装行为
- T-WP3-3/4/5/6: 融合 UI 流程
- T-WP4-3: Section K 清单
- T-WP5-3: 7 模型跨模型测试
- T-E2E-1/2/3: 端到端旅程

**测试文件:** `.claude/worktrees/determined-benz/test_p2_static.js` + `test_p2_unit.js`

---

## MVP Phase 1 — Current Status (Updated: 2026-02-18)

**Overall: MVP Phase 1 Complete — All Validations Passed (R35, 2026-02-17)**
**Note:** Issue #20 (context.md ENOENT) remains mitigated/ongoing — non-blocking, no regression in R35.

### Component Status
| Component | Status | Last Verified |
|-----------|--------|---------------|
| SKILL.md (Sections A-M, 1310 lines) | ✅ Complete | R18d (2026-02-17) |
| handler.js (Bootstrap Hook) | ✅ Complete | R18c (2026-02-16) |
| Install Script (.soul_history/ step) | ✅ Complete | R37 (2026-02-18, 自动化 51/51) |
| Customer Install Script | ✅ Complete (hooks auto-enable + Setup.bat) | R37 (2026-02-18, 自动化 55/55) |
| config.json schema | ✅ Complete | R15 (2026-02-15) |
| HEARTBEAT_SEGMENT.md | ✅ Complete | R15 (2026-02-15) |
| INIT Templates (.soul_forge/) | ✅ Complete | R18d (2026-02-17) |

### Issue Summary
| Category | Count |
|----------|-------|
| Total Issues Found | 22 |
| CLOSED | 20 (R35 验证 17 + R36 新增 2 + R37 新增 1) |
| ACCEPTED (won't fix) | 1 (BUG-1) |
| ONGOING (mitigated) | 1 (#20 ENOENT) |

### Remaining Steps to MVP Phase 1 Release
1. ✅ 部署同步 (R35, 4 hooks loaded)
2. ✅ V-1: Reset 8/8 通过 (R35)
3. ✅ V-2: memory.md append-only 通过 (R35)
4. ✅ V-3: Resume + 普通对话无 ENOENT (R35)
5. ✅ 更新 Test Feedback (本次)
6. ✅ 文档整理（2026-02-17 完成）

---

## Test Round Summary

| Round | Date | Key Changes | Result |
|-------|------|-------------|--------|
| R1 | 02-13 | 首次部署，发现 4 个 blocker/critical | 4 issue 修复 |
| R15 | 02-15 | Hook 系统启用 + SKILL.md 批量修复 | 6/6 测试通过 |
| R18a | 02-16 | 语言矛盾修复 + 路由稳定性 | 9/9 gate 通过 |
| R18b | 02-16 | 状态一致性 + IDENTITY 英文强制 | #11 解决，#22/#23 发现 |
| R18c | 02-16 | Pre-release hardening (agent 行为约束) | 5/5 回归通过 |
| R18d | 02-17 | #24/#25/#26 修复 + INIT 保护 | 代码完成 |
| R35 | 02-17 | V-1~V-3 最终验证 | **全部通过** |
| R36 | 02-17 | Customer Install 端到端自动化测试 (5 Suites, 41 Assertions) | **41/41 PASS**, 2 bug 修复 (#27/#28) |
| R37 | 02-18 | Customer Install 一键化: hooks 自动启用 + Setup.bat + 测试扩展 (7 Suites, 55 Assertions) | **55/55 PASS**, #29 |
| R38 | 03-11 | Phase 2 Code Complete 自动化测试: 静态 + handler.js 单元测试 (87 Assertions) | **87/87 PASS** |

> Detail: [docs/archive/Test_Feedback_R1-R18d_Detail.md](../docs/archive/Test_Feedback_R1-R18d_Detail.md)

---

## Template: Future Test Rounds

Copy this template for each new test round:

```markdown
## Round N — YYYY-MM-DD: Description

### Issue #N: Title

**Severity:** Blocker / Critical / Medium / Low
**Status:** Open / Investigating / Resolved

**Symptom:**

**Root Cause:**

**Resolution:**

**Files Changed:**
```
