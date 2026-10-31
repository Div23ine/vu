module.exports = {
  apps: [
    {
      name: 'vv-api',
      script: 'dist/server.js',
      cwd: './apps/api',
      node_args: '--env-file=.env'
    }
  ]
}
