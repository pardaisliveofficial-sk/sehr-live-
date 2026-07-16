import { Gift, GiftType, HostProfile, UserProfile, Family, Agency } from "./types";

export const DEFAULT_USER: UserProfile = {
  username: "Prince_Sehr",
  uniqueId: "sehr_8899",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
  coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
  bio: "Sehr Live VIP 👑 Support is everything! Family Creator & Diamond Earner.",
  gender: "Male",
  country: "Pakistan",
  language: "Urdu / Hinglish",
  coins: 50000, // starting coins for user to play with gifts
  diamonds: 1200,
  vipLevel: 3, // VIP levels
  userLevel: 24,
  hostLevel: 12,
  wealthLevel: 32,
  xp: 750,
  familyId: "fam-kings",
  agencyId: "agency-alpha",
  isVerified: false,
  isBanned: false,
  twoFactorEnabled: true,
  fullName: "",
  dob: "",
  phoneNumber: "",
  kycStatus: "none",
  followersCount: 14200,
  followingCount: 280,
  totalLikesCount: 125400
};

export const MOCK_GIFTS: Gift[] = [
  { id: "g-rose", name: "Red Rose", cost: 10, type: GiftType.TWO_D, icon: "🌹", color: "from-pink-500 to-rose-600", animationClass: "animate-bounce" },
  { id: "g-heart", name: "Love Heart", cost: 99, type: GiftType.TWO_D, icon: "💖", color: "from-red-500 to-pink-500", animationClass: "animate-pulse" },
  { id: "g-crown", name: "VIP Crown", cost: 999, type: GiftType.THREE_D, icon: "👑", color: "from-yellow-400 to-amber-600", animationClass: "animate-spin" },
  { id: "g-car", name: "Sports Car", cost: 4999, type: GiftType.LUXURY, icon: "🏎️", color: "from-blue-500 to-indigo-600", animationClass: "animate-bounce" },
  { id: "g-rocket", name: "Space Rocket", cost: 9999, type: GiftType.LUXURY, icon: "🚀", color: "from-purple-600 to-pink-600", animationClass: "animate-pulse" },
  { id: "g-dragon", name: "Golden Dragon", cost: 29999, type: GiftType.LUXURY, icon: "🐉", color: "from-amber-500 to-red-600", animationClass: "animate-bounce" }
];

export const MOCK_HOSTS: HostProfile[] = [
  {
    id: "h-sahar",
    name: "Sahar Live 🎵",
    role: "Music & Acoustic Session",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80",
    viewers: 1450,
    likes: 85200,
    category: "video",
    isLive: true,
    statusText: "Playing beautiful Urdu ghazals and pop songs!",
    bio: "Sahar from Islamabad. Join my daily acoustic stream! Official Host of Alpha Agency.",
    agencyId: "agency-alpha"
  },
  {
    id: "h-zain",
    name: "Zain_Killer 🔥",
    role: "Official PK Battle King",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80",
    viewers: 3200,
    likes: 215400,
    category: "pk",
    isLive: true,
    statusText: "PK Match vs Alpha_Queen! Let's win together guys!",
    bio: "PK champion, daily battles! Keep tapping and make me win!",
    agencyId: "agency-delta"
  },
  {
    id: "h-mehak",
    name: "Mehak_Lounge ☕",
    role: "Late Night Audio Room Host",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
    viewers: 450,
    likes: 12400,
    category: "audio",
    isLive: true,
    statusText: "Cozy 10-seat general chat. Request mic and share your story!",
    bio: "ASMR, poetry, light jokes. Cozy corner for late-night dreamers.",
    agencyId: "agency-alpha"
  }
];

export const MOCK_FAMILIES: Family[] = [
  {
    id: "fam-kings",
    name: "👑 SAHR KINGS",
    leader: "Prince_Sehr",
    members: 245,
    rank: 1,
    avatar: "https://images.unsplash.com/photo-1513829096999-4978602294fc?auto=format&fit=crop&w=100&h=100&q=80",
    description: "The elite guild of premium supporters. Loyalty and respect always."
  },
  {
    id: "fam-warriors",
    name: "⚡ PK WARRIORS",
    leader: "Zain_Killer",
    members: 180,
    rank: 2,
    avatar: "https://images.unsplash.com/photo-1531256379416-9f000e90aacc?auto=format&fit=crop&w=100&h=100&q=80",
    description: "Winning battles one diamond at a time! Join if you are active."
  }
];

export const MOCK_AGENCIES: Agency[] = [
  {
    id: "agency-alpha",
    name: "Alpha Talent Agency",
    registeredHosts: 45,
    monthlyCommission: 1250,
    salaryRate: "35% Commission + $200 Base Bonus",
    ownerEmail: "owner@alphatalent.live"
  },
  {
    id: "agency-delta",
    name: "Delta Elite Entertainment",
    registeredHosts: 32,
    monthlyCommission: 2400,
    salaryRate: "40% Commission + $350 PK Victory Bonus",
    ownerEmail: "delta@elite.live"
  }
];

export const DAILY_MISSIONS = [
  { id: "m-1", title: "Double tap to send 100 Likes", xpReward: 50, coinsReward: 10, status: "Pending", current: 0, target: 100 },
  { id: "m-2", title: "Send any gift to a live host", xpReward: 100, coinsReward: 50, status: "Pending", current: 0, target: 1 },
  { id: "m-3", title: "Type 3 messages in Live Chat", xpReward: 40, coinsReward: 15, status: "Pending", current: 0, target: 3 },
  { id: "m-4", title: "Explore a premium Audio Room", xpReward: 60, coinsReward: 20, status: "Pending", current: 0, target: 1 },
  { id: "m-5", title: "Share Sehr Live host stream with friends", xpReward: 50, coinsReward: 25, status: "Pending", current: 0, target: 1 }
];

export const STATIC_COMMENTS_POOL = [
  "SubhanAllah bohot pyaari aawaaz hai Sahar! 😍",
  "Guys PK support karo fast!! ⚡⚡",
  "Rose gift bhejo sab log family goal complete karna hai!",
  "Nice bio and stream quality is perfect! 🤩",
  "Aadaab! Kaise hain sab log?",
  "Love from Lahore! Keep rocking Sehr Live! 💕",
  "Is this sound coming clearly? Let me know host.",
  "Zain bhai kya entry maari hai, unbeatable!",
  "Mera double tap check karo, work kar raha hai screen pe."
];
