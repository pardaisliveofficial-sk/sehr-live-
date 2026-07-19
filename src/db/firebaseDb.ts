import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot 
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

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, FIRESTORE_DB_ID);

// Collection keys to map to Firestore
export const COLLECTIONS = [
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
    coins: 50000,
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

// Helper to check if database has been seeded
export async function checkAndSeedDatabase() {
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

    // 1. Seed single/metadata properties
    if (localDb.user) {
      await setDoc(doc(db, "metadata", "user_profile"), localDb.user, { merge: true });
    }
    if (localDb.configurations) {
      await setDoc(doc(db, "metadata", "configurations"), localDb.configurations, { merge: true });
    }
    if (localDb.categories) {
      await setDoc(doc(db, "metadata", "categories"), { list: localDb.categories }, { merge: true });
    }

    // 2. Seed list collections
    const collectionsToSeed = [
      { name: "users", key: "username", data: localDb.users },
      { name: "gifts", key: "id", data: localDb.gifts },
      { name: "hosts", key: "id", data: localDb.hosts },
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
      if (Array.isArray(coll.data)) {
        console.log(`[SEHR-LIVE FIREBASE] Seeding collection: ${coll.name} (${coll.data.length} items)`);
        for (const item of coll.data) {
          const docId = String(item[coll.key] || Math.floor(1000 + Math.random() * 9000));
          await setDoc(doc(db, coll.name, docId), item, { merge: true });
        }
      }
    }

    // Mark seed completed
    await setDoc(doc(db, "metadata", "initial_seed_completed"), {
      timestamp: new Date().toISOString(),
      completed: true
    }, { merge: true });

    console.log("[SEHR-LIVE FIREBASE] Seeding completed successfully. All data moved to Firestore.");
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
  }, err => console.error("Sync error user_profile:", err));

  onSnapshot(doc(db, "metadata", "configurations"), docSnap => {
    if (docSnap.exists()) {
      dbDataCache.configurations = docSnap.data();
    }
  }, err => console.error("Sync error configurations:", err));

  onSnapshot(doc(db, "metadata", "categories"), docSnap => {
    if (docSnap.exists()) {
      dbDataCache.categories = docSnap.data()?.list || [];
    }
  }, err => console.error("Sync error categories:", err));

  // Sync regular list collections
  COLLECTIONS.forEach(colName => {
    if (colName === "categories") return; // handled as metadata doc

    onSnapshot(collection(db, colName), snapshot => {
      const items: any[] = [];
      snapshot.forEach(docSnap => {
        items.push(docSnap.data());
      });
      dbDataCache[colName] = items;
    }, err => console.error(`Sync error list ${colName}:`, err));
  });

  // Sync session and OTP collections (dictionary map structure)
  onSnapshot(collection(db, "sessions"), snapshot => {
    const dict: any = {};
    snapshot.forEach(docSnap => {
      dict[docSnap.id] = docSnap.data();
    });
    dbDataCache.sessions = dict;
  }, err => console.error("Sync error sessions:", err));

  onSnapshot(collection(db, "otps"), snapshot => {
    const dict: any = {};
    snapshot.forEach(docSnap => {
      dict[docSnap.id] = docSnap.data();
    });
    dbDataCache.otps = dict;
  }, err => console.error("Sync error otps:", err));
}

// Helpers to write changes back to Firestore securely
export async function syncDocument(collectionName: string, docId: string, data: any) {
  try {
    if (!docId) return;
    await setDoc(doc(db, collectionName, String(docId)), data, { merge: true });
    console.log(`[SEHR-LIVE FIREBASE] Synced document to Firestore: ${collectionName}/${docId}`);
  } catch (err) {
    console.error(`Error syncing document ${collectionName}/${docId}:`, err);
  }
}

export async function deleteDocument(collectionName: string, docId: string) {
  try {
    if (!docId) return;
    await deleteDoc(doc(db, collectionName, String(docId)));
    console.log(`[SEHR-LIVE FIREBASE] Deleted document from Firestore: ${collectionName}/${docId}`);
  } catch (err) {
    console.error(`Error deleting document ${collectionName}/${docId}:`, err);
  }
}

export async function writeMetadata(docName: "user_profile" | "configurations" | "categories", data: any) {
  try {
    await setDoc(doc(db, "metadata", docName), data, { merge: true });
    console.log(`[SEHR-LIVE FIREBASE] Synced metadata to Firestore: ${docName}`);
  } catch (err) {
    console.error(`Error writing metadata ${docName}:`, err);
  }
}
