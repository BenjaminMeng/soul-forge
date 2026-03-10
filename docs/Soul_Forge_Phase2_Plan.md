# Soul Forge Phase 2 规划文档

> **版本：** v1.0
> **日期：** 2026-02-19
> **基线：** MVP Phase 1 (R37, 2026-02-18)
> **依据：** Architecture v3.1 + 苏格拉底问答 29 轮确认

---

## 1. Phase 2 目标

**一句话：** 让 Soul Forge 能被更多人用、用得更好。

- **分发适配**：降低安装门槛，覆盖主流模型
- **问卷升级**：场景化选项 + 双轴提取 + 仪式感
- **观察体系完善**：三阶段探测 + 精确频率控制
- **工程健壮性**：Pre-flight Check + Schema 迁移 + reset 命令

---

## 2. 确认清单总览

### 2.1 Phase 2 纳入项

| ID | 项目 | 来源 | 简述 |
|----|------|------|------|
| P2-01 | 问卷改版 | 苏格拉底 Q8-Q12 | 场景化选项 + 双轴（DISC主轴 + modifier副轴）提取 |
| P2-02 | 结果展示强约束 | 苏格拉底 Q12 | 描述"用户想要的AI助手"，而非"用户是什么人" |
| P2-03 | 模型适配 | 苏格拉底 Q12, Q28 | 7 模型测试 + SKILL.md Agent 自识别条件指令 |
| P2-04 | P2 Pre-flight Check | Architecture P2 → Q16 | config.json schema 校验 + 文件完整性 + 异常恢复提示 |
| P2-05 | P3 三阶段发现 | Architecture P3 → Q15 | 问卷初值 → Heartbeat 微调 → 主动探测 |
| P2-06 | 探测频率控制 | Architecture #78 → Q20, Q22, Q25 | 双门槛 + 信号缺口优先 + 成熟期停止 + 版本重置 |
| P2-07 | P5 reset 命令 | Architecture P5 → Q17 | `/soul-forge reset`（不含 rollback） |
| P2-08 | 老用户参数推断 | Architecture #34 → Q23 | 从已有 SOUL.md 推断有明显信号的 modifier |
| P2-09 | answers_hash + q_version | Architecture #100 → Q20 | 问卷版本追踪 + 答案哈希 + 变更检测 |
| P2-10 | 版本管理 / Schema 迁移 | 调研发现 → Q21 | config.json version 1→2 迁移机制 |
| P2-11 | modifier 缺失兜底 | Architecture #34 → Q18 | 统一中间值 1，不基于 DISC 类型假设 |
| P2-12 | 分发 | 苏格拉底总结 | ClawHub Skill（Phase 1）+ Plugin（Phase 2）并行 |
| P2-13 | 隐私开场改版 | 苏格拉底 Q11 | 方向 B：对话式自然引入，替代当前结构化隐私说明 |
| P2-14 | 老用户融合选项 | Architecture 10.2 补回 | 内容比对 + 融合 UI + user_customizations.json |

### 2.2 延后至 Phase 3

| ID | 项目 | 延后原因 |
|----|------|---------|
| P3-01 | P1 collector Hook | Heartbeat 打磨优先，Phase 2 不增加第二个 Hook |
| P3-02 | P4 memory.md 归档 | 短期文件膨胀不构成实际问题 |
| P3-03 | P5 rollback 命令 | reset 够用，rollback 需要历史快照管理，复杂度高 |
| P3-04 | #64 信号质量加权 | 等数据积累后做数据分析再决定权重 |
| P3-05 | modifier Agent 推断（B方案） | Phase 2 用预定义映射表（A），Phase 3 数据驱动后引入 |

---

## 3. 各项详细设计

### 3.1 问卷改版（P2-01, P2-02, P2-13）

#### 3.1.1 结构

- **题数：** 8 题不变
- **选项数：** 4 个不变（α/β/γ/δ）
- **主轴：** DISC 硬评分（每选项映射一个 DISC 类型，与 Phase 1 相同）
- **副轴：** modifier 预定义映射表（每选项携带 modifier 权重信号）
- **评分方式：** DISC 主轴用映射表硬算；modifier 副轴由 Agent 综合判断最终初始值

#### 3.1.2 副轴映射规则

Phase 2 采用 **预定义映射表（方案 A）**：
- 为 32 个选项（8题×4选项）逐一标注 modifier 权重
- 格式类似 DISC 列：每选项增加 modifier 信号列
- Agent 根据用户的 8 个选择，综合映射表给出 modifier 初始值
- 缺失信号的 modifier 使用统一中间值 1

Phase 3 在数据积累后引入 **Agent 推断（方案 B）** 作为加权补充。

#### 3.1.3 问卷风格

- **场景化日常决策题**：选项体现日常场景中的偏好，不直接暴露 DISC 意图
- **高端产品个性化 + 对话式探索**的混合感觉
- 选项措辞更自然，降低"一眼看穿"的透明感

#### 3.1.4 隐私开场

采用 **方向 B：对话式自然引入**，替代当前结构化隐私说明。
- 将隐私告知融入开场对话，而非独立的法律声明式文本
- 保留所有必要信息（收集什么、存在哪里、如何控制、如何退出）
- 语气温暖自然

#### 3.1.5 结果展示

采用 **方向 C（人格描述 + 对比确认）**，附带强约束：
- **强约束：** 结果描述的是"用户希望的 AI 助手是什么样的"，**绝不是**"用户是什么样的人"
- 展示校准后 AI 的行为特征描述
- 保留现有效果演示（Section G before/after 对比）
- 保留命名邀请和安装后偏好首问

---

### 3.2 模型适配（P2-03）

#### 3.2.1 目标模型

| 优先级 | 模型 |
|--------|------|
| P0 | Kimi K2.5, Gemini 3 Flash, Claude Sonnet 4.5, GLM-5 |
| P1 | MiniMax M2.5, DeepSeek V3.2, GPT-5.1 Codex |

#### 3.2.2 适配方式

**A（测试验证 + 措辞调优）：**
- 在每个目标模型上跑完整流程（问卷 → 校准 → Heartbeat → calibrate）
- 记录问题点，调整 SKILL.md 措辞（如增加 MANDATORY 标记密度）
- 目标：一个 SKILL.md 覆盖所有模型

**B（模型检测 + 条件指令）：**
- SKILL.md 中使用 Agent 自识别机制（Agent 知道自己是什么模型）
- 针对不同模型给出不同强度的指令约束
- **不做** handler.js 模型检测（bootstrap event 不传递模型信息）
- **不做** 多版本 SKILL.md（维护成本高，用户切换模型易出错）

---

### 3.3 三阶段探测（P2-05, P2-06）

#### 3.3.1 三阶段定义

| 阶段 | 时间范围 | 策略 | 机制 |
|------|---------|------|------|
| Stage 1 | 第 1-14 天 | 伪装问答 | 展示两种表达方式让用户选择，伪装为语言好奇 |
| Stage 2 | 第 15-30 天 | 风格试探 | AI 偶尔尝试不同风格，观察用户反应 |
| Stage 3 | 第 30 天+ | 成熟期 | 纯观察，停止所有主动探测 |

#### 3.3.2 频率控制

由 handler.js 精确控制，替代 Phase 1 的 "best effort"。

**Stage 1 频率参数（暂定，后续数据驱动调优）：**

| 边界 | 会话数 | 天数 | 逻辑 | 触发条件 |
|------|--------|------|------|---------|
| 下限 | ≥ 3 次 | 且 ≥ 1 天 | 防止高频用户被轰炸 | 两个都满足才允许 |
| 上限 | ≥ 7 次 | 或 ≥ 5 天 | 确保低频用户不被遗漏 | 任一满足就触发 |

**Stage 2 频率参数（暂定）：**

| 边界 | 会话数 | 天数 | 逻辑 | 触发条件 |
|------|--------|------|------|---------|
| 下限 | ≥ 5 次 | 且 ≥ 2 天 | 比 Stage 1 更宽松 | 两个都满足才允许 |
| 上限 | ≥ 10 次 | 或 ≥ 7 天 | 同理 | 任一满足就触发 |

#### 3.3.3 探测目标选择

- 信号缺口决定**优先级**：每次探测选置信度最低的 modifier
- 信号缺口**不决定**是否触发：探测按频率控制执行，缺口只影响先测哪个

#### 3.3.4 成熟期停止

- 第 30 天后自动停止所有主动探测
- 仅保留 Heartbeat 被动观察

#### 3.3.5 版本更新重置

- handler.js 检测 `q_version` 不匹配时，重置 `probe_phase_start` 为当前时间
- 即使用户已在成熟期（30天+），探测周期归零，重新走 Stage 1→2→3

#### 3.3.6 handler.js 注入段

bootstrap 注入新增 `## Probing Control` 段：

```
## Probing Control
style_probe_allowed: true | stage: 1 | target: humor (lowest confidence)
```

- `style_probe_allowed`: Agent 探测的唯一判断依据
- `stage`: 告诉 Agent 当前用 Stage 1（问答）还是 Stage 2（试探）方式
- `target`: 信号缺口最大的 modifier

#### 3.3.7 SKILL.md Section M 替换

Phase 1 的 Section M（单一伪装探测）整体替换为三阶段定义。不保留旧版，不做向后兼容。

**不变的部分：**
- SOUL.md Self-Calibration Protocol（通用被动观察指令）
- HEARTBEAT.md 检查段（6 个检查问题）

---

### 3.4 Pre-flight Check 完善（P2-04）

#### 3.4.1 检查项

handler.js 启动时增加以下校验：

1. **config.json schema 校验**：必需字段存在且类型正确
2. **文件完整性**：SOUL.md、memory.md、config.json 三个运行时文件是否存在
3. **版本兼容性**：config.json version 字段是否与当前 handler.js 兼容
4. **异常状态恢复提示**：文件损坏或缺失时注入警告，不静默重置
5. **老用户状态检测**：config.json 缺失/fresh + SOUL.md 存在且非默认模板 → 注入状态 2 标记，触发 SKILL.md 融合流程（见 3.11）

#### 3.4.2 与 Schema 迁移配合

Pre-flight Check 检测到 `version: 1` 时，先执行 Schema 迁移（见 3.5），再进行后续流程。

---

### 3.5 版本管理 / Schema 迁移（P2-10）

#### 3.5.1 config.json v2 完整 Schema

```json
{
  "version": 2,
  "status": "fresh | calibrated | paused | dormant | declined",
  "disc": {
    "primary": "S",
    "secondary": "C",
    "confidence": "high | medium | low",
    "scores": {"D": 1, "I": 2, "S": 5, "C": 4},
    "answers_hash": "abc123"
  },
  "modifiers": {
    "humor": 1,
    "verbosity": 1,
    "proactivity": 1,
    "challenge": 1
  },
  "q_version": 2,
  "probe_phase_start": "2026-03-01T10:00:00Z",
  "last_style_probe": "2026-03-05T14:00:00Z",
  "probe_session_count": 3,
  "boundaries_preference": "default",
  "merge_failed": false,
  "calibration_history": [],
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-01T10:00:00Z"
}
```

#### 3.5.2 新增字段说明

| 字段 | 位置 | 类型 | 用途 |
|------|------|------|------|
| `q_version` | 顶层 | number | 问卷版本号 |
| `disc.answers_hash` | disc 内 | string | 答案 MD5 短串，检测重复提交 |
| `probe_phase_start` | 顶层 | ISO timestamp | 探测阶段起始时间 |
| `last_style_probe` | 顶层 | ISO timestamp | 上次探测时间 |
| `probe_session_count` | 顶层 | number | 距上次探测的会话计数 |

#### 3.5.3 迁移策略（version 1 → 2）

| 字段 | 迁移默认值 | 理由 |
|------|-----------|------|
| `q_version` | 1 | Phase 1 问卷 |
| `disc.answers_hash` | null | Phase 1 未记录，无法回溯 |
| `probe_phase_start` | `created_at` | 近似用户开始使用的时间 |
| `last_style_probe` | null | 从未被 handler.js 追踪 |
| `probe_session_count` | 0 | 起始计数 |
| modifiers（已有值） | 保留不变 | Phase 1 用户数据不受影响 |

#### 3.5.4 handler.js 默认值更新

```javascript
// Phase 1:
// config.modifiers = { humor: 1, verbosity: 2, proactivity: 1, challenge: 0 };

// Phase 2:
config.modifiers = { humor: 1, verbosity: 1, proactivity: 1, challenge: 1 };
```

仅影响 modifiers 完全缺失的边缘情况。已有用户的 modifier 值已存在于 config.json，不会触发。

---

### 3.6 reset 命令（P2-07）

Phase 1 已完整实现 `/soul-forge reset`。Phase 2 适配新字段的交互规则：

| 字段类型 | 字段 | reset 时处理 | 理由 |
|---------|------|-------------|------|
| 历史记录 | `q_version` | 保留 | dormant 恢复时需要比对问卷版本 |
| 历史记录 | `disc.answers_hash` | 保留 | 同上 |
| 运行时状态 | `probe_phase_start` | 清为 null | dormant 状态无探测 |
| 运行时状态 | `last_style_probe` | 清为 null | 同上 |
| 运行时状态 | `probe_session_count` | 清为 0 | 同上 |

用户从 dormant 重新激活并完成校准后，`probe_phase_start` 设为当前时间，开始新的探测周期。

---

### 3.7 老用户参数推断（P2-08）

#### 3.7.1 触发条件

Pre-flight Check 检测到已有 SOUL.md 定制内容（非默认）且 config.json 为 fresh 状态 → 判定为老用户。

#### 3.7.2 推断规则

- 只推断有明显信号的 modifier（如 SOUL.md 中写了"回复要简洁" → verbosity 偏低）
- 没有信号的 modifier 使用统一中间值 1
- 推断全部 4 个 modifier，但只有有信号的才赋非中间值

#### 3.7.3 后续处理

- 推断结果直接写入 config（不需用户确认）
- 通过三阶段主动探测逐步验证和完善
- 如果用户后来做了问卷，问卷结果覆盖推断值

---

### 3.8 answers_hash + q_version（P2-09）

#### 3.8.1 写入时机

问卷完成时，SKILL.md 在 config_update.md 中写入：

```markdown
## Questionnaire
- **q_version**: 2
- **answers_hash**: abc123
```

#### 3.8.2 检测逻辑

handler.js 在 bootstrap 时：
- 比对 config.json 中的 `q_version` 与当前内置最新版本号
- 不匹配 → 注入提示："问卷已更新，建议使用 `/soul-forge recalibrate` 重新校准"
- 同时重置 `probe_phase_start`（见 3.3.5）

#### 3.8.3 recalibrate 交互

recalibrate 时检查 `disc.answers_hash`：
- 新答案哈希与旧值相同 → 提示"你的选择和上次完全一样，确定要重新校准吗？"
- 不同 → 正常流程

#### 3.8.4 recalibrate modifier 处理（按触发原因区分）

| 触发方式 | DISC 类型 | Modifier 处理 |
|---------|-----------|--------------|
| 用户主动 recalibrate | 用新问卷结果 | 问卷副轴值作为新起点，重新进入探测周期 |
| 版本更新触发 recalibrate | 用新问卷结果 | **保留已有 Heartbeat 微调值**，不用副轴覆盖 |

实现：config_update.md `## Reason` 标注触发类型（`user_initiated` / `version_update`），handler.js 据此决定是否覆盖 modifier。

---

### 3.9 modifier 缺失兜底（P2-11）

所有未提取到信号的 modifier 统一使用中间值 **1**（0-3 范围）。

不基于 DISC 类型假设默认值——Phase 1 的模板默认值策略被替换。

---

### 3.10 分发（P2-12）

并行两条路径：
- **ClawHub Skill**：快速上架获取市场存在感。Skill 首次运行时通过 exec 自安装 Hook。
- **Plugin**：完整体验。openclaw.plugin.json 原生注册 Skill + Hook。

---

### 3.11 老用户融合选项（P2-14）

#### 3.11.1 触发条件

Pre-flight Check 检测到 **状态 2（已定制内容）**：
- config.json 不存在 或 status=fresh
- SOUL.md 存在且内容不匹配原始模板（用户有已有定制）

> 注意：与 P2-08（参数推断）协作——P2-08 负责从已有内容推断 modifier 值，P2-14 负责内容层面的融合处理。两者在同一流程中依次执行。

#### 3.11.2 内容检测

Agent 在 Assembly Step 1 中执行以下检测：

1. **IDENTITY.md 字段检测**：对比占位符列表，判断各字段是否已被用户填写
2. **SOUL.md 段落检测**：对比原始模板，判断各 `## H2` 段是否被用户修改
3. **检测结果持久化**：保存到 `.soul_history/user_customizations.json`

```json
{
  "detected_at": "2026-03-01T10:00:00Z",
  "identity_fields": {
    "name": true,
    "role": false,
    "background": true
  },
  "soul_sections": {
    "Core Truths": false,
    "Vibe": true,
    "Boundaries": true,
    "Continuity": false
  },
  "inferred_modifiers": {
    "verbosity": 1,
    "humor": 2
  }
}
```

#### 3.11.3 融合 UI

检测完成后，向用户展示已有定制内容摘要 + 参数推断建议，并提供三个选择：

| 选项 | 行为 | 适用场景 |
|------|------|---------|
| **使用新配置** | 问卷结果覆盖所有内容，已有定制存入快照 | 用户想重新开始 |
| **融合已有内容** | 问卷结果 + 保留用户已定制的段落（非 Soul Forge 管辖段不动） | 用户想保留个性化调整 |
| **回滚** | 取消操作，恢复到安装前状态（从 `.soul_history/` 快照恢复） | 用户不想继续 |

**融合规则：**
- Soul Forge 管辖段（Core Truths/Vibe/Boundaries）：用问卷结果覆盖
- 用户自定义段（Continuity + 其他非管辖段）：保留用户内容
- IDENTITY.md 已填写字段：保留用户填写的值
- 快照保存在融合前执行，确保原始内容不丢失

#### 3.11.4 与其他功能的关系

| 关联项 | 关系 |
|--------|------|
| P2-04 Pre-flight Check | Pre-flight Check 检测状态 2 后触发融合流程 |
| P2-08 参数推断 | 融合检测阶段同时执行 modifier 推断，推断结果展示在融合 UI 中 |
| P2-07 reset | reset 后 status=dormant，重新激活时如检测到定制内容走融合流程 |
| config.json `merge_failed` | 融合写入失败时标记，下次降级处理（跳过 Continuity 拼接） |

---

## 4. 文件变更清单

### 4.1 handler.js 变更

| 区域 | 变更类型 | 内容 |
|------|---------|------|
| 常量 | 修改 | `MAX_INJECT_BYTES`: 3072 → 6144 |
| 常量 | 修改 | `FRESH_CONFIG`: 增加 v2 新字段 |
| 常量 | 新增 | 探测频率参数常量（Stage 1/2 上下限） |
| `parseConfigUpdate()` | 扩展 | 新增 `questionnaire`、`probing` section 解析 |
| `processConfigUpdate()` | 扩展 | 新增 q_version、answers_hash、探测字段写入 |
| main handler | 新增 | Schema 迁移逻辑（version 1 → 2） |
| main handler | 新增 | Pre-flight Check 增强（schema 校验 + 文件完整性 + 老用户状态检测） |
| main handler | 新增 | q_version 比对 + 注入警告 |
| main handler | 新增 | probe_session_count 递增逻辑 |
| `generateInjection()` | 扩展 | 新增 `## Probing Control` 段 |
| `generateInjection()` | 扩展 | 新增 `## Warnings` 段（条件注入） |
| 默认 modifiers | 修改 | `{h:1,v:2,p:1,c:0}` → `{h:1,v:1,p:1,c:1}` |

### 4.2 SKILL.md 变更

| Section | 变更类型 | 内容 |
|---------|---------|------|
| A. Privacy Notice | 重写 | 对话式自然引入 |
| B. Questionnaire | 重写 | 场景化选项 + modifier 副轴映射列 |
| C. Scoring Logic | 扩展 | 新增副轴 modifier 提取逻辑 |
| D. User Confirmation | 修改 | 结果描述强约束（AI助手视角） |
| F. Assembly Step 1 | 扩展 | 老用户检测 + 参数推断 + 融合 UI（P2-14） |
| F. Assembly Step 8 | 扩展 | config_update.md 增加 Questionnaire 段 |
| I. Command: recalibrate | 扩展 | answers_hash 检查 + 触发类型标注 |
| I. Command: reset | 扩展 | 新字段清理规则 |
| M. Probing | 整体替换 | 单一伪装探测 → 三阶段策略 |
| 新增 | 新增 | 模型自识别条件指令段 |

### 4.3 config.json 变更

- version: 1 → 2
- 新增 5 个字段（见 3.5.2）
- modifiers 默认值变更

### 4.4 config_update.md 格式变更

新增两个 section：
- `## Questionnaire`（q_version + answers_hash）
- `## Probing`（last_style_probe + probe_session_count）

### 4.5 新增文件

| 文件 | 位置 | 生成时机 | 内容 |
|------|------|---------|------|
| `user_customizations.json` | `.soul_history/` | 老用户融合流程检测阶段 | IDENTITY.md 字段填写状态 + SOUL.md 段落修改状态 + 推断的 modifier 值 |

---

## 5. 不变的部分

| 组件 | 状态 | 说明 |
|------|------|------|
| SOUL.md Self-Calibration Protocol | 不变 | 通用被动观察指令 |
| HEARTBEAT.md 检查段 | 不变 | 6 个检查问题 |
| HEARTBEAT_SEGMENT 常量 | 不变 | handler.js 中的 Heartbeat 注入模板 |
| Section E. DISC Role Templates | 不变 | 4 型模板内容 |
| Section F. Assembly Steps 2-7, 9-11 | 不变 | 快照、读取、模板填充、写入、验证 |
| Section G. Effect Demo | 不变 | before/after 对比演示 |
| Section H. Post-Install Preference | 不变 | 安装后偏好首问 |
| Section J. BDI Framework | 不变 | 校准决策框架 |
| Section K. Delivery Checklist | 不变 | 交付验证清单（可能需小幅补充新字段检查） |
| Section L. State Transition FSM | 不变 | 状态转换表 |

---

## 6. 冲突处理记录

Phase 2 推演中识别的 5 个潜在冲突及处理方案：

| 冲突 | 描述 | 处理方案 |
|------|------|---------|
| A | handler.js modifier 默认值与 Phase 2 中间值策略不一致 | 硬编码改为 `{h:1,v:1,p:1,c:1}`，已有用户不受影响 |
| B | SKILL.md Section M 探测机制需整体重写 | 整体替换为三阶段策略，非追加 |
| C | handler.js 注入预算 3KB 可能不足 + 跨模型一刀切问题 | 放宽到 6KB；SKILL.md 用 Agent 自识别做模型适配；handler.js 不做模型检测 |
| D | config_update.md parser 不支持新字段 | 新增 Questionnaire、Probing 两个 section，向后兼容 |
| E | recalibrate 与 answers_hash 交互 + 版本更新被动触发问题 | 按触发原因区分：用户主动→副轴值作起点；版本更新→保留 Heartbeat 微调值 |

---

## 7. Phase 3 待办备忘

以下项目明确延后至 Phase 3，不在 Phase 2 范围内：

| 项目 | 前置条件 |
|------|---------|
| soul-forge-collector Hook | Heartbeat 打磨完成 + 用户反馈需要 |
| memory.md 归档清理 | 用户数据量达到阈值（200条/100KB） |
| rollback 命令 | reset 使用反馈 + 历史快照管理设计 |
| 信号质量加权（#64） | 足够数据积累 + 数据分析完成 |
| modifier Agent 推断（方案 B） | 预定义映射表（方案 A）数据验证 |
| 付费 modifier UI（T1） | Phase 2 核心功能稳定 |
| 多平台适配器（T2） | OpenClaw 平台验证完成 |
| 网页问卷（T3） | 分发渠道成熟 |
| 数据飞轮（T4） | 用户规模达标 |

---

## 8. 决策索引

本规划中所有决策的快速索引，方便未来查找：

| 问答轮次 | 决策项 | 结论 |
|---------|--------|------|
| Q14 | P1 collector Hook | 延后 Phase 3 |
| Q15 | P3 三阶段全部落地 | Phase 2 确认 |
| Q16 | P2 Pre-flight Check | Phase 2 确认 |
| Q17 | P5 只做 reset | Phase 2 确认，rollback 延后 |
| Q18 | modifier 缺失兜底 | 统一中间值 1（方案 B） |
| Q19 | #64 信号加权 | 延后，等数据 |
| Q20 | #100 answers_hash | Phase 2 确认 |
| Q21 | 版本管理 | Phase 2 确认 |
| Q22 | #78 频率控制 + 版本重置 | Phase 2 确认 |
| Q23 | #34 老用户参数推断 | Phase 2 确认 |
| Q24 | 副轴映射规则 | 预定义映射表（A），Phase 3 引入 Agent 推断（B） |
| Q25 | 探测频率参数 | 定框架 + 暂定数值，后续数据调优 |
| Q26 | 老用户推断范围 | 只推断有信号的 modifier，不确认，走探测完善 |
| Q27 | Schema v2 字段清单 | 5 新增字段 + 迁移策略确认 |
| Q28 | 模型适配方式 | A+B（测试+自识别），不做多版本 |
| Q29 | reset 与新字段 | 历史记录保留，运行时状态清零 |
| 冲突 A | handler.js 默认 modifiers | 改为统一中间值 |
| 冲突 B | Section M 替换 | 整体替换为三阶段 |
| 冲突 C | 注入预算 + 模型适配 | 6KB + Agent 自识别 |
| 冲突 D | config_update.md 扩展 | 新增 2 个 section |
| 冲突 E | recalibrate modifier 处理 | 按触发原因区分 |
| 补回 | 老用户融合选项 | Architecture 10.2 原设计补回，P2-14 |

---

_End of Phase 2 Plan_

[//]: # (soul-forge:phase2-plan:v1:20260219)
