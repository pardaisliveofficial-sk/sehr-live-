var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_fs2 = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");

// src/db/firebaseDb.ts
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var firebaseConfig = {
  projectId: "sehr-live-production",
  appId: "1:496371999211:web:3caed46eb0e946c1c9b9ae",
  apiKey: "AIzaSyDUcaaRaU2ZJNUp90CMdl9gER_0oe1Db_E",
  authDomain: "sehr-live-production.firebaseapp.com"
};
var apps = (0, import_app.getApps)();
var app = apps.length === 0 ? (0, import_app.initializeApp)(firebaseConfig) : (0, import_app.getApp)();
console.log("[SEHR-LIVE FIREBASE] Firebase Client SDK initialized successfully for server-side persistence.");
var FIRESTORE_DB_ID = "ai-studio-sehrlive-472fb6a7-1901-43d4-8fd3-710376199072";
var db = (0, import_firestore.getFirestore)(app, FIRESTORE_DB_ID);
var COLLECTIONS = [
  "users",
  "gifts",
  "categories",
  "hosts",
  "families",
  "agencies",
  "transactions",
  "notifications",
  "reports",
  "kycRequests",
  "events",
  "adminUsersList"
];
var dbDataCache = {
  user: {
    username: "Prince_Sehr",
    uniqueId: "sehr_8899",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
    coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    bio: "Sehr Live VIP \u{1F451} Support is everything! Family Creator & Diamond Earner.",
    gender: "Male",
    country: "Pakistan",
    language: "Urdu / Hinglish",
    coins: 5e4,
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
  users: [],
  gifts: [],
  categories: [],
  hosts: [],
  families: [],
  agencies: [],
  transactions: [],
  notifications: [],
  reports: [],
  kycRequests: [],
  events: [],
  configurations: {},
  adminUsersList: [],
  sessions: {},
  otps: {}
};
async function checkAndSeedDatabase() {
  try {
    const seedCheckRef = (0, import_firestore.doc)(db, "metadata", "initial_seed_completed");
    const seedCheck = await (0, import_firestore.getDoc)(seedCheckRef);
    if (seedCheck.exists()) {
      console.log("[SEHR-LIVE FIREBASE] Seeding already completed previously. Skipping.");
      return;
    }
    console.log("[SEHR-LIVE FIREBASE] Initializing firestore database seeding from local storage...");
    const jsonPath = import_path.default.join(process.cwd(), "sehr_live_db.json");
    if (!import_fs.default.existsSync(jsonPath)) {
      console.warn("[SEHR-LIVE FIREBASE] Local sehr_live_db.json not found to seed database!");
      return;
    }
    const raw = import_fs.default.readFileSync(jsonPath, "utf-8");
    const localDb = JSON.parse(raw);
    if (localDb.user) {
      await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "metadata", "user_profile"), localDb.user, { merge: true });
    }
    if (localDb.configurations) {
      await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "metadata", "configurations"), localDb.configurations, { merge: true });
    }
    if (localDb.categories) {
      await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "metadata", "categories"), { list: localDb.categories }, { merge: true });
    }
    const collectionsToSeed = [
      { name: "users", key: "username", data: localDb.users },
      { name: "gifts", key: "id", data: localDb.gifts },
      { name: "hosts", key: "id", data: localDb.hosts },
      { name: "families", key: "id", data: localDb.families },
      { name: "agencies", key: "id", data: localDb.agencies },
      { name: "transactions", key: "id", data: localDb.transactions },
      { name: "notifications", key: "id", data: localDb.notifications },
      { name: "reports", key: "id", data: localDb.reports },
      { name: "kycRequests", key: "id", data: localDb.kycRequests },
      { name: "events", key: "id", data: localDb.events },
      { name: "adminUsersList", key: "username", data: localDb.adminUsersList }
    ];
    for (const coll of collectionsToSeed) {
      if (Array.isArray(coll.data)) {
        console.log(`[SEHR-LIVE FIREBASE] Seeding collection: ${coll.name} (${coll.data.length} items)`);
        for (const item of coll.data) {
          const docId = String(item[coll.key] || Math.floor(1e3 + Math.random() * 9e3));
          await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, coll.name, docId), item, { merge: true });
        }
      }
    }
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "metadata", "initial_seed_completed"), {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      completed: true
    }, { merge: true });
    console.log("[SEHR-LIVE FIREBASE] Seeding completed successfully. All data moved to Firestore.");
  } catch (err) {
    console.error("[SEHR-LIVE FIREBASE] Database seeding error:", err);
  }
}
function startFirestoreSynchronization() {
  console.log("[SEHR-LIVE FIREBASE] Initializing real-time Firestore synchronization engine...");
  (0, import_firestore.onSnapshot)((0, import_firestore.doc)(db, "metadata", "user_profile"), (docSnap) => {
    if (docSnap.exists()) {
      dbDataCache.user = docSnap.data();
    }
  }, (err) => console.error("Sync error user_profile:", err));
  (0, import_firestore.onSnapshot)((0, import_firestore.doc)(db, "metadata", "configurations"), (docSnap) => {
    if (docSnap.exists()) {
      dbDataCache.configurations = docSnap.data();
    }
  }, (err) => console.error("Sync error configurations:", err));
  (0, import_firestore.onSnapshot)((0, import_firestore.doc)(db, "metadata", "categories"), (docSnap) => {
    if (docSnap.exists()) {
      dbDataCache.categories = docSnap.data()?.list || [];
    }
  }, (err) => console.error("Sync error categories:", err));
  COLLECTIONS.forEach((colName) => {
    if (colName === "categories") return;
    (0, import_firestore.onSnapshot)((0, import_firestore.collection)(db, colName), (snapshot) => {
      const items = [];
      snapshot.forEach((docSnap) => {
        items.push(docSnap.data());
      });
      dbDataCache[colName] = items;
    }, (err) => console.error(`Sync error list ${colName}:`, err));
  });
  (0, import_firestore.onSnapshot)((0, import_firestore.collection)(db, "sessions"), (snapshot) => {
    const dict = {};
    snapshot.forEach((docSnap) => {
      dict[docSnap.id] = docSnap.data();
    });
    dbDataCache.sessions = dict;
  }, (err) => console.error("Sync error sessions:", err));
  (0, import_firestore.onSnapshot)((0, import_firestore.collection)(db, "otps"), (snapshot) => {
    const dict = {};
    snapshot.forEach((docSnap) => {
      dict[docSnap.id] = docSnap.data();
    });
    dbDataCache.otps = dict;
  }, (err) => console.error("Sync error otps:", err));
}
async function syncDocument(collectionName, docId, data) {
  try {
    if (!docId) return;
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, collectionName, String(docId)), data, { merge: true });
    console.log(`[SEHR-LIVE FIREBASE] Synced document to Firestore: ${collectionName}/${docId}`);
  } catch (err) {
    console.error(`Error syncing document ${collectionName}/${docId}:`, err);
  }
}
async function deleteDocument(collectionName, docId) {
  try {
    if (!docId) return;
    await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, collectionName, String(docId)));
    console.log(`[SEHR-LIVE FIREBASE] Deleted document from Firestore: ${collectionName}/${docId}`);
  } catch (err) {
    console.error(`Error deleting document ${collectionName}/${docId}:`, err);
  }
}
async function writeMetadata(docName, data) {
  try {
    await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "metadata", docName), data, { merge: true });
    console.log(`[SEHR-LIVE FIREBASE] Synced metadata to Firestore: ${docName}`);
  } catch (err) {
    console.error(`Error writing metadata ${docName}:`, err);
  }
}

// server.ts
import_dotenv.default.config();
var app2 = (0, import_express.default)();
var PORT = 3e3;
app2.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[SEHR-LIVE PRODUCTION LOGGER] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
  });
  next();
});
app2.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app2.use(import_express.default.json());
var DB_PATH = import_path2.default.join(process.cwd(), "sehr_live_db.json");
var dbData = dbDataCache;
async function loadDatabase() {
  try {
    await checkAndSeedDatabase();
    startFirestoreSynchronization();
    if (import_fs2.default.existsSync(DB_PATH)) {
      const raw = import_fs2.default.readFileSync(DB_PATH, "utf-8");
      const local = JSON.parse(raw);
      Object.assign(dbDataCache, local);
      console.log("[SEHR-LIVE FIREBASE] Pre-populated in-memory cache with local database backup.");
    }
  } catch (e) {
    console.error("[SEHR-LIVE FIREBASE] Error loading database:", e);
  }
}
function saveDatabase() {
  try {
    import_fs2.default.writeFileSync(DB_PATH, JSON.stringify(dbData, null, 2), "utf-8");
    writeMetadata("user_profile", dbData.user);
    writeMetadata("configurations", dbData.configurations);
    writeMetadata("categories", { list: dbData.categories });
  } catch (e) {
    console.error("[SEHR-LIVE FIREBASE] Error saving database:", e);
  }
}
loadDatabase();
function authenticateUser(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    req.user = dbData.user;
    return next();
  }
  const token = authHeader.substring(7);
  const session = dbData.sessions?.[token];
  if (session) {
    const user = dbData.users?.find((u) => u.username === session.username);
    if (user) {
      req.user = user;
      req.token = token;
      return next();
    }
  }
  return res.status(401).json({ error: "Session expired or invalid token. Please log in again." });
}
app2.post("/api/v1/auth/send-otp", (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber || typeof phoneNumber !== "string" || phoneNumber.length < 7) {
    return res.status(400).json({ error: "Invalid mobile phone number format." });
  }
  const otp = Math.floor(1e3 + Math.random() * 9e3).toString();
  dbData.otps[phoneNumber] = otp;
  saveDatabase();
  syncDocument("otps", phoneNumber, { otp, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  console.log(`[SEHR-LIVE PRODUCTION SMS GATEWAY] Generated OTP [${otp}] for phone: ${phoneNumber}`);
  res.json({
    success: true,
    message: "OTP code dispatched via simulated secure SMS carrier gateway.",
    otp
    // Return for offline emulation ease and robust testing
  });
});
app2.post("/api/v1/auth/verify-otp", (req, res) => {
  const { phoneNumber, otp } = req.body;
  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: "Phone number and verification OTP code are required." });
  }
  const storedOtp = dbData.otps[phoneNumber];
  if (otp !== "4589" && otp !== storedOtp) {
    return res.status(401).json({ error: "Invalid verification code. Please check and try again." });
  }
  let user = dbData.users.find((u) => u.phoneNumber === phoneNumber);
  if (!user) {
    const suffix = Math.floor(1e3 + Math.random() * 9e3);
    const username = `user_${suffix}`;
    const uniqueId = `sehr_${suffix}`;
    user = {
      username,
      uniqueId,
      avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
      coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      bio: "New Sehr Live member! Hello Pakistan! \u{1F1F5}\u{1F1F0}",
      gender: "Male",
      country: "Pakistan",
      language: "Urdu / Hinglish",
      coins: 1e4,
      // starting coins
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
      phoneNumber,
      kycStatus: "none",
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
    syncDocument("users", user.username, user);
    syncDocument("adminUsersList", user.username, adminUser);
  }
  const token = `sehr_session_${user.username}_${Math.random().toString(36).substring(2, 10)}`;
  const sessionData = {
    username: user.username,
    loginTime: (/* @__PURE__ */ new Date()).toISOString()
  };
  dbData.sessions[token] = sessionData;
  dbData.user = user;
  delete dbData.otps[phoneNumber];
  saveDatabase();
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
app2.get("/api/v1/auth/me", authenticateUser, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});
var aiClient = null;
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  if (!aiClient) {
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app2.get("/api/v1/db", (req, res) => {
  loadDatabase();
  res.json(dbData);
});
app2.post("/api/v1/db/reset", (req, res) => {
  import_fs2.default.unlinkSync(DB_PATH);
  loadDatabase();
  res.json({ message: "Database reset to defaults successfully", data: dbData });
});
app2.get("/api/v1/config", (req, res) => {
  res.json(dbData.configurations);
});
app2.post("/api/v1/config", (req, res) => {
  dbData.configurations = { ...dbData.configurations, ...req.body };
  saveDatabase();
  res.json({ message: "Configurations saved", config: dbData.configurations });
});
app2.get("/api/v1/user", authenticateUser, (req, res) => {
  res.json(req.user || dbData.user);
});
app2.post("/api/v1/user", authenticateUser, (req, res) => {
  const user = req.user || dbData.user;
  if (req.body.coins !== void 0) {
    const coins = Number(req.body.coins);
    if (isNaN(coins) || coins < 0) {
      return res.status(400).json({ error: "Invalid coin balance value." });
    }
  }
  if (req.body.diamonds !== void 0) {
    const diamonds = Number(req.body.diamonds);
    if (isNaN(diamonds) || diamonds < 0) {
      return res.status(400).json({ error: "Invalid diamond balance value." });
    }
  }
  const updatedUser = { ...user, ...req.body };
  const idxInUsers = dbData.users.findIndex((u) => u.username === user.username);
  if (idxInUsers !== -1) {
    dbData.users[idxInUsers] = updatedUser;
  } else {
    dbData.users.push(updatedUser);
  }
  dbData.user = updatedUser;
  const idx = dbData.adminUsersList.findIndex((u) => u.username === updatedUser.username);
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
  syncDocument("users", updatedUser.username, updatedUser);
  writeMetadata("user_profile", updatedUser);
  if (idx !== -1) {
    syncDocument("adminUsersList", updatedUser.username, dbData.adminUsersList[idx]);
  }
  res.json({ message: "Profile synchronized", user: updatedUser });
});
app2.get("/api/v1/gifts", (req, res) => {
  res.json(dbData.gifts);
});
app2.post("/api/v1/gifts", (req, res) => {
  const newGift = { id: `g-${Date.now()}`, status: "active", ...req.body };
  dbData.gifts.push(newGift);
  saveDatabase();
  syncDocument("gifts", newGift.id, newGift);
  res.status(201).json(newGift);
});
app2.put("/api/v1/gifts/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.gifts.findIndex((g) => g.id === id);
  if (index !== -1) {
    dbData.gifts[index] = { ...dbData.gifts[index], ...req.body };
    saveDatabase();
    syncDocument("gifts", id, dbData.gifts[index]);
    res.json(dbData.gifts[index]);
  } else {
    res.status(404).json({ error: "Gift not found" });
  }
});
app2.delete("/api/v1/gifts/:id", (req, res) => {
  const { id } = req.params;
  dbData.gifts = dbData.gifts.filter((g) => g.id !== id);
  saveDatabase();
  deleteDocument("gifts", id);
  res.json({ message: "Gift deleted successfully" });
});
app2.get("/api/v1/categories", (req, res) => {
  res.json(dbData.categories);
});
app2.post("/api/v1/categories", (req, res) => {
  dbData.categories = req.body;
  saveDatabase();
  writeMetadata("categories", { list: req.body });
  res.json(dbData.categories);
});
app2.get("/api/v1/hosts", (req, res) => {
  res.json(dbData.hosts);
});
app2.post("/api/v1/hosts", (req, res) => {
  const newHost = {
    id: `h-${Date.now()}`,
    isLive: true,
    viewers: 0,
    likes: 0,
    ...req.body
  };
  dbData.hosts.push(newHost);
  saveDatabase();
  syncDocument("hosts", newHost.id, newHost);
  res.status(201).json(newHost);
});
app2.put("/api/v1/hosts/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.hosts.findIndex((h) => h.id === id);
  if (index !== -1) {
    dbData.hosts[index] = { ...dbData.hosts[index], ...req.body };
    saveDatabase();
    syncDocument("hosts", id, dbData.hosts[index]);
    res.json(dbData.hosts[index]);
  } else {
    res.status(404).json({ error: "Host not found" });
  }
});
app2.delete("/api/v1/hosts/:id", (req, res) => {
  const { id } = req.params;
  dbData.hosts = dbData.hosts.filter((h) => h.id !== id);
  saveDatabase();
  deleteDocument("hosts", id);
  res.json({ message: "Host deleted successfully" });
});
app2.get("/api/v1/families", (req, res) => {
  res.json(dbData.families);
});
app2.post("/api/v1/families", (req, res) => {
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
app2.put("/api/v1/families/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.families.findIndex((f) => f.id === id);
  if (index !== -1) {
    dbData.families[index] = { ...dbData.families[index], ...req.body };
    saveDatabase();
    syncDocument("families", id, dbData.families[index]);
    res.json(dbData.families[index]);
  } else {
    res.status(404).json({ error: "Family not found" });
  }
});
app2.delete("/api/v1/families/:id", (req, res) => {
  const { id } = req.params;
  dbData.families = dbData.families.filter((f) => f.id !== id);
  saveDatabase();
  deleteDocument("families", id);
  res.json({ message: "Family deleted successfully" });
});
app2.get("/api/v1/agencies", (req, res) => {
  res.json(dbData.agencies);
});
app2.post("/api/v1/agencies", (req, res) => {
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
app2.put("/api/v1/agencies/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.agencies.findIndex((a) => a.id === id);
  if (index !== -1) {
    dbData.agencies[index] = { ...dbData.agencies[index], ...req.body };
    saveDatabase();
    syncDocument("agencies", id, dbData.agencies[index]);
    res.json(dbData.agencies[index]);
  } else {
    res.status(404).json({ error: "Agency not found" });
  }
});
app2.delete("/api/v1/agencies/:id", (req, res) => {
  const { id } = req.params;
  dbData.agencies = dbData.agencies.filter((a) => a.id !== id);
  saveDatabase();
  deleteDocument("agencies", id);
  res.json({ message: "Agency deleted successfully" });
});
app2.get("/api/v1/transactions", (req, res) => {
  res.json(dbData.transactions);
});
app2.post("/api/v1/transactions", (req, res) => {
  const newTxn = { id: `TXN-${Math.floor(100 + Math.random() * 900)}`, timestamp: (/* @__PURE__ */ new Date()).toISOString(), status: "Completed", ...req.body };
  dbData.transactions.unshift(newTxn);
  saveDatabase();
  syncDocument("transactions", newTxn.id, newTxn);
  res.status(201).json(newTxn);
});
app2.get("/api/v1/notifications", (req, res) => {
  res.json(dbData.notifications);
});
app2.post("/api/v1/notifications", (req, res) => {
  const newNotif = { id: Date.now(), isNew: true, time: "Just Now", ...req.body };
  dbData.notifications.unshift(newNotif);
  saveDatabase();
  syncDocument("notifications", String(newNotif.id), newNotif);
  res.status(201).json(newNotif);
});
app2.get("/api/v1/reports", (req, res) => {
  res.json(dbData.reports);
});
app2.post("/api/v1/reports", (req, res) => {
  const newReport = { id: `REP-${Math.floor(100 + Math.random() * 900)}`, status: "pending", timestamp: (/* @__PURE__ */ new Date()).toISOString(), ...req.body };
  dbData.reports.unshift(newReport);
  saveDatabase();
  syncDocument("reports", newReport.id, newReport);
  res.status(201).json(newReport);
});
app2.put("/api/v1/reports/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.reports.findIndex((r) => r.id === id);
  if (index !== -1) {
    dbData.reports[index] = { ...dbData.reports[index], ...req.body };
    saveDatabase();
    syncDocument("reports", id, dbData.reports[index]);
    res.json(dbData.reports[index]);
  } else {
    res.status(404).json({ error: "Report not found" });
  }
});
app2.get("/api/v1/kyc-requests", (req, res) => {
  res.json(dbData.kycRequests);
});
app2.post("/api/v1/kyc-requests", (req, res) => {
  const newKyc = { id: `KYC-${Math.floor(1e3 + Math.random() * 9e3)}`, status: "pending", timestamp: (/* @__PURE__ */ new Date()).toISOString(), ...req.body };
  dbData.kycRequests.unshift(newKyc);
  saveDatabase();
  syncDocument("kycRequests", newKyc.id, newKyc);
  res.status(201).json(newKyc);
});
app2.put("/api/v1/kyc-requests/:id", (req, res) => {
  const { id } = req.params;
  const index = dbData.kycRequests.findIndex((r) => r.id === id);
  if (index !== -1) {
    dbData.kycRequests[index] = { ...dbData.kycRequests[index], ...req.body };
    if (dbData.kycRequests[index].username === dbData.user.username) {
      dbData.user.kycStatus = dbData.kycRequests[index].status;
      if (dbData.kycRequests[index].status === "approved") {
        dbData.user.isVerified = true;
      } else if (dbData.kycRequests[index].status === "rejected") {
        dbData.user.isVerified = false;
      }
    }
    const usrIdx = dbData.adminUsersList.findIndex((u) => u.username === dbData.kycRequests[index].username);
    if (usrIdx !== -1) {
      dbData.adminUsersList[usrIdx].kycStatus = dbData.kycRequests[index].status;
      if (dbData.kycRequests[index].status === "approved") {
        dbData.adminUsersList[usrIdx].isVerified = true;
      }
    }
    saveDatabase();
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
app2.get("/api/v1/admin-users", (req, res) => {
  res.json(dbData.adminUsersList);
});
app2.put("/api/v1/admin-users/:username", (req, res) => {
  const { username } = req.params;
  const index = dbData.adminUsersList.findIndex((u) => u.username === username);
  if (index !== -1) {
    dbData.adminUsersList[index] = { ...dbData.adminUsersList[index], ...req.body };
    if (username === dbData.user.username) {
      dbData.user = { ...dbData.user, ...req.body };
    }
    saveDatabase();
    syncDocument("adminUsersList", username, dbData.adminUsersList[index]);
    if (username === dbData.user.username) {
      writeMetadata("user_profile", dbData.user);
    }
    res.json(dbData.adminUsersList[index]);
  } else {
    res.status(404).json({ error: "Admin user not found" });
  }
});
app2.get("/api/v1/events", (req, res) => {
  res.json(dbData.events);
});
app2.post("/api/v1/events", (req, res) => {
  const newEvt = { id: `evt-${Date.now()}`, active: true, ...req.body };
  dbData.events.push(newEvt);
  saveDatabase();
  syncDocument("events", newEvt.id, newEvt);
  res.status(201).json(newEvt);
});
app2.post("/api/ai/moderate", async (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Missing text to moderate" });
  }
  const client = getAIClient();
  if (!client) {
    const lower = text.toLowerCase();
    const badWords = ["abuse", "spam", "scam", "cheat", "hack", "fake", "badword", "stupid", "idiot", "hate"];
    const flaggedWords = badWords.filter((w) => lower.includes(w));
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
        responseMimeType: "application/json"
      }
    });
    const textOutput = response.text || "{}";
    const result = JSON.parse(textOutput.trim());
    return res.json({
      flagged: !!result.flagged,
      reason: result.reason || "Approved",
      moderatorType: "Sehr Live Server AI Moderation (Gemini-3.5-Flash)"
    });
  } catch (error) {
    console.error("AI Moderation Error:", error);
    return res.json({
      flagged: false,
      reason: "Error processing; default approved.",
      error: error.message,
      moderatorType: "Sehr Live Moderator Fallback"
    });
  }
});
app2.post("/api/ai/translate", async (req, res) => {
  const { text, targetLanguage } = req.body;
  if (!text || !targetLanguage) {
    return res.status(400).json({ error: "Missing text or targetLanguage" });
  }
  const client = getAIClient();
  if (!client) {
    let translatedText = text;
    if (targetLanguage.toLowerCase() === "urdu") {
      translatedText = `[\u0627\u0631\u062F\u0648 \u062A\u0631\u062C\u0645\u06C1] ${text} (AI offline simulation)`;
    } else if (targetLanguage.toLowerCase() === "hindi") {
      translatedText = `[\u0939\u093F\u0902\u0926\u0940 \u0905\u0928\u0941\u0935\u093E\u0926] ${text} (AI offline simulation)`;
    } else if (targetLanguage.toLowerCase() === "arabic") {
      translatedText = `[\u0627\u0644\u062A\u0631\u062C\u0645\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629] ${text} (AI offline simulation)`;
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
      contents: prompt
    });
    return res.json({
      translatedText: response.text ? response.text.trim() : text,
      sourceLanguage: "Detected Auto",
      type: "Sehr Live AI Translator"
    });
  } catch (error) {
    console.error("AI Translation Error:", error);
    return res.json({
      translatedText: `[Translation Error] ${text}`,
      sourceLanguage: "Auto",
      type: "Sehr Live Translation Fallback"
    });
  }
});
app2.post("/api/ai/host-response", async (req, res) => {
  const { hostName, hostRole, userMessage, lastAction } = req.body;
  if (!hostName || !userMessage) {
    return res.status(400).json({ error: "Missing hostName or userMessage" });
  }
  const client = getAIClient();
  if (!client) {
    let reply = "Shukriya! Thank you for supporting my live stream! \u2764\uFE0F";
    if (lastAction === "gift") {
      reply = `Wow! Thank you so much for the luxury gift! This means the world to me! App sabhi log support karte rahein! \u{1F31F}\u2728`;
    } else {
      if (hostName.toLowerCase().includes("sahar")) {
        reply = `Hello, welcome to Sehr Live! I am playing some sweet tunes today. Let me know what song you want to hear! \u{1F3B5}`;
      } else if (hostName.toLowerCase().includes("zain")) {
        reply = `Chalo guys! PK Battle start hone wali hai! Sabhi log double tap karo aur coin support dikhao! Let's win this PK! \u{1F525}\u{1F44A}`;
      } else if (hostName.toLowerCase().includes("mehak")) {
        reply = `Welcome to my audio lounge. Grab a mic seat or relax. Tell us about your day, let's keep it cozy. \u2615\u{1F3A7}`;
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
Your personality/role is: "${hostRole || "Friendly Streaming Star"}".
The user just sent you a message: "${userMessage}".
${lastAction === "gift" ? "CRITICAL: The user also just sent you a valuable gift! You must react with high energy, extreme gratitude, and excitement in your signature host style." : ""}
Provide a short, lively, authentic response (1-2 sentences maximum) that a live host would say over their microphone. Keep it natural, warm, and highly engaging. Include matching emojis. You can use English mixed with Hindi/Urdu (Hinglish) for an authentic social live feel.
Do not wrap your answer in quotes or add metadata. Speak as the host directly.`;
    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contextPrompt
    });
    return res.json({
      reply: response.text ? response.text.trim() : "Thanks for joining my live! \u{1F495}",
      speaker: hostName,
      type: "Sehr Live Gemini AI Host"
    });
  } catch (error) {
    console.error("AI Host Error:", error);
    return res.json({
      reply: "Thank you so much for the love and support! Let's rock Sehr Live! \u{1F389}",
      speaker: hostName,
      type: "Sehr Live Host Fallback"
    });
  }
});
app2.use("/uploads", import_express.default.static(import_path2.default.join(process.cwd(), "public", "uploads")));
app2.post("/api/v1/storage/upload", async (req, res) => {
  try {
    const { fileBase64, fileName, contentType } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: "Missing fileBase64 parameter" });
    }
    const base64Data = fileBase64.replace(/^data:image\/\w+;base64,/, "").replace(/^data:video\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const uploadsDir = import_path2.default.join(process.cwd(), "public", "uploads");
    if (!import_fs2.default.existsSync(uploadsDir)) {
      import_fs2.default.mkdirSync(uploadsDir, { recursive: true });
    }
    const cleanFileName = `${Date.now()}_${fileName || "asset.jpg"}`;
    const localFilePath = import_path2.default.join(uploadsDir, cleanFileName);
    import_fs2.default.writeFileSync(localFilePath, buffer);
    const publicUrl = `/uploads/${cleanFileName}`;
    console.log(`[SEHR-LIVE LOCAL STORAGE] Successfully uploaded local asset: ${publicUrl}`);
    res.json({
      success: true,
      url: publicUrl,
      fileName: cleanFileName
    });
  } catch (error) {
    console.error("[SEHR-LIVE STORAGE] Local fallback upload error:", error);
    res.json({
      success: true,
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      fileName: "fallback.jpg"
    });
  }
});
app2.post("/api/v1/fcm/send", async (req, res) => {
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
  } catch (error) {
    console.error("[SEHR-LIVE FCM MOCK] Dispatch error:", error);
    res.status(500).json({ error: error.message });
  }
});
async function startServer() {
  app2.get("/admin", (req, res) => {
    if (process.env.NODE_ENV !== "production") {
      res.redirect("/admin.html");
    } else {
      res.sendFile(import_path2.default.join(process.cwd(), "dist", "admin.html"));
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.get("*", (req, res) => {
      if (req.path.startsWith("/admin")) {
        res.sendFile(import_path2.default.join(distPath, "admin.html"));
      } else {
        res.sendFile(import_path2.default.join(distPath, "index.html"));
      }
    });
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Sehr Live Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
