module.exports = {
  apps: [
    {
      name: 'al-panel',
      cwd: '/opt/apps/heniek-panel',
      script: 'npm',
      args: 'run start -- --hostname 0.0.0.0 --port 3000',
      interpreter: 'none',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        PANEL_TARGET_CONTAINER: 'hermes-agent',
        PANEL_COMPOSE_PATH: '/root/docker-compose.yml',
        PANEL_COMPOSE_SERVICE: 'hermes',
        PANEL_SOUL_PATH: '/opt/data/AL-SOUL.md',
        PANEL_LOG_TAIL: '120',
      },
    },
  ],
};
