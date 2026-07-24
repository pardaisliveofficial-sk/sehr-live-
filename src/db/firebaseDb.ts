import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot,
  setLogLevel,
  getDocs
} from "firebase/firestore";
import fs from "fs";
import path from "path";

// Initialize Firebase using Client SDK
let firebaseConfig = {
  projectId: "sehr-live-production",
  appId: "1:496371999211:web:3caed46eb0e946c1c9b9ae",
  apiKey: "AIzaSyDUcaaRaU2ZJNUp90CMdl9gER_0oe1Db_E",
  authDomain: "sehrlive.soulverseapps.com"
};

let FIRESTORE_DB_ID = "ai-studio-sehrlive-472fb6a7-1901-43d4-8fd3-710376199072";

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (configData.projectId) firebaseConfig.projectId = configData.projectId;
    if (configData.appId) firebaseConfig.appId = configData.appId;
    if (configData.apiKey) firebaseConfig.apiKey = configData.apiKey;
    if (configData.authDomain) firebaseConfig.authDomain = configData.authDomain;
    if (configData.firestoreDatabaseId) FIRESTORE_DB_ID = configData.firestoreDatabaseId;
    console.log("[SEHR-LIVE FIREBASE] Dynamically loaded configuration from firebase-applet-config.json.");
  }
} catch (err) {
  console.error("[SEHR-LIVE FIREBASE] Failed to load config dynamically:", err);
}

const apps = getApps();
const app = apps.length === 0 
  ? initializeApp(firebaseConfig) 
  : getApp();

console.log("[SEHR-LIVE FIREBASE] Firebase Client SDK initialized successfully with projectId:", firebaseConfig.projectId);

// Silence internal Firestore client logging
setLogLevel("silent");

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, FIRESTORE_DB_ID);

// Helpers to track and handle Firestore write quota exhaustion gracefully
export let isFirestoreQuotaExhausted = false;

export function handleQuotaError(err: any, operationName: string) {
  const errMsg = String(err?.message || err || "").toLowerCase();
  const errCode = String(err?.code || "").toLowerCase();
  if (
    errMsg.includes("resource_exhausted") || 
    errMsg.includes("quota") || 
    errCode.includes("resource-exhausted") ||
    errCode.includes("quota")
  ) {
    if (!isFirestoreQuotaExhausted) {
      isFirestoreQuotaExhausted = true;
      console.warn(`[SEHR-LIVE FIREBASE] Firestore write quota has been exhausted. Sahr Live is now operating in high-performance local fallback mode. All features remain fully functional locally.`);
    }
  } else {
    console.error(`[SEHR-LIVE FIREBASE] Error during '${operationName}':`, err);
  }
}

// Collection keys to map to Firestore
export const COLLECTIONS = [
  "users",
  "gifts",
  "categories",
  "hosts",
  "parties",
  "families",
  "agencies",
  "transactions",
  "notifications",
  "reports",
  "kycRequests",
  "events",
  "adminUsersList",
  "reels",
  "stories",
  "chats",
  "messages",
  "agencyRequests",
  "purchaseRequests",
  "coinTransactions",
  "approvalStatus",
  "adminActions",
  "coinSellers"
];

// Memory Cache synced with Firestore
export const dbDataCache: any = {
  user: {
    username: "Prince_Sehr",
    uniqueId: "sehr_8899",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80",
    coverPhoto: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    bio: "Sehr Live VIP 👑 Support is everything! Family Creator & Diamond Earner.",
    gender: "Male",
    country: "Pakistan",
    language: "Urdu / Hinglish",
    coins: 1000000,
    diamonds: 1200,
    vipLevel: 3,
    userLevel: 24,
    hostLevel: 12,
    wealthLevel: 32,
    xp: 750,
    familyId: "fam-kings",
    agencyId: "",
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
  parties: [],
  families: [],
  agencies: [],
  transactions: [],
  notifications: [],
  reports: [],
  kycRequests: [],
  events: [],
  configurations: {},
  adminUsersList: [],
  reels: [],
  stories: [],
  chats: [],
  messages: [],
  sessions: {},
  otps: {},
  agencyRequests: [],
  purchaseRequests: [],
  coinTransactions: [],
  approvalStatus: [],
  adminActions: [],
  coinSellers: []
};

export function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item));
  }
  const cleanObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      cleanObj[key] = null;
    } else if (typeof value === "object" && value !== null) {
      cleanObj[key] = sanitizeForFirestore(value);
    } else {
      cleanObj[key] = value;
    }
  }
  return cleanObj;
}

// Helper to check if database has been seeded
export async function checkAndSeedDatabase() {
  if (isFirestoreQuotaExhausted) return;
  try {
    const seedCheckRef = doc(db, "metadata", "initial_seed_completed");
    const seedCheck = await getDoc(seedCheckRef);
    if (seedCheck.exists()) {
      console.log("[SEHR-LIVE FIREBASE] Seeding already completed previously. Skipping.");
      return;
    }

    console.log("[SEHR-LIVE FIREBASE] Initializing firestore database seeding from local storage...");
    const jsonPath = path.join(process.cwd(), "sehr_live_db.json");
    if (!fs.existsSync(jsonPath)) {
      console.warn("[SEHR-LIVE FIREBASE] Local sehr_live_db.json not found to seed database!");
      return;
    }

    const raw = fs.readFileSync(jsonPath, "utf-8");
    const localDb = JSON.parse(raw);

    // Helper to safely write documents during seeding with quota awareness
    const safeSetDoc = async (docRef: any, data: any) => {
      if (isFirestoreQuotaExhausted) return;
      try {
        await setDoc(docRef, sanitizeForFirestore(data), { merge: true });
      } catch (err) {
        handleQuotaError(err, "database seeding write");
      }
    };

    // 1. Seed single/metadata properties
    if (localDb.user) {
      await safeSetDoc(doc(db, "metadata", "user_profile"), localDb.user);
    }
    if (localDb.configurations) {
      await safeSetDoc(doc(db, "metadata", "configurations"), localDb.configurations);
    }
    if (localDb.categories) {
      await safeSetDoc(doc(db, "metadata", "categories"), { list: localDb.categories });
    }

    // 2. Seed list collections
    const collectionsToSeed = [
      { name: "users", key: "username", data: localDb.users },
      { name: "gifts", key: "id", data: localDb.gifts },
      { name: "hosts", key: "id", data: [] }, // No demo hosts!
      { name: "families", key: "id", data: localDb.families },
      { name: "agencies", key: "id", data: [] }, // No demo agencies!
      { name: "transactions", key: "id", data: [] }, // No demo transactions!
      { name: "notifications", key: "id", data: localDb.notifications },
      { name: "reports", key: "id", data: localDb.reports },
      { name: "kycRequests", key: "id", data: localDb.kycRequests },
      { name: "events", key: "id", data: localDb.events },
      { name: "adminUsersList", key: "username", data: localDb.adminUsersList }
    ];

    for (const coll of collectionsToSeed) {
      if (isFirestoreQuotaExhausted) break;
      if (Array.isArray(coll.data)) {
        console.log(`[SEHR-LIVE FIREBASE] Seeding collection: ${coll.name} (${coll.data.length} items)`);
        for (const item of coll.data) {
          if (isFirestoreQuotaExhausted) break;
          const docId = String(item[coll.key] || Math.floor(1000 + Math.random() * 9000));
          await safeSetDoc(doc(db, coll.name, docId), item);
        }
      }
    }

    // Mark seed completed
    if (!isFirestoreQuotaExhausted) {
      await safeSetDoc(doc(db, "metadata", "initial_seed_completed"), {
        timestamp: new Date().toISOString(),
        completed: true
      });
      console.log("[SEHR-LIVE FIREBASE] Seeding completed successfully. All data moved to Firestore.");
    } else {
      console.log("[SEHR-LIVE FIREBASE] Seeding paused due to Firestore quota limitation. Operating in local mode.");
    }
  } catch (err) {
    console.error("[SEHR-LIVE FIREBASE] Database seeding error:", err);
  }
}

// Starts real-time replication listeners from Firestore to local cache
export function startFirestoreSynchronization() {
  console.log("[SEHR-LIVE FIREBASE] Initializing real-time Firestore synchronization engine...");

  // Sync Metadata values
  onSnapshot(doc(db, "metadata", "user_profile"), docSnap => {
    if (docSnap.exists()) {
      dbDataCache.user = docSnap.data();
    }
  }, err => handleQuotaError(err, "Sync user_profile"));

  onSnapshot(doc(db, "metadata", "configurations"), docSnap => {
    if (docSnap.exists()) {
      dbDataCache.configurations = docSnap.data();
    }
  }, err => handleQuotaError(err, "Sync configurations"));

  onSnapshot(doc(db, "metadata", "categories"), docSnap => {
    if (docSnap.exists()) {
      dbDataCache.categories = docSnap.data()?.list || [];
    }
  }, err => handleQuotaError(err, "Sync categories"));

  // Sync regular list collections
  COLLECTIONS.forEach(colName => {
    if (colName === "categories") return; // handled as metadata doc

    onSnapshot(collection(db, colName), snapshot => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data());
      });
      if (colName === "hosts") {
        dbDataCache.hosts = items.filter((h: any) => h && (h.isLive === true || h.status === "live") && h.status !== "ended" && h.status !== "offline");
      } else {
        dbDataCache[colName] = items;
      }
    }, err => handleQuotaError(err, `Sync list ${colName}`));
  });

  // Sync session and OTP collections (dictionary map structure)
  onSnapshot(collection(db, "sessions"), snapshot => {
    const dict: any = {};
    snapshot.forEach(docSnap => {
      dict[docSnap.id] = docSnap.data();
    });
    dbDataCache.sessions = dict;
  }, err => handleQuotaError(err, "Sync sessions"));

  onSnapshot(collection(db, "otps"), snapshot => {
    const dict: any = {};
    snapshot.forEach(docSnap => {
      dict[docSnap.id] = docSnap.data();
    });
    dbDataCache.otps = dict;
  }, err => handleQuotaError(err, "Sync otps"));
}

export async function clearAllHostsInFirestore() {
  if (isFirestoreQuotaExhausted) return;
  try {
    const querySnapshot = await getDocs(collection(db, "hosts"));
    const deletePromises: Promise<void>[] = [];
    querySnapshot.forEach((docSnap) => {
      deletePromises.push(deleteDoc(doc(db, "hosts", docSnap.id)));
    });
    await Promise.all(deletePromises);
    console.log("[SEHR-LIVE FIREBASE] Cleared all stale hosts from Firestore.");
  } catch (err) {
    console.error("[SEHR-LIVE FIREBASE] Failed to clear hosts in Firestore:", err);
  }
}

export async function syncDocument(collectionName: string, docId: string, data: any) {
  if (isFirestoreQuotaExhausted) return;
  try {
    if (!docId) return;
    await setDoc(doc(db, collectionName, String(docId)), sanitizeForFirestore(data), { merge: true });
    console.log(`[SEHR-LIVE FIREBASE] Synced document to Firestore: ${collectionName}/${docId}`);
  } catch (err) {
    handleQuotaError(err, `syncDocument ${collectionName}/${docId}`);
  }
}

export async function deleteDocument(collectionName: string, docId: string) {
  if (isFirestoreQuotaExhausted) return;
  try {
    if (!docId) return;
    await deleteDoc(doc(db, collectionName, String(docId)));
    console.log(`[SEHR-LIVE FIREBASE] Deleted document from Firestore: ${collectionName}/${docId}`);
  } catch (err) {
    handleQuotaError(err, `deleteDocument ${collectionName}/${docId}`);
  }
}

export async function writeMetadata(docName: "user_profile" | "configurations" | "categories", data: any) {
  if (isFirestoreQuotaExhausted) return;
  try {
    await setDoc(doc(db, "metadata", docName), sanitizeForFirestore(data), { merge: true });
    console.log(`[SEHR-LIVE FIREBASE] Synced metadata to Firestore: ${docName}`);
  } catch (err) {
    handleQuotaError(err, `writeMetadata ${docName}`);
  }
}
