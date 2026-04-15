const net = require('net');
const { spawn } = require('child_process');

function getRandomPort(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getOpenPort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => resolve(getOpenPort(startPort + 1)));
  });
}

async function startNode() {
  console.log('🔍 Initializing dynamic decentralized node...');
  
  const randomBase = getRandomPort(5000, 5900); 
  const backendPort = await getOpenPort(randomBase);
  const frontendPort = await getOpenPort(backendPort + 1000); 

  console.log(`✅ Locked Ports -> Backend: ${backendPort} | Frontend: ${frontendPort}`);

  const backend = spawn('node', ['server/server.js'], {
    env: { ...process.env, PORT: backendPort },
    stdio: 'inherit',
    shell: true
  });

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