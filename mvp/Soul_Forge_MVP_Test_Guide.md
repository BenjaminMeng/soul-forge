# Soul Forge MVP — 部署与测试指南

**版本：** v1.1
**日期：** 2026-02-13
**更新：** v1.1 修正部署路径模型、安装命令语法、新增前置 bugfix 步骤
**前提：** 所有 MVP 代码资产已完成（M1-M12），本文档覆盖 M13（本地部署）和 M14（全流程测试）

---

## 目录

1. [部署前检查](#1-部署前检查)
2. [部署步骤](#2-部署步骤)
3. [部署验证](#3-部署验证)
4. [测试矩阵总览](#4-测试矩阵总览)
5. [T1 — handler.js 单元验证](#5-t1--handlerjs-单元验证)
6. [T2 — Bootstrap Hook 集成测试](#6-t2--bootstrap-hook-集成测试)
7. [T3 — Skill 首次问卷全流程](#7-t3--skill-首次问卷全流程)
8. [T4 — HEARTBEAT 观察测试](#8-t4--heartbeat-观察测试)
9. [T5 — 校准流程测试](#9-t5--校准流程测试)
10. [T6 — 状态命令测试](#10-t6--状态命令测试)
11. [T7 — 容错与边界测试](#11-t7--容错与边界测试)
12. [T8 — 隐私拒绝测试](#12-t8--隐私拒绝测试)
13. [T9 — 重置与恢复测试](#13-t9--重置与恢复测试)
14. [T10 — 端到端全生命周期](#14-t10--端到端全生命周期)
15. [测试加速方法](#15-测试加速方法)
16. [已知限制与预期偏差](#16-已知限制与预期偏差)
17. [测试结果记录模板](#17-测试结果记录模板)

---

## 1. 部署前检查

### 1.1 环境要求

| 项目 | 要求 | 检查命令 |
|------|------|---------|
| Node.js | ≥ 22.12.0 | `node --version` |
| OpenClaw | 已安装并可运行 | `openclaw --version` 或通过 UI 确认 |
| 工作空间 | 有一个可用的 OpenClaw workspace | 确认 workspace 路径 |

### 1.2 前置 Bugfix（必须）

**在部署前，必须修复 OpenClaw 源码中的一个 bug：**

文件：`src/agents/skills/config.ts`

将 `DEFAULT_CONFIG_VALUES` 中添加 `"workspace.dir": true`：

```typescript
const DEFAULT_CONFIG_VALUES: Record<string, boolean> = {
  "browser.enabled": true,
  "browser.evaluateEnabled": true,
  "workspace.dir": true,           // <-- 添加此行
};
```

**原因：** 不修复此处，任何声明 `requires.config: ["workspace.dir"]` 的 Skill（包括 soul-forge）会被静默过滤，AI 永远看不到 SKILL.md 内容。详见 `Soul_Forge_Issue_Record.md`。

修复后重新编译 OpenClaw。

### 1.3 理解 OpenClaw 目录模型

OpenClaw 有两个关键目录层级，**不要混淆**：

| 目录 | 路径 | 用途 |
|------|------|------|
| **CONFIG_DIR** | `~/.openclaw/` | OpenClaw 配置根目录，存放 managed skills/hooks |
| **WORKSPACE** | `~/.openclaw/workspace/` | Agent 工作空间，handler.js 读写运行时数据 |

后续步骤中 `{CONFIG_DIR}` 和 `{WORKSPACE}` 分别指代这两个路径。

### 1.4 确认你的工作空间路径

OpenClaw workspace 路径确认优先级：
1. Agent 配置中的 `workspace` 字段
2. `agents.defaults.workspace` 配置
3. 默认路径 `~/.openclaw/workspace/`

**默认情况下无需修改，`{CONFIG_DIR}` = `~/.openclaw/`，`{WORKSPACE}` = `~/.openclaw/workspace/`。**

### 1.5 源文件清单

确认以下源文件存在且内容完整：

```
d:\Coding\OpenClaw\OpenClaw_Indiviual_SOUL.md\src\
├── skills\soul-forge\SKILL.md              (约 1209 行)
├── hooks\soul-forge-bootstrap\HOOK.md      (约 22 行)
├── hooks\soul-forge-bootstrap\handler.js   (约 646 行)
├── .soul_forge\config.json                 ({"status":"fresh","version":1})
├── .soul_forge\memory.md                   (# Soul Forge Observations)
├── HEARTBEAT_SEGMENT.md                    (含 SOUL_FORGE_START 标记)
├── SOUL.md                                 (OpenClaw 原始模板 + 已有定制)
└── IDENTITY.md                             (当前: Razor)
```

### 1.6 备份当前工作空间

**重要：部署前务必备份。**

```bash
# Windows
xcopy "{WORKSPACE}" "{WORKSPACE}_backup_20260213" /E /I /H

# macOS / Linux
cp -r "{WORKSPACE}" "{WORKSPACE}_backup_20260213"
```

---

## 2. 部署步骤

### 2.1 文件部署映射表

> **重要：** Skill 和 Hook 部署到 **CONFIG_DIR**（managed 目录），运行时数据部署到 **WORKSPACE**。

| 源文件 | 部署目标 | 说明 |
|--------|---------|------|
| `src\skills\soul-forge\SKILL.md` | `{CONFIG_DIR}\skills\soul-forge\SKILL.md` | Managed skill |
| `src\hooks\soul-forge-bootstrap\HOOK.md` | `{CONFIG_DIR}\hooks\soul-forge-bootstrap\HOOK.md` | Managed hook |
| `src\hooks\soul-forge-bootstrap\handler.js` | `{CONFIG_DIR}\hooks\soul-forge-bootstrap\handler.js` | Managed hook |
| `src\.soul_forge\config.json` | `{WORKSPACE}\.soul_forge\config.json` | 运行时（仅首次） |
| `src\.soul_forge\memory.md` | `{WORKSPACE}\.soul_forge\memory.md` | 运行时（仅首次） |
| `src\HEARTBEAT_SEGMENT.md` | 手动追加到 `{WORKSPACE}\HEARTBEAT.md` | 见 2.3 步骤 |

**不要部署的文件：**
- `SOUL.md` — 不要覆盖工作空间现有的 SOUL.md（handler.js 会在首次运行时备份原始版本）
- `IDENTITY.md` — 同上，不覆盖

### 2.2 执行部署

**推荐方式：运行 PowerShell 安装脚本**

```powershell
.\mvp\Soul_Forge_MVP_Install.ps1
```

脚本自动处理目录创建、文件复制、路径验证。

**手动部署（PowerShell）：**

```powershell
$CONFIG_DIR = "$env:USERPROFILE\.openclaw"
$WORKSPACE  = "$env:USERPROFILE\.openclaw\workspace"
$SOURCE     = "D:\Coding\OpenClaw\OpenClaw_Indiviual_SOUL.md\src"

# 创建目录
New-Item -ItemType Directory -Force -Path "$CONFIG_DIR\skills\soul-forge"
New-Item -ItemType Directory -Force -Path "$CONFIG_DIR\hooks\soul-forge-bootstrap"
New-Item -ItemType Directory -Force -Path "$WORKSPACE\.soul_forge"

# Skill (managed)
Copy-Item "$SOURCE\skills\soul-forge\SKILL.md" "$CONFIG_DIR\skills\soul-forge\SKILL.md" -Force

# Hook (managed)
Copy-Item "$SOURCE\hooks\soul-forge-bootstrap\HOOK.md" "$CONFIG_DIR\hooks\soul-forge-bootstrap\HOOK.md" -Force
Copy-Item "$SOURCE\hooks\soul-forge-bootstrap\handler.js" "$CONFIG_DIR\hooks\soul-forge-bootstrap\handler.js" -Force

# Runtime data (workspace, only if not exist)
if (-not (Test-Path "$WORKSPACE\.soul_forge\config.json")) {
    Copy-Item "$SOURCE\.soul_forge\config.json" "$WORKSPACE\.soul_forge\config.json"
}
if (-not (Test-Path "$WORKSPACE\.soul_forge\memory.md")) {
    Copy-Item "$SOURCE\.soul_forge\memory.md" "$WORKSPACE\.soul_forge\memory.md"
}
```

### 2.3 HEARTBEAT.md 集成

检查 `{WORKSPACE}\HEARTBEAT.md` 是否存在：

**情况 A — 文件存在：**

打开文件，在末尾追加 `HEARTBEAT_SEGMENT.md` 中从 `<!-- SOUL_FORGE_START` 到 `SOUL_FORGE_END -->` 的完整内容。

**情况 B — 文件不存在：**

不需要手动创建。handler.js 会在首次 bootstrap 时自动创建 HEARTBEAT.md 并写入 Soul Forge 段。

> **注意：** 即使你手动跳过此步，handler.js 的 `checkHeartbeat()` 函数也会在每次 agent:bootstrap 时自动检查并修复。但手动部署可以确保第一个 Heartbeat 回合就能正常工作。

### 2.4 handler.js 格式确认

OpenClaw hook 加载器支持 CommonJS 和 ESM 两种格式。当前 handler.js 使用 CommonJS（`module.exports`），这与 OpenClaw 的动态 `import()` 加载机制兼容。

**已知注意点：** OpenClaw package.json 声明 `"type": "module"`（ESM），但 hook 加载器通过 `import()` 动态导入，对 CommonJS 的 `module.exports` 会自动包装为 `{ default: handler }`。

**验证方法：** 在部署后的第 3 节验证步骤中确认 handler 是否被正确加载。

---

## 3. 部署验证

部署完成后，逐项检查：

### 3.1 文件存在性检查

```
[ ] {CONFIG_DIR}\skills\soul-forge\SKILL.md 存在
[ ] {CONFIG_DIR}\hooks\soul-forge-bootstrap\HOOK.md 存在
[ ] {CONFIG_DIR}\hooks\soul-forge-bootstrap\handler.js 存在
[ ] {WORKSPACE}\.soul_forge\config.json 存在，内容为 {"status":"fresh","version":1}
[ ] {WORKSPACE}\.soul_forge\memory.md 存在，内容为 # Soul Forge Observations
[ ] {WORKSPACE}\SOUL.md 存在（原始内容，未被覆盖）
[ ] {WORKSPACE}\IDENTITY.md 存在（原始内容，未被覆盖）
[ ] src/agents/skills/config.ts 包含 "workspace.dir": true（前置 bugfix）
```

### 3.2 Hook 加载验证

启动 OpenClaw Agent，观察：

1. **确认 hook 被发现：** OpenClaw 启动日志中是否出现 `soul-forge-bootstrap` 相关信息
2. **确认 hook 执行：** 检查是否生成了 bootstrap context 注入内容
3. **确认 HEARTBEAT.md：** 检查 `{WORKSPACE}\HEARTBEAT.md` 是否包含 `SOUL_FORGE_START` 标记

**如果 hook 未被加载：**
- 检查 HOOK.md frontmatter 格式是否正确
- 检查 handler.js 是否有语法错误：`node -c "{WORKSPACE}\hooks\soul-forge-bootstrap\handler.js"`
- 检查 OpenClaw 是否在正确的 workspace 路径下运行

### 3.3 Skill 加载验证

在 Agent 对话中输入 `/soul-forge`，观察：
- Agent 是否识别了这个 Skill 命令
- 是否展示了隐私说明文本

如果 Agent 不识别命令：
- 确认 SKILL.md 的 YAML frontmatter 格式正确
- 确认文件在正确路径 `{CONFIG_DIR}\skills\soul-forge\SKILL.md` 或 `{WORKSPACE}\skills\soul-forge\SKILL.md`
- **确认已应用前置 bugfix：** `src/agents/skills/config.ts` 的 `DEFAULT_CONFIG_VALUES` 包含 `"workspace.dir": true`
- 如果 AI 返回自编内容（而非 SKILL.md 定义的流程），说明 skill 被静默过滤了

### 3.4 首次 Bootstrap 注入确认

状态为 `fresh` 时，bootstrap 注入内容应为：

```markdown
# Soul Forge Calibration Context

## Status
fresh

Soul Forge is installed but not yet configured. Suggest the user run /soul-forge to begin personality calibration.
```

Agent 应在合适时机建议用户运行 `/soul-forge`。

---

## 4. 测试矩阵总览

| 测试 ID | 测试名称 | 类型 | 优先级 | 依赖 |
|---------|---------|------|--------|------|
| T1 | handler.js 单元验证 | 离线 | P0 | 无 |
| T2 | Bootstrap Hook 集成 | 在线 | P0 | 部署完成 |
| T3 | Skill 首次问卷全流程 | 在线 | P0 | T2 |
| T4 | HEARTBEAT 观察 | 在线 | P0 | T3 |
| T5 | 校准流程 | 在线 | P1 | T4（或手动注入数据） |
| T6 | 状态命令（pause/resume） | 在线 | P1 | T3 |
| T7 | 容错与边界 | 混合 | P1 | T2 |
| T8 | 隐私拒绝 | 在线 | P1 | T2 |
| T9 | 重置与恢复 | 在线 | P1 | T3 |
| T10 | 端到端全生命周期 | 在线 | P0 | 全部 |

**P0 = 必须通过才能认为 MVP 可用，P1 = 应该通过但不阻塞**

---

## 5. T1 — handler.js 单元验证

**目的：** 在不依赖 OpenClaw 运行时的情况下验证 handler.js 的核心逻辑。

### T1.1 语法检查

```bash
node -c "{WORKSPACE}\hooks\soul-forge-bootstrap\handler.js"
```

预期：无输出（无语法错误）。

### T1.2 模块导出验证

创建测试脚本 `test_handler.js`：

```javascript
'use strict';
const path = require('path');
const handler = require('{WORKSPACE}/hooks/soul-forge-bootstrap/handler.js');

console.log('typeof handler:', typeof handler);
console.log('handler is function:', typeof handler === 'function');
```

预期输出：
```
typeof handler: function
handler is function: true
```

### T1.3 config_update.md 解析测试

创建测试脚本 `test_config_update_parse.js`：

```javascript
'use strict';
const path = require('path');
const fs = require('fs');

// 直接加载 handler.js 获取内部函数不行（CommonJS 只导出 handler）
// 方案：创建一个模拟测试环境

// 准备测试目录
const testDir = path.join(__dirname, '_test_workspace');
const soulForgeDir = path.join(testDir, '.soul_forge');
fs.mkdirSync(soulForgeDir, { recursive: true });

// 写入 fresh config
fs.writeFileSync(
  path.join(soulForgeDir, 'config.json'),
  JSON.stringify({ status: 'fresh', version: 1 })
);

// 写入 config_update.md
fs.writeFileSync(path.join(soulForgeDir, 'config_update.md'), `# Config Update Request

## Action
calibration

## DISC
- **primary**: S
- **secondary**: C
- **confidence**: high
- **scores**: D=1 I=2 S=5 C=4

## Modifiers
- **humor**: 1
- **verbosity**: 2
- **proactivity**: 1
- **challenge**: 0

## Status
calibrated

## Reason
Initial DISC calibration: S-type, confidence high
`);

// 写入空 memory.md
fs.writeFileSync(path.join(soulForgeDir, 'memory.md'), '# Soul Forge Observations\n');

// 调用 handler
const handler = require('{WORKSPACE}/hooks/soul-forge-bootstrap/handler.js');
const event = {
  type: 'agent',
  action: 'bootstrap',
  context: {
    workspaceDir: testDir,
    bootstrapFiles: []
  }
};

handler(event);

// 检查结果
const updatedConfig = JSON.parse(fs.readFileSync(path.join(soulForgeDir, 'config.json'), 'utf-8'));
console.log('--- config.json after update ---');
console.log(JSON.stringify(updatedConfig, null, 2));

console.log('\n--- Checks ---');
console.log('status === calibrated:', updatedConfig.status === 'calibrated');
console.log('disc.primary === S:', updatedConfig.disc?.primary === 'S');
console.log('disc.secondary === C:', updatedConfig.disc?.secondary === 'C');
console.log('disc.confidence === high:', updatedConfig.disc?.confidence === 'high');
console.log('disc.scores.S === 5:', updatedConfig.disc?.scores?.S === 5);
console.log('modifiers.humor === 1:', updatedConfig.modifiers?.humor === 1);
console.log('modifiers.verbosity === 2:', updatedConfig.modifiers?.verbosity === 2);
console.log('calibration_history length > 0:', updatedConfig.calibration_history?.length > 0);
console.log('config_update.md deleted:', !fs.existsSync(path.join(soulForgeDir, 'config_update.md')));

console.log('\n--- Bootstrap injection ---');
const injected = event.context.bootstrapFiles[0];
console.log('injection file exists:', !!injected);
console.log('injection name:', injected?.name);
console.log('contains "calibrated":', injected?.content?.includes('calibrated'));
console.log('contains "S-type":', injected?.content?.includes('S-type'));

// 清理
fs.rmSync(testDir, { recursive: true, force: true });
console.log('\n--- All T1.3 checks complete ---');
```

**预期：** 所有 check 输出 `true`。

### T1.4 memory.md 解析测试

类似 T1.3，准备包含多条观察记录的 memory.md，验证：

- [x] 正常条目被正确解析
- [x] `modifier_hint` 的中英文方向词都能归一化（`降低` → `lower`，`提高` → `raise`）
- [x] CRYSTALLIZED 条目被识别
- [x] status=archived 的条目不计入 active
- [x] 格式略有偏差的条目（如 `modifier-hint` vs `modifier_hint`）能容错解析
- [x] 损坏条目被跳过，不影响其他条目

### T1.5 注入体积预算测试

准备 25+ 条 active 观察，验证注入内容 ≤ 3072 字节（3KB）。

### T1.6 Calibration Readiness 计算测试

准备以下 memory.md 内容：
- 6 条 `verbosity → lower`（active）
- 3 条 `humor → raise`（active）
- 2 条 `verbosity → lower`（archived，不应计入）

验证：
- `verbosity(lower)` = 6，标记 READY
- `humor(raise)` = 3，标记 not yet
- archived 条目未被计入

---

## 6. T2 — Bootstrap Hook 集成测试

**目的：** 验证 hook 在真实 OpenClaw 环境中被正确加载和执行。

### T2.1 Fresh 状态注入

**前置条件：** config.json status=fresh

**操作：** 启动 OpenClaw Agent（新会话）

**检查：**
```
[ ] Agent 启动时 hook 未报错
[ ] HEARTBEAT.md 被创建/包含 SOUL_FORGE_START 段
[ ] Agent 在某个时机建议用户运行 /soul-forge
```

### T2.2 Config.json 不存在但 .soul_forge/ 存在

**操作：** 删除 config.json（保留 .soul_forge/ 目录），重启 Agent

**预期：** handler.js 自动重建 config.json 为 `{"status":"fresh","version":1}`

### T2.3 Config.json 损坏

**操作：** 将 config.json 内容改为 `{broken json`，重启 Agent

**预期：**
```
[ ] 原文件被重命名为 config.json.corrupted
[ ] 新 config.json 为 {"status":"fresh","version":1}
[ ] errors.log 记录了损坏事件
```

### T2.4 .soul_forge/ 目录不存在

**操作：** 完全删除 .soul_forge/ 目录，重启 Agent

**预期：** handler.js 检测到目录不存在，直接 return，不注入任何内容，不报错。

---

## 7. T3 — Skill 首次问卷全流程

**目的：** 验证从 `/soul-forge` 命令到全部文件生成的完整首次校准流程。

### T3.0 前置状态

确保 config.json status=fresh，SOUL.md 和 IDENTITY.md 为原始内容。

### T3.1 隐私说明

**操作：** 输入 `/soul-forge`

**检查：**
```
[ ] Agent 先展示隐私说明（包含 .soul_forge/memory.md、/soul-forge pause 等信息）
[ ] 等待用户确认后才继续
[ ] 隐私说明语言与用户语言一致
```

### T3.2 语言检测

**操作：** 用中文回复"继续"

**预期：** 后续问卷、确认、演示全部使用中文

### T3.3 DISC 问卷（8 题）

**检查每道题：**
```
[ ] 一次呈现一道题
[ ] 选项顺序与 SKILL.md 源文件不同（已随机打乱）
[ ] 接受字母/数字/描述性回答
[ ] 没有暴露 DISC 类型映射
[ ] 8 题全部完成
```

**测试建议：** 故意全选偏向同一类型（如全选 S）以获得 high confidence 结果，方便后续验证。

### T3.4 计分与确认

**操作：** 完成 8 题后

**检查：**
```
[ ] Agent 展示主类型描述（特征 + 注意力聚焦）
[ ] 提供 3 级确认选项（很准 / 大致对 / 不太像我）
[ ] 选择「很准」后直接进入模板组装
```

**附加测试 — 选择「不太像我」：**
```
[ ] Agent 展示次高分类型描述
[ ] 如仍不满意，展示全部 4 类型供直接选择
```

### T3.5 SOUL.md 生成验证

**操作：** 用户确认类型后

**检查 SOUL.md 内容：**
```
[ ] H1 标题 "# SOUL.md - Who You Are" 保留
[ ] ## Core Truths 段包含 OpenClaw 原文 5 段（含 "genuinely helpful"）
[ ] ## Core Truths 段包含 Self-Calibration Protocol
[ ] ## Core Truths 段包含角色特定 Addon
[ ] ## Vibe 段为该角色的完整替换内容（非原始 "just... good"）
[ ] ## Boundaries 段包含 "Private things stay private"（OpenClaw 底包）
[ ] ## Boundaries 段包含角色特定 Addon
[ ] ## Continuity 段完整保留（原文不变）
[ ] 末尾有标记 [//]: # (soul-forge:v1:...)
[ ] 全部内容语言与用户语言一致（中文或英文）
```

**重要验证 — OpenClaw 底包保留：**

当前 SOUL.md 的 Core Truths 有 7 段（标准 5 段 + 2 段定制），Boundaries 有 5 条（标准 4 条 + 1 条定制）。观察 Agent 的处理：
```
[ ] Agent 是否保留了标准 5 段 Core Truths
[ ] Agent 是否丢弃了额外的 2 段定制内容（"When you're wrong..." 和 "Stay in your lane..."）
[ ] Agent 是否保留了标准 4 条 Boundaries
[ ] Agent 是否丢弃了额外的定制 Boundaries 条目
```

> **注意：** 按 SKILL.md 模板逻辑，Agent 使用嵌入的 OpenClaw 原始模板（标准 5 段）组装，不会保留已有定制内容。这是 MVP 的已知设计选择（见架构文档决策 #33：已有定制处理 — MVP 按全新处理）。确认此行为是否可接受。

### T3.6 IDENTITY.md 生成验证

**检查：**
```
[ ] 包含 ## Core 段（"You are a presence that is always there..."）
[ ] 元数据字段对应 DISC 类型（Name 保留占位符让 Agent 填写）
[ ] Creature / Vibe / Emoji 对应角色模板
[ ] Avatar 字段保留为占位符
```

### T3.7 config_update.md 生成验证

**检查 .soul_forge/config_update.md：**
```
[ ] 文件存在（在下次 bootstrap 前）
[ ] 包含 ## Action: calibration
[ ] 包含 ## DISC 段（primary/secondary/confidence/scores）
[ ] 包含 ## Modifiers 段（默认值 humor=1, verbosity=2, proactivity=1, challenge=0）
[ ] 包含 ## Status: calibrated
[ ] 包含 ## Reason
```

### T3.8 快照验证

**检查 .soul_history/：**
```
[ ] 目录已创建
[ ] SOUL_INIT.md 存在（内容为校准前的原始 SOUL.md）
[ ] IDENTITY_INIT.md 存在（内容为校准前的原始 IDENTITY.md）
[ ] changelog.md 存在，包含 v1 条目
```

### T3.9 效果对比演示

**检查：**
```
[ ] Agent 展示了"校准前"和"校准后"两种风格的对比
[ ] 对比内容与 DISC 类型一致（如 D-Advisor 的对比应展示简洁 vs 冗长）
[ ] 对比自然可读，不是技术性 diff
```

### T3.10 安装后偏好首问

**检查：**
```
[ ] Agent 问了回复长度/详细程度偏好
[ ] 用户回答后，memory.md 新增一条 active 观察记录
[ ] 观察记录格式正确（type/signal/inference/modifier_hint/status 字段完整）
```

### T3.11 交付验证（Agent 内部）

Agent 应在完成后内部自检 11 项。无法直接观察，但可以通过结果间接验证所有文件是否齐备。

### T3.12 下次 Bootstrap 后 config.json 验证

**操作：** 完成问卷后，重启 Agent（触发新的 bootstrap）

**检查：**
```
[ ] config.json 已更新：status=calibrated
[ ] config.json 包含 disc 字段（primary/secondary/confidence/scores）
[ ] config.json 包含 modifiers 字段（默认值）
[ ] config.json 包含 calibration_history（至少一条记录）
[ ] config_update.md 已被删除
[ ] bootstrap 注入内容变为完整校准上下文（含 Status、Active Modifiers、Recording Format 等）
```

---

## 8. T4 — HEARTBEAT 观察测试

**目的：** 验证 Heartbeat 定期回合能正确检查对话并写入观察。

### T4.1 Heartbeat 配置

确认 OpenClaw 的 heartbeat 配置。如果没有自定义配置，使用默认值（30 分钟）。

测试时建议临时缩短间隔以加速验证：

```json5
// 在 OpenClaw 配置中（如果支持）
{
  agents: {
    defaults: {
      heartbeat: {
        every: "5m"  // 测试时缩短到 5 分钟
      }
    }
  }
}
```

### T4.2 制造可观察信号

在 Agent 对话中故意触发人格信号：

**回复长度信号：**
> "说重点，别啰嗦"

**语气信号：**
> "能不能轻松一点？太正式了"

**情绪信号：**
> 表现出明显沮丧的语气

**边界信号：**
> "以后别自动帮我做 X"

### T4.3 等待 Heartbeat 触发

等待 Heartbeat 回合触发（观察对话中是否有静默的系统活动）。

### T4.4 检查 memory.md

**验证：**
```
[ ] memory.md 新增了观察条目
[ ] 条目格式正确：## YYYY-MM-DD HH:MM 标题
[ ] 包含 type 字段（style/emotion/boundary/decision）
[ ] 包含 signal 字段（引用了实际对话内容）
[ ] 包含 inference 字段
[ ] 包含 modifier_hint 字段（指向具体 modifier 和方向）
[ ] 包含 status: active
[ ] 没有写入 MEMORY.md（铁律）
```

### T4.5 无信号时的静默

**操作：** 进行一段纯技术性对话（无人格信号），等待 Heartbeat

**预期：** memory.md 无新增条目（Heartbeat 判定 ALL neutral → 跳过）

---

## 9. T5 — 校准流程测试

**目的：** 验证 `/soul-forge calibrate` 命令的 BDI 决策和修饰符更新。

### T5.1 手动注入测试数据（加速方法）

直接编辑 `{WORKSPACE}\.soul_forge\memory.md`，追加 6 条同方向观察：

```markdown
## 2026-02-10 10:00
- **type**: style
- **signal**: [测试] 用户说"回复太长了"
- **inference**: 偏好简洁回复
- **modifier_hint**: verbosity → lower
- **status**: active

## 2026-02-10 11:00
- **type**: style
- **signal**: [测试] 用户说"说重点"
- **inference**: 不喜欢冗长开场白
- **modifier_hint**: verbosity → lower
- **status**: active

## 2026-02-10 14:00
- **type**: style
- **signal**: [测试] 用户直接跳过了长回复
- **inference**: 长回复被忽略
- **modifier_hint**: verbosity → lower
- **status**: active

## 2026-02-11 09:00
- **type**: style
- **signal**: [测试] 用户说"太啰嗦了"
- **inference**: 明确表达简洁偏好
- **modifier_hint**: verbosity → lower
- **status**: active

## 2026-02-11 15:00
- **type**: style
- **signal**: [测试] 用户多次发送极短消息
- **inference**: 用户自身沟通风格简洁
- **modifier_hint**: verbosity → lower
- **status**: active

## 2026-02-12 10:00
- **type**: style
- **signal**: [测试] 用户说"简短一点"
- **inference**: 再次要求简洁
- **modifier_hint**: verbosity → lower
- **status**: active
```

### T5.2 验证 Calibration Readiness

**操作：** 重启 Agent（触发 bootstrap）

**检查 bootstrap 注入内容应包含：**
```
verbosity(lower): 6 observations — READY
```

### T5.3 Heartbeat 建议校准

**操作：** 等待 Heartbeat 触发

**预期：** Heartbeat 检测到 READY 状态，建议用户运行 `/soul-forge calibrate`

### T5.4 执行校准命令

**操作：** 输入 `/soul-forge calibrate`

**检查：**
```
[ ] Agent 用自然语言描述发现（如"我注意到你更喜欢简短直接的回复"）
[ ] 不使用技术术语（不说"modifier"/"verbosity score"等）
[ ] 等待用户确认
```

### T5.5 确认后的文件变更

用户确认后：

```
[ ] config_update.md 被写入（modifiers.verbosity 从 2 变为 1）
[ ] SOUL.md 重新生成（Vibe 段可能包含简洁相关叠加文本）
[ ] memory.md 中相关 6 条 → status: archived
[ ] memory.md 新增一条 CRYSTALLIZED 汇总条目
[ ] .soul_history/ 新增快照
[ ] changelog.md 新增 calibrate 记录
```

### T5.6 下次 Bootstrap 验证

**操作：** 重启 Agent

**检查：**
```
[ ] config.json modifiers.verbosity = 1
[ ] config_update.md 已被删除
[ ] bootstrap 注入的 Active Modifiers 反映新值
```

---

## 10. T6 — 状态命令测试

### T6.1 /soul-forge pause

**前置条件：** status=calibrated

**操作：** 输入 `/soul-forge pause`

**检查：**
```
[ ] Agent 确认暂停
[ ] config_update.md 写入 status: paused
[ ] 下次 bootstrap 后 config.json status=paused
[ ] bootstrap 注入内容为简略版（只有状态和修饰符，无观察数据）
[ ] 注入包含 "Observation paused"
```

### T6.2 Heartbeat 在 paused 状态下的行为

**操作：** 在 paused 状态下等待 Heartbeat

**预期：** Heartbeat 检测到 paused 状态，跳过所有 Soul Forge 检查，不写 memory.md

### T6.3 /soul-forge resume

**前置条件：** status=paused

**操作：** 输入 `/soul-forge resume`

**检查：**
```
[ ] Agent 确认恢复
[ ] config_update.md 写入 status: calibrated
[ ] 下次 bootstrap 后恢复完整校准上下文注入
```

### T6.4 paused 状态下调用 /soul-forge

**操作：** 在 paused 状态下输入 `/soul-forge`

**预期：** 显示选择菜单（恢复观察 / 重新校准 / 查看当前配置）

### T6.5 paused 状态下调用 /soul-forge calibrate

**操作：** 在 paused 状态下输入 `/soul-forge calibrate`

**预期：** Agent 提示需要先 resume（"请先运行 /soul-forge resume"）

### T6.6 fresh 状态下调用非 /soul-forge 命令

**操作：** 在 fresh 状态下输入 `/soul-forge calibrate`

**预期：** Agent 提示需要先完成初始设置

---

## 11. T7 — 容错与边界测试

### T7.1 HEARTBEAT.md 被误删

**操作：** 删除 HEARTBEAT.md 中的 Soul Forge 段（保留文件其余内容），重启 Agent

**预期：** handler.js 检测到缺失并自动重新追加 Soul Forge 段

### T7.2 HEARTBEAT.md 完全删除

**操作：** 删除整个 HEARTBEAT.md 文件，重启 Agent

**预期：** handler.js 创建新的 HEARTBEAT.md（包含 Soul Forge 段）

### T7.3 SOUL.md 结构损坏

**操作：** 手动删除 SOUL.md 中的 `## Vibe` 段，重启 Agent

**预期：**
```
[ ] handler.js 检测到结构不完整
[ ] 如果 .soul_history/ 有快照 → 自动从快照恢复
[ ] 如果无快照 → bootstrap 注入 Warning 提示 Agent 修复
[ ] errors.log 记录了损坏事件
```

### T7.4 memory.md 包含损坏条目

**操作：** 在 memory.md 中插入一段格式严重错误的内容（如乱码），然后在其后追加正常条目

**预期：** handler.js 跳过损坏条目，正确解析其他条目，不崩溃

### T7.5 config_update.md 格式异常

**操作：** 写入一个缺少关键字段的 config_update.md

**预期：** handler.js 尝试处理，部分成功或记录错误到 errors.log，不损坏现有 config.json

### T7.6 handler.js 事件类型过滤

**操作：** handler.js 应只响应 `agent:bootstrap` 事件

**验证：** 在 T1 单元测试中，传入其他事件类型（如 `{type: 'command', action: 'new'}`），handler 应直接 return。

---

## 12. T8 — 隐私拒绝测试

### T8.1 用户拒绝隐私说明

**前置条件：** status=fresh

**操作：** 输入 `/soul-forge`，在隐私说明出现后回复"不"或"算了"

**检查：**
```
[ ] Agent 确认不会收集数据
[ ] config_update.md 写入 status: declined
[ ] 未修改 SOUL.md
[ ] 未修改 IDENTITY.md
[ ] 未修改 memory.md
[ ] 流程完全停止
```

### T8.2 declined 状态下的 Bootstrap 注入

**操作：** 重启 Agent（bootstrap 处理 config_update.md 后 config.json 变为 declined）

**预期：**
```
[ ] bootstrap 注入极简内容（只包含 "declined" 状态）
[ ] 不注入观察数据
[ ] 不修复 HEARTBEAT.md
[ ] 不提示用户运行 /soul-forge
```

### T8.3 declined 后重新开始

**操作：** 在 declined 状态下输入 `/soul-forge`

**预期：** 重新展示隐私说明，用户同意后进入问卷流程

### T8.4 declined 状态下的 Heartbeat

**操作：** 等待 Heartbeat 触发

**预期：** Heartbeat 检测到 declined 状态，跳过所有 Soul Forge 检查

---

## 13. T9 — 重置与恢复测试

### T9.1 正常重置（有快照）

**前置条件：** status=calibrated，.soul_history/ 存在且有 SOUL_INIT.md

**操作：** 输入 `/soul-forge reset`

**检查：**
```
[ ] SOUL.md 恢复到 SOUL_INIT.md 的内容
[ ] IDENTITY.md 恢复到 IDENTITY_INIT.md 的内容
[ ] HEARTBEAT.md 中 Soul Forge 段被移除
[ ] config_update.md 写入 status: dormant
[ ] memory.md 未被删除（保留）
[ ] .soul_history/ 未被删除（保留）
[ ] Agent 告知用户"已重置"
```

### T9.2 重置后 Bootstrap 行为

**操作：** 重启 Agent

**预期：** bootstrap 注入 dormant 状态，包含 "Run /soul-forge to re-enable" 提示

### T9.3 从 dormant 恢复

**操作：** 在 dormant 状态下输入 `/soul-forge`

**预期：** Agent 询问"恢复之前的配置还是重新开始"

**选择「恢复」：**
```
[ ] 使用 config.json 中保存的 DISC 类型和修饰符重新生成 SOUL.md
[ ] status → calibrated
```

**选择「重新开始」：**
```
[ ] 重跑完整问卷流程
[ ] memory.md 保留
```

### T9.4 .soul_history/ 缺失时的重置

**操作：** 删除 .soul_history/ 目录后输入 `/soul-forge reset`

**预期：**
```
[ ] Agent 告知用户"备份文件缺失，无法恢复到安装前状态"
[ ] 提供选择：仅设为静默模式 / 取消重置
[ ] 不会崩溃或报错
```

---

## 14. T10 — 端到端全生命周期

**目的：** 跑通一个完整的用户使用周期，从安装到观察到校准。

### 生命周期流程

```
Step 1: 首次安装
  fresh → /soul-forge → 隐私说明 → 同意 → 问卷 → 确认 → 生成 → 演示 → 首问
  → status = calibrated

Step 2: 日常使用
  正常对话 → Heartbeat 观察 → memory.md 积累

Step 3: 校准触发（使用加速数据）
  手动注入 6 条同方向观察 → 重启 → Heartbeat 检测 READY → 建议校准

Step 4: 执行校准
  /soul-forge calibrate → BDI 决策 → 用户确认 → 修饰符更新 → SOUL.md 更新

Step 5: 暂停
  /soul-forge pause → 观察停止

Step 6: 恢复
  /soul-forge resume → 观察继续

Step 7: 重新校准
  /soul-forge recalibrate → 重跑问卷（选择不同类型）→ SOUL.md 变为新类型

Step 8: 重置
  /soul-forge reset → 恢复到安装前状态

Step 9: 重新启用
  /soul-forge → 从 dormant 恢复或重新开始
```

### 各步骤检查点

**Step 1 后检查：**
```
[ ] SOUL.md 包含角色模板内容
[ ] IDENTITY.md 包含 Core 段
[ ] config.json 将在下次 bootstrap 后变为 calibrated
[ ] .soul_history/ 有快照
[ ] memory.md 有至少 1 条观察（首问）
```

**Step 4 后检查：**
```
[ ] 修饰符值已改变
[ ] SOUL.md Vibe 段反映新修饰符
[ ] memory.md 有 CRYSTALLIZED 条目
```

**Step 7 后检查：**
```
[ ] SOUL.md 为新的 DISC 类型模板
[ ] memory.md 保留（旧观察仍在）
[ ] 修饰符值保留（不因 DISC 类型改变而重置）
```

**Step 8 后检查：**
```
[ ] SOUL.md 恢复到安装前内容
[ ] AI 行为回归默认
[ ] 校准数据保留在 .soul_forge/ 中
```

---

## 15. 测试加速方法

### 15.1 跳过 Heartbeat 等待

不必等待 Heartbeat 自然积累观察。直接编辑 memory.md 注入预制数据（见 T5.1 节的模板）。

### 15.2 缩短 Heartbeat 间隔

测试期间将 heartbeat 间隔缩短到 2-5 分钟（如果 OpenClaw 配置支持）。

### 15.3 手动触发 Bootstrap

每次修改 config_update.md 或 config.json 后，重启 Agent（或开启新会话）即可触发 bootstrap。

### 15.4 直接检查文件

不必等待 Agent 行为变化，直接用文本编辑器或命令行检查文件内容：

```bash
# 检查 config.json
type "%WORKSPACE%\.soul_forge\config.json"

# 检查 memory.md
type "%WORKSPACE%\.soul_forge\memory.md"

# 检查 errors.log
type "%WORKSPACE%\.soul_forge\errors.log"

# 检查 bootstrap 是否处理了 config_update.md
dir "%WORKSPACE%\.soul_forge\config_update.md" 2>nul && echo EXISTS || echo DELETED
```

---

## 16. 已知限制与预期偏差

| 项目 | 已知限制 | 影响 |
|------|---------|------|
| 问卷选项随机化 | Agent 的"随机"取决于 LLM，可能不够均匀 | 低 — 不影响功能 |
| Phase 1 伪装问答频率 | "每 3 次对话 1 次"无法精确控制（无跨会话记忆） | 低 — MVP 已知限制 |
| 修饰符叠加文本 | MVP 使用默认修饰符值（humor=1 无叠加文本），需 calibrate 后才能看到叠加效果 | 低 — 预期行为 |
| OpenClaw 底包差异 | 当前 SOUL.md 有 7 段 Core Truths（vs 模板 5 段），Skill 模板只嵌入了标准 5 段 | 中 — 定制内容会被替换 |
| IDENTITY.md Name 字段 | 模板为占位符，Agent 需自行生成名字或保留 | 低 — 观察实际行为 |
| handler.js CommonJS vs ESM | 主包为 ESM，handler 为 CommonJS，依赖 `import()` 的自动包装 | 中 — 需在 T2 中验证 |
| Heartbeat 间隔 | 默认 30 分钟，测试周期较长 | 用加速方法绕过 |
| config.json 损坏 + declined 交集 | 极端边缘：config 损坏重建为 fresh 会覆盖 declined 状态 | 极低概率，MVP 接受 |

---

## 17. 测试结果记录模板

每个测试用例完成后，按以下格式记录结果：

```markdown
### T{X}.{Y} — {测试名称}

**日期：** YYYY-MM-DD
**状态：** PASS / FAIL / PARTIAL / SKIP
**实际行为：**

（描述实际观察到的行为）

**与预期的偏差：**

（如果有偏差，描述偏差内容和严重程度）

**文件快照：**

（如需要，贴出关键文件内容片段）

**后续行动：**

（如有 bug，记录 bug 描述和修复方向）
```

---

**文档结束**

*建议执行顺序：T1 → T2 → T3 → T8 → T6 → T7 → T4 → T5 → T9 → T10*
*T1 可离线完成，T2-T3 是核心验证，T8 和 T6 可独立测试，T4-T5 需要等待或加速，T10 作为最终验收。*
