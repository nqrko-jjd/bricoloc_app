# Déploiement BRICOLOC sur le VPS Combell

Pile : **Docker Compose** — PostgreSQL + API + site Next.js + nginx (HTTPS Let's Encrypt).
Tout est servi par **un seul domaine** : le site, l'API (`/bricoloc-api`) et les
médias (`/uploads`).

Phase actuelle : **adresse de test** (`new.bricoloc.be`), paiements en **mode démo**.
La bascule vers `www.bricoloc.be` et Mollie se fera plus tard (section « Bascule finale »).

---

## 1. Prérequis sur le VPS (une fois)

VPS Ubuntu 22.04 ou 24.04, accès SSH root/sudo.

```bash
# Docker + Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # puis se reconnecter

# Pare-feu : n'ouvrir que SSH + web
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

## 2. DNS (panneau Combell)

Créer un enregistrement **A** :

| Nom | Type | Valeur |
|-----|------|--------|
| `new` | A | *IP publique du VPS* |

Vérifier : `dig +short new.bricoloc.be` doit renvoyer l'IP du VPS avant l'étape 5.

## 3. Récupérer le code

```bash
sudo mkdir -p /opt/bricoloc && sudo chown $USER /opt/bricoloc
git clone <URL_DU_DEPOT> /opt/bricoloc
cd /opt/bricoloc
git checkout refonte
```

## 4. Configuration

```bash
cp deploy/.env.production.example .env.production
nano .env.production
```

À remplir impérativement :

- `DOMAIN` / `SITE_URL` → `new.bricoloc.be` / `https://new.bricoloc.be`
- `CERTBOT_EMAIL` → une adresse valide
- `POSTGRES_PASSWORD` → `openssl rand -hex 24`
- `JWT_SECRET` → `openssl rand -hex 32`
- `DEEPL_API_KEY` → la clé DeepL (identique au dev), sinon laisser vide

> Astuce : garder `CERTBOT_STAGING=1` pour les premiers essais (certificats de test,
> quota illimité), puis repasser à `0` et relancer l'étape 5.

## 5. Premier démarrage

```bash
# Build des images + base + API + site
docker compose --env-file .env.production up -d --build db api web

# Certificat HTTPS (DNS doit déjà pointer sur le VPS)
chmod +x deploy/init-letsencrypt.sh
./deploy/init-letsencrypt.sh

# nginx + renouvellement auto
docker compose --env-file .env.production up -d
```

Le conteneur `api` applique le schéma à la base Postgres (`prisma db push`) à chaque
démarrage.

## 6. Charger les données

Lancer le seed une fois (crée les comptes équipe, les catégories, les réglages,
les pages de contenu, et un catalogue de démonstration) :

```bash
docker compose --env-file .env.production exec api npm run seed
```

Ensuite, pour passer au **catalogue réel** : exporter le CSV de démo depuis
**Admin → Import / export CSV**, le remplacer par les vraies données, et réimporter
(produits, consommables, inventaire, clients). Les articles de démo se dépublient
ou se suppriment depuis **Admin → Catalogue & produits**.

### Médias

Les images ne sont pas dans Git. Copier le dossier local `apps/api/uploads/` vers le
volume du VPS :

```bash
# depuis le PC (adapter l'IP)
scp -r apps/api/uploads/* user@IP:/tmp/uploads/
# sur le VPS
docker compose --env-file .env.production cp /tmp/uploads/. api:/repo/apps/api/uploads/
```

## 7. Vérifier

- `https://new.bricoloc.be` → le site
- `https://new.bricoloc.be/bricoloc-api/health` → `{"ok":true,…}`
- `https://new.bricoloc.be/admin` → back-office
- `https://new.bricoloc.be/borne` → la borne
- `https://new.bricoloc.be/terminal` → terminal équipe (scan caméra OK, HTTPS)

## 8. Mises à jour

```bash
cd /opt/bricoloc && git pull
docker compose --env-file .env.production up -d --build
```

## 9. Sauvegardes

```bash
# Base de données (à mettre dans un cron quotidien)
docker compose --env-file .env.production exec -T db \
  pg_dump -U bricoloc bricoloc | gzip > backup-$(date +%F).sql.gz

# Médias
docker run --rm -v bricoloc_uploads:/u -v $PWD:/b alpine \
  tar czf /b/uploads-$(date +%F).tar.gz -C /u .
```

Restauration base : `gunzip -c backup.sql.gz | docker compose exec -T db psql -U bricoloc bricoloc`

## 10. Logs

```bash
docker compose --env-file .env.production logs -f api
docker compose --env-file .env.production logs -f web nginx
```

---

## Bascule finale vers www.bricoloc.be

Quand la version de test est validée :

1. **DNS** : faire pointer `bricoloc.be` **et** `www.bricoloc.be` (A / ALIAS) vers le VPS.
   Prévoir que l'ancien site WordPress ne répondra plus.
2. `.env.production` : `DOMAIN=www.bricoloc.be`, `SITE_URL=https://www.bricoloc.be`.
   Ajouter un 2ᵉ `-d bricoloc.be` dans `init-letsencrypt.sh` (ou une redirection nue→www).
3. Relancer :
   ```bash
   docker compose --env-file .env.production up -d
   ./deploy/init-letsencrypt.sh
   ```
4. **Paiements réels** : renseigner `MOLLIE_API_KEY` + l'URL de webhook, repasser le
   site hors « mode démonstration » (réglage admin), tester un paiement à 1 €.
5. Mettre à jour l'app mobile (`apps/mobile` : `EXPO_PUBLIC_API_URL`) et rebuild EAS.
