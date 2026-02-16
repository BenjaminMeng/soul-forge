# Soul Forge v3.1 — 推演问题清单

---

## I. 内部矛盾（5 项）— ✅ 全部已修正

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| C1 | 修饰符默认值矛盾 | 统一为 5.2 表格值（H=1,V=2,P=1,Ch=0） | ✅ |
| C2 | changelog.json 与「Agent 写 JSON 不可靠」矛盾 | changelog.json → changelog.md | ✅ |
| C3 | 决策 #65 说「自检 5 项」，实际 10 项 | 修正为「自检 10 项」 | ✅ |
| C4 | reset「完全恢复到安装前状态」不准确 | reset → dormant 静默模式 | ✅ |
| C5 | 「三重保障」不成立 | 改为「多层保障」 | ✅ |

---

## II. 机制可行性 — 第一轮（4 项）— ✅ 全部已修正

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| F1 | Heartbeat 精确计数不可靠 | 定性判断，决策 #67 | ✅ |
| F2 | overlay merge 无程序化验证 | 结构验证 + 升级路径 + 静默修复，决策 #68-69 | ✅ |
| F3 | config.json 损坏后 bootstrap 失败 | handler.ts try-catch + 重建，决策 #70 | ✅ |
| F4 | 伪装问答触发者写成 Skill | 改为 Agent，决策 #71 | ✅ |

---

## III. 机制可行性 — 第二轮（8 项）— ✅ 全部已修正

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| F5 | handler.ts 文件写入权限未确认 | 双路径设计，决策 #72 | ✅ |
| F6 | HEARTBEAT.md 标记段删除空窗期 | 强化保护措辞，决策 #73 | ✅ |
| F7 | Agent 执行 Overlay Merge 不可靠 | 模板填充 + 整体写入，决策 #74 | ✅ |
| F8 | memory.md 格式漂移 | 三层防御，决策 #75 | ✅ |
| F9 | Heartbeat 分组计数不可靠 | 计数移入 handler.ts，注入 Readiness，决策 #76 | ✅ |
| F10 | Agent 写复杂嵌套 JSON 风险高 | 写入权限分离（config_update.md 中转），决策 #77 | ✅ |
| F11 | Phase 1 伪装问答频率控制不可靠 | 记录为已知限制，决策 #78 | ✅ |
| F12 | Bootstrap 注入体积未估算 | 3KB 上限 + 动态裁剪，决策 #79 | ✅ |

---

## IV. 机制可行性 — 第三轮（6 项）— ✅ 全部已修正

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| F13 | config_update.md 延迟致同会话状态过时 | HEARTBEAT.md 检查对话历史，决策 #80 | ✅ |
| F14 | 9.2 表 config.json 写入者标注过时 | 更新为 handler.ts，新增 config_update.md 行 | ✅ |
| F15 | changelog write_strategy 旧术语残留 | 移除字段，决策 #83 | ✅ |
| F16 | 9.5 节编号重复 | 重新编号 9.4→9.5→9.6 | ✅ |
| F17 | config.json 初始创建者未明确 | 安装包预置 + handler.ts 兜底，决策 #82 | ✅ |
| F18 | HEARTBEAT.md 要求 Agent 读 config.json | 改从 bootstrap context 读取，决策 #81 | ✅ |

---

## V. 机制可行性 — 第四轮（6 项）— ✅ 全部已修正

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| F19 | F13 逻辑不区分 pause/reset | 改为检查最近一次命令，决策 #84 | ✅ |
| F20 | 数据流图 config.json "创建"措辞 | 标注"从安装包复制" | ✅ |
| F21 | Hook 未运行时 bootstrap context 缺失 | 增加 fallback：跳过所有检查，决策 #85 | ✅ |
| F22 | merge 失败路径直接写 config.json | 改为通过 config_update.md 中转 | ✅ |
| F23 | 9.5 表 Heartbeat 读 config.json 标注 | 加注"通过 bootstrap context 间接获取" | ✅ |
| F24 | Heartbeat 是否触发 agent:bootstrap 未知 | 记录为待确认，F13 机制保留为保障，决策 #86 | ✅ |

---

## VI. 缺失流程 / 边缘情况（6 项）— ✅ 全部已修正

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| E1 | paused 状态下用户调用 `/soul-forge` 的行为未定义 | 选择菜单（恢复/重新校准/查看配置），决策 #87 | ✅ |
| E2 | `.soul_history/` 被删后 dormant 恢复受阻 | 降级处理：提示用户选择「基于现有数据重新校准」或「重新开始」，决策 #88 | ✅ |
| E3 | Heartbeat 与 Skill 同时写文件的竞争条件 | 记录为已知非风险（Agent 单线程 + append only），决策 #89 | ✅ |
| E4 | 隐私说明后用户拒绝继续的退出行为未定义 | 保持 fresh + 不修改文件 + 告知"随时可再运行"，决策 #90 | ✅ |
| E5 | config.json 的 `answers_hash` 字段用途未说明 | 补充字段说明：MD5 短串，检测重复提交，决策 #91 | ✅ |
| E6 | MVP 全流程测试需加速测试模式 | 手动注入预制观察条目 + 测试检查点清单，决策 #92 | ✅ |

---

## VII. 优化建议（3 项）— ✅ 全部已解决

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| O1 | HTML 注释标记消耗 token + 双语言冲突风险 | 移除所有 HTML 注释，改用 H3 标题标记段落，决策 #93 | ✅ |
| O2 | Bootstrap 预注入聚合统计 | 已随 F9 解决 | ✅ |
| O3 | changelog.json → changelog.md | 已随 C2 解决 | ✅ |

---

## VIII. 统计

| 类型 | 总计 | 已解决 | 剩余 |
|------|------|--------|------|
| 内部矛盾 | 5 | 5 | 0 |
| 可行性（四轮合计） | 24 | 24 | 0 |
| 缺失流程 | 6 | 6 | 0 |
| 优化建议 | 3 | 3 | 0 |
| **合计** | **38** | **38** | **0** |

---

## IX. 后续审查轮次

### 第八轮（N1-N8）— E1-E6 + O1 修改引入的问题

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| N1 | 测试数据模板缺少 status: active | 补充字段，决策 #94 | ✅ |
| N2 | paused 菜单绕过引用 calibrate 应为 recalibrate | 修正命令名 + 加注 calibrate 需先 resume，决策 #95 | ✅ |
| N3 | HEARTBEAT.md 命令检查缺 recalibrate/resume | 加入 → calibrated 规则，决策 #96 | ✅ |
| N4 | 决策 #93 称"改用 H3"不准确 | 修正描述，决策 #97 | ✅ |
| N5 | SOUL.md 移除 HTML 注释 vs HEARTBEAT.md 保留 | 接受（上下文不同） | ✅ |
| N6 | reset 时 .soul_history/ 缺失 | 补充降级处理，决策 #98 | ✅ |
| N7 | 隐私拒绝后无限提醒 | 新增 declined 状态，决策 #99 | ✅ |
| N8 | answers_hash 无消费者 | 标记为 Phase 2，决策 #100 | ✅ |

### 第九轮（P1-P7）— declined 状态传播问题

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| P1 | config.json schema 缺 declined | 补充枚举值，决策 #101 | ✅ |
| P2 | 决策 #90 与 declined 实现矛盾 | 更新为 status→declined，决策 #102 | ✅ |
| P3 | handler.ts 无 declined 处理规则 | 补充 8b 项，决策 #103 | ✅ |
| P4 | M5/M6 描述缺 declined | 接受（任务摘要不穷举） | ✅ |
| P5 | 决策 #84 缺 recalibrate/resume | 接受（#96 已覆盖） | ✅ |
| P6 | reset "跳过步骤 1" 自引用歧义 | 修正措辞，决策 #104 | ✅ |
| P7 | HEARTBEAT declined 例外依赖语义推断 | 加例外说明，决策 #105 | ✅ |

### 第十轮（Q1-Q5）— 收敛审查

| # | 问题 | 处理方式 | 状态 |
|---|------|---------|------|
| Q1 | 决策 #66 缺 declined | 接受（后续决策已覆盖） | ✅ |
| Q2 | M5/M6 再次指出缺 declined | 接受（同 P4） | ✅ |
| Q3 | config 损坏重建覆盖 declined | 记录为已知限制，决策 #106 | ✅ |
| Q4 | Skill 命令表缺 declined 说明 | 补充说明，决策 #107 | ✅ |
| Q5 | HEARTBEAT declined 推断可靠性 | 接受为已知限制 | ✅ |

### 第十一轮（R1-R10）— ISO/IEC 标准审查

基于 ISO/IEC/IEEE 42010（架构描述）、29148（需求工程）、25010（质量模型）及隐私设计原则的外部审查。

| # | 问题 | 严重性 | 处理方式 | 状态 |
|---|------|--------|---------|------|
| R1 | 隐私声明称"不收集对话内容"但 memory.md signal 字段记录原始引语 | 严重 | 改隐私声明为"可能记录简短对话片段"，决策 #108 | ✅ |
| R2 | handler.ts 错误日志 `section.slice(0, 50)` 可能泄露用户对话 | 严重 | 改为只记元数据（date + length），决策 #109 | ✅ |
| R3 | config 损坏重建覆盖 declined 已标注但未标注隐私敏感性 | 严重 | 维持已知限制，注释标注为隐私敏感，决策 #110 | ✅ |
| R4 | 缺少完整 FSM 状态转移矩阵（5 状态 × 命令交叉） | 高 | 补充 5×8 矩阵含幂等性规则，决策 #111 | ✅ |
| R5 | 决策 #86 Heartbeat 是否触发 agent:bootstrap 标注"待确认" | 高 | 验证确认：每个 Agent turn 均触发 bootstrap，决策 #112 | ✅ |
| R6 | 未明确 handler.ts 与 Agent 是否存在真并发 | 高 | 接受（确认 OpenClaw 单线程 turn 模型，无真并发） | ✅ |
| R7 | memory.md 的 signal 字段缺乏数据最小化约束 | 中 | 接受（记录为设计折中） | ✅ |
| R8 | MVP 范围描述与 Phase 1 伪装探测矛盾 | 中 | MVP 含伪装探测，决策 #113 | ✅ |
| R9 | Heartbeat 成本数字缺乏时效性标注 | 中 | 标注为估算值 + 待实测，决策 #114 | ✅ |
| R10 | 修饰符默认值缺乏来源说明 | 低 | 接受（5.2 表格已有定义） | ✅ |

---

## X. 最终统计

| 类型 | 总计 | 已解决 | 剩余 |
|------|------|--------|------|
| 内部矛盾（C1-C5） | 5 | 5 | 0 |
| 可行性 — 四轮（F1-F24） | 24 | 24 | 0 |
| 缺失流程（E1-E6） | 6 | 6 | 0 |
| 优化建议（O1-O3） | 3 | 3 | 0 |
| 后续审查（N1-N8, P1-P7, Q1-Q5） | 20 | 20 | 0 |
| ISO/IEC 标准审查（R1-R10） | 10 | 10 | 0 |
| **合计** | **68** | **68** | **0** |

---

## XI. 最终审查结论

**全部 68 项问题已解决（含 11 轮审查）。文档已准备好进入 MVP 实现阶段。**

核心设计原则：
- Agent 只写 Markdown，TypeScript 只写 JSON
- 模板填充 + 整体写入（无 overlay merge）
- Heartbeat 不计数、不读 JSON，只检查 bootstrap 注入文本
- handler.ts 全面容错（单条 try-catch、归一化解析、损坏重建）
- HEARTBEAT.md 同会话状态感知（最近一次命令 + bootstrap context 缺失兜底 + declined 例外）
- SOUL.md 纯 Markdown（无 HTML 注释）
- 5 种 config 状态全路径覆盖：fresh / calibrated / paused / dormant / declined
- 完整 FSM 状态转移矩阵（5 状态 × 8 事件）
- 隐私声明与实际数据收集行为对齐
- 所有边缘情况均有明确处理路径或记录为已知限制
