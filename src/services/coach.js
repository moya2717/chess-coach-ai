// ═══════════════════════════════════════════
// Coaching / Natural Language Service
// ═══════════════════════════════════════════
// This is the "voice" of your coach. It takes the raw
// engine analysis and turns it into human-friendly
// explanations with analogies.
//
// For now, this uses rule-based templates. In the full
// version, you'd plug in Claude's API here to generate
// truly personalized, context-aware coaching.
//
// To use Claude API, you'd replace generateCoachComment()
// with an API call like:
//
//   const response = await fetch('https://api.anthropic.com/v1/messages', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       model: 'claude-sonnet-4-20250514',
//       max_tokens: 500,
//       messages: [{ role: 'user', content: prompt }]
//     })
//   });
//
// The prompt would include the position, the move played,
// the best move, and the evaluation change.
// ═══════════════════════════════════════════

/**
 * Generate a coaching comment for a specific move
 *
 * @param {Object} move - Analyzed move object from analysis service
 * @param {Object} context - Additional context (opening name, game phase, etc.)
 * @returns {Object} { classification, text, tip }
 */
export function generateCoachComment(move, context = {}) {
  const { san, evalDrop, classification, phase, isPlayerMove, fenAfter } = move;

  // If it's not the player's move, give a brief comment about the opponent
  if (!isPlayerMove) {
    return {
      classification: 'book',
      text: `Your opponent played <strong>${san}</strong>. Let's see how you respond.`,
      tip: null,
    };
  }

  // Generate classification-specific coaching
  switch (classification) {
    case 'blunder':
      return generateBlunderComment(san, evalDrop, phase, context);
    case 'mistake':
      return generateMistakeComment(san, evalDrop, phase, context);
    case 'inaccuracy':
      return generateInaccuracyComment(san, evalDrop, phase, context);
    case 'great':
      return generateGreatMoveComment(san, phase, context);
    default:
      return generateGoodMoveComment(san, phase, context);
  }
}

function generateBlunderComment(san, evalDrop, phase, context) {
  const analogies = [
    `This is like accidentally leaving your front door wide open — it gave your opponent a free invitation to take advantage.`,
    `Think of this as a wrong turn onto a one-way street going the wrong direction. The position went from manageable to difficult in one move.`,
    `Imagine setting up dominoes carefully, then accidentally knocking them all over. One move undid a lot of your previous work.`,
  ];

  const tips = {
    opening: `In the opening, blunders often come from moving the same piece twice or neglecting development. Before each move, ask: "Am I developing a new piece or creating a real threat?"`,
    middlegame: `Middlegame blunders usually happen when you stop checking for your opponent's threats. Before your move, always ask: "What is my opponent threatening RIGHT NOW?"`,
    endgame: `Endgame blunders often come from passivity. Remember: in the endgame, your King should be marching toward the center, not hiding in the corner.`,
  };

  return {
    classification: 'blunder',
    text: `<strong>${san}</strong> is a serious blunder (evaluation dropped by ${evalDrop.toFixed(1)} pawns). ${analogies[Math.floor(Math.random() * analogies.length)]}`,
    tip: tips[phase] || tips.middlegame,
  };
}

function generateMistakeComment(san, evalDrop, phase, context) {
  const analogies = [
    `This is like making a wrong turn on a road trip — you're not lost, but you'll need some extra work to get back on track.`,
    `Think of it like choosing the second-best menu item at a restaurant. Not bad, but you missed something better.`,
    `It's like a basketball player taking a contested mid-range shot when they had an open teammate under the basket.`,
  ];

  const tips = {
    opening: `In the opening, mistakes often come from ignoring the center. Make sure your first moves fight for the d4, d5, e4, and e5 squares.`,
    middlegame: `This kind of mistake is often about piece activity. Ask yourself: "Is every one of my pieces doing something useful? Which piece is my laziest worker?"`,
    endgame: `In the endgame, remember Capablanca's advice: "Before pushing a pawn, make sure your pieces are on their best possible squares first."`,
  };

  return {
    classification: 'mistake',
    text: `<strong>${san}</strong> is a mistake that gives up some of your advantage. ${analogies[Math.floor(Math.random() * analogies.length)]}`,
    tip: tips[phase] || tips.middlegame,
  };
}

function generateInaccuracyComment(san, evalDrop, phase, context) {
  return {
    classification: 'inaccuracy',
    text: `<strong>${san}</strong> is a small inaccuracy. Not a crisis, but there was a slightly more precise option available. Think of it like taking the scenic route when the highway was open — you'll still get there, but it took a little longer.`,
    tip: phase === 'endgame'
      ? `In endgames, small inaccuracies add up. Every move matters more because there are fewer pieces to bail you out.`
      : `Try to spend a few extra seconds looking for candidate moves before committing. Often the first move that catches your eye isn't the best one.`,
  };
}

function generateGreatMoveComment(san, phase, context) {
  const compliments = [
    `Excellent move! You found the engine's top choice.`,
    `Strong play here — this is the kind of move that wins games.`,
    `Really well played. You're seeing the position clearly.`,
    `This is precise. You're making your opponent's life difficult.`,
  ];

  return {
    classification: 'great',
    text: `<strong>${san}</strong> — ${compliments[Math.floor(Math.random() * compliments.length)]} Keep trusting this kind of thinking.`,
    tip: null,
  };
}

function generateGoodMoveComment(san, phase, context) {
  return {
    classification: 'good',
    text: `<strong>${san}</strong> is a solid, reasonable move. You're maintaining your position well — not every move needs to be a firework. Consistency is what separates improving players from stagnant ones.`,
    tip: null,
  };
}

/**
 * Generate a summary of the entire game
 */
export function generateGameSummary(analysis, playerColor, opening) {
  const { accuracy, blunders, mistakes, inaccuracies, phases } = analysis;

  let summaryParts = [];

  // Overall accuracy assessment
  if (accuracy >= 85) {
    summaryParts.push(`You played an excellent game with ${accuracy}% accuracy. Very few mistakes — this is the kind of performance that wins rating points.`);
  } else if (accuracy >= 70) {
    summaryParts.push(`A solid game with ${accuracy}% accuracy. Room for improvement, but the foundation is there.`);
  } else if (accuracy >= 55) {
    summaryParts.push(`This game had some rough patches — ${accuracy}% accuracy with ${blunders} blunder(s) and ${mistakes} mistake(s). Let's look at what went wrong so we can fix it.`);
  } else {
    summaryParts.push(`A tough game at ${accuracy}% accuracy. Don't be discouraged — every strong player has games like this. The important thing is what you learn from it.`);
  }

  // Phase-specific feedback
  const weakestPhase = Object.entries(phases).sort((a, b) => a[1] - b[1])[0];
  summaryParts.push(`Your weakest phase was the <strong>${weakestPhase[0]}</strong> (${weakestPhase[1]}% accuracy). Let's focus your training there.`);

  return summaryParts.join(' ');
}
