@echo off
title BRICOLOC - appli mobile (donnees EN LIGNE)
cd /d "%~dp0\apps\mobile"

echo.
echo   ================================================
echo     BRICOLOC  -  appli mobile sur new.bricoloc.be
echo   ================================================
echo.
echo   L'appli utilise les donnees du SERVEUR (new.bricoloc.be).
echo.
echo   COMMENT TESTER EN EXTERIEUR / 5G :
echo     1. Mets le telephone sur le MEME wifi que ce PC.
echo     2. Ouvre Expo Go, scanne le QR ci-dessous, attends que
echo        l'appli soit chargee.
echo     3. Tu peux ensuite SORTIR : passe en 5G / autre wifi,
echo        l'appli continue de fonctionner (les donnees viennent
echo        du serveur). Ne recharge pas l'appli tant que tu es
echo        loin du PC.
echo.
echo   Laisse cette fenetre ouverte. Ferme-la pour arreter.
echo.

for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":8081 " ^| findstr LISTENING') do taskkill /F /PID %%A >nul 2>&1

set EXPO_PUBLIC_API_URL=https://new.bricoloc.be/bricoloc-api
call npx expo start

echo.
echo   Metro s'est arrete. Appuie sur une touche pour fermer.
pause >nul
