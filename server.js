const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// In-memory "DAG" database for early sprints
let dag = [];
let clients = [];

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

function broadcast(data) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// US4: Create new DAG node
app.post('/api/rumors', (req, res) => {
  const { text, authorId, privateKeyMock } = req.body;
  
  if (text.length > 500) {
    return res.status(400).json({ error: 'Max 500 characters allowed.' });
  }

  const node = {
    id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: 'RUMOR',
    text,
    authorId,
    timestamp: Date.now(),
    signature: `signed_with_${privateKeyMock}` // AC: Sign content (Mocked)
  };

  dag.push(node);
  broadcast({ type: 'NEW_NODE', node }); // AC: Broadcast to peers

  res.json(node);
});

server.listen(5000, () => console.log('Sprint 1 Server running on port 5000'));