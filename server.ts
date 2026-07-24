import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import agoraToken from "agora-token";
const { RtcTokenBuilder, RtcRole } = agoraToken;
import {
  checkAndSeedDatabase,
  startFirestoreSynchronization,
  dbDataCache,
  syncDocument,
  deleteDocument,
  writeMetadata,
  clearAllHostsInFirestore
} from "./src/db/firebaseDb";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Production API Request Logging & Monitoring Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[SEHR-LIVE PRODUCTION LOGGER] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Enable CORS for production-ready custom subdomain endpoints
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// ------------------------------------------------------------------
// FILE-BASED DATABASE STATE & DURABLE CLOUD-LIKE PERSISTENCE
// ------------------------------------------------------------------
const DB_PATH = path.join(process.cwd(), "sehr_live_db.json");

// Define dbData as a reference pointing directly to the real-time replicated Firestore cache
let dbData: any = dbDataCache;

async function loadDatabase() {
  try {
    // 1. Check if Firestore contains seeded tables, if not seed it from local database template
    await checkAndSeedDatabase();

    // 2. Clear all stale hosts from Firestore and local cache to ensure fresh active-only live stream directory
    await clearAllHostsInFirestore();

    // 3. Start real-time Firestore synchronization listeners
    startFirestoreSynchronization();

    // 4. Fallback: Load initial local cache immediately during server boot to ensure zero startup latency
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      const local = JSON.parse(raw);
      Object.assign(dbDataCache, local);
      console.log("[SEHR-LIVE FIREBASE] Pre-populated in-memory cache with local database backup.");
    }
    
    // Explicitly guarantee hosts array is clean on startup
    dbDataCache.hosts = [];

    // Ensure all registered user accounts have at least 1M (1000000) coins for local testing
    if (Array.isArray(dbDataCache.users)) {
      dbDataCache.users.forEach((u: any) => {
        if (!u.coins || u.coins < 1000000) {
          u.coins = 1000000;
          syncDocument("users", u.username, u);
        }
      });
    }
    if (dbDataCache.user && (!dbDataCache.user.coins || dbDataCache.user.coins < 1000000)) {
      dbDataCache.user.coins = 1000000;
      writeMetadata("user_profile", dbDataCache.user);
    }
    if (Array.isArray(dbDataCache.adminUsersList)) {
      dbDataCache.adminUsersList.forEach((au: any) => {
        if (!au.coins || au.coins < 1000000) {
          au.coins = 1000000;
          syncDocument("adminUsersList", au.username, au);
        }
      });
    }
    saveDatabase();
  } catch (e) {
    console.error("[SEHR-LIVE FIREBASE] Error loading database:", e);
  }
}

let lastSavedUserStr = "";
let lastSavedConfigStr = "";
let lastSavedCategoriesStr = "";

function saveDatabase() {
  try {
    // Write local backup for safety
    fs.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), "utf-8");

    // Asynchronously push metadata updates to Firebase Firestore only if they have actually changed
    const currentUserStr = JSON.stringify(dbData.user || {});
    if (currentUserStr !== lastSavedUserStr) {
      writeMetadata("user_profile", dbData.user);
      lastSavedUserStr = currentUserStr;
    }

    const currentConfigStr = JSON.stringify(dbData.configurations || {});
    if (currentConfigStr !== lastSavedConfigStr) {
      writeMetadata("configurations", dbData.configurations);
      lastSavedConfigStr = currentConfigStr;
    }

    const currentCategoriesStr = JSON.stringify(dbData.categories || []);
    if (currentCategoriesStr !== lastSavedCategoriesStr) {
      writeMetadata("categories", { list: dbData.categories });
      lastSavedCategoriesStr = currentCategoriesStr;
    }
  } catch (e) {
    console.error("[SEHR-LIVE FIREBASE] Error saving database:", e);
  }
}

function ensureDatabaseSchema() {
  // Firestore auto-handles schema dynamically!
}

// Perform initial load asynchronously
loadDatabase();

// ------------------------------------------------------------------
// SECURE USER AUTHENTICATION & AUTHORIZATION MIDDLEWARE
// ------------------------------------------------------------------
function authenticateUser(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Legacy / Guest mode fallback:
    req.user = dbData.user;
    return next();
  }
  const token = authHeader.substring(7);
  const session = dbData.sessions?.[token];
  if (session) {
    const user = dbData.users?.find((u: any) => u.username === session.username);
    if (user) {
      req.user = user;
      req.token = token;
      return next();
    }
  }
  
  // Unauthorized token format / expired session, send unauthorized
  return res.status(401).json({ error: "Session expired or invalid token. Please log in again." });
}

// ------------------------------------------------------------------
// AGORA SECURE TOKEN GENERATION ENDPOINT
// ------------------------------------------------------------------
const handleAgoraTokenRequest = (req: any, res: any) => {
  try {
    const { channelName, uid, role } = req.body;
    if (!channelName) {
      return res.status(400).json({ error: "channelName is required" });
    }

    const appId = process.env.AGORA_APP_ID || "MOCK_AGORA_APP_ID";
    const appCertificate = process.env.AGORA_APP_CERTIFICATE || "";

    const agoraUid = uid ? Number(uid) : 0;
    const resolvedRole = (role === "publisher" || role === "host" || role === 1)
      ? RtcRole.PUBLISHER
      : RtcRole.SUBSCRIBER;

    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    let token: string | null = null;
    if (appId !== "MOCK_AGORA_APP_ID" && appCertificate) {
      try {
        token = RtcTokenBuilder.buildTokenWithUid(
          appId,
          appCertificate,
          channelName,
          agoraUid,
          resolvedRole,
          privilegeExpiredTs,
          privilegeExpiredTs
        );
        console.log(`[SEHR-LIVE AGORA] Generated REAL token for channel ${channelName}, uid ${agoraUid}`);
      } catch (err: any) {
        console.error("[SEHR-LIVE AGORA] RtcTokenBuilder failed:", err);
      }
    } else {
      token = `mock-token-${channelName}-${agoraUid}-${resolvedRole}`;
      console.log(`[SEHR-LIVE AGORA] AGORA_APP_ID not configured in env. Returning mock token and sandbox appId.`);
    }

    return res.json({
      token,
      appId,
      channelName,
      uid: agoraUid,
      expiresAt: privilegeExpiredTs
    });
  } catch (error: any) {
    console.error("[SEHR-LIVE AGORA] Token generation error:", error);
    return res.status(500).json({ error: error.message });
  }
};

app.post("/api/agora/token", authenticateUser, handleAgoraTokenRequest);
app.post("/api/v1/agora/token", authenticateUser, handleAgoraTokenRequest);

// ------------------------------------------------------------------
// AUTHENTICATION & PROFILE PERSISTENCE ENDPOINTS
// ------------------------------------------------------------------

// 0. Authenticate or register with Google Authentication details
app.post("/api/v1/auth/google-login", (req, res) => {
  const { email, displayName, photoURL, uid } = req.body;
  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "Email is required for Google Sign-In" });
  }

  // Construct standard unique username and unique ID from Google details
  const username = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_") || `google_user_${uid?.substring(0, 5)}`;
  let user = dbData.users.find((u: any) => u.email === email || u.username === username);

  if (!user) {
    // Automatically register a new user using their real Google account profile
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const uniqueId = `sehr_${suffix}`;
    user = {
      username,
      uniqueId,
      email,
      avatar: photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
      coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      bio: "New Sehr Live member! Verified via Google. 🇵🇰",
      gender: "Male",
      country: "Pakistan",
      language: "Urdu / Hinglish",
      coins: 1000000, // starting gift coins (1M) for Google verified sign-ups
      diamonds: 0,
      vipLevel: 0,
      userLevel: 1,
      hostLevel: 1,
      wealthLevel: 1,
      xp: 0,
      familyId: "",
      agencyId: "",
      isVerified: true, // Google accounts are pre-verified
      isBanned: false,
      twoFactorEnabled: false,
      fullName: displayName || `User_${username}`,
      dob: "",
      phoneNumber: "",
      kycStatus: "approved", // pre-approved KYC
      followersCount: 0,
      followingCount: 0,
      totalLikesCount: 0,
      selectedFrameId: "",
      vipSuspended: false
    };
    dbData.users.push(user);

    const adminUser = {
      username: user.username,
      fullName: user.fullName,
      isVerified: user.isVerified,
      kycStatus: user.kycStatus,
      isBanned: user.isBanned,
      coins: user.coins,
      userLevel: user.userLevel,
      vipLevel: user.vipLevel
    };
    dbData.adminUsersList.push(adminUser);

    // Sync to Firestore
    syncDocument("users", user.username, user);
    syncDocument("adminUsersList", user.username, adminUser);
  } else {
    // Existing user - ensure standard properties are fully initialized and not undefined
    if (photoURL && user.avatar === "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80") {
      user.avatar = photoURL;
      syncDocument("users", user.username, user);
    }
  }

  // Generate session Token
  const token = `sehr_session_${user.username}_${Math.random().toString(36).substring(2, 10)}`;
  const sessionData = {
    username: user.username,
    loginTime: new Date().toISOString()
  };
  dbData.sessions[token] = sessionData;

  // Sync active legacy user reference
  dbData.user = user;

  saveDatabase();

  syncDocument("sessions", token, sessionData);
  writeMetadata("user_profile", user);

  res.json({
    success: true,
    message: "Authenticated via Google successfully.",
    token,
    user
  });
});

// 0.5. Authenticate or register with Guest Authentication details
app.post("/api/v1/auth/guest-login", (req, res) => {
  const suffix = Math.floor(10000 + Math.random() * 90000);
  const username = `guest_${suffix}`;
  const uniqueId = `sehr_guest_${suffix}`;

  const user = {
    username,
    uniqueId,
    email: "",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
    coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    bio: "Guest Explorer in Sehr Live! 🇵🇰",
    gender: "Male",
    country: "Pakistan",
    language: "Urdu / Hinglish",
    coins: 1000000, // starting gift coins (1M) for guest verified sign-ups
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
    fullName: `Guest_${suffix}`,
    dob: "",
    phoneNumber: "",
    kycStatus: "none",
    followersCount: 0,
    followingCount: 0,
    totalLikesCount: 0,
    selectedFrameId: "",
    vipSuspended: false
  };

  dbData.users.push(user);

  // Sync to Firestore
  syncDocument("users", user.username, user);

  // Generate session Token
  const token = `sehr_session_guest_${suffix}`;
  const sessionData = {
    username: user.username,
    loginTime: new Date().toISOString()
  };
  dbData.sessions[token] = sessionData;

  // Sync active legacy user reference
  dbData.user = user;

  saveDatabase();

  syncDocument("sessions", token, sessionData);
  writeMetadata("user_profile", user);

  res.json({
    success: true,
    message: "Authenticated as Guest successfully.",
    token,
    user
  });
});

// 1. Send OTP (or auto-register if phone is new)
app.post("/api/v1/auth/send-otp", (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber || typeof phoneNumber !== "string" || phoneNumber.length < 7) {
    return res.status(400).json({ error: "Invalid mobile phone number format." });
  }

  // Generate random 4-digit OTP
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  dbData.otps[phoneNumber] = otp;
  saveDatabase();
  syncDocument("otps", phoneNumber, { otp, timestamp: new Date().toISOString() });

  console.log(`[SEHR-LIVE PRODUCTION SMS GATEWAY] Generated OTP [${otp}] for phone: ${phoneNumber}`);
  
  res.json({
    success: true,
    message: "OTP code dispatched via simulated secure SMS carrier gateway.",
    otp: otp // Return for offline emulation ease and robust testing
  });
});

// 2. Verify OTP and authenticate session
app.post("/api/v1/auth/verify-otp", (req, res) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: "Phone number and verification OTP code are required." });
  }

  const storedOtp = dbData.otps[phoneNumber];
  // Allow legacy fallback OTP "4589" OR the real dynamic OTP
  if (otp !== "4589" && otp !== storedOtp) {
    return res.status(401).json({ error: "Invalid verification code. Please check and try again." });
  }

  // Find user by phoneNumber
  let user = dbData.users.find((u: any) => u.phoneNumber === phoneNumber);
  
  if (!user) {
    // Automatically register new user
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const username = `user_${suffix}`;
    const uniqueId = `sehr_${suffix}`;
    user = {
      username,
      uniqueId,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
      coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      bio: "New Sehr Live member! Hello Pakistan! 🇵🇰",
      gender: "Male",
      country: "Pakistan",
      language: "Urdu / Hinglish",
      coins: 1000000, // starting coins (1M)
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
      fullName: `User ${suffix}`,
      dob: "",
      phoneNumber: phoneNumber,
      kycStatus: "none",
      followersCount: 0,
      followingCount: 0,
      totalLikesCount: 0,
      selectedFrameId: "",
      vipSuspended: false
    };
    dbData.users.push(user);
    
    // Push to admin users list
    const adminUser = {
      username: user.username,
      fullName: user.fullName,
      isVerified: user.isVerified,
      kycStatus: user.kycStatus,
      isBanned: user.isBanned,
      coins: user.coins,
      userLevel: user.userLevel,
      vipLevel: user.vipLevel
    };
    dbData.adminUsersList.push(adminUser);

    // Sync newly created user & admin user profile to Firestore
    syncDocument("users", user.username, user);
    syncDocument("adminUsersList", user.username, adminUser);
  }

  // Generate Session Token
  const token = `sehr_session_${user.username}_${Math.random().toString(36).substring(2, 10)}`;
  const sessionData = {
    username: user.username,
    loginTime: new Date().toISOString()
  };
  dbData.sessions[token] = sessionData;

  // Sync active legacy user reference
  dbData.user = user;
  
  // Clean up used OTP
  delete dbData.otps[phoneNumber];
  saveDatabase();

  // Firestore sync for session and deleting verified OTP
  syncDocument("sessions", token, sessionData);
  deleteDocument("otps", phoneNumber);
  writeMetadata("user_profile", user);

  res.json({
    success: true,
    message: "Authenticated successfully.",
    token,
    user
  });
});

// 3. Get currently authenticated profile (Auth Me)
app.get("/api/v1/auth/me", authenticateUser, (req: any, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

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
app.get("/api/v1/user", authenticateUser, (req: any, res) => {
  res.json(req.user || dbData.user);
});

app.post("/api/v1/user", authenticateUser, (req: any, res) => {
  // Use the authenticated user profile
  const user = req.user || dbData.user;
  
  // Server-side validation of incoming updates
  if (req.body.coins !== undefined) {
    const coins = Number(req.body.coins);
    if (isNaN(coins) || coins < 0) {
      return res.status(400).json({ error: "Invalid coin balance value." });
    }
    // SECURE CHECK: Block direct coin increase by user
    if (coins > (user.coins || 0)) {
      return res.status(403).json({ error: "Security Exception: Users are unauthorized to increase their coin balance directly." });
    }
  }
  
  if (req.body.diamonds !== undefined) {
    const diamonds = Number(req.body.diamonds);
    if (isNaN(diamonds) || diamonds < 0) {
      return res.status(400).json({ error: "Invalid diamond balance value." });
    }
    // SECURE CHECK: Users can never add diamonds directly
    if (diamonds > (user.diamonds || 0)) {
      return res.status(403).json({ error: "Security Exception: Direct diamond balance increase is forbidden." });
    }
  }

  if (req.body.agencyId !== undefined && req.body.agencyId !== user.agencyId) {
    return res.status(403).json({ error: "Security Exception: Direct agency status modification is forbidden." });
  }

  const updatedUser = { ...user, ...req.body };
  
  // Sync changes in the persistent users list
  const idxInUsers = dbData.users.findIndex((u: any) => u.username === user.username);
  if (idxInUsers !== -1) {
    dbData.users[idxInUsers] = updatedUser;
  } else {
    dbData.users.push(updatedUser);
  }

  // Keep legacy user reference synchronized
  dbData.user = updatedUser;

  // Keep synced in admin list as well
  const idx = dbData.adminUsersList.findIndex((u: any) => u.username === updatedUser.username);
  if (idx !== -1) {
    dbData.adminUsersList[idx] = {
      ...dbData.adminUsersList[idx],
      fullName: updatedUser.fullName,
      coins: updatedUser.coins,
      isVerified: updatedUser.isVerified,
      kycStatus: updatedUser.kycStatus
    };
  }
  saveDatabase();

  // Sync to Firestore
  syncDocument("users", updatedUser.username, updatedUser);
  writeMetadata("user_profile", updatedUser);
  if (idx !== -1) {
    syncDocument("adminUsersList", updatedUser.username, dbData.adminUsersList[idx]);
  }

  res.json({ message: "Profile synchronized", user: updatedUser });
});

// Gift list CRUD endpoints
const DEFAULT_ADVANCED_GIFTS_SERVER = [
  { id: "g-rose", name: "Red Rose", cost: 10, type: "2d", icon: "🌹", color: "from-pink-500 to-rose-600", animationClass: "animate-bounce", category: "Popular", description: "A fresh beautiful red rose of deep admiration.", animationFile: "🌹", animationFormat: "svg", animationDuration: 5, animationDisplayType: "small", comboSupported: true, status: "active", featured: true, priority: 10 },
  { id: "g-heart", name: "Love Heart", cost: 99, type: "2d", icon: "💖", color: "from-red-500 to-pink-500", animationClass: "animate-pulse", category: "Popular", description: "Express your warm affection.", animationFile: "💖", animationFormat: "svg", animationDuration: 5, animationDisplayType: "small", comboSupported: true, status: "active", featured: true, priority: 9 },
  { id: "g-lucky-coin", name: "Lucky Coin", cost: 50, type: "2d", icon: "🪙", color: "from-yellow-400 to-amber-600", animationClass: "animate-bounce", category: "Lucky", description: "Send fortune!", animationFile: "🪙", animationFormat: "svg", animationDuration: 5, animationDisplayType: "small", comboSupported: true, status: "active", featured: false, priority: 8 },
  { id: "g-crown", name: "VIP Crown", cost: 999, type: "3d", icon: "👑", color: "from-yellow-400 to-amber-600", animationClass: "animate-spin", category: "VIP", description: "Royal crown for the star.", animationFile: "👑", animationFormat: "svga", animationDuration: 10, animationDisplayType: "half", comboSupported: true, status: "active", featured: true, priority: 7 },
  { id: "g-star-trophy", name: "Star Trophy", cost: 500, type: "3d", icon: "🏆", color: "from-yellow-300 to-amber-500", animationClass: "animate-pulse", category: "New", description: "Awarded to energetic hosts.", animationFile: "🏆", animationFormat: "svg", animationDuration: 8, animationDisplayType: "half", comboSupported: true, status: "active", featured: false, priority: 6 },
  { id: "g-car", name: "Sports Car", cost: 4999, type: "luxury", icon: "🏎️", color: "from-blue-500 to-indigo-600", animationClass: "animate-bounce", category: "Luxury", description: "Rev your engine!", animationFile: "🏎️", animationFormat: "webm", animationDuration: 10, animationDisplayType: "full", comboSupported: false, status: "active", featured: true, priority: 4 },
  { id: "g-rocket", name: "Space Rocket", cost: 9999, type: "luxury", icon: "🚀", color: "from-purple-600 to-pink-600", animationClass: "animate-pulse", category: "Premium", description: "Blast off into the cosmos!", animationFile: "🚀", animationFormat: "webm", animationDuration: 15, animationDisplayType: "full", comboSupported: false, status: "active", featured: true, priority: 3 },
  { id: "g-dragon", name: "Golden Dragon", cost: 29999, type: "luxury", icon: "🐉", color: "from-amber-500 to-red-600", animationClass: "animate-bounce", category: "Luxury", description: "Screaming golden fire storm!", animationFile: "🐉", animationFormat: "svga", animationDuration: 30, animationDisplayType: "ultra", comboSupported: false, status: "active", featured: true, priority: 2 }
];

app.get("/api/v1/gifts", (req, res) => {
  if (!dbData.gifts || dbData.gifts.length === 0) {
    dbData.gifts = DEFAULT_ADVANCED_GIFTS_SERVER;
  }
  res.json(dbData.gifts);
});

app.post("/api/v1/gifts/send", authenticateUser, (req, res) => {
  const { requestId, giftId, count = 1, recipient = "Host", targetHostSide } = req.body;
  if (!giftId) {
    return res.status(400).json({ error: "giftId is required" });
  }

  if (requestId && dbData.processedGiftRequests && dbData.processedGiftRequests[requestId]) {
    return res.json(dbData.processedGiftRequests[requestId]);
  }

  if (!dbData.gifts || dbData.gifts.length === 0) {
    dbData.gifts = DEFAULT_ADVANCED_GIFTS_SERVER;
  }

  let gift = dbData.gifts.find((g: any) => g.id === giftId);
  if (!gift) {
    gift = DEFAULT_ADVANCED_GIFTS_SERVER.find((g: any) => g.id === giftId);
  }
  if (!gift) {
    return res.status(404).json({ error: "Gift not found" });
  }

  if (gift.status === "inactive") {
    return res.status(400).json({ error: "This gift is currently inactive." });
  }

  const giftCost = Number(gift.cost) || 0;
  const giftCount = Math.max(1, Number(count) || 1);
  const totalCost = giftCost * giftCount;

  const user = (req as any).user || dbData.user;
  const userCoins = Number(user.coins) || 0;

  if (userCoins < totalCost) {
    return res.status(400).json({ error: `Insufficient balance. Required: ${totalCost} coins, Available: ${userCoins} coins.` });
  }

  user.coins = userCoins - totalCost;
  user.xp = (user.xp || 0) + Math.floor(totalCost * 0.2);

  const hostEarnings = Math.floor(totalCost * 0.5);
  const companyShare = totalCost - hostEarnings;

  if (!dbData.platformMetrics) {
    dbData.platformMetrics = { totalGiftCoins: 0, companyRevenue: 0, hostDiamondsDistributed: 0 };
  }
  dbData.platformMetrics.totalGiftCoins = (dbData.platformMetrics.totalGiftCoins || 0) + totalCost;
  dbData.platformMetrics.companyRevenue = (dbData.platformMetrics.companyRevenue || 0) + companyShare;
  dbData.platformMetrics.hostDiamondsDistributed = (dbData.platformMetrics.hostDiamondsDistributed || 0) + hostEarnings;

  const txId = requestId || `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const txLog = {
    id: txId,
    type: "gift_sent",
    amount: totalCost,
    currency: "coins",
    hostEarnings,
    companyShare,
    sender: user.username,
    senderAvatar: user.avatar || "",
    recipient,
    giftName: gift.name,
    giftIcon: gift.icon,
    count: giftCount,
    targetHostSide: targetHostSide || "hostA",
    timestamp: new Date().toISOString(),
    status: "Completed"
  };

  if (!dbData.transactions) dbData.transactions = [];
  dbData.transactions.unshift(txLog);

  const responseData = {
    success: true,
    transactionId: txId,
    gift,
    count: giftCount,
    totalCoinsSpent: totalCost,
    remainingCoins: user.coins,
    hostEarnings,
    companyShare,
    recipient,
    pkScoreAdded: totalCost,
    timestamp: txLog.timestamp
  };

  if (!dbData.processedGiftRequests) dbData.processedGiftRequests = {};
  if (requestId) {
    dbData.processedGiftRequests[requestId] = responseData;
  }

  // Update active host stream state with lastGiftEvent & PK scores
  const hostId = req.body.hostId;
  const activeHostMatch = (dbData.hosts || []).find((h: any) => 
    (hostId && (h.id === hostId || h.hostUsername === hostId || h.name === hostId)) ||
    (recipient && h.hostUsername && recipient.toLowerCase().includes(h.hostUsername.toLowerCase())) ||
    h.isLive
  );

  if (activeHostMatch) {
    const isOpponent = targetHostSide === "hostB";
    if (isOpponent) {
      activeHostMatch.pkScoreOpponent = (activeHostMatch.pkScoreOpponent || 0) + totalCost;
    } else {
      activeHostMatch.pkScoreHost = (activeHostMatch.pkScoreHost || 0) + totalCost;
    }

    activeHostMatch.lastGiftEvent = {
      giftId: gift.id,
      giftName: gift.name,
      giftIcon: gift.icon,
      count: giftCount,
      senderUsername: user.username,
      senderAvatar: user.avatar || "",
      recipient: recipient || "Host",
      totalCost,
      targetHostSide: targetHostSide || "hostA",
      timestamp: Date.now()
    };

    activeHostMatch.likes = (activeHostMatch.likes || 0) + Math.max(1, Math.floor(totalCost * 0.1));

    syncDocument("hosts", activeHostMatch.id, activeHostMatch);
    console.log(`[REALTIME GIFT SYNC] Updated host ${activeHostMatch.id} with gift ${gift.name} from @${user.username}`);
  }

  saveDatabase();

  return res.json(responseData);
});

// GET /api/v1/gifts/supporters - Retrieve real top supporters aggregated from backend gift transactions
app.get("/api/v1/gifts/supporters", (req, res) => {
  const giftTxs = (dbData.transactions || []).filter((tx: any) => tx.type === "gift_sent");

  const supporterMap: Record<string, { id: string; username: string; avatar: string; coinsContributed: number }> = {};
  const hostAMap: Record<string, { id: string; username: string; avatar: string; coinsContributed: number }> = {};
  const hostBMap: Record<string, { id: string; username: string; avatar: string; coinsContributed: number }> = {};

  giftTxs.forEach((tx: any) => {
    const key = tx.sender || "Anonymous";
    const avatar = tx.senderAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&h=100&q=80";
    const coins = Number(tx.amount) || 0;

    if (!supporterMap[key]) {
      supporterMap[key] = { id: `sup-${key}`, username: key, avatar, coinsContributed: 0 };
    }
    supporterMap[key].coinsContributed += coins;

    const side = tx.targetHostSide || "hostA";
    const targetMap = side === "hostB" ? hostBMap : hostAMap;
    if (!targetMap[key]) {
      targetMap[key] = { id: `sup-${side}-${key}`, username: key, avatar, coinsContributed: 0 };
    }
    targetMap[key].coinsContributed += coins;
  });

  const topGifters = Object.values(supporterMap).sort((a, b) => b.coinsContributed - a.coinsContributed);
  const hostASupporters = Object.values(hostAMap).sort((a, b) => b.coinsContributed - a.coinsContributed);
  const hostBSupporters = Object.values(hostBMap).sort((a, b) => b.coinsContributed - a.coinsContributed);

  res.json({
    topGifters: topGifters.slice(0, 5),
    hostASupporters: hostASupporters.slice(0, 3),
    hostBSupporters: hostBSupporters.slice(0, 3)
  });
});

app.post("/api/v1/gifts", (req, res) => {
  const newGift = { id: `g-${Date.now()}`, status: "active", ...req.body };
  dbData.gifts.push(newGift);
  saveDatabase();
  syncDocument("gifts", newGift.id, newGift);
  res.status(201).json(newGift);
});

app.put("/api/v1/gifts/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.gifts.findIndex((g: any) => g.id === id);
  if (index !== -1) {
    dbData.gifts[index] = { ...dbData.gifts[index], ...req.body };
    saveDatabase();
    syncDocument("gifts", id, dbData.gifts[index]);
    res.json(dbData.gifts[index]);
  } else {
    res.status(404).json({ error: "Gift not found" });
  }
});

app.delete("/api/v1/gifts/:id", (req, res) => {
  const { id } = req.params;
  dbData.gifts = dbData.gifts.filter((g: any) => g.id !== id);
  saveDatabase();
  deleteDocument("gifts", id);
  res.json({ message: "Gift deleted successfully" });
});

// Categories list operations
app.get("/api/v1/categories", (req, res) => {
  res.json(dbData.categories);
});

app.post("/api/v1/categories", (req, res) => {
  dbData.categories = req.body;
  saveDatabase();
  writeMetadata("categories", { list: req.body });
  res.json(dbData.categories);
});

// Hosts endpoints
const findHostIndex = (id: string) => {
  if (!id) return -1;
  const cleanId = id.replace(/^h-/, "");
  return dbData.hosts.findIndex((h: any) => 
    h.id === id || 
    h.id === `h-${cleanId}` ||
    h.hostUsername === id || 
    h.hostUsername === cleanId || 
    h.name === id || 
    h.name === cleanId ||
    h.hostUid === id ||
    h.hostUid === cleanId
  );
};

app.get("/api/v1/hosts", (req, res) => {
  const activeHosts = (dbData.hosts || []).filter((h: any) => h.isLive !== false && h.status !== "ended");
  res.json(activeHosts);
});

app.post("/api/v1/hosts", (req, res) => {
  const hostData = req.body || {};
  const hostUsername = hostData.hostUsername || hostData.name || "live_host";
  const hostId = hostData.id || `h-${hostData.hostUid || hostUsername}`;
  
  const newHost = {
    id: hostId,
    isLive: true,
    status: "live",
    category: hostData.category || "video",
    viewers: hostData.viewers || 0,
    realViewerCount: hostData.realViewerCount || 0,
    likes: hostData.likes || 0,
    connectedViewers: hostData.connectedViewers || [],
    comments: hostData.comments || [],
    ...hostData,
    hostUsername,
    hostUid: hostData.hostUid || hostData.hostUsername || hostData.name,
    updatedAt: new Date().toISOString()
  };

  const existingIdx = findHostIndex(hostId);

  if (existingIdx !== -1) {
    const existing = dbData.hosts[existingIdx];
    const commentsToKeep = (newHost.comments && newHost.comments.length > 0) ? newHost.comments : (existing.comments || []);
    const connectedToKeep = (newHost.connectedViewers && newHost.connectedViewers.length > 0) ? newHost.connectedViewers : (existing.connectedViewers || []);
    const realViewerCountToKeep = Math.max(newHost.realViewerCount || 0, connectedToKeep.length, existing.realViewerCount || 0);
    const likesToKeep = Math.max(newHost.likes || 0, existing.likes || 0);

    dbData.hosts[existingIdx] = {
      ...existing,
      ...newHost,
      comments: commentsToKeep,
      connectedViewers: connectedToKeep,
      realViewerCount: realViewerCountToKeep,
      likes: likesToKeep,
      isLive: true,
      status: "live"
    };
    saveDatabase();
    syncDocument("hosts", hostId, dbData.hosts[existingIdx]);
    console.log(`[LIVE SERVER SUCCESS] Updated existing host stream: ${hostId} (@${hostUsername})`);
    return res.status(200).json(dbData.hosts[existingIdx]);
  } else {
    dbData.hosts.push(newHost);
    saveDatabase();
    syncDocument("hosts", hostId, newHost);
    console.log(`[LIVE SERVER SUCCESS] Registered new host stream: ${hostId} (@${hostUsername})`);
    return res.status(201).json(newHost);
  }
});

app.get("/api/v1/hosts/:id", (req, res) => {
  const { id } = req.params;
  const index = findHostIndex(id);
  if (index !== -1) {
    res.json(dbData.hosts[index]);
  } else {
    res.status(404).json({ error: "Host not found" });
  }
});

app.put("/api/v1/hosts/:id", (req, res) => {
  const { id } = req.params;
  const index = findHostIndex(id);
  if (index !== -1) {
    const existing = dbData.hosts[index];
    const updateData = { ...req.body };

    // Safely preserve comments if omitted or empty array in updateData while existing has comments
    if ((updateData.comments === undefined || (Array.isArray(updateData.comments) && updateData.comments.length === 0)) && existing.comments && existing.comments.length > 0) {
      updateData.comments = existing.comments;
    }
    // Safely preserve connectedViewers if not provided in updateData
    if (updateData.connectedViewers === undefined && existing.connectedViewers) {
      updateData.connectedViewers = existing.connectedViewers;
      updateData.realViewerCount = existing.connectedViewers.length;
    }
    // Safely preserve likes if updateData.likes is omitted or smaller
    if (existing.likes !== undefined && (updateData.likes === undefined || updateData.likes < existing.likes)) {
      updateData.likes = existing.likes;
    }
    // Safely preserve last gift/like/join events if omitted
    if (updateData.lastGiftEvent === undefined && existing.lastGiftEvent) {
      updateData.lastGiftEvent = existing.lastGiftEvent;
    }
    if (updateData.lastLikeEvent === undefined && existing.lastLikeEvent) {
      updateData.lastLikeEvent = existing.lastLikeEvent;
    }
    if (updateData.lastJoinEvent === undefined && existing.lastJoinEvent) {
      updateData.lastJoinEvent = existing.lastJoinEvent;
    }
    if (updateData.pkScoreHost === undefined && existing.pkScoreHost !== undefined) {
      updateData.pkScoreHost = existing.pkScoreHost;
    }
    if (updateData.pkScoreOpponent === undefined && existing.pkScoreOpponent !== undefined) {
      updateData.pkScoreOpponent = existing.pkScoreOpponent;
    }

    dbData.hosts[index] = { ...existing, ...updateData, updatedAt: new Date().toISOString() };
    saveDatabase();
    syncDocument("hosts", dbData.hosts[index].id, dbData.hosts[index]);
    res.json(dbData.hosts[index]);
  } else {
    const newHost = {
      id,
      isLive: true,
      viewers: 1,
      realViewerCount: 1,
      likes: 0,
      connectedViewers: [],
      comments: [],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    dbData.hosts.push(newHost);
    saveDatabase();
    syncDocument("hosts", id, newHost);
    res.json(newHost);
  }
});

app.post("/api/v1/hosts/:id/like", (req, res) => {
  const { id } = req.params;
  const { count = 1, senderUsername, xPercent, yPercent } = req.body || {};
  const index = findHostIndex(id);
  if (index !== -1) {
    const host = dbData.hosts[index];
    host.likes = (host.likes || 0) + Number(count);
    host.lastLikeEvent = {
      senderUsername: senderUsername || "Viewer",
      timestamp: Date.now(),
      count: Number(count),
      xPercent,
      yPercent
    };
    saveDatabase();
    syncDocument("hosts", host.id, host);
    res.json({ success: true, likes: host.likes, lastLikeEvent: host.lastLikeEvent });
  } else {
    res.status(404).json({ error: "Host not found" });
  }
});

app.delete("/api/v1/hosts/:id", (req, res) => {
  const { id } = req.params;
  const index = findHostIndex(id);
  const targetId = index !== -1 ? dbData.hosts[index].id : id;
  
  if (index !== -1) {
    dbData.hosts.splice(index, 1);
  } else {
    dbData.hosts = dbData.hosts.filter((h: any) => h.id !== id && h.hostUsername !== id && h.name !== id);
  }
  saveDatabase();
  deleteDocument("hosts", targetId);
  console.log(`[LIVE SERVER SUCCESS] Ended/Deleted host stream: ${id} (targetId: ${targetId})`);
  res.json({ message: "Host deleted successfully", targetId });
});

// Real-time viewer presence & comments endpoints
app.post("/api/v1/hosts/:id/join", (req, res) => {
  const { id } = req.params;
  const { userId, username, avatar, level, vipLevel } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "Username is required to join" });
  }
  const index = findHostIndex(id);
  if (index !== -1) {
    const host = dbData.hosts[index];
    if (!host.connectedViewers) {
      host.connectedViewers = [];
    }
    // Avoid duplicate entries in list
    if (!host.connectedViewers.some((v: any) => v.username === username)) {
      host.connectedViewers.push({ userId: userId || username, username, avatar: avatar || "", level: level || 1, vipLevel: vipLevel || 0 });
    }
    host.viewers = host.connectedViewers.length;
    host.realViewerCount = host.connectedViewers.length;
    host.lastJoinEvent = {
      id: `join-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      username,
      userLevel: level || 1,
      vipLevel: vipLevel || 0,
      timestamp: Date.now()
    };
    saveDatabase();
    syncDocument("hosts", host.id, host);
    console.log(`[LIVE SERVER SUCCESS] User @${username} joined live room ${host.id} (total viewers: ${host.realViewerCount})`);
    res.json(host);
  } else {
    console.warn(`[LIVE SERVER WARN] Host ${id} not found for join`);
    res.status(404).json({ error: "Host not found" });
  }
});

app.post("/api/v1/hosts/:id/leave", (req, res) => {
  const { id } = req.params;
  const { username } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "Username is required to leave" });
  }
  const index = findHostIndex(id);
  if (index !== -1) {
    const host = dbData.hosts[index];
    if (host.connectedViewers) {
      host.connectedViewers = host.connectedViewers.filter((v: any) => v.username !== username);
    } else {
      host.connectedViewers = [];
    }
    host.viewers = host.connectedViewers.length;
    host.realViewerCount = host.connectedViewers.length;
    saveDatabase();
    syncDocument("hosts", host.id, host);
    console.log(`[LIVE SERVER SUCCESS] User @${username} left live room ${host.id} (remaining viewers: ${host.realViewerCount})`);
    res.json(host);
  } else {
    console.warn(`[LIVE SERVER WARN] Host ${id} not found for leave`);
    res.status(404).json({ error: "Host not found" });
  }
});

app.post("/api/v1/hosts/:id/comments", (req, res) => {
  const { id } = req.params;
  const { message, username, vipLevel, userLevel, isSystem, avatar } = req.body;
  if (!message || !username) {
    return res.status(400).json({ error: "Username and message are required" });
  }
  const index = findHostIndex(id);
  if (index !== -1) {
    const host = dbData.hosts[index];
    if (!host.comments) {
      host.comments = [];
    }
    const newComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      username,
      message,
      vipLevel: vipLevel || 0,
      userLevel: userLevel || 1,
      isSystem: !!isSystem,
      avatar: avatar || "",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    host.comments.push(newComment);
    saveDatabase();
    syncDocument("hosts", host.id, host);
    res.status(201).json(host.comments);
  } else {
    res.status(404).json({ error: "Host not found" });
  }
});

// ------------------------------------------------------------------
// REAL-TIME PRESENCE & 1V1 PK INVITE ENGINE
// ------------------------------------------------------------------
const activePkInvites: Record<string, any> = {};
const activePkSessions: Record<string, any> = {};
const onlineUserPresence: Record<string, any> = {};

// Heartbeat / Presence Registration
app.post("/api/v1/presence", (req, res) => {
  const { username, userId, avatar, level, fans, isLive, inPk } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "Username required for presence" });
  }

  const normUser = String(username).toLowerCase();
  onlineUserPresence[normUser] = {
    username,
    userId: userId || username,
    avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80",
    level: Number(level) || 1,
    fans: fans || "10K fans",
    isLive: !!isLive,
    inPk: !!inPk,
    lastSeen: Date.now()
  };

  // Clean stale presence older than 15s
  const now = Date.now();
  Object.keys(onlineUserPresence).forEach(key => {
    if (now - onlineUserPresence[key].lastSeen > 15000) {
      delete onlineUserPresence[key];
    }
  });

  res.json({ success: true, activeUsersCount: Object.keys(onlineUserPresence).length });
});

// Get Available Hosts for 1v1 Invites
app.get("/api/v1/pk/available-hosts", (req, res) => {
  const currentUsername = String(req.query.username || "").toLowerCase();
  const now = Date.now();

  // 1. Gather live hosts from dbData.hosts
  const liveHostsList = (dbData.hosts || [])
    .filter((h: any) => h.isLive !== false && !h.inPk && !h.inPkBattle)
    .map((h: any) => ({
      id: String(h.id || h.hostUid || h.hostUsername),
      userId: String(h.hostUid || h.id || h.hostUsername),
      username: String(h.hostUsername || h.name || "Live Host"),
      avatar: String(h.hostAvatar || h.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80"),
      level: Number(h.hostLevel || h.level || 1),
      fans: `${h.followersCount || h.fans || 0} fans`,
      isLive: true,
      inPk: false,
      status: "🔴 Live Solo"
    }));

  // 2. Gather online presence users
  const onlinePresenceList = Object.values(onlineUserPresence)
    .filter((u: any) => (now - u.lastSeen <= 15000) && !u.inPk)
    .map((u: any) => ({
      id: String(u.userId || u.username),
      userId: String(u.userId || u.username),
      username: String(u.username),
      avatar: String(u.avatar),
      level: Number(u.level || 1),
      fans: String(u.fans || "10K fans"),
      isLive: !!u.isLive,
      inPk: false,
      status: u.isLive ? "🔴 Live Solo" : "🟢 Online"
    }));

  // Combine and deduplicate by username (case-insensitive)
  const combinedMap = new Map<string, any>();
  
  [...liveHostsList, ...onlinePresenceList].forEach(item => {
    const key = item.username.toLowerCase();
    if (key !== currentUsername && !combinedMap.has(key)) {
      combinedMap.set(key, item);
    }
  });

  const result = Array.from(combinedMap.values());
  res.json(result);
});

// Send PK / 1v1 Invite
app.post("/api/v1/pk/invite", (req, res) => {
  const { fromUsername, fromUserId, fromAvatar, fromLevel, fromFans, toUsername, toUserId } = req.body || {};
  if (!fromUsername || !toUsername) {
    return res.status(400).json({ error: "Sender and receiver usernames are required" });
  }

  const normFrom = fromUsername.toLowerCase();
  const normTo = toUsername.toLowerCase();

  // Cancel any previous pending invite from same sender
  Object.keys(activePkInvites).forEach(id => {
    const inv = activePkInvites[id];
    if (inv.fromUsername.toLowerCase() === normFrom && inv.status === "pending") {
      inv.status = "expired";
    }
  });

  const inviteId = `pki_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const channelName = `pk_room_${[normFrom, normTo].sort().join("_")}`;

  const newInvite = {
    id: inviteId,
    fromUsername,
    fromUserId: fromUserId || fromUsername,
    fromAvatar: fromAvatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
    fromLevel: Number(fromLevel) || 1,
    fromFans: fromFans || "10K fans",
    toUsername,
    toUserId: toUserId || toUsername,
    channelName,
    status: "pending",
    createdAt: Date.now()
  };

  activePkInvites[inviteId] = newInvite;
  console.log(`[PK SERVER SUCCESS] Host @${fromUsername} invited @${toUsername} to 1v1 (Channel: ${channelName})`);

  res.status(201).json(newInvite);
});

// Query Invites & Session Status
app.get("/api/v1/pk/invites", (req, res) => {
  const username = String(req.query.username || "").toLowerCase();
  if (!username) {
    return res.status(400).json({ error: "Username parameter required" });
  }

  const now = Date.now();

  // Find pending incoming invite sent TO this user
  let incoming = null;
  // Find outgoing invite sent FROM this user
  let outgoing = null;

  Object.values(activePkInvites).forEach((inv: any) => {
    // Expire invites older than 20s
    if (inv.status === "pending" && (now - inv.createdAt > 20000)) {
      inv.status = "expired";
    }

    if (inv.toUsername.toLowerCase() === username) {
      if (inv.status === "pending") incoming = inv;
    }
    if (inv.fromUsername.toLowerCase() === username) {
      outgoing = inv;
    }
  });

  // Find active session
  const activeSession = Object.values(activePkSessions).find((s: any) => 
    s.status !== "ended" && 
    (s.hostA.username.toLowerCase() === username || s.hostB.username.toLowerCase() === username)
  ) || null;

  res.json({
    incoming,
    outgoing,
    activeSession
  });
});

// Respond to Invite (Accept or Reject)
app.post("/api/v1/pk/invite/:id/respond", (req, res) => {
  const { id } = req.params;
  const { action, username, avatar, level, fans } = req.body || {};

  const invite = activePkInvites[id];
  if (!invite) {
    return res.status(404).json({ error: "Invite not found or expired" });
  }

  if (action === "accept") {
    invite.status = "accepted";
    
    // Create active 1v1 session
    const sessionId = `session_${invite.channelName}`;
    const session = {
      id: sessionId,
      channelName: invite.channelName,
      hostA: {
        username: invite.fromUsername,
        userId: invite.fromUserId,
        avatar: invite.fromAvatar,
        level: invite.fromLevel,
        fans: invite.fromFans,
        score: 0
      },
      hostB: {
        username: username || invite.toUsername,
        userId: invite.toUserId,
        avatar: avatar || "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=100&q=80",
        level: Number(level) || 1,
        fans: fans || "15K fans",
        score: 0
      },
      status: "connected",
      timer: 270,
      startedAt: Date.now()
    };

    activePkSessions[sessionId] = session;

    // Mark both in PK in presence
    const normA = invite.fromUsername.toLowerCase();
    const normB = (username || invite.toUsername).toLowerCase();
    if (onlineUserPresence[normA]) onlineUserPresence[normA].inPk = true;
    if (onlineUserPresence[normB]) onlineUserPresence[normB].inPk = true;

    // Also update hosts array category or inPk flag
    dbData.hosts.forEach((h: any) => {
      if (h.hostUsername?.toLowerCase() === normA || h.hostUsername?.toLowerCase() === normB) {
        h.inPk = true;
        h.category = "pk";
      }
    });

    console.log(`[PK SERVER SUCCESS] @${username} ACCEPTED invite from @${invite.fromUsername}! Session started on channel: ${invite.channelName}`);
    return res.json({ success: true, status: "accepted", invite, session });
  } else {
    invite.status = "rejected";
    console.log(`[PK SERVER INFO] @${username} REJECTED invite from @${invite.fromUsername}`);
    return res.json({ success: true, status: "rejected", invite });
  }
});

// End 1v1 / PK Session
app.post("/api/v1/pk/end", (req, res) => {
  const { channelName, username } = req.body || {};
  
  Object.values(activePkSessions).forEach((s: any) => {
    if (s.channelName === channelName || (username && (s.hostA.username.toLowerCase() === username.toLowerCase() || s.hostB.username.toLowerCase() === username.toLowerCase()))) {
      s.status = "ended";
      const normA = s.hostA.username.toLowerCase();
      const normB = s.hostB.username.toLowerCase();
      if (onlineUserPresence[normA]) onlineUserPresence[normA].inPk = false;
      if (onlineUserPresence[normB]) onlineUserPresence[normB].inPk = false;
      dbData.hosts.forEach((h: any) => {
        if (h.hostUsername?.toLowerCase() === normA || h.hostUsername?.toLowerCase() === normB) {
          h.inPk = false;
          h.category = "solo";
        }
      });
    }
  });

  res.json({ success: true, message: "1v1 session ended" });
});

// Party Hub & 12-Seat Audio Party endpoints
app.get("/api/v1/parties", (req, res) => {
  const activeParties = (dbData.parties || []).filter((p: any) => p.status !== "ended");
  res.json(activeParties);
});

app.post("/api/v1/parties", (req, res) => {
  const { title, hostUsername, hostAvatar, category, isPublic, password, language, description } = req.body;
  
  if (!dbData.parties) {
    dbData.parties = [];
  }

  // Check if an active party already exists for this host
  const existingIdx = dbData.parties.findIndex((p: any) => p.hostUsername === hostUsername && p.status !== "ended");
  
  const id = existingIdx !== -1 ? dbData.parties[existingIdx].id : `party-${Date.now()}`;
  const newParty = {
    id,
    title: title || "Sehr Live Audio Lounge",
    hostUsername: hostUsername || "Host",
    hostAvatar: hostAvatar || "",
    category: category || "Music",
    participantCount: 1,
    maxCapacity: 12,
    isPublic: isPublic !== false,
    password: password || "",
    language: language || "English",
    description: description || "",
    status: "active",
    connectedViewers: [{ userId: hostUsername, username: hostUsername, avatar: hostAvatar || "", level: 1, vipLevel: 0 }],
    seats: existingIdx !== -1 ? dbData.parties[existingIdx].seats : [
      { id: 1, name: hostUsername, avatar: hostAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80", isMuted: false, isLocked: false },
      { id: 2, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 3, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 4, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 5, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 6, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 7, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 8, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 9, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 10, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 11, name: null, avatar: null, isMuted: false, isLocked: false },
      { id: 12, name: null, avatar: null, isMuted: false, isLocked: false }
    ],
    comments: [
      {
        id: `sys-${Date.now()}`,
        username: "System",
        message: `🎙️ Room created successfully by ${hostUsername}. Welcome everyone!`,
        isSystem: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]
  };

  if (existingIdx !== -1) {
    dbData.parties[existingIdx] = { ...dbData.parties[existingIdx], ...newParty, status: "active" };
    saveDatabase();
    syncDocument("parties", id, dbData.parties[existingIdx]);
    console.log(`[SEHR-LIVE PARTY] Updated existing party room: ${id} by @${hostUsername}`);
    return res.status(200).json(dbData.parties[existingIdx]);
  } else {
    dbData.parties.push(newParty);
    saveDatabase();
    syncDocument("parties", id, newParty);
    console.log(`[SEHR-LIVE PARTY] Created new party room: ${id} by @${hostUsername}`);
    return res.status(201).json(newParty);
  }
});

app.post("/api/v1/parties/:id/join", (req, res) => {
  const { id } = req.params;
  const { username, avatar } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    if (!party.connectedViewers) {
      party.connectedViewers = [];
    }
    if (!party.connectedViewers.some((v: any) => v.username === username)) {
      party.connectedViewers.push({ userId: username, username, avatar: avatar || "", level: 1, vipLevel: 0 });
    }
    party.participantCount = party.connectedViewers.length;
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/leave", (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    if (party.connectedViewers) {
      party.connectedViewers = party.connectedViewers.filter((v: any) => v.username !== username);
    }
    party.participantCount = party.connectedViewers ? party.connectedViewers.length : 0;
    
    // Clean up from seats immediately
    party.seats = party.seats.map((seat: any) => {
      if (seat.name === username || (seat.name && seat.name.startsWith(username))) {
        return { ...seat, name: null, avatar: null, isMuted: false };
      }
      return seat;
    });

    if (party.lastSeen && username) {
      delete party.lastSeen[username];
    }

    // If host leaves or no users remain, close the party room
    if (username === party.hostUsername || party.participantCount === 0) {
      party.status = "ended";
      dbData.parties = dbData.parties.filter((p: any) => p.id !== id);
      saveDatabase();
      deleteDocument("parties", id);
      console.log(`[SEHR-LIVE PARTY] Host/all left. Closed party room: ${id}`);
      return res.json({ message: "Party closed as host left", party });
    }

    console.log(`[SEHR-LIVE PARTY] User ${username} left party ${id}. Seats cleared immediately.`);
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

// Party Room User Heartbeat to prevent stale/ghost seats
app.post("/api/v1/parties/:id/heartbeat", (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "username is required" });
  
  const party = dbData.parties?.find((p: any) => p.id === id);
  if (party) {
    if (!party.lastSeen) party.lastSeen = {};
    party.lastSeen[username] = Date.now();
    res.json({ status: "ok" });
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/seats/join", (req, res) => {
  const { id } = req.params;
  const { seatId, username, avatar } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    party.seats = party.seats.map((seat: any) => {
      if (seat.id === Number(seatId)) {
        return { ...seat, name: username, avatar: avatar || "" };
      }
      return seat;
    });
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/seats/leave", (req, res) => {
  const { id } = req.params;
  const { seatId } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    party.seats = party.seats.map((seat: any) => {
      if (seat.id === Number(seatId)) {
        return { ...seat, name: null, avatar: null };
      }
      return seat;
    });
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/seats/toggle-mute", (req, res) => {
  const { id } = req.params;
  const { seatId } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    party.seats = party.seats.map((seat: any) => {
      if (seat.id === Number(seatId)) {
        return { ...seat, isMuted: !seat.isMuted };
      }
      return seat;
    });
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/seats/toggle-lock", (req, res) => {
  const { id } = req.params;
  const { seatId } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    party.seats = party.seats.map((seat: any) => {
      if (seat.id === Number(seatId)) {
        return { ...seat, isLocked: !seat.isLocked };
      }
      return seat;
    });
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/close", (req, res) => {
  const { id } = req.params;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    party.status = "ended";
    dbData.parties = dbData.parties.filter((p: any) => p.id !== id);
    saveDatabase();
    deleteDocument("parties", id);
    res.json({ message: "Party closed successfully" });
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/comments", (req, res) => {
  const { id } = req.params;
  const { message, username, vipLevel, userLevel, isSystem, avatar } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    if (!party.comments) party.comments = [];
    const newComment = {
      id: `c-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      username,
      message,
      vipLevel: vipLevel || 0,
      userLevel: userLevel || 1,
      isSystem: !!isSystem,
      avatar: avatar || "",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    party.comments.push(newComment);
    saveDatabase();
    syncDocument("parties", id, party);
    res.status(201).json(party.comments);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

// Party Seating Requests and Invitations / Host Controls
app.post("/api/v1/parties/:id/requests", (req, res) => {
  const { id } = req.params;
  const { username, avatar, seatId } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    if (!party.requests) party.requests = [];
    party.requests = party.requests.filter((r: any) => r.username !== username);
    party.requests.push({ username, avatar, seatId: Number(seatId), timestamp: Date.now() });
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/requests/:username/approve", (req, res) => {
  const { id, username } = req.params;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    const request = party.requests?.find((r: any) => r.username === username);
    if (request) {
      const targetSeatId = request.seatId;
      // Clean up user from other seats
      party.seats = party.seats.map((seat: any) => {
        if (seat.name === username || (seat.name && seat.name.startsWith(username))) {
          return { ...seat, name: null, avatar: null };
        }
        return seat;
      });
      // Occupy seat
      party.seats = party.seats.map((seat: any) => {
        if (seat.id === targetSeatId) {
          return { ...seat, name: username, avatar: request.avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80" };
        }
        return seat;
      });
      // Remove from requests
      party.requests = party.requests.filter((r: any) => r.username !== username);
      // Add system comment
      if (!party.comments) party.comments = [];
      party.comments.push({
        id: `sys-${Date.now()}`,
        username: "System",
        message: `✅ ${username} has taken Seat ${targetSeatId}!`,
        isSystem: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      saveDatabase();
      syncDocument("parties", id, party);
      res.json(party);
    } else {
      res.status(400).json({ error: "Request not found" });
    }
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/requests/:username/reject", (req, res) => {
  const { id, username } = req.params;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    if (party.requests) {
      party.requests = party.requests.filter((r: any) => r.username !== username);
    }
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/invites", (req, res) => {
  const { id } = req.params;
  const { targetUsername, seatId } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    if (!party.invites) party.invites = [];
    party.invites = party.invites.filter((i: any) => i.username !== targetUsername);
    party.invites.push({ username: targetUsername, seatId: Number(seatId), timestamp: Date.now() });
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/invites/:username/accept", (req, res) => {
  const { id, username } = req.params;
  const { avatar } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    const invite = party.invites?.find((i: any) => i.username === username);
    if (invite) {
      const targetSeatId = invite.seatId;
      // Clean up user from any other seats
      party.seats = party.seats.map((seat: any) => {
        if (seat.name === username || (seat.name && seat.name.startsWith(username))) {
          return { ...seat, name: null, avatar: null };
        }
        return seat;
      });
      // Put user in seat
      party.seats = party.seats.map((seat: any) => {
        if (seat.id === targetSeatId) {
          return { ...seat, name: username, avatar: avatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80" };
        }
        return seat;
      });
      // Remove invite
      party.invites = party.invites.filter((i: any) => i.username !== username);
      // Add system comment
      if (!party.comments) party.comments = [];
      party.comments.push({
        id: `sys-${Date.now()}`,
        username: "System",
        message: `🎙️ ${username} accepted host's invite to take Seat ${targetSeatId}!`,
        isSystem: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      saveDatabase();
      syncDocument("parties", id, party);
      res.json(party);
    } else {
      res.status(400).json({ error: "Invitation not found" });
    }
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/invites/:username/reject", (req, res) => {
  const { id, username } = req.params;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    if (party.invites) {
      party.invites = party.invites.filter((i: any) => i.username !== username);
    }
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/seats/kick-user", (req, res) => {
  const { id } = req.params;
  const { seatId } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    let kickedUser = "";
    party.seats = party.seats.map((seat: any) => {
      if (seat.id === Number(seatId)) {
        kickedUser = seat.name || "User";
        return { ...seat, name: null, avatar: null, isMuted: false };
      }
      return seat;
    });
    if (kickedUser) {
      if (!party.comments) party.comments = [];
      party.comments.push({
        id: `sys-${Date.now()}`,
        username: "System",
        message: `⚠️ Host has removed ${kickedUser} from Seat ${seatId}.`,
        isSystem: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/seats/mute-user", (req, res) => {
  const { id } = req.params;
  const { seatId, isMuted } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    let targetUser = "";
    party.seats = party.seats.map((seat: any) => {
      if (seat.id === Number(seatId)) {
        targetUser = seat.name || "User";
        return { ...seat, isMuted: isMuted !== false };
      }
      return seat;
    });
    if (targetUser) {
      if (!party.comments) party.comments = [];
      party.comments.push({
        id: `sys-${Date.now()}`,
        username: "System",
        message: `🎙️ Host has ${isMuted ? 'Muted' : 'Unmuted'} ${targetUser} on Seat ${seatId}.`,
        isSystem: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
});

app.post("/api/v1/parties/:id/block-user", (req, res) => {
  const { id } = req.params;
  const { username } = req.body;
  const index = dbData.parties?.findIndex((p: any) => p.id === id);
  if (index !== -1 && index !== undefined) {
    const party = dbData.parties[index];
    if (!party.blockedUsers) party.blockedUsers = [];
    if (!party.blockedUsers.includes(username)) {
      party.blockedUsers.push(username);
    }
    // Kick them from seats if they are on one
    party.seats = party.seats.map((seat: any) => {
      if (seat.name === username || (seat.name && seat.name.startsWith(username))) {
        return { ...seat, name: null, avatar: null };
      }
      return seat;
    });
    // Remove them from connected viewers
    if (party.connectedViewers) {
      party.connectedViewers = party.connectedViewers.filter((v: any) => v.username !== username);
    }
    party.participantCount = party.connectedViewers ? party.connectedViewers.length : 0;
    
    if (!party.comments) party.comments = [];
    party.comments.push({
      id: `sys-${Date.now()}`,
      username: "System",
      message: `🚫 Host has blocked ${username} from this room.`,
      isSystem: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    saveDatabase();
    syncDocument("parties", id, party);
    res.json(party);
  } else {
    res.status(404).json({ error: "Party Room not found" });
  }
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
  syncDocument("families", newFamily.id, newFamily);
  res.status(201).json(newFamily);
});

app.put("/api/v1/families/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.families.findIndex((f: any) => f.id === id);
  if (index !== -1) {
    dbData.families[index] = { ...dbData.families[index], ...req.body };
    saveDatabase();
    syncDocument("families", id, dbData.families[index]);
    res.json(dbData.families[index]);
  } else {
    res.status(404).json({ error: "Family not found" });
  }
});

app.delete("/api/v1/families/:id", (req, res) => {
  const { id } = req.params;
  dbData.families = dbData.families.filter((f: any) => f.id !== id);
  saveDatabase();
  deleteDocument("families", id);
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
  syncDocument("agencies", newAgency.id, newAgency);
  res.status(201).json(newAgency);
});

app.put("/api/v1/agencies/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.agencies.findIndex((a: any) => a.id === id);
  if (index !== -1) {
    dbData.agencies[index] = { ...dbData.agencies[index], ...req.body };
    saveDatabase();
    syncDocument("agencies", id, dbData.agencies[index]);
    res.json(dbData.agencies[index]);
  } else {
    res.status(404).json({ error: "Agency not found" });
  }
});

app.delete("/api/v1/agencies/:id", (req, res) => {
  const { id } = req.params;
  dbData.agencies = dbData.agencies.filter((a: any) => a.id !== id);
  saveDatabase();
  deleteDocument("agencies", id);
  res.json({ message: "Agency deleted successfully" });
});

// Coin Sellers list (Approved Resellers)
app.get("/api/v1/coin-sellers", (req, res) => {
  res.json(dbData.coinSellers || []);
});

app.post("/api/v1/coin-sellers", (req, res) => {
  const newSeller = {
    id: `seller-${Date.now()}`,
    status: "Verified Seller",
    ...req.body
  };
  if (!dbData.coinSellers) dbData.coinSellers = [];
  dbData.coinSellers.push(newSeller);
  saveDatabase();
  syncDocument("coinSellers", newSeller.id, newSeller);
  res.status(201).json(newSeller);
});

app.delete("/api/v1/coin-sellers/:id", (req, res) => {
  const { id } = req.params;
  if (!dbData.coinSellers) dbData.coinSellers = [];
  dbData.coinSellers = dbData.coinSellers.filter((s: any) => s.id !== id);
  saveDatabase();
  deleteDocument("coinSellers", id);
  res.json({ message: "Reseller deleted successfully" });
});

// Agency Requests Endpoints
app.get("/api/v1/agency-requests", (req, res) => {
  res.json(dbData.agencyRequests || []);
});

app.post("/api/v1/agency-requests", (req, res) => {
  const newReq = {
    id: `ARQ-${Date.now()}`,
    status: "Pending",
    timestamp: new Date().toISOString(),
    ...req.body
  };
  if (!dbData.agencyRequests) dbData.agencyRequests = [];
  dbData.agencyRequests.unshift(newReq);
  
  // Create system notification for Admin
  const adminNotification = {
    id: Date.now(),
    title: "New Agency Request Submitted",
    message: `${newReq.applicantName} requested to register ${newReq.type === "official_agency" ? "Official Reseller" : "Host Agency"}.`,
    timestamp: new Date().toISOString(),
    unread: true,
    category: "system"
  };
  if (!dbData.notifications) dbData.notifications = [];
  dbData.notifications.unshift(adminNotification);
  
  saveDatabase();
  syncDocument("agencyRequests", newReq.id, newReq);
  syncDocument("notifications", String(adminNotification.id), adminNotification);
  
  res.status(201).json(newReq);
});

app.put("/api/v1/agency-requests/:id", (req, res) => {
  const { id } = req.params;
  const { status, remarks } = req.body;
  if (!dbData.agencyRequests) dbData.agencyRequests = [];
  const index = dbData.agencyRequests.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    const r = dbData.agencyRequests[index];
    r.status = status;
    if (remarks) r.remarks = remarks;
    
    // If approved, create official agency or add to offline resellers as required!
    if (status === "Approved") {
      const agencyId = `agency-${Math.floor(1000 + Math.random() * 9000)}`;
      
      if (r.type === "host_agency") {
        const newAgency = {
          id: agencyId,
          name: r.agencyName || r.applicantName,
          ownerEmail: r.ownerEmail || `${r.applicantUsername || "applicant"}@sehr.live`,
          salaryRate: r.rate || "40% Commission + $200 Base Bonus",
          registeredHosts: 0,
          monthlyCommission: 0,
          status: "Active"
        };
        dbData.agencies.push(newAgency);
        syncDocument("agencies", agencyId, newAgency);
        
        // Also update applicant's user profile agency ID
        if (r.applicantUsername) {
          const userIndex = dbData.users.findIndex((u: any) => u.username === r.applicantUsername);
          if (userIndex !== -1) {
            dbData.users[userIndex].agencyId = agencyId;
            syncDocument("users", r.applicantUsername, dbData.users[userIndex]);
          }
          if (r.applicantUsername === dbData.user.username) {
            dbData.user.agencyId = agencyId;
            writeMetadata("user_profile", dbData.user);
          }
        }
      } else if (r.type === "official_agency") {
        const reseller = {
          id: agencyId,
          name: r.applicantName,
          whatsapp: r.contact,
          city: r.city || "Pakistan",
          rate: r.rate || "1000 Coins = 1500 PKR",
          status: "Verified Seller",
          description: r.description || "Official Coin Reseller licensed by Sahr Live Admin."
        };
        if (!dbData.coinSellers) dbData.coinSellers = [];
        dbData.coinSellers.push(reseller);
        syncDocument("coinSellers", agencyId, reseller);
      }
    }
    
    saveDatabase();
    syncDocument("agencyRequests", id, r);
    res.json(r);
  } else {
    res.status(404).json({ error: "Agency request not found" });
  }
});

app.delete("/api/v1/agency-requests/:id", (req, res) => {
  const { id } = req.params;
  if (!dbData.agencyRequests) dbData.agencyRequests = [];
  dbData.agencyRequests = dbData.agencyRequests.filter((r: any) => r.id !== id);
  saveDatabase();
  deleteDocument("agencyRequests", id);
  res.json({ message: "Agency request deleted" });
});

// Coin Purchase Requests (Offline) Endpoints
app.get("/api/v1/purchase-requests", (req, res) => {
  res.json(dbData.purchaseRequests || []);
});

app.post("/api/v1/purchase-requests", (req, res) => {
  const newReq = {
    id: `PRQ-${Date.now()}`,
    status: "Pending",
    timestamp: new Date().toISOString(),
    ...req.body
  };
  if (!dbData.purchaseRequests) dbData.purchaseRequests = [];
  dbData.purchaseRequests.unshift(newReq);
  
  // Create system notification for Admin
  const adminNotification = {
    id: Date.now(),
    title: "New Coin Purchase Request",
    message: `${newReq.username} requested to purchase ${newReq.coins} Coins offline.`,
    timestamp: new Date().toISOString(),
    unread: true,
    category: "system"
  };
  if (!dbData.notifications) dbData.notifications = [];
  dbData.notifications.unshift(adminNotification);
  
  saveDatabase();
  syncDocument("purchaseRequests", newReq.id, newReq);
  syncDocument("notifications", String(adminNotification.id), adminNotification);
  
  res.status(201).json(newReq);
});

app.put("/api/v1/purchase-requests/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Approved or Rejected
  if (!dbData.purchaseRequests) dbData.purchaseRequests = [];
  const index = dbData.purchaseRequests.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    const r = dbData.purchaseRequests[index];
    r.status = status;
    
    if (status === "Approved") {
      // Credit coins to user's wallet automatically
      const username = r.username;
      const coinsAmount = Number(r.coins || 0);
      
      const userIndex = dbData.users.findIndex((u: any) => u.username === username);
      if (userIndex !== -1) {
        dbData.users[userIndex].coins = (dbData.users[userIndex].coins || 0) + coinsAmount;
        syncDocument("users", username, dbData.users[userIndex]);
      }
      
      if (username === dbData.user.username) {
        dbData.user.coins = (dbData.user.coins || 0) + coinsAmount;
        writeMetadata("user_profile", dbData.user);
      }
      
      // Update in admin-users list
      const adminUserIndex = dbData.adminUsersList.findIndex((u: any) => u.username === username);
      if (adminUserIndex !== -1) {
        dbData.adminUsersList[adminUserIndex].coins = (dbData.adminUsersList[adminUserIndex].coins || 0) + coinsAmount;
        syncDocument("adminUsersList", username, dbData.adminUsersList[adminUserIndex]);
      }
      
      // Add transaction to ledger/history
      const newTxn = {
        id: `TXN-${Math.floor(100 + Math.random() * 900)}`,
        timestamp: new Date().toISOString(),
        status: "Completed",
        type: "recharge",
        details: `Purchased ${coinsAmount} Coins offline (Approved by Admin)`,
        amount: coinsAmount,
        currency: "coins",
        username: username
      };
      if (!dbData.transactions) dbData.transactions = [];
      dbData.transactions.unshift(newTxn);
      syncDocument("transactions", newTxn.id, newTxn);
    }
    
    saveDatabase();
    syncDocument("purchaseRequests", id, r);
    res.json(r);
  } else {
    res.status(404).json({ error: "Purchase request not found" });
  }
});

app.delete("/api/v1/purchase-requests/:id", (req, res) => {
  const { id } = req.params;
  if (!dbData.purchaseRequests) dbData.purchaseRequests = [];
  dbData.purchaseRequests = dbData.purchaseRequests.filter((r: any) => r.id !== id);
  saveDatabase();
  deleteDocument("purchaseRequests", id);
  res.json({ message: "Purchase request deleted" });
});

// Transactions ledger
app.get("/api/v1/transactions", (req, res) => {
  res.json(dbData.transactions);
});

app.post("/api/v1/transactions", (req, res) => {
  const newTxn = { id: `TXN-${Math.floor(100 + Math.random() * 900)}`, timestamp: new Date().toISOString(), status: "Completed", ...req.body };
  dbData.transactions.unshift(newTxn);
  saveDatabase();
  syncDocument("transactions", newTxn.id, newTxn);
  res.status(201).json(newTxn);
});

// Notifications inbox dispatcher with auto-cleanup (24 hours expiry)
async function cleanupExpiredNotifications() {
  try {
    const now = Date.now();
    const expiryLimit = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const activeNotifs: any[] = [];
    const expiredNotifs: any[] = [];

    const notifsList = dbData.notifications || [];
    for (const item of notifsList) {
      const ts = item.timestamp ? new Date(item.timestamp).getTime() : (item.id && typeof item.id === 'number' ? item.id : now);
      if (now - ts > expiryLimit) {
        expiredNotifs.push(item);
      } else {
        activeNotifs.push(item);
      }
    }

    if (expiredNotifs.length > 0) {
      console.log(`[SEHR-LIVE NOTIFICATION CLEANER] Automatically cleaning up ${expiredNotifs.length} expired notifications.`);
      dbData.notifications = activeNotifs;
      saveDatabase();
      for (const expired of expiredNotifs) {
        if (expired.id) {
          await deleteDocument("notifications", String(expired.id));
        }
      }
    }
  } catch (err) {
    console.error("[SEHR-LIVE NOTIFICATION CLEANER] Error during clean-up:", err);
  }
}

// Periodically run cleanup every 10 minutes
setInterval(() => {
  cleanupExpiredNotifications();
}, 10 * 60 * 1000);

app.get("/api/v1/notifications", async (req, res) => {
  await cleanupExpiredNotifications();
  res.json(dbData.notifications || []);
});

app.post("/api/v1/notifications", async (req, res) => {
  const notifId = Date.now();
  const newNotif = {
    id: notifId,
    isNew: true,
    time: "Just Now",
    timestamp: new Date().toISOString(),
    ...req.body
  };
  if (!dbData.notifications) {
    dbData.notifications = [];
  }
  dbData.notifications.unshift(newNotif);
  saveDatabase();
  await syncDocument("notifications", String(newNotif.id), newNotif);
  res.status(201).json(newNotif);
});

app.post("/api/v1/notifications/read-all", async (req, res) => {
  try {
    const notifs = dbData.notifications || [];
    for (const item of notifs) {
      if (item.isNew) {
        item.isNew = false;
        await syncDocument("notifications", String(item.id), item);
      }
    }
    saveDatabase();
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all as read:", error);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

app.post("/api/v1/notifications/clear", async (req, res) => {
  try {
    const notifs = [...(dbData.notifications || [])];
    dbData.notifications = [];
    saveDatabase();
    for (const item of notifs) {
      if (item.id) {
        await deleteDocument("notifications", String(item.id));
      }
    }
    res.json({ success: true, message: "All notifications cleared" });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    res.status(500).json({ error: "Failed to clear notifications" });
  }
});

// Reports management
app.get("/api/v1/reports", (req, res) => {
  res.json(dbData.reports);
});

app.post("/api/v1/reports", (req, res) => {
  const newReport = { id: `REP-${Math.floor(100 + Math.random() * 900)}`, status: "pending", timestamp: new Date().toISOString(), ...req.body };
  dbData.reports.unshift(newReport);
  saveDatabase();
  syncDocument("reports", newReport.id, newReport);
  res.status(201).json(newReport);
});

// Reels endpoints
app.get("/api/v1/reels", (req, res) => {
  res.json(dbData.reels || []);
});

app.post("/api/v1/reels", (req, res) => {
  const newReel = {
    id: `r-${Date.now()}`,
    likes: 0,
    commentsCount: 0,
    liked: false,
    saves: 0,
    saved: false,
    shares: 0,
    downloads: 0,
    comments: [],
    ...req.body
  };
  if (!dbData.reels) dbData.reels = [];
  dbData.reels.unshift(newReel);
  saveDatabase();
  syncDocument("reels", newReel.id, newReel);
  res.status(201).json(newReel);
});

app.put("/api/v1/reels/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.reels.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    dbData.reels[index] = { ...dbData.reels[index], ...req.body };
    saveDatabase();
    syncDocument("reels", id, dbData.reels[index]);
    res.json(dbData.reels[index]);
  } else {
    res.status(404).json({ error: "Reel not found" });
  }
});

// Stories endpoints
app.get("/api/v1/stories", (req, res) => {
  res.json(dbData.stories || []);
});

app.post("/api/v1/stories", (req, res) => {
  const newStory = {
    id: `story-${Date.now()}`,
    likes: 0,
    liked: false,
    replies: [],
    ...req.body
  };
  if (!dbData.stories) dbData.stories = [];
  dbData.stories.unshift(newStory);
  saveDatabase();
  syncDocument("stories", newStory.id, newStory);
  res.status(201).json(newStory);
});

app.put("/api/v1/stories/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.stories.findIndex((s: any) => s.id === id);
  if (index !== -1) {
    dbData.stories[index] = { ...dbData.stories[index], ...req.body };
    saveDatabase();
    syncDocument("stories", id, dbData.stories[index]);
    res.json(dbData.stories[index]);
  } else {
    res.status(404).json({ error: "Story not found" });
  }
});

// Chats / Direct messages endpoints
app.get("/api/v1/chats", (req, res) => {
  res.json(dbData.chats || []);
});

app.post("/api/v1/chats", (req, res) => {
  const newMsg = {
    id: `msg-${Date.now()}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    ...req.body
  };
  if (!dbData.chats) dbData.chats = [];
  dbData.chats.push(newMsg);
  saveDatabase();
  syncDocument("chats", newMsg.id, newMsg);
  res.status(201).json(newMsg);
});

app.post("/api/v1/reels/sync", (req, res) => {
  dbData.reels = req.body;
  saveDatabase();
  if (Array.isArray(req.body)) {
    req.body.forEach((r: any) => {
      if (r.id) syncDocument("reels", r.id, r);
    });
  }
  res.json({ success: true });
});

app.post("/api/v1/stories/sync", (req, res) => {
  dbData.stories = req.body;
  saveDatabase();
  if (Array.isArray(req.body)) {
    req.body.forEach((s: any) => {
      if (s.id) syncDocument("stories", s.id, s);
    });
  }
  res.json({ success: true });
});

app.post("/api/v1/chats/sync", (req, res) => {
  dbData.chats = req.body;
  saveDatabase();
  if (Array.isArray(req.body)) {
    req.body.forEach((c: any) => {
      if (c.id) syncDocument("chats", c.id, c);
    });
  }
  res.json({ success: true });
});

app.delete("/api/v1/chats", (req, res) => {
  dbData.chats = [];
  saveDatabase();
  res.json({ success: true, message: "Chats cleared" });
});

app.put("/api/v1/reports/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.reports.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    dbData.reports[index] = { ...dbData.reports[index], ...req.body };
    saveDatabase();
    syncDocument("reports", id, dbData.reports[index]);
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
  syncDocument("kycRequests", newKyc.id, newKyc);
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

    // Sync updates to Firestore
    syncDocument("kycRequests", id, dbData.kycRequests[index]);
    writeMetadata("user_profile", dbData.user);
    if (usrIdx !== -1) {
      syncDocument("adminUsersList", dbData.kycRequests[index].username, dbData.adminUsersList[usrIdx]);
    }

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

    // Sync admin users and profile changes to Firestore
    syncDocument("adminUsersList", username, dbData.adminUsersList[index]);
    if (username === dbData.user.username) {
      writeMetadata("user_profile", dbData.user);
    }

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
  syncDocument("events", newEvt.id, newEvt);
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
// CLOUDFLARE R2 STORAGE CONFIGURATION & VIDEO UPLOAD
// ------------------------------------------------------------------
let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      console.warn("[SEHR-LIVE R2] Missing environment credentials! Falling back to local storage for video uploads.");
      throw new Error("Missing Cloudflare R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT). Set them on Railway!");
    }

    console.log("[SEHR-LIVE R2] Initializing Cloudflare R2 S3 Client with endpoint:", endpoint);
    s3ClientInstance = new S3Client({
      region: "auto",
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      }
    });
  }
  return s3ClientInstance;
}

const s3MulterUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB Limit for high-definition video reels
  }
});

// Production video upload endpoint to Cloudflare R2
app.post("/api/v1/reels/upload-video", s3MulterUpload.single("video"), async (req, res) => {
  console.log("[SEHR-LIVE R2] [UPLOAD-VIDEO] ====== UPLOAD TRANSACTION STARTED ======");

  try {
    const file = req.file;
    if (!file) {
      console.error("[SEHR-LIVE R2] [UPLOAD-VIDEO] FAILED: No file chunk found in multipart request data");
      return res.status(400).json({ success: false, error: "No video file uploaded" });
    }

    const userId = req.body.userId || "anonymous";
    const fileName = file.originalname || "unnamed_reel.mp4";
    const fileSize = file.size;
    let mimeType = file.mimetype || "video/mp4";

    // Enforce valid video content type for streaming support
    if (mimeType === "application/octet-stream" || !mimeType.includes("video/")) {
      mimeType = "video/mp4";
    }

    console.log(`[SEHR-LIVE R2] [UPLOAD-VIDEO] METADATA RECEIVED:
      - File Name: "${fileName}"
      - Received Size: ${fileSize} bytes (${(fileSize / (1024 * 1024)).toFixed(2)} MB)
      - Detected MIME: "${mimeType}"
      - Uploader User ID: "${userId}"`);

    if (fileSize <= 0) {
      console.error("[SEHR-LIVE R2] [UPLOAD-VIDEO] FAILED: Received file size is 0 bytes");
      return res.status(400).json({ success: false, error: "Uploaded video file is empty (0 bytes)" });
    }

    // Generate production-safe unique object key: reels/{userId}/{timestamp}-{uniqueId}.mp4
    const uniqueId = Math.random().toString(36).substring(2, 10);
    const timestamp = Date.now();
    const ext = path.extname(fileName) || ".mp4";
    const objectKey = `reels/${userId}/${timestamp}-${uniqueId}${ext}`;

    console.log(`[SEHR-LIVE R2] [UPLOAD-VIDEO] PREPARING UPLOAD:
      - R2 Object Key: "${objectKey}"
      - Target Bucket: "sehrlive-reels"`);

    let finalVideoUrl = "";
    
    try {
      const client = getS3Client();
      const bucketName = process.env.R2_BUCKET_NAME || "sehrlive-reels";

      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
        Body: file.buffer,
        ContentType: mimeType,
      });

      console.log(`[SEHR-LIVE R2] [UPLOAD-VIDEO] Transmitting binary buffer to Cloudflare R2 S3 API...`);
      await client.send(putCommand);
      console.log(`[SEHR-LIVE R2] [UPLOAD-VIDEO] SUCCESS: Binary written to R2 storage bucket "${bucketName}"`);

      // Generate public CDN Delivery Domain URL
      const publicBaseUrl = process.env.R2_PUBLIC_URL || "https://media.sehrlive.soulverseapps.com";
      const cleanBase = publicBaseUrl.endsWith("/") ? publicBaseUrl.slice(0, -1) : publicBaseUrl;
      finalVideoUrl = `${cleanBase}/${objectKey}`;

      console.log(`[SEHR-LIVE R2] [UPLOAD-VIDEO] PUBLIC CDN DISTRIBUTION LINK GENERATED: "${finalVideoUrl}"`);
    } catch (r2Error: any) {
      console.error("[SEHR-LIVE R2] [UPLOAD-VIDEO] FATAL ERROR: Cloudflare R2 Upload failed!", r2Error);
      
      // Strict Mode: Do not fall back to local storage and do not publish a broken Reel!
      return res.status(500).json({
        success: false,
        error: `Cloudflare R2 Storage Upload Failed: ${r2Error.message || r2Error}`
      });
    }

    console.log(`[SEHR-LIVE R2] [UPLOAD-VIDEO] ====== UPLOAD TRANSACTION COMPLETED SUCCESSFULLY ======\n`);
    return res.json({
      success: true,
      url: finalVideoUrl,
      key: objectKey,
      objectKey: objectKey,
      publicUrl: finalVideoUrl,
      mediaUrl: finalVideoUrl,
      size: fileSize,
      mimeType: mimeType
    });

  } catch (error: any) {
    console.error("[SEHR-LIVE R2] [UPLOAD-VIDEO] FATAL UNHANDLED TRANSACTION ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred during video upload handling"
    });
  }
});

// ------------------------------------------------------------------
// RANGE-REQUEST VIDEO STREAMER (FOR ANDROID MEDIA PLAYER RANGE COMPATIBILITY)
// ------------------------------------------------------------------
app.get("/uploads/:filename", (req, res) => {
  const filePath = path.join(process.cwd(), "public", "uploads", req.params.filename);
  if (!fs.existsSync(filePath)) {
    console.error(`[SEHR-LIVE STREAMER] Local file not found: ${filePath}`);
    return res.status(404).send("File not found");
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  console.log(`[SEHR-LIVE STREAMER] Serving local file "${req.params.filename}" (Size: ${fileSize} bytes). Requested Range: "${range || "None"}"`);

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
      return;
    }

    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// ------------------------------------------------------------------
// FIREBASE STORAGE & CLOUD MESSAGING ENDPOINTS (LOCAL & MOCK FALLBACKS)
// ------------------------------------------------------------------
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));

app.post("/api/v1/storage/upload", async (req, res) => {
  try {
    const { fileBase64, fileName, contentType } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: "Missing fileBase64 parameter" });
    }

    const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, "").replace(/^data:video\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const cleanFileName = `${Date.now()}_${fileName || "asset.jpg"}`;
    const localFilePath = path.join(uploadsDir, cleanFileName);
    fs.writeFileSync(localFilePath, buffer);

    const publicUrl = `/uploads/${cleanFileName}`;
    console.log(`[SEHR-LIVE LOCAL STORAGE] Successfully uploaded local asset: ${publicUrl}`);
    
    res.json({
      success: true,
      url: publicUrl,
      fileName: cleanFileName
    });
  } catch (error: any) {
    console.error("[SEHR-LIVE STORAGE] Local fallback upload error:", error);
    res.json({
      success: true,
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      fileName: "fallback.jpg"
    });
  }
});

app.post("/api/v1/fcm/send", async (req, res) => {
  try {
    const { token, title, body, data } = req.body;
    if (!token) {
      return res.status(400).json({ error: "Missing recipient FCM token" });
    }

    console.log(`[SEHR-LIVE FCM MOCK] Dispatched notification: ${title} - ${body} to ${token}`);
    res.json({
      success: true,
      messageId: `mock-msg-${Date.now()}`
    });
  } catch (error: any) {
    console.error("[SEHR-LIVE FCM MOCK] Dispatch error:", error);
    res.status(500).json({ error: error.message });
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

// Periodic background cleaner for ghost users in party room seats
setInterval(() => {
  if (!dbData.parties || !Array.isArray(dbData.parties)) return;
  const now = Date.now();
  let changed = false;

  dbData.parties.forEach((party: any) => {
    if (!party.seats || party.status === "ended") return;
    const lastSeen = party.lastSeen || {};

    party.seats.forEach((seat: any) => {
      if (seat.name) {
        const username = seat.name;
        const lastTs = lastSeen[username];
        
        // If seat occupant hasn't sent a heartbeat for more than 12 seconds
        if (lastTs && (now - lastTs > 12000)) {
          console.log(`[SEHR-LIVE AUTO-PRUNE] Seat occupant ${username} on Seat ${seat.id} in party ${party.id} timed out. Clearing seat.`);
          seat.name = null;
          seat.avatar = null;
          seat.isMuted = false;
          delete lastSeen[username];
          changed = true;
        }
      }
    });
  });

  if (changed) {
    saveDatabase();
  }
}, 5000);

startServer();
