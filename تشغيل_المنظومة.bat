@echo off
chcp 65001 >nul
title منظومة التدبير التربوي لمادة الرياضيات - تشغيل التطبيق
cd /d "%~dp0"

echo ====================================================================
echo   منظومة التدبير التربوي لمادة الرياضيات - السلك الثانوي التأهيلي
echo   إطلاق المنظومة الرقمية...
echo ====================================================================
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo جاري تشغيل الخادم المحلي المدمج...
    start /b "" node standalone-server.cjs
    timeout /t 2 >nul
    start msedge --app=http://localhost:3000 --start-maximized 2>nul || start chrome --app=http://localhost:3000 --start-maximized 2>nul || start http://localhost:3000
) else (
    echo جاري فتح التطبيق مباشرة في المتصفح...
    start "" "dist\index.html" 2>nul || start "" "index.html"
)
