#!/bin/bash
set -e

echo "=== Updating Mizaniat BI ==="
cd /opt/mizaniat

echo "1. Pulling latest changes from main branch..."
git fetch origin main
git reset --hard origin/main

echo "2. Installing dependencies..."
npm install

echo "3. Building client..."
npm run build

echo "4. Restarting PM2 process..."
pm2 restart mizaniat

echo "=== UPDATE COMPLETE ==="
