@echo off
title BRICOLOC - appli mobile (Metro)
cd /d "%~dp0\apps\mobile"

echo.
echo   ==========================================
echo     BRICOLOC  -  appli mobile (Expo / Metro)
echo   ==========================================
echo.
echo   1. Verifie que LANCER-BRICOLOC.cmd tourne aussi (le site + l'API).
echo   2. Sur ton telephone : ouvre l'appli Expo Go, scanne le QR code
echo      qui va s'afficher ci-dessous.
echo   3. Le PC et le telephone doivent etre sur le meme wifi.
echo.
echo   Laisse cette fenetre ouverte. Ferme-la pour arreter.
echo.

call npm start

echo.
echo   Metro s'est arrete. Appuie sur une touche pour fermer.
pause >nul
