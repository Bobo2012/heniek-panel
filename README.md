# Heniek / AL Dashboard

Gotowy panel operatorski dla instancji AL / Heniek.

## Co potrafi

- pokazuje status kontenera
- pokazuje uptime i podstawową diagnostykę
- wyświetla live logi Dockera
- pozwala zrestartować usługę
- pozwala czytać i edytować plik soul / personality
- ma premium mobile-first UI pod telefon i tablet
- wymaga potwierdzenia dla restartu i zapisu SOUL
- zapisuje activity log akcji operatora
- opcjonalnie chroni cały panel tokenem

## Stack

- Next.js 16
- React 19
- Tailwind CSS 4

## Start lokalnie

```bash
npm install
npm run dev
```

Aplikacja będzie pod:

```bash
http://localhost:3000
```

## Build produkcyjny

```bash
npm run build
npm run start
```

## Zmienne środowiskowe

Możesz sterować panelem przez env:

```bash
PANEL_TARGET_CONTAINER=hermes-agent
PANEL_COMPOSE_PATH=/root/docker-compose.yml
PANEL_COMPOSE_SERVICE=hermes
PANEL_SOUL_PATH=/opt/prod/hermes-agent/data/SOUL.md
PANEL_LOG_TAIL=120
PANEL_AUDIT_LOG_PATH=/opt/prod/hermes-agent/data/panel-audit.log
PANEL_AUTH_TOKEN=twoj-sekretny-token
```

### Co znaczą

- `PANEL_TARGET_CONTAINER` — nazwa kontenera Dockera do statusu i logów
- `PANEL_COMPOSE_PATH` — ścieżka do `docker-compose.yml`
- `PANEL_COMPOSE_SERVICE` — nazwa usługi compose do restartu
- `PANEL_SOUL_PATH` — plik personality / soul do edycji
- `PANEL_LOG_TAIL` — domyślna liczba linii logów
- `PANEL_AUDIT_LOG_PATH` — plik activity logu panelu
- `PANEL_AUTH_TOKEN` — jeśli ustawisz, panel wymaga tokenu w UI

## Workflow pracy

1. Zmieniasz pliki lokalnie
2. Odpalasz `npm run dev`
3. Sprawdzasz `npm run lint` i `npm run build`
4. Commit + push do repo
5. Na VPS robisz pull i restart

## Deployment na VPS

Masz dwie wygodne opcje.

### Opcja 1 — ręcznie

```bash
sudo -i
cd /opt/apps/heniek-panel
cp .env.example .env
# uzupełnij .env swoimi wartościami
npm install
npm run build
pm2 start ecosystem.config.cjs
```

Przy kolejnych aktualizacjach:

```bash
cd /opt/apps/heniek-panel
./scripts/deploy.sh
```

### Opcja 2 — szybki update

Jeśli panel już działa i PM2 jest postawione:

```bash
sudo -i
cd /opt/apps/heniek-panel
./scripts/deploy.sh
```

Pliki pomocnicze w repo:

- `ecosystem.config.cjs` — gotowy start dla PM2
- `.env.example` — wzór konfiguracji
- `scripts/deploy.sh` — pull + install + build + restart

Jeśli nie używasz PM2, uruchamiasz ponownie proces `npm run start` po buildzie.
