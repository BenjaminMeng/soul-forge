# Soul Forge — AI 人格校准系统 (OpenClaw)

> 看见请求背后的需求。

[![Version](https://img.shields.io/badge/version-3.0--beta-blue)](https://github.com/BenjaminMeng/soul-forge/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-compatible-orange)](https://openclaw.ai)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)]()

**[English](README.md)**

---

## 什么是 Soul Forge？

Soul Forge 是一个**基于 DISC 的行为风格分类系统**，通过校准 AI 助手的沟通风格来匹配你的偏好，并随时间持续学习优化。

**8 个场景问题** → **识别你的行为风格** → **AI 自动适配你** → **持续优化**

| 风格 | 名称 | 沟通方式 |
|:----:|------|---------|
| **D** | 顾问 | 直接、高效、行动导向 |
| **I** | 伙伴 | 热情、善于表达、情感敏锐 |
| **S** | 管家 | 稳定、耐心、服务导向 |
| **C** | 评论家 | 精确、分析型、高标准 |

## 安装

### 一键安装（任意平台）

```bash
npx soul-forge-install
```

> 需要 Node.js 14+。可先预览：`npx soul-forge-install --dry-run`

### 从 Git 安装

**macOS / Linux：**

```bash
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge
node installer.js
```

**Windows (PowerShell)：**

```powershell
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge
node installer.js
```

也可以使用平台专用脚本：

```bash
# macOS / Linux
chmod +x install.sh setup.sh && ./setup.sh

# Windows
.\Setup.bat
```

### OpenClaw 原生安装（即将支持）

```bash
clawhub install soul-forge                          # 安装 Skill
openclaw hooks install soul-forge-bootstrap          # 安装 Hook
```

### 手动安装

1. 将 `skills/soul-forge/` 复制到 `~/.openclaw/skills/soul-forge/`
2. 将 `hooks/soul-forge-bootstrap/` 复制到 `~/.openclaw/hooks/soul-forge-bootstrap/`
3. 将 `.soul_forge/` 复制到 `~/.openclaw/workspace/.soul_forge/`
4. 将 `HEARTBEAT_SEGMENT.md` 的内容追加到你的 `HEARTBEAT.md`
5. 在 `~/.openclaw/openclaw.json` 中启用 hooks：`{"hooks":{"internal":{"enabled":true}}}`
6. 重启 OpenClaw

### 安装后

1. 重启 OpenClaw：`docker compose down && docker compose up -d`
2. 检查日志中是否有：`loaded 4 internal hook handlers`
3. 在 Telegram 中发送 `/soul-forge` 开始校准

## 功能特性

### 核心功能
- **8 道双语场景问题**（中文 / 英文），采用「什么样的人」的提问框架
- **双轴 DISC 计分** — 每个答案同时计主轴（+1）和副轴（+0.5）分
- **硬编码防线** — 分数校验、副类型自动推导、选项打乱检测
- **4 种人格模板** — 顾问、伙伴、管家、评论家

### 持续学习
- **情绪分析** — 本地情绪追踪，支持否定词处理的情感词典（中英双语）
- **漂移检测** — 跨会话追踪 modifier 偏好变化
- **阶段式变更管线** — 四重准入审查 + 验证窗口 + 自动回滚
- **SOUL 演化** — 自动人格微调，带安全护栏
- **Memory 生命周期** — 指纹去重 + LLM 归纳 + 归档
- **成熟度曲线** — 参数随系统学习自动调整（探索期 → 校准期 → 稳定期）
- **事后完整性校验** — 检测未授权的配置/记忆修改

### 隐私保护
- **100% 本地** — 所有数据存储在你的机器上
- **默认无遥测** — 仅 opt-in

## 可用命令

| 命令 | 说明 |
|------|------|
| `/soul-forge` | 开始校准或查看当前状态 |
| `/soul-forge status` | 详细状态 + 上下文调整信息 |
| `/soul-forge pause` | 暂停人格观察 |
| `/soul-forge resume` | 恢复观察 |
| `/soul-forge reset` | 重置为默认人格 |
| `/soul-forge recalibrate` | 重新运行问卷 |

## 工作流程

```
1. /soul-forge          → 隐私说明 + 用户同意
2. 回答 8 个问题         → DISC 计分（双轴，总分 = 12.0）
3. 确认你的类型          → 组装 SOUL.md + IDENTITY.md
4. 日常对话              → Heartbeat 观察并持续优化
5. 随时间推移            → 漂移检测 → 阶段式变更 → SOUL 演化
```

## 架构

```
~/.openclaw/
├── skills/soul-forge/SKILL.md              # 问卷 + 人格逻辑
├── hooks/soul-forge-bootstrap/
│   ├── HOOK.md                             # Hook 元数据
│   ├── handler.js                          # Bootstrap Hook（1800+ 行）
│   ├── sentiment.js                        # 情绪分析引擎
│   └── sentiments/{zh,en}.json             # 情感词典
└── workspace/
    ├── .soul_forge/
    │   ├── config.json                     # 校准状态（schema v3）
    │   ├── memory.md                       # 行为观察记录
    │   └── telemetry.json                  # 匿名化指标（仅本地）
    └── .soul_history/                      # 备份 + 归档
```

## 兼容性

已测试模型：
- **DeepSeek V3.2**（通过 LiteLLM，主要测试模型）

设计上兼容任何 OpenClaw 支持的 LLM。跨模型测试进行中。

## 许可证

[MIT](LICENSE)

---

由 [Benjamin Meng](https://github.com/BenjaminMeng) 精心打造
