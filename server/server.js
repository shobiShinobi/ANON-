const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==========================================
// SQLITE PERSISTENCE
// ==========================================
const db = new Database(`node_${PORT}.db`); // Unique DB per node
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, seed TEXT, mana INTEGER);
  CREATE TABLE IF NOT EXISTS dag (id TEXT PRIMARY KEY, type TEXT, text TEXT, authorId TEXT, parentId TEXT, vote INTEGER, voterId TEXT, timestamp INTEGER);
`);

let localClients = [];
const connectedPeers = new Map();

wss.on('connection', (ws, req) => {
  if (req.url === '/') {
    localClients.push(ws);
    ws.on('close', () => localClients = localClients.filter(c => c !== ws));
  }
});

function notifyLocal(data) {
  localClients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(JSON.stringify(data)); });
}

// ==========================================
// EPIDEMIC GOSSIP (5 Random Peers)
// ==========================================
function gossipToMesh(message) {
  const peersArray = Array.from(connectedPeers.values());
  // Shuffle and pick up to 5 random peers
  const randomPeers = peersArray.sort(() => 0.5 - Math.random()).slice(0, 5);
  
  randomPeers.forEach(peer => {
    if (peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify(message));
  });
}

// Background Mana Loop (Updates SQLite)
setInterval(() => {
  const users = db.prepare('SELECT id, mana FROM users WHERE mana < 100').all();
  const updateMana = db.prepare('UPDATE users SET mana = ? WHERE id = ?');
  users.forEach(u => {
    const newMana = Math.min(100, u.mana + 2);
    updateMana.run(newMana, u.id);
    notifyLocal({ type: 'MANA_UPDATE', userId: u.id, mana: newMana });
  });
}, 5000);

// ==========================================
// ROUTES & GLOBAL IDENTITY
// ==========================================
app.post('/api/users/register', (req, res) => {
  const { id, seed } = req.body;
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!existing) {
    db.prepare('INSERT INTO users (id, seed, mana) VALUES (?, ?, 100)').run(id, seed);
    const userObj = { id, seed, mana: 100 };
    gossipToMesh({ type: 'GOSSIP_USER', user: userObj }); // Propagate global identity
  }
  res.json({ success: true });
});

app.post('/api/users/login', (req, res) => {
  const { id, seed } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND seed = ?').get(id, seed);
  if (user) res.json({ success: true, mana: user.mana });
  else res.status(401).json({ error: 'Invalid ID or Seed across the mesh.' });
});

app.get('/api/users/:id/mana', (req, res) => {
  const user = db.prepare('SELECT mana FROM users WHERE id = ?').get(req.params.id);
  res.json({ mana: user ? user.mana : 0 });
});

app.get('/api/feed', (req, res) => {
  const rumors = db.prepare("SELECT * FROM dag WHERE type = 'RUMOR' ORDER BY timestamp DESC").all();
  const allVotes = db.prepare("SELECT * FROM dag WHERE type = 'VOTE'").all();
  
  const userReputation = {};
  allVotes.forEach(v => {
    if (!userReputation[v.voterId]) userReputation[v.voterId] = 1.0;
    userReputation[v.voterId] += 0.2; 
  });

  const feedWithScores = rumors.map(rumor => {
    const postVotes = allVotes.filter(n => n.parentId === rumor.id);
    let score = 0.5; 
    if (postVotes.length > 0) {
      let wPos = 0; let tWeight = 0;
      postVotes.forEach(v => {
        const weight = Math.min(userReputation[v.voterId] || 1.0, 5.0); 
        tWeight += weight;
        if (v.vote === 1) wPos += weight;
      });
      score = wPos / tWeight; 
    }
    return { ...rumor, score, totalVotes: postVotes.length };
  });

  res.json(feedWithScores);
});

app.post('/api/rumors', (req, res) => {
  const { text, authorId } = req.body;
  const user = db.prepare('SELECT mana FROM users WHERE id = ?').get(authorId);
  if (!user || user.mana < 50) return res.status(403).json({ error: 'Need 50 Mana.' });
  
  db.prepare('UPDATE users SET mana = mana - 50 WHERE id = ?').run(authorId);
  const newMana = user.mana - 50;
  notifyLocal({ type: 'MANA_UPDATE', userId: authorId, mana: newMana });

  const node = { id: `r_${Date.now()}_${Math.random()}`, type: 'RUMOR', text, authorId, parentId: null, vote: null, voterId: null, timestamp: Date.now() };
  db.prepare('INSERT INTO dag (id, type, text, authorId, timestamp) VALUES (?, ?, ?, ?, ?)').run(node.id, node.type, node.text, node.authorId, node.timestamp);
  
  notifyLocal({ type: 'NEW_NODE' });
  gossipToMesh({ type: 'GOSSIP_DAG', node }); 
  res.json(node);
});

// --- THE RESTORED VOTING ROUTE ---
app.post('/api/rumors/:id/votes', (req, res) => {
  const parentId = req.params.id;
  const { vote, voterId } = req.body;

  // 1. Check if user has enough Mana
  const user = db.prepare('SELECT mana FROM users WHERE id = ?').get(voterId);
  if (!user || user.mana < 5) return res.status(403).json({ error: 'Need 5 Mana to vote.' });

  // 2. Anti-Spam Check
  const voteCount = db.prepare('SELECT COUNT(*) as count FROM dag WHERE type = "VOTE" AND voterId = ? AND parentId = ?').get(voterId, parentId).count;
  if (voteCount >= 3) return res.status(429).json({ error: 'Anti-Spam: Max 3 votes per post.' });

  // 3. Deduct Mana
  db.prepare('UPDATE users SET mana = mana - 5 WHERE id = ?').run(voterId);
  const newMana = user.mana - 5;
  notifyLocal({ type: 'MANA_UPDATE', userId: voterId, mana: newMana });

  // 4. Create Vote Node
  const voteNode = { 
    id: `v_${Date.now()}_${Math.random()}`, type: 'VOTE', text: null, authorId: null, 
    parentId: parentId, vote: vote, voterId: voterId, timestamp: Date.now() 
  };
  
  db.prepare('INSERT INTO dag (id, type, text, authorId, parentId, vote, voterId, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    voteNode.id, voteNode.type, voteNode.text, voteNode.authorId, voteNode.parentId, voteNode.vote, voteNode.voterId, voteNode.timestamp
  );

  // 5. Update Feed and Gossip
  notifyLocal({ type: 'NEW_NODE' });
  gossipToMesh({ type: 'GOSSIP_DAG', node: voteNode }); 
  res.json(voteNode);
});

app.delete('/api/users/:id', (req, res) => {
  const id = req.params.id;
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  db.prepare('DELETE FROM dag WHERE authorId = ? OR voterId = ?').run(id, id); 
  
  notifyLocal({ type: 'NEW_NODE' });
  gossipToMesh({ type: 'GOSSIP_DELETE', userId: id }); 
  res.json({ success: true });
});

// ==========================================
// P2P MESH NETWORKING
// ==========================================
function connectToPeer(port) {
  if (port == PORT || connectedPeers.has(port)) return; 
  
  const peerWs = new WebSocket(`ws://localhost:${port}/peer`);
  
  peerWs.on('open', () => {
    connectedPeers.set(port, peerWs);
    notifyLocal({ type: 'PEER_UPDATE', count: connectedPeers.size });
    peerWs.send(JSON.stringify({ type: 'SYNC_REQ' }));
  });

  peerWs.on('message', (msg) => handlePeerMessage(peerWs, JSON.parse(msg)));
  peerWs.on('close', () => { connectedPeers.delete(port); notifyLocal({ type: 'PEER_UPDATE', count: connectedPeers.size }); });
  peerWs.on('error', () => {});
}

function handlePeerMessage(ws, data) {
  if (data.type === 'SYNC_REQ') {
    const fullDag = db.prepare('SELECT * FROM dag').all();
    const allUsers = db.prepare('SELECT * FROM users').all();
    ws.send(JSON.stringify({ type: 'SYNC_RES', fullDag, allUsers }));
  }
  if (data.type === 'SYNC_RES') {
    const insertDag = db.prepare('INSERT OR IGNORE INTO dag (id, type, text, authorId, parentId, vote, voterId, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, seed, mana) VALUES (?, ?, ?)');
    
    db.transaction(() => {
      data.fullDag.forEach(n => insertDag.run(n.id, n.type, n.text, n.authorId, n.parentId, n.vote, n.voterId, n.timestamp));
      data.allUsers.forEach(u => insertUser.run(u.id, u.seed, u.mana));
    })();
    notifyLocal({ type: 'NEW_NODE' });
  }
  if (data.type === 'GOSSIP_DAG') {
    const res = db.prepare('INSERT OR IGNORE INTO dag (id, type, text, authorId, parentId, vote, voterId, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(data.node.id, data.node.type, data.node.text, data.node.authorId, data.node.parentId, data.node.vote, data.node.voterId, data.node.timestamp);
    if (res.changes > 0) { notifyLocal({ type: 'NEW_NODE' }); gossipToMesh(data); }
  }
  if (data.type === 'GOSSIP_USER') {
    const res = db.prepare('INSERT OR IGNORE INTO users (id, seed, mana) VALUES (?, ?, ?)').run(data.user.id, data.user.seed, data.user.mana);
    if (res.changes > 0) gossipToMesh(data);
  }
  if (data.type === 'GOSSIP_DELETE') {
    db.prepare('DELETE FROM users WHERE id = ?').run(data.userId);
    db.prepare('DELETE FROM dag WHERE authorId = ? OR voterId = ?').run(data.userId, data.userId);
    notifyLocal({ type: 'NEW_NODE' });
    gossipToMesh(data);
  }
}

// US13/Modified: Check for peers every 7 seconds
setInterval(() => {
  for (let p = 5000; p <= 5900; p++) {
    if (Math.random() > 0.8) connectToPeer(p); // Sparse scanning for performance
  }
}, 7000);

wss.on('connection', (ws, req) => {
  if (req.url === '/peer') {
    ws.on('message', (msg) => handlePeerMessage(ws, JSON.parse(msg)));
  }
});

server.listen(PORT, () => console.log(`Decentralized DB Node active on ${PORT}`));