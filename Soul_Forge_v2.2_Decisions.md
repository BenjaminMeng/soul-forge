# Soul Forge v2.2 — 完整决策记录

---

## 一、架构推演已确认决策（问题 1-16，全部完成）

### 决策 1：错误处理偏好和主动性偏好的来源
- 删除独立变量，写入 `CORE_TRUTHS_ROLE[DISC_TYPE]` 角色模板
- `## Core Truths = OpenClaw 底包 + CORE_TRUTHS_ROLE[DISC_TYPE]`

### 决策 2：DISC 问卷选项顺序
- 每道题选项随机打乱，代码中按题存储选项→DISC 类型映射表

### 决策 3：DISC 并列处理 + 主副视角机制
- 置信度分级：gap ≥ 3 high / 1-2 medium / 0 low
- 并列时反向推断（淘汰最低分类型推导推荐），用户确认
- 副视角：运行时备用模式，MVP 只存不用，Phase 2 Skill 处理
- 低信心用户加速判定（提问频率提高，非风格切换）

### 决策 4：角色模板命名
- 人化名字 + 文化辨识度 + 多语言适配
- 具体命名和 4 套模板文本待后续内容创作

### 决策 5：overlay_merge + 底包保留 + 逐渐内化
- 状态 1（全新模板）→ 直接替换
- 状态 2（已使用用户）→ 保存快照 + 保留全部用户定制 + Phase 2 Skill 渐进内化
- 状态 3（SF 二次运行）→ 直接替换管辖内容
- 内化方式：以"AI 学习人类表达"为伪装的自然对话

### 决策 6：IDENTITY.md `## Core` 段位置
- 放在元数据字段之前
- OpenClaw 解析器是行扫描式，位置无关，不会破坏解析

### 决策 7：工作空间路径
- 组合策略：`--workspace` 参数 > 读取 `openclaw.json` > 默认 `~/.openclaw/workspace/`
- Skill 模式下跳过路径发现，直接使用当前目录

### 决策 8：Pre-flight Check 状态区分
- **双重检测**：config.json 为主 + SOUL.md 末尾 `[//]: # (soul-forge:...)` 标记为辅
- 优先级：config.json 存在→状态3 / 标记存在→状态3 / 匹配模板→状态1 / 不匹配→状态2

### 决策 9：MVP 修饰符范围
- MVP 不含修饰符问卷（仅 8 题 DISC）
- 修饰符全部设为默认值（各维度=1），留给 Phase 2 Skill 探测

### 决策 10：Boundaries 隐私偏好来源
- 留给 Phase 2 Skill 在对话中逐步探测
- MVP 用 DISC 类型默认倾向
- config.json 中 `boundaries_preference: "default"`

### 注意级问题 11-16（全部确认）
| # | 问题 | 决策 |
|---|---|---|
| 11 | `normalize()` 函数 | `text.strip().lower()`，用于 Pre-flight Check 中内容比对时抹平格式差异 |
| 12 | 4KB 体积约束 | 当前估算 ~2.8KB，安全，保持关注 |
| 13 | 商业策划书过时 | **v2.0 已完成基础更新**，审查后发现需要进一步修改（见第四节） |
| 14 | SOUL_INIT.md 被删除 | 可接受的边缘情况 |
| 15 | 部分文件不存在 | 保留 ensure_template_files() 行为 |
| 16 | 问卷中断状态一致性 | 写入操作放在用户确认之后，中途退出零副作用 |

---

## 二、架构重大升级：Skill + Hook + Heartbeat 方案

### 背景

原 v2 架构假设 Soul Forge 是一个纯 Skill（SKILL.md），用户主动调用完成校准。
经过对 OpenClaw 底层机制的深入研究，发现以下问题：

1. **Skill 不能后台运行** — Skill 是文档，不是进程，被调用时执行完即结束
2. **用户可能永远不调用 Skill** — 如果用户不知道或懒得调用，校准永远不会发生
3. **MEMORY.md/daily log 中的人格信号几乎为零** — Agent 总结只记录 WHAT happened，不记录 HOW user behaved
4. **纯依赖 Agent 自观察不可靠** — Agent 在回答用户问题时的注意力主要在任务上，观察指令容易被忽略

### 升级后的架构：四组件协同

| 组件 | 类型 | 触发方式 | 职责 | 可靠性 |
|------|------|---------|------|--------|
| `soul-forge` | Skill | 用户调用/Agent 判断 | DISC 问卷 + 主动校准 + SOUL.md 更新 | 高（显式调用） |
| `soul-forge-bootstrap` | Hook | 每次 Agent 启动（自动） | 注入校准上下文 + SOUL.md 身份层指令 | 高（系统级） |
| **HEARTBEAT.md 检查项** | **Heartbeat** | **每 2-4 小时自动** | **回顾对话 → 提取人格信号 → 写 memory.md** | **高（专用回合）** |
| `soul-forge-collector` | Hook | /new 时（自动） | 补充提取（从原始 transcript） | 中（用户可能不用 /new） |

### 数据流

```
三重保障的人格数据收集：

1. SOUL.md 身份层（兜底）
   Agent 在对话中可能自发注意到人格信号 → 写 memory.md

2. Heartbeat 定期检查（主力）
   每 2-4 小时 → 专用回合回顾对话 → 提取人格信号 → 写 memory.md

3. /new Hook（补充）
   会话重置时 → 分析原始 transcript → 提取遗漏信号 → 追加 memory.md

       ↓ 积累到足够证据后 ↓

4. Skill 正式更新
   memory.md 同方向观察 ≥ 5 条 → Heartbeat 建议用户运行 /soul-forge calibrate
   → Skill 更新 SOUL.md 修饰符值 → 已结晶观察归档
```

### 观察协议放置：选项 C（双层设计）

**第一层：SOUL.md `## Core Truths`（身份层）**

放在 SOUL.md 顶部，利用 70/20 裁切比率（开头 70% 优先保留）：

```markdown
### Self-Calibration Protocol
You MUST observe user communication preferences during every conversation.
When you detect style feedback, emotional patterns, or boundary signals,
record them to .soul_forge/memory.md using the write tool.
You NEVER write to MEMORY.md. Only .soul_forge/memory.md.
```

- 享受 SOUL.md 特殊待遇（"embody its persona"）
- MUST/NEVER 绝对语言
- 与 Agent 身份绑定

**第二层：Bootstrap Hook 注入的结构化文件（操作层）**

每次 `agent:bootstrap` 动态生成：

```markdown
# Soul Forge Calibration Context
## Recent Observations (最近 20 条)
- 2026-02-10: style / "别那么啰嗦" / 偏好简洁
- ...
## Recording Format
{"ts": "ISO8601", "type": "style|emotion|boundary|decision", ...}
## Active Modifiers
verbosity: 1 | humor: 2 | proactivity: 2 | challenge: 0
```

### 记忆存储格式：Markdown（非 JSON）

**决策**：`.soul_forge/memory.md` 用 Markdown 而非 JSON。

**原因**：Agent 天然擅长写 Markdown，操作 JSON 容易出错（格式损坏、覆盖数据、字段不一致）。
bootstrap hook 的 handler.ts（TypeScript）负责解析 Markdown 提取结构化数据。

```markdown
# Soul Forge Observations

## 2026-02-12 19:30
- **type**: style
- **signal**: 用户说"说重点，别绕弯子"
- **inference**: 偏好简洁直接的沟通
- **modifier_hint**: verbosity → 降低
```

### HEARTBEAT.md 集成

在用户现有 HEARTBEAT.md 中追加 Soul Forge 段（标记保护）：

```markdown
<!-- SOUL_FORGE_START - Do not edit below this line -->
## Soul Forge: Personality Observation
- FIRST: Check .soul_forge/config.json status
- If status = "fresh": remind user to run /soul-forge (max once per 3 heartbeats)
- If status = "calibrated":
  - Review conversation since last heartbeat
  - If personality signals detected → append to .soul_forge/memory.md
  - Format: ## YYYY-MM-DD HH:MM / type / signal / inference
  - If no signals → skip silently
- If 10+ uncristallized observations of same type in memory.md:
  suggest user run /soul-forge calibrate (max once per day)
<!-- SOUL_FORGE_END -->
```

Bootstrap hook 每次启动时检查 HEARTBEAT.md 是否包含此标记段，如被删除则自动重新追加。

### Heartbeat 推荐配置

```json5
{
  agents: {
    defaults: {
      heartbeat: {
        every: "2h",                    // 2 小时一次（平衡成本与覆盖）
        model: "anthropic/claude-sonnet-4-5",  // 用便宜模型
        activeHours: {
          start: "08:00",
          end: "23:00"
        }
      }
    }
  }
}
```

预估成本：7-8 次/天 × $0.05-0.15 = $0.35-1.20/天（Sonnet）

---

## 三、OpenClaw 技术发现（本次研究成果）

### Skill 本质
- Skill = SKILL.md 纯文本指令文档，不是进程
- 三级渐进加载：Tier1（名称描述，自动）→ Tier2（全文，Agent 判断）→ Tier3（参考文件）
- 不能后台运行，不跨 turn 持久化

### Hook 系统
- 事件驱动脚本：HOOK.md + handler.ts
- **当前已实现事件**：command:new/reset/stop、agent:bootstrap、gateway:startup
- **Future Events（未实现）**：message:sent/received、session:start/end
- 发现路径优先级：workspace > managed > bundled
- Hook Pack：npm 包格式，`openclaw hooks install <path>` 安装

### Heartbeat 心跳机制
- 定期自动触发的 Agent 回合，默认 30 分钟
- **在主会话中运行，拥有完整对话历史**
- 读取 HEARTBEAT.md，"follow it strictly"
- 静默模式：HEARTBEAT_OK 被系统吞掉，用户无感
- 可用更便宜的模型、限制活跃时间
- Agent 可在心跳回合中写文件

### 系统提示结构（优先级从高到低）
1. 基础身份
2. 工具列表
3. Skills 列表
4. Memory Recall 指令
5. ...（中间 10+ 段）
6. **Project Context**（SOUL.md、AGENTS.md 等在此注入）

- SOUL.md 位于第 17 位（末尾区域），但有显式强调："embody its persona"
- 裁切比率 70/20：开头 70% 优先保留 → 关键指令放 SOUL.md 顶部
- LLM 指令遵循规律：结构化 > 散文、MUST/NEVER > should、重复出现 > 单次、前置 > 后置

### Agent 总结的 Memory 文件对人格校准无用
- 实测用户的 daily log（2026-02-06.md）：纯事实记录，零人格信号
- Agent 总结只记录 WHAT happened，丢失 HOW user behaved
- 结论：不能依赖读取 memory 文件做校准，必须实时/准实时观察

### 多会话限制
- Heartbeat 默认在主会话运行，只能观察主会话对话
- identityLinks 可跨频道合并同一用户的会话
- 群聊为独立会话，MVP 不覆盖
- MVP 结论：只覆盖主会话（私聊），群聊 Phase 2

---

## 四、商业策划书审查结果（8 轮苏格拉底式对话）

### 已完成的 v2.0 基础更新
- v1 的 BDI/Leary/11 协议引用已全部替换为 v2 的 DISC/修饰符/Pre-flight Check
- 18 处编辑已完成，文件已保存

### 审查发现的核心事实（需写入商业策划书）

| # | 事实 | 来源 |
|---|---|---|
| F1 | 创始人是医学生，零技术背景，全程 Vibe Coding | Q31 |
| F2 | 医学背景优势：文献检索、伦理敏感度、数据分析能力 | Q34 |
| F3 | 中国市场是短期主力（闲鱼获客），国际市场是长期主攻 | Q25 |
| F4 | 闲鱼安装服务 ¥19.9 起 + ¥9.9/额外平台，操作指南 ¥9.9 | Q29 |
| F5 | 核心交付依赖 OpenClaw 自动化（微信全流程），尚未验证 | Q27 |
| F6 | 真实第一目标：$200/月（API 费用），非商业策划书的 $2,700 | Q18 |
| F7 | 止损线：10 月前月入 ¥6,000，累计净投入上限 ¥2,000 | Q28 |
| F8 | 关联项目：新媒体艺术家合伙人的数字分身（Max/TD 教学） | Q26 |
| F9 | 合伙人：X 上 700 关注，新媒体艺术圈有声望 | Q26 |
| F10 | 商业策划书是内部文档（给自己和合伙人看） | Q34 |
| F11 | 红线：绝不直接写入 MEMORY.md | Q24/持续确认 |
| F12 | 平行记忆系统改为 `.soul_forge/memory.md`（Markdown 格式） | 本次确认 |
| F13 | 中国客户预期分布：50% 双平台(¥29.8)、各15% 单/三平台、20% 仅指南 | Q29 |
| F14 | 自由职业者，艺术奖项可能占用精力 | Q28 |
| F15 | 监管策略：定位为工具(类型1)+技术服务(类型3)，暗示但不明说 AI 陪伴 | Q24 |

### 商业策划书待修改项（按优先级）

#### P0：必须修改

**1. Section 9（财务预测）重写：**
- 成本结构加入 API 费用（当前 ~$20-30/月，目标 $200/月）
- 增加人民币收入预测（闲鱼渠道）
- 增加"生存线"预测列（最低：覆盖 API 费用 $200/月）
- 修正盈亏平衡点（含 API 费用后重算）
- 加权平均客单价：中国市场 ~¥25.8/单

**2. Section 7（市场进入策略）重写 Phase 1：**
- 核心渠道从 Discord/Upwork 改为闲鱼 + 微信
- 补充自动化交付策略（闲鱼机器人引流→微信→OpenClaw 全流程）
- 补充降级方案：如果自动化不成熟，卖操作指南（¥9.9）
- 英文社区（Discord/Upwork/Fiverr）作为辅助渠道保留

**3. Section 10（风险分析）补充：**
- 自动化未验证风险（最大的单点依赖）
- 售后黑洞风险（客户量增加后的支持负担）
- 监管定位风险（AI 陪伴灰色地带）
- Vibe Coding 技术风险（无法独立验证代码正确性）
- 精力分配风险（艺术奖项 vs 项目投入）

#### P1：应当修改

**4. Section 11（里程碑路线图）与实际执行对齐：**
- 第 1 周：闲鱼上架 + OpenClaw 自动化调试 + 平台接入测试
- 第 2-3 周：v2 核心实现 + 首批客户验证
- 春节窗口利用策略

**5. Section 6（商业模式）增加中国市场定价：**
- 操作指南：¥9.9
- 安装服务：¥19.9 + ¥9.9/额外平台
- 免费→付费 Skill 转化率目标：20%
- 付费核心卖点：Challenge 损友模式 + 修饰符自定义滑块

**6. 新增章节：关联项目与协同**
- 数字分身项目（新媒体艺术家合伙人，Max/TouchDesigner 教学）
- Soul Forge 角色：为数字分身配置人格（客服/指导老师）
- 合伙人提供：持续测试 + 700 粉丝宣传渠道
- 协同：Soul Forge 获客数据 → 数字分身方向验证

**7. 新增章节：团队能力与约束**
- 创始人：医学背景 + Vibe Coding + 自由职业
- 优势：文献检索、伦理敏感度、AI 工具深度用户
- 约束：无技术背景、单人团队、艺术奖项时间竞争
- 核心助手：Claude + OpenClaw（AI 辅助开发 + AI 辅助交付）

**8. 新增章节：止损条件**
- 时间止损：2026 年 10 月，月收入未达 ¥6,000 → 降级为业余维护
- 资金止损：累计净投入超 ¥2,000 → 暂停付费支出
- 精力止损：艺术奖项优先 → 项目转入 OpenClaw 自动化数据收集模式
- 转向路径：技术资产转入数字分身方向，同样的 SOUL 配置能力

#### P2：同步更新

**9. Section 1（执行摘要）同步更新**

**10. Section 5（技术架构）补充** — 需更新为 Skill + Hook + Heartbeat 架构

---

## 五、分发策略

### 项目形态
Soul Forge 不是纯 Skill，是 **Skill + Hook Pack 组合包**：
- 1 个 Skill（SKILL.md）
- 2 个 Hook（soul-forge-bootstrap、soul-forge-collector）
- HEARTBEAT.md 追加段
- .soul_forge/ 数据目录
- openclaw.json 配置确认

### ClawHub 分发路径
1. 在 ClawHub 发布 `soul-forge` Skill
2. SKILL.md 中包含"首次运行安装指令"
3. Agent 读取后自动执行剩余安装（Hook Pack 下载、目录创建、HEARTBEAT.md 追加）
4. 用户体验：`clawhub install soul-forge` → Agent 完成全部配置

### 安装服务（闲鱼）
8 步手动安装流程，或一键安装脚本（`install.sh` / `install.ps1`）

### 网页问卷集成（未来）
- 用户在网站完成 DISC 问卷
- 生成预配置 config.json + 安装指令
- 用户下载/粘贴给 Agent → 跳过 Agent 内问卷
- 方式：预配置文件 + 一段"咒语"指令

---

## 六、推演发现的问题清单

### v2 推演（含 Heartbeat）

| # | 问题 | 严重性 | 方案 | 阶段 |
|---|------|--------|------|------|
| 1 | HEARTBEAT.md 所有权冲突 | 中 | 标记段 + bootstrap 自修复检查 | MVP |
| 2 | Heartbeat 未启用 | 中 | 安装时确认 + 降级到 SOUL.md 自观察 | MVP |
| 3 | 校准前 heartbeat 行为 | 低 | 前置条件检查 config.json status | MVP |
| 4 | 上下文压缩丢失人格信号 | 中低 | 接受损失 + SOUL.md 自观察兜底 | 可接受 |
| 5 | 心跳 token 成本透明度 | 中 | 安装时告知 + 低成本模式选项 | MVP |
| 6 | 多会话/多频道覆盖不全 | 低 | MVP 只覆盖主会话 | Phase 2 |
| 7 | collector 与 heartbeat 数据重复 | 低 | Skill 更新时去重 | 可接受 |
| 8 | SOUL.md 更新触发点 | 优化 | 阈值检测放在 HEARTBEAT.md | MVP |
| 9 | 安装步骤过多 | 中 | 安装脚本 / ClawHub 自动安装 | MVP |

### v1 推演中已解决的问题

| # | 问题 | 方案 |
|---|------|------|
| 原3 | Agent 写 JSON 不可靠 | 改用 Markdown 格式 |
| 原5 | 用户不发 /new | Heartbeat 替代为主力收集机制 |

### 结构性风险评估

**原最大风险**（Agent 不执行观察协议）→ 现三重保障后从高风险降为低风险：
1. SOUL.md 身份层（兜底，不可靠但有）
2. Heartbeat 专用回合（主力，"follow strictly"）
3. /new Hook（补充）

**当前最大风险**：LLM 模型对心跳指令的遵循率——需 MVP 阶段实测。
建议测试矩阵：Claude Sonnet / GPT-4o / Gemini，各 10 轮对话，统计观察协议执行率。

---

## 七、待完成工作

### 已暂停
- [ ] 商业策划书 P0-P2 修改（10 项）
- [ ] v2 架构文档更新（需反映 Skill + Hook + Heartbeat 方案）

### 本次讨论后新增
- [ ] memory.md 数据结构详细设计
- [ ] memory.md 与 config.json 职责划分
- [ ] HEARTBEAT.md Soul Forge 段的精确措辞调优
- [ ] bootstrap hook handler.ts 的伪代码设计
- [ ] collector hook handler.ts 的伪代码设计
- [ ] ClawHub 发布流程研究
- [ ] 安装脚本设计
- [ ] 4 套 DISC 角色模板文本创作
- [ ] 8 题 DISC 问卷设计
- [ ] MVP 测试计划（LLM 模型 × 观察协议执行率）
