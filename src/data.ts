import { Gift, GiftType, HostProfile, UserProfile, Family, Agency } from "./types";

export const DEFAULT_USER: UserProfile = {
  username: "Sehr_User",
  uniqueId: "sehr_1001",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
  coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
  bio: "Senior Live Stream Creator on Sehr Live! 🌟",
  gender: "Male",
  country: "Pakistan",
  language: "Urdu / Hinglish",
  coins: 1000000,
  diamonds: 0,
  vipLevel: 0,
  userLevel: 1,
  hostLevel: 1,
  wealthLevel: 1,
  xp: 0,
  familyId: "",
  agencyId: "",
  isVerified: false,
  isBanned: false,
  twoFactorEnabled: false,
  fullName: "",
  dob: "",
  phoneNumber: "",
  kycStatus: "none",
  followersCount: 0,
  followingCount: 0,
  totalLikesCount: 0
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
    id: "h-sahar_official",
    name: "Sahar_Live 👑",
    role: "Official Host",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&h=300&q=80",
    viewers: 1420,
    likes: 85200,
    category: "video",
    isLive: true,
    statusText: "Lahore Live Concert & Chat 🎵",
    bio: "Welcome to Sahar Live! Official VIP Host. Spread love and positive energy!",
    agencyId: "agency-1"
  },
  {
    id: "h-ayesha_vip",
    name: "Ayesha_Queen 🔥",
    role: "VIP Streamer",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&h=300&q=80",
    viewers: 980,
    likes: 42100,
    category: "pk",
    isLive: true,
    statusText: "1v1 PK Battle Active! Need Dragons 🐉",
    bio: "PK Fighter & Top Ranking Streamer on Sehr Live!",
    agencyId: "agency-1"
  },
  {
    id: "h-zain_singing",
    name: "Zain_Singer 🎙️",
    role: "Music Host",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&h=300&q=80",
    viewers: 750,
    likes: 31000,
    category: "video",
    isLive: true,
    statusText: "Live Urdu Ghazal & Acoustic Guitar 🎸",
    bio: "Live music sessions every evening!",
    agencyId: "agency-2"
  },
  {
    id: "h-zara_star",
    name: "Zara_Star ✨",
    role: "Superstar Host",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&h=300&q=80",
    viewers: 1150,
    likes: 64500,
    category: "video",
    isLive: true,
    statusText: "Chai Chat & Fun Games ☕",
    bio: "Daily live chat and fan interactions!",
    agencyId: "agency-1"
  },
  {
    id: "h-ali_pro",
    name: "Ali_Pro ⚡",
    role: "PK Host",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&h=300&q=80",
    viewers: 620,
    likes: 28900,
    category: "pk",
    isLive: true,
    statusText: "Non-stop 1v1 PK Challenge 🏆",
    bio: "Challenging top hosts live!",
    agencyId: "agency-2"
  }
];

export const MOCK_FAMILIES: Family[] = [];

export const MOCK_AGENCIES: Agency[] = [];

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
