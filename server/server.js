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

const db = new Database(`node_${PORT}.db`); 
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, seed TEXT, mana INTEGER, email_hash TEXT UNIQUE);
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

function gossipToMesh(message) {
  const peersArray = Array.from(connectedPeers.values());
  const randomPeers = peersArray.sort(() => 0.5 - Math.random()).slice(0, 5);
  randomPeers.forEach(peer => {
    if (peer.readyState === WebSocket.OPEN) peer.send(JSON.stringify(message));
  });
}

setInterval(() => {
  const users = db.prepare('SELECT id, mana FROM users WHERE mana < 100').all();
  const updateMana = db.prepare('UPDATE users SET mana = ? WHERE id = ?');
  users.forEach(u => {
    const newMana = Math.min(100, u.mana + 2);
    updateMana.run(newMana, u.id);
    notifyLocal({ type: 'MANA_UPDATE', userId: u.id, mana: newMana });
  });
}, 5000);

// NEW: True Historical Consensus Alignment
function calculateReputations() {
  const allVotes = db.prepare("SELECT * FROM dag WHERE type = 'VOTE'").all();
  const userReputation = {};
  
  // Step 1: Figure out the "Ground Truth" (Consensus) for every post
  const postConsensus = {};
  allVotes.forEach(v => {
    if (!postConsensus[v.parentId]) postConsensus[v.parentId] = { verify: 0, dispute: 0 };
    if (v.vote === 1) postConsensus[v.parentId].verify++;
    if (v.vote === -1) postConsensus[v.parentId].dispute++;
  });

  // Step 2: Reward or Penalize users based on if they agreed with the community
  allVotes.forEach(v => {
    if (!userReputation[v.voterId]) userReputation[v.voterId] = 1.0; // Everyone starts at 1.0

    const consensus = postConsensus[v.parentId];
    const totalVotes = consensus.verify + consensus.dispute;

    // We only judge accuracy if at least 3 people have voted on the post 
    if (totalVotes >= 3) {
      const isPostVerified = consensus.verify > consensus.dispute;
      const isPostDisputed = consensus.dispute > consensus.verify;

      if ((isPostVerified && v.vote === 1) || (isPostDisputed && v.vote === -1)) {
        // Voted with the majority: Small Reward
        userReputation[v.voterId] += 0.2;
      } else if ((isPostVerified && v.vote === -1) || (isPostDisputed && v.vote === 1)) {
        // Voted against the majority (Troll/Spam): Heavy Penalty
        userReputation[v.voterId] -= 0.4; 
      }
    }
  });

  // Step 3: Ensure reputation doesn't drop into negative numbers (hard floor of 0.1)
  for (let id in userReputation) {
    userReputation[id] = Math.max(0.1, userReputation[id]);
  }

  return userReputation;
}

app.post('/api/users/register', (req, res) => {
  const { id, seed, emailHash } = req.body;
  try {
    db.prepare('INSERT INTO users (id, seed, mana, email_hash) VALUES (?, ?, 100, ?)').run(id, seed, emailHash);
    const userObj = { id, seed, mana: 100, emailHash };
    gossipToMesh({ type: 'GOSSIP_USER', user: userObj }); 
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Email already registered.' });
    }
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/users/login', (req, res) => {
  const { id, seed } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND seed = ?').get(id, seed);
  if (user) res.json({ success: true, mana: user.mana });
  else res.status(401).json({ error: 'Invalid ID or Seed.' });
});

app.get('/api/users/:id/mana', (req, res) => {
  const user = db.prepare('SELECT mana FROM users WHERE id = ?').get(req.params.id);
  res.json({ mana: user ? user.mana : 0 });
});

app.get('/api/users/:id/trust', (req, res) => {
  const reps = calculateReputations();
  res.json({ trust: reps[req.params.id] || 1.0 });
});

app.get('/api/feed', (req, res) => {
  const rumors = db.prepare("SELECT * FROM dag WHERE type = 'RUMOR' ORDER BY timestamp DESC").all();
  const allVotes = db.prepare("SELECT * FROM dag WHERE type = 'VOTE'").all();
  const reps = calculateReputations();

  const feedWithScores = rumors.map(rumor => {
    const postVotes = allVotes.filter(n => n.parentId === rumor.id);
    let score = 0.5; 
    
    if (postVotes.length > 0) {
      let wPos = 0; let tWeight = 0;
      postVotes.forEach(v => {
        const weight = Math.min(reps[v.voterId] || 1.0, 5.0); 
        tWeight += weight;
        if (v.vote === 1) wPos += weight;
      });
      score = wPos / tWeight; 
    }

    const authorRep = reps[rumor.authorId] || 1.0;
    let authorTag = "Neutral User";
    if (authorRep >= 1.6) authorTag = "Trusted User";
    else if (authorRep < 1.0) authorTag = "Untrustworthy User";

    return { ...rumor, score, totalVotes: postVotes.length, authorTag };
  });

  res.json(feedWithScores);
});

app.post('/api/rumors', (req, res) => {
  const { text, authorId } = req.body;
  const user = db.prepare('SELECT mana FROM users WHERE id = ?').get(authorId);
  if (!user || user.mana < 50) return res.status(403).json({ error: 'Need 50 Mana.' });
  
  db.prepare('UPDATE users SET mana = mana - 50 WHERE id = ?').run(authorId);
  notifyLocal({ type: 'MANA_UPDATE', userId: authorId, mana: user.mana - 50 });

  const node = { id: `r_${Date.now()}_${Math.random()}`, type: 'RUMOR', text, authorId, parentId: null, vote: null, voterId: null, timestamp: Date.now() };
  db.prepare('INSERT INTO dag (id, type, text, authorId, timestamp) VALUES (?, ?, ?, ?, ?)').run(node.id, node.type, node.text, node.authorId, node.timestamp);
  
  notifyLocal({ type: 'NEW_NODE' });
  gossipToMesh({ type: 'GOSSIP_DAG', node }); 
  res.json(node);
});

app.post('/api/rumors/:id/votes', (req, res) => {
  const parentId = req.params.id;
  const { vote, voterId } = req.body;

  const user = db.prepare('SELECT mana FROM users WHERE id = ?').get(voterId);
  if (!user || user.mana < 5) return res.status(403).json({ error: 'Need 5 Mana to vote.' });

  // STRICT LOCK: Ensure this specific user has not voted on this specific post
  const existingVote = db.prepare('SELECT id FROM dag WHERE type = "VOTE" AND voterId = ? AND parentId = ?').get(voterId, parentId);
  if (existingVote) return res.status(429).json({ error: 'Restriction: You have already voted on this post.' });

  db.prepare('UPDATE users SET mana = mana - 5 WHERE id = ?').run(voterId);
  notifyLocal({ type: 'MANA_UPDATE', userId: voterId, mana: user.mana - 5 });

  const voteNode = { id: `v_${Date.now()}_${Math.random()}`, type: 'VOTE', text: null, authorId: null, parentId: parentId, vote: vote, voterId: voterId, timestamp: Date.now() };
  db.prepare('INSERT INTO dag (id, type, text, authorId, parentId, vote, voterId, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
    voteNode.id, voteNode.type, voteNode.text, voteNode.authorId, voteNode.parentId, voteNode.vote, voteNode.voterId, voteNode.timestamp
  );

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
    const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, seed, mana, email_hash) VALUES (?, ?, ?, ?)');
    db.transaction(() => {
      data.fullDag.forEach(n => insertDag.run(n.id, n.type, n.text, n.authorId, n.parentId, n.vote, n.voterId, n.timestamp));
      data.allUsers.forEach(u => insertUser.run(u.id, u.seed, u.mana, u.email_hash));
    })();
    notifyLocal({ type: 'NEW_NODE' });
  }
  if (data.type === 'GOSSIP_DAG') {
    const res = db.prepare('INSERT OR IGNORE INTO dag (id, type, text, authorId, parentId, vote, voterId, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(data.node.id, data.node.type, data.node.text, data.node.authorId, data.node.parentId, data.node.vote, data.node.voterId, data.node.timestamp);
    if (res.changes > 0) { notifyLocal({ type: 'NEW_NODE' }); gossipToMesh(data); }
  }
  if (data.type === 'GOSSIP_USER') {
    const res = db.prepare('INSERT OR IGNORE INTO users (id, seed, mana, email_hash) VALUES (?, ?, ?, ?)').run(data.user.id, data.user.seed, data.user.mana, data.user.emailHash);
    if (res.changes > 0) gossipToMesh(data);
  }
  if (data.type === 'GOSSIP_DELETE') {
    db.prepare('DELETE FROM users WHERE id = ?').run(data.userId);
    db.prepare('DELETE FROM dag WHERE authorId = ? OR voterId = ?').run(data.userId, data.userId);
    notifyLocal({ type: 'NEW_NODE' });
    gossipToMesh(data);
  }
}

setInterval(() => {
  for (let p = 5000; p <= 5900; p++) if (Math.random() > 0.8) connectToPeer(p);
}, 3000);

wss.on('connection', (ws, req) => {
  if (req.url === '/peer') ws.on('message', (msg) => handlePeerMessage(ws, JSON.parse(msg)));
});

server.listen(PORT, () => console.log(`Decentralized DB Node active on ${PORT}`));