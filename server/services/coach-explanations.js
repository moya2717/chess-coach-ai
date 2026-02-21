export function buildMoveCoachExplanation(payload = {}) {
  const san = String(payload.san || 'move');
  const classification = String(payload.classification || 'good');
  const evalDrop = Number(payload.evalDrop || 0);
  const phase = String(payload.phase || 'middlegame');
  const tacticTags = Array.isArray(payload.tacticTags) ? payload.tacticTags : [];
  const plans = Array.isArray(payload.candidatePlans) ? payload.candidatePlans : [];

  const headline = headlineFor(classification, san);
  const impact = impactLine(evalDrop, phase);
  const tactical = tacticTags.length
    ? `Tactical motif(s): ${tacticTags.join(', ')}.`
    : 'No forcing tactical motif detected; prioritize piece activity and king safety.';
  const plan = plans[0] || defaultPlan(phase);

  return {
    headline,
    explanation: `${headline} ${impact} ${tactical}`,
    nextStep: `Try this plan: ${plan}`,
  };
}

function headlineFor(classification, san) {
  const map = {
    blunder: `${san} is a blunder and likely loses substantial equity.`,
    mistake: `${san} is a mistake and drifts from the best practical plan.`,
    inaccuracy: `${san} is an inaccuracy; the position stays playable with care.`,
    good: `${san} is a stable practical choice.`,
    book: `${san} follows expected play for the position.`,
  };
  return map[classification] || `${san} was played.`;
}

function impactLine(evalDrop, phase) {
  if (evalDrop > 2) return `The evaluation swing is severe (${evalDrop.toFixed(2)}), especially critical in the ${phase}.`;
  if (evalDrop > 1) return `The evaluation dropped by ${evalDrop.toFixed(2)} and gave your opponent easier plans.`;
  if (evalDrop > 0.45) return `The move costs about ${evalDrop.toFixed(2)} in evaluation; accuracy can improve with stronger candidate checks.`;
  return `The evaluation impact is limited (${evalDrop.toFixed(2)}), so focus on consistency.`;
}

function defaultPlan(phase) {
  if (phase === 'opening') return 'finish development, castle, and contest the center.';
  if (phase === 'endgame') return 'activate king, create passed pawns, and simplify favorable trades.';
  return 'improve your worst piece and look for forcing checks/captures/threats.';
}
