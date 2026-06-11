module.exports = {
  apps: [
    {
      name: "test-report",
      script: "server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      env: {
        PORT: 4173
      }
    }
  ]
};
