@echo off
title Backend Server ^& User A

echo Starting Backend (Port 5000)...
:: UPDATED: Pointing to the new folder
start "Backend Server" cmd /k "node server/server.js"

echo Starting User A Frontend...
start "User A" cmd /k "npx vite --port 5173"