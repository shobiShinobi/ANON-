const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let dag = [];
let clients = [];
const userVoteTracker = {}; 

// NEW: Mana Database (US10 & US11)
const users = {}; 

function initUser(id) {
  if (!users[id]) users[id] = { mana: 100 };
}

wss.on('connection', (ws) => {
  clients.push(ws);
  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

function broadcast(data) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
  });
}

// US11: Background Activity Recovery Loop
// Regenerates 2 Mana every 5 seconds for demo purposes (would be 1 per min in production)
setInterval(() => {
  for (let id in users) {
    if (users[id].mana < 100) {
      users[id].mana = Math.min(100, users[id].mana + 2);
      // Broadcast the new mana balance so the frontend bar updates automatically
      broadcast({ type: 'MANA_UPDATE', userId: id, mana: users[id].mana });
    }
  }
}, 5000);

// Get User Mana Endpoint
app.get('/api/users/:id/mana', (req, res) => {
  initUser(req.params.id);
  res.json({ mana: users[req.params.id].mana });
});

// US10: Structural Limitations on Posting (Costs 50)
app.post('/api/rumors', (req, res) => {
  const { text, authorId, privateKeyMock } = req.body;
  
  initUser(authorId);
  if (users[authorId].mana < 50) {
    return res.status(403).json({ error: 'Insufficient Mana to broadcast. Need 50.' });
  }

  if (text.length > 500) return res.status(400).json({ error: 'Max 500 chars.' });

  users[authorId].mana -= 50; // Deduct Mana
  broadcast({ type: 'MANA_UPDATE', userId: authorId, mana: users[authorId].mana });

  const node = {
    id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: 'RUMOR',
    text, authorId, timestamp: Date.now(), signature: `signed_with_${privateKeyMock}`
  };

  dag.push(node);
  broadcast({ type: 'NEW_NODE', node });
  res.json(node);
});

// US10: Structural Limitations on Voting (Costs 5)
app.post('/api/rumors/:id/votes', (req, res) => {
  const parentId = req.params.id;
  const { vote, voterId, reputationMock } = req.body;

  initUser(voterId);
  if (users[voterId].mana < 5) {
    return res.status(403).json({ error: 'Insufficient Mana to vote. Need 5.' });
  }

  const trackKey = `${voterId}_${parentId}`;
  if (!userVoteTracker[trackKey]) userVoteTracker[trackKey] = 0;
  if (userVoteTracker[trackKey] >= 3) return res.status(429).json({ error: 'Anti-Spam: Max 3 votes per post.' });
  
  users[voterId].mana -= 5; // Deduct Mana
  userVoteTracker[trackKey]++;
  broadcast({ type: 'MANA_UPDATE', userId: voterId, mana: users[voterId].mana });

  const voteNode = {
    id: `vote_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: 'VOTE',
    parentId: parentId, vote: vote, voterId: voterId, timestamp: Date.now()
  };

  dag.push(voteNode);
  broadcast({ type: 'NEW_VOTE', node: voteNode });
  res.json(voteNode);
});

app.get('/api/feed', (req, res) => {
  const rumors = dag.filter(n => n.type === 'RUMOR').sort((a, b) => b.timestamp - a.timestamp);
  const feedWithScores = rumors.map(rumor => {
    const votes = dag.filter(n => n.type === 'VOTE' && n.parentId === rumor.id);
    let score = 0.5;
    if (votes.length > 0) score = votes.filter(v => v.vote === 1).length / votes.length;
    return { ...rumor, score, totalVotes: votes.length };
  });
  res.json(feedWithScores);
});

// NEW: Destroy Identity Endpoint
app.delete('/api/users/:id', (req, res) => {
  const id = req.params.id;
  if (users[id]) {
    delete users[id]; // Wipes their Mana and profile from memory
  }
  res.json({ success: true, message: 'Identity destroyed' });
});

server.listen(5000, () => console.log('Sprint 2 Server running on port 5000'));