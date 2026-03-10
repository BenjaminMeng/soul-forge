# Soul Forge 客户安装操作手册

**用途：** 为朋友远程/现场安装 Soul Forge 时的操作清单
**前提：** 对方已有可用的 OpenClaw 实例

---

## 1. 安装前确认

在对方机器上逐项检查：

```powershell
# 1a. OpenClaw 配置目录存在
Test-Path "$env:USERPROFILE\.openclaw"

# 1b. workspace 目录存在
Test-Path "$env:USERPROFILE\.openclaw\workspace"
```

> hooks 配置无需手动检查 — 安装脚本会自动启用 `hooks.internal.enabled`（R37 #29）。
> 已有的 `openclaw.json` 其他字段会保留，安装前会备份为 `openclaw.before-soulforge.json`。

**如果 workspace 不存在：** OpenClaw 可能从未启动过，让对方先正常使用一次再安装。

---

## 2. 打包与传输

在开发机上操作：

```powershell
# 2a. 确认 customer_package 完整性
ls D:\Coding\OpenClaw_Indiviual_SOUL.md\mvp\customer_package\

# 预期文件清单:
#   .soul_forge/config.json
#   .soul_forge/memory.md
#   .soul_forge/SOUL_INIT.md
#   .soul_forge/IDENTITY_INIT.md
#   hooks/soul-forge-bootstrap/HOOK.md
#   hooks/soul-forge-bootstrap/handler.js
#   skills/soul-forge/SKILL.md
#   HEARTBEAT_SEGMENT.md
#   Install.ps1
#   Setup.bat              ← 双击入口
#   README.txt

# 2b. 打包为 zip（注意 .soul_forge 隐藏目录）
Compress-Archive -Path "D:\Coding\OpenClaw_Indiviual_SOUL.md\mvp\customer_package\*" -DestinationPath "$env:USERPROFILE\Desktop\SoulForge_Install.zip" -Force

# 2c. 验证 zip 内容完整（特别是 .soul_forge/）
Expand-Archive "$env:USERPROFILE\Desktop\SoulForge_Install.zip" -DestinationPath "$env:TEMP\sf_verify" -Force
ls "$env:TEMP\sf_verify\.soul_forge\"
# 确认 4 个文件存在后清理
Remove-Item "$env:TEMP\sf_verify" -Recurse -Force
```

传输方式：微信文件 / 网盘链接 / U 盘均可。

---

## 3. 安装执行

在对方机器上操作：

### 方式 A：双击 Setup.bat（推荐，非技术用户友好）

```
1. 解压 SoulForge_Install.zip 到任意目录
2. 双击 Setup.bat
3. 按任意键开始安装
4. 确认输出末尾显示 "Installation successful!"
5. 按任意键关闭窗口
```

> Setup.bat 内部自动处理 ExecutionPolicy，无需手动开 PowerShell。
> hooks.internal.enabled 会自动启用，无需手动编辑 openclaw.json。

### 方式 B：PowerShell 手动执行（需要 dry-run 预览时）

```powershell
# 3a. 解压到任意临时目录
Expand-Archive "SoulForge_Install.zip" -DestinationPath "$env:TEMP\SoulForge"

# 3b. 预览（dry-run，不写任何文件）
cd "$env:TEMP\SoulForge"
.\Install.ps1 -WhatIf

# 3c. 确认输出无 ERROR 后，正式安装
.\Install.ps1

# 3d. 确认输出末尾显示:
#   "Installation successful!"
#   所有文件 OK（非 0 bytes）
```

---

## 4. 重启服务

根据对方的部署方式选择：

```powershell
# Docker 部署
docker compose down && docker compose up -d

# 本地部署
# 重启 gateway 进程（具体命令取决于对方的启动方式）
```

---

## 5. 安装后验证

```powershell
# 5a. 检查 hook 加载
# Docker: docker logs <container> 2>&1 | Select-String "hook handlers"
# 预期: "loaded 4 internal hook handlers"（不是 3）

# 5b. Telegram 功能验证
# 发送: /soul-forge
# 预期: 看到隐私提示（Privacy Notice），而非 AI 自行编造的回复

# 5c. 同意隐私提示后
# 预期: 出现 8 道 DISC 场景题

# 5d. 完成问卷后
# 预期: 显示 DISC 类型结果 + 个性化描述
```

**如果 5a 显示 3 而非 4：** hook 未加载。检查：
- `~/.openclaw/hooks/soul-forge-bootstrap/` 目录是否存在且含 HOOK.md + handler.js
- `openclaw.json` 中 hooks.internal.enabled 是否为 true（安装脚本应已自动启用，若仍为 false 需排查安装日志 `install_log.txt`）
- 重启后重新检查日志

**如果 5b 返回 AI 编造的回复：** skill 未加载。检查：
- `~/.openclaw/skills/soul-forge/SKILL.md` 是否存在且非空

---

## 6. 出问题时的回滚

如需完全卸载 Soul Forge，删除以下目录/文件：

```powershell
# 删除 skill
Remove-Item "$env:USERPROFILE\.openclaw\skills\soul-forge" -Recurse -Force

# 删除 hook
Remove-Item "$env:USERPROFILE\.openclaw\hooks\soul-forge-bootstrap" -Recurse -Force

# 删除运行时数据
Remove-Item "$env:USERPROFILE\.openclaw\workspace\.soul_forge" -Recurse -Force

# 删除 INIT 模板
Remove-Item "$env:USERPROFILE\.openclaw\workspace\.soul_history\SOUL_INIT.md" -Force
Remove-Item "$env:USERPROFILE\.openclaw\workspace\.soul_history\IDENTITY_INIT.md" -Force

# 如果安装时有备份，恢复原始文件
$hist = "$env:USERPROFILE\.openclaw\workspace\.soul_history"
$ws   = "$env:USERPROFILE\.openclaw\workspace"
if (Test-Path "$hist\SOUL_BEFORE_SOULFORGE.md")      { Copy-Item "$hist\SOUL_BEFORE_SOULFORGE.md" "$ws\SOUL.md" -Force }
if (Test-Path "$hist\IDENTITY_BEFORE_SOULFORGE.md")   { Copy-Item "$hist\IDENTITY_BEFORE_SOULFORGE.md" "$ws\IDENTITY.md" -Force }
if (Test-Path "$hist\HEARTBEAT_BEFORE_SOULFORGE.md")  { Copy-Item "$hist\HEARTBEAT_BEFORE_SOULFORGE.md" "$ws\HEARTBEAT.md" -Force }

$oc = "$env:USERPROFILE\.openclaw"
if (Test-Path "$oc\openclaw.before-soulforge.json") { Copy-Item "$oc\openclaw.before-soulforge.json" "$oc\openclaw.json" -Force }

# 重启服务
docker compose down && docker compose up -d
```

---

## 快速参考

| 步骤 | 关键检查点 |
|------|-----------|
| 安装前 | `.openclaw/` 和 `workspace/` 存在（hooks 无需手动配置） |
| 打包 | zip 包含 `.soul_forge/`（4 个文件）+ `Setup.bat` |
| 安装 | 双击 Setup.bat 或 `.\Install.ps1`，输出 "Installation successful!" |
| 重启 | 日志显示 "loaded **4** internal hook handlers" |
| 验证 | `/soul-forge` → 隐私提示 → 8 题问卷 → DISC 结果 |
| 回滚 | 删 3 个目录 + 恢复 backup + 重启 |
