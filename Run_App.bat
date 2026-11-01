@echo off
cd /d "%~dp0"
title Math Education Management System

where node >nul 2>nul
if %errorlevel% equ 0 (
    start /b "" node standalone-server.cjs
    timeout /t 2 >nul
    start msedge --app=http://localhost:3000 --start-maximized 2>nul || start chrome --app=http://localhost:3000 --start-maximized 2>nul || start http://localhost:3000
) else (
    start "" "dist\index.html" 2>nul || start "" "index.html"
)
