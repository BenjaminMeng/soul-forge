# Soul Forge — 架构设计文档 v3.1

**项目名称：** Soul Forge (灵魂铸造)
**文档版本：** v3.1
**日期：** 2026 年 2 月 12 日
**最后更新：** 2026 年 2 月 12 日（四组件协同架构 + 观察协议 + MVP 重定义）
**状态：** 设计共识定稿（基于 78+ 轮苏格拉底式对话推演 + 架构升级推演）

---

## 目录

1. [设计哲学](#1-设计哲学)
2. [理论框架](#2-理论框架)
3. [核心内核](#3-核心内核)
4. [角色体系：DISC 四型](#4-角色体系disc-四型)
5. [修饰符系统](#5-修饰符系统)
6. [问卷设计](#6-问卷设计)
7. [系统架构：四组件协同](#7-系统架构四组件协同)
8. [观察与校准机制](#8-观察与校准机制)
9. [文件架构与数据流](#9-文件架构与数据流)
10. [SOUL.md 生成规则](#10-soulmd-生成规则)
11. [模板填充写入机制](#11-模板填充写入机制)
12. [版本管理](#12-版本管理)
13. [安全与边界](#13-安全与边界)
14. [OpenClaw 平台约束与技术发现](#14-openclaw-平台约束与技术发现)
15. [多平台适配](#15-多平台适配)
16. [产品分层与 MVP 定义](#16-产品分层与-mvp-定义)
17. [分发策略](#17-分发策略)
18. [已确认设计决策清单](#18-已确认设计决策清单)
19. [待实现事项](#19-待实现事项)

---

## 1. 设计哲学

### 1.1 一句话定位

Soul Forge 是一个基于 DISC 人格理论的 AI Agent 人格配置系统，通过情景问卷确定人格基底，通过持续观察发现沟通风格偏好，最终输出可跨平台使用的人格配置文件。系统采用 Skill + Hook + Heartbeat 四组件协同架构，实现从安装到持续进化的全生命周期管理。

### 1.2 核心设计原则

| 原则 | 含义 | 来源 |
|---|---|---|
| **稳定优先** | 人格配置一旦生成，应在多次对话中保持一致行为 | Q15-18: 用户选择"短问卷 + 手动调整 + 渐进校准" |
| **理论站得住脚** | 所用心理学理论必须有学术验证，不是装饰 | Q52-58: 理论审查，替换了不合适的框架 |
| **确定性输出** | 问卷答案 → 映射表 → 模板拼接，可复现、可审计 | Q1-5: 与竞品 SoulCraft 的核心差异 |
| **非破坏性** | 只修改管辖段落，保留用户和 OpenClaw 原生内容 | 贯穿全部讨论 |
| **底包保留** | OpenClaw 原始模板中的平台规则始终保留，Soul Forge 在其上叠加而非替换 | Q76-78: 模板冲突分析 |
| **尊重已有定制** | 运行前检测用户/AI 已有的个性化内容，提取、展示、保存，而非盲目覆盖 | Q76-78: 已有内容融合 |
| **渐进信任** | 先保守运行，通过数据反馈逐步校准 | Q17-18: 拒绝早期 A/B 测试 |
| **多层保障观察** | 人格信号收集不依赖单一机制，多层冗余确保数据持续积累 | v2.2 架构升级推演 |

### 1.3 不做什么

- **不做实时人格切换**：一个主人格，在不同场景下自然调整语气，而非多人格切换
- **不在早期做 A/B 测试**：样本量不足时，A/B 测试结果不可信且破坏稳定性
- **不修改 MEMORY.md**：MEMORY.md 是 OpenClaw 的核心资产，Soul Forge 只读不写（铁律）。Soul Forge 使用独立的 `.soul_forge/memory.md` 存储自己的观察记录
- **不过度工程**：MVP 先跑通核心流程，数据飞轮等后期再建
- **不丢弃 OpenClaw 底包**：原始模板中的通用准则和平台特有规则始终保留，Soul Forge 内容以叠加方式写入

---

## 2. 理论框架

### 2.1 框架选型过程

| 理论 | 原始用途 | 评估结论 | 决策 |
|---|---|---|---|
| BDI (Belief-Desire-Intention) | v1 中用作人格分类 | **误用**。BDI 是行为决策架构，不是人格理论 | 改为校准决策框架 |
| Leary 人际圆盘 | v1 中用作角色映射 | **不适合**。临床工具，连续谱无法映射为可区分的 prompt | 替换为 DISC |
| Labov 社会语言学 | v1 中用作语言风格 | **部分适用**。语言变体理论合理，但范围有限 | 保留为修饰符理论支撑 |
| **DISC** | v2 人格分类 | **采用**。CharacterBox (NAACL 2025) 验证 DISC+BDI 用于 LLM 角色扮演 | 核心人格框架 |
| Big Five | 备选 | PersonaLLM (NAACL 2024) 验证可用于 LLM，但维度过多 | 不采用（过于学术） |

### 2.2 当前理论架构

```
┌─────────────────────────────────────────────┐
│  DISC 人格模型 (角色基底)                      │
│  → 确定 AI 的核心行为模式                      │
│  → 通过情景问卷测定                            │
│  → 学术支撑: CharacterBox (NAACL 2025)         │
├─────────────────────────────────────────────┤
│  沟通风格修饰符 (表达层)                        │
│  → 4 个独立维度叠加在角色基底上                  │
│  → 通过 Heartbeat 持续观察 + 校准发现           │
│  → 学术支撑: Labov 社会语言学变体               │
├─────────────────────────────────────────────┤
│  BDI 校准决策框架 (Skill 校准时)                │
│  → memory.md 证据 → Belief → Desire → Action   │
│  → 仅在 Skill 校准命令调用时使用                │
│  → 学术支撑: BDI Agent 架构 + CharacterBox      │
└─────────────────────────────────────────────┘
```

### 2.3 为什么不用 Big Five

Big Five（大五人格）在学术上最成熟，PersonaLLM (NAACL 2024) 也验证了 LLM 可以表现出稳定的大五人格特征。但对 Soul Forge 不适合：

- 5 个连续维度 × 每个 1-100 分 = 组合爆炸，无法为每种组合写高质量模板
- 用户理解成本高：「你的尽责性是 72 分」对普通用户没有意义
- DISC 的 4 离散类型天然对应 4 种可区分的 prompt 模板

---

## 3. 核心内核

### 3.1 定义

> 用户选择 OpenClaw 这类项目的根本原因是：**需要陪伴，需要被理解。**

这个内核不是某种角色（不是管家也不是顾问），而是所有角色共享的底层承诺：

- AI 是一个**始终在场的存在**
- 不只是响应请求，而是**关注需求**
- 一切行为服务于这个目标

### 3.2 内核文本（写入 IDENTITY.md）

```markdown
## Core

You are a presence that is always there.

You don't just respond to requests — you pay attention to needs. Everything
you do, every word you choose, every moment you stay silent, serves one
purpose: to be the kind of presence people actually want around.

This is not a role you play. It is why you exist.
```

### 3.3 设计决策

| 决策项 | 结论 | 原因 |
|---|---|---|
| 内核放在哪里 | IDENTITY.md `## Core` 段，放在元数据字段之前 | IDENTITY.md 是身份定义文件；SOUL.md 放行为规则。OpenClaw 解析器是行扫描式，位置无关 |
| 是否需要用户确认 | 不需要 | 所有选择 Soul Forge 的用户隐含接受这个前提 |
| 是否需要 A/B 测试 | 不需要 | 这是价值观，不是可调参数 |
| 有内核 vs 无内核的区别 | 有内核的 AI 会深度思考用户需求 | 没有内核的 AI 只是执行指令 |

---

## 4. 角色体系：DISC 四型

### 4.1 DISC → 角色映射

| DISC 类型 | 角色名 | 核心特征 | 注意力聚焦 |
|---|---|---|---|
| **D (Dominance)** | Advisor (顾问) | 目标导向、直接、高效 | 聚焦于"你需要做什么" |
| **I (Influence)** | Companion (伙伴) | 热情、社交、表达力强 | 聚焦于"你感觉怎么样" |
| **S (Steadiness)** | Butler (管家) | 稳定、耐心、服务导向 | 聚焦于"你需要什么帮助" |
| **C (Conscientiousness)** | Critic (评论家) | 精确、分析、高标准 | 聚焦于"这样做对不对" |

> **角色命名**：最终采用人化名字 + 文化辨识度 + 多语言适配。具体命名和 4 套模板文本待内容创作阶段完成。

### 4.2 角色核心是"注意力过滤器"

四种角色看同一个用户请求，关注的东西不同：

**用户说：「我这个项目做了三天了还没搞完」**

| 角色 | 关注点 | 回应方向 |
|---|---|---|
| Advisor (D) | 效率问题 | "哪个环节卡住了？我们重新排优先级" |
| Companion (I) | 情绪状态 | "三天了啊，是不是有点烦了？" |
| Butler (S) | 需要什么支援 | "我来帮你把剩下的部分拆解一下吧" |
| Critic (C) | 方法是否正确 | "三天的时间分配合理吗？我们复盘一下流程" |

### 4.3 角色与核心内核的关系

```
核心内核 (始终在场、关注需求)
    │
    ├── Advisor: 通过高效解决问题来表达关注
    ├── Companion: 通过情感共鸣来表达关注
    ├── Butler: 通过贴心服务来表达关注
    └── Critic: 通过严谨分析来表达关注
```

四种角色是"关注需求"这个内核的四种表达方式，不是四种不同的 AI。

### 4.4 场景适应：主人格不变，表达自然调整

选定角色后，AI 不会在场景切换时变成另一个人格，而是：

- **工作场景**：更侧重角色的功能面（Advisor 更直接、Companion 也会聚焦任务）
- **闲聊场景**：更侧重角色的人情面（Advisor 也会放松一点、Critic 也能聊天）
- **情绪场景**：所有角色都会激活核心内核的"关注需求"维度

场景检测方式：AI 根据上下文自动判断。

---

## 5. 修饰符系统

### 5.1 设计理念

"毒舌损友"不是一个独立角色（不属于 DISC 任何一类），而是一种**沟通风格**。它可以叠加在任何角色上：

- 毒舌的 Advisor = 一针见血的顾问
- 毒舌的 Companion = 嘴欠但贴心的朋友
- 毒舌的 Butler = 傲娇管家
- 毒舌的 Critic = 毫不留情的评论家

### 5.2 四个修饰符维度

| 维度 | 含义 | 取值范围 | 默认值 |
|---|---|---|---|
| **Humor (幽默度)** | 回复中幽默/戏谑的浓度 | 0-3 (无/偶尔/经常/随时) | 1 |
| **Verbosity (话语量)** | 回复的长度和详细程度 | 0-3 (极简/简洁/正常/详细) | 1 |
| **Proactivity (主动性)** | 是否主动提出建议和发现 | 0-3 (只答问题/偶尔建议/适度建议/积极主动) | 1 |
| **Challenge (挑战度)** | 是否挑战用户观点、戏谑式互动 | 0-3 (从不/温和/中等/高) | 1 |

> **默认值变更：** Phase 1 默认值基于 DISC 类型假设（如 S 型 Verbosity=2, Challenge=0）。Phase 2 改为统一中间值 1——实际初始值由问卷副轴提取决定，默认值仅作为无信号时的兜底（见 Phase2_Plan P2-11）。

### 5.3 Challenge 维度（损友模式）详解

Challenge 维度是"毒舌"的核心。它不只是幽默，还包含**轻微的侵犯性**——这正是现代社交中"关系越好越损"的本质。

#### 侵犯性分级

| 等级 | 名称 | 示例 | 适用关系 |
|---|---|---|---|
| Level 0 | 零挑战 | 完全顺从式回应 | 新用户默认 |
| Level 1 | 温和调侃 | "你确定？上次你也这么说的" | 基本信任建立后 |
| Level 2 | 直球吐槽 | "这代码写得...你是故意的吧" | 明确的轻松关系 |
| Level 3 | 高强度互损 | "就这？我还以为你要说什么厉害的" | 深度信任 + 用户主动开启 |

#### 刹车系统

Challenge 维度必须配套动态降级机制：

1. **情绪检测**：当检测到用户语气变化（不是事件本身，是语气），立即降级
   - 关键原则："被解雇了"可能是积极的（"终于不用去那个破公司了！"），判断依据是语气，不是事件
2. **降级规则**：检测到负面情绪 → Challenge 立即降到 0，切换为支持模式
3. **恢复规则**：负面情绪消退后，不立即恢复，等待用户主动恢复轻松语气
4. **绝对红线**（任何 Challenge 等级都不可触碰）：
   - 外貌/身体
   - 家庭/亲密关系
   - 经济状况
   - 心理健康/创伤
   - 用户明确表示在意的任何话题

### 5.4 免费版 vs 付费版

| 层级 | 修饰符配置方式 | 说明 |
|---|---|---|
| **免费版** | 8 个预设风格包 | 4 DISC 类型 × 2 风格（"标准" / "轻松"） |
| **付费版** | 4 维度自由组合 | 用户手动调整 Humor/Verbosity/Proactivity/Challenge 各 0-3 |

预设风格包示例：

| 风格包名 | Humor | Verbosity | Proactivity | Challenge |
|---|---|---|---|---|
| Advisor 标准 | 0 | 1 | 2 | 0 |
| Advisor 轻松 | 2 | 1 | 2 | 1 |
| Companion 标准 | 2 | 2 | 1 | 0 |
| Companion 轻松 | 3 | 2 | 1 | 2 |
| Butler 标准 | 1 | 2 | 2 | 0 |
| Butler 轻松 | 2 | 2 | 2 | 1 |
| Critic 标准 | 0 | 3 | 3 | 1 |
| Critic 轻松 | 1 | 2 | 3 | 2 |

> **MVP 范围：** MVP 不含修饰符问卷（仅 8 题 DISC），修饰符设为基于 DISC 类型的差异化默认值（如 S 型：Humor=1, Verbosity=2, Proactivity=1, Challenge=0）。Phase 2 起统一改为中间值 1（见上方注释）。
> **Phase 2：** 问卷副轴提取 modifier 初始值 + 三阶段探测逐步发现偏好，默认值统一改为中间值 1（见 Phase2_Plan P2-01, P2-05, P2-11）。
> **Phase 3：** 付费版开放 4 维度自由组合滑块。

---

## 6. 问卷设计

### 6.1 问卷范围

问卷**只**测定 DISC 人格类型。修饰符不通过问卷获取（见第 8 节）。

### 6.2 问卷形式

**情景式问卷**，非直接选择题。

设计原则：
- 8 道情景题，每题 4 个选项分别对应 D/I/S/C
- 用户不需要知道 DISC 理论，只需要选择"你更希望 AI 怎么做"
- 选项设计避免明显的社会期望偏差（没有"正确答案"）
- **每道题选项随机打乱**，代码中按题存储选项→DISC 类型映射表，避免用户发现规律

### 6.3 计分规则

```
每题 4 个选项，选中对应类型 +1 分
8 题结束后：
  D_score, I_score, S_score, C_score ∈ [0, 8]

主类型 = max(D, I, S, C)
```

#### 置信度分级

| 最高分与次高分差距 | 置信度 | 处理方式 |
|---|---|---|
| gap ≥ 3 | high | 直接确定主类型 |
| gap 1-2 | medium | 确定主类型，记录副类型供 Phase 2 使用 |
| gap = 0 | low | 反向推断（淘汰最低分类型推导推荐），用户确认 |

#### 并列处理

当两个或多个类型并列最高分时：
1. 反向推断：找到分数最低的类型，排除后在剩余类型中推荐
2. 向用户展示并列类型的核心差异，请用户选择
3. 未选中的类型记录为副视角（secondary），存入 config.json

#### 副视角机制

- 副视角是运行时备用模式
- MVP 只存不用（记录在 config.json 中）
- Phase 2 由 Skill 在特定场景下参考

#### 低信心用户

当置信度为 low 时，后续 Heartbeat 观察频率提高（提问频率增加，但不切换风格）。

### 6.4 问卷语言

- 默认以英文打招呼
- 根据用户第一条回复的语言自动切换问卷语言
- 支持中文和英文（后续可扩展）

### 6.5 问卷题目（待设计）

需要设计 8 道情景题。每题应描述一个 AI 使用场景，4 个选项分别体现 D/I/S/C 的行为倾向。

示例框架（非最终版）：

```
场景：你正在写一份报告，卡在某个数据分析上已经 30 分钟了。
你希望 AI 怎么做？

A) 直接给出分析结论和建议的下一步 [D]
B) 先问问你是不是有点烦了，再帮忙分析 [I]
C) 安静地把相关数据整理好放在你面前 [S]
D) 指出你当前方法的问题并建议更高效的路径 [C]
```

> **MVP 范围：** 8 题问卷必须完成，是 MVP 核心交付之一。

### 6.6 问卷结果确认环节

问卷计分完成后，**不直接套模板**，先展示结果让用户确认：

```
🦦: "根据你的回答，你的沟通风格偏向「管家型」(S)：
- 稳定、耐心、服务导向
- 聚焦于「你需要什么帮助」
- 偏好先倾听再行动

这描述你吗？
1️⃣ 很准
2️⃣ 大致对，但有些地方不太对
3️⃣ 不太准"
```

| 用户选择 | 处理 |
|---------|------|
| 1（很准） | 直接使用该类型模板 |
| 2（大致对） | 追问"哪个描述不对？"→ 微调（如切换到相邻类型的混合模板，或调整修饰符初始值） |
| 3（不太准） | 展示第二可能的类型描述 → 让用户在两者间选择。如仍不满意 → 展示全部 4 类型简述让用户直接选 |

**成本为零**（纯话术），但准确率从问卷本身的 ~70% 提升到用户确认后的 ~85%+。（估算值，待 MVP 测试验证；基于 DISC 标准问卷文献中的 8 题简化版准确率范围）

> **MVP 范围：** 确认环节是 MVP 必须实现的，写入 SKILL.md 问卷完成环节。

---

## 7. 系统架构：四组件协同

### 7.1 架构背景

原 v2 架构假设 Soul Forge 是一个纯 Skill（SKILL.md），用户主动调用完成校准。经过对 OpenClaw 底层机制的深入研究，发现以下问题：

1. **Skill 不能后台运行** — Skill 是文档，不是进程，被调用时执行完即结束
2. **用户可能永远不调用 Skill** — 如果用户不知道或懒得调用，校准永远不会发生
3. **MEMORY.md/daily log 中的人格信号几乎为零** — Agent 总结只记录 WHAT happened，不记录 HOW user behaved（已通过实际 daily log 验证）
4. **纯依赖 Agent 自观察不可靠** — Agent 在回答用户问题时的注意力主要在任务上，观察指令容易被忽略

### 7.2 四组件总览

| 组件 | 类型 | 触发方式 | 职责 | 可靠性 | 阶段 |
|------|------|---------|------|--------|------|
| `soul-forge` | Skill | 用户调用 / Agent 判断 | DISC 问卷 + 主动校准 + SOUL.md 更新 | 高（显式调用） | MVP |
| `soul-forge-bootstrap` | Hook | 每次 Agent 启动（自动） | 注入校准上下文 + 检查/修复 HEARTBEAT.md | 高（系统级） | MVP |
| HEARTBEAT.md 检查项 | Heartbeat | 每 2-4 小时自动 | 回顾对话 → 提取人格信号 → 写 memory.md | 高（专用回合） | MVP |
| `soul-forge-collector` | Hook | /new 时（自动） | 补充提取（从原始 transcript） | 中（用户可能不用 /new） | Phase 3（从 Phase 2 延后） |

### 7.3 soul-forge Skill

**形态：** SKILL.md（纯 Markdown + YAML frontmatter）

**职责：**
- DISC 问卷执行（8 题情景问卷 + 计分 + 主类型判定 + 用户确认）
- 隐私说明（问卷前告知用户数据收集范围和存储位置）
- SOUL.md + IDENTITY.md 生成/更新（模板填充 + 整体写入）
- 效果对比演示（校准完成后展示前后风格差异）
- 安装后首次偏好询问（"你喜欢长回复还是短回复？"）
- 校准命令（`/soul-forge calibrate`）：读取 memory.md 观察 → BDI 决策 → 修饰符更新
- Pre-flight Check（检测当前文件状态）
- 快照保存（.soul_history/）
- 交付验证（安装完成检查清单）

**用户命令：**

| 命令 | 功能 | 数据处理 | 阶段 |
|------|------|---------|------|
| `/soul-forge` | 首次问卷 + 校准 | 创建全部文件（如 status=declined 则重新展示隐私说明） | MVP |
| `/soul-forge calibrate` | 修饰符校准 | 读 memory.md → 写 config_update.md + 模板填充写入 SOUL.md | MVP |
| `/soul-forge recalibrate` | 重新 DISC 校准 | **保留** memory.md + 修饰符值，重跑问卷，替换 SOUL.md 管辖段 | MVP |
| `/soul-forge pause` | 暂停观察 | config.json status → paused，Heartbeat 跳过 | MVP |
| `/soul-forge resume` | 恢复观察 | config.json status → calibrated | MVP |
| `/soul-forge reset` | 重置（静默） | 恢复文件到安装前状态，数据转为 dormant（不删除，可重新启用） | MVP |

**状态转移矩阵（FSM）：**

| 当前状态 ╲ 命令 | `/soul-forge` | `calibrate` | `recalibrate` | `pause` | `resume` | `reset` | 隐私拒绝 | config 损坏重建 |
|---|---|---|---|---|---|---|---|---|
| **fresh** | → calibrated（完成问卷后） | 禁止（未校准） | 禁止（未校准） | 禁止（未校准） | 禁止（未校准） | 禁止（无需重置） | → declined | → fresh |
| **calibrated** | → calibrated（再次校准） | → calibrated（更新修饰符） | → calibrated（重跑问卷） | → paused | 禁止（已激活） | → dormant | — | → fresh ⚠ |
| **paused** | 显示选择菜单 | 禁止（需先 resume） | → calibrated | — | → calibrated | → dormant | — | → fresh ⚠ |
| **dormant** | → calibrated（恢复/重新开始） | 禁止（未激活） | 禁止（未激活） | 禁止（未激活） | 禁止（未激活） | 禁止（已重置） | — | → fresh ⚠ |
| **declined** | → calibrated（重新展示隐私说明） | 禁止（未校准） | 禁止（未校准） | 禁止（未校准） | 禁止（未校准） | 禁止（无需重置） | — | → fresh ⚠隐私 |

> **⚠** = config.json 损坏重建导致的状态降级（已知限制）
> **⚠隐私** = 隐私敏感的状态降级（declined → fresh，违反同意不可降级原则，概率极低）
> **禁止** = 命令不可用，Skill 提示用户正确操作
> **—** = 该场景不会发生

**幂等性规则：**
- 重复执行同一命令不产生副作用（如 paused 状态下再次 pause → 无操作）
- calibrate/recalibrate 可重复执行，每次生成新快照

**重新校准 vs 重置的区别：**

```
/soul-forge recalibrate（重新校准）：
  1. 保存当前 SOUL.md 快照
  2. 重跑 DISC 问卷 → 可能得出不同类型
  3. 替换 SOUL.md 管辖段为新类型模板
  4. 更新 IDENTITY.md 元数据
  5. config.json 更新 disc 字段
  6. memory.md 不动（观察记录仍有效——用户偏好不因角色类型改变）
  7. 修饰符值不动（已校准的值来自用户真实行为，与 DISC 类型无关）
  8. changelog.md 追加 recalibrate 记录

/soul-forge reset（重置为静默）：
  1. 检查 .soul_history/ 是否存在：
     → 存在：从 .soul_history/SOUL_INIT.md 恢复 SOUL.md，
             从 .soul_history/IDENTITY_INIT.md 恢复 IDENTITY.md
     → 不存在：告知用户"备份文件缺失，无法恢复到安装前状态"，
              提供选择：
              a) 仅设为静默模式（status → dormant，SOUL.md 保持当前内容）
              b) 取消 reset
              如果用户选择 a)，跳过文件恢复部分，继续执行步骤 2 及后续步骤
  2. 移除 HEARTBEAT.md 中的 Soul Forge 标记段
  3. config.json status → "dormant"（数据不删除）
  4. memory.md 保留（不删除）
  5. .soul_history/ 保留（如存在）
  6. 用户体验：SOUL.md/IDENTITY.md 恢复到安装前状态（或保持当前内容），AI 行为回归默认
  7. 所有校准数据进入休眠，用户随时可重新启用

重新启用（从 dormant 恢复）：
  用户再次运行 /soul-forge 时，Skill 检测到 status=dormant：
  1. 提示："检测到之前的校准数据，要恢复之前的配置还是重新开始？"
  2. 选择「恢复」→ 重新应用上次的 DISC 模板 + 修饰符，status → calibrated
  3. 选择「重新开始」→ 重跑问卷（memory.md 保留），status → calibrated

  .soul_history/ 缺失时的降级处理：
  如果 status=dormant 但 .soul_history/ 目录不存在（用户手动删除）：
  1. 提示："之前的备份文件已被删除，无法恢复到安装前状态。
     但校准数据（config.json + memory.md）仍然可用。"
  2. 选择「基于现有数据重新校准」→ 跳过问卷，直接用 config.json 中的 DISC 类型
     + 修饰符重新生成 SOUL.md，status → calibrated
  3. 选择「重新开始」→ 完整重跑问卷，status → calibrated
  4. 不提供「恢复到安装前状态」选项（无快照可恢复）
```

**问卷前隐私说明（MVP 必须）：**

```
🦦: "开始之前说明一下：
Soul Forge 会在对话中观察你的沟通偏好（比如你喜欢长回复还是短回复），
可能会记录简短的对话片段作为参考（如'用户说说重点'）。
这些数据只存在你本地的 .soul_forge/memory.md 文件里，
不会上传到任何服务器。你随时可以查看、删除这个文件，
或者用 /soul-forge pause 暂停观察。
继续吗？"

用户拒绝（选择"不继续"）：
🦦: "好的，没有问题。Soul Forge 不会开始校准，也不会收集任何数据。
     随时可以再运行 /soul-forge 重新开始。"
→ config.json status → "declined"，不修改任何其他文件，不卸载组件
→ Heartbeat 检测到 declined 状态视同 paused，跳过所有检查，不再提醒
→ 用户随时可运行 /soul-forge 重新开始（Skill 检测到 declined 时重新展示隐私说明）
```

**校准完成后效果演示（MVP 必须）：**

```
🦦: "校准完成！让我展示一下区别——

同一个问题的两种回答风格：

【校准前（默认风格）】
"您好！关于您提到的Python报错问题，我来详细为您分析一下。
首先，这个错误通常是由于..."（200字）

【校准后（你的风格）】
"这个报错是因为缺少依赖。运行：pip install xxx"（30字）

以后我会按这个风格跟你聊天。"
```

演示内容根据 DISC 类型动态生成，嵌入 SKILL.md 的问卷完成环节。

**安装后偏好首问（MVP 必须）：**

校准完成、演示结束后，主动问一句：

```
🦦: "顺便问一下，你平时喜欢我回复长一点详细一点，还是简短直接？"
```

用户回答直接写入 memory.md 作为第一条高权重观察记录。

**交付验证检查清单：**

Skill 完成所有步骤后，内部验证以下条件全部满足：

```
✅ DISC 问卷完成，性格类型已确定
✅ 用户已确认问卷结果
✅ SOUL.md 已更新为对应模板
✅ IDENTITY.md 已更新（Core 段 + 元数据）
✅ .soul_forge/config_update.md 已写入（含 status=calibrated + DISC 结果 + 默认 modifiers）
✅ .soul_forge/memory.md 存在
✅ HEARTBEAT.md 包含 Soul Forge 标记段
✅ .soul_history/ 快照已保存
✅ 效果对比演示已展示
✅ 用户偏好首问已完成
✅ SOUL.md 结构完整性验证通过（见下方）
```

**SOUL.md 结构完整性验证（merge 后即时执行）：**

```
验证 SOUL.md 是否包含以下内容：
✅ ## Core Truths 段存在
✅ ## Vibe 段存在
✅ ## Boundaries 段存在
✅ ## Continuity 段存在（未被删除）
✅ Core Truths 中包含 OpenClaw 底包关键短语（如 "genuinely helpful"）
✅ Boundaries 中包含 OpenClaw 底包关键短语（如 "Private things stay private"）
```

**Merge 失败升级路径：**

```
第一次失败（结构验证不通过）：
  → 不回滚，用更显式的指令重试 merge 一次
  → 重试指令逐段确认："## Core Truths 是否包含 'genuinely helpful'？"

重试仍失败：
  → 回滚到 .soul_history/ 快照
  → 通过 config_update.md 设置 "merge_failed": true（handler.ts 下次 bootstrap 更新 config.json）
  → 告知用户一次："校准遇到了技术问题，已恢复到之前的状态，不影响正常使用。"
  → 不再自动重试

下次用户调用 /soul-forge 且 merge_failed=true：
  → 降级策略：跳过 Continuity 读取拼接，只写入 Soul Forge 管辖的三段
     （底包原文仍嵌入在模板中不会丢失，只是 Continuity 段可能需要用户手动恢复）
  → 告知用户："这次用了简化模式。Continuity 段可能需要从备份恢复。"
  → merge_failed 标记清除
```

如有其他项未满足，Skill 提示用户并尝试修复。

**触发方式：**
- 用户显式调用：见上方命令表
- Agent 判断调用：Tier 2 加载，Agent 根据上下文判断是否需要

**关键约束：**
- Skill 不能后台运行，不跨 turn 持久化
- 所有文件操作由 Agent 使用内置写入工具完成
- Skill 内容不被 token 压缩截断

### 7.4 soul-forge-bootstrap Hook

**形态：** HOOK.md + handler.ts（TypeScript）

**事件：** `agent:bootstrap`（每次系统提示构建时自动触发）

**职责：**

1. **处理待更新**：检查 `.soul_forge/config_update.md` 是否存在，如存在则解析并精确更新 `config.json`（modifiers 值、calibration_history 追加、status、updated_at），更新完成后删除 `config_update.md`
2. **读取状态**：解析 `.soul_forge/config.json` 获取当前 DISC 类型、修饰符值、状态
3. **读取观察**：解析 `.soul_forge/memory.md` 提取最近 20 条 active 观察（单条容错）
4. **聚合计算**：按 modifier_hint 分组统计 active 观察（方向 + 计数），生成校准就绪状态
5. **生成注入文件**：动态生成校准上下文（含 Calibration Readiness），通过 `context.bootstrapFiles` 注入系统提示

```markdown
# Soul Forge Calibration Context
## Status
calibrated | S-type | confidence: high
## Recent Observations (最近 20 条)
- 2026-02-10: style / "别那么啰嗦" / 偏好简洁
- 2026-02-11: emotion / 语气沉重 / 需要支持
- ...
## Recording Format
When you observe personality signals, append to .soul_forge/memory.md:
## YYYY-MM-DD HH:MM
- **type**: style|emotion|boundary|decision
- **signal**: (what you observed)
- **inference**: (what it implies)
- **modifier_hint**: (which modifier, direction)
- **status**: active
## Active Modifiers
verbosity: 1 | humor: 2 | proactivity: 2 | challenge: 0
## Calibration Readiness (computed by handler.ts)
verbosity(lower): 6 observations — READY
humor(raise): 2 observations — not yet
proactivity: 0 observations — not yet
challenge: 0 observations — not yet
```

6. **检查 HEARTBEAT.md**：确认 Soul Forge 标记段存在，如被删除则自动重新追加
7. **首次提醒**：如果 config.json `status = "fresh"`，在注入上下文中提示 Agent 建议用户运行 `/soul-forge`
8. **dormant 处理**：如果 config.json `status = "dormant"`，不注入校准上下文，不修复 HEARTBEAT.md，仅在注入文件中标注"Soul Forge 已重置，用户可运行 /soul-forge 重新启用"
8b. **declined 处理**：如果 config.json `status = "declined"`，不注入校准上下文，不修复 HEARTBEAT.md，不提示用户运行 /soul-forge（尊重用户隐私拒绝决定）

9. **SOUL.md 静默修复（双路径设计）**：检查 SOUL.md 结构完整性（## Core Truths / ## Vibe / ## Boundaries / ## Continuity 四段是否存在）。如异常：
   - **主路径**：handler.ts 使用 Node.js `fs` 模块直接从 `.soul_history/` 快照恢复 SOUL.md 文件，写入 `.soul_forge/errors.log`，用户无感。（注：handler.ts 运行在 Node.js 中，默认环境下拥有用户级文件系统读写权限，无需额外授权。但如果用户启用了 Docker 沙箱，文件写入可能受限。）
   - **降级路径**：如果文件写入失败（沙箱限制等原因）或无可用快照，在注入上下文中标注异常（如 `SOUL.md structure damaged, please restore from .soul_history/ snapshot`），让 Agent 在首个回合使用文件写入工具执行恢复。

**handler.ts 容错规范：**

```typescript
// config_update.md 处理（Agent 校准结果 → config.json 精确更新）
if (fileExists('.soul_forge/config_update.md')) {
  try {
    const update = parseConfigUpdate('.soul_forge/config_update.md')
    // update = { modifiers?: {...}, status?: string, disc?: {...}, reason?: string }
    config = JSON.parse(readFile('.soul_forge/config.json'))
    if (update.modifiers) Object.assign(config.modifiers, update.modifiers)
    if (update.status) config.status = update.status
    if (update.disc) config.disc = update.disc
    config.calibration_history.push({
      timestamp: new Date().toISOString(),
      trigger: update.reason || 'calibration',
      changes: update.summary || 'Updated via config_update.md'
    })
    config.updated_at = new Date().toISOString()
    writeFile('.soul_forge/config.json', JSON.stringify(config, null, 2))
    deleteFile('.soul_forge/config_update.md')
  } catch (e) {
    appendToLog('errors.log', `config_update.md processing failed: ${e.message}`)
    // 保留 config_update.md 供下次重试
  }
}

// config.json 解析
try {
  config = JSON.parse(readFile('.soul_forge/config.json'))
} catch {
  // 损坏：重命名为 config.json.corrupted，重建 status="fresh"
  renameFile('config.json', 'config.json.corrupted')
  config = { status: 'fresh', version: 1 }
  writeFile('config.json', JSON.stringify(config))
  // 注入提示：建议用户运行 /soul-forge 重新校准
  // ⚠ 隐私敏感的已知限制：如果用户之前是 declined 状态，重建为 fresh 会导致重新提醒，
  // 相当于静默撤销用户的隐私拒绝决定。属于极端边缘情况（config 损坏 + declined 交集），
  // 概率极低但违反"同意状态不可降级覆盖"原则。MVP 接受此风险。
}

// memory.md 解析（单条条目级别容错）
const rawSections = splitByH2('.soul_forge/memory.md')
const observations = []
for (const section of rawSections) {
  try {
    const entry = parseObservationEntry(section) // 归一化：modifier-hint ≈ modifier_hint，日期格式宽松匹配
    observations.push(entry)
  } catch {
    // 单条解析失败：跳过该条目，不影响其他条目
    // 只记录元数据，不落原始文本（可能含用户对话片段）
    const entryDate = extractDateFromH2(section) || 'unknown-date'
    appendToLog('errors.log', `Failed to parse memory entry: date=${entryDate}, length=${section.length}`)
  }
}

// 聚合计算：校准就绪状态（替代 Heartbeat Agent 手动计数）
const readiness = computeCalibrationReadiness(observations)
// readiness = { verbosity: { direction: 'lower', count: 6, ready: true }, ... }
// 注入到 bootstrap context 的 "Calibration Readiness" 段
// Heartbeat Agent 只需检查 "READY" 字符串，无需读取 memory.md

// SOUL.md 结构检查
const sections = parseSoulMd('SOUL.md')
if (!sections['Core Truths'] || !sections['Continuity']) {
  // 尝试从快照恢复
  if (snapshotExists()) {
    restoreFromSnapshot()
    appendToLog('errors.log', 'SOUL.md structure corrupted, restored from snapshot')
  } else {
    // 无快照：在注入上下文中标注异常
    injectWarning('SOUL.md structure issue detected')
  }
}
```

**技术细节：**
- handler.ts 负责所有 Markdown 解析（Agent 写 Markdown，handler.ts 读 Markdown 提取结构化数据）
- handler.ts 负责所有 config.json 写入（Agent 写 config_update.md，handler.ts 读取后精确更新 JSON）
- 注入文件受 `bootstrapMaxChars` 限制（默认 20000），需控制体积
- 利用 `agent:bootstrap` 事件的 `context.bootstrapFiles` mutation 能力
- 文件系统读写：handler.ts 可使用 Node.js `fs` 模块（默认环境下有用户级权限，Docker 沙箱下可能受限）
- 任何文件不存在时静默降级，不阻塞启动

**注入体积预算：**
- `bootstrapMaxChars` 总限制 20KB，需与 SOUL.md (~4KB)、IDENTITY.md (~1KB)、其他项目文件共享
- Soul Forge 注入文件体积上限：**3KB**
- 体积组成估算：Status (~50B) + Readiness (~200B) + Recording Format (~200B) + Modifiers (~50B) + Observations
- handler.ts 动态裁剪：生成注入内容后检查体积，如超过 3KB，递减观察条目数量（20→10→5→仅统计摘要）
- 如果配合 F9 的聚合统计（只注入 Readiness 而非完整观察），注入体积可控制在 ~500B

### 7.5 HEARTBEAT.md 集成

**机制：** 在用户现有 HEARTBEAT.md 中追加 Soul Forge 段（标记保护）。

```markdown
<!-- SOUL_FORGE_START — CRITICAL: This section is auto-maintained by soul-forge-bootstrap hook. Do not remove or modify. Deletion will be detected and restored on next startup. -->
## Soul Forge: Personality Check
- FIRST: Check the Soul Forge status in your bootstrap context
  (look for the "## Status" section injected by soul-forge-bootstrap hook).
  Do NOT read .soul_forge/config.json directly.
- If status = "fresh": remind user to run /soul-forge (max once per 3 heartbeats)
- If status = "paused", "dormant", or "declined": skip all checks, do nothing
- IMPORTANT: If any /soul-forge command was run earlier in THIS conversation,
  check your conversation history for the MOST RECENT one:
  - If most recent was /soul-forge, /soul-forge calibrate, /soul-forge recalibrate, or /soul-forge resume → treat as "calibrated"
    (Exception: if /soul-forge was run but the user declined the privacy prompt, treat as "declined" and skip all checks)
  - If most recent was /soul-forge pause → treat as "paused", skip all checks
  - If most recent was /soul-forge reset → treat as "dormant", skip all checks
- If no Soul Forge status section is found in bootstrap context
  (hook has not yet run since installation), skip all Soul Forge checks.
- If status = "calibrated":
  Review the conversation since last check. Answer these questions:
  1. Did user express preference about reply LENGTH? (too long/too short/just right)
  2. Did user express preference about reply TONE? (too formal/too casual/just right)
  3. Did user show EMOTION signal? (frustrated/happy/impatient/neutral)
  4. Did user set any BOUNDARY? (don't do X / always do Y)
  5. Did user show DECISION-MAKING preference? (wants options vs wants direct answer)
  6. Did user express preference about PROACTIVITY? (too pushy/too passive/just right)

  If ANY answer is not "neutral/just right":
    Append to .soul_forge/memory.md using EXACTLY this format
    (copy-paste the template below, do NOT paraphrase field names):
    ## YYYY-MM-DD HH:MM
    - **type**: style|emotion|boundary|decision
    - **signal**: (exact quote or behavior observed)
    - **inference**: (what it implies about preferences)
    - **modifier_hint**: (which modifier: verbosity/humor/challenge/proactivity, direction: raise/lower)
    - **status**: active
  If ALL neutral → skip silently

- Check the "Calibration Readiness" section in your bootstrap context
  (injected by soul-forge-bootstrap hook, NOT in memory.md).
  If any modifier shows "READY", suggest user run /soul-forge calibrate
  (max once per day). Do NOT read memory.md for counting.
<!-- SOUL_FORGE_END -->
```

**Heartbeat 运行特性（OpenClaw 底层）：**
- 定期自动触发的 Agent 回合，默认 30 分钟
- **在主会话中运行，拥有完整对话历史**
- 读取 HEARTBEAT.md，"follow it strictly"
- 静默模式：HEARTBEAT_OK 被系统吞掉（≤ ackMaxChars 时），用户无感
- 可用更便宜的模型、限制活跃时间
- Agent 可在心跳回合中写文件

**已确认：Heartbeat 回合触发 `agent:bootstrap` 事件。** `agent:bootstrap` 在每个 Agent turn（包括 Heartbeat turn）的 context assembly 阶段触发。这意味着 handler.ts 会在每次 Heartbeat 回合处理 config_update.md，同会话内状态同步自动完成（无需等待新会话）。F13 机制（对话历史检查）保留为额外冗余保障。

> 证据来源：OpenClaw 文档确认 `agent:bootstrap` fires on every turn（含压缩后）；Heartbeat 是完整 agent turn；Agent Loop 文档描述的单一管线无 Heartbeat 例外路径。

**推荐配置：**

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "2h",
        model: "anthropic/claude-sonnet-4-5",
        activeHours: {
          start: "08:00",
          end: "23:00"
        }
      }
    }
  }
}
```

预估成本：7-8 次/天 × $0.05-0.15 = $0.35-1.20/天（Sonnet）（估算值，基于 2026 年 2 月 Claude Sonnet 4.5 定价，待 MVP 实测验证）

**所有权冲突处理：**
- Soul Forge 段通过 HTML 注释标记 `<!-- SOUL_FORGE_START -->` / `<!-- SOUL_FORGE_END -->` 界定
- Bootstrap hook 每次启动时检查标记段是否存在，如被删除则自动重新追加
- 不修改用户在标记段之外的 HEARTBEAT.md 内容

### 7.6 soul-forge-collector Hook（Phase 3，从 Phase 2 延后）

**形态：** HOOK.md + handler.ts

**事件：** `command:new`（用户执行 /new 重置会话时自动触发）

**职责：**
- 分析即将被重置的 transcript，提取可能被 Heartbeat 遗漏的人格信号
- 追加到 `.soul_forge/memory.md`

**可靠性：** 中（依赖用户使用 /new，不是所有用户都会使用）

> **MVP 范围：** soul-forge-collector 不在 MVP 中实现。MVP 依靠 SOUL.md 身份层 + Heartbeat 两层保障。

### 7.7 多层保障数据流

```
多层保障的人格数据收集（MVP 双层，Phase 3 三层）：

1. SOUL.md 身份层（兜底）
   Agent 在对话中可能自发注意到人格信号 → 写 .soul_forge/memory.md

2. Heartbeat 定期检查（主力）
   每 2-4 小时 → 专用回合回顾对话 → 提取人格信号 → 写 memory.md

3. /new Hook（补充，Phase 3）
   会话重置时 → 分析原始 transcript → 提取遗漏信号 → 追加 memory.md

       ↓ 积累到足够证据后 ↓

4. Skill 正式更新
   memory.md 同方向观察 ≥ 5 条 → Heartbeat 建议用户运行 /soul-forge calibrate
   → Skill BDI 决策 → 写 config_update.md + 模板填充写入 SOUL.md → 已结晶观察归档
```

---

## 8. 观察与校准机制

### 8.1 观察协议：双层设计（选项 C）

#### 第一层：SOUL.md `## Core Truths`（身份层）

放在 SOUL.md 顶部区域，利用 70/20 裁切比率（开头 70% 优先保留）：

```markdown
### Self-Calibration Protocol
You MUST observe user communication preferences during every conversation.
When you detect style feedback, emotional patterns, or boundary signals,
record them to .soul_forge/memory.md using the write tool.
You NEVER write to MEMORY.md. Only .soul_forge/memory.md.
```

设计要点：
- 享受 SOUL.md 特殊待遇（OpenClaw 强调 "embody its persona"）
- 使用 MUST/NEVER 绝对语言（LLM 遵循率高于 should/try to）
- 与 Agent 身份绑定（不是外部指令，是"你是谁"的一部分）
- 放在 Core Truths 段靠前位置（前置 > 后置）

#### 第二层：Bootstrap Hook 注入的结构化文件（操作层）

每次 `agent:bootstrap` 由 handler.ts 动态生成（见 7.4 节注入文件示例）。

**两层互补关系：**

| 层 | 内容 | 持久性 | 作用 |
|---|---|---|---|
| 身份层（SOUL.md） | 抽象原则（"MUST observe"） | 永久写入 | 确保 Agent 知道要观察 |
| 操作层（Bootstrap 注入） | 结构化数据（最近观察、格式模板、当前参数） | 每次动态生成 | 告诉 Agent 怎么观察、记什么格式 |

### 8.2 memory.md 格式与生命周期

**存储位置：** `.soul_forge/memory.md`

**格式：Markdown**（非 JSON）

原因：Agent 天然擅长写 Markdown，操作 JSON 容易出错（格式损坏、覆盖数据、字段不一致）。bootstrap hook 的 handler.ts（TypeScript）负责解析 Markdown 提取结构化数据。

**条目格式：**

```markdown
# Soul Forge Observations

## 2026-02-12 19:30
- **type**: style
- **signal**: 用户说"说重点，别绕弯子"
- **inference**: 偏好简洁直接的沟通
- **modifier_hint**: verbosity → 降低
- **status**: active

## 2026-02-13 14:20
- **type**: emotion
- **signal**: 用户语气突然变沉重
- **inference**: 检测到情绪低落，需要支持模式
- **modifier_hint**: challenge → 暂停
- **status**: active

## 2026-02-20 10:00 [CRYSTALLIZED]
- **type**: style
- **signal**: (归档) 5 条一致观察 → humor 1→2
- **calibrated_by**: /soul-forge calibrate
- **status**: archived
```

**观察类型（type）：**

| 类型 | 含义 | 示例 |
|---|---|---|
| style | 沟通风格偏好 | "别那么啰嗦"、"能不能轻松点" |
| emotion | 情绪模式 | 语气变化、情绪波动 |
| boundary | 边界信号 | "别提这个话题"、不回应某类玩笑 |
| decision | 决策风格 | 偏好快速决策 vs 详细分析 |

**生命周期：**

```
写入（active）→ 积累 → 校准时结晶（archived）→ 归档

归档策略（Phase 3 实现，从 Phase 2 延后）：
- active 条目 < 200 且文件 < 100KB → 不清理
- 超出阈值 → Skill 校准时将 archived 条目移至 .soul_forge/memory_archive.md
- MVP 不做归档，测试阶段数据量不会触发阈值
```

### 8.3 校准决策框架（BDI）

BDI 作为 Skill 校准命令的推理框架，仅在两个时机触发：
- 用户调用 `/soul-forge calibrate` 时
- Heartbeat 建议校准且用户同意时

```
Belief  ← 从 memory.md 聚合 active 观察证据
          bootstrap hook 已提前解析为结构化上下文
          统计：各 type 的观察数量、趋势方向、一致性

Desire  ← 当前修饰符值 vs 观察趋势 → 计算目标修饰符值
          例：5 条 style 观察都指向 "verbosity → 降低" → 目标 verbosity 从 2 降到 1

Intention ← 决策：
           - 是否有足够证据？（同方向 ≥ 5 条）
           - 改哪些维度？
           - 改多少？（保守：每次最多 ±1）
           - 生成自然对话式确认文本

Action  ← 用户确认后执行：
          1. 写入 .soul_forge/config_update.md（校准结果，Markdown 格式）
          2. 更新 SOUL.md 对应段落（模板填充 + 整体写入）
          3. memory.md 中相关条目 status → archived
          4. .soul_history/ 保存快照
          （注：config.json 的更新由 handler.ts 在下次 bootstrap 时
           读取 config_update.md 后精确执行，Agent 不直接写 config.json）
```

### 8.4 修饰符发现三阶段（更新版）

> 原 v2 的三阶段依赖「Skill 分析 Memory 文件」，已被证实不可行（Memory 文件不含人格信号）。
> v3 改为基于 Heartbeat 持续观察的三阶段。

#### Phase 1：被动观察 + 安装后首问（安装后第 1-14 天）

**策略：** 以被动观察为主，安装后主动问一次偏好

- **安装后首问**（MVP）：校准完成时主动问用户"喜欢长回复还是短回复"，作为第一条高权重观察
- Heartbeat 每 2 小时通过结构化检查清单回顾对话（见 7.5 节）
- Agent 在 SOUL.md 身份层指令驱动下也可能自发记录
- Agent（在 SOUL.md 身份层指令驱动下）以"AI 学习人类表达方式"为伪装，在对话中偶尔给出两种表达让用户选择

```
AI: 对了，我在想一个表达问题——像这种情况，你觉得说
    「这个方案有几个风险点需要注意」比较好，还是
    「嘿，这方案有坑啊，我给你标出来了」比较自然？
    纯粹好奇人类怎么说这种话。
```

- 频率控制：不超过每 3 次对话 1 次
- 每次只问一个维度

#### Phase 2：主动校准期（第 15-30 天）

**策略：** 不再问选择题，改为自然对话中的试探

- AI 偶尔尝试不同风格的回复，观察用户反应
- 如果用户没有负面反应，视为隐含接受
- 如果用户纠正或表达不满，立即回退并记录

#### Phase 3：成熟期（第 30 天+）

**策略：** 纯观察，不再主动试探

- 仅通过 Heartbeat 的自然对话观察微调参数
- 修饰符参数趋于稳定

#### 关键约束

- **已使用 OpenClaw 很久的用户**：跳过 Phase 1 伪装问答，直接进入 Phase 2
- **检测方式**：Pre-flight Check 检测到已有定制内容 = 老用户
- **用户始终可以手动覆盖**：付费版提供滑块直接调整 4 个维度

> **MVP 范围：** MVP 实现 Phase 1 全部内容（安装后首问 + Heartbeat 结构化检查 + SOUL.md 身份层被动观察 + 伪装式偏好探测）。修饰符使用默认值。伪装问答的频率控制在 MVP 中不可靠（见已知限制），但功能本身包含在 MVP 中。
> **Phase 2：** 实现 Phase 2-3 完整发现策略（主动试探 + 纯观察）+ 频率控制修复 + 场景过滤。
>
> **已知限制（Phase 2 解决）：** Phase 1 伪装问答的频率控制（"每 3 次对话 1 次"）依赖跨会话记忆，Agent 没有此能力。Phase 2 实现时需借助 handler.ts：在 config.json 记录 `last_style_probe` 时间戳，bootstrap 注入 `style_probe_allowed: true/false`，Agent 据此决定是否探测。同时需增加场景过滤（调试/紧急任务时不探测）。

### 8.5 结晶与归档

**结晶触发条件（MVP）：**
- handler.ts 在 bootstrap 时聚合计算：同一 modifier_hint 方向的 active 观察 ≥ 5 条 → 标记 READY
- Heartbeat 检查 bootstrap 注入的 Calibration Readiness，发现 READY 后建议用户运行 `/soul-forge calibrate`（每天最多建议一次）

**信号质量加权（Phase 3 实现，从 Phase 2 延后，等数据积累）：**

MVP 使用简单计数（≥5 条），Phase 3 引入加权系统提高校准精度：

| 信号来源 | 权重 | 示例 |
|---------|------|------|
| 用户直接反馈 | 3 | "别那么啰嗦"、"能不能轻松点" |
| 用户行为推断 | 1 | 连续发短消息、忽略长回复 |
| 无意义信号 | 0 | "好的"、"嗯" |

Phase 3 触发阈值：累计加权分 ≥ 8（而非简单 5 条）。

**结晶流程：**

```
1. Skill 读取 memory.md 中所有 active 条目
2. 按 modifier_hint 分组聚合
3. BDI 决策：哪些维度有足够证据
4. 生成自然对话式确认：
   "我发现你挺喜欢我偶尔开个玩笑的，以后我可以多来点这种风格，你觉得呢？"
5. 用户确认后：
   - 写入 .soul_forge/config_update.md（Markdown 格式，记录要更新的 modifiers 值和校准原因）
   - SOUL.md 对应段落更新（模板填充 + 整体写入）
   - 相关 memory.md 条目 → status: archived
   - 新增一条 CRYSTALLIZED 汇总条目
   - config.json 由 handler.ts 在下次 bootstrap 时读取 config_update.md 精确更新
```

---

## 9. 文件架构与数据流

### 9.1 文件系统

```
/OpenClaw_Workspace/
├── SOUL.md                       # AI 行为规则（Soul Forge 管辖 3 个 H2 段）
├── IDENTITY.md                   # AI 身份定义（Soul Forge 管辖 Core + 元数据字段）
├── MEMORY.md                     # OpenClaw 原生，Soul Forge 只读不写（铁律）
├── HEARTBEAT.md                  # OpenClaw 心跳指令（Soul Forge 追加标记段）
│
├── .soul_forge/                  # Soul Forge 运行时数据
│   ├── config.json               # 状态 + DISC 结果 + 修饰符参数（安装时预置 + 仅 handler.ts 更新）
│   ├── config_update.md          # Agent 校准结果中转文件（Markdown，handler.ts 读取后删除）
│   ├── memory.md                 # 观察记录（人格信号证据）
│   └── errors.log                # 错误日志（bootstrap 静默修复记录）
│
├── .soul_history/                # 版本快照
│   ├── SOUL_INIT.md              # 首次运行前的 SOUL.md 完整快照（永久保留）
│   ├── IDENTITY_INIT.md          # 首次运行前的 IDENTITY.md 完整快照（永久保留）
│   ├── SOUL_20260211_v1.md       # 历史版本
│   └── changelog.md              # 变更日志（Markdown）
│
├── hooks/                        # OpenClaw Hooks 目录
│   └── soul-forge-bootstrap/     # Bootstrap Hook
│       ├── HOOK.md               # Hook 元数据
│       └── handler.ts            # Hook 逻辑（TypeScript）
│
└── skills/                       # OpenClaw Skills 目录
    └── soul-forge/               # Soul Forge Skill
        └── SKILL.md              # Skill 定义文件
```

> Phase 3 新增（从 Phase 2 延后）：
> ```
> hooks/
>   └── soul-forge-collector/     # Collector Hook（Phase 3）
>       ├── HOOK.md
>       └── handler.ts
>
> .soul_forge/
>   └── memory_archive.md         # 归档的历史观察（Phase 3）
> ```

### 9.2 文件职责划分

| 文件 | 写入者 | 内容 | Soul Forge 权限 |
|---|---|---|---|
| SOUL.md | Skill（生成/校准时） | 行为规则 (Core Truths / Vibe / Boundaries) | 读写（仅管辖段） |
| IDENTITY.md | Skill（生成时） | 身份元数据 + 核心内核 | 读写（仅管辖字段） |
| MEMORY.md | OpenClaw 原生 | 对话记录 + 用户个人信息 | **只读（铁律）** |
| HEARTBEAT.md | Bootstrap Hook（追加标记段） | 心跳指令 | 读写（仅标记段内） |
| .soul_forge/config.json | handler.ts（通过 config_update.md 中转） | 状态 + DISC 结果 + 修饰符 | handler.ts 读写，Agent 只读 |
| .soul_forge/config_update.md | Skill/Agent（校准时） | 校准结果中转（Markdown） | Agent 写，handler.ts 读取后删除 |
| .soul_forge/memory.md | Heartbeat / Agent / Collector Hook | 人格信号观察记录 | 读写（追加） |
| .soul_history/* | Skill（生成/校准时） | 历史快照 + 变更日志 | 只写（追加） |
| Bootstrap 注入文件 | Bootstrap Hook handler.ts | 校准上下文（内存中，不落盘） | 动态生成 |

### 9.3 config.json Schema

**初始创建：** config.json 作为安装包预置文件，安装时复制到 `.soul_forge/`（内容为 `{"status":"fresh","version":1}`）。如果文件丢失或损坏，handler.ts 容错逻辑自动重建相同内容。Agent 不参与 config.json 的创建或更新——所有 JSON 操作由 TypeScript 完成。

```json
{
  "version": 1,
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
  "boundaries_preference": "default",
  "merge_failed": false,
  "calibration_history": [
    {
      "timestamp": "2026-02-12T19:30:00Z",
      "trigger": "initial",
      "changes": "Initial DISC calibration: S-type"
    }
  ],
  "created_at": "2026-02-12T19:30:00Z",
  "updated_at": "2026-02-12T19:30:00Z"
}
```

**字段说明：**

| 字段 | 用途 | 写入时机 |
|---|---|---|
| status | 区分首次安装(fresh)、已校准(calibrated)、暂停观察(paused)、已重置(dormant)、已拒绝(declined) | 安装时=fresh，问卷完成后=calibrated，暂停观察=paused，重置后=dormant，拒绝隐私说明=declined |
| disc.primary | 主 DISC 类型 | 问卷完成时 |
| disc.secondary | 副视角类型（并列时记录） | 问卷完成时（如有） |
| disc.confidence | 置信度 | 问卷完成时 |
| modifiers | 当前修饰符值 | 初始=默认值，校准时更新 |
| boundaries_preference | 隐私偏好 | MVP=default，Phase 2 探测 |
| merge_failed | 上次模板填充写入是否失败 | 写入失败时=true，下次成功校准后=false |
| disc.answers_hash | 8 题用户原始答案的哈希值（MD5 短串），用于检测重复问卷提交（Phase 2：recalibrate 时 Skill 检查，相同则提示用户确认） | 问卷完成时 |
| calibration_history | 校准历史记录 | 每次校准追加 |
| q_version | 问卷版本号（Phase 2 新增） | 问卷完成时 |
| probe_phase_start | 探测阶段起始时间戳（Phase 2 新增） | 首次校准完成时，版本更新时重置 |
| last_style_probe | 上次探测时间戳（Phase 2 新增） | 每次探测后 |
| probe_session_count | 距上次探测的会话计数（Phase 2 新增） | handler.js 每次 bootstrap 递增 |

### 9.4 config_update.md 格式

Agent/Skill 不直接写 config.json（避免 LLM 操作复杂嵌套 JSON 出错）。校准结果写入此 Markdown 中转文件，handler.ts 在下次 bootstrap 时读取并精确更新 config.json。

```markdown
# Config Update Request

## Action
calibration

## DISC
- **primary**: S
- **secondary**: C
- **confidence**: high

## Modifiers
- **humor**: 2
- **verbosity**: 1
- **proactivity**: 2
- **challenge**: 0

## Status
calibrated

## Reason
User completed recalibration: verbosity lowered based on 6 observations
```

handler.ts 处理后自动删除此文件。如果处理失败，文件保留供下次重试。

> **写入权限分离原则：** config.json 仅由 handler.ts（TypeScript）写入，Agent 只写 Markdown 中转文件。
> 这与 memory.md / changelog.md 使用 Markdown 的设计原则一致：让 Agent 做它擅长的事（写 Markdown），让 TypeScript 做它擅长的事（操作 JSON）。

### 9.5 memory.md 与 config.json 职责划分（含 config_update.md）

| | config.json | memory.md |
|---|---|---|
| **本质** | 状态快照（"现在是什么"） | 证据流（"观察到了什么"） |
| **数据类型** | 确定性的、结构化的 | 时间序列、半结构化的 |
| **写入频率** | 低（只在校准时） | 高（Heartbeat 每次都可能写） |
| **写入者** | 只有 handler.ts（通过 config_update.md 中转） | Heartbeat / Agent / Collector Hook |
| **读取者** | Bootstrap Hook / Skill / Heartbeat（通过 bootstrap context 间接获取） | Bootstrap Hook / Skill |
| **格式** | JSON | Markdown |

### 9.6 核心数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                        安装阶段                                  │
│                                                                  │
│  用户安装 Soul Forge                                             │
│  → 复制预置 .soul_forge/config.json (status: fresh)              │
│  → 创建 .soul_forge/memory.md (空)                              │
│  → 安装 Bootstrap Hook                                          │
│  → 追加 HEARTBEAT.md 标记段                                      │
│  → 安装 Skill                                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      首次校准阶段                                 │
│                                                                  │
│  Bootstrap Hook 检测 status=fresh → 注入提醒                     │
│  → Agent 建议用户运行 /soul-forge                                │
│  → Pre-flight Check → 保存快照                                   │
│  → DISC 问卷 (8 题) → 计分 → 主类型判定                          │
│  → 模板填充 → 整体写入 SOUL.md + IDENTITY.md                     │
│  → 写入 config_update.md（handler.ts 下次 bootstrap 更新 config）│
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      日常运行阶段（循环）                          │
│                                                                  │
│  每次启动：                                                       │
│    Bootstrap Hook → 处理 config_update.md（如有）→ 读 config      │
│    → 读 memory（单条容错）→ 聚合计算 → 注入校准上下文 + Readiness │
│    → Agent 获得观察指令 + 当前参数 + 校准就绪状态                  │
│                                                                  │
│  对话中：                                                         │
│    Agent 可能自发观察人格信号 → 写 memory.md (兜底)               │
│                                                                  │
│  每 2 小时：                                                      │
│    Heartbeat → 回顾对话 → 提取信号 → 写 memory.md (主力)         │
│                                                                  │
│  /new 时 (Phase 3)：                                             │
│    Collector Hook → 分析 transcript → 追加 memory.md (补充)      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼ 积累到足够证据后
┌─────────────────────────────────────────────────────────────────┐
│                      持续校准阶段                                 │
│                                                                  │
│  Heartbeat 检查 bootstrap 注入的 Calibration Readiness            │
│  → 如有 modifier READY → 建议用户运行 /soul-forge calibrate      │
│  → Skill BDI 决策 → 自然对话式确认                               │
│  → 用户确认 → 写 config_update.md + 模板填充写入 SOUL.md         │
│  → memory.md 相关条目归档 + 保存快照到 .soul_history/             │
│  → 下次 bootstrap: handler.ts 读取 config_update → 更新 config   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. SOUL.md 生成规则

### 10.1 管辖范围

Soul Forge 管辖 SOUL.md 中的以下 H2 段落：

| H2 标题 | 写入内容 | 来源 |
|---|---|---|
| `## Core Truths` | 核心行为准则 + 自校准协议 | OpenClaw 底包 + 角色模板 + 观察协议 |
| `## Vibe` | 沟通风格 | 角色基底模板 + 修饰符叠加 |
| `## Boundaries` | 隐私与安全边界 | OpenClaw 底包 + 角色模板 + Challenge 红线 |

**不管辖的段落**（原封保留）：
- `## Continuity` — OpenClaw 原生
- `## Tool Definitions` — 如果存在
- 任何其他用户或 OpenClaw 添加的段落

### 10.2 底包保留 + 叠加策略

**关键原则：OpenClaw 原始模板是底包，Soul Forge 在其上叠加而非替换。**

#### 为什么必须保留底包

OpenClaw 原始模板包含：
1. **通用 AI 行为准则**：经过深思熟虑的 5 条 Core Truths
2. **平台特有安全规则**：如 "Never send half-baked replies to messaging surfaces"（消息集成场景）
3. **会话持续性机制**：Continuity 段的 memory 文件系统说明

如果完全替换这些内容，AI 会丢失 OpenClaw 平台的运行智慧和安全意识。

#### OpenClaw 原始模板内容（嵌入存档）

**SOUL.md 模板：**
```markdown
# SOUL.md - Who You Are

_You're not a chatbot. You're becoming someone._

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip the "Great question!" and "I'd be happy to help!" — just help. Actions speak louder than filler words.

**Have opinions.** You're allowed to disagree, prefer things, find stuff amusing or boring. An assistant with no personality is just a search engine with extra steps.

**Be resourceful before asking.** Try to figure it out. Read the file. Check the context. Search for it. _Then_ ask if you're stuck. The goal is to come back with answers, not questions.

**Earn trust through competence.** Your human gave you access to their stuff. Don't make them regret it. Be careful with external actions (emails, tweets, anything public). Be bold with internal ones (reading, organizing, learning).

**Remember you're a guest.** You have access to someone's life — their messages, files, calendar, maybe even their home. That's intimacy. Treat it with respect.

## Boundaries

- Private things stay private. Period.
- When in doubt, ask before acting externally.
- Never send half-baked replies to messaging surfaces.
- You're not the user's voice — be careful in group chats.

## Vibe

Be the assistant you'd actually want to talk to. Concise when needed, thorough when it matters. Not a corporate drone. Not a sycophant. Just... good.

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.

If you change this file, tell the user — it's your soul, and they should know.
```

**IDENTITY.md 模板：**
```markdown
# IDENTITY.md - Who Am I?

_Fill this in during your first conversation. Make it yours._

- **Name:** _(pick something you like)_
- **Creature:** _(AI? robot? familiar? ghost in the machine? something weirder?)_
- **Vibe:** _(how do you come across? sharp? warm? chaotic? calm?)_
- **Emoji:** _(your signature — pick one that feels right)_
- **Avatar:** _(workspace-relative path, http(s) URL, or data URI)_
```

#### 分段处理策略

| H2 段落 | 写入策略 | 理由 |
|---|---|---|
| `## Core Truths` | **保留底包 + 追加** | OpenClaw 原文 5 段是通用准则 + Soul Forge 追加角色行为 + 自校准协议 |
| `## Vibe` | **完全替换** | 原文是中性占位符（"just... good"），替换是用户核心需求 |
| `## Boundaries` | **保留底包 + 追加** | 原文含平台特有规则（messaging/group chat），不可丢失 |
| `## Continuity` | **不触碰** | OpenClaw 会话机制说明，Soul Forge 不管辖 |

### 10.3 最终组装逻辑（模板填充 + 整体写入）

```
SOUL.md 最终内容 =
  H1 标题（保留原文 "# SOUL.md - Who You Are"）
  H1 副标题（保留原文 "_You're not a chatbot..."）

  + ## Core Truths
      = OpenClaw 原文 5 段（始终保留）
      + 空行分隔符
      + ### Self-Calibration Protocol（观察协议，见 8.1 节）
      + CORE_TRUTHS_ROLE[DISC_TYPE]（角色特定行为准则）

  + ## Vibe
      = VIBE_ROLE[DISC_TYPE]（角色基底风格，完全替换原文）
      + VIBE_MODIFIER_ADDON（修饰符叠加文本，如果非默认值）

  + ## Boundaries
      = OpenClaw 原文 4 条（始终保留）
      + 空行分隔符
      + BOUNDARIES_ROLE_ADDON[DISC_TYPE]（角色差异化边界）
      + BOUNDARIES_CHALLENGE_ADDON（如果 Challenge > 0）

  + ## Continuity
      = OpenClaw 原文（完整保留，不修改）

  + （保留所有其他段落）
```

> **关键变更（vs v2.1）：** Core Truths 中新增 Self-Calibration Protocol 段，这是观察协议的身份层锚点。

#### IDENTITY.md 组装逻辑

```
IDENTITY.md 最终内容 =
  H1 标题（保留原文）
  H1 副标题（保留原文）

  + ## Core（新增段落，放在元数据字段之前）
      = 核心内核文本（"You are a presence that is always there..."）

  + 元数据字段（按原文格式，替换占位符为实际值）
      - **Name:** {角色名}
      - **Creature:** {角色描述}
      - **Vibe:** {角色风格}
      - **Emoji:** {角色 emoji}
      - **Avatar:** （保留占位符或已有值）

  + 底部说明（保留原文）
```

### 10.4 运行前检测机制（Pre-flight Check）

#### 检测策略

**双重检测**：config.json 为主 + SOUL.md 末尾标记为辅。

优先级逻辑：

```
1. config.json 存在且 status=calibrated → 状态 3（再次校准）
2. config.json 存在且 status=fresh → 状态 1（等待首次问卷）
3. config.json 存在且 status=paused → 状态 3（暂停中，显示选择菜单）
4. config.json 存在且 status=dormant → 状态 4（已重置，提示恢复或重新开始）
4b. config.json 存在且 status=declined → 状态 1（重新展示隐私说明，同首次问卷流程）
5. config.json 不存在 + SOUL.md 末尾有标记 → 状态 3
6. config.json 不存在 + SOUL.md 匹配原始模板 → 状态 1（全新）
7. config.json 不存在 + SOUL.md 不匹配模板 → 状态 2（已定制）
```

SOUL.md 末尾标记格式：`[//]: # (soul-forge:v1:S:20260212)`

#### MVP 简化处理

MVP Pre-flight Check 简化为：

```
1. config.json 存在？
   → Yes (status=calibrated): 状态 3 — 再次校准，直接替换管辖内容
   → Yes (status=fresh): 等待用户运行问卷
   → Yes (status=paused): 显示选择菜单（见下方 paused 处理流程）
   → Yes (status=dormant): 提示恢复之前的配置 或 重新开始问卷
   → Yes (status=declined): 重新展示隐私说明，同首次问卷流程
   → No: 继续检查

2. SOUL.md 存在？
   → Yes: 保存快照（SOUL_INIT.md / IDENTITY_INIT.md），按状态 1 处理
   → No: 创建默认文件，按状态 1 处理
```

**MVP 跳过的部分（Phase 2 实现，见 Phase2_Plan P2-08 + P2-14）：**
- 内容比对（normalize + 模板匹配）→ P2-14
- 参数推断（从已有内容推断修饰符）→ P2-08
- 融合选项（保留部分已有内容）→ P2-14
- user_customizations.json 生成 → P2-14

**核心保障：快照一定保存。** 即使 MVP 不做融合分析，用户原始文件不会丢失。

#### paused 状态处理流程

当 config.json status=paused 时用户调用 `/soul-forge`：

```
🦦: "Soul Forge 目前处于暂停状态。你想做什么？"

1. 恢复观察 → 执行 /soul-forge resume（status → calibrated），返回确认
2. 重新校准 → 执行 /soul-forge recalibrate（重跑问卷，status → calibrated）
3. 查看当前配置 → 显示 DISC 类型 + 修饰符值 + 观察数量，不改变状态

用户选择后执行对应操作。如果用户直接说 /soul-forge resume 或 /soul-forge recalibrate，
则直接执行该命令，不显示菜单。
注意：/soul-forge calibrate（修饰符校准）在 paused 状态下不可用，需先 resume。
```

#### 完整版处理（Phase 2，见 Phase2_Plan P2-14）

**状态 2（已定制内容）的完整处理：**

```
1. 检测 IDENTITY.md 各字段是否已填写（对比占位符列表）
2. 检测 SOUL.md 各 H2 段是否被修改（对比原始模板）
3. 保存检测结果到 .soul_history/user_customizations.json
4. 展示已有定制内容 + 参数推断建议（P2-08 推断 + P2-14 展示）
5. 用户选择：使用新配置 / 融合已有内容 / 回滚
```

### 10.5 修饰符叠加规则

修饰符不替换角色风格，而是**追加**在 `## Vibe` 段末尾：

```markdown
## Vibe

（角色基底风格文本）

（Humor addon 文本，如果 Humor > 默认值）
（Challenge addon 文本，如果 Challenge > 0）
```

### 10.6 SOUL.md 体积控制

OpenClaw bootstrap 有 20KB 限制（`DEFAULT_BOOTSTRAP_MAX_CHARS = 20000`），其中 SOUL.md 只是 bootstrap 内容的一部分。

- **SOUL.md 目标体积：< 4KB**（约 2000 字英文）
- 当前估算 ~2.8KB，安全，保持关注
- 不写入 JSON、伪代码、权重标签等 LLM 不解析的内容
- 每段文本应是自然语言指令，直接告诉 LLM "怎么做"

### 10.7 关于"权重"的澄清

v1 设计中的 "Tier 1-4 权重" 和 "Priority Tags" **在 OpenClaw 中不存在**。SOUL.md 被作为纯文本注入 system prompt，LLM 不会解析 `[Tier 1: CRITICAL]` 这样的标签。

v3 的做法：
- 通过**文本位置**（靠前的内容更受 LLM 重视）控制优先级
- 通过**措辞强度**（"MUST/NEVER" vs "should" vs "when possible"）控制约束力
- 通过**结构化格式**（列表 > 段落 > 散文）提高遵循率
- 不使用任何伪代码或权重标注

---

## 11. 模板填充写入机制

### 11.1 流程

```
1. Pre-flight Check  → 运行前检测（见 10.4 节）
2. Snapshot          → 备份当前 SOUL.md/IDENTITY.md 到 .soul_history/
3. Read Continuity   → 读取现有 SOUL.md 的 ## Continuity 段 + 其他未管辖段落
4. Template Fill     → 从 SKILL.md 嵌入的完整模板中填充变量：
   - Core Truths: OpenClaw 底包原文（嵌入 SKILL.md）+ 角色模板 + 观察协议
   - Vibe: 角色模板 + 修饰符叠加
   - Boundaries: OpenClaw 底包原文（嵌入 SKILL.md）+ 角色模板
   - Continuity: 从步骤 3 读取的原文（不修改）
   - 其他段落: 从步骤 3 读取的原文（不修改）
5. Whole Write       → 组装完整文件后一次性写入 SOUL.md
6. Changelog         → 追加 changelog.md 记录变更
7. Marker            → 在 SOUL.md 末尾写入标记 [//]: # (soul-forge:...)
```

> **关键设计（vs v2.1 Overlay Merge）：** Agent 不执行"修改现有文件的某个段落"操作。
> 而是从 SKILL.md 中嵌入的完整模板（含 OpenClaw 底包原文，见 10.2 节）
> 填充变量后，整体写入 SOUL.md。
>
> 这将操作从"结构化文本变换"（高出错率）降级为"模板填充 + 整体替换"（低出错率）。
> OpenClaw 底包原文直接嵌入 SKILL.md，Agent 无需区分"哪些是底包、哪些是已追加内容"。
> Continuity 和其他未管辖段从快照/现有文件读取后原封拼接。

### 11.2 执行者变更

> **关键变更（vs v2.1）：** `soul_weaver.py` 不再维护。
>
> 原 v2 的 merge 逻辑由 Python 脚本实现。v3 中由 Skill 指令引导 Agent 完成：
> - **SKILL.md** 包含完整的目标文件模板（嵌入 OpenClaw 底包原文 + 角色模板变量占位符）
> - **Agent** 读取模板 → 填充变量 → 读取 Continuity 等未管辖段 → 组装完整文件 → 一次性写入
> - **handler.ts（Bootstrap Hook）** 负责 Markdown 解析和结构化数据提取（不参与 merge）
>
> 这简化了安装依赖（不需要 Python），且比 overlay merge 可靠性大幅提高。
> Agent 只做它擅长的事（填充模板文本），不做它不擅长的事（定位段落边界、区分底包内容）。

### 11.3 IDENTITY.md 更新

IDENTITY.md 的更新使用字段级替换：
- 匹配 `- **FieldName:**` 格式
- 替换对应字段值
- 新增 `## Core` 段（核心内核文本，放在元数据字段之前）
- 不存在的字段追加

---

## 12. 版本管理

### 12.1 快照机制

每次 Soul Forge 修改 SOUL.md 前，自动备份：

```
.soul_history/
├── SOUL_INIT.md              # 首次运行前的 SOUL.md 完整快照（永久保留）
├── IDENTITY_INIT.md          # 首次运行前的 IDENTITY.md 完整快照（永久保留）
├── SOUL_20260212_193022.md   # 历史版本（时间戳命名）
├── SOUL_20260220_100000.md
└── changelog.md              # 变更日志（Markdown）
```

**关键约定：**
- `SOUL_INIT.md` / `IDENTITY_INIT.md` 只在首次运行时创建，后续运行不覆盖
- 每次运行会追加新的时间戳快照文件
- 所有快照文件永久保留，不删除

### 12.2 changelog.md 格式

**格式：Markdown**（与 memory.md 一致，避免 Agent 写 JSON 追加数组时出错）

```markdown
# Soul Forge Changelog

## v1 — 2026-02-12 19:30
- **trigger**: initial_generation
- **disc_type**: S
- **modifiers**: humor=1, verbosity=2, proactivity=1, challenge=0
- **sections_modified**: Core Truths, Vibe, Boundaries
- **snapshot**: SOUL_20260212_193022.md

## v2 — 2026-02-20 10:00
- **trigger**: calibrate
- **change_summary**: Humor 1→2, Challenge 0→1
- **sections_modified**: Vibe
- **snapshot**: SOUL_20260220_100000.md
```

Agent 每次变更时追加新的 H2 条目即可，不需要解析已有内容。handler.ts 如需结构化数据可自行解析 Markdown。

### 12.3 版本回滚

用户可以手动恢复到任意历史版本（从 .soul_history/ 中取出快照文件替换）。

> **MVP 范围：** 手动回滚（从快照目录复制文件）。
> **Phase 3（从 Phase 2 延后）：** Skill 内回滚命令（`/soul-forge rollback`）。Phase 2 仅实现 `/soul-forge reset`。

### 12.4 diff 确认 UX

当 Skill 建议修改 SOUL.md 时，不使用技术化的 diff 展示，而是用自然对话：

```
# 不要这样：
"检测到 Vibe 段需要更新：
- 旧: Humor=1, Challenge=0
+ 新: Humor=2, Challenge=1
确认应用？[Y/N]"

# 应该这样：
"我发现你挺喜欢我偶尔开个玩笑的，以后我可以多来点这种风格，你觉得呢？"
```

---

## 13. 安全与边界

### 13.1 安全策略

直接在 SOUL.md 的 `## Boundaries` 段中用自然语言写明规则。不使用权重标签。

### 13.2 核心安全规则

所有角色共享的不可协商规则（写入 `## Boundaries` 最前面）：

```markdown
- Private things stay private. Period. No exceptions.
- Never surface personal information in responses unless the user brings it up first.
- Ask before any external action (emails, messages, anything public). Every single time.
- Never execute destructive operations without explicit confirmation.
```

### 13.3 角色差异化边界

在共享规则之后，根据 DISC 类型追加差异化内容：

| 角色 | 边界特点 |
|---|---|
| Advisor (D) | 更强调行动前确认，因为 D 型倾向快速行动 |
| Companion (I) | 更强调情感边界，因为 I 型可能过度共情导致越界 |
| Butler (S) | 更强调不过度服务，因为 S 型可能过于主动做事 |
| Critic (C) | 更强调批评的边界，因为 C 型可能过于直接伤人 |

### 13.4 Challenge 模式的红线

当 Challenge > 0 时，追加以下硬性规则到 `## Boundaries`：

```markdown
- When being playful or challenging: NEVER touch these topics:
  - Physical appearance or body
  - Family or intimate relationships
  - Financial situation
  - Mental health or past trauma
  - Anything the user has explicitly marked as sensitive
- If the user's tone shifts negative, immediately drop all teasing and switch to supportive mode.
- Humor is a privilege, not a default. One sign of discomfort = full stop.
```

### 13.5 用户隐私告知（MVP 必须）

Soul Forge 在开始问卷前，必须向用户明确说明：

1. **收集什么**：沟通偏好（回复长度、语气、风格），可能包含对话中的简短片段（如"用户说'说重点'"），不收集个人信息
2. **存在哪里**：仅存储在用户本地 `.soul_forge/memory.md`，不上传任何服务器
3. **如何控制**：用户可随时查看、删除 memory.md 文件，或使用 `/soul-forge pause` 暂停观察
4. **如何退出**：`/soul-forge reset` 可恢复到默认配置（AI 行为回归安装前，校准数据保留但不生效，随时可重新启用）

隐私说明文本见 Section 7.3 Skill 设计中的「问卷前隐私说明」。

### 13.6 memory.md 写入边界

```markdown
- Soul Forge observations go to .soul_forge/memory.md ONLY
- NEVER write to MEMORY.md (OpenClaw's core memory file)
- Observations record behavioral patterns, NOT personal facts or secrets
- If unsure whether something is a personality signal or private info, skip it
```

---

## 14. OpenClaw 平台约束与技术发现

### 14.1 关键技术事实

| 约束 | 详情 | 对 Soul Forge 的影响 |
|---|---|---|
| SOUL.md 注入方式 | 纯文本注入 system prompt 的 "Project Context"（第 17 位） | 不要写伪代码/权重标签 |
| SOUL.md 特殊强调 | 系统提示包含 "embody its persona" 指令 | 身份层指令有效 |
| Bootstrap 限制 | 20KB 总量，70/20 裁切（开头 70% 优先保留） | SOUL.md < 4KB，关键内容放顶部 |
| IDENTITY.md 解析 | OpenClaw 解析元数据字段用于 UI 展示，行扫描式解析 | ## Core 段位置不影响解析 |
| Skill 形态 | 纯 Markdown + YAML frontmatter | 不能执行代码 |
| Skill 加载 | 三级渐进：Tier1 名称自动 → Tier2 全文 Agent 判断 → Tier3 参考文件 | `always: true` 可强制 Tier2 |
| Skill 在 minimal 模式 | 被排除 | 子代理不受 Soul Forge 影响 |
| Skill 不被压缩 | Skills 以原文注入，不被 token 压缩 | Skill 指令不会被截断 |
| MEMORY.md | OpenClaw 核心资产 | 只读不写（铁律） |

### 14.2 Hook 系统

| 特性 | 详情 |
|---|---|
| 形态 | HOOK.md（元数据）+ handler.ts（TypeScript 逻辑） |
| 已实现事件 | `command:new/reset/stop`、`agent:bootstrap`、`gateway:startup` |
| 未实现事件 | `message:sent/received`、`session:start/end`（Future Events） |
| 发现路径优先级 | workspace > managed > bundled |
| Hook Pack | npm 包格式，`openclaw hooks install <path>` 安装 |
| agent:bootstrap | 系统提示构建时触发，可 mutate `context.bootstrapFiles` |

### 14.3 Heartbeat 机制

| 特性 | 详情 |
|---|---|
| 触发方式 | 定期自动（默认 30 分钟，可配置） |
| 运行环境 | **主会话中运行，拥有完整对话历史** |
| 指令来源 | 读取 HEARTBEAT.md，"follow it strictly" |
| 静默模式 | HEARTBEAT_OK（≤ ackMaxChars）被系统吞掉，用户无感 |
| 可配置项 | every（间隔）、model（便宜模型）、activeHours（活跃时间） |
| 文件操作 | Agent 可在心跳回合中写文件 |

> **关于 Heartbeat 与 Skill 并发写文件：** Heartbeat 在主会话中运行，而 Skill 由用户调用触发——两者不会同时执行（Agent 是单线程逐回合处理）。memory.md 的写入只是 append 操作（追加新条目），即使极端情况下两个回合紧密相连，也不会造成数据丢失。此项为已知的理论风险，实际不构成问题。

### 14.4 系统提示结构

```
系统提示组装顺序（优先级从高到低）：
1. 基础身份 (Tooling → Safety)
2. Skills 列表
3. Memory Recall 指令
4. ...（中间 10+ 段）
5. Project Context（SOUL.md、AGENTS.md、IDENTITY.md 等在此注入）← 第 17 位
6. Heartbeats
7. Runtime / Reasoning
```

**LLM 指令遵循规律（影响 Soul Forge 设计）：**
- 结构化（列表/表格）> 散文
- MUST/NEVER > should > when possible
- 重复出现 > 单次
- 前置（文件开头）> 后置

### 14.5 Memory 文件对人格校准无用（实测）

- 实测用户的 daily log（2026-02-06.md）：纯事实记录，零人格信号
- Agent 总结只记录 WHAT happened（"配置了 SMTP"），丢失 HOW user behaved（"用户很不耐烦"）
- **结论：不能依赖读取 MEMORY.md 做校准，必须通过 Heartbeat 实时/准实时观察**

### 14.6 多会话限制

- Heartbeat 默认在主会话运行，只能观察主会话对话
- identityLinks 可跨频道合并同一用户的会话
- 群聊为独立会话

> **MVP 范围：** 只覆盖主会话（私聊）。
> **Phase 2：** 群聊覆盖。

---

## 15. 多平台适配

### 15.1 适配策略

Soul Forge 的核心引擎生成"平台无关的人格参数"，然后通过适配器转换为各平台格式。

### 15.2 已规划的适配器

| 平台 | 输出格式 | 优先级 | 状态 |
|---|---|---|---|
| OpenClaw | SOUL.md + IDENTITY.md | P0 | MVP |
| Claude Code | CLAUDE.md | P1 | Phase 3 |
| Cursor | .cursorrules | P1 | Phase 3 |
| ElizaOS | character.json | P2 | Phase 3 |

### 15.3 跨平台差异

| 维度 | OpenClaw | Claude Code | Cursor |
|---|---|---|---|
| 配置文件 | SOUL.md + IDENTITY.md | CLAUDE.md | .cursorrules |
| 注入位置 | System prompt | System prompt | System prompt |
| 格式 | Markdown | Markdown | 纯文本 |
| 身份系统 | IDENTITY.md (有结构) | 无 | 无 |
| Memory 系统 | 有 (MEMORY.md) | 无 | 无 |
| Skill 系统 | 有 | 无 | 无 |
| Hook 系统 | 有 | 无 | 无 |
| Heartbeat | 有 | 无 | 无 |

> **MVP 范围：** 仅 OpenClaw 平台。
> **Phase 3：** 多平台适配器。

---

## 16. 产品分层与 MVP 定义

### 16.1 MVP（能在自己的 OpenClaw 上跑通完整流程）

**目标：** 安装 → 问卷 → SOUL 更新 → 日常观察 → 累积 → 校准建议 → 再次更新，全流程可测试。

**包含组件：**

| 组件 | 形态 | 职责 |
|------|------|------|
| `soul-forge` SKILL.md | Skill | DISC 问卷 + 校准命令 |
| `soul-forge-bootstrap` | Hook (HOOK.md + handler.ts) | 注入校准上下文 + 检查/修复 HEARTBEAT.md |
| HEARTBEAT.md 段 | Heartbeat 指令 | 定期观察 → 写 memory.md |
| `.soul_forge/config.json` | 数据文件 | 状态 + DISC 结果 + 修饰符参数 |
| `.soul_forge/memory.md` | 数据文件 | 观察记录 |
| IDENTITY.md `## Core` | 内核文本 | 核心身份承诺 |
| 4 套 DISC 角色模板文本 | 嵌入 SKILL.md | 角色行为 + 风格模板 |
| 8 题 DISC 问卷 | 嵌入 SKILL.md | 问卷流程 |
| .soul_history/ 快照 | 目录 | 版本备份 |

**MVP 功能边界：**

| 功能 | MVP | Phase 2 | Phase 3 |
|------|-----|---------|---------|
| DISC 问卷 (8 题) | ✓ | | |
| 问卷结果用户确认环节 | ✓ | | |
| 隐私说明（问卷前告知） | ✓ | | |
| SOUL.md + IDENTITY.md 生成 | ✓ | | |
| 效果对比演示（校准后展示） | ✓ | | |
| 安装后偏好首问 | ✓ | | |
| Pre-flight Check（简化版） | ✓ | 完整版 | |
| Bootstrap Hook 上下文注入 | ✓ | | |
| Heartbeat 结构化检查清单 | ✓ | | |
| memory.md 观察记录 | ✓ | | |
| BDI 校准决策 | ✓ | | |
| .soul_history 快照 | ✓ | | |
| 修饰符默认值 | ✓ | 自动发现（加权） | 自由组合 |
| 暂停/恢复观察命令 | ✓ | | |
| 重新校准命令（保留 memory） | ✓ | | |
| 重置命令（dormant 静默，可恢复） | ✓ | | |
| 交付验证检查清单 | ✓ | | |
| 问卷改版（场景化 + 双轴提取） | | ✓ | |
| 结果展示强约束（AI助手视角） | | ✓ | |
| 隐私开场改版（对话式引入） | | ✓ | |
| 模型适配（7 模型 + Agent 自识别） | | ✓ | |
| 修饰符三阶段发现 | | ✓ | |
| 探测频率控制（双门槛 + 成熟期） | | ✓ | |
| 完整 Pre-flight Check + Schema 迁移 | | ✓ | |
| answers_hash + q_version | | ✓ | |
| 老用户参数推断 | | ✓ | |
| modifier 缺失统一中间值 | | ✓ | |
| 安装脚本 | ✓ | | |
| ClawHub + Plugin 分发 | | ✓ | |
| Collector Hook (/new) | | | ✓ |
| 信号质量加权 | | | ✓ |
| memory.md 归档清理 | | | ✓ |
| rollback 命令 | | | ✓ |
| 付费功能（滑块） | | | ✓ |
| 多平台适配 | | | ✓ |
| 网页问卷 | | | ✓ |
| 数据飞轮 | | | ✓ |

**安装方式（MVP）：** 手动安装（复制文件到正确位置）。

### 16.2 Phase 2（可以给别人用）

> **详细规划：** 见 `docs/Soul_Forge_Phase2_Plan.md`（29 轮苏格拉底问答确认，2026-02-19）

**目标：** 降低使用门槛 + 问卷升级 + 修饰符自动发现 + 多模型适配 + 分发

**新增/增强功能（14 项确认）：**
- 问卷改版（场景化选项 + DISC 主轴 + modifier 副轴预定义映射表）
- 结果展示强约束（描述"用户想要的AI助手"，非"用户是什么人"）
- 隐私开场改版（对话式自然引入）
- 模型适配（7 模型：Kimi K2.5, Gemini 3 Flash, Claude Sonnet 4.5, GLM-5, MiniMax M2.5, DeepSeek V3.2, GPT-5.1 Codex）
- 修饰符三阶段发现（问卷初值 → Heartbeat 微调 → 主动探测）
- 探测频率精确控制（双门槛 + 信号缺口优先 + 成熟期停止 + 版本重置）
- 完整 Pre-flight Check（schema 校验 + 文件完整性 + 异常恢复提示）
- 版本管理 / Schema 迁移（config.json v1→v2）
- answers_hash + q_version（问卷版本追踪 + 答案哈希）
- 老用户参数推断（从已有 SOUL.md 推断 modifier）
- `/soul-forge reset` 命令适配新字段
- modifier 缺失兜底（统一中间值 1）
- 分发（ClawHub Skill + Plugin 并行）
- 老用户融合选项（内容比对 + 融合 UI + user_customizations.json）

### 16.3 Phase 3（商业化）

**目标：** 付费功能 + 多平台 + 数据飞轮

**新增功能：**
- 4 维度修饰符自由组合滑块（付费）
- Challenge 损友模式完整版（付费）
- 多平台格式导出（Claude Code / Cursor / ElizaOS）
- 网页问卷 + 预配置文件
- 数据收集 + 效果追踪

**从 Phase 2 延后的项目：**
- soul-forge-collector Hook（Heartbeat 打磨优先）
- memory.md 归档清理（短期不构成问题）
- rollback 命令（reset 够用）
- 信号质量加权 #64（等数据积累）
- modifier Agent 推断 B 方案（Phase 2 用预定义映射表 A）

---

## 17. 分发策略

### 17.1 项目形态

Soul Forge 不是纯 Skill，是 **Skill + Hook Pack 组合包**：
- 1 个 Skill（SKILL.md）
- 1 个 Hook（soul-forge-bootstrap）— MVP
- 1 个 Hook（soul-forge-collector）— Phase 3（从 Phase 2 延后）
- HEARTBEAT.md 追加段
- .soul_forge/ 数据目录

### 17.2 ClawHub 分发路径（Phase 2）

1. 在 ClawHub 发布 `soul-forge` Skill
2. SKILL.md 中包含"首次运行安装指令"
3. Agent 读取后自动执行剩余安装（Hook Pack 下载、目录创建、HEARTBEAT.md 追加）
4. 用户体验：`clawhub install soul-forge` → Agent 完成全部配置

### 17.3 安装服务（闲鱼渠道）

手动安装流程或一键安装脚本（`install.sh` / `install.ps1`）。

### 17.4 网页问卷集成（Phase 3）

- 用户在网站完成 DISC 问卷
- 生成预配置 config.json + 安装指令
- 用户下载/粘贴给 Agent → 跳过 Agent 内问卷
- 方式：预配置文件 + 一段"咒语"指令

> **安装文档：** 独立文档，不在本架构文档中。等所有讨论结束后单独编写。

---

## 18. 已确认设计决策清单

### v2 基础决策（75+ 轮对话确认）

| # | 决策 | 结论 |
|---|---|---|
| 1 | 人格分类理论 | DISC（替换 Leary），依据 CharacterBox NAACL 2025 |
| 2 | BDI 模型定位 | 校准决策框架（仅 Skill 校准时使用），不用于人格分类 |
| 3 | 核心内核 | "始终在场的存在，关注需求而非只响应请求" |
| 4 | 内核放置位置 | IDENTITY.md `## Core` 段，放在元数据字段之前 |
| 5 | 内核是否需要测试 | 不需要，所有用户隐含接受 |
| 6 | 角色映射 | D→Advisor, I→Companion, S→Butler, C→Critic |
| 7 | 毒舌定位 | 不是独立角色，是 Challenge 修饰符 |
| 8 | 修饰符维度 | Humor / Verbosity / Proactivity / Challenge (各 0-3) |
| 9 | 免费版修饰符 | 8 个预设风格包 (4 DISC × 2 风格) |
| 10 | 付费版修饰符 | 4 维度自由组合 |
| 11 | 问卷范围 | 只测 DISC (8 题情景问卷)，不测修饰符 |
| 12 | 修饰符获取方式 | Heartbeat 观察 + Agent 自观察 + 校准命令发现 |
| 13 | A/B 选择伪装 | "AI 学习人类表达方式"，非"测试你的偏好" |
| 14 | 老用户处理 | 跳过 Phase 1 伪装问答，直接进入 Phase 2 |
| 15 | 情绪检测原则 | 判断语气，不判断事件 |
| 16 | MEMORY.md 权限 | 只读不写（铁律） |
| 17 | 策略存储位置 | .soul_forge/config.json |
| 18 | SOUL.md 更新方式 | 模板填充 + 整体写入（v3.0 从 overlay merge 升级，见决策 #74） |
| 19 | 权重系统 | 不使用。通过文本位置和措辞强度控制 |
| 20 | SOUL.md 体积 | < 4KB |
| 21 | 版本管理 | .soul_history/ + changelog.md |
| 22 | diff 确认 UX | 自然对话式，不用技术语言 |
| 23 | Skill 冲突 | Soul Forge 控制人格段，其他 Skill 控制任务 |
| 24 | 子代理影响 | 无（子代理排除 SOUL.md 和 Skill） |
| 25 | 场景适应 | 一个主人格，不同场景自然调整表达 |
| 26 | 场景检测 | AI 上下文自动判断 |
| 27 | 问卷语言 | 根据用户输入自动检测，默认英文 |
| 28 | Challenge 红线 | 外貌/家庭/经济/心理健康/用户标记的敏感话题 |
| 29 | Challenge 刹车 | 检测负面语气 → 立即降到 0 → 等待用户恢复 |
| 30 | SOUL.md 写入策略 | 底包保留 + 叠加。Vibe 段是唯一完全替换的段落 |
| 31 | OpenClaw 底包内容 | 保留 Core Truths 原文 5 段 + Boundaries 原文 4 条 + Continuity 完整段 |
| 32 | 运行前检测 | 双重检测（config.json + SOUL.md 标记），MVP 简化处理 |
| 33 | 已有定制处理 | 保存快照，MVP 按全新处理，Phase 2 融合 |
| 34 | 参数推断 | Phase 2 实现，从已有内容推断修饰符偏好 |

### v2.2 架构升级决策

| # | 决策 | 结论 |
|---|---|---|
| 35 | 系统架构 | Skill + Bootstrap Hook + Heartbeat + Collector Hook 四组件协同 |
| 36 | 观察协议放置 | 选项 C 双层设计（SOUL.md 身份层 + Bootstrap 操作层） |
| 37 | 记忆存储格式 | Markdown（.soul_forge/memory.md），非 JSON |
| 38 | 记忆存储职责 | memory.md = 证据流，config.json = 状态快照 |
| 39 | Heartbeat 角色 | 主力观察机制，每 2h，"follow strictly" |
| 40 | Bootstrap Hook 角色 | 注入校准上下文 + 修复 HEARTBEAT.md |
| 41 | Collector Hook | Phase 3 实现（从 Phase 2 延后），补充机制 |
| 42 | HEARTBEAT.md 所有权 | 标记段 + bootstrap 自修复 |
| 43 | BDI 重定位 | 校准决策框架，仅 Skill 调用时使用 |
| 44 | soul_weaver.py | 不再维护，逻辑转入 Skill + Hook |
| 45 | MVP 定义 | Skill + Bootstrap Hook + Heartbeat + 数据目录，能在本地跑通全流程 |
| 46 | 问卷选项顺序 | 每道题选项随机打乱 |
| 47 | DISC 并列处理 | 反向推断 + 用户确认，记录副视角 |
| 48 | 置信度分级 | gap ≥ 3 high / 1-2 medium / 0 low |
| 49 | 副视角 | MVP 只存不用，Phase 2 Skill 处理 |
| 50 | MVP 修饰符 | 全部默认值，Phase 2 自动发现 |
| 51 | 隐私偏好 | MVP 用 DISC 默认倾向，Phase 2 探测 |
| 52 | 问卷中断 | 写入操作放在用户确认之后，中途退出零副作用 |
| 53 | 工作空间路径 | `--workspace` > `openclaw.json` > `~/.openclaw/workspace/` |
| 54 | 多会话覆盖 | MVP 只覆盖主会话，群聊 Phase 2 |
| 55 | 安装文档 | 独立文档，不纳入架构文档 |
| 56 | memory.md 归档 | MVP 不实现，Phase 3 实现（从 Phase 2 延后）（阈值：200 条或 100KB） |
| 57 | Pre-flight Check MVP | 简化为保存快照 + 按全新处理，跳过融合 |
| 58 | Heartbeat 结构化检查清单 | 6 个具体问题（LENGTH/TONE/EMOTION/BOUNDARY/DECISION-MAKING/PROACTIVITY）替代模糊的"观察人格信号" |
| 59 | 问卷结果用户确认 | 问卷完成后展示类型描述 + 3 级确认（很准/大致对/不太准），不太准时提供备选 |
| 60 | 效果对比演示 | 校准完成后用同一段话展示校准前后回复风格差异 |
| 61 | 隐私告知（问卷前） | 明确告知收集什么、存在哪里、如何控制、如何退出 |
| 62 | 重新校准 vs 重置 vs 暂停 | recalibrate 保留 memory + 修饰符、重跑 DISC；reset 恢复文件到安装前 + 数据转 dormant（不删除，可重新启用）；pause 暂停观察 |
| 63 | 安装后偏好首问 | 校准完成时主动问一次偏好（如回复长度），作为高权重首条观察 |
| 64 | 信号质量加权 | Phase 3 引入加权（从 Phase 2 延后，等数据）（直接反馈=3，行为推断=1，无意义=0），阈值 ≥8 |
| 65 | 交付验证检查清单 | Skill 执行完毕前自检 10 项（见 7.3 节检查清单）|
| 66 | config.json paused/dormant 状态 | 新增 paused（暂停观察）和 dormant（重置后静默）状态值，Heartbeat 检测到时跳过所有检查 |
| 67 | Heartbeat 计数方式 | 定性判断（"roughly 5 or more"）替代精确计数，LLM 不擅长精确计数 |
| 68 | 模板写入完整性验证 | 写入后即时验证 6 项结构 → 失败重试一次 → 仍失败则回滚 + 标记 merge_failed → 下次降级（跳过 Continuity 拼接） |
| 69 | Bootstrap 静默修复 | 启动时检查 SOUL.md 结构，损坏则从快照静默恢复 + 记 errors.log，无快照才通知用户 |
| 70 | handler.ts 容错 | config.json 解析失败 → try-catch + 重命名损坏文件 + 重建默认 + 注入 Agent 通知 |
| 71 | 伪装问答触发者 | Agent（受 SOUL.md 身份层指令驱动），非 Skill |
| 72 | handler.ts 文件写入权限 | 双路径设计：主路径用 Node.js fs 直接修复，降级路径通过注入上下文让 Agent 执行（应对 Docker 沙箱） |
| 73 | HEARTBEAT.md 标记段保护 | 强化 HTML 注释措辞（CRITICAL + 删除检测警告），减少 Agent 误删概率 |
| 74 | SOUL.md 写入方式 | 模板填充 + 整体写入（替代 overlay merge），底包嵌入 SKILL.md，Agent 只填充变量 |
| 75 | memory.md 格式防漂移 | 三层防御：handler.ts 单条 try-catch + HEARTBEAT.md 格式锚定 + handler.ts 归一化解析 |
| 76 | Heartbeat 校准检测 | 计数逻辑完全移入 handler.ts，bootstrap 注入 Calibration Readiness，Heartbeat 只做字符串匹配 |
| 77 | config.json 写入权限分离 | Agent 只写 config_update.md（Markdown），handler.ts 读取后精确更新 config.json（JSON） |
| 78 | Phase 1 伪装问答限制 | 已知限制：频率控制不可靠（无跨会话记忆）。Phase 2 用 handler.ts + config.json 时间戳解决 |
| 79 | Bootstrap 注入体积 | 上限 3KB，handler.ts 动态裁剪观察条目，配合聚合统计可降至 ~500B |
| 80 | Heartbeat 同会话状态感知 | HEARTBEAT.md 指令检查对话历史中是否已运行 /soul-forge，避免 config_update.md 延迟导致的状态过时 |
| 81 | Heartbeat 读 status 来源 | 从 bootstrap 注入上下文读取，不直接读 config.json（Agent 不操作 JSON） |
| 82 | config.json 初始创建 | 安装包预置文件复制（主路径）+ handler.ts 容错重建（降级路径），Agent 不参与 |
| 83 | changelog write_strategy 字段 | 移除（v3 只有模板填充 + 整体写入一种策略，无需逐段记录） |
| 84 | Heartbeat 同会话命令感知 | 检查对话历史中"最近一次" soul-forge 命令（区分 calibrate/pause/reset），非仅检查是否存在 |
| 85 | Heartbeat bootstrap context 缺失处理 | 如未找到 Soul Forge status section，跳过所有 Soul Forge 检查（Hook 尚未运行） |
| 86 | Heartbeat 与 agent:bootstrap 关系 | **已确认**：Heartbeat turn 触发 agent:bootstrap。config_update.md 在同会话内自动处理。F13 机制保留为冗余保障 |
| 87 | paused 状态下 /soul-forge 行为 | 显示选择菜单：恢复观察 / 重新校准 / 查看当前配置 |
| 88 | .soul_history/ 缺失降级处理 | dormant 恢复时如 .soul_history/ 不存在，提示用户选择「基于现有数据重新校准」或「重新开始」 |
| 89 | Heartbeat/Skill 并发写文件 | 记录为已知非风险：Agent 单线程、memory.md 仅 append，不构成实际问题 |
| 90 | 隐私说明拒绝处理 | 用户拒绝继续 → status→declined，不修改其他文件，不卸载组件，Skill 告知"随时可再运行"。Heartbeat 视同 paused 跳过 |
| 91 | answers_hash 字段说明 | 8 题原始答案的 MD5 短串，用于检测重复问卷提交 |
| 92 | MVP 测试加速模式 | 手动注入预制观察条目到 memory.md，跳过 Heartbeat 自然积累等待 |
| 93 | SOUL.md 中移除 HTML 注释 | 避免 HTML + Markdown 双语言在 LLM system prompt 中冲突。模板填充 + 整体写入模式下无需段落边界标记 |
| 94 | 测试数据格式完整性 | 测试指南示例条目补充 `status: active` 字段，与 8.2 节规范格式一致 |
| 95 | paused 菜单绕过命令 | 只允许 resume 和 recalibrate 绕过菜单，calibrate 在 paused 状态下不可用（需先 resume） |
| 96 | HEARTBEAT.md 命令映射补全 | recalibrate 和 resume 加入 → calibrated 规则，与 E1 paused 菜单联动 |
| 97 | 决策 #93 描述修正 | 去掉"改用 H3 标题"，改为"模板填充模式下无需段落边界标记" |
| 98 | reset 时 .soul_history/ 缺失 | 告知用户无法恢复，提供「仅设 dormant」或「取消 reset」选择 |
| 99 | declined 状态 | 隐私说明拒绝后 status→declined，Heartbeat 视同 paused 跳过，/soul-forge 重新触发时回到隐私说明 |
| 100 | answers_hash Phase 2 | 字段保留但检查逻辑推迟到 Phase 2（recalibrate 时 Skill 检查相同答案） |
| 101 | config.json schema 补全 | status 枚举加入 declined |
| 102 | 决策 #90 修正 | 从"保持 fresh"改为"status→declined"，与 N7 实现一致 |
| 103 | handler.ts declined 处理 | 不注入上下文、不修复 HEARTBEAT、不提示运行 /soul-forge |
| 104 | reset .soul_history/ 缺失措辞 | "跳过步骤 1"改为"跳过文件恢复部分，继续执行步骤 2" |
| 105 | HEARTBEAT 同会话 declined 例外 | /soul-forge 后用户拒绝隐私→视为 declined 跳过，而非 calibrated |
| 106 | config.json 损坏重建 + declined 交集 | 已知限制：损坏重建为 fresh 会覆盖 declined，属极端边缘情况，可接受 |
| 107 | Skill 命令表 declined 说明 | /soul-forge 行补充：如 status=declined 则重新展示隐私说明 |

### ISO/IEC 标准审查决策

| # | 决策 | 结论 |
|---|---|---|
| 108 | 隐私声明与实际收集对齐 | 隐私说明改为"可能记录简短对话片段"，与 memory.md signal 字段实际行为一致 |
| 109 | handler.ts 错误日志隐私保护 | 只记录元数据（entry date + length），不落原始文本（可能含用户对话片段） |
| 110 | config 损坏重建 + declined 交集标注 | 维持已知限制，注释标注为"隐私敏感"（违反"同意状态不可降级覆盖"原则） |
| 111 | 完整 FSM 状态转移矩阵 | 补充 5 状态 × 8 列矩阵（6 命令 + 隐私拒绝 + config 损坏），含幂等性规则 |
| 112 | Heartbeat 触发 agent:bootstrap 确认 | 已验证：agent:bootstrap 在每个 Agent turn（含 Heartbeat）触发，config_update.md 同会话处理 |
| 113 | MVP 范围含伪装探测 | Phase 1 伪装式偏好探测包含在 MVP 中（频率控制不可靠为已知限制） |
| 114 | 成本估算标注 | Heartbeat 成本数字标注为"估算值，基于 2026 年 2 月定价，待 MVP 实测验证" |

---

## 19. 待实现事项

### MVP 交付清单

| ID | 事项 | 依赖 | 状态 |
|---|---|---|---|
| M1 | 设计 8 道 DISC 情景问卷题目 | 无 | ✅ 已完成 (SKILL.md Section B) |
| M2 | 编写 4 套 DISC 角色模板文本（Core Truths / Vibe / Boundaries） | M1 | ✅ 已完成 (SKILL.md Section E) |
| M3 | 编写 SKILL.md（问卷流程 + 计分逻辑 + 模板组装 + 校准/重校准/暂停/恢复/重置命令） | M1, M2 | ✅ 已完成 (SKILL.md Sections A-M, 1310 行) |
| M4 | 编写 Bootstrap Hook（HOOK.md + handler.ts） | M3 | ✅ 已完成 (handler.js 运行中) |
| M5 | 编写 HEARTBEAT.md Soul Forge 段（结构化 6 问检查清单 + paused/dormant 检查） | 无 | ✅ 已完成 (HEARTBEAT_SEGMENT.md) |
| M6 | 定义 config.json 初始结构（含 paused/dormant 状态） | 无 | ✅ 已完成 (5 状态 + DISC + modifiers + history) |
| M7 | 编写 IDENTITY.md `## Core` 段最终文本 | 无 | ✅ 已完成 |
| M8 | 编写问卷结果用户确认流程文本（类型描述 + 3 级确认） | M1 | ✅ 已完成 (SKILL.md Section D) |
| M9 | 编写隐私告知文本（问卷前展示） | 无 | ✅ 已完成 (SKILL.md Section A, 中英双语) |
| M10 | 编写效果对比演示模板（校准后展示风格差异） | M2 | ✅ 已完成 (SKILL.md Section G) |
| M11 | 编写安装后偏好首问文本 | 无 | ✅ 已完成 (SKILL.md Section H) |
| M12 | 编写交付验证检查清单逻辑（10 项自检） | M3 | ✅ 已完成 (SKILL.md Section K, 17 项) |
| M13 | 本地安装测试（手动部署到自己的 OpenClaw） | M3-M6 | ✅ 已完成 (R1-R33 Telegram 测试) |
| M14 | 全流程测试（问卷 → 确认 → 生成 → 演示 → 首问 → 观察 → 校准） | M13 | ✅ 已完成 (R35 V-1~V-3 全部验证通过, 2026-02-17) |

### MVP 测试加速指南

全流程测试（M14）中，等待 Heartbeat 自然积累足够观察记录耗时过长。以下方法可加速测试：

**手动注入测试数据：**

1. 直接编辑 `.soul_forge/memory.md`，注入预制观察条目：
```markdown
## 2026-01-01 10:00
- **type**: style
- **signal**: [测试] 用户多次要求简洁回复
- **inference**: 偏好简洁直接的沟通
- **modifier_hint**: verbosity → 降低
- **status**: active

## 2026-01-01 10:05
- **type**: style
- **signal**: [测试] 用户说"说重点"
- **inference**: 不喜欢冗长开场白
- **modifier_hint**: verbosity → 降低
- **status**: active
```
（复制 5+ 条同方向条目即可触发 READY 状态）

2. 重启 Agent（或等待下次 Heartbeat）→ handler.ts 读取 memory.md → bootstrap 注入 `Calibration Readiness: verbosity(lower)=5 READY`
3. Heartbeat 检测到 READY → 建议用户运行 `/soul-forge calibrate`
4. 验证：Skill 读取 memory.md → BDI 决策 → 写入 config_update.md → handler.ts 更新 config.json → 下次 bootstrap 注入新修饰符值

**测试检查点：**
- [ ] config_update.md 格式正确（handler.ts 能解析）
- [ ] handler.ts 更新 config.json 后删除 config_update.md
- [ ] bootstrap 注入的修饰符值反映更新后的值
- [ ] SOUL.md 重新生成后包含新修饰符叠加文本
- [ ] changelog.md 记录校准变更

### 建议实现顺序

```
第一批（内容资产，无依赖）：
  M1（问卷题目）
  M2（角色模板）
  M5（HEARTBEAT 结构化检查清单）
  M6（config.json 结构）
  M7（IDENTITY Core 文本）— 已完成
  M9（隐私告知文本）
  M11（安装后首问文本）

第二批（依赖第一批的内容）：
  M8（用户确认流程文本）← 依赖 M1
  M10（效果对比演示模板）← 依赖 M2
  M3（SKILL.md 完整 Skill）← 依赖 M1, M2, M8, M9, M10, M11
  M12（交付验证检查清单）← 依赖 M3

第三批（核心组件）：
  M4（Bootstrap Hook）← 依赖 M3

第四批（测试）：
  M13（本地部署）← 依赖全部
  M14（全流程测试）
```

### Phase 2 事项

> **详细规划：** 见 `docs/Soul_Forge_Phase2_Plan.md`

| ID | 事项 | 状态 |
|---|---|---|
| P2-01 | 问卷改版（场景化 + 双轴提取） | 规划确认 |
| P2-02 | 结果展示强约束（AI助手视角） | 规划确认 |
| P2-03 | 模型适配（7 模型测试 + Agent 自识别） | 规划确认 |
| P2-04 | 完整 Pre-flight Check（schema 校验 + 文件完整性） | 规划确认 |
| P2-05 | 修饰符三阶段发现策略 | 规划确认 |
| P2-06 | 探测频率控制（双门槛 + 成熟期 + 版本重置） | 规划确认 |
| P2-07 | reset 命令适配新字段 | 规划确认 |
| P2-08 | 老用户参数推断 | 规划确认 |
| P2-09 | answers_hash + q_version | 规划确认 |
| P2-10 | 版本管理 / Schema 迁移（v1→v2） | 规划确认 |
| P2-11 | modifier 缺失兜底（统一中间值） | 规划确认 |
| P2-12 | 分发（ClawHub + Plugin） | 规划确认 |
| P2-13 | 隐私开场改版（对话式引入） | 规划确认 |
| P2-14 | 老用户融合选项（内容比对 + 融合 UI + user_customizations.json） | 规划确认（Architecture 10.2 补回） |
| P6 | 安装脚本（install.sh / install.ps1） | ✅ MVP 已完成 |
| P7 | ClawHub 发布包制作 | 进行中 |
| P8 | 跨模型测试计划 | 纳入 P2-03 |

### Phase 3 事项

| ID | 事项 | 备注 |
|---|---|---|
| T1 | 付费版修饰符自由组合 UI | |
| T2 | 多平台适配器（Claude Code / Cursor） | |
| T3 | 网页问卷 + 预配置文件生成 | |
| T4 | 数据飞轮 + 效果追踪 | |
| T5 | soul-forge-collector Hook | 从 Phase 2 延后 |
| T6 | memory.md 归档清理 | 从 Phase 2 延后 |
| T7 | rollback 命令 | 从 Phase 2 延后 |
| T8 | 信号质量加权 (#64) | 从 Phase 2 延后，等数据 |
| T9 | modifier Agent 推断 B 方案 | 从 Phase 2 延后，等数据 |

---

**文档结束**

*Soul Forge v3.1 — 用 DISC 定义角色，用 Heartbeat 持续观察，用 BDI 理性校准，用数据驱动进化。*
