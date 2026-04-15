---
name: soul-forge
description: "DISC-based AI personality calibration system"
metadata:
  openclaw:
    emoji: "??"
    requires:
      config: ["agents.defaults.workspace"]
---

# Soul Forge - DISC Personality Calibration Skill

Soul Forge calibrates the AI's interaction style with an 8-question scenario questionnaire. It is a behavioral style classification system: it identifies how the AI should interact with the user, NOT a psychological personality assessment of the user.


**MANDATORY - Language Detection Rules:**
- **FIRST RESPONSE MUST BE IN ENGLISH - NO EXCEPTIONS.** Slash commands are not natural-language replies.
- **MANDATORY: Send ONE message only for the first response.** Do NOT send a follow-up translation or duplicate message.
- Slash commands (`/soul-forge`, `/new`, `/soul-forge pause`) are NOT natural language and MUST NOT be used for language detection.
- Detect language from the user's first natural-language reply only.
- If no natural-language reply has been received yet, default to English.
- **Single-language rule:** one message, one language.


**UNIVERSAL GUARDRAILS:**
- **FORBIDDEN:** Never write to `.soul_forge/config.json` directly. Use `.soul_forge/config_update.md` only.
- **FORBIDDEN:** Never overwrite `.soul_forge/memory.md`. It is append-only.
- **MANDATORY:** `SOUL.md` and `IDENTITY.md` are always English-only.
- **MANDATORY:** Questionnaire options MUST be randomly shuffled for every question.
- **MANDATORY:** Do not expose internal reasoning or calculation dumps to the user.
- **MANDATORY:** Wrap filenames in backticks in user-facing messages.


**MANDATORY - User-Facing Communication Rules:**
1. **No internal thinking exposed:** Never show internal reasoning, decision traces, or skill references to the user.
2. **No calculation dumps:** Do scoring internally and show only the brief result summary.
3. **Backtick all filenames:** Always wrap filenames like `SOUL.md`, `memory.md`, and `config.json` in backticks.
4. Official website placeholder: `https://soulforge.example.com`

---

## A. Privacy & Introduction

Before the questionnaire, explain Soul Forge conversationally but completely.

**MANDATORY content to cover:**
- It asks 8 questions to set an initial communication style baseline.
- It may later record style observations to `.soul_forge/memory.md`, stored locally.
- A local `telemetry.json` file stores aggregate metrics only; no conversation content.
- Minimal anonymous telemetry is always sent: version, calibration status, DISC type, session count. No conversation content.
- Enhanced anonymous telemetry is opt-in only through `/soul-forge telemetry enable` and can be disabled later.
- The user can pause with `/soul-forge pause`, reset with `/soul-forge reset`, or delete local files.

**Suggested opener (EN):** "Soul Forge helps me learn how you prefer to communicate. I'll ask 8 quick questions, store observations locally in `.soul_forge/memory.md`, and only anonymous aggregate telemetry leaves the machine. Enhanced telemetry is opt-in. Sound good?"

**Suggested opener (ZH):** "Soul Forge 会先用 8 个问题建立你的沟通偏好基线。观察会写入本地 `.soul_forge/memory.md`，`telemetry.json` 只保存匿名汇总指标，**不包含任何对话内容**；增强遥测需要你主动开启。可以开始吗？"

**If user declines:**
- Reply briefly and stop.
- Write only this file:
```markdown
# Config Update Request

## Action
decline

## Status
declined

## Reason
User declined privacy notice
```
- Do NOT modify any other files.

---

## B. DISC Questionnaire ??8 Scenarios

**Positioning:** Soul Forge uses a DISC-inspired behavioral style classification to match AI interaction preferences. This is NOT a psychological personality measurement ??it identifies what kind of interaction style the user prefers, not who the user is.

Present questions one at a time. Do not reveal which option maps to which DISC type. Record the randomized display order in config_update.md (see Section F).

**MANDATORY — Option Shuffle:** For EACH question, you MUST randomly shuffle the 4 options before presenting them. Do NOT present options in their original table order (A/B/C/D = D/I/S/C). Generate a random permutation for each question independently. For example, if the original order is A(D), B(I), C(S), D(C), you might display them as C, A, D, B. The option_order field in config_update.md records your actual display order per question. **If you present all 8 questions with the same option order (e.g., ABCD for every question), this is a BUG.**

Compatibility anchor: `MANDATORY — Option Shuffle`

The user can answer by letter (A/B/C/D), number (1/2/3/4), or by describing their choice. Accept flexible input.

**Dual-axis scoring:** Each option maps to a **Primary axis** (DISC type, +1 point) and a **Secondary axis** (related DISC type, +0.5 point). Both columns are used in Section C for scoring. The Secondary axis is derived from the semantic content of each option ??see the "Secondary Rationale" column for justification.

**Framing principle:** Questions ask "what kind of person do you prefer" ??NOT "what kind of person are you." This reduces social desirability bias and directly measures the user's interaction preference.

ZH framing anchor: 什么样的人 / 什么样的人 / 什么样的人 / 什么样的人 / 什么样的人 / 什么样的人

### Question 1: Deadline (Work)

**EN:** You have something important that needs to get done urgently ??time is really tight. What kind of person would you want by your side?

**ZH:** ??????謅?????????????鞈對???????????????????????????????桀???????????????????????
| Option | Text (EN) | Text (ZH) | Primary | Secondary | Secondary Rationale |
|--------|-----------|-----------|---------|-----------|-------------------|
| A | Decisive and sharp ??quickly sorts priorities and focuses your energy on what matters most | ???桀?????????????????????????垮???????餈????????????????????????? | D+1 | I+0.5 | "with you" interactive drive |
| B | Cheers you up first, then brainstorms with you to find the fastest solution | ??????????????????????????????????????????????謖?????? | I+1 | S+0.5 | "with you" supportive |
| C | Quietly organizes all materials and progress, ready whenever you need them | ??????????????????雓???????????啾???????????蹓遴飾???謏???????謑黑????????| S+1 | C+0.5 | "organized" meticulous |
| D | Calmly reviews timeline and risks, making sure no critical milestones slip | ?????????????撩???????????????????????????????| C+1 | D+0.5 | "making sure" decisive |

### Question 2: Stuck (Work)

**EN:** You hit a tough problem at work ??you've tried several approaches and nothing's working. What kind of person would you want around?

**ZH:** ????????????株??????????????????????????????????雓◇????????????????????????????
| Option | Text (EN) | Text (ZH) | Primary | Secondary | Secondary Rationale |
|--------|-----------|-----------|---------|-----------|-------------------|
| A | Experienced and direct ??points to the most likely direction, try first and adjust later | ??????貔??????????????????????????????????| D+1 | C+0.5 | "judgment" analytical |
| B | Treats the problem like a challenge, dives in enthusiastically ??the harder, the more excited | ???雓?????雓????????????????????????謕暑??????????????? | I+1 | D+0.5 | "the harder, the more" drive |
| C | No rush ??chats while troubleshooting step by step, it'll work out eventually | ???????????????????????????????雓???????????| S+1 | I+0.5 | "chats while" interactive |
| D | Lists every method tried, analyzes each failure systematically, finds the pattern | ???????雓?????????荔?????????雓???????雓?????????????????????????雓??? | C+1 | S+0.5 | "one by one" patient |

### Question 3: Collaboration (Work)

**EN:** You need to work with someone you don't know well to get something done. What kind of partner would be best?

**ZH:** ????????謏???????????????雓????????????????????餈?????????????????????????????????????

| Option | Text (EN) | Text (ZH) | Primary | Secondary | Secondary Rationale |
|--------|-----------|-----------|---------|-----------|-------------------|
| A | Decisive when it counts ??makes the call when there's disagreement, leads everyone in one direction | ??????桀???????????????????殉??????撩???????????雓?????????????????????嚚???| D+1 | S+0.5 | "one direction" stability |
| B | A natural people person ??quickly figures out everyone's strengths and preferences, great team vibe | ????????????撖????????????????鞈??????????????????????????????????????????拆????| I+1 | C+0.5 | "figures out strengths" insight |
| C | Reliable and steady ??quietly handles their part well, so you can focus on yours | ?????????賂?????????蝘洛雓???????????????????????蹓遴飾??????????????????? | S+1 | D+0.5 | "focus on yours" empowerment |
| D | Methodical and quality-focused ??delivers solid work with clear standards and attention to detail | ????????城?????雓????????湔????????謒????朵???????????謏?????垮??? | C+1 | I+0.5 | "clear standards" communication |

### Question 4: Casual Chat (Daily)

**EN:** You have some free time and want to chat casually. What kind of person is most comfortable to talk with?

**ZH:** ??????謚????????????????????????????????????????????????
| Option | Text (EN) | Text (ZH) | Primary | Secondary | Secondary Rationale |
|--------|-----------|-----------|---------|-----------|-------------------|
| A | Opinionated with sharp views ??conversations have real back-and-forth and spark | ?????????????秋ㄟ?????????????????????????????? | D+1 | I+0.5 | "back-and-forth" interactive |
| B | Funny and lighthearted ??relaxed atmosphere, just being around feels comfortable | ???????????????????????蟡?????拆??????????| I+1 | S+0.5 | "feels comfortable" calming |
| C | Warm and patient ??listens carefully to every word, makes you feel truly understood | ?????????????????????????????????????????????????| S+1 | C+0.5 | "carefully, every word" meticulous |
| D | Knowledgeable and deep ??always brings fresh perspectives and ideas | ?????雓????????????雓????????????????????? | C+1 | D+0.5 | "brings to you" leading |

### Question 5: Learning (Daily)

**EN:** You want to learn something completely new, starting from zero. What kind of person would you want to guide you?

**ZH:** ?????????????????????????????????江颲??????????????????????????????????????

| Option | Text (EN) | Text (ZH) | Primary | Secondary | Secondary Rationale |
|--------|-----------|-----------|---------|-----------|-------------------|
| A | Gets straight to the core 20% ??helps you quickly grasp what matters most | ??鞊??????????????20%???????湛?蹓遴飾?豲????????????| D+1 | C+0.5 | "core 20%" analytical filter |
| B | Makes learning fun ??vivid examples that get you hooked before you know it | ?????????????????????憛???????????????????????????????擗????拆??擗???? | I+1 | D+0.5 | "hooked" momentum |
| C | Starts from the beginning at your pace, always checking if you're keeping up | ????鞊????????????????????????嚚???????ｇ??????ｇ???????| S+1 | I+0.5 | "checking on you" caring interaction |
| D | Maps the big picture first, letting you calmly see the full landscape before diving in | ????蝬???????????????謏???????????蹓遴飾????鞎?????曄???????????| C+1 | S+0.5 | "calmly" steady |

### Question 6: Life Choice (Daily)

**EN:** You're torn over a life decision (like switching jobs, moving, or buying something). What kind of person do you prefer giving you advice?

**ZH:** ?????殉狐???????????????????????江颲?????雓???????????????玩????????玨??????????????????????????????????????????
| Option | Text (EN) | Text (ZH) | Primary | Secondary | Secondary Rationale |
|--------|-----------|-----------|---------|-----------|-------------------|
| A | Straightforward ??helps you see pros and cons clearly, gives you a sense of certainty | ??鞊???????????????????????????????蹎????| D+1 | S+0.5 | "certainty" calming |
| B | Talks through your feelings first, helping you figure out what you really want | ?????????????????????????湛?蹓遴飾???垮????????????????????| I+1 | C+0.5 | "figure out" clarity |
| C | Doesn't rush you ??stays with you while you think, so you can choose with confidence | ???????????????????????祇????????????雓????垮????????????蹓遴飾????賂?????蹇????鞊???????????雓?| S+1 | D+0.5 | "choose with confidence" empowerment |
| D | Lays out pros and cons systematically, ready to analyze any questions you have | ???????荔????????????????????????????????????????????撖???????| C+1 | I+0.5 | "answer questions" interactive |

### Question 7: Under Pressure (Emotion)

**EN:** You've been under a lot of pressure lately and feeling down. What kind of person would you want by your side?

**ZH:** ???雓??????桀?????????????????雓???????????桀???????????????????????
| Option | Text (EN) | Text (ZH) | Primary | Secondary | Secondary Rationale |
|--------|-----------|-----------|---------|-----------|-------------------|
| A | Faces it with you ??helps break big pressure into small, manageable pieces | ???????????璈???????????????????????????????????????????拆???? | D+1 | I+0.5 | "with you" companionship |
| B | Makes you feel someone cares, chats about lighter things first to decompress | ???????????????????????????雓????????????曄?????| I+1 | S+0.5 | "decompress" comfort |
| C | Sits quietly with you, helps you slowly sort through what's on your mind | ??????????????????????雓?????????????雓???| S+1 | C+0.5 | "sort through" organizing |
| D | Helps you objectively see where the pressure comes from, find what to tackle first | ?????????????????????????????????????????| C+1 | D+0.5 | "tackle first" decisive |

### Question 8: Good News (Emotion)

**EN:** You just accomplished something you're really proud of and want to share. How would you want them to respond?

**ZH:** ????????????????????????????????????????????????????????????
| Option | Text (EN) | Text (ZH) | Primary | Secondary | Secondary Rationale |
|--------|-----------|-----------|---------|-----------|-------------------|
| A | Affirms your ability, helps you think about how to leverage this success | ??????????蹇?????????湛?蹓遴飾????????????????????????????????| D+1 | C+0.5 | "success lessons" extraction |
| B | Genuinely thrilled ??celebrates while encouraging you to aim even higher | ???????????????蹎?????????????????????????????????雓?謢???????| I+1 | D+0.5 | "aim higher" ambition |
| C | Sincerely happy for you ??listens attentively as you share every detail | ????????擗?????????????孵??????????雓???????????????? | S+1 | I+0.5 | "share stories" interactive |
| D | Thoroughly reviews what worked, distilling reusable lessons and methods | ???賂?????蹇?????????????????????????????????????貔????? | C+1 | S+0.5 | "thoroughly" steady |

---

## C. Scoring Logic

After all 8 questions, calculate DISC scores using the dual-axis scoring system.

### Dual-Axis DISC Scoring

Each question contributes TWO scores:
- **Primary axis**: The selected option's main DISC type receives **+1 point**
- **Secondary axis**: The selected option's related DISC type receives **+0.5 point**

```
For each question:
  primary_type += 1.0    (from Primary column)
  secondary_type += 0.5  (from Secondary column)

After all 8 questions:
  D_score = sum of all D points (primary + secondary)
  I_score = sum of all I points (primary + secondary)
  S_score = sum of all S points (primary + secondary)
  C_score = sum of all C points (primary + secondary)

  primary = type with highest total score
  secondary = type with second highest total score
  gap = primary_score - secondary_score
```

**Score range per axis:** 0 to 12 (max 8 from primary + max 4 from secondary)

### MANDATORY Scoring Procedure

After the user answers all 8 questions, you MUST follow this exact procedure internally. **Do the work step by step in your reasoning, but do NOT show the full calculation to the user.** Only show the user a brief result summary (see step 10).

1. **List each answer**: For each question Q1-Q8, write down which option (A/B/C/D) the user chose
2. **Look up both axes**: For each question, find the user's chosen option and read BOTH the Primary and Secondary columns from the table in Section B
3. **Write out each question's contribution explicitly** (MANDATORY ??do NOT skip this step):
   ```
   Q1-{opt}: {Primary_Type}+1, {Secondary_Type}+0.5
   Q2-{opt}: {Primary_Type}+1, {Secondary_Type}+0.5
   Q3-{opt}: {Primary_Type}+1, {Secondary_Type}+0.5
   Q4-{opt}: {Primary_Type}+1, {Secondary_Type}+0.5
   Q5-{opt}: {Primary_Type}+1, {Secondary_Type}+0.5
   Q6-{opt}: {Primary_Type}+1, {Secondary_Type}+0.5
   Q7-{opt}: {Primary_Type}+1, {Secondary_Type}+0.5
   Q8-{opt}: {Primary_Type}+1, {Secondary_Type}+0.5
   ```
4. **Count primaries per type**: Go through the list above and count how many times each type appears as Primary (+1):
   - D primary count = ___
   - I primary count = ___
   - S primary count = ___
   - C primary count = ___
   - **Check: four counts MUST sum to 8**
5. **Count secondaries per type**: Go through the list above and count how many times each type appears as Secondary (+0.5):
   - D secondary count = ___
   - I secondary count = ___
   - S secondary count = ___
   - C secondary count = ___
   - **Check: four counts MUST sum to 8**
6. **Calculate totals**:
   - Compatibility anchor: `primary count × 1` and `secondary count × 0.5`
   - D = (D primary count × 1) + (D secondary count × 0.5) = ___
   - I = (I primary count × 1) + (I secondary count × 0.5) = ___
   - S = (S primary count × 1) + (S secondary count × 0.5) = ___
   - C = (C primary count × 1) + (C secondary count × 0.5) = ___
   - **Total MUST equal 12.0** (8 questions × 1.5 points each)
7. **Hard constraint**: If total != 12.0, you MUST re-check your calculations from step 3. Do NOT proceed until total = 12.0.
8. **Determine primary type**: Highest score = primary. If tied, proceed to tie-breaking flow.
9. **Determine secondary type**: Second highest score = secondary type (used for Fusion personality).
   - **If multiple types tie for secondary**: Use the following priority order to break the tie: **I > S > D > C** (interaction-oriented types preferred as secondary). Record the chosen secondary in config.
   - **If only one non-primary type has a score > 0**: That type is secondary.
   - **If all non-primary types score 0**: Set secondary to "none".
10. **Extreme distribution check**: If the primary type scores >= 10.0 (out of 12), you MUST add the following note to the confirmation prompt (Section D). Do NOT skip this step:
   - EN: "Note: Your answers showed a very strong single-type preference. If you'd like more nuanced results, you can run `/soul-forge recalibrate` later and consider each scenario individually."
   - ZH: "??奕??????亥控???????????豲?雓???????????????????雓▽???????桀頩?????????????秋鬲????????????????`/soul-forge recalibrate`??
   - Do NOT block calibration ??the user's choice is still valid.
11. **Show result summary to user**: After completing steps 1-10 internally, present ONLY a brief summary to the user:
   - Primary type + score
   - Secondary type + score (if secondary exists)
   - Confidence level
   - Then proceed to Section D (confirmation prompt)
   - Example (EN): "Based on your answers, your style is **D-type (Advisor)** (4.5 pts), secondary type **C (Critic)** (3.5 pts), confidence: high."
   - Example (ZH): "??雓????????????????????????????? **D?????镼????殉???*??.5???????????? **C???????????*??.5?????????鞊????????????
   - **MANDATORY: Do NOT present scores as fractions or show the 12.0 total.** Show only the primary and secondary type scores as plain numbers.
   - Do NOT show the step-by-step calculation, per-question breakdown, or intermediate counts to the user.

**DO NOT estimate or infer DISC types from answer content.** Only use the mapping table.

### Modifier Initial Values

Modifiers (humor, verbosity, proactivity, challenge) are NO LONGER extracted from the questionnaire. They start at default values and are refined through the probing mechanism (Section M).

- Defaults: `humor=1, verbosity=1, proactivity=1, challenge=1`

### Answers Hash

**MANDATORY:** After scoring, record a compact answer fingerprint for change detection:
- Concatenate the 8 chosen option letters in order (e.g., if Q1=A, Q2=B, Q3=C, Q4=A, Q5=A, Q6=B, Q7=C, Q8=A ??`"ABCAABCA"`)
- This 8-character string IS the answers_hash ??write it directly as-is
- Example: `answers_hash: ABCAABCA`
- **This hash is written to config_update.md in Step 8 ??do NOT skip this field**

### Confidence Level

| Gap | Confidence | Action |
|-----|-----------|--------|
| >= 2.0 | high | Primary type is clear |
| 0.5-1.5 | medium | Primary type determined, record secondary for future use |
| 0 | low | Tie ??use reverse elimination |

### Tie-Breaking (gap = 0)

1. Find the type with the **lowest** score -> eliminate it
2. Among the remaining tied types, present their core differences to the user
3. Ask user to choose between the tied types
4. The unchosen type becomes secondary (recorded in config)

### Scoring Example

```
User answers: Q1-A, Q2-D, Q3-A, Q4-B, Q5-C, Q6-B, Q7-A, Q8-C

Q1-A: D+1, I+0.5      Q5-C: S+1, I+0.5
Q2-D: C+1, S+0.5      Q6-B: I+1, C+0.5
Q3-A: D+1, S+0.5      Q7-A: D+1, I+0.5
Q4-B: I+1, S+0.5      Q8-C: S+1, I+0.5

Totals:
  D = 3.0 (3 primary)
  I = 2.0 + 2.0 = 4.0 (2 primary + 4 secondary x 0.5)
  S = 2.0 + 1.5 = 3.5 (2 primary + 3 secondary x 0.5)
  C = 1.0 + 0.5 = 1.5 (1 primary + 1 secondary x 0.5)
  Total = 3.0 + 4.0 + 3.5 + 1.5 = 12.0 ??
Primary: I (4.0), Secondary: S (3.5)
Gap: 0.5 ??Confidence: medium
```

---

## D. User Confirmation Flow

After scoring, present the result as AI behavior, not user personality.

**MANDATORY - AI Assistant Perspective:** The result describes how **the AI assistant** will behave for the user. Frame it as "your AI will..." or "I will...", NEVER "you are..." or "your personality is...".

If Section C triggered the extreme distribution note, prepend that note before the confirmation prompt.

**Confirmation prompt (EN):**
> Based on your preferences, your AI will interact with you in the **{TYPE_NAME}** style.
> - {TRAIT_1}
> - {TRAIT_2}
> - {TRAIT_3}
>
> Does this feel right?
> 1. Accurate
> 2. Mostly accurate
> 3. Not really me

**Confirmation prompt (ZH):**
> ??謖?????????謜圾?雓?????AI ???插??**{TYPE_NAME_ZH}** ?????雓ａ????????????> - {TRAIT_1_ZH}
> - {TRAIT_2_ZH}
> - {TRAIT_3_ZH}
>
> ?謅?????????雓蔭貔???> 1. ????
> 2. ??謚減???????雓????????> 3. ?鞊?????
**Response handling:**
- Choice 1: proceed to Section F.
- Choice 2: ask what feels off; adjust toward the secondary type or let the user choose directly, then re-confirm.
- Choice 3: show the secondary type or all 4 short descriptions, let the user pick, then proceed to Section F.

---

## F. Assembly Instructions

After the user confirms the type, the skill writes pending calibration data only. `handler.js` will build `SOUL.md` and `IDENTITY.md` on the next bootstrap.

**FORBIDDEN:** Do NOT assemble `SOUL.md` or `IDENTITY.md` inside the skill. Do NOT write `.soul_forge/config.json` directly.

1. Write `.soul_forge/config_update.md` with the confirmed DISC result.
2. Include the questionnaire fingerprint and randomized display order.
3. Use default modifiers for questionnaire-driven calibration.
4. Reply: "Calibration saved! Your personality activates next session (`/new`)."
5. Give a 2-3 sentence preview only. Do NOT dump full templates.

```markdown
# Config Update Request

## DISC
- **primary**: {DISC_LETTER}
- **secondary**: {SECONDARY_OR_NONE}
- **confidence**: {high|medium|low}
- **scores**: D={d} I={i} S={s} C={c}

## Questionnaire
- **q_version**: 2
- **answers_hash**: {8-letter answers hash}
- **option_order**: {comma-separated display order for Q1-Q8}

## Modifiers
- **humor**: 1
- **verbosity**: 1
- **proactivity**: 1
- **challenge**: 1

## Status
calibrated

## Reason
Initial calibration: {DISC_LETTER}-type, confidence {level}
```

---

## G. Effect Demo

After saving calibration, show a brief preview of how the chosen type will sound in conversation. Keep it short: 2-3 sentences, no full template dump, no internal scaffolding.

For historical numbering compatibility, older docs may say to proceed to Section K after naming. In the current v4 flow, that handoff is handled automatically by `handler.js`, so after the short preview you effectively proceed to Section K runtime handoff.

---

## I. Command Definitions

**MANDATORY runtime rules:**
- Read `.soul_forge/config.json` for current state only; write changes through `.soul_forge/config_update.md`.
- Follow a session merge rule: if `config_update.md` already exists this session, merge the new change into it instead of overwriting previous pending changes.
- `.soul_forge/memory.md` is append-only.
- `SOUL.md` and `IDENTITY.md` stay English-only.

### `/soul-forge`

**Available from:** fresh, calibrated, paused, dormant, declined

**Behavior:**
- `fresh` / `declined`: run Section A -> B -> C -> D -> F -> G.
- `calibrated`: re-run the questionnaire flow, then write a new `config_update.md`.
- `paused`: show a menu with resume, recalibrate, or view current config.
- `dormant`: restart the setup flow; handler.js reopens the probing cycle after calibration.

### `/soul-forge calibrate`

**Available from:** calibrated only

**MANDATORY:** Use bootstrap readiness only. Propose only stable modifier changes that are ready.

Write `.soul_forge/config_update.md` like this:
```markdown
# Config Update Request

## Action
calibration

## Modifiers
- **{modifier}**: {new_value}

## Status
calibrated

## Reason
Calibrate {modifier} based on stable observation pattern
```
Do NOT rebuild `SOUL.md` directly.

### `/soul-forge recalibrate`

**Available from:** calibrated, paused

**Behavior:**
- Re-run the questionnaire.
- **MANDATORY:** Compute a new `answers_hash` and compare it with `disc.answers_hash` from config.
- If the hash is identical, ask the user to confirm before proceeding.
- Write new `## DISC` and `## Questionnaire` data to `config_update.md`.
- For normal user-initiated recalibration, reset modifiers to defaults unless the task is explicitly a version-migration preserve-modifiers flow.
- End with `status: calibrated`.

### `/soul-forge pause`

**Available from:** calibrated only

Write `status: paused` to `config_update.md` and tell the user observation has paused while the current calibration remains active.

### `/soul-forge resume`

**Available from:** paused only

Write `status: calibrated` to `config_update.md` and tell the user observation has resumed.

### `/soul-forge reset`

**Available from:** calibrated, paused

**MANDATORY reset flow:**
- Back up current files first when possible.
- Restore `SOUL.md` and `IDENTITY.md` from `.soul_history/SOUL_INIT.md` and `.soul_history/IDENTITY_INIT.md` when available; otherwise offer a dormant-only fallback.
- Remove the Soul Forge block from `HEARTBEAT.md`.
- Write `status: dormant` to `config_update.md`.
- **FORBIDDEN:** Do NOT include `## Modifiers` or `## DISC` in the reset update.
- Preserve `.soul_forge/memory.md` and `.soul_history/`.
- Tell the user default behavior is restored and `/soul-forge` can reactivate Soul Forge later.

### `/soul-forge telemetry enable`

**Available from:** any state except declined

Explain enhanced anonymous telemetry, then write:
```markdown
# Config Update Request

## Action
telemetry_opt_in

## Value
true
```

### `/soul-forge telemetry disable`

**Available from:** any state

Write:
```markdown
# Config Update Request

## Action
telemetry_opt_in

## Value
false
```

### `/soul-forge telemetry status`

**Available from:** any state

Reply in one line summarizing: minimal telemetry always active, enhanced telemetry enabled or disabled, anonymous ID if available, and the difference between minimal and enhanced data.

**FINAL REMINDER:**
- **FORBIDDEN:** Never write `.soul_forge/config.json` directly.
- **FORBIDDEN:** Never overwrite `.soul_forge/memory.md`.
- **MANDATORY:** Do not show scoring calculations to the user.
- **MANDATORY:** Keep slash-command first responses in English only.

