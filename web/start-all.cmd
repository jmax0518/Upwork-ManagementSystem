@echo off
cd /d "%~dp0"
start "Upwork Web Dev" cmd /k "%~dp0start-dev.cmd"
timeout /t 3 /nobreak >nul
start "Upwork Ngrok Tunnel" cmd /k "%~dp0start-tunnel.cmd"
