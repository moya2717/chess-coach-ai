// ═══════════════════════════════════════════
// Coaching / Natural Language Service
// ═══════════════════════════════════════════

/**
 * Generate a coaching comment for a specific move
 *
 * @param {Object} move - Analyzed move object from analysis service
 * @param {Object} context - Additional context (opening name, game phase, etc.)
 * @returns {Object} { classification, text, tip }
 */
export function generateCoachComment(move, context = {}) {
  const { san, evalDrop, classification, phase, isPlayerMove, bestMove, playerMatchedBestMove, evalSwing, evalSource } = move;

  if (!isPlayerMove) {
    return {
      classification: 'book',
      text: buildOpponentMoveComment(san, evalSwing),
      tip: null,
    };
  }

  const evalContext = buildEvalContext(evalDrop, evalSwing);

  if (evalSource === 'material') {
    return {
      classification: classification === 'book' ? 'good' : classification,
      text: `<strong>${san}</strong> was reviewed with material fallback only, so this feedback is directional rather than exact.`,
      tip: 'Re-run this game when engine access is stable to get precise move-by-move recommendations.',
    };
  }

  switch (classification) {
    case 'blunder':
      return generateBlunderComment(san, evalDrop, phase, evalContext);
    case 'mistake':
      return generateMistakeComment(san, evalDrop, phase, evalContext);
    case 'inaccuracy':
      return generateInaccuracyComment(san, evalDrop, phase, evalContext);
    case 'best':
      return generateBestMoveComment(san, phase, bestMove, playerMatchedBestMove);
    case 'excellent':
      return generateExcellentMoveComment(san, phase, bestMove, playerMatchedBestMove);
    case 'great':
      return generateGreatMoveComment(san, phase, bestMove, playerMatchedBestMove);
    case 'book':
      return generateBookMoveComment(san, bestMove, playerMatchedBestMove, phase);
    default:
      return generateGoodMoveComment(san, phase, bestMove, playerMatchedBestMove);
  }
}

function buildOpponentMoveComment(san, evalSwing = 0) {
  if (evalSwing <= -1.5) {
    return `Your opponent played <strong>${san}</strong> and significantly improved their position. This is a critical moment — look for active counterplay.`;
  }
  if (evalSwing <= -0.5) {
    return `Your opponent played <strong>${san}</strong> and gained some momentum. Pause and identify their immediate threat before moving.`;
  }
  if (evalSwing >= 0.75) {
    return `Your opponent played <strong>${san}</strong>, but it gives you practical chances. Look for tactical ideas or forcing moves.`;
  }
  return `Your opponent played <strong>${san}</strong>. Let's find the most accurate reply.`;
}

function buildEvalContext(evalDrop, evalSwing = 0) {
  const roundedSwing = Number(evalSwing || 0).toFixed(1);
  if (evalDrop > 2) return `The move changed the evaluation by ${roundedSwing} and turned the game sharply.`;
  if (evalDrop > 1) return `The evaluation shifted by ${roundedSwing}, so the position became more difficult.`;
  if (evalDrop > 0.4) return `There was a small evaluation swing (${roundedSwing}), but the game is still playable.`;
  return `Evaluation stayed stable (${roundedSwing}), which is what strong practical play looks like.`;
}

function generateBlunderComment(san, evalDrop, phase, evalContext) {
  const tips = {
    opening: 'In the opening, prioritize king safety and development before pawn grabs.',
    middlegame: 'Before committing, run a blunder-check: checks, captures, and threats for both sides.',
    endgame: 'In endgames, activate your king and avoid pawn moves that create permanent weaknesses.',
  };

  return {
    classification: 'blunder',
    text: `<strong>${san}</strong> is a blunder (−${evalDrop.toFixed(1)}). ${evalContext}`,
    tip: tips[phase] || tips.middlegame,
  };
}

function generateMistakeComment(san, evalDrop, phase, evalContext) {
  const tips = {
    opening: 'Re-check opening principles: central control, development, and king safety.',
    middlegame: 'List two candidate moves and compare them before choosing one.',
    endgame: 'In simplified positions, calculate king opposition and pawn races first.',
  };

  return {
    classification: 'mistake',
    text: `<strong>${san}</strong> is a mistake (−${evalDrop.toFixed(1)}). ${evalContext}`,
    tip: tips[phase] || tips.middlegame,
  };
}

function generateInaccuracyComment(san, evalDrop, phase, evalContext) {
  const phaseTip = phase === 'endgame'
    ? 'Small inaccuracies in endgames compound quickly — be precise with king and pawn moves.'
    : 'Take 5 extra seconds to compare tactical forcing lines before playing.';

  return {
    classification: 'inaccuracy',
    text: `<strong>${san}</strong> is an inaccuracy (−${evalDrop.toFixed(1)}). ${evalContext}`,
    tip: phaseTip,
  };
}

function generateBestMoveComment(san, phase, bestMove, playerMatchedBestMove) {
  return {
    classification: 'best',
    text: `<strong>${san}</strong> is the top engine choice. ${buildBestMoveReference(bestMove, playerMatchedBestMove)}`,
    tip: null,
  };
}

function generateExcellentMoveComment(san, phase, bestMove, playerMatchedBestMove) {
  return {
    classification: 'excellent',
    text: `<strong>${san}</strong> is an excellent practical move. ${buildBestMoveReference(bestMove, playerMatchedBestMove)}`,
    tip: null,
  };
}

function generateGreatMoveComment(san, phase, bestMove, playerMatchedBestMove) {
  return {
    classification: 'great',
    text: `<strong>${san}</strong> keeps strong pressure. ${buildBestMoveReference(bestMove, playerMatchedBestMove)}`,
    tip: null,
  };
}

function generateBookMoveComment(san, bestMove, playerMatchedBestMove, phase) {
  return {
    classification: 'book',
    text: `<strong>${san}</strong> keeps you in known opening territory. ${buildBestMoveReference(bestMove, playerMatchedBestMove)}`,
    tip: phase === 'opening' ? 'Use your prep to reach a familiar middlegame, then shift into calculation mode.' : null,
  };
}

function generateGoodMoveComment(san, phase, bestMove, playerMatchedBestMove) {
  return {
    classification: 'good',
    text: `<strong>${san}</strong> is a solid move. ${buildBestMoveReference(bestMove, playerMatchedBestMove)}`,
    tip: null,
  };
}

function buildBestMoveReference(bestMove, playerMatchedBestMove) {
  if (!bestMove) return 'No engine reference line was available for this position.';
  return playerMatchedBestMove
    ? `You matched the engine line (${bestMove}).`
    : `Engine preference was ${bestMove}; review why that line was stronger.`;
}

/**
 * Generate a summary of the entire game
 */
export function generateGameSummary(analysis, playerColor, opening) {
  const { accuracy, blunders, mistakes, phases } = analysis;

  const summaryParts = [];

  if (accuracy >= 85) {
    summaryParts.push(`You played an excellent game with ${accuracy}% accuracy and strong consistency.`);
  } else if (accuracy >= 70) {
    summaryParts.push(`Solid game at ${accuracy}% accuracy with good practical decisions.`);
  } else if (accuracy >= 55) {
    summaryParts.push(`Mixed performance: ${accuracy}% accuracy with ${blunders} blunder(s) and ${mistakes} mistake(s).`);
  } else {
    summaryParts.push(`Tough game at ${accuracy}% accuracy, but it's useful material for targeted training.`);
  }

  const weakestPhase = Object.entries(phases).sort((a, b) => a[1] - b[1])[0];
  summaryParts.push(`Weakest phase: <strong>${weakestPhase[0]}</strong> (${weakestPhase[1]}% accuracy).`);

  return summaryParts.join(' ');
}


export function answerFollowUpQuestion(question, context = {}) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return 'Ask about move quality, candidate moves, tactical ideas, or why one line is better.';

  const { currentMove, candidates = [], assessment, phase = 'middlegame' } = context;
  if (q.includes('last move good') || q.includes('was my move good')) {
    if (!currentMove) return 'You are at the start position, so there is no last move to evaluate yet.';
    return `Your move ${currentMove.san} is classified as ${currentMove.classification}. Eval swing: ${Number(currentMove.evalSwing || 0).toFixed(2)}. In ${phase}, compare checks/captures/threats before committing.`;
  }

  if (q.includes('why') && candidates.length) {
    const best = candidates[0];
    return `Top candidate is ${best.san} (eval ${best.eval}). It improves your position by forcing concrete responses. Check motifs: forks, pins, skewers, and prophylaxis against opponent threats.`;
  }

  if (q.includes('threat') && assessment) {
    return `Current threats to calculate first: ${assessment.threats.join(', ')}. Opportunities: ${assessment.opportunities.join(', ')}.`;
  }

  return 'Coach tip: list 3 candidate moves, calculate opponent responses for each, then choose the move that best improves king safety, piece activity, and tactical control.';
}

