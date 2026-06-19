'use strict';

/**
 * Historical consensus-alignment reputation.
 * A voter gains reputation when they agree with the eventual community consensus
 * on a post (>=3 votes), and loses it when they vote against it. Reputation is
 * floored at 0.1 so nobody is fully silenced.
 */
function calculateReputations(db) {
  const allVotes = db.prepare("SELECT parentId, vote, voterId FROM dag WHERE type = 'VOTE'").all();
  const userReputation = {};

  const postConsensus = {};
  for (const v of allVotes) {
    if (!postConsensus[v.parentId]) postConsensus[v.parentId] = { verify: 0, dispute: 0 };
    if (v.vote === 1) postConsensus[v.parentId].verify++;
    if (v.vote === -1) postConsensus[v.parentId].dispute++;
  }

  for (const v of allVotes) {
    if (!userReputation[v.voterId]) userReputation[v.voterId] = 1.0;
    const consensus = postConsensus[v.parentId];
    const totalVotes = consensus.verify + consensus.dispute;
    if (totalVotes >= 3) {
      const isVerified = consensus.verify > consensus.dispute;
      const isDisputed = consensus.dispute > consensus.verify;
      if ((isVerified && v.vote === 1) || (isDisputed && v.vote === -1)) {
        userReputation[v.voterId] += 0.2;
      } else if ((isVerified && v.vote === -1) || (isDisputed && v.vote === 1)) {
        userReputation[v.voterId] -= 0.4;
      }
    }
  }

  for (const id in userReputation) {
    userReputation[id] = Math.max(0.1, userReputation[id]);
  }
  return userReputation;
}

function authorTagFor(rep) {
  if (rep >= 1.6) return 'Trusted User';
  if (rep < 1.0) return 'Untrustworthy User';
  return 'Neutral User';
}

module.exports = { calculateReputations, authorTagFor };
