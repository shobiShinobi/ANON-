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

// US5 & US9: Fetch recent rumors with calculated scores
app.get('/api/feed', (req, res) => {
  const rumors = dag.filter(n => n.type === 'RUMOR').sort((a, b) => b.timestamp - a.timestamp);

  // Attach scores to rumors based on child votes
  const feedWithScores = rumors.map(rumor => {
    const votes = dag.filter(n => n.type === 'VOTE' && n.parentId === rumor.id);
    let score = 0.5; // Default neutral score

    if (votes.length > 0) {
      const positive = votes.filter(v => v.vote === 1).length;
      score = positive / votes.length; // Will return between 0.0 and 1.0
    }

    return { ...rumor, score };
  });

  res.json(feedWithScores);
});

// US7: Express agreement/disagreement
app.post('/api/rumors/:id/votes', (req, res) => {
  const parentId = req.params.id;
  const { vote, voterId, reputationMock } = req.body;

  // AC: Check if user has Reputation > 0 (Mocked for early sprint)
  if (reputationMock <= 0) {
    return res.status(403).json({ error: 'Reputation too low to vote.' });
  }

  // AC: Create child node in DAG linking to the rumor
  const voteNode = {
    id: `vote_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: 'VOTE',
    parentId: parentId,
    vote: vote, // +1 or -1
    voterId: voterId,
    timestamp: Date.now()
  };

  dag.push(voteNode);
  broadcast({ type: 'NEW_VOTE', node: voteNode });
  
  res.json(voteNode);
});

server.listen(5000, () => console.log('Sprint 1 Server running on port 5000'));