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
APP_IMAGE="883377/tabularium:v0.9-rc"
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

Strategia: build dell'immagine fuori dal server di produzione, pubblicazione nel repository privato Docker Hub `883377/tabularium`, pull sul server e riavvio con Docker Compose. Il server di produzione non compila l'applicazione.

## Autenticazione Docker Hub

Il repository e' privato. Esegui il login una tantum sia sulla macchina che effettua build e push sia sul server di produzione, usando un access token Docker Hub:

```bash
docker login --username 883377
ssh -i .devops/contabo_rsa root@178.18.248.213
docker login --username 883377
```

Il token viene richiesto interattivamente da Docker e salvato nella configurazione dell'utente. Non inserirlo in `deploy.conf`, `.env.production` o nel repository.

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
.devops/deploy.sh
```

Lo script:

- builda localmente `883377/tabularium:<git-sha>`
- aggiorna anche il tag `883377/tabularium:latest`
- pubblica entrambi i tag nel repository privato Docker Hub
- se richiesto, copia un dump PostgreSQL e/o un archivio upload
- esegue `docker pull` del tag immutabile sul server
- aggiorna `APP_IMAGE` remoto con il tag distribuito
- riavvia Compose usando quell'immagine
- se richiesto, ripristina il dump nel container `db`
- applica esclusivamente le migrazioni Prisma versionate con `npm run db:deploy`
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
IMAGE_REPOSITORY="883377/tabularium"
```

Puoi usare un file diverso:

```bash
.devops/deploy.sh \
  --config ./deploy-prod.contabo.conf
```

Le opzioni CLI sovrascrivono la configurazione:

```bash
.devops/deploy.sh \
  --config ./deploy.conf \
  --server-user root \
  --server-host 178.18.248.213 \
  --ssh-key .devops/contabo_rsa \
  --remote-dir /app/tabularium
```

Deploy con import database da dump PostgreSQL custom:

```bash
.devops/deploy.sh --import-db --db-dump ./tabularium.dump
```

Il dump deve essere creato con `pg_dump --format=custom`, ad esempio dal database locale avviato con `docker compose up -d db`:

```bash
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > tabularium.dump
```

L'import database e' distruttivo: lo script esegue `pg_restore --clean --if-exists` sul database di produzione. Per evitare import accidentali, `--db-dump` funziona solo insieme a `--import-db`.

Deploy con ripristino upload:

```bash
tar -czf tabularium-uploads.tar.gz -C public uploads
.devops/deploy.sh --uploads-archive ./tabularium-uploads.tar.gz
```

Deploy completo con database e upload:

```bash
.devops/deploy.sh --import-db --db-dump ./tabularium.dump --uploads-archive ./tabularium-uploads.tar.gz
```

Comandi equivalenti manuali:

```bash
IMAGE_TAG="$(git rev-parse --short HEAD)"
IMAGE_NAME="883377/tabularium:${IMAGE_TAG}"
docker build --pull -t "${IMAGE_NAME}" -t "883377/tabularium:latest" .
docker push "${IMAGE_NAME}"
docker push "883377/tabularium:latest"
ssh -i .devops/contabo_rsa root@178.18.248.213
```

Sul server:

```bash
cd /app/tabularium
docker pull "883377/tabularium:${IMAGE_TAG}"
# aggiorna APP_IMAGE in .env.production al tag appena pubblicato
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose --env-file .env.production -f docker-compose.prod.yml exec tabularium npx prisma db push
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

Verifica HTTP dal server, passando da Nginx o dalla rete Docker:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec tabularium wget -qO- http://127.0.0.1:3000/login
```

## Backup e restore produzione

Il backup viene eseguito dall'host, ma il dump PostgreSQL parte dentro al container
del database con `docker exec`. Non serve esporre PostgreSQL. Database, upload,
manifest e checksum vengono salvati nello stesso set:

```text
tabularium-YYYYMMDD-HHMMSS/
├── database.dump
├── uploads.tar.gz
├── manifest.json
├── SHA256SUMS
└── COMPLETE
```

`COMPLETE` viene creato soltanto dopo la verifica del dump, dell'archivio e dei
checksum.

### Configurazione

I valori del backup sono separati da quelli di deploy. Copia
`.devops/backup.conf.example` in `.devops/backup.conf`; il file reale è escluso
da Git e viene caricato dal deploy sul server come `/app/tabularium/backup.conf`.
Esempio di destinazione off-site:

```dotenv
BACKUP_SERVER_HOST=213.136.90.13
BACKUP_SERVER_USER=root
BACKUP_REMOTE_PATH=/app/backups01/tabularium
BACKUP_SSH_KEY=/root/.ssh/tabularium_backup
```

La chiave privata deve essere leggibile dall'utente che esegue il backup e avere
permessi `600`. Il percorso può essere relativo alla directory del progetto oppure
assoluto.

Test manuale, usando la stessa configurazione dell'automazione:

```bash
cd /app/tabularium
./scripts/backup-prod.sh --config ./backup.conf
```

### Automazione systemd

Installa e abilita il timer:

```bash
cd /app/tabularium
sudo ./.devops/install-backup-automation.sh \
  --project-dir /app/tabularium \
  --config-file /app/tabularium/backup.conf
```

Il timer predefinito parte ogni giorno alle 02:30, recupera le esecuzioni perse e
introduce un ritardo casuale massimo di 10 minuti. Stato, prossima esecuzione e log:

```bash
systemctl list-timers tabularium-backup.timer
systemctl status tabularium-backup.service
journalctl -u tabularium-backup.service
```

### Verifica e restore

Elenca e verifica i set locali:

```bash
cd /app/tabularium
BACKUP_DIR=/var/backups/tabularium ./scripts/backup-manager.sh list
./scripts/backup-manager.sh verify /var/backups/tabularium/tabularium-YYYYMMDD-HHMMSS
```

Restore:

```bash
BACKUP_DIR=/var/backups/tabularium ./scripts/restore-prod.sh \
  --backup /var/backups/tabularium/tabularium-YYYYMMDD-HHMMSS
```

Il restore verifica l'intero set prima di fermare l'applicazione. È distruttivo:
chiede conferma digitando `RESTORE` e, salvo opzione contraria, crea un backup di
sicurezza `pre-restore`. Se fallisce dopo lo stop, tenta sempre di riavviare
l'applicazione.

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
