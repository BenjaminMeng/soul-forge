# Soul Forge Questionnaire v2 Design Document

> Created: 2026-03-17
> Status: FINALIZED (Comprehensive Review Score: 4.25/5)
> Next: SKILL.md implementation

## 1. Design Decisions Summary (15 Socratic Q&A Rounds)

| # | Decision | Conclusion |
|---|----------|-----------|
| D1 | Framework | "什么样的人" relationship preference (not self-assessment) |
| D2 | Scoring | Dual-axis: Primary +1, Secondary +0.5 |
| D3 | Secondary derivation | Semantic (derived from option content) |
| D4 | Personality mapping | Fusion C: Primary template + Secondary color |
| D5 | Template structure | Hard skeleton + soft transitions (A->B progressive) |
| D6 | Scene count | 8 questions |
| D7 | Scene distribution | Work 3 + Daily 3 + Emotion 2 |
| D8 | Stem style | Natural variation across questions |
| D9 | Option style | Mixed: Work = behavior description, Daily/Emotion = trait description |
| D10 | I/S attractiveness | Balanced via scene distribution + option rewriting |
| D11 | Scoring path | A->B progressive (fixed 0.5 -> data-calibrated) |
| D12 | Mapping path | A->C progressive (pure template -> fusion template) |
| D13 | Option count | Fixed 4 options per question (D/I/S/C) |
| D14 | Post-questionnaire | Reverse validation question (replaces verbosity preference) |
| D15 | Option order recording | R4 accepted: record randomized order for analysis |

## 2. Secondary Axis Distribution (Rotation Pattern)

Ensures D/I/S/C each receive exactly 8 secondary assignments (perfect balance):

| Q | D-opt-> | I-opt-> | S-opt-> | C-opt-> |
|---|---------|---------|---------|---------|
| Q1 | I | S | C | D |
| Q2 | C | D | I | S |
| Q3 | S | C | D | I |
| Q4 | I | S | C | D |
| Q5 | C | D | I | S |
| Q6 | S | C | D | I |
| Q7 | I | S | C | D |
| Q8 | C | D | I | S |

Verification: D=8, I=8, S=8, C=8

## 3. Questionnaire Content

### Q1: Deadline (Work / Behavior)

> 手上有个重要的事得尽快完成，时间特别紧。你更希望身边有什么样的人？

| Opt | Content | Primary | Secondary | Secondary Rationale |
|-----|---------|---------|-----------|-------------------|
| A | 果断干脆，迅速帮你理清优先级，带着你把精力集中在刀刃上 | D+1 | I+0.5 | "带着你" interactive drive |
| B | 先给你鼓鼓劲，拉着你一起头脑风暴，陪你找到最快的方案 | I+1 | S+0.5 | "陪你" supportive |
| C | 不声不响把所有资料和进度都整理好，让你需要的时候随时能用 | S+1 | C+0.5 | "整理好" meticulous |
| D | 冷静帮你盘一遍时间和风险，确保关键节点不出岔子 | C+1 | D+0.5 | "确保关键" decisive |

### Q2: Stuck (Work / Behavior)

> 工作里碰上一个棘手的问题，试了好几种方法都不行。你希望身边有什么样的人？

| Opt | Content | Primary | Secondary | Secondary Rationale |
|-----|---------|---------|-----------|-------------------|
| A | 凭经验直接判断最可能管用的方向，先试了再说 | D+1 | C+0.5 | "判断" analytical |
| B | 把问题当挑战，兴致勃勃拉你一起"打怪"，越难越来劲 | I+1 | D+0.5 | "越难越来劲" drive |
| C | 不急，陪你边聊边排查，一点一点来总会找到的 | S+1 | I+0.5 | "边聊边" interactive |
| D | 把所有试过的方法列出来，逐个分析失败原因，从规律里找到突破点 | C+1 | S+0.5 | "逐个" patient |

### Q3: Collaboration (Work / Behavior)

> 你需要跟一个不太熟的人一起完成一件事。你觉得什么样的搭档最好合作？

| Opt | Content | Primary | Secondary | Secondary Rationale |
|-----|---------|---------|-----------|-------------------|
| A | 遇事果断，有分歧的时候能拍板，带着大家往一个方向走 | D+1 | S+0.5 | "一个方向" stability |
| B | 自来熟，很快就能摸清每个人擅长什么、喜欢怎么干，把合作氛围搞得特别好 | I+1 | C+0.5 | "摸清擅长" insight |
| C | 靠谱踏实，默默做好自己的部分，让你能放心专注自己的事 | S+1 | D+0.5 | "放心专注" empowerment |
| D | 做事有章法，交付的东西质量靠谱，对细节和标准要求清楚 | C+1 | I+0.5 | "要求清楚" communication |

### Q4: Casual Chat (Daily / Trait)

> 闲下来想找人随便聊聊。你觉得什么样的人聊起来最舒服？

| Opt | Content | Primary | Secondary | Secondary Rationale |
|-----|---------|---------|-----------|-------------------|
| A | 有主见，观点鲜明，跟你聊天有来有回有碰撞 | D+1 | I+0.5 | "有来有回" interactive |
| B | 幽默风趣，气氛轻松，待着就觉得舒服 | I+1 | S+0.5 | "待着就舒服" calming |
| C | 温和耐心，认真倾听每一句，让你觉得被真正理解 | S+1 | C+0.5 | "认真""每一句" meticulous |
| D | 知识面广有深度，总能带给你新的视角和想法 | C+1 | D+0.5 | "带给你" leading |

### Q5: Learning (Daily / Trait)

> 想学一个全新的领域，一点基础都没有。你更喜欢什么样的人来带你？

| Opt | Content | Primary | Secondary | Secondary Rationale |
|-----|---------|---------|-----------|-------------------|
| A | 直接告诉你最核心的 20%，帮你快速抓住重点 | D+1 | C+0.5 | "核心20%" analytical filter |
| B | 把学习变成一件好玩的事，举的例子生动有趣，学着学着就上瘾了 | I+1 | D+0.5 | "上瘾" momentum |
| C | 从头开始按你的节奏来，时刻关注你是不是跟上了 | S+1 | I+0.5 | "时刻关注你" caring interaction |
| D | 先帮你画一张全景图，让你从容地掌握全貌再深入 | C+1 | S+0.5 | "从容地" steady |

### Q6: Life Choice (Daily / Trait)

> 你在纠结一个生活里的选择（比如换工作、搬家、买东西）。你更喜欢什么样的人给你建议？

| Opt | Content | Primary | Secondary | Secondary Rationale |
|-----|---------|---------|-----------|-------------------|
| A | 直截了当帮你理清利弊，给你一颗定心丸 | D+1 | S+0.5 | "定心丸" calming |
| B | 先和你聊聊感受和期待，帮你搞清楚自己到底想要什么 | I+1 | C+0.5 | "搞清楚" clarity |
| C | 不催你做决定，陪你慢慢想清楚，让你踏踏实实做出自己的选择 | S+1 | D+0.5 | "做出选择" empowerment |
| D | 帮你列出每个选项的优缺点做对比，有什么疑问随时帮你分析 | C+1 | I+0.5 | "随时回答" interactive |

### Q7: Under Pressure (Emotion / Trait)

> 最近压力特别大，心情不太好。你更希望身边有什么样的人？

| Opt | Content | Primary | Secondary | Secondary Rationale |
|-----|---------|---------|-----------|-------------------|
| A | 跟你一起面对，帮你把大压力拆成一个个能搞定的小事 | D+1 | I+0.5 | "一起面对" companionship |
| B | 让你感到有人在意你，先聊点轻松的帮你缓一缓 | I+1 | S+0.5 | "缓一缓" comfort |
| C | 安安静静陪着你，帮你慢慢理一理心里的头绪 | S+1 | C+0.5 | "理一理头绪" sorting out |
| D | 帮你客观看清压力来源，找到最该先处理的那个 | C+1 | D+0.5 | "最该先处理" decisive |

### Q8: Good News (Emotion / Trait)

> 你刚完成了一件很有成就感的事，想找人分享。你希望对方怎么回应？

| Opt | Content | Primary | Secondary | Secondary Rationale |
|-----|---------|---------|-----------|-------------------|
| A | 肯定你的实力，帮你想想怎么把这次的成功经验用好 | D+1 | C+0.5 | "成功经验" extraction |
| B | 特别替你开心，庆祝的同时还鼓励你去挑战更大的目标 | I+1 | D+0.5 | "更大目标" ambition |
| C | 真诚地为你高兴，认真听你分享过程中的每个故事 | S+1 | I+0.5 | "分享故事" interactive |
| D | 踏踏实实帮你复盘，总结出下次也能用的经验和方法 | C+1 | S+0.5 | "踏踏实实" steady |

## 4. Post-Questionnaire: Reverse Validation

After the 8 DISC questions, instead of asking verbosity preference:
1. Randomly pick one of Q1-Q8's scenario
2. Rephrase the same scenario with different wording
3. Present 4 options (same DISC mapping, different text)
4. Score normally (Primary +1, Secondary +0.5)
5. Compare with original answer:
   - Consistent -> confidence unchanged
   - Inconsistent -> confidence -= 1 level, probe priority increased

Verbosity signal is now obtained through Phase 1 probing instead.

## 5. Scoring Rules

### Phase A (Current Implementation)
- Each question: selected option's Primary axis +1, Secondary axis +0.5
- Total possible per axis: 8 (primary) + 4 (secondary) = 12
- Primary type = highest total score
- Secondary type = second highest total score
- Confidence levels:
  - high: Primary - Secondary >= 2.0
  - medium: 1.0 <= gap < 2.0
  - low: gap < 1.0
- Tie-breaking: if Primary tied, use sub-score from work-scene questions (higher weight)

### Phase B (Future, data-calibrated)
- Secondary weight optimized via regression on probe data (100+ users)
- Confidence thresholds recalibrated

## 6. Review Recommendations

| # | Recommendation | Priority | Status |
|---|---------------|----------|--------|
| R1 | Position as "DISC-inspired behavioral style classification" | High | Pending implementation |
| R2 | Q7-A wording micro-adjustment (optional) | Low | Deferred |
| R3 | English version needs independent cultural review | Medium | Phase 4 |
| R4 | Record randomized option order in config.json | Accepted | Pending implementation |
| R5 | Consider "Creative" as I-type sub-label | Low | Deferred |

## 7. Structure Summary

| # | Scene | Domain | Option Style |
|---|-------|--------|-------------|
| Q1 | Deadline | Work | Behavior |
| Q2 | Stuck | Work | Behavior |
| Q3 | Collaboration | Work | Behavior |
| Q4 | Casual Chat | Daily | Trait |
| Q5 | Learning | Daily | Trait |
| Q6 | Life Choice | Daily | Trait |
| Q7 | Under Pressure | Emotion | Trait |
| Q8 | Good News | Emotion | Trait |
