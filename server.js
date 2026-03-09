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
const userVoteTracker = {}; // NEW: Tracks votes to prevent spam

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

// US4: Create Post
app.post('/api/rumors', (req, res) => {
  const { text, authorId, privateKeyMock } = req.body;
  if (text.length > 500) return res.status(400).json({ error: 'Max 500 chars.' });

  const node = {
    id: `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: 'RUMOR',
    text,
    authorId,
    timestamp: Date.now(),
    signature: `signed_with_${privateKeyMock}`
  };

  dag.push(node);
  broadcast({ type: 'NEW_NODE', node });
  res.json(node);
});

// US7 & Anti-Spam: Voting Mechanism with Rate Limit
app.post('/api/rumors/:id/votes', (req, res) => {
  const parentId = req.params.id;
  const { vote, voterId, reputationMock } = req.body;

  if (reputationMock <= 0) return res.status(403).json({ error: 'Reputation too low.' });

  // NEW: Anti-Spam Check (Max 3 votes per user per post)
  const trackKey = `${voterId}_${parentId}`;
  if (!userVoteTracker[trackKey]) userVoteTracker[trackKey] = 0;
  
  if (userVoteTracker[trackKey] >= 3) {
    return res.status(429).json({ error: 'Anti-Spam: You can only vote 3 times on this post.' });
  }
  userVoteTracker[trackKey]++;

  const voteNode = {
    id: `vote_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    type: 'VOTE',
    parentId: parentId,
    vote: vote,
    voterId: voterId,
    timestamp: Date.now()
  };

  dag.push(voteNode);
  broadcast({ type: 'NEW_VOTE', node: voteNode });
  res.json(voteNode);
});

// US5 & US9: Fetch Feed with Trust Scores and Vote Counts
app.get('/api/feed', (req, res) => {
  const rumors = dag.filter(n => n.type === 'RUMOR').sort((a, b) => b.timestamp - a.timestamp);
  
  const feedWithScores = rumors.map(rumor => {
    const votes = dag.filter(n => n.type === 'VOTE' && n.parentId === rumor.id);
    let score = 0.5; // Default Neutral
    
    if (votes.length > 0) {
      const positive = votes.filter(v => v.vote === 1).length;
      score = positive / votes.length;
    }
    // NEW: Send totalVotes to frontend for the easter egg
    return { ...rumor, score, totalVotes: votes.length };
  });

  res.json(feedWithScores);
});

server.listen(5000, () => console.log('Sprint 1 Server running on port 5000'));