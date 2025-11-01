# Chess.com-Style Elo Rating System

## Overview

MathClash now uses a sophisticated Elo rating system modeled after Chess.com, providing fair matchmaking and accurate skill assessment.

## Key Features

### 1. Dynamic K-Factors (Chess.com Style)

The K-factor determines how much a player's rating changes after each game. We use experience-based K-factors:

| Games Played | K-Factor | Description |
|--------------|----------|-------------|
| 0-29 games | K = 40 | **New Players**: Ratings change quickly to find true skill level |
| 30-99 games | K = 20 | **Intermediate**: Moderate rating changes |
| 100+ games | K = 10 | **Experienced**: Stable ratings, smaller fluctuations |

**Benefits:**
- New players reach their appropriate rating faster
- Experienced players have stable ratings
- Reduces impact of lucky/unlucky streaks for veterans

### 2. Starting Rating

- **Initial Rating**: 1000 (similar to Chess.com's starting point)
- **Minimum Rating**: 100 (prevents negative ratings)
- Previous system used 1500, which was inflated for beginners

### 3. Expanding Matchmaking Ranges

Matchmaking uses a dynamic rating range that expands over time to balance match quality with queue time:

| Wait Time | Rating Range | Description |
|-----------|--------------|-------------|
| 0-30 seconds | ±100 | **Tight matching**: Best quality matches |
| 30-60 seconds | ±200 | **Balanced**: Good matches with shorter wait |
| 60-90 seconds | ±300 | **Expanded**: Faster matching |
| 90+ seconds | ±400 | **Maximum**: Ensures match is found |

**Algorithm:**
```typescript
function calculateRatingRange(queueTimeSeconds: number): number {
  if (queueTimeSeconds < 30) return 100;
  if (queueTimeSeconds < 60) return 200;
  if (queueTimeSeconds < 90) return 300;
  return 400;
}
```

**Benefits:**
- High-rated and low-rated players find matches
- Newer players get fair matches
- Queue times remain reasonable
- Match quality prioritized initially

## Elo Calculation Formula

### Standard Elo Formula

```typescript
// Expected score for player A
EA = 1 / (1 + 10^((RB - RA) / 400))

// New rating for player A
RA_new = RA + K * (SA - EA)
```

Where:
- `RA` = Player A's current rating
- `RB` = Player B's current rating
- `SA` = Actual score (1 = win, 0.5 = draw, 0 = loss)
- `EA` = Expected score
- `K` = K-factor (based on games played)

### Example Calculation

**Scenario:** Player with 1000 rating (15 games) plays someone with 1100 rating

1. **Expected Score:**
   - EA = 1 / (1 + 10^((1100-1000)/400))
   - EA = 1 / (1 + 10^0.25)
   - EA = 1 / (1 + 1.778) = 0.36 (36% chance to win)

2. **If Player A Wins (SA = 1):**
   - K = 40 (less than 30 games)
   - RA_new = 1000 + 40 * (1 - 0.36)
   - RA_new = 1000 + 40 * 0.64
   - **RA_new = 1026** (gained 26 points for upset win)

3. **If Player A Loses (SA = 0):**
   - RA_new = 1000 + 40 * (0 - 0.36)
   - RA_new = 1000 - 14.4
   - **RA_new = 986** (lost 14 points, expected to lose)

## Matchmaking Flow

### 1. Instant Matching (tryMatchImmediately)

When a player joins the queue:
1. Check existing queue for compatible players
2. For each candidate:
   - Calculate their queue time
   - Determine acceptable rating range
   - Check if rating difference is within range
3. Select closest rating match
4. Create match immediately

### 2. Scheduled Matching (quickMatchmaker)

Runs every minute for players not instantly matched:
1. Get all queued players
2. For each pair:
   - Calculate both players' queue times
   - Use maximum acceptable range between them
   - Match if ratings are compatible
3. Create matches for all compatible pairs

### 3. Rating Updates (onMatchCompleted)

After a match ends:
1. Retrieve both players' games played count
2. Calculate appropriate K-factors
3. Determine winner/draw
4. Update ratings using Elo formula
5. Save rating history
6. Update player stats

## Implementation Details

### Files Changed

1. **`functions/src/lib/elo.ts`**
   - Added `EloOptions` interface
   - Implemented `calculateKFactor()` function
   - Updated `elo()` to use dynamic K-factors
   - Added minimum rating floor (100)

2. **`functions/src/matchmaking.ts`**
   - Added `calculateRatingRange()` function
   - Updated `tryMatchImmediately()` to use expanding ranges
   - Updated `quickMatchmaker()` to use expanding ranges
   - Changed default rating from 1500 to 1000

3. **`functions/src/triggers.ts`**
   - Modified `onMatchCompleted()` to fetch games played
   - Pass `gamesPlayedA` and `gamesPlayedB` to Elo calculation

4. **`src/lib/firebase/auth.ts`**
   - Changed new user default rating to 1000

5. **Frontend Components**
   - Updated default rating displays to 1000

## Benefits Over Previous System

### Previous System
- ❌ Fixed K-factor (inconsistent between players)
- ❌ Starting rating of 1500 (too high)
- ❌ Static matchmaking range (±200 only)
- ❌ No consideration for player experience

### New System
- ✅ Dynamic K-factors based on experience
- ✅ Realistic starting rating (1000)
- ✅ Expanding matchmaking ranges (±100 to ±400)
- ✅ Fair for both new and experienced players
- ✅ Faster queue times with quality prioritization
- ✅ Prevents rating inflation/deflation

## Rating Distribution (Expected)

With 1000 starting rating and Chess.com-style system:

| Rating Range | Skill Level | Percentage (Est.) |
|--------------|-------------|-------------------|
| 1400+ | Expert | Top 5% |
| 1200-1399 | Advanced | 15% |
| 1000-1199 | Intermediate | 30% |
| 800-999 | Beginner | 30% |
| <800 | Novice | 20% |

## Testing the System

### Test Scenarios

1. **New Player vs New Player (both ~1000)**
   - Large rating swings (K=40)
   - Quick skill assessment

2. **New Player vs Experienced (1000 vs 1200)**
   - New player: bigger swings
   - Experienced: smaller changes
   - Fair for both

3. **Experienced vs Experienced (both 1200+, 100+ games)**
   - Small rating changes (K=10)
   - Stable rankings

### Queue Time Testing

1. **Peak Hours**: Should match within ±100 (< 30s)
2. **Off-Peak**: Expands to ±400 if needed
3. **Edge Cases**: Very high/low ratings still find matches

## Future Enhancements

Potential improvements:
- [ ] Separate ratings per topic (addition, integrals, etc.)
- [ ] Provisional rating period (first 20 games)
- [ ] Anti-cheating rating adjustments
- [ ] Seasonal rating resets
- [ ] Leaderboard tiers/divisions
- [ ] Rating decay for inactive players

## References

- [Elo Rating System (Wikipedia)](https://en.wikipedia.org/wiki/Elo_rating_system)
- [Chess.com Rating System](https://www.chess.com/article/view/chess-ratings---how-they-work)
- [FIDE Rating Regulations](https://handbook.fide.com/chapter/B022017)

---

**Deployed:** November 1, 2025  
**Status:** ✅ Live in Production  
**URL:** https://mathclash-3e565.web.app

