# Running a Multi-User Simulation

This guide covers how to run a 5-week pick'em simulation on your production instance with invited users.

The simulation uses 5 weeks of real historical CFB matchups (year=2025 in the DB) with kickoff times automatically shifted to the near future, so pick deadlines work correctly — no environment variable overrides needed.

---

## One-Time Setup

### 1. Open a terminal in the backend container

In Dokploy, navigate to the CFB Pickem project → Backend → Terminal.

### 2. Seed the simulation data

```bash
pnpm seed:sim
```

This inserts 5 weeks of games under year=2025. The script prints the target Saturday it computed, e.g.:

```
seed-sim: target Saturday = 2026-04-11
seed-sim: inserting weeks…
  week 1 (2026-04-04 → 2026-04-10) ok
  ...
seed-sim: done.
```

Week 1 games will kick off on the first Saturday that is at least 7 days from when you run the script, giving everyone time to make picks. Each subsequent week is 7 days later.

---

## Running Each Week

### 3. Invite users

Have your participants register at your production URL. No special setup required — standard registration flow.

### 4. Users make picks

Users log in and pick games for the current week before kickoff. The deadline is enforced by the actual shifted kickoff times in the DB.

### 5. Mark games complete (after "kickoff")

Once the simulated kickoff time has passed, log in as admin and go to **Admin Controls** → **Mark Games Complete**.

- Select year **2025** and the current week
- Enter final scores for each game and click **Mark Complete**
- The winning team is calculated automatically
- When all games in a week are marked complete, a `rankings_updated` notification is dispatched

### 6. Check results

Users can view their correct/incorrect picks and the updated leaderboard immediately after games are marked complete.

### 7. Advance to the next week

Nothing special — the next week's games are already seeded with kickoff times 7 days after week 1. Users make picks for week 2, and you repeat step 5 after those kickoff times pass.

---

## Teardown

When the simulation is over, remove all data from the backend container terminal:

```bash
pnpm teardown:sim
```

This deletes all weeks, games, and notification logs for year=2025. User picks cascade-delete automatically.

---

## Notes

- Simulation data uses **year=2025** in the DB, which is distinct from dev seed data (year=2024). Both can coexist.
- The year selector on the leaderboard and admin controls defaults to the current CFB season. Switch it to **2025** to see simulation data.
- If you re-run `seed:sim` after teardown, the new week 1 Saturday is recalculated from the current date at that time.
- The "Mark Games Complete" panel is in the Admin Controls tab (not dev-tools-only), so it works in production.
