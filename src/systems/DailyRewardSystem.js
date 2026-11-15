// Daily login streak system for Planetwood.
// Tracks last login date and streak count in localStorage (key: 'planetwood.daily').
// Grants escalating coins/XP rewards, with a special item on day 7.
//
// All numerical values are [PLACEHOLDER] until playtested.

const STORAGE_KEY = 'planetwood.daily';
const STORAGE_VERSION = 1;

// Reward per consecutive login day. Day 7 is the streak cap — once reached,
// players can claim day 7 rewards each consecutive day.
// Days 4-6 interpolate between day 3 and day 7.
const DAILY_REWARDS = [
  { day: 1, coins: 25, xp: 10 },
  { day: 2, coins: 50, xp: 20 },
  { day: 3, coins: 100, xp: 40 },
  { day: 4, coins: 150, xp: 60 },
  { day: 5, coins: 200, xp: 80 },
  { day: 6, coins: 300, xp: 90 },
  { day: 7, coins: 500, xp: 100, specialItem: 'daily-streak-badge-7' },
];

const MAX_STREAK = 7;

function _todayISO() {
  return new Date().toISOString().split('T')[0]; // UTC YYYY-MM-DD
}

function _yesterdayISO() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function _readStorage() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === STORAGE_VERSION) return parsed;
    return null;
  } catch {
    return null;
  }
}

function _writeStorage(state) {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export class DailyRewardSystem {
  constructor() {
    this.lastLoginDate = null; // YYYY-MM-DD of last claim
    this.streak = 0;
    this.ready = false;
  }

  // Deserialize persisted daily-reward state from localStorage.
  load() {
    const state = _readStorage();
    if (state) {
      this.lastLoginDate = typeof state.lastLoginDate === 'string' ? state.lastLoginDate : null;
      this.streak = typeof state.streak === 'number' ? state.streak : 0;
    } else {
      this.lastLoginDate = null;
      this.streak = 0;
    }
    this.ready = true;
    return { lastLoginDate: this.lastLoginDate, streak: this.streak };
  }

  // Persist streak state to localStorage. Returns false if unavailable.
  save() {
    return _writeStorage({
      version: STORAGE_VERSION,
      lastLoginDate: this.lastLoginDate,
      streak: this.streak,
    });
  }

  /**
   * Check whether a daily reward is available today without mutating state.
   * Compares today's date with the last claim date.
   *
   * Returns { available, streak, potentialStreak, dayReward, reason }
   *   available: true if the player has not claimed today
   *   streak: current stored streak
   *   potentialStreak: streak the player would have if they claim today
   *   dayReward: reward definition for potentialStreak
   *   reason: human-readable explanation
   */
  checkDailyReward() {
    if (!this.ready) this.load();
    const today = _todayISO();
    const alreadyClaimed = this.lastLoginDate === today;

    let potentialStreak;
    if (this.lastLoginDate === null) {
      potentialStreak = 1;
    } else if (this.lastLoginDate === _yesterdayISO()) {
      potentialStreak = Math.min(this.streak + 1, MAX_STREAK);
    } else {
      potentialStreak = 1; // missed a day — reset
    }

    const dayReward =
      DAILY_REWARDS.find(r => r.day === potentialStreak) || DAILY_REWARDS[MAX_STREAK - 1];

    return {
      available: !alreadyClaimed,
      streak: this.streak,
      potentialStreak,
      dayReward,
      reason: alreadyClaimed
        ? 'Already claimed today'
        : potentialStreak === 1
          ? 'New streak started'
          : `Day ${potentialStreak} streak`,
    };
  }

  /**
   * Grant the daily reward to the progression system, update streak and
   * last-claim date, then persist.
   *
   * Returns { coins, xp, specialItem, streak, day } or null if already claimed.
   */
  claimDailyReward(progressionSys) {
    const today = _todayISO();
    if (this.lastLoginDate === today) return null; // already claimed today

    // Update streak based on last claim date.
    if (this.lastLoginDate === null) {
      this.streak = 1;
    } else if (this.lastLoginDate === _yesterdayISO()) {
      this.streak = Math.min(this.streak + 1, MAX_STREAK);
    } else {
      this.streak = 1; // missed a day — reset
    }

    this.lastLoginDate = today;
    this.save();

    const reward =
      DAILY_REWARDS.find(r => r.day === this.streak) || DAILY_REWARDS[MAX_STREAK - 1];

    if (progressionSys) {
      if (reward.coins > 0) progressionSys.addCoins(reward.coins);
      if (reward.xp > 0) progressionSys.addXP(reward.xp);
    }

    return {
      coins: reward.coins,
      xp: reward.xp,
      specialItem: reward.specialItem || null,
      streak: this.streak,
      day: this.streak,
    };
  }

  // Get the reward definition for a given streak day without claiming.
  getRewardForDay(day) {
    return (
      DAILY_REWARDS.find(r => r.day === Math.min(day, MAX_STREAK)) ||
      DAILY_REWARDS[MAX_STREAK - 1]
    );
  }

  getStreak() {
    return this.streak;
  }

  getLastLoginDate() {
    return this.lastLoginDate;
  }
}
