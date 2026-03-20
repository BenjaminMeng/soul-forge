# Soul Forge Telemetry Server — Contabo 部署指南

## 前提
- Contabo VPS (Ubuntu/Debian)
- Node.js 18+ 已安装
- nginx 已安装（用于 SSL 反向代理）

## 部署步骤

### 1. 上传文件
```bash
scp -r telemetry-server/ root@89.117.23.59:/opt/soul-forge-telemetry/
```

### 2. 安装依赖
```bash
ssh root@89.117.23.59
cd /opt/soul-forge-telemetry
npm install --production
```

### 3. 配置环境变量
```bash
cat > /opt/soul-forge-telemetry/.env << 'EOF'
PORT=9091
API_KEY=你的API密钥
DB_PATH=/opt/soul-forge-telemetry/data/telemetry.db
EOF
```

### 4. 创建 systemd 服务
```bash
cat > /etc/systemd/system/sf-telemetry.service << 'EOF'
[Unit]
Description=Soul Forge Telemetry Server
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/node /opt/soul-forge-telemetry/server.js
WorkingDirectory=/opt/soul-forge-telemetry
EnvironmentFile=/opt/soul-forge-telemetry/.env
Restart=always
RestartSec=5
User=www-data

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable sf-telemetry
systemctl start sf-telemetry
systemctl status sf-telemetry
```

### 5. nginx 反向代理（SSL）
```bash
cat > /etc/nginx/sites-available/sf-telemetry << 'EOF'
server {
    listen 9090 ssl;
    server_name 89.117.23.59;

    ssl_certificate /etc/ssl/certs/sf-telemetry.pem;
    ssl_certificate_key /etc/ssl/private/sf-telemetry-key.pem;

    location / {
        proxy_pass http://127.0.0.1:9091;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

ln -s /etc/nginx/sites-available/sf-telemetry /etc/nginx/sites-enabled/
```

### 6. 生成自签证书（或用 Let's Encrypt）
```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/sf-telemetry-key.pem \
  -out /etc/ssl/certs/sf-telemetry.pem \
  -subj "/CN=89.117.23.59"

nginx -t && systemctl reload nginx
```

### 7. 开放防火墙端口
```bash
ufw allow 9090/tcp
```

### 8. 验证
```bash
# 本地测试
curl -s http://127.0.0.1:9091/health

# 外部测试（从你的开发机）
curl -sk https://89.117.23.59:9090/health

# 写入测试
curl -sk -X POST https://89.117.23.59:9090/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"anon_id":"test123","_schema":"test","soul_forge_version":"3.1.0"}'

# Dashboard（需要 API key）
curl -sk https://89.117.23.59:9090/api/dashboard \
  -H "Authorization: Bearer 你的API密钥"

# 5 维度分析
curl -sk https://89.117.23.59:9090/api/analysis \
  -H "Authorization: Bearer 你的API密钥"
```
