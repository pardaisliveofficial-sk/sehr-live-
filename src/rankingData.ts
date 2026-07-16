// High Quality deterministic mock ranking generator for 100 numbers
export interface RankItem {
  rank: number;
  name: string;
  avatar: string;
  score: number; // Diamonds for host, Coins for gifter
  level: number;
  vipLevel: number;
  isLive?: boolean;
}

const FIRST_NAMES = [
  "Arooj", "Mehak", "Zara", "Hamza", "Zara", "Saad", "Noor", "Usman", "Hoorain", "Ali Raza", 
  "Prince", "Sana", "DJ Sam", "Ali", "Khan", "Malik", "Sehr", "Zain", "Shera", "Awan", 
  "Fatima", "Ayesha", "Kiran", "Sid", "Sunny", "Rohan", "Kabir", "Neha", "Arjun", "Raj"
];

const LAST_NAMES = [
  "Queen", "King", "Khan", "Sehr", "Prince", "Rajput", "Malik", "Raza", "Awan", "Jatt", 
  "Gujjar", "VIP", "786", "Don", "Official", "Live", "Star", "Boss", "Angel", "Devil"
];

const AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?auto=format&fit=crop&w=150&h=150&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80"
];

// Seeded random-like generation so it's deterministic but looks dynamic based on parameters
export function getRankingData(
  type: "host" | "gifter", 
  period: "hourly" | "daily" | "weekly" | "monthly"
): RankItem[] {
  const result: RankItem[] = [];
  
  // Calculate a seed factor based on parameters
  let seed = 1;
  if (type === "gifter") seed *= 3;
  if (period === "daily") seed += 10;
  if (period === "weekly") seed += 25;
  if (period === "monthly") seed += 40;

  // Let's generate exactly 100 rankings
  for (let rank = 1; rank <= 100; rank++) {
    const nameIdx = (rank * 7 + seed) % FIRST_NAMES.length;
    const surIdx = (rank * 13 + seed * 2) % LAST_NAMES.length;
    const avatarIdx = (rank * 3 + seed) % AVATARS.length;
    
    const firstName = FIRST_NAMES[nameIdx];
    const lastName = LAST_NAMES[surIdx];
    const name = `${firstName} ${lastName}`;
    const avatar = AVATARS[avatarIdx];
    
    // Scale scores based on period and rank
    let baseScore = 500000;
    if (period === "hourly") baseScore = 25000;
    if (period === "daily") baseScore = 150000;
    if (period === "weekly") baseScore = 750000;
    if (period === "monthly") baseScore = 3500000;

    // Add some variation and decrease score as rank gets larger
    const scoreFactor = Math.max(1, 105 - rank) / 100;
    const score = Math.floor(baseScore * scoreFactor * (0.85 + ((rank * 5 + seed) % 30) / 100));
    
    const level = Math.max(1, Math.floor(65 - rank * 0.5 + ((rank + seed) % 15)));
    const vipLevel = (rank * 5 + seed) % 6 === 0 ? 3 : (rank * 5 + seed) % 4 === 0 ? 2 : (rank * 5 + seed) % 3 === 0 ? 1 : 0;
    const isLive = type === "host" && rank % 7 === 0;

    result.push({
      rank,
      name,
      avatar,
      score,
      level,
      vipLevel,
      isLive
    });
  }

  // Ensure rank 1, 2, 3 have descending order of scores
  result.sort((a, b) => b.score - a.score);
  result.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return result;
}
