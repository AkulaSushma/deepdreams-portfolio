@echo off
REM ============================================================
REM  DeepDreams - Build and deploy your website to Cloudflare
REM  Double-click this file. That is all you need to do.
REM ============================================================
title DeepDreams Website Deploy
cd /d "%~dp0"

echo.
echo ==========================================================
echo   DEEPDREAMS WEBSITE DEPLOY
echo ==========================================================
echo.
echo Step 1 of 3: Building your website... (about 1 minute)
echo.

call node netlify\build.js
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Take a screenshot of the red text above
  echo and send it to whoever helps you with the technical side.
  echo.
  pause
  exit /b 1
)

echo.
echo Step 2 of 3: Sending it to Cloudflare... (about 2-3 minutes)
echo.

call npx --yes wrangler@latest pages deploy dist --project-name=deepdreams-portfolio
if errorlevel 1 (
  echo.
  echo ======================================================
  echo   UPLOAD FAILED - most common reason:
  echo   You have not connected this computer to Cloudflare.
  echo.
  echo   FIX: press any key and this window will open a
  echo   browser. Click ALLOW in the browser, then run
  echo   this file again.
  echo ======================================================
  echo.
  pause
  start "" "https://dash.cloudflare.com/authorize?client_id=54d11594-84e4-41ff-bd38-f942bd9307ae&response_type=code&redirect_uri=http%3A%2F%2Flocalhost%3A8977%2Foauth%2Fcallback&scope=offline_access%20user%3Aread%20account%3Aread%20worker_scripts%3Awrite%20workers_kv%3Awrite%20zone%3Aread%20ssl_certs%3Awrite%20workers_routes%3Awrite%20workers_scripts%3Aread%20workers_tail%3Aread%20d1%3Awrite%20pages%3Awrite%20pages_build_services%3Awrite%20zone_settings%3Aread%20zone_settings%3Awrite%20user%3Aread%20email%3Aread%20memberships%3Aread%20workers_observer%3Aread%20workers_observers%3Awrite%20ai%3Awrite%20pipelines%3Awrite%20queues%3Awrite%20pages_read%3Awrite%20snippets%3Awrite%20ai_observability%3Awrite%20certificates%3Awrite%20hostnames%3Awrite%20queues%3Aread%20regional_tiering%3Aread%20db_config%3Aread"
  pause
  exit /b 1
)

echo.
echo ==========================================================
echo   DONE! Your website is live at:
echo   https://deepdreams-portfolio.pages.dev
echo.
echo   Quick check: open that address in your browser and
echo   make sure the homepage looks right.
echo ==========================================================
echo.
start "" "https://deepdreams-portfolio.pages.dev"
pause
