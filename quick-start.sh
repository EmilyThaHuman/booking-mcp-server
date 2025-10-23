#!/bin/bash

echo "🏨 Booking.com MCP Server - Quick Start"
echo "========================================"
echo ""

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
  echo ""
fi

if [ "$1" = "deploy" ]; then
  echo "🚀 Deploying to Cloudflare Workers..."
  npm run build
  wrangler deploy
elif [ "$1" = "dev" ]; then
  echo "💻 Starting local development server..."
  npm run dev
elif [ "$1" = "ngrok" ]; then
  echo "🌐 Starting server and exposing with ngrok..."
  npm run dev &
  SERVER_PID=$!
  sleep 3
  ngrok http 8000
  kill $SERVER_PID
else
  echo "Usage: ./quick-start.sh [command]"
  echo ""
  echo "Commands:"
  echo "  dev     - Start local development server"
  echo "  deploy  - Deploy to Cloudflare Workers"
  echo "  ngrok   - Start server and expose with ngrok"
fi

