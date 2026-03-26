# Soul Forge macOS 安装指南

## 前提条件

确保你的 Mac 上已经安装了：

1. **Node.js 18+** (推荐 22 LTS) — https://nodejs.org/ 或 `brew install node`
   ```bash
   node -v   # 应该显示 v18.x.x 或更高（推荐 v22.x.x）
   ```

2. **Git** — 终端输入 `git --version`，如果没有会自动提示安装 Xcode Command Line Tools

---

## 第一步：安装 OpenClaw（如果还没装）

OpenClaw 有两种安装方式，选一种就行：

### 方式 A：npm 直装（推荐，最简单）

```bash
# 1. 全局安装 OpenClaw
npm install -g openclaw@latest

# 2. 运行初始化向导（会自动创建后台服务）
openclaw onboard --install-daemon

# 3. 启动网关
openclaw gateway --port 18789

# 4. 打开浏览器访问 http://127.0.0.1:18789/
#    把终端显示的 token 粘贴到 Control UI 设置里
```

### 方式 B：Docker（如果你已经有 Docker Desktop）

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
export OPENCLAW_IMAGE="ghcr.io/openclaw/openclaw:latest"
./docker-setup.sh
```

### 配置 Telegram Bot（两种方式通用）

```bash
# 1. 在 Telegram 里找 @BotFather
# 2. 发送 /newbot，按提示创建一个 bot
# 3. 你会得到一个 token，格式类似：123456789:ABCdefGHIjklMNOpqrsTUVwxyz

# 4. 添加 Telegram 频道
#    npm 方式：
openclaw channels add --channel telegram --token "你的BOT_TOKEN"

#    Docker 方式：
docker compose run --rm openclaw-cli channels add --channel telegram --token "你的BOT_TOKEN"
```

### 验证 OpenClaw 正常运行

```bash
# 检查健康状态
curl -fsS http://127.0.0.1:18789/healthz

# 在 Telegram 里给你的 bot 发一条消息，看是否有回复
```

---

## 第二步：安装 Soul Forge

OpenClaw 运行正常后，安装 Soul Forge：

```bash
# 1. 克隆 Soul Forge
git clone https://github.com/BenjaminMeng/soul-forge.git
cd soul-forge

# 2. 运行安装器（纯 Node.js，Mac 直接可用）
node installer.js

# 3. 重启 OpenClaw 使 Soul Forge 生效
#    npm 方式：
openclaw gateway restart
#    或者手动停止再启动：Ctrl+C 停止，然后重新运行 openclaw gateway --port 18789

#    Docker 方式：
#    docker compose down && docker compose up -d
```

### 验证 Soul Forge 安装成功

检查安装器输出，应该看到所有文件都是 `OK`：
```
  OK    Skill SKILL.md (xxxxx bytes)
  OK    Hook HOOK.md (xxx bytes)
  OK    Hook handler.js (xxxxx bytes)
  ...
  Installation successful!
```

然后在 Telegram 里给你的 bot 发送：

```
/soul-forge
```

如果看到隐私说明和问卷提示，就说明安装成功了！

---

## 常见问题

### Q: `node installer.js` 报错 "OpenClaw config not found"
A: OpenClaw 的配置目录应该在 `~/.openclaw/`。检查：
```bash
ls ~/.openclaw/
```
如果不存在，说明 OpenClaw 没有正确安装。重新运行 `openclaw onboard --install-daemon`。

### Q: `npm install -g openclaw@latest` 权限报错
A: Mac 上全局安装可能需要权限：
```bash
sudo npm install -g openclaw@latest
```
或者用 nvm 管理 Node.js（推荐，不需要 sudo）。

### Q: Node.js 版本太低
A: OpenClaw 要求 Node.js 18+（推荐 22 LTS）。检查并升级：
```bash
node -v
# 如果低于 18，升级：
brew upgrade node
# 或者去 https://nodejs.org/ 下载最新 LTS 版本
```

### Q: 重启后 bot 没反应
A: 确认网关在运行：
```bash
# npm 方式
openclaw gateway probe

# Docker 方式
docker compose ps
```

### Q: 安装器提示缺少文件
A: 确保你在 `soul-forge` 目录里运行：
```bash
pwd  # 应该显示 .../soul-forge
ls skills/  # 应该能看到 soul-forge/ 目录
```

---

## 安装完成后

1. 在 Telegram 发送 `/soul-forge` 开始人格校准
2. 回答 8 个场景问题（中英双语）
3. 确认你的 DISC 类型
4. 之后正常聊天，Soul Forge 会在后台持续学习和优化

有任何问题随时联系我！
