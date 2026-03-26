# 常见问题

## 安装问题

### Q: `node installer.js` 报错 "OpenClaw config not found"

**A:** 安装器找不到 OpenClaw 配置目录 `~/.openclaw/`。

检查：
```bash
# macOS / Linux
ls ~/.openclaw/

# Windows (PowerShell)
ls $env:USERPROFILE\.openclaw\
```

如果目录不存在，说明 OpenClaw 没有正确完成初始化。重新运行：
```bash
openclaw onboard --install-daemon
```

---

### Q: 安装器报错 "hooks are not enabled"

**A:** OpenClaw 的 Hooks 功能未启用。

修复方法：
```bash
openclaw config set hooks.enabled true
openclaw gateway restart
```

然后重新运行 `node installer.js`。

---

### Q: 安装成功，但发送 `/soul-forge` 后没有任何回应

**A:** 常见原因有三个：

1. **网关没有重启** — 安装后必须重启网关才能加载新的 Skill 和 Hook
   ```bash
   # npm 方式
   openclaw gateway restart
   # Docker 方式
   docker compose down && docker compose up -d
   ```

2. **Hook 未生效** — 检查 Hook 是否已注册：
   ```bash
   openclaw hooks list
   # 应该能看到 soul-forge-bootstrap
   ```

3. **Skill 未生效** — 检查 Skill 是否已注册：
   ```bash
   openclaw skills list
   # 应该能看到 soul-forge
   ```

---

### Q: 安装器提示某些文件大小为 0 或 "MISSING"

**A:** 克隆可能不完整。重新克隆：
```bash
rm -rf soul-forge
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge
node installer.js
```

---

## 使用问题

### Q: 问卷完成后，Soul Forge 的回答风格没有变化

**A:** 校准需要至少一次对话循环才能生效。完成问卷后，正常聊天一两轮，Soul Forge 会在下一次 Bootstrap Hook 触发时应用校准结果。

如果超过 5 轮对话还没有变化，检查 Hook 是否在运行：
```bash
openclaw hooks list
```

---

### Q: 怎么查看当前 DISC 类型

**A:** 发送：
```
/soul-forge status
```

---

### Q: 怎么重新做问卷

**A:** 发送：
```
/soul-forge reset
```

这会清除当前校准数据，下一轮对话时自动触发新一轮问卷。

---

### Q: Soul Forge 会把我的对话内容发到服务器吗

**A:** 不会。Soul Forge 的所有状态数据（DISC 类型、对话观察记录）全部保存在本地 `~/.openclaw/workspace/.soul_forge/` 目录。

Soul Forge 始终会发送一次匿名最小遥测（仅包含匿名安装计数，不含任何对话内容或个人信息）。详细遥测（使用统计等）默认关闭，需要你主动选择开启。

发送 `/soul-forge telemetry status` 可查看当前遥测状态。

---

### Q: 能在多个 Telegram bot 上同时用 Soul Forge 吗

**A:** 当前版本不支持多实例隔离，所有 bot 共享同一份校准状态。多 bot 场景的支持在路线图中，尚未实现。

---

## 更新问题

### Q: 怎么更新到新版本

**A:**
```bash
cd soul-forge
git pull
node installer.js
```

然后重启 OpenClaw 网关。安装器会自动覆盖旧文件，保留已有的 config 数据。

---

### Q: 更新后问卷又重新触发了

**A:** 如果新版本升级了 Schema，会进行数据迁移。迁移通常是静默的，不需要重新做问卷。如果触发了问卷，说明迁移检测到数据不完整，完成一次问卷即可。
