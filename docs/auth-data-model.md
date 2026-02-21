# Auth and Data Model

## Authentication choice

This project integrates **Supabase Auth** (email/password) for session management in the client app.

Required environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Data model (tables/collections)

### `users` (collection)
Primary key: `id` (UUID from auth provider)
```json
{
  "email": "player@example.com",
  "displayName": "Jane Player",
  "photoURL": "https://...",
  "createdAt": "serverTimestamp",
  "lastLoginAt": "serverTimestamp",
  "preferences": {
    "boardTheme": "neo",
    "coachTone": "direct"
  }
}
```

### `connected_accounts`
Document id: generated
```json
{
  "userId": "user_uuid",
  "provider": "chesscom|lichess",
  "username": "playerHandle",
  "status": "active|revoked|error",
  "lastSyncAt": "timestamp",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```
Indexes:
- `(userId, provider)` unique-enforced at app level.

### `games`
Document id: generated or upstream id hash
```json
{
  "userId": "user_uuid",
  "connectedAccountId": "doc_ref",
  "platform": "chesscom|lichess",
  "upstreamGameId": "string",
  "playedAt": "timestamp",
  "opponent": { "name": "opponent", "rating": 1675 },
  "playerColor": "white|black",
  "result": "win|loss|draw",
  "timeControl": "10+0",
  "opening": "Sicilian Defense",
  "pgn": "...",
  "createdAt": "timestamp"
}
```
Indexes:
- `(userId, playedAt desc)`
- `(userId, platform, playedAt desc)`

### `analyses`
Document id: generated
```json
{
  "userId": "user_uuid",
  "gameId": "doc_ref",
  "runAt": "timestamp",
  "engineVersion": "stockfish-16",
  "depth": 18,
  "accuracy": 73.2,
  "blunders": 2,
  "mistakes": 3,
  "inaccuracies": 4,
  "blundersPerGame": 2,
  "phaseScores": { "opening": 71, "middlegame": 63, "endgame": 58 },
  "phaseWeakness": { "opening": 29, "middlegame": 37, "endgame": 42 },
  "patternsSnapshot": ["time-trouble", "hanging-pieces"],
  "createdAt": "timestamp"
}
```
Indexes:
- `(userId, runAt desc)` for trend charts.
- `(userId, gameId, runAt desc)`.

### `patterns`
Document id: generated
```json
{
  "userId": "user_uuid",
  "analysisId": "doc_ref",
  "name": "Endgame Conversion",
  "severity": "moderate|critical",
  "frequency": 36,
  "description": "...",
  "puzzleTheme": "endgame",
  "createdAt": "timestamp"
}
```
Indexes:
- `(userId, severity, createdAt desc)`.

### `puzzle_attempts`
Document id: generated
```json
{
  "userId": "user_uuid",
  "pattern": "endgame",
  "puzzleId": "lichess:abc123",
  "solved": true,
  "tries": 2,
  "timeSpentMs": 43000,
  "attemptedAt": "timestamp"
}
```
Indexes:
- `(userId, attemptedAt desc)`
- `(userId, pattern, attemptedAt desc)`

### `coaching_snapshots`
Document id: generated
```json
{
  "userId": "user_uuid",
  "snapshotAt": "timestamp",
  "window": "30d",
  "summary": {
    "accuracy": 74.1,
    "blundersPerGame": 1.2,
    "weakestPhase": "endgame"
  },
  "deltasVsPreviousWindow": {
    "accuracy": 2.6,
    "blundersPerGame": -0.4,
    "endgameWeakness": -5.1
  },
  "recommendedPlan": ["30 endgame puzzles", "2 rapid games/day"]
}
```
Indexes:
- `(userId, snapshotAt desc)`.

## Trend chart support

Persist every analysis run in `analyses` with `runAt`/`createdAt` timestamps. Compute dashboard trends from time-ordered analysis docs:
- Accuracy over time
- Blunders per game over time
- Phase weakness (opening/middlegame/endgame) over time
- Current 30-day avg vs previous 30-day avg deltas
