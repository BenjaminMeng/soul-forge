# Soul Forge — HEARTBEAT.md Segment

> **Instructions:** Copy the content below (including the HTML comment markers)
> and append it to your workspace `HEARTBEAT.md` file.

---

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
    - **type**: companion|relationship|exemplar_candidate|style|emotion|boundary|decision
    - **signal**: (exact quote or behavior observed)
    - **inference**: (what it implies about preferences)
    - **modifier_hint**: (which modifier: verbosity/humor/challenge/proactivity, direction: raise/lower)
    - **status**: active
    - **importance**: high|medium|low
  If ALL neutral → skip silently

- Check the "Calibration Readiness" section in your bootstrap context
  (injected by soul-forge-bootstrap hook, NOT in memory.md).
  If any modifier shows "READY", suggest user run /soul-forge calibrate
  (max once per day). Do NOT read memory.md for counting.
<!-- SOUL_FORGE_END -->
