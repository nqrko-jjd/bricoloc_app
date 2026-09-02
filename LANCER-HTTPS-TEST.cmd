@echo off
title BRICOLOC - tunnel HTTPS (test camera iPad / borne / telephone)
cd /d "%~dp0"

echo.
echo   ===================================================================
echo     BRICOLOC  -  adresse HTTPS temporaire pour tester la camera
echo   ===================================================================
echo.
echo   A quoi ca sert : le scan par camera (iOS / Android / borne) exige
echo   une connexion securisee (https). En local on n'a que http, donc on
echo   ouvre un "tunnel" qui donne une vraie adresse https valide partout.
echo.
echo   IMPORTANT : garde LANCER-BRICOLOC.cmd ouvert a cote (site + API).
echo.

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo   cloudflared n'est pas installe. Installation via winget...
  echo.
  winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
  echo.
  where cloudflared >nul 2>&1
  if errorlevel 1 (
    echo   ---------------------------------------------------------------
    echo   Installation automatique impossible.
    echo   Ouvre PowerShell et colle :
    echo       winget install --id Cloudflare.cloudflared
    echo   puis relance ce fichier.
    echo   ---------------------------------------------------------------
    pause
    exit /b 1
  )
)

echo.
echo   Ouverture du tunnel... l'adresse https apparait ci-dessous
echo   (ligne du type  https://xxxx-xxxx.trycloudflare.com ).
echo.
echo   Ouvre CETTE adresse sur l'iPad / le telephone / la borne.
echo   Pour la borne :  https://xxxx.trycloudflare.com/borne
echo   Pour le scan comptoir :  https://xxxx.trycloudflare.com/admin/comptoir
echo.
echo   Ferme cette fenetre pour couper le tunnel (le site reste en ligne en local).
echo.

cloudflared tunnel --url http://localhost:3000

echo.
echo   Tunnel ferme. Appuie sur une touche.
pause >nul
