import { describe, expect, it } from 'vitest';
import { detectPatterns } from './analysis';
import sampleGames from '../test/fixtures/sample-games-analysis.json';

describe('detectPatterns', () => {
  it('returns sorted patterns from normalized game analyses', () => {
    const patterns = detectPatterns(sampleGames);

    expect(patterns.map(({ name }) => name)).toEqual([
      'Hanging Pieces',
      'Weak Endgame Technique',
      'Opening Preparation Gaps',
      'Missed Tactical Opportunities',
    ]);
    expect(patterns[0]).toMatchObject({ severity: 'critical', frequency: 67 });
  });

  it('returns empty array when analyses are unavailable', () => {
    expect(detectPatterns([{ id: 'g1' }])).toEqual([]);
  });
});
