@echo off
:loop
REM Start a new command prompt with a unique title
start "NodeApp" cmd /c "node index.js"
REM Let it run for 100 seconds (100 seconds)
timeout /t 100 /nobreak >nul
REM Close the command prompt that runs the Node.js application
taskkill /fi "WindowTitle eq NodeApp" /f
REM Wait for 10 seconds before restarting the loop
timeout /t 10 /nobreak
goto loop
