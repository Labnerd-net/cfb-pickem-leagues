import { describe, it, expect } from 'vitest';
import {
  buildDemoSeed,
  COMPLETED_THROUGH_WEEK,
  CURATION_WEEK,
  DEMO_ADMIN_USER_ID,
  DEMO_USER_USER_ID,
  OPEN_WEEK,
} from '../../../src/demo/seedData.js';
import { demoGameData } from '../../../src/demo/demoGameData.js';
import { makeGameData } from './fixtures.js';

describe('buildDemoSeed', () => {
  it('refuses empty game data (the un-exported placeholder)', () => {
    expect(() => buildDemoSeed({ weeks: [], games: [] })).toThrow(/export:demo-games/);
  });

  it('is deterministic', () => {
    const a = buildDemoSeed(makeGameData());
    const b = buildDemoSeed(makeGameData());
    expect(a).toEqual(b);
  });

  it('assigns fixed IDs to the demo accounts and puts both in the league', () => {
    const seed = buildDemoSeed(makeGameData());
    expect(seed.users.find(u => u.userId === DEMO_ADMIN_USER_ID)?.roles).toEqual(['admin', 'user']);
    expect(seed.users.find(u => u.userId === DEMO_USER_USER_ID)?.roles).toEqual(['user']);
    expect(seed.members.find(m => m.userId === DEMO_ADMIN_USER_ID)?.role).toBe('admin');
    expect(seed.members.find(m => m.userId === DEMO_USER_USER_ID)?.role).toBe('member');
    expect(seed.users.every(u => u.email.endsWith('@demo.invalid'))).toBe(true);
  });

  it('keeps the curation week out of the league pool but in the game cache', () => {
    const seed = buildDemoSeed(makeGameData());
    const curation = seed.games.filter(g => g.weekNumber === CURATION_WEEK);
    expect(curation.length).toBeGreaterThan(0);
    for (const g of curation) expect(seed.leagueGameIds).not.toContain(g.gameId);
    const open = seed.games.filter(g => g.weekNumber === OPEN_WEEK);
    for (const g of open) expect(seed.leagueGameIds).toContain(g.gameId);
  });

  it('derives winners for completed weeks and leaves later weeks pending', () => {
    const seed = buildDemoSeed(makeGameData());
    for (const g of seed.games) {
      if (g.weekNumber <= COMPLETED_THROUGH_WEEK) {
        expect(g.completed).toBe(true);
        expect(g.winningTeam).toBe(g.homePoints! > g.awayPoints! ? 'home_team' : 'away_team');
      } else {
        expect(g.winningTeam).toBe('pending');
        expect(g.homePoints).toBeNull();
      }
    }
  });

  it('only creates picks for pool games, none for the curation week', () => {
    const seed = buildDemoSeed(makeGameData());
    const pool = new Set(seed.leagueGameIds);
    expect(seed.picks.length).toBeGreaterThan(0);
    for (const p of seed.picks) expect(pool.has(p.gameId)).toBe(true);
  });

  it('leaves the open week blank for the two visitor accounts', () => {
    const seed = buildDemoSeed(makeGameData());
    const openIds = new Set(seed.games.filter(g => g.weekNumber === OPEN_WEEK).map(g => g.gameId));
    const visitorOpenPicks = seed.picks.filter(
      p => openIds.has(p.gameId) && (p.userId === DEMO_ADMIN_USER_ID || p.userId === DEMO_USER_USER_ID)
    );
    expect(visitorOpenPicks).toHaveLength(0);
    // ...but they have history in the completed weeks.
    expect(seed.picks.some(p => p.userId === DEMO_USER_USER_ID)).toBe(true);
  });

  it('rejects a completed week with a missing score', () => {
    const data = makeGameData(g => (g.weekNumber === 2 ? { ...g, homePoints: null } : g));
    expect(() => buildDemoSeed(data)).toThrow(/week 2/i);
  });

  it('rejects a future week that already has a result', () => {
    const data = makeGameData(g =>
      g.weekNumber === OPEN_WEEK ? { ...g, completed: true, homePoints: 10, awayPoints: 3 } : g
    );
    expect(() => buildDemoSeed(data)).toThrow(/must not have a result/);
  });

  it('rejects duplicate games', () => {
    const data = makeGameData();
    data.games.push({ ...data.games[0] });
    expect(() => buildDemoSeed(data)).toThrow(/Duplicate/);
  });

  // Guards the committed export: once `pnpm export:demo-games` has been run this validates
  // the real data; before that it documents that the placeholder is still in place.
  it('the committed demoGameData is either the placeholder or builds a valid seed', () => {
    if (demoGameData.games.length === 0) {
      expect(() => buildDemoSeed(demoGameData)).toThrow();
    } else {
      expect(() => buildDemoSeed(demoGameData)).not.toThrow();
    }
  });
});
