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
      },
    },
  ],
};
