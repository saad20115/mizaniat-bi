#!/bin/bash
set -e
echo "=== Mizaniat BI VPS Setup ==="

# 1. Install dependencies
echo "[1/7] Installing system packages..."
apt update -qq 2>&1 | tail -1
apt install -y -qq curl git build-essential python3 nginx 2>&1 | tail -3

# 2. Install Node.js 20
echo "[2/7] Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>&1 | tail -1
  apt install -y -qq nodejs 2>&1 | tail -1
fi
echo "Node: $(node -v) | NPM: $(npm -v)"

# 3. Install PM2
echo "[3/7] Installing PM2..."
npm install -g pm2 2>&1 | tail -1

# 4. Clone repo
echo "[4/7] Cloning repo..."
if [ -d /opt/mizaniat ]; then
  cd /opt/mizaniat && git pull origin main
else
  git clone https://github.com/saad20115/mizaniat-bi.git /opt/mizaniat
fi
cd /opt/mizaniat

# 5. Install npm deps & build
echo "[5/7] Installing dependencies & building client..."
npm install 2>&1 | tail -3
npm run build 2>&1 | tail -3

# 6. Create data dir
echo "[6/7] Setting up data directory..."
mkdir -p /opt/mizaniat/data

# 7. Setup PM2
echo "[7/7] Starting app with PM2..."
pm2 delete mizaniat 2>/dev/null || true
PORT=3090 pm2 start server/index.js --name mizaniat
pm2 save
pm2 startup systemd -u root --hp /root 2>&1 | tail -1

echo ""
echo "=== SETUP COMPLETE ==="
echo "App running at http://$(hostname -I | awk '{print $1}'):3090"
echo ""
