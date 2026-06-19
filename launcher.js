// Dev convenience: starts the backend (port 5000) and the Vite dev server
// (port 5173) together. The frontend talks to the backend through Vite's proxy
// (see vite.config.mjs), so they share one origin during development.
//
// For production you do NOT use this — you `npm run build` and run
// `node server/server.js`, which serves the built SPA + API from one process.

const { spawn } = require('child_process');

const BACKEND_PORT = process.env.PORT || 5000;

console.log(`Starting ANON dev node — API :${BACKEND_PORT}, web :5173`);

const backend = spawn('node', ['server/server.js'], {
  env: { ...process.env, PORT: BACKEND_PORT },
  stdio: 'inherit',
  shell: true,
});

const frontend = spawn('npx', ['vite', '--port', '5173', '--strictPort'], {
  env: { ...process.env },
  stdio: 'inherit',
  shell: true,
});

function shutdown() {
  backend.kill();
  frontend.kill();
  process.exit();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
