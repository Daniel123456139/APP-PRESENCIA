@echo off
cd /d "%~dp0"
echo Iniciando Aplicacion...
start http://localhost:3000
npm run dev
pause