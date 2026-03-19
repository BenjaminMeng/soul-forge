# Soul Forge — AI 人格校准系统 (OpenClaw)

> 让你的 AI 助手真正像「你的」AI 助手。

[![Version](https://img.shields.io/badge/version-2.0--beta-blue)](https://github.com/BenjaminMeng/soul-forge/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-compatible-orange)](https://openclaw.ai)

**[English](README.md)**

---

## 什么是 Soul Forge？

Soul Forge 是一个**基于 DISC 的行为风格分类系统**，通过校准 AI 助手的沟通风格来匹配你的偏好。

**8 个场景问题** → **识别你的行为风格** → **AI 自动适配你**

| 风格 | 名称 | 沟通方式 |
|:----:|------|---------|
| **D** | 顾问 | 直接、高效、行动导向 |
| **I** | 伙伴 | 热情、善于表达、情感敏锐 |
| **S** | 管家 | 稳定、耐心、服务导向 |
| **C** | 评论家 | 精确、分析型、高标准 |

## 快速开始

### 一键安装（PowerShell）

```powershell
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge
.\Install.ps1
```

然后重启 OpenClaw，在 Telegram 中发送 `/soul-forge` 即可开始。

### 手动安装

1. 将 `skills/soul-forge/` 复制到 `~/.openclaw/skills/soul-forge/`
2. 将 `hooks/soul-forge-bootstrap/` 复制到 `~/.openclaw/hooks/soul-forge-bootstrap/`
3. 将 `.soul_forge/` 复制到 `~/.openclaw/workspace/.soul_forge/`
4. 将 `HEARTBEAT_SEGMENT.md` 的内容追加到你的 `HEARTBEAT.md`
5. 重启 OpenClaw

## 功能特性

- **8 道双语场景问题**（中文 / 英文），采用「什么样的人」的提问框架
- **双轴 DISC 计分** — 每个答案同时计主轴（+1）和副轴（+0.5）分
- **硬编码防线** — 分数校验、副类型自动推导、选项打乱检测
- **4 种人格模板** — 顾问、伙伴、管家、评论家
- **持续学习** — 通过 Heartbeat 观察 + 风格探测在会话间持续优化
- **情绪分析** — 情绪追踪和漂移检测
- **100% 本地** — 所有数据存储在你的机器上的 `.soul_forge/` 目录中

## 可用命令

| 命令 | 说明 |
|------|------|
| `/soul-forge` | 开始校准或查看当前状态 |
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
```

## 架构

```
~/.openclaw/
├── skills/soul-forge/SKILL.md          # 问卷 + 人格逻辑
├── hooks/soul-forge-bootstrap/
│   ├── HOOK.md                         # Hook 元数据
│   └── handler.js                      # Bootstrap Hook（计分校验、上下文注入）
└── workspace/.soul_forge/
    ├── config.json                     # 校准状态
    └── memory.md                       # 行为观察记录
```

## 隐私保护

所有数据存储在本地 `~/.openclaw/workspace/.soul_forge/` 目录中，不会发送到任何外部服务器。你可以：

- 运行 `/soul-forge reset` 恢复默认设置
- 删除 `.soul_forge/` 目录以移除所有 Soul Forge 数据
- 运行 `/soul-forge pause` 随时暂停观察

## 兼容性

已测试模型：
- **DeepSeek V3.2**（通过 LiteLLM，主要测试模型）

设计上兼容任何 OpenClaw 支持的 LLM。跨模型测试进行中。

## 许可证

[MIT](LICENSE)

---

由 [Benjamin Meng](https://github.com/BenjaminMeng) 精心打造
