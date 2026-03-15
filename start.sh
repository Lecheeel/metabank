#!/bin/bash
echo "=========================================="
echo "  MetaBank - 元宇宙金融养老社区"
echo "  FIT 国脉杯软件设计大赛 · 队伍：冲冲冲"
echo "=========================================="
echo ""

# Install backend dependencies
echo "[1/4] 安装后端依赖..."
cd backend
pip install -r requirements.txt -q 2>/dev/null
cd ..

# Install frontend dependencies
echo "[2/4] 安装前端依赖..."
cd frontend
npm install --legacy-peer-deps --silent 2>/dev/null
cd ..

# Start backend
echo "[3/4] 启动后端服务 (端口 8000)..."
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Start frontend
echo "[4/4] 启动前端服务 (端口 5173)..."
cd frontend
npx vite --host 0.0.0.0 &
FRONTEND_PID=$!
cd ..

echo ""
echo "=========================================="
echo "  MetaBank 已启动！"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:8000"
echo "  API文档: http://localhost:8000/docs"
echo "  管理员: admin / admin123"
echo "=========================================="

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
