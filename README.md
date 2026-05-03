# ANON - Campus Social Network (Sprint 1 Prototype)

## Overview
ANON is a prototype of a campus-centric anonymous social network. This repo demonstrates a simulated decentralized mesh node with local identity, verified campus access, reputation-aware voting, and live feed synchronization.

This prototype runs a local SQLite-backed node (`server/server.js`) and a React frontend via Vite. The mesh is simulated by gossiping node and feed data between peer nodes over WebSocket connections.

## Current Features
* **Campus-Verified Onboarding:** Sign up with a `.edu` email, which is hashed and discarded. The app generates a Node ID and a 12-word recovery seed.
* **Seed-Based Login:** Recover a mesh identity with Node ID + seed phrase and reconnect to the network.
* **Broadcast Rumors:** Post up to 500 characters of anonymous campus updates. Each post costs 50 Mana.
* **Real-Time Feed Sync:** New posts and votes propagate instantly through the local node and connected peers via WebSockets and gossip.
* **Trust Scoring:** Each post shows a dynamic score from `0.00` to `1.00`, with color-coded badges for `VERIFIED`, `NEUTRAL`, and `DISPUTED`.
* **Reputation-Based Author Tags:** Authors are labeled `Trusted User`, `Neutral User`, or `Untrustworthy User` based on historical voting consensus.
* **Consensus-Weighted Voting:** Votes are weighted by voter reputation, which is recalculated across the node's DAG history.
* **Mana System:** Posting consumes Mana, voting costs 5 Mana, and Mana regenerates over time.
* **Vote Lock Enforcement:** Users can vote only once per post, and the UI disables vote buttons after a vote.
* **Identity Controls:** Log out, or permanently destroy your identity and all related local posts/votes from the node.
* **Profile & Peer Status:** Profile page shows node trust multiplier, mana, and active peer count.
* **Network Terminal Logs:** Built-in debug console shows gossip, peer, and event activity.

## Tech Stack
* **Frontend:** React, Vite
* **Backend:** Node.js, Express
* **Realtime:** WebSockets (`ws`)
* **Storage:** SQLite via `better-sqlite3`

---

## Running the Prototype (Windows)

### 1. Install dependencies
Double-click **`0_install.bat`** or run:

```bash
npm install
```


### 2. Start a local node
Use the launcher to start a backend node and frontend together:

```bash
node launcher.js
```

Or use the batch script:

```bash
Start_New_Node.bat
```

This selects a random backend port between `5000` and `5900`, launches the React app on a matching frontend port, and stores node data in `node_<port>.db`.


### 3. Open additional nodes
Run `node launcher.js` or `Start_New_Node.bat` again in a second terminal to simulate another peer. Each node runs independently and gossip-syncs with available peers.

---

## Manual Startup (Alternative)
If you want to run the backend and frontend separately:

```bash
node server/server.js
npm run dev
```

> Note: the app currently expects the frontend to know the backend port via `VITE_BACKEND_PORT`.

---

## What to Check
1. **Sign up with a `.edu` email** and copy your generated Node ID and seed phrase.
2. **Create a post** and verify it appears in the feed.
3. **Open another node** and confirm the new post syncs automatically.
4. **Vote on a post** and observe the trust badge and author tags update.
5. **View your profile** to see Mana, trust multiplier, and peer connectivity.
6. **Use Destroy Identity** to remove your local identity and associated DAG data from the node.