# Produzione Docker

## Variabili

Copia `.env.production.example` in `.env.production` sul server e imposta:

- `POSTGRES_PASSWORD`
- `APP_IMAGE`
- `APP_URL`
- `CRON_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Il file `.env.production` deve esistere sul server: viene usato sia per interpolare il compose sia come `env_file` del container app.
Non configurare manualmente `DATABASE_URL`: l'app e Prisma la costruiscono da `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_SCHEMA`.

Per build Docker ripetibili è consigliato generare e versionare anche `package-lock.json`:

```bash
npm install --package-lock-only
```

Non committare `.env.production`: contiene segreti reali ed e' ignorato da Git.

`APP_URL` deve essere il dominio pubblico HTTPS:

```env
APP_URL="https://tabularium.devmash.it"
```

`APP_IMAGE` deve puntare all'immagine Docker da avviare:

```env
APP_IMAGE="tabularium:v0.9-rc"
```

Nel Google Cloud Console aggiungi il redirect URI:

```text
https://tabularium.devmash.it/api/auth/google/callback
```

## Docker compose

Percorso usato negli esempi sul server:

```bash
/app/tabularium
```

Il percorso non ha significato applicativo: puo' essere cambiato, purche' `REMOTE_DIR` e i comandi operativi usino lo stesso valore.

Il compose di produzione espone l'app solo sulla rete Docker, porta interna `3000`; non pubblica porte sull'host.

Reti Docker:

- `tabularium`: reti esterne `cluster_frontend` e `cluster_backend`
- `tabularium-db`: rete esterna `cluster_backend`

Il reverse proxy Nginx deve condividere la rete Docker `cluster_frontend` e raggiungere il container `tabularium` sulla porta `3000`.
Il traffico interno verso Next.js e' HTTP; HTTPS deve terminare su Nginx:

```nginx
location / {
    proxy_pass http://tabularium:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

Il compose assegna all'app l'alias `tabularium` sulla rete Docker `cluster_frontend`; non serve usare HTTPS tra Nginx e container.

## Procedura deploy

Strategia iniziale: build dell'immagine fuori dal server di produzione, trasferimento dell'immagine gia' pronta e riavvio con Docker Compose. Il server di produzione non deve compilare l'applicazione.

Non e' necessario pubblicare l'immagine su GitHub Container Registry per il primo deploy. GHCR conviene in una fase successiva, quando si vuole una pipeline CI/CD con immagini taggate, rollback e pull autenticato dal server.

Server:

```text
178.18.248.213
```

Percorso usato dagli esempi:

```bash
/app/tabularium
```

Connessione SSH dal repository locale:

```bash
ssh -i .devops/contabo_rsa root@178.18.248.213
```

Sul server, una tantum:

```bash
mkdir -p /app/tabularium
cd /app/tabularium
```

Porta sul server i file operativi versionati, in particolare `docker-compose.prod.yml` e `.env.production.example`, nel percorso scelto per `REMOTE_DIR`. Il file `.env.production` va creato direttamente sul server partendo da `.env.production.example`.

Il repository sul server serve solo per avere `docker-compose.prod.yml` e `.env.production`; la build dell'immagine resta esterna.

Deploy da macchina locale o runner CI:

```bash
cp deploy.conf.example deploy.conf
# modifica deploy.conf
./scripts/deploy-prod.sh
```

Lo script:

- builda localmente `tabularium:<git-sha>`
- esporta l'immagine in `/tmp/tabularium-<git-sha>.tar.gz`
- copia l'archivio su `178.18.248.213:/app/tabularium`
- se richiesto, copia un dump PostgreSQL e/o un archivio upload
- esegue `docker load` sul server
- riavvia Compose usando `APP_IMAGE` letto da `.env.production`
- se richiesto, ripristina il dump nel container `db`
- applica lo schema Prisma con `npx prisma db push`
- se richiesto, ripristina gli upload nel volume applicativo

Configurazione locale dello script:

```bash
cp deploy.conf.example deploy.conf
```

`deploy.conf` e' ignorato da Git e contiene i valori stabili di deploy:

```bash
SERVER_HOST="178.18.248.213"
SERVER_USER="root"
SSH_KEY=".devops/contabo_rsa"
REMOTE_DIR="/app/tabularium"
```

Puoi usare un file diverso:

```bash
./scripts/deploy-prod.sh \
  --config ./deploy-prod.contabo.conf
```

Le opzioni CLI sovrascrivono la configurazione:

```bash
./scripts/deploy-prod.sh \
  --config ./deploy.conf \
  --server-user root \
  --server-host 178.18.248.213 \
  --ssh-key .devops/contabo_rsa \
  --remote-dir /app/tabularium
```

Deploy con import database da dump PostgreSQL custom:

```bash
./scripts/deploy-prod.sh --import-db --db-dump ./tabularium.dump
```

Il dump deve essere creato con `pg_dump --format=custom`, ad esempio dal database locale avviato con `docker compose up -d db`:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > tabularium.dump
```

L'import database e' distruttivo: lo script esegue `pg_restore --clean --if-exists` sul database di produzione. Per evitare import accidentali, `--db-dump` funziona solo insieme a `--import-db`.

Deploy con ripristino upload:

```bash
tar -czf tabularium-uploads.tar.gz -C public uploads
./scripts/deploy-prod.sh --uploads-archive ./tabularium-uploads.tar.gz
```

Deploy completo con database e upload:

```bash
./scripts/deploy-prod.sh --import-db --db-dump ./tabularium.dump --uploads-archive ./tabularium-uploads.tar.gz
```

Comandi equivalenti manuali:

```bash
IMAGE_TAG="$(git rev-parse --short HEAD)"
IMAGE_NAME="tabularium:${IMAGE_TAG}"
docker build --pull -t "${IMAGE_NAME}" .
docker save "${IMAGE_NAME}" | gzip > "/tmp/tabularium-${IMAGE_TAG}.tar.gz"
scp -i .devops/contabo_rsa "/tmp/tabularium-${IMAGE_TAG}.tar.gz" root@178.18.248.213:/app/tabularium/
ssh -i .devops/contabo_rsa root@178.18.248.213
```

Sul server:

```bash
cd /app/tabularium
docker load -i "tabularium-${IMAGE_TAG}.tar.gz"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml exec tabularium npx prisma db push
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Verifica HTTP dal server, passando da Nginx o dalla rete Docker:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec tabularium wget -qO- http://127.0.0.1:3000/login
```

## Backup e restore produzione

Il backup viene eseguito dall'host, ma il dump PostgreSQL parte dentro al container `tabularium-db` con `docker exec`. Non serve esporre la porta del database fuori dalla rete Docker.

Backup manuale:

```bash
cd /app/tabularium
./scripts/backup-prod.sh --backup-dir /var/backups/tabularium
```

Lo script genera tre file:

```text
tabularium-YYYYMMDD-HHMMSS.dump
tabularium-YYYYMMDD-HHMMSS-uploads.tar.gz
tabularium-YYYYMMDD-HHMMSS.json
```

Per default mantiene i backup locali per 30 giorni. Per cambiare retention o disattivarla:

```bash
./scripts/backup-prod.sh --backup-dir /var/backups/tabularium --retention-days 14
./scripts/backup-prod.sh --backup-dir /var/backups/tabularium --retention-days 0
```

Crontab sull'host:

```cron
30 2 * * * cd /app/tabularium && ./scripts/backup-prod.sh --backup-dir /var/backups/tabularium >> /var/log/tabularium-backup.log 2>&1
```

Se configuri un remoto `rclone`, puoi copiare i backup fuori macchina:

```bash
./scripts/backup-prod.sh \
  --backup-dir /var/backups/tabularium \
  --rclone-dest remote:tabularium-backups
```

Restore da backup:

```bash
cd /app/tabularium
./scripts/restore-prod.sh \
  --db-dump /var/backups/tabularium/tabularium-YYYYMMDD-HHMMSS.dump \
  --uploads /var/backups/tabularium/tabularium-YYYYMMDD-HHMMSS-uploads.tar.gz
```

Il restore e' distruttivo: prima di procedere chiede conferma digitando `RESTORE` e, salvo opzione contraria, crea un backup di sicurezza `pre-restore`. Poi ferma l'app, ripristina database e upload, esegue `prisma db push` e riavvia il servizio.

## Migrazione dati locale -> server

Sul computer locale crea il dump:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > tabularium.dump
tar -czf tabularium-uploads.tar.gz -C public uploads
```

Copia sul server:

```bash
scp tabularium.dump tabularium-uploads.tar.gz user@server:/path/tabularium/
```

Sul server, con i container avviati, ripristina il DB. Questo comando svuota/sostituisce gli oggetti presenti nel DB target:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T tabularium-db sh -c 'pg_restore --clean --if-exists --no-owner --no-acl -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < tabularium.dump
```

Ripristina gli upload:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml cp tabularium-uploads.tar.gz tabularium:/tmp/tabularium-uploads.tar.gz
docker compose --env-file .env.production -f docker-compose.prod.yml exec tabularium sh -c 'rm -rf /app/public/uploads/* && tar -xzf /tmp/tabularium-uploads.tar.gz -C /app/public/uploads --strip-components=1'
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Verifica:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec tabularium npx prisma db push
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f tabularium
```
