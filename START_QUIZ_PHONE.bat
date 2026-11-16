@echo off
chcp 65001 >nul
cd /d "%~dp0"
title AI Moi Ngay - Quiz LIVE dien thoai 8094
if not exist "%~dp0runtime\node.exe" (
  echo Khong tim thay runtime\node.exe.
  pause
  exit /b 1
)
set "PORT=8094"
set "QUIZ_HOST=0.0.0.0"
echo.
echo Dong START_QUIZ.bat neu dang chay, roi giu cua so nay mo.
echo Trang dieu khien tren may tinh: http://127.0.0.1:8094/admin.html
echo Dia chi cho dien thoai se hien ben duoi sau khi khoi dong.
echo.
"%~dp0runtime\node.exe" server.js
pause
