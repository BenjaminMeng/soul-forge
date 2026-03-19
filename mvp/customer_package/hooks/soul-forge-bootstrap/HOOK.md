---
name: soul-forge-bootstrap
description: "Inject Soul Forge calibration context and maintain system integrity on agent bootstrap"
metadata:
  openclaw:
    emoji: "🔥"
    events: ["agent:bootstrap"]
    requires:
      config: ["workspace.dir"]
---

# Soul Forge Bootstrap Hook

This hook runs on every `agent:bootstrap` event. It:

1. Processes any pending `config_update.md` (Agent calibration results → config.json)
2. Performs Pre-flight Check (schema validation + file integrity + version migration)
3. Reads Soul Forge configuration and observation data
4. Computes calibration readiness from observation aggregates
5. Computes probing control state (stage, frequency gate, target modifier)
6. Injects a calibration context file into the Agent's bootstrap context (including Probing Control and Warnings sections)
7. Checks `q_version` compatibility and injects update notice if mismatched
8. Increments `probe_session_count` for probing frequency tracking
9. Checks and repairs HEARTBEAT.md Soul Forge segment if missing
10. Checks and repairs SOUL.md structure if damaged

> **Phase 2 additions (items 2, 5, 7, 8):** See `docs/Soul_Forge_Phase2_Plan.md` for full specification.
