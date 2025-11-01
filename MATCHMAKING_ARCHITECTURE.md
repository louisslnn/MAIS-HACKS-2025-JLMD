# Matchmaking Architecture

## Overview
MathClash uses a robust matchmaking system inspired by industry-standard online games (League of Legends, Valorant, Dota 2).

## Player State System

### States
- `idle` - Player is available for matchmaking
- `in-queue` - Player is waiting for a match
- `in-match` - Player is currently in a game

### State Transitions
```
idle → in-queue (when joining queue)
in-queue → in-match (when match found)
in-queue → idle (when canceling)
in-match → idle (when match ends)
in-match → idle (when quitting/forfeiting)
in-match → idle (when inactive for 3+ rounds - auto-forfeit)
```

## Matchmaking Flow

### 1. Queue Entry (`requestQuickMatch`)
```
1. Check player availability (reject if in-game/queue)
2. Try instant matching against available players
3. If no match, add to queue
4. Update player state to in-queue
```

### 2. Instant Matching (`tryMatchImmediately`)
```
1. Query queue for compatible players
2. Filter expired tickets
3. Verify each candidate's availability (async)
4. Remove stale queue entries
5. Find best rating match
6. Double-check availability before creating match
7. Create match atomically
8. Update both players' state to in-match
9. Remove from queue
```

### 3. Scheduled Matching (`quickMatchmaker`)
```
1. Get all queue tickets
2. Filter expired tickets
3. Verify each player's availability (critical!)
4. Remove stale tickets from unavailable players
5. Match players by rating + topic
6. Double-check availability before match creation (race condition protection)
7. Create match atomically
8. Update player states to in-match
9. Remove matched players from queue
10. Clean up expired tickets
```

## Complete Flow Summary

| Event | Action | State Change | Queue | Match | Cleanup |
|-------|--------|--------------|-------|-------|---------|
| **Join Queue** | `requestQuickMatch` | idle → in-queue | ✅ Add ticket | Try instant match | — |
| **Match Found** | `tryMatchImmediately` | in-queue → in-match | ❌ Remove ticket | ✅ Create match | — |
| **Cancel Queue** | `cancelQueue` | in-queue → idle | ❌ Remove ticket | — | ✅ Clear state |
| **Submit Answer** | `submitAnswer` | — | — | Update scores | — |
| **Round Expires** | `lockOverdueRounds` | — | — | Lock round | — |
| **Manual Quit** | `forfeitMatch` | in-match → idle | — | ✅ End match | ✅ Both players idle |
| **Inactivity** | `detectInactivePlayers` | in-match → idle | — | ✅ Auto-forfeit | ✅ Both players idle |
| **Match Ends** | `onRoundLocked` | in-match → idle | — | ✅ Complete | ✅ Both players idle |

## Protection Mechanisms

### 1. Entry Protection
- Players already in games cannot join queue
- Players already in queue cannot join again
- Enforced via `isPlayerAvailable()` check

### 2. Matching Protection
- Queue candidates verified for availability
- Stale queue entries removed automatically
- Double-check before match creation (prevents race conditions)

### 3. State Cleanup
- Automatic cleanup when matches end
- Stale state detection (>5 minutes)
- Orphaned queue entries removed

### 4. Race Condition Prevention
- Availability checked multiple times:
  1. On queue entry
  2. During candidate filtering
  3. Before match creation (final check)
- Atomic state updates
- Queue removal synchronized with state changes

## Database Structure

### User Document (`users/{uid}`)
```typescript
{
  displayName: string;
  rating: number;
  status: 'idle' | 'in-queue' | 'in-match';
  matchId?: string | null;
  queuedAt?: Timestamp | null;
  lastUpdated: Timestamp;
  // ... other fields
}
```

### Queue Ticket (`queues/quickMatch/tickets/{uid}`)
```typescript
{
  uid: string;
  mode: string;
  topic: string;
  ratingSnapshot: number;
  displayName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp; // 5 minutes from creation
}
```

## Similar to Real Games

### League of Legends
- Player state: lobby → queue → champion select → in-game
- Queue validation before matching
- Atomic match creation
- State cleanup on disconnect

### Valorant
- Pre-match availability check
- Real-time state tracking
- Queue removal on match start
- Stale entry cleanup

### Dota 2
- Multi-phase matchmaking
- Rating-based matching
- Timeout/expiration handling
- State synchronization

## Quit & Inactivity System

### Manual Quit (`forfeitMatch`)
```
1. Player clicks "Quit Match" button
2. Confirmation dialog shown
3. Function verifies player is in match
4. Updates match:
   - Sets player.surrendered = true
   - Sets match.status = "completed"
   - Sets winner = opponent
5. Updates both players' state to idle
6. Match ends, opponent wins
```

### Auto-Forfeit for Inactivity (`detectInactivePlayers`)
**Runs every 2 minutes**

```
1. Find all active matches
2. Skip matches < 2 minutes old
3. For each player, count:
   - Total rounds played
   - Rounds with answers submitted
4. If missed 3+ rounds (no answers):
   - Mark player as surrendered
   - End match, opponent wins
   - Update both players to idle
5. Log inactivity forfeit
```

**Inactivity Detection:**
- Missing 3+ consecutive rounds = inactive
- Automatic forfeit after detection
- Opponent wins automatically
- Both players freed to play again

**Graceful Handling:**
- Player disconnects → Auto-forfeit after 3 missed rounds
- Opponent notified via match completion
- Rating updated (winner gains, inactive loses)
- Both players can immediately queue again

## Key Differences from Simple Matchmaking

❌ **Simple/Broken Approach:**
- Add player to queue
- Match any players in queue
- Create match
- ⚠️ No state checking → duplicate matches possible

✅ **Robust Approach (MathClash):**
- Check availability → Add to queue
- Filter available candidates → Verify each one
- Double-check availability → Create match atomically
- Update states → Remove from queue
- ✅ Multiple validation layers prevent conflicts

## Maintenance

### Scheduled Jobs
1. `lockOverdueRounds` - Every minute, locks expired rounds
2. `quickMatchmaker` - Every minute, processes queue and creates matches
3. `detectInactivePlayers` - Every 2 minutes, auto-forfeits inactive players
4. Automatic cleanup of:
   - Expired queue tickets
   - Stale player states  
   - Orphaned queue entries
   - Inactive player matches

### Monitoring
- Log all state transitions
- Track stale ticket removals
- Alert on availability check failures
- Monitor race condition detections
- Log manual forfeits
- Log inactivity auto-forfeits
- Track queue cleanup operations

## Cloud Functions

### User-Initiated
1. `requestQuickMatch` - Join matchmaking queue
2. `cancelQueue` - Leave queue
3. `submitAnswer` - Submit answer for a round
4. `forfeitMatch` - Quit/forfeit current match
5. `getGameFeedback` - Get AI feedback after match

### Automated (Schedulers)
1. `quickMatchmaker` - Match players in queue (every 1 min)
2. `lockOverdueRounds` - Lock expired rounds (every 1 min)
3. `detectInactivePlayers` - Auto-forfeit inactive players (every 2 min)

### Triggers (Event-Driven)
1. `onRoundLocked` - Handle round completion, start next round
2. `onMatchCompleted` - Update ratings, stats, leaderboard

