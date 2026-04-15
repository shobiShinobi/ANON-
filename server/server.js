const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let dag = [];
let localClients = [];
const users = {}; 
const userVoteTracker = {}; 

function initUser(id) { if (!users[id]) users[id] = { mana: 100 }; }

// ==========================================
// LOCAL REACT CLIENT HANDLER
// ==========================================
wss.on('connection', (ws, req) => {
  // Only add our local React frontend to localClients
  if (req.url === '/') {
    localClients.push(ws);
    ws.on('close', () => localClients = localClients.filter(c => c !== ws));
  }
});

function notifyLocalFrontend(data) {
  localClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
  });
}

// Mana Regeneration Loop
setInterval(() => {
  for (let id in users) {
    if (users[id].mana < 100) {
      users[id].mana = Math.min(100, users[id].mana + 2);
      notifyLocalFrontend({ type: 'MANA_UPDATE', userId: id, mana: users[id].mana });
    }
  }
}, 5000);

// ==========================================
// EIGENTRUST & ROUTES (US8)
// ==========================================
app.get('/api/users/:id/mana', (req, res) => {
  initUser(req.params.id);
  res.json({ mana: users[req.params.id].mana });
});

app.get('/api/feed', (req, res) => {
  const rumors = dag.filter(n => n.type === 'RUMOR');
  const allVotes = dag.filter(n => n.type === 'VOTE');
  
  // US8: Calculate Global Reputation Matrix
  const userReputation = {};
  allVotes.forEach(vote => {
    if (!userReputation[vote.voterId]) userReputation[vote.voterId] = 1.0; // Base trust
    // Simplified EigenTrust: Gain 0.2 reputation per interaction to simulate established trust
    userReputation[vote.voterId] += 0.2; 
  });

  const feedWithScores = rumors.map(rumor => {
    const postVotes = allVotes.filter(n => n.parentId === rumor.id);
    let score = 0.5; 
    
    if (postVotes.length > 0) {
      let weightedPositive = 0;
      let totalWeight = 0;

      postVotes.forEach(v => {
        // US8: Weigh votes based on user's Global Reputation (Cap multiplier at 5x)
        const weight = Math.min(userReputation[v.voterId] || 1.0, 5.0); 
        totalWeight += weight;
        if (v.vote === 1) weightedPositive += weight;
      });
      score = weightedPositive / totalWeight; 
    }
    return { ...rumor, score, totalVotes: postVotes.length };
  });

  res.json(feedWithScores);
});

app.post('/api/rumors', (req, res) => {
  const { text, authorId } = req.body;
  initUser(authorId);
  if (users[authorId].mana < 50) return res.status(403).json({ error: 'Need 50 Mana.' });
  
  users[authorId].mana -= 50;
  notifyLocalFrontend({ type: 'MANA_UPDATE', userId: authorId, mana: users[authorId].mana });

  const node = { id: `r_${Date.now()}_${Math.random()}`, type: 'RUMOR', text, authorId, timestamp: Date.now() };
  dag.push(node);
  notifyLocalFrontend({ type: 'NEW_NODE' });
  gossipToMesh(node); // Propagate
  res.json(node);
});

app.post('/api/rumors/:id/votes', (req, res) => {
  const { vote, voterId } = req.body;
  initUser(voterId);
  if (users[voterId].mana < 5) return res.status(403).json({ error: 'Need 5 Mana.' });

  const trackKey = `${voterId}_${req.params.id}`;
  if (!userVoteTracker[trackKey]) userVoteTracker[trackKey] = 0;
  if (userVoteTracker[trackKey] >= 3) return res.status(429).json({ error: 'Anti-Spam: Max 3 votes.' });
  
  users[voterId].mana -= 5;
  userVoteTracker[trackKey]++;
  notifyLocalFrontend({ type: 'MANA_UPDATE', userId: voterId, mana: users[voterId].mana });

  const voteNode = { id: `v_${Date.now()}_${Math.random()}`, type: 'VOTE', parentId: req.params.id, vote, voterId, timestamp: Date.now() };
  dag.push(voteNode);
  notifyLocalFrontend({ type: 'NEW_NODE' });
  gossipToMesh(voteNode); // Propagate
  res.json(voteNode);
});

app.delete('/api/users/:id', (req, res) => {
  delete users[req.params.id];
  res.json({ success: true });
});

// ==========================================
// P2P MESH NETWORKING (US13 & US14)
// ==========================================
const connectedPeers = new Map();

function connectToPeer(port) {
  if (port == PORT || connectedPeers.has(port)) return; // Don't connect to self or existing
  
  const peerWs = new WebSocket(`ws://localhost:${port}/peer`);
  
  peerWs.on('open', () => {
    connectedPeers.set(port, peerWs);
    notifyLocalFrontend({ type: 'PEER_UPDATE', count: connectedPeers.size });
    peerWs.send(JSON.stringify({ type: 'SYNC_REQ' })); // US14: Pull history
  });

  peerWs.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.type === 'SYNC_REQ') {
      peerWs.send(JSON.stringify({ type: 'SYNC_RES', fullDag: dag }));
    }
    if (data.type === 'SYNC_RES') {
      const existingIds = new Set(dag.map(n => n.id));
      let added = false;
      data.fullDag.forEach(node => {
        if (!existingIds.has(node.id)) { dag.push(node); added = true; }
      });
      if (added) notifyLocalFrontend({ type: 'NEW_NODE' }); // Update UI if we pulled new history
    }
    if (data.type === 'GOSSIP') {
      if (!dag.find(n => n.id === data.node.id)) {
        dag.push(data.node);
        notifyLocalFrontend({ type: 'NEW_NODE' });
        gossipToMesh(data.node); // Forward to others
      }
    }
  });

  peerWs.on('close', () => {
    connectedPeers.delete(port);
    notifyLocalFrontend({ type: 'PEER_UPDATE', count: connectedPeers.size });
  });
  peerWs.on('error', () => { /* Ignore connection refused for closed ports */ });
}

function gossipToMesh(node) {
  connectedPeers.forEach(peer => {
    if (peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify({ type: 'GOSSIP', node }));
  });
}

// US13: Auto-Discovery Loop (Scan 5000-5010 every 3 seconds to find new peers)
setInterval(() => {
  for (let p = 5000; p <= 5010; p++) connectToPeer(p);
}, 3000);

// Also handle incoming peer connections from others scanning US
wss.on('connection', (ws, req) => {
  if (req.url === '/peer') {
    ws.on('message', (msg) => {
      const data = JSON.parse(msg);
      if (data.type === 'SYNC_REQ') ws.send(JSON.stringify({ type: 'SYNC_RES', fullDag: dag }));
      if (data.type === 'GOSSIP') {
        if (!dag.find(n => n.id === data.node.id)) {
          dag.push(data.node);
          notifyLocalFrontend({ type: 'NEW_NODE' });
          gossipToMesh(data.node);
        }
      }
    });
  }
});

server.listen(PORT, () => console.log(`Node Core active on ${PORT}`));