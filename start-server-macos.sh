#!/bin/bash
#
# MelodyFlow Music - 一键部署脚本 (macOS)
# 使用方法: ./start-server-macos.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MUSIC_DIR="$SCRIPT_DIR/music-server"
USER_DIR="$SCRIPT_DIR/user-server"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}   MelodyFlow Music 部署脚本${NC}"
echo -e "${CYAN}   适用平台: macOS${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# ===== 1. 检测 Node.js =====
echo -e "[1/7] ${YELLOW}检测 Node.js ...${NC}"
if ! command -v node &> /dev/null; then
    echo ""
    echo -e "${RED}[错误] 未检测到 Node.js${NC}"
    echo ""
    echo "请先安装 Node.js:"
    echo "  https://nodejs.org/zh-cn/"
    echo ""
    echo "推荐使用 Homebrew 安装:"
    echo "  brew install node"
    echo ""
    exit 1
fi

NODE_EXE=$(command -v node)
NODE_VER=$(node --version)
echo -e "  已找到: ${GREEN}$NODE_EXE${NC} $NODE_VER"

# ===== 2. 检测局域网 IP =====
echo ""
echo -e "[2/7] ${YELLOW}检测局域网 IP ...${NC}"
LAN_IP=$(ifconfig | grep 'inet ' | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
if [ -z "$LAN_IP" ]; then
    LAN_IP="127.0.0.1"
fi
echo -e "  局域网 IP: ${GREEN}$LAN_IP${NC}"

# ===== 3. 安装音乐服务依赖 =====
echo ""
echo -e "[3/7] ${YELLOW}安装音乐服务依赖（npmmirror 镜像）...${NC}"
cd "$MUSIC_DIR"
if [ ! -d "node_modules" ]; then
    echo "  首次运行，正在安装..."
    npm install --registry=https://registry.npmmirror.com || \
    npm install --registry=https://registry.npmmirror.com --legacy-peer-deps
else
    echo -e "  依赖已就绪"
fi

# ===== 4. 安装用户服务依赖 =====
echo ""
echo -e "[4/7] ${YELLOW}安装用户服务依赖（npmmirror 镜像）...${NC}"
cd "$USER_DIR"
if [ ! -d "node_modules" ]; then
    echo "  首次运行，正在安装..."
    npm install --registry=https://registry.npmmirror.com || \
    npm install --registry=https://registry.npmmirror.com --legacy-peer-deps
else
    echo -e "  依赖已就绪"
fi

# ===== 5. 检查数据目录 =====
echo ""
echo -e "[5/7] ${YELLOW}检查用户数据目录 ...${NC}"
mkdir -p "$USER_DIR/uploads"
echo -e "  头像目录: ${GREEN}$USER_DIR/uploads${NC}"

# ===== 6. 启动用户服务（后台）=====
echo ""
echo -e "[6/7] ${YELLOW}启动用户服务（端口 3001）...${NC}"
cd "$USER_DIR"
node server.js > /tmp/melodyflow-user.log 2>&1 &
USER_PID=$!
echo -e "  用户服务已启动 (PID: $USER_PID)"

# ===== 7. 启动音乐服务（前台）=====
echo ""
echo -e "[7/7] ${YELLOW}启动音乐服务（端口 3000）...${NC}"
echo ""
echo -e "${CYAN}================================================${NC}"
echo -e "   音乐服务: ${GREEN}http://127.0.0.1:3000${NC}"
echo -e "   用户服务: ${GREEN}http://127.0.0.1:3001${NC}"
echo -e "   局域网 IP: ${GREEN}$LAN_IP${NC}"
echo ""
echo -e "   前端: 直接在浏览器打开 ${GREEN}index.html${NC}"
echo -e "   局域网访问: http://$LAN_IP/项目路径/index.html"
echo ""
echo -e "   注意: 用户服务已在后台运行（端口 3001）"
echo -e "${CYAN}================================================${NC}"
echo ""
echo -e "按 ${RED}Ctrl+C${NC} 停止音乐服务"
echo ""

cd "$MUSIC_DIR"
sleep 1
open "http://127.0.0.1:3000/health" 2>/dev/null || true

# 捕获退出信号，清理后台进程
trap "kill $USER_PID 2>/dev/null; exit" SIGINT SIGTERM

node server.js
