import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ------------------------------------------------------------------
// FILE-BASED DATABASE STATE & DURABLE CLOUD-LIKE PERSISTENCE
// ------------------------------------------------------------------
const DB_PATH = path.join(process.cwd(), "sehr_live_db.json");

let dbData: any = {
  user: {
    username: "Prince_Sehr",
    uniqueId: "sehr_8899",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
    coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    bio: "Sehr Live VIP 👑 Support is everything! Family Creator & Diamond Earner.",
    gender: "Male",
    country: "Pakistan",
    language: "Urdu / Hinglish",
    coins: 50000,
    diamonds: 1200,
    vipLevel: 3,
    userLevel: 24,
    hostLevel: 12,
    wealthLevel: 32,
    xp: 750,
    familyId: "fam-kings",
    agencyId: "agency-alpha",
    isVerified: false,
    isBanned: false,
    twoFactorEnabled: true,
    fullName: "Syed Prince Shah",
    dob: "1998-05-15",
    phoneNumber: "+923001234567",
    kycStatus: "none",
    followersCount: 14200,
    followingCount: 280,
    totalLikesCount: 125400,
    selectedFrameId: "vip-frame-3",
    vipSuspended: false
  },
  gifts: [
    { id: "g-rose", name: "Red Rose", cost: 10, type: "2d", icon: "🌹", color: "from-pink-500 to-rose-600", animationClass: "animate-bounce", category: "Popular", status: "active" },
    { id: "g-heart", name: "Love Heart", cost: 99, type: "2d", icon: "💖", color: "from-red-500 to-pink-500", animationClass: "animate-pulse", category: "Popular", status: "active" },
    { id: "g-crown", name: "VIP Crown", cost: 999, type: "3d", icon: "👑", color: "from-yellow-400 to-amber-600", animationClass: "animate-spin", category: "VIP", status: "active" },
    { id: "g-car", name: "Sports Car", cost: 4999, type: "luxury", icon: "🏎️", color: "from-blue-500 to-indigo-600", animationClass: "animate-bounce", category: "Luxury", status: "active" },
    { id: "g-rocket", name: "Space Rocket", cost: 9999, type: "luxury", icon: "🚀", color: "from-purple-600 to-pink-600", animationClass: "animate-pulse", category: "Luxury", status: "active" },
    { id: "g-dragon", name: "Golden Dragon", cost: 29999, type: "luxury", icon: "🐉", color: "from-amber-500 to-red-600", animationClass: "animate-bounce", category: "Luxury", status: "active" }
  ],
  categories: ["Popular", "New", "Lucky", "VIP", "Festival", "Premium", "Luxury"],
  hosts: [
    { id: "h-sahar", name: "Sahar Live 🎵", role: "Music & Acoustic Session", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80", viewers: 1450, likes: 85200, category: "video", isLive: true, statusText: "Playing beautiful Urdu ghazals and pop songs!", bio: "Sahar from Islamabad. Join my daily acoustic stream! Official Host of Alpha Agency.", agencyId: "agency-alpha" },
    { id: "h-zain", name: "Zain_Killer 🔥", role: "Official PK Battle King", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80", viewers: 3200, likes: 215400, category: "pk", isLive: true, statusText: "PK Match vs Alpha_Queen! Let's win together guys!", bio: "PK champion, daily battles! Keep tapping and make me win!", agencyId: "agency-delta" },
    { id: "h-mehak", name: "Mehak_Lounge ☕", role: "Late Night Audio Room Host", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80", viewers: 450, likes: 12400, category: "audio", isLive: true, statusText: "Cozy 10-seat general chat. Request mic and share your story!", bio: "ASMR, poetry, light jokes. Cozy corner for late-night dreamers.", agencyId: "agency-alpha" }
  ],
  families: [
    { id: "fam-kings", name: "👑 SAHR KINGS", leader: "Prince_Sehr", members: 245, rank: 1, avatar: "https://images.unsplash.com/photo-1513829096999-4978602294fc?auto=format&fit=crop&w=100&h=100&q=80", description: "The elite guild of premium supporters. Loyalty and respect always." },
    { id: "fam-warriors", name: "⚡ PK WARRIORS", leader: "Zain_Killer", members: 180, rank: 2, avatar: "https://images.unsplash.com/photo-1531256379416-9f000e90aacc?auto=format&fit=crop&w=100&h=100&q=80", description: "Winning battles one diamond at a time! Join if you are active." }
  ],
  agencies: [
    { id: "agency-alpha", name: "Alpha Talent Agency", registeredHosts: 45, monthlyCommission: 1250, salaryRate: "35% Commission + $200 Base Bonus", ownerEmail: "owner@alphatalent.live" },
    { id: "agency-delta", name: "Delta Elite Entertainment", registeredHosts: 32, monthlyCommission: 2400, salaryRate: "40% Commission + $350 PK Victory Bonus", ownerEmail: "delta@elite.live" }
  ],
  transactions: [
    { id: "TXN-101", type: "recharge", amount: 15000, currency: "coins", timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), status: "Completed", details: "Purchased 15k Coins via EasyPaisa" },
    { id: "TXN-102", type: "recharge", amount: 20000, currency: "coins", timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), status: "Completed", details: "Purchased 20k Coins via JazzCash" },
    { id: "TXN-103", type: "withdraw", amount: 500, currency: "USD", timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), status: "Completed", details: "Withdrawn $500 to Bank Alfalah" }
  ],
  notifications: [
    { id: 1001, title: "🎙️ SAHAR LIVE ACUSTIC SESSION", text: "Sahar is live with amazing classics! Tune in now to request Ghazals.", time: "2 hours ago", isNew: false },
    { id: 1002, title: "🏆 WEEKLY BANNER UPDATE", text: "The weekly PK leader board awards are out! Check results in ranking tab.", time: "5 hours ago", isNew: false }
  ],
  reports: [
    { id: "REP-401", username: "toxic_viewer_9", reporter: "Malik_Sheraz_40", reason: "Abusive language in live chat chatroom", status: "pending", timestamp: new Date().toISOString() },
    { id: "REP-402", username: "spammer_pak", reporter: "Sardar_Sb_VIP", reason: "Spamming referral scam link in mic seat", status: "resolved", timestamp: new Date().toISOString() }
  ],
  kycRequests: [
    { id: "KYC-8801", username: "Prince_Sehr", fullName: "Syed Prince Shah", dob: "1998-05-15", phoneNumber: "+923001234567", documentType: "id_card", idFront: "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?auto=format&fit=crop&w=300&q=80", idBack: "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?auto=format&fit=crop&w=300&q=80", faceVerified: true, status: "pending", timestamp: new Date().toISOString() }
  ],
  events: [
    { id: "evt-1", title: "🇵🇰 Pakistan Day Mega Stream Event", duration: "12 Hours", reward: "2x Diamonds Multiplier", active: true },
    { id: "evt-2", title: "🔥 PK Battle Royale Tournament", duration: "July 18 - 20", reward: "Exclusive Gold Profile Frame", active: true }
  ],
  configurations: {
    maintenanceMode: false,
    maintenanceDuration: "2 hours",
    forceUpdate: false,
    appVersion: "v1.4.2",
    coinExchangeRate: 150,
    pkrToUsd: 280,
    banners: [
      { id: "b-1", title: "🇵🇰 PAKISTAN DAY MEGA STREAM FESTIVAL", image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80", link: "event-pak-day", active: true },
      { id: "b-2", title: "👑 SAHR TALENT RECRUITMENT PROGRAM", image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80", link: "agency-info", active: true },
      { id: "b-3", title: "⚡ OFFICIAL PK BATTLE TOURNAMENT LIVE NOW", image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80", link: "pk-tourney", active: true }
    ],
    vipFrames: [
      { id: "vip-frame-1", name: "Royal Bronze VIP 1", minLevel: 15, glowColor: "#b27a50", gradientFrom: "from-amber-700", gradientTo: "to-amber-500", badgeEmoji: "🥉", isActive: true },
      { id: "vip-frame-2", name: "Sky Silver Wings VIP 2", minLevel: 30, glowColor: "#94a3b8", gradientFrom: "from-slate-400", gradientTo: "to-blue-300", badgeEmoji: "🥈", isActive: true },
      { id: "vip-frame-3", name: "Golden Dragon VIP 3", minLevel: 45, glowColor: "#fbbf24", gradientFrom: "from-yellow-600", gradientTo: "to-yellow-300", badgeEmoji: "👑", isActive: true },
      { id: "vip-frame-4", name: "Ruby Fire VIP 4", minLevel: 60, glowColor: "#ef4444", gradientFrom: "from-red-600", gradientTo: "to-pink-500", badgeEmoji: "🔥", isActive: true },
      { id: "vip-frame-5", name: "Celestial Diamond VIP 5", minLevel: 75, glowColor: "#06b6d4", gradientFrom: "from-cyan-500", gradientTo: "to-blue-400", badgeEmoji: "💎", isActive: true },
      { id: "vip-frame-6", name: "Sovereign Neon Pulsar VIP 6", minLevel: 90, glowColor: "#d946ef", gradientFrom: "from-fuchsia-600", gradientTo: "to-pink-600", badgeEmoji: "🌀", isActive: true }
    ],
    pkSettings: {
      defaultDuration: 180,
      pkTappingMultiplier: 1.5,
      allowSpectatorInterference: true
    }
  },
  adminUsersList: [
    { username: "Prince_Sehr", fullName: "Syed Prince Shah", isVerified: true, kycStatus: "approved", isBanned: false, coins: 50000, userLevel: 24, vipLevel: 3 },
    { username: "Malik_Sheraz_40", fullName: "Sheraz Malik", isVerified: true, kycStatus: "approved", isBanned: false, coins: 34000, userLevel: 35, vipLevel: 1 },
    { username: "Sardar_Sb_VIP", fullName: "Sardar Yar Khan", isVerified: true, kycStatus: "approved", isBanned: false, coins: 120000, userLevel: 50, vipLevel: 3 },
    { username: "Alina_Malik", fullName: "Alina Malik", isVerified: false, kycStatus: "none", isBanned: false, coins: 520, userLevel: 12, vipLevel: 0 },
    { username: "toxic_viewer_9", fullName: "Kashif Butt", isVerified: false, kycStatus: "rejected", isBanned: true, coins: 0, userLevel: 4, vipLevel: 0 }
  ]
};

function loadDatabase() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      dbData = JSON.parse(raw);
    } else {
      saveDatabase();
    }
  } catch (e) {
    console.error("Error loading database:", e);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving database:", e);
  }
}

// Perform initial load
loadDatabase();

// ------------------------------------------------------------------
// GEMINI SDK INTEGRATION
// ------------------------------------------------------------------
let aiClient: any = null;

function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// ------------------------------------------------------------------
// CORE APIS & REST COMPONENT CONNECTIVITY (GET/POST)
// ------------------------------------------------------------------

// Synchronize entire DB state in one call
app.get("/api/v1/db", (req, res) => {
  loadDatabase();
  res.json(dbData);
});

// Reset database to default
app.post("/api/v1/db/reset", (req, res) => {
  fs.unlinkSync(DB_PATH);
  loadDatabase();
  res.json({ message: "Database reset to defaults successfully", data: dbData });
});

// Global configurations get/update
app.get("/api/v1/config", (req, res) => {
  res.json(dbData.configurations);
});

app.post("/api/v1/config", (req, res) => {
  dbData.configurations = { ...dbData.configurations, ...req.body };
  saveDatabase();
  res.json({ message: "Configurations saved", config: dbData.configurations });
});

// Single user profiles get/update
app.get("/api/v1/user", (req, res) => {
  res.json(dbData.user);
});

app.post("/api/v1/user", (req, res) => {
  dbData.user = { ...dbData.user, ...req.body };
  // Keep synced in admin list as well
  const idx = dbData.adminUsersList.findIndex((u: any) => u.username === dbData.user.username);
  if (idx !== -1) {
    dbData.adminUsersList[idx] = {
      ...dbData.adminUsersList[idx],
      fullName: dbData.user.fullName,
      coins: dbData.user.coins,
      isVerified: dbData.user.isVerified,
      kycStatus: dbData.user.kycStatus
    };
  }
  saveDatabase();
  res.json({ message: "Profile synchronized", user: dbData.user });
});

// Gift list CRUD endpoints
app.get("/api/v1/gifts", (req, res) => {
  res.json(dbData.gifts);
});

app.post("/api/v1/gifts", (req, res) => {
  const newGift = { id: `g-${Date.now()}`, status: "active", ...req.body };
  dbData.gifts.push(newGift);
  saveDatabase();
  res.status(201).json(newGift);
});

app.put("/api/v1/gifts/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.gifts.findIndex((g: any) => g.id === id);
  if (index !== -1) {
    dbData.gifts[index] = { ...dbData.gifts[index], ...req.body };
    saveDatabase();
    res.json(dbData.gifts[index]);
  } else {
    res.status(404).json({ error: "Gift not found" });
  }
});

app.delete("/api/v1/gifts/:id", (req, res) => {
  const { id } = req.params;
  dbData.gifts = dbData.gifts.filter((g: any) => g.id !== id);
  saveDatabase();
  res.json({ message: "Gift deleted successfully" });
});

// Categories list operations
app.get("/api/v1/categories", (req, res) => {
  res.json(dbData.categories);
});

app.post("/api/v1/categories", (req, res) => {
  dbData.categories = req.body;
  saveDatabase();
  res.json(dbData.categories);
});

// Hosts endpoints
app.get("/api/v1/hosts", (req, res) => {
  res.json(dbData.hosts);
});

app.post("/api/v1/hosts", (req, res) => {
  const newHost = {
    id: `h-${Date.now()}`,
    isLive: true,
    viewers: 0,
    likes: 0,
    ...req.body
  };
  dbData.hosts.push(newHost);
  saveDatabase();
  res.status(201).json(newHost);
});

app.put("/api/v1/hosts/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.hosts.findIndex((h: any) => h.id === id);
  if (index !== -1) {
    dbData.hosts[index] = { ...dbData.hosts[index], ...req.body };
    saveDatabase();
    res.json(dbData.hosts[index]);
  } else {
    res.status(404).json({ error: "Host not found" });
  }
});

app.delete("/api/v1/hosts/:id", (req, res) => {
  const { id } = req.params;
  dbData.hosts = dbData.hosts.filter((h: any) => h.id !== id);
  saveDatabase();
  res.json({ message: "Host deleted successfully" });
});

// Families endpoints
app.get("/api/v1/families", (req, res) => {
  res.json(dbData.families);
});

app.post("/api/v1/families", (req, res) => {
  const newFamily = {
    id: `fam-${Date.now()}`,
    members: 1,
    rank: dbData.families.length + 1,
    avatar: "https://images.unsplash.com/photo-1513829096999-4978602294fc?auto=format&fit=crop&w=100&h=100&q=80",
    ...req.body
  };
  dbData.families.push(newFamily);
  saveDatabase();
  res.status(201).json(newFamily);
});

app.put("/api/v1/families/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.families.findIndex((f: any) => f.id === id);
  if (index !== -1) {
    dbData.families[index] = { ...dbData.families[index], ...req.body };
    saveDatabase();
    res.json(dbData.families[index]);
  } else {
    res.status(404).json({ error: "Family not found" });
  }
});

app.delete("/api/v1/families/:id", (req, res) => {
  const { id } = req.params;
  dbData.families = dbData.families.filter((f: any) => f.id !== id);
  saveDatabase();
  res.json({ message: "Family deleted successfully" });
});

// Agencies endpoints
app.get("/api/v1/agencies", (req, res) => {
  res.json(dbData.agencies);
});

app.post("/api/v1/agencies", (req, res) => {
  const newAgency = {
    id: `agency-${Date.now()}`,
    registeredHosts: 0,
    monthlyCommission: 0,
    ...req.body
  };
  dbData.agencies.push(newAgency);
  saveDatabase();
  res.status(201).json(newAgency);
});

app.put("/api/v1/agencies/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.agencies.findIndex((a: any) => a.id === id);
  if (index !== -1) {
    dbData.agencies[index] = { ...dbData.agencies[index], ...req.body };
    saveDatabase();
    res.json(dbData.agencies[index]);
  } else {
    res.status(404).json({ error: "Agency not found" });
  }
});

app.delete("/api/v1/agencies/:id", (req, res) => {
  const { id } = req.params;
  dbData.agencies = dbData.agencies.filter((a: any) => a.id !== id);
  saveDatabase();
  res.json({ message: "Agency deleted successfully" });
});

// Transactions ledger
app.get("/api/v1/transactions", (req, res) => {
  res.json(dbData.transactions);
});

app.post("/api/v1/transactions", (req, res) => {
  const newTxn = { id: `TXN-${Math.floor(100 + Math.random() * 900)}`, timestamp: new Date().toISOString(), status: "Completed", ...req.body };
  dbData.transactions.unshift(newTxn);
  saveDatabase();
  res.status(201).json(newTxn);
});

// Notifications inbox dispatcher
app.get("/api/v1/notifications", (req, res) => {
  res.json(dbData.notifications);
});

app.post("/api/v1/notifications", (req, res) => {
  const newNotif = { id: Date.now(), isNew: true, time: "Just Now", ...req.body };
  dbData.notifications.unshift(newNotif);
  saveDatabase();
  res.status(201).json(newNotif);
});

// Reports management
app.get("/api/v1/reports", (req, res) => {
  res.json(dbData.reports);
});

app.post("/api/v1/reports", (req, res) => {
  const newReport = { id: `REP-${Math.floor(100 + Math.random() * 900)}`, status: "pending", timestamp: new Date().toISOString(), ...req.body };
  dbData.reports.unshift(newReport);
  saveDatabase();
  res.status(201).json(newReport);
});

app.put("/api/v1/reports/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.reports.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    dbData.reports[index] = { ...dbData.reports[index], ...req.body };
    saveDatabase();
    res.json(dbData.reports[index]);
  } else {
    res.status(404).json({ error: "Report not found" });
  }
});

// KYC requests endpoints
app.get("/api/v1/kyc-requests", (req, res) => {
  res.json(dbData.kycRequests);
});

app.post("/api/v1/kyc-requests", (req, res) => {
  const newKyc = { id: `KYC-${Math.floor(1000 + Math.random() * 9000)}`, status: "pending", timestamp: new Date().toISOString(), ...req.body };
  dbData.kycRequests.unshift(newKyc);
  saveDatabase();
  res.status(201).json(newKyc);
});

app.put("/api/v1/kyc-requests/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.kycRequests.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    dbData.kycRequests[index] = { ...dbData.kycRequests[index], ...req.body };
    // Synchronize status back into user profile if it's the main profile
    if (dbData.kycRequests[index].username === dbData.user.username) {
      dbData.user.kycStatus = dbData.kycRequests[index].status;
      if (dbData.kycRequests[index].status === "approved") {
        dbData.user.isVerified = true;
      } else if (dbData.kycRequests[index].status === "rejected") {
        dbData.user.isVerified = false;
      }
    }
    // Update target inside admin users array
    const usrIdx = dbData.adminUsersList.findIndex((u: any) => u.username === dbData.kycRequests[index].username);
    if (usrIdx !== -1) {
      dbData.adminUsersList[usrIdx].kycStatus = dbData.kycRequests[index].status;
      if (dbData.kycRequests[index].status === "approved") {
        dbData.adminUsersList[usrIdx].isVerified = true;
      }
    }
    saveDatabase();
    res.json(dbData.kycRequests[index]);
  } else {
    res.status(404).json({ error: "KYC request not found" });
  }
});

// Admin Users grid management (ban/unban, edit stats)
app.get("/api/v1/admin-users", (req, res) => {
  res.json(dbData.adminUsersList);
});

app.put("/api/v1/admin-users/:username", (req, res) => {
  const { username } = req.params;
  const index = dbData.adminUsersList.findIndex((u: any) => u.username === username);
  if (index !== -1) {
    dbData.adminUsersList[index] = { ...dbData.adminUsersList[index], ...req.body };
    if (username === dbData.user.username) {
      dbData.user = { ...dbData.user, ...req.body };
    }
    saveDatabase();
    res.json(dbData.adminUsersList[index]);
  } else {
    res.status(404).json({ error: "Admin user not found" });
  }
});

// Events management
app.get("/api/v1/events", (req, res) => {
  res.json(dbData.events);
});

app.post("/api/v1/events", (req, res) => {
  const newEvt = { id: `evt-${Date.now()}`, active: true, ...req.body };
  dbData.events.push(newEvt);
  saveDatabase();
  res.status(201).json(newEvt);
});

// ------------------------------------------------------------------
// LEGACY GOOGLE GENAI MODERATOR ENDPOINTS
// ------------------------------------------------------------------
app.post("/api/ai/moderate", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text to moderate" });
  }

  const client = getAIClient();
  if (!client) {
    const lower = text.toLowerCase();
    const badWords = ["abuse", "spam", "scam", "cheat", "hack", "fake", "badword", "stupid", "idiot", "hate"];
    const flaggedWords = badWords.filter(w => lower.includes(w));
    const isViolating = flaggedWords.length > 0;

    return res.json({
      flagged: isViolating,
      reason: isViolating ? `Contains potential restricted content (${flaggedWords.join(", ")})` : "Approved",
      moderatorType: "Offline AI Content Moderator (Local Filter)",
      translatedText: text
    });
  }

  try {
    const prompt = `You are the AI Content Moderator for "Sehr Live", a premium live streaming platform. 
Analyze the following user chat message and determine if it violates community guidelines (e.g. hate speech, explicit abuse, scams, spam, or extreme insults).
Respond strictly in JSON format with two keys:
1. "flagged": boolean (true if inappropriate, false if okay)
2. "reason": string (a short explanation why, or "Approved" if false)

Message to moderate: "${text}"`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    const textOutput = response.text || "{}";
    const result = JSON.parse(textOutput.trim());
    return res.json({
      flagged: !!result.flagged,
      reason: result.reason || "Approved",
      moderatorType: "Sehr Live Server AI Moderation (Gemini-3.5-Flash)"
    });
  } catch (error: any) {
    console.error("AI Moderation Error:", error);
    return res.json({
      flagged: false,
      reason: "Error processing; default approved.",
      error: error.message,
      moderatorType: "Sehr Live Moderator Fallback"
    });
  }
});

app.post("/api/ai/translate", async (req, res) => {
  const { text, targetLanguage } = req.body;
  if (!text || !targetLanguage) {
    return res.status(400).json({ error: "Missing text or targetLanguage" });
  }

  const client = getAIClient();
  if (!client) {
    let translatedText = text;
    if (targetLanguage.toLowerCase() === "urdu") {
      translatedText = `[اردو ترجمہ] ${text} (AI offline simulation)`;
    } else if (targetLanguage.toLowerCase() === "hindi") {
      translatedText = `[हिंदी अनुवाद] ${text} (AI offline simulation)`;
    } else if (targetLanguage.toLowerCase() === "arabic") {
      translatedText = `[الترجمة العربية] ${text} (AI offline simulation)`;
    } else {
      translatedText = `[Translated to ${targetLanguage}] ${text} (AI offline)`;
    }

    return res.json({
      translatedText,
      sourceLanguage: "Detected Auto",
      type: "Offline Simulated Translator"
    });
  }

  try {
    const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the final translated text. Do not add any explanation or preamble.
Text: "${text}"`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    return res.json({
      translatedText: response.text ? response.text.trim() : text,
      sourceLanguage: "Detected Auto",
      type: "Sehr Live AI Translator"
    });
  } catch (error: any) {
    console.error("AI Translation Error:", error);
    return res.json({
      translatedText: `[Translation Error] ${text}`,
      sourceLanguage: "Auto",
      type: "Sehr Live Translation Fallback"
    });
  }
});

app.post("/api/ai/host-response", async (req, res) => {
  const { hostName, hostRole, userMessage, lastAction } = req.body;
  if (!hostName || !userMessage) {
    return res.status(400).json({ error: "Missing hostName or userMessage" });
  }

  const client = getAIClient();
  if (!client) {
    let reply = "Shukriya! Thank you for supporting my live stream! ❤️";
    if (lastAction === "gift") {
      reply = `Wow! Thank you so much for the luxury gift! This means the world to me! App sabhi log support karte rahein! 🌟✨`;
    } else {
      if (hostName.toLowerCase().includes("sahar")) {
        reply = `Hello, welcome to Sehr Live! I am playing some sweet tunes today. Let me know what song you want to hear! 🎵`;
      } else if (hostName.toLowerCase().includes("zain")) {
        reply = `Chalo guys! PK Battle start hone wali hai! Sabhi log double tap karo aur coin support dikhao! Let's win this PK! 🔥👊`;
      } else if (hostName.toLowerCase().includes("mehak")) {
        reply = `Welcome to my audio lounge. Grab a mic seat or relax. Tell us about your day, let's keep it cozy. ☕🎧`;
      }
    }

    return res.json({
      reply,
      speaker: hostName,
      type: "Simulated Live Host Response"
    });
  }

  try {
    const contextPrompt = `You are acting as "${hostName}", a popular, premium livestream host on "Sehr Live". 
Your personality/role is: "${hostRole || 'Friendly Streaming Star'}".
The user just sent you a message: "${userMessage}".
${lastAction === "gift" ? "CRITICAL: The user also just sent you a valuable gift! You must react with high energy, extreme gratitude, and excitement in your signature host style." : ""}
Provide a short, lively, authentic response (1-2 sentences maximum) that a live host would say over their microphone. Keep it natural, warm, and highly engaging. Include matching emojis. You can use English mixed with Hindi/Urdu (Hinglish) for an authentic social live feel.
Do not wrap your answer in quotes or add metadata. Speak as the host directly.`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contextPrompt,
    });

    return res.json({
      reply: response.text ? response.text.trim() : "Thanks for joining my live! 💕",
      speaker: hostName,
      type: "Sehr Live Gemini AI Host"
    });
  } catch (error: any) {
    console.error("AI Host Error:", error);
    return res.json({
      reply: "Thank you so much for the love and support! Let's rock Sehr Live! 🎉",
      speaker: hostName,
      type: "Sehr Live Host Fallback"
    });
  }
});

// ------------------------------------------------------------------
// VITE OR STATIC MIDDLEWARE SETUP
// ------------------------------------------------------------------
async function startServer() {
  // Separate routes for Web Admin
  app.get("/admin", (req, res) => {
    if (process.env.NODE_ENV !== "production") {
      res.redirect("/admin.html");
    } else {
      res.sendFile(path.join(process.cwd(), "dist", "admin.html"));
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    app.get('*', (req, res) => {
      // If requested file looks like an admin file or contains /admin in path, redirect/serve admin
      if (req.path.startsWith("/admin")) {
        res.sendFile(path.join(distPath, 'admin.html'));
      } else {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sehr Live Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
