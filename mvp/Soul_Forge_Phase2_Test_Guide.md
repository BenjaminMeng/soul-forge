# Soul Forge Phase 2 测试指南

> **版本：** v1.0
> **日期：** 2026-02-19
> **基线：** Phase 2 代码完成（WP0-WP6）
> **前置条件：** Phase 1 R37 55/55 PASS

---

## 0. 测试前强制检查清单

每轮测试前**必须**执行以下检查（参见 CLAUDE.md）：

```
1. diff 源码 SKILL.md vs 部署 SKILL.md
   D:\Coding\OpenClaw_Indiviual_SOUL.md\src\skills\soul-forge\SKILL.md
   C:\Users\benja\.openclaw\skills\soul-forge\SKILL.md

2. diff 源码 handler.js vs 部署 handler.js
   D:\Coding\OpenClaw_Indiviual_SOUL.md\src\hooks\soul-forge-bootstrap\handler.js
   C:\Users\benja\.openclaw\hooks\soul-forge-bootstrap\handler.js

3. 如有差异 → cp 源码到部署目录 + docker compose down && up -d

4. 检查 Docker 日志：grep "loaded 4 internal hook handlers"（不是 3）
```

---

## 1. WP0: 基础架构测试

### T-WP0-1: 全新安装（v2 配置）

**前置条件：** 干净环境，无已有 `.soul_forge/`

**步骤：**
1. 运行 Customer Install 脚本
2. 检查 `.soul_forge/config.json`

**预期结果：**
- [ ] config.json 内容为 `{"status":"fresh","version":2}`
- [ ] 无其他多余字段（最小化初始配置）

### T-WP0-2: v1 → v2 Schema 迁移

**前置条件：** 已有 Phase 1 校准过的配置：
```json
{
  "status": "calibrated",
  "version": 1,
  "disc": { "primary": "S", "secondary": "C", "confidence": "high", "scores": {"D":1,"I":2,"S":5,"C":4} },
  "modifiers": { "humor": 1, "verbosity": 2, "proactivity": 1, "challenge": 0 },
  "calibration_history": [...],
  "created_at": "2026-02-15T10:00:00Z",
  "updated_at": "2026-02-16T10:00:00Z"
}
```

**步骤：**
1. 部署 Phase 2 handler.js（保留 v1 config.json）
2. 触发 bootstrap（启动新 OpenClaw 会话）
3. 读取 bootstrap 后的 config.json

**预期结果：**
- [ ] `version` 变为 `2`
- [ ] 新增 `q_version`，值为 `1`
- [ ] 新增 `disc.answers_hash`，值为 `null`
- [ ] 新增 `probe_phase_start`，值等于 `created_at`（`"2026-02-15T10:00:00Z"`）
- [ ] 新增 `last_style_probe`，值为 `null`
- [ ] 新增 `probe_session_count`，值为 `0`（随后被 bootstrap 递增为 1）
- [ ] 原有 `disc`、`modifiers`、`calibration_history` 完整保留不变
- [ ] `modifiers` 值未改动（仍为 `{h:1,v:2,p:1,c:0}` — 迁移保留原有值）

### T-WP0-3: 损坏配置恢复

**前置条件：** `.soul_forge/config.json` 包含无效 JSON（`{ broken`）

**步骤：**
1. 触发 bootstrap

**预期结果：**
- [ ] 原文件重命名为 `config.json.corrupted`
- [ ] 新建 `config.json`，内容为 `{"status":"fresh","version":2}`
- [ ] 错误记录到 `errors.log`

### T-WP0-4: Pre-flight Check — 文件缺失警告

**前置条件：** 已校准配置，但删除 `SOUL.md`

**步骤：**
1. 触发 bootstrap
2. 检查注入的 `soul-forge-context.md`

**预期结果：**
- [ ] 注入内容中包含 `## Warnings` 段
- [ ] 警告提及 "SOUL.md not found"
- [ ] 状态仍显示 calibrated（未被重置）

### T-WP0-5: Modifier 默认值 — 新用户

**前置条件：** 全新配置，无历史校准

**步骤：**
1. 完成完整校准流程
2. 检查 `soul-forge-context.md` 中注入的 modifier 值

**预期结果：**
- [ ] 默认 modifier 显示为 `verbosity: 1 | humor: 1 | proactivity: 1 | challenge: 1`（不是旧版的 v:2, c:0）

### T-WP0-6: 未来 Schema 版本警告

**前置条件：** 配置中 `"version": 99`

**步骤：**
1. 触发 bootstrap

**预期结果：**
- [ ] 注入警告："config.json version 99 is newer than handler.js supports"
- [ ] 不崩溃，handler 优雅继续运行

---

## 2. WP2: 探测系统测试

### T-WP2-1: 阶段 1 注入（< 14 天）

**前置条件：** 已校准配置，`probe_phase_start` = 今天

**步骤：**
1. 触发 bootstrap 3 次以上（超过 minSessions 阈值）
2. 检查 `soul-forge-context.md`

**预期结果：**
- [ ] 包含 `## Probing Control` 段
- [ ] 显示 `style_probe_allowed: true | stage: 1 | target: {某个 modifier}`
- [ ] `target` 是置信度最低的 modifier（值最接近 1 的）

### T-WP2-2: 阶段 2 注入（14-30 天）

**前置条件：** 已校准配置，`probe_phase_start` = 20 天前

**步骤：**
1. 触发 bootstrap

**预期结果：**
- [ ] 显示 `stage: 2`
- [ ] 频率参数使用阶段 2 的值（minSessions: 5, minDays: 2）

### T-WP2-3: 阶段 3 成熟期（> 30 天）

**前置条件：** 已校准配置，`probe_phase_start` = 35 天前

**步骤：**
1. 触发 bootstrap

**预期结果：**
- [ ] 显示 `style_probe_allowed: false | stage: 3`
- [ ] 不显示探测目标

### T-WP2-4: 频率下限 — 防刷屏

**前置条件：** 已校准配置，`probe_session_count` = 1，`last_style_probe` = 1 小时前

**步骤：**
1. 触发 bootstrap

**预期结果：**
- [ ] `style_probe_allowed: false`（会话次数和天数阈值均未满足）

### T-WP2-5: 频率上限 — 强制触发

**前置条件：** 已校准配置，`probe_session_count` = 8，`last_style_probe` = 2 天前

**步骤：**
1. 触发 bootstrap

**预期结果：**
- [ ] `style_probe_allowed: true`（maxSessions 已超过）

### T-WP2-6: 会话计数递增

**前置条件：** 已校准配置，`probe_session_count` = 3

**步骤：**
1. 触发 bootstrap
2. 读取 config.json

**预期结果：**
- [ ] `probe_session_count` = 4（递增 1）

### T-WP2-7: 探测 config_update.md 处理

**前置条件：** 写入 config_update.md，包含 `## Probing` 段：
```markdown
# Config Update Request

## Probing
- **last_style_probe**: 2026-02-19T10:00:00Z
- **probe_session_count**: 0

## Status
calibrated
```

**步骤：**
1. 触发 bootstrap
2. 读取 config.json

**预期结果：**
- [ ] `last_style_probe` 更新为 `"2026-02-19T10:00:00Z"`
- [ ] `probe_session_count` 重置为 `0`（随后被 bootstrap 递增为 1）
- [ ] config_update.md 已删除

### T-WP2-8: SKILL.md Section M — Agent 探测行为（手动）

**前置条件：** 已校准，阶段 1，`style_probe_allowed: true`

**步骤：**
1. 发起对话，进行轻松聊天
2. 观察 Agent 是否执行伪装的偏好提问

**预期结果：**
- [ ] Agent 展示两种表达方式并询问用户偏好
- [ ] Agent 不暴露自己在做校准
- [ ] Agent 将观察记录写入 memory.md
- [ ] Agent 写入 config_update.md 包含 `## Probing` 段

---

## 3. WP1: 问卷系统测试

### T-WP1-1: 隐私声明 — 对话式风格

**前置条件：** 全新配置

**步骤：**
1. 运行 `/soul-forge`
2. 观察隐私声明

**预期结果：**
- [ ] 使用对话式语气（不是法律声明式）
- [ ] 包含全部必要信息：收集什么、存在哪里、如何控制、如何退出
- [ ] 提及 `/soul-forge pause`、`/soul-forge reset`
- [ ] 以 "Sound good?" 或类似表述结尾

### T-WP1-2: Modifier 信号提取

**前置条件：** 全新配置

**步骤：**
1. 运行 `/soul-forge`，同意隐私声明
2. 用已知选项回答全部 8 道题
3. 检查 Agent 的评分输出

**预期结果：**
- [ ] Agent 列出 DISC 分数（总和 = 8）
- [ ] Agent 从 Modifier Signal 列提取信号
- [ ] Agent 按公式计算 modifier 初始值（基准 1，范围 0-3）
- [ ] 值匹配预期：净 +2 → 3，净 +1 → 2，净 0 → 1，净 -1 → 0

### T-WP1-3: Answers Hash 写入

**步骤：**
1. 完成完整校准
2. 检查 config_update.md（在 bootstrap 处理前拦截）

**预期结果：**
- [ ] 包含 `## Questionnaire` 段
- [ ] 包含 `q_version: 2`
- [ ] 包含 `answers_hash: {8 字符哈希}`

### T-WP1-4: 结果描述 — AI 助手视角

**步骤：**
1. 完成问卷评分
2. 观察确认提示

**预期结果：**
- [ ] 描述框架为 "your AI will..." 或 "I will..."（AI 助手将会...）
- [ ] 不说 "you are..." 或 "your personality is..."（不描述用户人格）

### T-WP1-5: q_version 不匹配警告

**前置条件：** 已校准配置，`q_version: 1`

**步骤：**
1. 部署 Phase 2 handler.js（CURRENT_Q_VERSION = 2）
2. 触发 bootstrap

**预期结果：**
- [ ] 注入中包含 `## Questionnaire Update` 段
- [ ] 显示 `questionnaire_outdated: true`
- [ ] 建议运行 `/soul-forge recalibrate`
- [ ] `probe_phase_start` 重置为当前时间（新探测周期）

### T-WP1-6: 重校准 — 相同答案检测

**前置条件：** 已校准配置，`disc.answers_hash` = "abc12345"

**步骤：**
1. 运行 `/soul-forge recalibrate`
2. 用与上次完全相同的选项回答（产生相同哈希）

**预期结果：**
- [ ] Agent 检测到哈希匹配
- [ ] 显示确认提示："你的选择和上次完全一样"
- [ ] 等待用户确认后才继续

### T-WP1-7: 重校准 — 用户主动 vs 版本更新触发

**测试 A：用户主动触发**
1. 直接运行 `/soul-forge recalibrate`

**预期结果：**
- [ ] config_update.md 的 Reason 包含 `user_initiated`
- [ ] 包含 `## Modifiers` 段（写入问卷推导的新值）

**测试 B：版本更新触发**
1. Bootstrap 显示 `questionnaire_outdated: true`
2. 用户响应运行 `/soul-forge recalibrate`

**预期结果：**
- [ ] config_update.md 的 Reason 包含 `version_update`
- [ ] 不包含 `## Modifiers` 段（保留 Heartbeat 微调过的现有值）

---

## 4. WP3: 老用户测试

### T-WP3-1: 老用户检测

**前置条件：**
- config.json：`{"status":"fresh","version":2}`（或不存在）
- SOUL.md：存在且有自定义内容（非默认模板，无 `soul-forge:v1:` 标记）

**步骤：**
1. 触发 bootstrap
2. 检查 `soul-forge-context.md`

**预期结果：**
- [ ] 状态行包含 `legacy_user: true`

### T-WP3-2: 非老用户 — 无误报

**前置条件：**
- config.json：`{"status":"fresh","version":2}`
- SOUL.md：不存在 或 有 `soul-forge:v1:` 标记 或 小于 200 字节

**步骤：**
1. 触发 bootstrap

**预期结果：**
- [ ] 状态行不包含 `legacy_user: true`

### T-WP3-3: 老用户融合流程（手动）

**前置条件：** 已检测为老用户

**步骤：**
1. 运行 `/soul-forge`
2. 观察 Agent 行为

**预期结果：**
- [ ] Agent 读取现有 SOUL.md 和 IDENTITY.md
- [ ] Agent 检测哪些段落被用户修改过
- [ ] Agent 从内容推断 modifier 值
- [ ] Agent 展示三选项融合 UI
- [ ] `user_customizations.json` 写入 `.soul_history/`

### T-WP3-4: 融合选项 — 与现有内容合并

**步骤：**
1. 在融合 UI 中选择"与现有内容合并"
2. 完成问卷
3. 检查写入的 SOUL.md

**预期结果：**
- [ ] 管辖段（Core Truths、Vibe、Boundaries）被问卷结果覆写
- [ ] 非管辖段（Continuity、用户自添加段）原样保留
- [ ] IDENTITY.md 用户已填字段保留

### T-WP3-5: 融合选项 — 使用新配置

**步骤：**
1. 选择"使用新配置"

**预期结果：**
- [ ] 覆写前保存快照
- [ ] 运行完整问卷流程
- [ ] 所有段落被新校准结果覆写

### T-WP3-6: 融合选项 — 取消

**步骤：**
1. 选择"取消"

**预期结果：**
- [ ] 无文件被修改
- [ ] 无配置变更写入

---

## 5. WP4: 重置 + 清单测试

### T-WP4-1: 重置 — v2 字段清理

**前置条件：** 已校准的 v2 配置，所有字段已填充

**步骤：**
1. 运行 `/soul-forge reset`
2. 触发 bootstrap（处理 config_update.md）
3. 读取 config.json

**预期结果：**
- [ ] `status` = `"dormant"`
- [ ] `probe_phase_start` = `null`
- [ ] `last_style_probe` = `null`
- [ ] `probe_session_count` = `0`
- [ ] `q_version` 保留（不清除）
- [ ] `disc.answers_hash` 保留（不清除）
- [ ] `disc`、`modifiers`、`calibration_history` 保留
- [ ] memory.md 保留（不删除）
- [ ] `.soul_history/` 保留

### T-WP4-2: 休眠状态重激活 — 探测周期重置

**前置条件：** dormant 状态配置

**步骤：**
1. 运行 `/soul-forge`，选择"重新开始"或"恢复"
2. 完成校准
3. 触发 bootstrap（处理 config_update.md，status 变为 calibrated）
4. 读取 config.json

**预期结果：**
- [ ] `probe_phase_start` 设为当前时间（新周期）
- [ ] `probe_session_count` = 0（或递增后为 1）
- [ ] `last_style_probe` = null

### T-WP4-3: Section K — v2 交付清单（手动）

**步骤：**
1. 完成完整的全新校准流程
2. 逐项验证 Section K 所有检查项

**预期结果：**
- [ ] 第 1-13 项（核心清单）：全部通过
- [ ] 第 14 项：config_update.md 包含 `## Questionnaire` 段，`q_version: 2`
- [ ] 第 15 项：`answers_hash` 已写入
- [ ] 第 16 项：Modifier 值非全部默认（除非无信号）
- [ ] 第 17 项：bootstrap 处理校准后 `probe_phase_start` 已设置

---

## 6. WP5: 模型适配测试

### T-WP5-1: Section N 存在性

**步骤：**
1. 检查 SKILL.md 是否包含 Section N

**预期结果：**
- [ ] `## N. Model-Specific Compliance` 段存在
- [ ] 定义了合规层级（Tier 1、2、3）
- [ ] 包含关键约束强化列表（7 项）

### T-WP5-2: MANDATORY 标记密度

**步骤：**
1. 统计 SKILL.md 中 MANDATORY/FORBIDDEN/STRICT 标记数量

**预期结果：**
- [ ] 全文至少 25 个标记
- [ ] 关键 Section（A、C、D、F、I、M）均有标记

### T-WP5-3: 跨模型测试（手动，逐模型）

**测试矩阵：**

| 模型 | 优先级 | 测试范围 |
|------|--------|---------|
| Kimi K2.5 | P0 | 完整流程 |
| Gemini 3 Flash | P0 | 完整流程 |
| Claude Sonnet 4.5 | P0 | 完整流程 |
| GLM-5 | P0 | 完整流程 |
| MiniMax M2.5 | P1 | 核心流程 |
| DeepSeek V3.2 | P1 | 核心流程 + MANDATORY 遵循验证 |
| GPT-5.1 Codex | P1 | 核心流程 |

**每模型测试项：**
- [ ] 隐私声明正确展示
- [ ] 问卷 8 道题正确展示
- [ ] DISC 评分总和 = 8
- [ ] Modifier 信号正确提取
- [ ] SOUL.md 仅用英文书写
- [ ] 通过 config_update.md 写入（不直接写 config.json）
- [ ] memory.md 追加写入行为
- [ ] Heartbeat 观察正常工作
- [ ] 探测遵循 `style_probe_allowed` 控制

---

## 7. WP6: 分发测试

### T-WP6-1: 客户安装 — v2 配置

**步骤：**
1. 在干净环境运行 `Soul_Forge_Customer_Install.ps1`
2. 检查安装后的 config.json

**预期结果：**
- [ ] 部署了 `{"status":"fresh","version":2}`

### T-WP6-2: 升级安装 — v1 配置保留

**步骤：**
1. 已有 v1 config.json（来自 Phase 1）
2. 运行 Customer Install 脚本

**预期结果：**
- [ ] 现有 config.json 未被覆写（Step 5 跳过逻辑）
- [ ] handler.js 已更新（强制复制）
- [ ] SKILL.md 已更新（强制复制）
- [ ] 下次 bootstrap 时 v1→v2 迁移自动运行

---

## 8. 集成 / 端到端测试

### T-E2E-1: 全新用户完整旅程

**步骤：**
1. 全新安装 → bootstrap → `/soul-forge` → 隐私声明 → 8 道题 → 评分 → 确认 → 组装 → 演示 → 偏好提问
2. 下一个会话：bootstrap → 验证注入 → Heartbeat 观察
3. 3+ 个会话后：探测触发（阶段 1）
4. `/soul-forge calibrate`（5+ 次观察后）
5. `/soul-forge recalibrate` → 验证 answers_hash 检查
6. `/soul-forge reset` → 验证 v2 字段处理
7. 从 dormant 状态 `/soul-forge` → 验证重激活

**预期结果：** 所有步骤无错误完成，每个阶段的配置字段均正确。

### T-E2E-2: Phase 1 升级旅程

**步骤：**
1. 从 Phase 1 已校准配置（v1）开始
2. 部署 Phase 2 代码
3. Bootstrap → 验证 v1→v2 迁移
4. 验证 q_version 不匹配警告
5. `/soul-forge recalibrate` → 验证 version_update 触发类型
6. 完成重校准 → 验证 modifier 值保留

**预期结果：** 无缝升级，无数据丢失，探测周期重置。

### T-E2E-3: 老用户旅程

**步骤：**
1. 从自定义 SOUL.md（无 Soul Forge 标记）开始，无 config.json
2. 安装 Soul Forge
3. Bootstrap → 验证 legacy_user 检测
4. `/soul-forge` → 验证融合 UI
5. 选择"合并" → 验证内容保留
6. 完成校准 → 验证 modifier 推断

**预期结果：** 用户自定义内容在非管辖段中完整保留。

---

## 测试结果汇总模板

| 测试 ID | 描述 | 结果 | 备注 |
|---------|------|------|------|
| T-WP0-1 | 全新安装 v2 | | |
| T-WP0-2 | Schema 迁移 | | |
| T-WP0-3 | 损坏配置恢复 | | |
| T-WP0-4 | Pre-flight 警告 | | |
| T-WP0-5 | Modifier 默认值 | | |
| T-WP0-6 | 未来版本警告 | | |
| T-WP2-1 | 阶段 1 注入 | | |
| T-WP2-2 | 阶段 2 注入 | | |
| T-WP2-3 | 阶段 3 成熟期 | | |
| T-WP2-4 | 频率下限 | | |
| T-WP2-5 | 频率上限 | | |
| T-WP2-6 | 会话计数递增 | | |
| T-WP2-7 | 探测 config_update | | |
| T-WP2-8 | Agent 探测行为 | | |
| T-WP1-1 | 隐私声明对话式 | | |
| T-WP1-2 | Modifier 信号提取 | | |
| T-WP1-3 | Answers Hash | | |
| T-WP1-4 | AI 助手视角 | | |
| T-WP1-5 | q_version 不匹配 | | |
| T-WP1-6 | 相同答案检测 | | |
| T-WP1-7 | 触发类型 | | |
| T-WP3-1 | 老用户检测 | | |
| T-WP3-2 | 无误报 | | |
| T-WP3-3 | 融合流程 | | |
| T-WP3-4 | 与现有合并 | | |
| T-WP3-5 | 使用新配置 | | |
| T-WP3-6 | 取消 | | |
| T-WP4-1 | 重置 v2 字段 | | |
| T-WP4-2 | 休眠重激活 | | |
| T-WP4-3 | Section K 清单 | | |
| T-WP5-1 | Section N 存在性 | | |
| T-WP5-2 | MANDATORY 密度 | | |
| T-WP5-3 | 跨模型（逐模型）| | |
| T-WP6-1 | 安装 v2 配置 | | |
| T-WP6-2 | 升级保留 | | |
| T-E2E-1 | 全新用户完整旅程 | | |
| T-E2E-2 | Phase 1 升级旅程 | | |
| T-E2E-3 | 老用户旅程 | | |

---

## 可自动化测试候选

以下测试可用 Node.js 单元测试对 handler.js 进行自动化：

- T-WP0-2：Schema 迁移（调用 `migrateSchema()` 传入 v1 config）
- T-WP0-3：损坏配置（mock fs，验证行为）
- T-WP2-1/2/3：阶段计算（调用 `computeProbingControl()` 传入不同配置）
- T-WP2-4/5：频率边界（调用 `computeProbingControl()` 传入边界值配置）
- T-WP2-7：探测 config_update 解析（调用 `parseConfigUpdate()` 传入 probing 段）
- T-WP1-3：问卷 config_update 解析（调用 `parseConfigUpdate()` 传入 questionnaire 段）
- T-WP4-1：重置字段清理（调用 `processConfigUpdate()` 传入 dormant 状态）
- T-WP4-2：休眠重激活（调用 `processConfigUpdate()` 传入 dormant→calibrated 转换）

---

_Phase 2 测试指南结束_

[//]: # (soul-forge:test-guide:phase2:v1:20260219)
