@echo off
title Backend Server ^& User A
echo Starting Backend (Port 5000)...
start "Backend Server" cmd /k "node server.js"

echo Starting User A Frontend...
start "User A" cmd /k "npx vite --port 5173"