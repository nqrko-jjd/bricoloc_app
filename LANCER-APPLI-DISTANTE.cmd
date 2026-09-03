@echo off
title BRICOLOC - appli mobile (donnees EN LIGNE)
cd /d "%~dp0\apps\mobile"

echo.
echo   ================================================
echo     BRICOLOC  -  appli mobile sur new.bricoloc.be
echo   ================================================
echo.
echo   L'appli utilisera les donnees du SERVEUR (new.bricoloc.be),
echo   pas ton PC. Le tunnel permet de scanner de n'importe ou
echo   (meme en 4G, meme sur un autre wifi).
echo.
echo   1. Ouvre Expo Go sur le telephone et scanne le QR ci-dessous.
echo   2. Pas besoin que LANCER-BRICOLOC.cmd tourne.
echo.
echo   Laisse cette fenetre ouverte. Ferme-la pour arreter.
echo.

for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":8081 " ^| findstr LISTENING') do taskkill /F /PID %%A >nul 2>&1

set EXPO_PUBLIC_API_URL=https://new.bricoloc.be/bricoloc-api
call npx expo start --tunnel

echo.
echo   Metro s'est arrete. Appuie sur une touche pour fermer.
pause >nul
