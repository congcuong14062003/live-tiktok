@echo off
chcp 65001 >nul
cd /d "%~dp0"
title AI Moi Ngay - Quiz LIVE 8094
if not exist "%~dp0runtime\node.exe" (
  echo Khong tim thay runtime\node.exe.
  pause
  exit /b 1
)
set "PORT=8094"
echo.
echo Trang dieu khien: http://127.0.0.1:8094/admin.html
echo Man hinh live:   http://127.0.0.1:8094/live.html
echo Dung Ctrl+C de tat server nay.
echo.
"%~dp0runtime\node.exe" server.js
pause
