const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

// Helper to find the next available port starting from a given number
async function getNextOpenPort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => resolve(getNextOpenPort(startPort + 1)));
  });
}

async function startNode() {
  console.log('🔍 Scanning for open ports to initialize Node...');
  const backendPort = await getNextOpenPort(5000);
  const frontendPort = await getNextOpenPort(5173);

  console.log(`✅ Found ports! Backend: ${backendPort} | Frontend: ${frontendPort}`);

  // 1. Start Backend
  const backend = spawn('node', ['server/server.js'], {
    env: { ...process.env, PORT: backendPort },
    stdio: 'inherit',
    shell: true
  });

  // 2. Start Frontend
  const frontend = spawn('npx', ['vite', '--port', frontendPort, '--strictPort'], {
    env: { ...process.env, VITE_BACKEND_PORT: backendPort },
    stdio: 'inherit',
    shell: true
  });

  process.on('SIGINT', () => {
    backend.kill();
    frontend.kill();
    process.exit();
  });
}

startNode();