@echo off
cd /d "%~dp0"
echo Starting ngrok tunnel to localhost:3847 ...
node index.js
