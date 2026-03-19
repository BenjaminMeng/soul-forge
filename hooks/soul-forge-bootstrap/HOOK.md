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
2. Reads Soul Forge configuration and observation data
3. Computes calibration readiness from observation aggregates
4. Injects a calibration context file into the Agent's bootstrap context
5. Checks and repairs HEARTBEAT.md Soul Forge segment if missing
6. Checks and repairs SOUL.md structure if damaged
