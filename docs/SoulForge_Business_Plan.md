# Soul Forge — 商业策划书 v2.0

**项目名称：** Soul Forge (灵魂铸造)
**定位：** 基于 DISC 人格理论的 AI Agent 人格配置平台
**文档版本：** v2.0
**日期：** 2026 年 2 月 12 日
**同步架构版本：** v3.1（Soul_Forge_Architecture_v3.1.md）

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [项目概述](#2-项目概述)
3. [市场分析](#3-市场分析)
4. [竞争格局](#4-竞争格局)
5. [产品与技术架构](#5-产品与技术架构)
6. [商业模式与收入结构](#6-商业模式与收入结构)
7. [市场进入策略](#7-市场进入策略)
8. [数据飞轮战略](#8-数据飞轮战略)
9. [财务预测](#9-财务预测)
10. [风险分析与应对](#10-风险分析与应对)
11. [里程碑路线图](#11-里程碑路线图)
12. [附录](#12-附录)

---

## 1. 执行摘要

### 1.1 一句话定位

Soul Forge 是一个基于 DISC 人格理论（CharacterBox, NAACL 2025 验证）的 AI Agent 人格配置生成器，通过 8 题情景问卷确定人格基底，通过 4 维沟通风格修饰符精调表达方式，输出可跨平台使用的人格配置文件（OpenClaw、ElizaOS、Claude Code 等）。

### 1.2 核心假设

- AI Agent 正在从"工具"演变为"底层操作系统"（OpenAI、Nothing、Apple 等已明确布局）
- 每个 AI OS 都需要"人格层"来定义 Agent 行为风格
- 心理学理论框架是通用的，不依赖具体平台，可跨 AI OS 复用
- 人格配置的质量直接影响用户对 AI Agent 的满意度和留存

### 1.3 差异化优势

| 维度 | Soul Forge | 现有竞品 (SoulCraft / soul.md) |
|---|---|---|
| 理论框架 | DISC 人格模型（NAACL 2025 验证）+ 4 维沟通风格修饰符 | 大五人格（轻量）或无理论 |
| 输出确定性 | 高（问卷→映射表→模板拼接，可复现可审计） | 低（依赖 LLM 即兴生成） |
| 多平台支持 | SOUL.md / character.json / CLAUDE.md 等 | 仅 SOUL.md |
| 用户定制保护 | Pre-flight Check 检测已有定制 + 快照保存 + 渐进内化 | 无（直接覆盖） |
| 数据飞轮 | 内置反馈收集 + 对话学习修饰符发现 | 无 |

### 1.4 商业模式摘要

**短期（0-3 月）**：服务变现 — OpenClaw 配置咨询 + ClawHub 付费 Skill
**中期（3-6 月）**：产品变现 — Soul Forge Web SaaS + 模板包
**长期（6-12 月）**：数据变现 — 场景化人格推荐引擎 + 企业定制

### 1.5 财务目标

| 阶段 | 时间 | 月收入目标 |
|---|---|---|
| 生存期 | 第 1-3 月 | $500 - $2,000 |
| 增长期 | 第 4-6 月 | $2,000 - $5,000 |
| 规模期 | 第 7-12 月 | $5,000 - $15,000 |

---

## 2. 项目概述

### 2.1 问题定义

AI Agent 生态正在快速碎片化。OpenClaw（157K GitHub Stars）、ElizaOS、Claude Code、Cursor 等平台各自定义了不同的人格配置格式（SOUL.md、character.json、CLAUDE.md、.cursorrules），但：

1. **用户不知道怎么写好的人格配置** — 大部分人直接用默认模板或随便写几句
2. **没有科学方法论** — 现有工具要么依赖 LLM 即兴生成（不稳定），要么只提供静态模板（无个性化）
3. **跨平台不可移植** — 在 OpenClaw 上定制的人格无法直接迁移到 ElizaOS 或 Claude Code
4. **无法量化效果** — 没有人知道哪种人格配置在什么场景下效果更好

### 2.2 解决方案

Soul Forge 提供一个三层架构：

```
输入层：8 题 DISC 情景问卷 + Phase 2 对话学习修饰符发现
    ↓
核心引擎：DISC 人格基底 + 4 维沟通风格修饰符
    ├── DISC 角色基底 → 决定 AI 的核心行为模式
    │   D(Advisor/顾问) / I(Companion/伙伴) / S(Butler/管家) / C(Critic/评论家)
    ├── 修饰符层 → 叠加在角色基底上的沟通风格
    │   Humor(幽默度) / Verbosity(话语量) / Proactivity(主动性) / Challenge(挑战度)
    └── Pre-flight Check → 检测已有定制 + 快照保护
    ↓
输出层：适配多平台格式的人格配置文件
    ├── OpenClaw → SOUL.md + IDENTITY.md
    ├── ElizaOS → character.json
    ├── Claude Code → CLAUDE.md
    └── Cursor → .cursorrules
```

### 2.3 技术资产现状

| 资产 | 状态 | 位置 |
|---|---|---|
| SKILL.md（OpenClaw Skill 定义） | MVP 已完成（1310 行） | `src/skills/soul-forge/SKILL.md` |
| handler.js（Bootstrap Hook） | MVP 已完成 | `src/hooks/soul-forge-bootstrap/handler.js` |
| HEARTBEAT_SEGMENT.md（观察协议） | MVP 已完成 | `src/HEARTBEAT_SEGMENT.md` |
| v3.1 架构设计文档 | 设计定稿（78 轮推演 + MVP 验证） | `docs/Soul_Forge_Architecture_v3.1.md` |
| DISC 角色体系（4 型） | MVP 已实现 | v3.1 架构文档 Section 4 |
| 修饰符系统（4 维度） | 设计完成（Phase 2） | v3.1 架构文档 Section 5 |
| Pre-flight Check 机制 | MVP 已实现（简化版） | SKILL.md Section G |
| .soul_history 快照机制 | MVP 已实现 | handler.js + Install Script |
| Bootstrap Hook（config 管线） | MVP 已实现 | handler.js |
| v1 核心协议归档 | 已归档（v3.1 已替换） | 核心协议归档文档 |

---

## 3. 市场分析

### 3.1 宏观趋势：App → Agent → AI OS

**关键信号：**

- **OpenAI** 在 2025 DevDay 宣布将 ChatGPT 转型为 AI 原生操作系统，配套 Apps SDK
- **Nothing** CEO Carl Pei 宣布 2026 年推出首款 AI 原生设备，OS 将取代传统 App
- **Apple** Xcode 26.3 接入 Claude Agent 和 OpenAI Codex，拥抱 Agentic 范式
- **LSE 商学院**发文预测 AI Agent 将消除对 App 的需求
- **AI Companion 市场** 2025 年估值 $388.7 亿，预计 CAGR 32.1% 增长到 2034 年 $4,761 亿

**核心判断：** AI Agent 将成为新的底层生态系统。每个 Agent 都需要人格配置，正如每个 App 都需要 UI 设计。

### 3.2 目标市场规模

#### 直接可达市场 (SAM)：OpenClaw 生态

| 指标 | 数据 | 来源 |
|---|---|---|
| GitHub Stars | 157,000+ | GitHub Trending |
| 公网活跃实例 | 21,000 - 30,000 | Censys 扫描 |
| ClawHub Skills | 5,705 | ClawHub 官方 |
| Discord 社区 | 12,000+ 成员 | Discord |
| 估计活跃用户 | 5,000 - 10,000 | 综合估算 |

#### 扩展市场 (TAM)：跨平台 AI Agent 生态

| 平台 | 用户规模 | 人格配置格式 |
|---|---|---|
| OpenClaw | ~10,000 活跃用户 | SOUL.md + IDENTITY.md |
| Claude Code | 数十万开发者 | CLAUDE.md |
| Cursor | 数十万开发者 | .cursorrules |
| ElizaOS | Web3 开发者社区 | character.json |
| 其他 Agent 框架 | 持续增长 | 各自定义 |

### 3.3 用户画像

#### Persona A：技术爱好者 (60%)

- 已安装 OpenClaw，想深度定制但不知从何下手
- 技术能力中等，会改 Markdown 但不懂心理学
- 付费意愿：$10-50/次（工具型消费）

#### Persona B：效率至上的专业人士 (25%)

- 用 AI Agent 做实际工作（内容创作、客户管理、数据分析）
- 关心"AI 的表现是否专业、是否符合我的风格"
- 付费意愿：$50-200/月（服务型消费）

#### Persona C：企业/团队 (15%)

- 为团队部署 AI Agent，需要统一的人格规范
- 关心品牌一致性、合规性、安全性
- 付费意愿：$500-5,000/项目（咨询型消费）

---

## 4. 竞争格局

### 4.1 竞品矩阵

| 项目 | 形态 | 输入方式 | 理论框架 | 确定性 | 多平台 | 数据收集 | 活跃度 |
|---|---|---|---|---|---|---|---|
| **SoulCraft** | OpenClaw Skill | 对话引导 | 大五人格（轻量） | 低 | 仅 OpenClaw | 无 | 1 star, 0 fork |
| **soul.md (aaronjmars)** | 独立工具 | 数据提取 | 无 | 低 | 仅 OpenClaw | 无 | 活跃 |
| **souls.directory** | 模板市场 | 浏览选择 | 无 | N/A | 仅 OpenClaw | 无 | 社区维护 |
| **SoulLayer MCP** | MCP Server | API 调用 | 无 | 中 | MCP 兼容 | SQLite 本地 | 2026/2/9 发布 |
| **OpenSouls Engine** | TypeScript 框架 | 代码配置 | 认知科学 | 高 | 独立运行时 | 向量存储 | 291 stars |
| **ElizaOS** | Agent 框架 | JSON 配置 | 无 | 高 | 自有生态 | 内置 | 活跃 |
| **Character.AI / Prompt Poet** | 平台内部 | YAML+Jinja2 | 无 | 高 | 仅自有平台 | 大规模 | 商业产品 |
| **Soul Forge (本项目)** | 跨平台引擎 | DISC 情景问卷+映射表 | DISC (NAACL 2025) + 4 修饰符 | 高 | 多平台 | 内置设计 | 开发中 |

### 4.2 竞争优势分析

**SoulCraft 为什么没有水花（1 star, 0 fork）：**

1. 完全依赖 LLM 即兴生成，输出不稳定不可控
2. 纯 Markdown Skill，没有代码逻辑保障结构完整性
3. 没有备份/回滚机制，可能破坏现有配置
4. 没有数据收集，无法迭代改进
5. 发布时间（2026/1/31）恰逢 OpenClaw 安全危机，用户对新 Skill 持警惕态度

**Soul Forge 的结构性优势：**

1. **确定性输出**：8 题 DISC 问卷 → 映射表 → 角色模板拼接，可复现、可审计
2. **用户定制保护**：Pre-flight Check 检测已有配置 → 快照保存 → 渐进内化，不破坏用户现有体验
3. **非破坏性写入**：模板填充 + 整体写入只修改管辖段落，保留 OpenClaw 底包和用户其他配置
4. **多平台适配**：一次输入，输出到多个 Agent 框架格式
5. **渐进式人格发现**：MVP 确定角色基底，Phase 2 Skill 通过对话学习发现沟通风格偏好

---

## 5. 产品与技术架构

### 5.1 产品形态演进

```
Phase 1: OpenClaw Skill (MVP 已完成, 2026-02-17)
    SKILL.md + handler.js — OpenClaw 原生 Skill + Bootstrap Hook
    8 题 DISC 问卷 → 角色判定 → 生成 SOUL.md + IDENTITY.md
    Pre-flight Check → 快照保护 → 模板填充 + 整体写入
    状态管理 (pause/resume/reset) + Heartbeat 观察

Phase 2: 高级个性化 (当前状态: 规划确认，见 docs/Soul_Forge_Phase2_Plan.md)
    问卷改版（场景化 + 双轴 modifier 提取）
    修饰符三阶段发现（问卷初值 → Heartbeat → 主动探测）
    7 模型适配（Kimi K2.5, Gemini 3 Flash, Claude Sonnet 4.5, GLM-5, MiniMax M2.5, DeepSeek V3.2, GPT-5.1 Codex）
    完整 Pre-flight Check + Schema 迁移 + 版本追踪
    发布到 ClawHub + Plugin

Phase 3: Web SaaS
    静态前端 + API 后端
    问卷 → 实时预览 → 多格式导出 → 付费解锁

Phase 4: 智能推荐引擎
    基于积累数据的场景化人格推荐
    无需问卷，根据使用场景自动匹配
```

### 5.2 技术架构

```
┌─────────────────────────────────────────────────┐
│                  用户界面层                        │
│  Telegram (OpenClaw) │ Phase 3: Web │ Phase 3: CLI│
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│     四组件协同架构 (v3.1)                          │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐              │
│  │ Skill        │  │ Bootstrap    │              │
│  │ SKILL.md     │  │ Hook         │              │
│  │ 问卷+命令    │  │ handler.js   │              │
│  └──────┬──────┘  └──────┬───────┘              │
│         │                │                       │
│  ┌──────▼────────────────▼──────────────────┐   │
│  │  HEARTBEAT 观察  │  config.json 状态机    │   │
│  │  memory.md 记录  │  config_update.md 管线 │   │
│  └──────────────────────────────────────────┘   │
│         │                                        │
│  ┌──────▼──────────────────────────────────┐    │
│  │  输出: SOUL.md + IDENTITY.md             │    │
│  │  Phase 3: character.json / CLAUDE.md     │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 5.3 DISC 人格框架

**核心理论：** DISC 人格模型，经 CharacterBox (NAACL 2025) 验证可用于 LLM 角色扮演。

| DISC 类型 | 角色名 | 核心特征 | 注意力聚焦 |
|---|---|---|---|
| **D (Dominance)** | Advisor (顾问) | 目标导向、直接、高效 | 聚焦于"你需要做什么" |
| **I (Influence)** | Companion (伙伴) | 热情、社交、表达力强 | 聚焦于"你感觉怎么样" |
| **S (Steadiness)** | Butler (管家) | 稳定、耐心、服务导向 | 聚焦于"你需要什么帮助" |
| **C (Conscientiousness)** | Critic (评论家) | 精确、分析、高标准 | 聚焦于"这样做对不对" |

四种角色共享同一核心内核："始终在场、关注需求"。角色差异是这个内核的四种表达方式。

### 5.4 沟通风格修饰符

修饰符叠加在角色基底上，定义 AI 的表达风格。

| 维度 | 含义 | 取值范围 | 默认值 |
|---|---|---|---|
| **Humor (幽默度)** | 回复中幽默/戏谑的浓度 | 0-3 | 1 |
| **Verbosity (话语量)** | 回复的长度和详细程度 | 0-3 | 1 |
| **Proactivity (主动性)** | 是否主动提出建议和发现 | 0-3 | 1 |
| **Challenge (挑战度)** | 是否挑战用户观点、戏谑式互动 | 0-3 | 1 |

> **默认值说明：** 默认值为无信号时的兜底值（统一中间值 1）。实际初始值由问卷副轴提取决定。Phase 1 曾基于 DISC 类型差异化（如 S 型 Verbosity=2, Challenge=0），Phase 2 已取消该假设。

**发现机制（Phase 2 确认，详见 Phase2_Plan.md Section 3.3）：**
- **问卷副轴提取**：8 题问卷选项携带预定义 modifier 权重，提供初始值
- **Stage 1 伪装问答**（第 1-14 天）：以"AI 学习人类表达方式"为伪装，提供两种表达供用户选择。频率由 handler.js 精确控制（双门槛：≥3次会话且≥1天 / ≥7次或≥5天）
- **Stage 2 风格试探**（第 15-30 天）：自然对话中试探不同风格，观察用户反应（频率更宽松）
- **Stage 3 成熟期**（第 30 天+）：纯观察，停止所有主动探测，参数趋于稳定
- **版本重置**：问卷版本更新时，探测周期归零重新开始

### 5.5 关键技术实现

#### 模板填充 + 整体写入 (v3.1)

v3.1 采用模板填充 + 整体写入方案（Decision #74），取代了早期的锚点式局部更新设计：
- SKILL.md 内嵌 4 型角色模板
- 校准完成后，Agent 从模板填充完整内容，整体写入 SOUL.md + IDENTITY.md
- 避免了锚点匹配失败和部分写入不一致的问题

#### Pre-flight Check（运行前检测）

MVP 简化版：读取 config.json status 字段进行路由

```
读取 .soul_forge/config.json
  ├── status = "fresh"      → 新用户流程（隐私声明 + 问卷）
  ├── status = "calibrated" → 已校准（显示当前状态 + 重新校准选项）
  ├── status = "paused"     → 暂停中（三选项菜单：resume/recalibrate/view）
  ├── status = "dormant"    → 休眠（恢复/重新开始选项）
  └── status = "declined"   → 已拒绝（重新展示隐私声明）
```

完整版 Pre-flight Check（schema 校验 + 文件完整性 + 版本迁移 + 老用户参数推断）为 Phase 2 范围（详见 Phase2_Plan.md Section 3.4）。

#### .soul_history 快照管理

```
.soul_history/
├── SOUL_INIT.md           # SOUL.md 原始模板（永久保留，INIT 保护规则防覆写）
├── IDENTITY_INIT.md       # IDENTITY.md 原始模板（永久保留，INIT 保护规则防覆写）
├── SOUL_BACKUP_*.md       # Reset 前备份
└── IDENTITY_BACKUP_*.md   # Reset 前备份
```

#### .soul_forge/config.json（运行时配置）

```json
{
  "version": 1,
  "status": "calibrated",
  "disc": {
    "primary": "S",
    "secondary": "C",
    "confidence": "high",
    "scores": {"D": 2, "I": 3, "S": 6, "C": 1},
    "answers_hash": null
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
    {"action": "calibrate", "type": "S", "timestamp": "..."}
  ],
  "created_at": "2026-02-12T19:30:00Z",
  "updated_at": "2026-02-12T19:30:00Z"
}
```

#### 多平台适配器（Phase 3）

当前仅支持 OpenClaw（SOUL.md + IDENTITY.md）。Phase 3 计划扩展：
- ElizaOS → character.json
- Claude Code → CLAUDE.md
- Cursor → .cursorrules

---

## 6. 商业模式与收入结构

### 6.1 收入来源矩阵

| 收入来源 | 类型 | 定价 | 毛利率 | 启动难度 | 天花板 |
|---|---|---|---|---|---|
| OpenClaw 配置咨询 | 服务 | $150-800/单 | 90%+ | 低 | 受人力限制 |
| ClawHub 付费 Skill | 产品 | $19.99-49.99 | 95%+ | 低 | 被动收入 |
| SOUL.md 模板包 | 内容 | $9.99-49.99 | 95%+ | 低 | 被动收入 |
| Soul Forge Web SaaS | 产品 | $4.99/次 或 $9.99/月 | 80%+ | 中 | 可扩展 |
| 企业人格定制咨询 | 服务 | $2,500-15,000/项目 | 85%+ | 高 | 高单价 |
| 数据 API (未来) | 平台 | 按调用计费 | 70%+ | 高 | 可扩展 |

### 6.2 定价策略

#### ClawHub Skill 定价

```
免费版 (Soul Forge Lite):
  - 简化 DISC 问卷（4 题）
  - 生成标准 SOUL.md + IDENTITY.md
  - 8 个预设风格包（4 DISC × 2 风格）
  - 无备份功能
  → 目的：刷下载量和评价

付费版 (Soul Forge Pro) $19.99:
  - 完整 8 题 DISC 情景问卷
  - Pre-flight Check + .soul_history 自动备份
  - 非破坏性模板填充写入（管辖段覆盖 + 非管辖段保留）
  - 修饰符对话学习（4 维度渐进发现）
  - 主副视角动态调整

高级版 (Soul Forge Ultimate) $49.99:
  - 上述全部
  - 修饰符 4 维度自由滑块调整
  - 场景化配置推荐
  - IDENTITY.md 高级定制（核心内核 + Avatar 生成提示）
  - 多平台格式导出
```

#### Web SaaS 定价

```
免费：
  - 基础问卷 + 预览 50% 内容
  - 仅 OpenClaw 格式

单次购买 $4.99：
  - 完整生成 + 下载
  - 单平台格式

月度订阅 $9.99/月：
  - 无限生成
  - 全平台格式（OpenClaw + ElizaOS + Claude Code + Cursor）
  - 历史版本管理
  - 反馈优化建议
```

#### 咨询服务定价

```
基础配置包 $150-300：
  - OpenClaw 安装 + SOUL.md 定制
  - 1 次交付

深度定制包 $400-800：
  - 安装 + 人格深度访谈 + 多渠道接入
  - 含 7 天调优期

企业定制 $2,500-15,000：
  - 团队 Agent 统一人格规范
  - 多 Agent 差异化设计
  - 安全协议定制
  - 培训文档
```

### 6.3 收入模型

```
月收入 = 服务收入 + 产品收入 + 订阅收入

服务收入 = 咨询单数 × 客单价
产品收入 = Skill 销量 × 单价 + 模板包销量 × 单价
订阅收入 = 月活跃订阅用户 × $9.99
```

---

## 7. 市场进入策略 (Go-to-Market)

### 7.1 Phase 1：社区渗透 (第 1-4 周)

**目标：** 建立社区存在感，获取前 10 个付费客户

**行动项：**

1. **Discord 社区活跃**
   - 每天花 30 分钟在 OpenClaw Discord #help 频道回答 SOUL.md 相关问题
   - 用心理学框架给出专业建议（而不是"你试试改这一行"）
   - 建立"SOUL.md 专家"的社区身份

2. **GitHub Discussions 输出**
   - 发布一篇"基于 DISC 人格模型设计 SOUL.md 的方法论"长帖
   - 回答所有 SOUL.md/IDENTITY.md 相关的 Discussion

3. **Upwork/Fiverr 上架**
   - 标题："OpenClaw Setup + AI Personality Design (Psychology-Based)"
   - 差异化卖点：不只装软件，用心理学框架定制人格

4. **内容营销**
   - Medium 发布一篇"为什么你的 SOUL.md 不起作用——以及如何用认知科学修复它"
   - 在 souls.directory 提交 2-3 个高质量模板（带品牌标识）

**KPI：**
- Discord 上被 @ 或私信咨询 ≥ 20 次
- Upwork/Fiverr 首单成交
- Medium 文章 ≥ 500 阅读

### 7.2 Phase 2：产品上线 (第 4-8 周)

**目标：** 发布 ClawHub Skill + Web MVP，建立被动收入

**行动项：**

1. **ClawHub Skill 发布**
   - 将 Soul Weaver 改造为 Skill 格式
   - 免费版 + Pro 版 ($19.99) + Ultimate 版 ($49.99)
   - 编写详细文档和使用指南（ClawHub 上好文档 = 好评价 = 更多销量）

2. **Web MVP 上线**
   - 技术栈：静态前端（React/Vue）+ Serverless API（Vercel/Cloudflare Workers）
   - 核心功能：问卷 → 预览 → 付费解锁 → 下载
   - 支持 OpenClaw + Claude Code 格式

3. **Gumroad 模板包**
   - "10 个经过测试的 SOUL.md 模板——基于心理学框架设计" $9.99
   - "SOUL.md 设计完全指南 + 工具包" $29.99

4. **数据收集启动**
   - Web 版内置匿名分析（问卷答案分布、生成完成率、导出格式偏好）
   - Skill 版通过 .soul_history 收集 diff 数据

**KPI：**
- ClawHub 下载 ≥ 200
- 付费转化 ≥ 20 单
- Web 月访问 ≥ 1,000

### 7.3 Phase 3：增长加速 (第 8-16 周)

**目标：** 扩展到多平台，启动数据飞轮

**行动项：**

1. **多平台格式适配**
   - 增加 ElizaOS character.json 输出
   - 增加 Cursor .cursorrules 输出
   - 增加 Claude Code CLAUDE.md 输出

2. **A/B 测试系统**
   - 集成 Langfuse 进行人格配置效果对比
   - 对同类问卷答案随机分配不同映射参数

3. **社区调研**
   - 在 Discord + GitHub 发起公开问卷
   - 收集"使用 Soul Forge 生成的配置 vs. 手写配置"的满意度对比

4. **合作与推广**
   - 联系 souls.directory 做交叉推广
   - 联系 OpenClaw 社区 moderator 寻求 featured 推荐

**KPI：**
- 月活用户 ≥ 500
- 数据采集样本 ≥ 200 条
- 月收入 ≥ $3,000

### 7.4 Phase 4：护城河构建 (第 16-48 周)

**目标：** 数据驱动的人格推荐，形成壁垒

**行动项：**

1. **智能推荐引擎**
   - 基于积累数据，推出"根据使用场景自动推荐最优人格参数"
   - 无需用户答问卷——输入场景描述即可

2. **企业版**
   - 团队人格管理面板
   - 多 Agent 人格一致性检查
   - 审计日志和合规报告

3. **跨平台人格协议标准**
   - 发布 Soul Forge Personality Schema（开放格式）
   - 推动社区采用统一的人格配置标准

---

## 8. 数据飞轮战略

### 8.1 为什么数据是护城河

心理学理论是公开的，代码可以被抄，但**"哪些参数组合在什么场景下效果最好"的数据是独家的**。

```
DISC 理论 → 所有人都能读论文
    +
修饰符设计 → 所有人都能理解 4 个维度
    +
用户反馈数据 → 只有跑过真实用户的人才有
    =
"DISC-S 型 + Humor=2 + Challenge=1
 → 学习场景满意度 87%，闲聊场景只有 43%"
    → 这个结论是独家的
```

### 8.2 四阶段数据收集

#### 阶段 1：显式反馈 (现在)
- 生成后 7 天触发满意度问卷
- 1-5 分评分 + 多选反馈
- 成本：零（Google Form 或本地 JSON）

#### 阶段 2：隐式行为追踪 (产品上线时)
- .soul_history diff 分析：用户编辑了哪些段落、保留了多少
- 重新运行检测：用户是否重跑了生成器
- 文件修改时间戳：多快开始修改 = 多不满意

#### 阶段 3：对话级遥测 (有平台集成时)
- 平均对话轮数、用户主动发起率
- 情感倾向变化、Agent 被纠正频率
- 工具：Langfuse (开源) / OpenTelemetry

#### 阶段 4：A/B 测试 (有用户量时)
- 同类用户随机分配不同参数组合
- 7 天后对比满意度、对话轮数、编辑率
- 最低样本：每组 30-50 用户
- 工具：Langfuse A/B Testing

### 8.3 数据资产价值

| 数据类型 | 积累方式 | 护城河强度 | 商业化路径 |
|---|---|---|---|
| 问卷答案分布 | 每次生成自动收集 | 中 | 优化默认推荐 |
| 段落编辑 diff | .soul_history 对比 | 高 | 精准映射修正 |
| 场景-参数-满意度三元组 | 反馈+A/B 测试 | 极高 | 智能推荐引擎 |
| 跨平台格式偏好 | 导出日志 | 中 | 市场趋势判断 |

---

## 9. 财务预测

### 9.1 成本结构

#### 固定成本

| 项目 | 月费 | 说明 |
|---|---|---|
| 域名 | ~$1 | soulforge.dev 或类似 |
| 托管 (Vercel/Cloudflare) | $0-20 | 免费额度覆盖早期 |
| Langfuse 自托管 | $0 | 开源，跑在同一服务器 |
| 工具订阅 | ~$20 | GitHub Copilot 等 |
| **合计** | **~$20-40/月** | |

#### 可变成本

| 项目 | 说明 |
|---|---|
| API 调用（如果 Web 版用 LLM 辅助生成） | 按用量，约 $0.01-0.05/次 |
| ClawHub 平台抽成 | 待确认（目前似乎免费） |
| Gumroad 抽成 | 10% |
| 支付处理费 | 2.9% + $0.30/笔 |

### 9.2 收入预测（保守/基准/乐观）

#### 第 1-3 月（生存期）

| 来源 | 保守 | 基准 | 乐观 |
|---|---|---|---|
| 咨询服务 (2-5 单/月) | $300 | $800 | $2,000 |
| ClawHub Skill | $50 | $150 | $400 |
| 模板包 | $30 | $100 | $300 |
| **月收入** | **$380** | **$1,050** | **$2,700** |
| **月成本** | **$40** | **$40** | **$40** |
| **月净利** | **$340** | **$1,010** | **$2,660** |

#### 第 4-6 月（增长期）

| 来源 | 保守 | 基准 | 乐观 |
|---|---|---|---|
| 咨询服务 | $500 | $1,500 | $3,000 |
| ClawHub Skill | $200 | $500 | $1,000 |
| Web SaaS 订阅 | $100 | $500 | $1,500 |
| 模板包 | $100 | $300 | $500 |
| **月收入** | **$900** | **$2,800** | **$6,000** |
| **月成本** | **$80** | **$120** | **$200** |
| **月净利** | **$820** | **$2,680** | **$5,800** |

#### 第 7-12 月（规模期）

| 来源 | 保守 | 基准 | 乐观 |
|---|---|---|---|
| 咨询服务 | $1,000 | $3,000 | $5,000 |
| ClawHub Skill | $400 | $800 | $1,500 |
| Web SaaS 订阅 | $500 | $2,000 | $5,000 |
| 企业定制 | $0 | $2,500 | $8,000 |
| 模板包 | $200 | $500 | $800 |
| **月收入** | **$2,100** | **$8,800** | **$20,300** |
| **月成本** | **$150** | **$300** | **$500** |
| **月净利** | **$1,950** | **$8,500** | **$19,800** |

### 9.3 盈亏平衡分析

月固定成本约 $40，按最低客单价 $4.99 计算：
- **盈亏平衡点 = 9 笔交易/月**（极低门槛）
- 实际上第一个咨询单 ($150+) 即可覆盖数月成本

---

## 10. 风险分析与应对

### 10.1 市场风险

| 风险 | 概率 | 影响 | 应对策略 |
|---|---|---|---|
| OpenClaw 热度消退 | 中 | 高 | 多平台策略，不绑定单一平台 |
| OpenClaw 官方内置人格定制 | 中 | 高 | 保持理论深度优势；转向"补充工具"定位 |
| AI Agent 生态碎片化加速 | 高 | 中（机会） | 加快多平台适配，"碎片化 = 需要统一工具" |
| 付费意愿低于预期 | 中 | 中 | 服务收入作为保底，产品收入为增量 |

### 10.2 技术风险

| 风险 | 概率 | 影响 | 应对策略 |
|---|---|---|---|
| 心理学映射效果不显著 | 中 | 高 | 数据驱动迭代：如果理论映射不准，用数据修正 |
| 被竞品快速抄袭 | 高 | 中 | 数据飞轮是真正壁垒；理论可抄，数据不可抄 |
| 平台 API/格式变更 | 中 | 低 | 适配层解耦：核心引擎不依赖具体格式 |
| 安全漏洞被利用 | 低 | 高 | Boundaries 安全边界 + 不存储用户敏感数据；Memory 只读铁律 |

### 10.3 商业风险

| 风险 | 概率 | 影响 | 应对策略 |
|---|---|---|---|
| AI 模型提供商 ToS 变更 | 中 | 中 | 核心逻辑不依赖 API（映射表本地运行） |
| 社区声誉受损 | 低 | 高 | 透明数据收集政策；公开发帖做调研而非爬取 |
| 单人团队精力瓶颈 | 高 | 中 | 优先产品化（被动收入），减少服务占比 |
| 法律/合规风险 | 低 | 高 | 不收集 PII；匿名化数据；明确隐私政策 |

### 10.4 最坏情况预案

如果 OpenClaw 生态崩溃或人格定制赛道无法变现：

1. **技术资产可迁移**：DISC 人格框架 + 修饰符系统可以输出为论文/教程/咨询方法论
2. **服务技能可复用**：AI Agent 配置咨询能力适用于任何 Agent 框架
3. **数据资产有独立价值**：场景-参数-满意度数据可以用于 AI 产品设计咨询
4. **退出成本极低**：无硬件投入，无人员雇佣，随时可以止损

---

## 11. 里程碑路线图

> **时间线说明：** MVP Phase 1 于 2026-02-17 验证完成（R35）。以下里程碑以 GTM 启动日（2026-02-17）为 Week 0 重新编排。已完成的技术里程碑标记为 ✅。

### ✅ 已完成：MVP Phase 1（2026-02-13 ~ 2026-02-17）

- [x] DISC 8 题情景问卷设计 + 4 套角色模板
- [x] OpenClaw 原生 Skill（SKILL.md, 1310 行）+ Bootstrap Hook（handler.js）
- [x] Pre-flight Check（简化版，基于 config.json status 路由）
- [x] config.json 状态机 + .soul_history 快照机制
- [x] 状态命令（pause/resume/reset/recalibrate）
- [x] HEARTBEAT 观察协议 + memory.md 追加记录
- [x] 35 轮测试，19 issue 中 17 CLOSED / 1 ACCEPTED / 1 ONGOING
- [x] 客户安装脚本（Soul_Forge_Customer_Install.ps1）
- [x] 文档收尾（归档 + CLAUDE.md 升级 + Business Plan 技术对齐）

### Week 1-2：GTM 启动（社区渗透 + 服务上架）

- [ ] 加入 OpenClaw Discord，开始每日活跃回答 SOUL.md 问题（30 min/天）
- [ ] Upwork/闲鱼上架 "OpenClaw 配置 + AI 人格设计" 安装服务
- [ ] souls.directory 提交 2-3 个高质量 DISC 模板（带 Soul Forge 品牌）
- [ ] 注册 Fiverr 并上架服务

### Week 3-4：内容营销 + 首批用户

- [ ] Medium 发布方法论文章："Why your SOUL.md doesn't work — and how cognitive science fixes it"
- [ ] GitHub Discussions 发布技术长帖：DISC-based SOUL.md 方法论
- [ ] 完成首单安装服务（闲鱼或 Upwork）
- [ ] 收集前 5-10 个用户反馈（使用 Soul_Forge_User_Feedback_Template.md）

### Week 3-6：技术 Phase 2 第一批（与 GTM 并行）

> **详细规划：** 见 `docs/Soul_Forge_Phase2_Plan.md`

- [ ] P2-10: Schema 迁移机制（config.json v1→v2）+ P2-04: Pre-flight Check 增强 + P2-11: modifier 缺失兜底
- [ ] P2-01: 问卷改版（场景化选项 + modifier 副轴预定义映射表）
- [ ] P2-13: 隐私开场改版 + P2-02: 结果展示强约束
- [ ] P2-03: 模型适配测试（7 模型：Kimi K2.5, Gemini 3 Flash, Claude Sonnet 4.5, GLM-5, MiniMax M2.5, DeepSeek V3.2, GPT-5.1 Codex）
- [ ] P7: ClawHub 发布包制作

### Week 7-10：技术 Phase 2 第二批 + ClawHub 发布

- [ ] P2-05/06: 三阶段探测 + 频率控制实现
- [ ] P2-07: reset 命令适配新字段
- [ ] P2-08: 老用户参数推断 + P2-14: 老用户融合选项（内容比对 + 融合 UI）
- [ ] P2-09: answers_hash + q_version 实现
- [ ] P2-12: ClawHub 发布 + Plugin 制作
- [ ] 收集前 20-50 个用户反馈

### Week 11-14：数据飞轮

- [ ] 集成 Langfuse 进行效果追踪
- [ ] 发起社区公开调研
- [ ] 基于前 200 个数据点优化 DISC 映射参数和修饰符默认值
- [ ] 增加 ElizaOS / Cursor 格式支持

### Week 15-24：Web SaaS + 规模化

- [ ] 搭建 Soul Forge Web 版（前端 + API）
- [ ] 实现多格式导出（OpenClaw + Claude Code + Cursor）
- [ ] 集成支付（Stripe/Gumroad）
- [ ] 推出场景化人格推荐功能
- [ ] 启动 A/B 测试

### Week 25-48：壁垒深化

- [ ] 智能推荐引擎上线
- [ ] 企业客户拓展
- [ ] 数据 API 开放
- [ ] 发布 Soul Forge Personality Schema 开放标准
- [ ] 考虑融资或团队扩展

---

## 12. 附录

### 12.1 关键引用来源

- OpenClaw 官方文档：https://docs.openclaw.ai
- SoulCraft (竞品)：https://github.com/kesslerio/soulcraft-openclaw-skill
- soul.md (竞品)：https://github.com/aaronjmars/soul.md
- souls.directory (模板市场)：https://souls.directory
- SoulLayer MCP (竞品)：https://lobehub.com/mcp/phoenix0700-soullayer
- OpenSouls Soul Engine (参考架构)：https://github.com/opensouls/opensouls
- ElizaOS (跨平台参考)：https://github.com/elizaOS/eliza
- CharacterBox 论文 (BDI + LLM)：https://aclanthology.org/2025.naacl-long.323.pdf
- PersonaLLM Workshop：https://personallmworkshop.github.io
- Langfuse (数据工具)：https://langfuse.com
- Promptfoo (测试工具)：https://github.com/promptfoo/promptfoo
- AI Companion 市场报告：Research and Markets, 2025
- OpenClaw 增长数据：GitHub Trending, Censys, HackerNews

### 12.2 术语表

| 术语 | 定义 |
|---|---|
| DISC | Dominance-Influence-Steadiness-Conscientiousness，四类人格模型 |
| CharacterBox | NAACL 2025 论文，验证 DISC+BDI 用于 LLM 角色扮演的有效性 |
| 修饰符 | 叠加在 DISC 角色基底上的 4 维沟通风格参数（Humor/Verbosity/Proactivity/Challenge） |
| 核心内核 | 所有角色共享的底层承诺："始终在场、关注需求" |
| Pre-flight Check | 运行前检测机制，区分全新模板/已使用用户/二次运行三种状态 |
| 模板填充 + 整体写入 | 从 SKILL.md 内嵌模板填充变量后整体写入 SOUL.md，管辖段覆盖、非管辖段（如 Continuity）保留（Decision #74，取代早期 Smart Merge 设计） |
| BDI 模型 | Belief-Desire-Intention，v2 中改为 Skill 运行时行为逻辑（非人格分类） |
| SOUL.md | OpenClaw 的 Agent 行为哲学定义文件 |
| IDENTITY.md | OpenClaw 的 Agent 身份元数据文件 |
| ClawHub | OpenClaw 的 Skill 市场/注册中心 |
| MCP | Model Context Protocol，Anthropic 提出的 AI 工具集成协议 |
| config.json | Soul Forge 运行时配置文件，存储 DISC 得分、修饰符参数等元数据 |

### 12.3 现有代码资产清单

```
OpenClaw_Indiviual_SOUL.md/
├── README.md                  # 项目目录说明
├── CLAUDE.md                  # Claude Code 项目笔记
├── src/                       # 可部署源文件
│   ├── skills/soul-forge/SKILL.md        # Skill 定义 (1310 行)
│   ├── hooks/soul-forge-bootstrap/HOOK.md
│   ├── hooks/soul-forge-bootstrap/handler.js  # Bootstrap Hook
│   ├── .soul_forge/config.json           # 运行时配置模板
│   ├── .soul_forge/memory.md             # 观察记录模板
│   ├── .soul_forge/SOUL_INIT.md          # SOUL.md 原始模板
│   ├── .soul_forge/IDENTITY_INIT.md      # IDENTITY.md 原始模板
│   ├── HEARTBEAT_SEGMENT.md              # 观察协议段
│   ├── SOUL.md                           # 示例输出
│   └── IDENTITY.md                       # 示例输出
├── mvp/                       # MVP 交付物 & 测试
│   ├── Soul_Forge_MVP_Install.ps1        # 开发者安装脚本
│   ├── Soul_Forge_Customer_Install.ps1   # 客户安装脚本
│   ├── Soul_Forge_MVP_Test_Guide.md
│   ├── Soul_Forge_Test_Feedback.md
│   └── Soul_Forge_Issue_Record.md
├── docs/                      # 设计文档
│   ├── Soul_Forge_Architecture_v3.1.md   # v3.1 架构规范
│   ├── Soul_Forge_Phase2_Plan.md         # Phase 2 规划文档
│   ├── SoulForge_Business_Plan.md        # 本文档
│   └── archive/                          # 归档文档
└── .claude/                   # Claude Code 设置
```

---

**文档结束**

*Soul Forge — 用 DISC 人格理论铸造 AI 的灵魂。*
