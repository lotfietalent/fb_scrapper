@echo off
cd /d "%~dp0"
if not exist logs mkdir logs
echo. >> logs\scraper.log
echo ======================================== >> logs\scraper.log
echo RUN: %DATE% %TIME% >> logs\scraper.log
echo ======================================== >> logs\scraper.log
"C:\Program Files\nodejs\node.exe" src\index.js >> logs\scraper.log 2>&1
