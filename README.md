# Heniek / AL Dashboard

Gotowy panel operatorski dla instancji AL / Heniek.

## Co potrafi

- pokazuje status kontenera
- pokazuje uptime i podstawową diagnostykę
- wyświetla live logi Dockera
- pozwala zrestartować usługę
- pozwala czytać i edytować plik soul / personality
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
PANEL_SOUL_PATH=/opt/data/AL-SOUL.md
PANEL_LOG_TAIL=120
PANEL_AUTH_TOKEN=twoj-sekretny-token
```

### Co znaczą

- `PANEL_TARGET_CONTAINER` — nazwa kontenera Dockera do statusu i logów
- `PANEL_COMPOSE_PATH` — ścieżka do `docker-compose.yml`
- `PANEL_COMPOSE_SERVICE` — nazwa usługi compose do restartu
- `PANEL_SOUL_PATH` — plik personality / soul do edycji
- `PANEL_LOG_TAIL` — domyślna liczba linii logów
- `PANEL_AUTH_TOKEN` — jeśli ustawisz, panel wymaga tokenu w UI

## Workflow pracy

1. Zmieniasz pliki lokalnie
2. Odpalasz `npm run dev`
3. Sprawdzasz `npm run lint` i `npm run build`
4. Commit + push do repo
5. Na VPS robisz pull i restart

## Deployment na VPS

Przykładowo:

```bash
sudo -i
cd /opt/apps/heniek-panel
git pull
npm install
npm run build
pm2 restart al-panel
```

Jeśli nie używasz PM2, uruchamiasz ponownie proces `npm run start` po buildzie.
