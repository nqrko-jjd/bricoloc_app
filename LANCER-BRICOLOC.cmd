@echo off
title BRICOLOC - serveur de developpement
cd /d "%~dp0"

echo.
echo   ============================================
echo     BRICOLOC  -  demarrage du site + de l'API
echo   ============================================
echo.
echo   Site        : http://localhost:3000
echo   Back-office : http://localhost:3000/admin
echo   Depuis le telephone (meme wifi) : http://192.168.1.27:3000
echo.
echo   Laisse cette fenetre ouverte pendant que tu utilises le site.
echo   Ferme-la (ou Ctrl+C) pour tout arreter.
echo.

call npm run dev

echo.
echo   Le serveur s'est arrete. Appuie sur une touche pour fermer.
pause >nul
