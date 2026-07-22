import React from "react";

export interface LevelTier {
  id: string;
  name: string;
  range: string;
  minLevel: number;
  maxLevel: number;
  color: string;      // text color class
  bgClass: string;    // badge bg/border color
  gradient: string;   // gradient for rendering
  glowColor: string;  // drop shadow color
  starCount: number;
  badgeEmoji: string;
}

export const LEVEL_TIERS: LevelTier[] = [
  {
    id: "beginner",
    name: "Beginner",
    range: "1-10",
    minLevel: 1,
    maxLevel: 10,
    color: "text-slate-300",
    bgClass: "bg-slate-500/20 border-slate-500/30",
    gradient: "from-[#a0aec0] to-[#cbd5e0]",
    glowColor: "rgba(160, 174, 192, 0.4)",
    starCount: 1,
    badgeEmoji: "🔘"
  },
  {
    id: "bronze",
    name: "Bronze",
    range: "11-20",
    minLevel: 11,
    maxLevel: 20,
    color: "text-amber-600",
    bgClass: "bg-amber-700/20 border-amber-700/30",
    gradient: "from-[#b7791f] to-[#f6ad55]",
    glowColor: "rgba(183, 121, 31, 0.4)",
    starCount: 2,
    badgeEmoji: "🥉"
  },
  {
    id: "silver",
    name: "Silver",
    range: "21-30",
    minLevel: 21,
    maxLevel: 30,
    color: "text-zinc-400",
    bgClass: "bg-zinc-500/20 border-zinc-500/30",
    gradient: "from-[#cbd5e0] to-[#e2e8f0]",
    glowColor: "rgba(203, 213, 224, 0.4)",
    starCount: 3,
    badgeEmoji: "🥈"
  },
  {
    id: "gold",
    name: "Gold",
    range: "31-40",
    minLevel: 31,
    maxLevel: 40,
    color: "text-yellow-400",
    bgClass: "bg-yellow-500/20 border-yellow-500/30",
    gradient: "from-[#d69e2e] to-[#faf089]",
    glowColor: "rgba(214, 158, 46, 0.5)",
    starCount: 4,
    badgeEmoji: "🥇"
  },
  {
    id: "platinum",
    name: "Platinum",
    range: "41-50",
    minLevel: 41,
    maxLevel: 50,
    color: "text-teal-300",
    bgClass: "bg-teal-500/20 border-teal-500/30",
    gradient: "from-[#319795] to-[#4fd1c5]",
    glowColor: "rgba(49, 151, 149, 0.5)",
    starCount: 5,
    badgeEmoji: "🛡️"
  },
  {
    id: "diamond",
    name: "Diamond",
    range: "51-60",
    minLevel: 51,
    maxLevel: 60,
    color: "text-sky-300",
    bgClass: "bg-sky-500/20 border-sky-500/30",
    gradient: "from-[#3182ce] to-[#90cdf4]",
    glowColor: "rgba(49, 130, 206, 0.6)",
    starCount: 6,
    badgeEmoji: "💎"
  },
  {
    id: "titanium",
    name: "Titanium",
    range: "61-70",
    minLevel: 61,
    maxLevel: 70,
    color: "text-gray-400",
    bgClass: "bg-gray-700/20 border-gray-600/40",
    gradient: "from-[#2d3748] to-[#718096]",
    glowColor: "rgba(45, 55, 72, 0.6)",
    starCount: 7,
    badgeEmoji: "🔩"
  },
  {
    id: "master",
    name: "Master",
    range: "71-80",
    minLevel: 71,
    maxLevel: 80,
    color: "text-violet-400",
    bgClass: "bg-violet-500/20 border-violet-500/30",
    gradient: "from-[#553c9a] to-[#b794f4]",
    glowColor: "rgba(85, 60, 154, 0.7)",
    starCount: 8,
    badgeEmoji: "🔮"
  },
  {
    id: "legendary",
    name: "Legendary",
    range: "81-90",
    minLevel: 81,
    maxLevel: 90,
    color: "text-orange-400",
    bgClass: "bg-orange-500/20 border-orange-500/30",
    gradient: "from-[#dd6b20] to-[#fbd38d]",
    glowColor: "rgba(221, 107, 32, 0.8)",
    starCount: 9,
    badgeEmoji: "🔥"
  },
  {
    id: "immortal",
    name: "Immortal",
    range: "91-100",
    minLevel: 91,
    maxLevel: 100,
    color: "text-red-500 font-extrabold animate-pulse",
    bgClass: "bg-red-500/20 border-red-500/40",
    gradient: "from-[#e53e3e] to-[#feb2b2]",
    glowColor: "rgba(229, 62, 62, 0.9)",
    starCount: 10,
    badgeEmoji: "👑"
  }
];

export function getLevelTier(level: number): LevelTier {
  const safeLevel = Number.isNaN(Number(level)) ? 1 : Math.max(1, Math.floor(Number(level) || 1));
  const rounded = Math.min(safeLevel, 100);
  const tier = LEVEL_TIERS.find(t => rounded >= t.minLevel && rounded <= t.maxLevel);
  return tier || LEVEL_TIERS[0];
}

/**
 * Calculates coins needed to level up based on settings
 */
export function getCoinsForLevel(
  levelInput: number,
  baseCoinsInput: number = 1000,
  formula: "flat" | "progressive" = "progressive"
): number {
  const level = Number.isNaN(Number(levelInput)) ? 1 : Math.max(1, Math.floor(Number(levelInput) || 1));
  const baseCoins = Number.isNaN(Number(baseCoinsInput)) ? 1000 : Math.max(1, Number(baseCoinsInput) || 1000);
  if (level <= 1) return 0;
  
  if (formula === "flat") {
    // Every single level requires exact baseCoins. 
    // Total coins for Level L = (L - 1) * baseCoins
    return (level - 1) * baseCoins;
  } else {
    // Progressive: Level 2 = baseCoins, Level 3 = baseCoins + 2*baseCoins, etc.
    // Coins to go from L-1 to L is (L-1) * baseCoins
    // Cumulative sum: baseCoins * (L-1) * L / 2
    const L = level - 1;
    return baseCoins * (L * (L + 1)) / 2;
  }
}

/**
 * Returns level and progression details based on total accumulated coins
 */
export function getProgressionFromCoins(
  coinsInput: number,
  baseCoinsInput: number = 1000,
  formula: "flat" | "progressive" = "progressive"
): {
  level: number;
  currentLevelCoins: number;
  nextLevelCoins: number;
  percent: number;
  coinsNeeded: number;
} {
  const coins = Number.isNaN(Number(coinsInput)) ? 0 : Math.max(0, Number(coinsInput) || 0);
  const baseCoins = Number.isNaN(Number(baseCoinsInput)) ? 1000 : Math.max(1, Number(baseCoinsInput) || 1000);
  let level = 1;
  while (level < 100) {
    const nextLvlCoins = getCoinsForLevel(level + 1, baseCoins, formula);
    if (coins >= nextLvlCoins) {
      level++;
    } else {
      break;
    }
  }

  const thisLevelStartCoins = getCoinsForLevel(level, baseCoins, formula);
  const nextLevelStartCoins = getCoinsForLevel(level + 1, baseCoins, formula);
  
  const range = nextLevelStartCoins - thisLevelStartCoins;
  const earnedInThisLevel = coins - thisLevelStartCoins;
  
  let percent = range > 0 ? (earnedInThisLevel / range) * 100 : 100;
  if (Number.isNaN(percent)) percent = 0;
  percent = Math.min(Math.max(percent, 0), 100);

  let coinsNeeded = level >= 100 ? 0 : nextLevelStartCoins - coins;
  if (Number.isNaN(coinsNeeded)) coinsNeeded = 0;

  return {
    level,
    currentLevelCoins: Number.isNaN(earnedInThisLevel) ? 0 : earnedInThisLevel,
    nextLevelCoins: Number.isNaN(range) ? 1000 : range,
    percent,
    coinsNeeded
  };
}

/**
 * Highly interactive, polished SVG badge component representing the levels dynamically.
 */
export const LevelBadgeSvg: React.FC<{
  level: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  onClick?: () => void;
}> = ({ level: rawLevel, size = "md", className = "", onClick }) => {
  const level = Number.isNaN(Number(rawLevel)) ? 1 : Math.max(1, Math.floor(Number(rawLevel) || 1));
  const tier = getLevelTier(level);
  
  let width = "48px";
  let height = "48px";
  let fontSize = "11px";
  let textY = "29";

  if (size === "sm") {
    width = "32px";
    height = "32px";
    fontSize = "8px";
    textY = "20";
  } else if (size === "lg") {
    width = "80px";
    height = "80px";
    fontSize = "16px";
    textY = "48";
  } else if (size === "xl") {
    width = "120px";
    height = "120px";
    fontSize = "22px";
    textY = "72";
  }

  // Get color gradient colors
  const gradientId = `lvl-grad-${level}-${size}`;
  const glowStyle = {
    filter: `drop-shadow(0px 0px ${size === "xl" ? "12px" : size === "lg" ? "8px" : "4px"} ${tier.glowColor})`
  };

  const isImmortal = tier.id === "immortal";
  const isLegendary = tier.id === "legendary";
  const isMaster = tier.id === "master";

  return (
    <div 
      onClick={onClick}
      className={`relative inline-block select-none cursor-pointer hover:scale-105 active:scale-95 transition-transform ${className}`}
      style={{ width, height, ...glowStyle }}
      title={`Level ${level} (${tier.name}) - Click to view level details`}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {isImmortal ? (
              <>
                <stop offset="0%" stopColor="#e53e3e" />
                <stop offset="50%" stopColor="#822727" />
                <stop offset="100%" stopColor="#feb2b2" />
              </>
            ) : isLegendary ? (
              <>
                <stop offset="0%" stopColor="#dd6b20" />
                <stop offset="50%" stopColor="#b7791f" />
                <stop offset="100%" stopColor="#faf089" />
              </>
            ) : isMaster ? (
              <>
                <stop offset="0%" stopColor="#805ad5" />
                <stop offset="50%" stopColor="#553c9a" />
                <stop offset="100%" stopColor="#b794f4" />
              </>
            ) : (
              <>
                <stop offset="0%" stopColor={tier.gradient.split(" ")[0].replace("from-[", "").replace("]", "")} />
                <stop offset="100%" stopColor={tier.gradient.split(" ")[1].replace("to-[", "").replace("]", "")} />
              </>
            )}
          </linearGradient>

          {/* Glowing Filter */}
          <filter id="badge-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Dynamic shapes based on tiers */}
        {isImmortal ? (
          // Ultimate Immortal Crest with Horns & Crown
          <g>
            <path d="M50,5 L85,25 L85,65 L50,95 L15,65 L15,25 Z" fill="url(#GradientRef)" stroke="#ff0000" strokeWidth="4" />
            {/* Horns / crown wings */}
            <path d="M15,25 L5,10 L25,18 Z" fill="#e53e3e" />
            <path d="M85,25 L95,10 L75,18 Z" fill="#e53e3e" />
            <path d="M50,5 L40,15 L50,22 L60,15 Z" fill="#ffffff" opacity="0.8" />
            {/* Inner Ring */}
            <circle cx="50" cy="50" r="30" fill="#12121a" stroke="#feb2b2" strokeWidth="2" />
          </g>
        ) : isLegendary ? (
          // Starburst Shield
          <g>
            <path d="M50,2 L62,35 L96,35 L68,55 L78,90 L50,70 L22,90 L32,55 L4,35 L38,35 Z" fill="url(#GradientRef)" opacity="0.3" />
            <path d="M50,10 L82,30 L82,70 L50,90 L18,70 L18,30 Z" fill="url(#GradientRef)" stroke="#dd6b20" strokeWidth="3" />
            <circle cx="50" cy="50" r="28" fill="#0f172a" stroke="#faf089" strokeWidth="1.5" />
          </g>
        ) : isMaster ? (
          // Mystical Crest
          <g>
            <path d="M50,8 C70,8 88,22 88,48 C88,74 50,92 50,92 C50,92 12,74 12,48 C12,22 30,8 50,8 Z" fill="url(#GradientRef)" stroke="#b794f4" strokeWidth="3.5" />
            <path d="M10,48 L22,48 M88,48 L78,48" stroke="#faf5ff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="50" cy="48" r="26" fill="#120c1f" stroke="#d6bcfa" strokeWidth="1.5" />
          </g>
        ) : tier.id === "diamond" || tier.id === "titanium" ? (
          // Diamond / Hex Shield
          <g>
            <polygon points="50,6 90,26 90,74 50,94 10,74 10,26" fill="url(#GradientRef)" stroke={tier.id === "diamond" ? "#38bdf8" : "#4a5568"} strokeWidth="4" />
            <polygon points="50,13 83,30 83,70 50,87 17,70 17,30" fill="#090d16" stroke={tier.id === "diamond" ? "#90cdf4" : "#cbd5e0"} strokeWidth="1.5" />
          </g>
        ) : tier.id === "platinum" || tier.id === "gold" ? (
          // Gold / Platinum Crest
          <g>
            <path d="M50,6 L85,15 L80,68 C80,82 50,94 50,94 C50,94 20,82 20,68 L15,15 Z" fill="url(#GradientRef)" stroke={tier.id === "gold" ? "#faf089" : "#4fd1c5"} strokeWidth="3" />
            <path d="M50,14 L75,21 L71,64 C71,74 50,84 50,84 C50,84 29,74 29,64 L25,21 Z" fill="#0a1210" stroke="#ffffff" strokeWidth="1" opacity="0.7" />
            <circle cx="50" cy="48" r="22" fill="#0f172a" />
          </g>
        ) : (
          // Beginner / Bronze / Silver Shield
          <g>
            <path d="M50,10 L82,25 L82,60 C82,75 50,90 50,90 C50,90 18,75 18,60 L18,25 Z" fill="url(#GradientRef)" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
            <path d="M50,15 L76,28 L76,57 C76,69 50,82 50,82 C50,82 24,69 24,57 L24,28 Z" fill="#1e293b" />
          </g>
        )}

        {/* Fallback Reference to GradientId dynamically replacing fill */}
        <path d="M50,10" fill={`url(#${gradientId})`} id="GradientRef" />

        {/* Glow enhancement on main shield outline */}
        <path 
          d={isImmortal ? "M50,5 L85,25 L85,65 L50,95 L15,65 L15,25 Z" : isMaster ? "M50,8 C70,8 88,22 88,48 C88,74 50,92 50,92 C50,92 12,74 12,48" : "M50,10 L82,25 L82,60 C82,75 50,90 50,90 Z"} 
          fill="none" 
          stroke={`url(#${gradientId})`} 
          strokeWidth="3.5" 
        />

        {/* Stars decor */}
        {tier.starCount >= 1 && (
          <g fill="#f6e05e">
            {tier.starCount >= 3 ? (
              <>
                <polygon points="50,22 52,27 57,27 53,30 55,35 50,32 45,35 47,30 43,27 48,27" />
                <polygon points="35,26 37,30 41,30 38,33 39,37 35,34 31,37 32,33 29,30 33,30" transform="scale(0.8) translate(10, 5)" />
                <polygon points="65,26 67,30 71,30 68,33 69,37 65,34 61,37 62,33 59,30 63,30" transform="scale(0.8) translate(25, 5)" />
              </>
            ) : (
              <polygon points="50,20 53,26 59,26 54,30 56,36 50,32 44,36 46,30 41,26 47,26" />
            )}
          </g>
        )}

        {/* Small tier badge subtitle (e.g. "IMMORTAL" or "GOLD") inside high levels */}
        {size !== "sm" && (
          <text
            x="50"
            y={size === "xl" ? "78" : "75"}
            textAnchor="middle"
            fill={tier.id === "immortal" ? "#fecaca" : "#94a3b8"}
            fontSize="6.5px"
            fontWeight="900"
            fontFamily="monospace"
            letterSpacing="1"
          >
            {tier.name.toUpperCase()}
          </text>
        )}

        {/* Level text */}
        <text
          x="50"
          y={textY}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={fontSize}
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          style={{ textShadow: "0px 2px 4px rgba(0,0,0,0.9)" }}
        >
          {level}
        </text>
      </svg>

      {/* Tiny Animated Sparkles / Pulsing crown for Top Levels */}
      {isImmortal && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
        </span>
      )}
    </div>
  );
};

export function getHostLevelFromName(name: string): number {
  const mockLevels: Record<string, number> = {
    "Sahar": 78,
    "Arooj_Queen": 32,
    "Malik_Saad": 18,
    "Sana_Khan": 12,
    "Zain_Killer": 85,
    "Aisha_Vibe": 55,
    "Zoya_Heart": 42,
    "Sunny_Prince": 65,
    "Raza_Sultan": 92,
    "Alina_Malik": 22,
    "Fatima_Gill": 35,
    "Hamza_Rao": 27,
    "Sid_Lahori": 8
  };
  return mockLevels[name] || mockLevels[name.replace(/_.*$/, "")] || 25;
}

