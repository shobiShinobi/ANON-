# ANON - Campus Social Network (Sprint 1 Prototype)

## Overview
ANON is a conceptual decentralized, anonymous social network designed for university campuses. This repository contains the **Sprint 1 Prototype**, which focuses on validating our core mechanics: anonymous content creation, real-time feed synchronization, and early community moderation (voting/trust scores).

Currently, this prototype uses a centralized Node.js server to simulate the peer-to-peer mesh network we will implement in later sprints.

## Sprint 1 Features (Mapped to User Stories)
* **Create Posts (US4):** Users can broadcast 500-character text updates to the network.
* **Real-Time Feed (US5):** A chronological feed that updates instantly across all connected clients using WebSockets.
* **Community Moderation (US7):** Users can cast "+1 Verify" or "-1 Dispute" votes on rumors to establish community consensus.
* **Trust Badges (US9):** Posts dynamically calculate a reliability score (0.0 to 1.0) and display color-coded badges (`VERIFIED`, `NEUTRAL`, `DISPUTED`).
* **Anti-Spam Rate Limiting (Epic 4):** Users are restricted to a maximum of 3 votes per post to prevent review-bombing. 
* *Hidden Easter Egg:* Trigger a special UI animation by getting a post to exactly a 0.67 score or 67 total votes!

## Tech Stack
* **Frontend:** React, Vite, Tailwind CSS (via CDN for easy prototyping)
* **Backend:** Node.js, Express
* **Communication:** WebSockets (`ws`)
* **Storage:** In-memory DAG (Directed Acyclic Graph) arrays (SQLite implementation planned for Sprint 2)

---

## How to Run (Windows)

We have provided batch scripts to make running the environment seamless. Ensure all files (`server.js`, `Feed.jsx`, `PostForm.jsx`, etc.) are in the same directory.

### Step 1: Install Dependencies
Double-click **`0_install.bat`**. 
*This only needs to be run once to install the required Node modules (Express, React, Vite, ws).*

### Step 2: Start the Network & User A
Double-click **`1_run_network_and_user_A.bat`**. 
*This will open two terminal windows: one running the backend server on port 5000, and one running the Vite frontend. A browser window will open at `http://localhost:5173`.*

### Step 3: Simulate a Second User (User B)
Double-click **`2_run_user_B.bat`**.
*This will open a second frontend instance on port 5174. You can place the two browser windows side-by-side to test real-time WebSocket synchronization.*

---

## Testing Guide for Graders
1. **Real-Time Sync:** Post a message as User A. Watch it appear instantly on User B's screen without refreshing.
2. **Voting:** Have User B click "+1 Verify" on User A's post. The Trust Badge will turn green.
3. **Rate Limiting:** Click the vote button on a single post 4 times rapidly. A red error banner will appear indicating the Anti-Spam system has blocked the action.