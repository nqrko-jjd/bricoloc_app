@echo off
title BRICOLOC - appli mobile (donnees EN LIGNE)
cd /d "%~dp0\apps\mobile"

echo.
echo   ================================================
echo     BRICOLOC  -  appli mobile sur new.bricoloc.be
echo   ================================================
echo.
echo   L'appli utilise les donnees du SERVEUR (new.bricoloc.be).
echo   Mode TUNNEL : le telephone peut scanner le QR en 4G/5G, PAS BESOIN
echo   d'etre sur le meme wifi que ce PC (1er lancement un peu plus lent).
echo.
echo   IMPORTANT : ce PC doit rester allume et cette fenetre ouverte
echo   TOUT LE TEMPS que tu utilises l'appli (Expo Go la recharge depuis
echo   ce PC). Si tu fermes cette fenetre ou eteins le PC, l'appli
echo   s'arretera de fonctionner sur le telephone.
echo   -> Solution definitive (plus besoin du PC du tout) : build iOS
echo      autonome, en attente du compte Apple Developer.
echo.
echo   Laisse cette fenetre ouverte. Ferme-la pour arreter.
echo.

for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":8081 " ^| findstr LISTENING') do taskkill /F /PID %%A >nul 2>&1

set EXPO_PUBLIC_API_URL=https://new.bricoloc.be/bricoloc-api
call npx expo start --tunnel

echo.
echo   Metro s'est arrete. Appuie sur une touche pour fermer.
pause >nul
