import { Chess } from 'chess.js';

const CRITICAL_CLASSIFICATIONS = new Set(['blunder', 'mistake', 'inaccuracy']);

export function isCriticalMove(move) {
  return Boolean(move?.isPlayerMove && CRITICAL_CLASSIFICATIONS.has(move.classification));
}

export function toSanFromUci(fen, uciMove) {
  if (!fen || !uciMove) return null;
  const match = String(uciMove).match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
  if (!match) return null;

  const chess = new Chess(fen);
  const [, from, to, promotion] = match;
  try {
    const played = chess.move({ from, to, promotion });
    return played?.san || null;
  } catch {
    return null;
  }
}

export function formatPunishmentLine(line = []) {
  if (!line.length) return 'No forcing punishment found at current depth.';
  return line.map((step, index) => `${index + 1}. ${step.san}`).join(' · ');
}

export function detectTrainingTheme(move, punishmentLine = []) {
  const lineSans = punishmentLine.map((step) => step.san || '');

  if (containsBackRankPattern(lineSans)) return 'back-rank';
  if (containsForkPattern(lineSans)) return 'fork';
  if (containsPinPattern(lineSans)) return 'pin';
  if (isLikelyHangingTheme(move)) return 'hanging';
  return 'hanging';
}

function containsBackRankPattern(lineSans) {
  return lineSans.some((san) => /^[QR].*[+#]$/.test(san));
}

function containsForkPattern(lineSans) {
  return lineSans.some((san) => /^N.*([+#]|x)/.test(san));
}

function containsPinPattern(lineSans) {
  return lineSans.some((san) => /^[BQ].*\+/.test(san));
}

function isLikelyHangingTheme(move) {
  if (!move) return false;
  return (move.evalDrop || 0) >= 1 || (move.classification === 'blunder' && !String(move.san || '').includes('x'));
}
