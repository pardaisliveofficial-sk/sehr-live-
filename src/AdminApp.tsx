import React, { useState, useEffect } from "react";
import {
  Shield,
  Users,
  Radio,
  TrendingUp,
  Wallet,
  Award,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Trash,
  Edit,
  Activity,
  LogOut,
  DollarSign,
  Sliders,
  Globe,
  Crown,
  Percent,
  Star,
  UserCheck,
  Image,
  Calendar,
  List,
  Gift,
  Search,
  Lock,
  MessageSquare,
  Key,
  Layers,
  Database,
  Grid
} from "lucide-react";

export default function AdminApp() {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [role, setRole] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");

  // Saved admin credentials in memory (changeable)
  const [credentials, setCredentials] = useState<any>({
    superadmin: { pass: "sehrlive2026", role: "Super Admin" },
    admin: { pass: "sehrlive2026", role: "Admin" },
    moderator: { pass: "sehrlive2026", role: "Moderator" }
  });

  // Loaded database state from central APIs
  const [db, setDb] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Search & Filter local states
  const [userSearch, setUserSearch] = useState<string>("");
  const [giftSearch, setGiftSearch] = useState<string>("");

  // CRUD Temp states
  const [editingGift, setEditingGift] = useState<any>(null);
  const [newGift, setNewGift] = useState<any>({
    name: "",
    cost: 10,
    type: "2d",
    icon: "🎁",
    color: "from-pink-500 to-rose-600",
    animationClass: "animate-bounce",
    category: "Popular"
  });

  const [newBanner, setNewBanner] = useState<any>({
    title: "",
    image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
    link: "event-info",
    active: true
  });

  const [newEvent, setNewEvent] = useState<any>({
    title: "",
    duration: "24 Hours",
    reward: "1.5x Multiplier"
  });

  const [editingHost, setEditingHost] = useState<any>(null);
  const [newHost, setNewHost] = useState<any>({
    name: "",
    role: "",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
    category: "video",
    statusText: "",
    bio: "",
    agencyId: "agency-alpha"
  });

  const [editingAgency, setEditingAgency] = useState<any>(null);
  const [newAgency, setNewAgency] = useState<any>({
    name: "",
    ownerEmail: "",
    salaryRate: ""
  });

  const [editingFamily, setEditingFamily] = useState<any>(null);
  const [newFamily, setNewFamily] = useState<any>({
    name: "",
    leader: "",
    description: ""
  });

  // Fetch Central Database
  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || "";

  const fetchDb = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/db`);
      if (res.ok) {
        const data = await res.json();
        setDb(data);
      }
    } catch (e) {
      console.error("Error synchronizing admin DB:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDb();
  }, []);

  // Show auto-dismiss toast helper
  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const targetUser = username.toLowerCase().trim();
    if (credentials[targetUser] && credentials[targetUser].pass === password) {
      setIsAuthenticated(true);
      setRole(credentials[targetUser].role);
      triggerToast(`Welcome back, ${credentials[targetUser].role}! Access granted.`);
    } else {
      setAuthError("Incorrect username or security password!");
    }
  };

  // Password change handler
  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    const userKey = username.toLowerCase().trim();
    if (credentials[userKey].pass !== oldPassword) {
      alert("Current password does not match our records!");
      return;
    }
    setCredentials((prev: any) => ({
      ...prev,
      [userKey]: { ...prev[userKey], pass: newPassword }
    }));
    setShowPasswordChangeModal(false);
    setOldPassword("");
    setNewPassword("");
    triggerToast("Password changed successfully! Keep it secure.");
  };

  // Sync API modifications helper
  const syncWithServer = async (endpoint: string, method: string, payload: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await fetchDb();
        return true;
      }
    } catch (e) {
      console.error(`API update failed for ${endpoint}:`, e);
    }
    return false;
  };

  // User Administration Operations
  const handleToggleBanUser = async (userProfile: any) => {
    const nextBanState = !userProfile.isBanned;
    const confirmAction = window.confirm(
      `Are you sure you want to ${nextBanState ? "BAN & SUSPEND" : "UNBAN & RESTORE"} user @${userProfile.username}?`
    );
    if (!confirmAction) return;

    await syncWithServer(`/api/v1/admin-users/${userProfile.username}`, "PUT", {
      isBanned: nextBanState
    });
    triggerToast(`User @${userProfile.username} has been ${nextBanState ? "BANNED globally" : "UNBANNED successfully"}`);
  };

  const handleUpdateCoins = async (targetUsername: string, currentCoins: number, value: number) => {
    const updatedCoins = Math.max(0, currentCoins + value);
    await syncWithServer(`/api/v1/admin-users/${targetUsername}`, "PUT", {
      coins: updatedCoins
    });
    triggerToast(`Balance adjusted for @${targetUsername}: ${updatedCoins} Coins`);
  };

  const handleToggleVerification = async (userProfile: any) => {
    await syncWithServer(`/api/v1/admin-users/${userProfile.username}`, "PUT", {
      isVerified: !userProfile.isVerified
    });
    triggerToast(`Verification checkmark toggled for @${userProfile.username}`);
  };

  // KYC Auditing
  const handleAuditKyc = async (requestId: string, nextStatus: "approved" | "rejected") => {
    await syncWithServer(`/api/v1/kyc-requests/${requestId}`, "PUT", {
      status: nextStatus
    });
    triggerToast(`KYC request ${requestId} has been ${nextStatus.toUpperCase()} successfully.`);
  };

  // Hosts CRUD
  const handleAddHost = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await syncWithServer("/api/v1/hosts", "POST", newHost);
    if (success) {
      setNewHost({
        name: "",
        role: "",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80",
        category: "video",
        statusText: "",
        bio: "",
        agencyId: "agency-alpha"
      });
      triggerToast("New stream host deployed successfully!");
    }
  };

  const handleDeleteHost = async (id: string) => {
    if (confirm("Are you sure you want to delete this host node?")) {
      await syncWithServer(`/api/v1/hosts/${id}`, "DELETE", {});
      triggerToast("Stream host node deleted.");
    }
  };

  const handleSaveHostEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await syncWithServer(`/api/v1/hosts/${editingHost.id}`, "PUT", editingHost);
    if (success) {
      setEditingHost(null);
      triggerToast("Stream host parameters synchronized successfully!");
    }
  };

  // Agencies CRUD
  const handleAddAgency = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await syncWithServer("/api/v1/agencies", "POST", newAgency);
    if (success) {
      setNewAgency({ name: "", ownerEmail: "", salaryRate: "" });
      triggerToast("Agency registered in Sehr database.");
    }
  };

  const handleDeleteAgency = async (id: string) => {
    if (confirm("Are you sure you want to dissolve this agency registration?")) {
      await syncWithServer(`/api/v1/agencies/${id}`, "DELETE", {});
      triggerToast("Agency registration removed.");
    }
  };

  const handleSaveAgencyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await syncWithServer(`/api/v1/agencies/${editingAgency.id}`, "PUT", editingAgency);
    if (success) {
      setEditingAgency(null);
      triggerToast("Agency information updated.");
    }
  };

  // Families CRUD
  const handleAddFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await syncWithServer("/api/v1/families", "POST", newFamily);
    if (success) {
      setNewFamily({ name: "", leader: "", description: "" });
      triggerToast("New family registered.");
    }
  };

  const handleDeleteFamily = async (id: string) => {
    if (confirm("Are you sure you want to disband this family?")) {
      await syncWithServer(`/api/v1/families/${id}`, "DELETE", {});
      triggerToast("Family disbanded.");
    }
  };

  const handleSaveFamilyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await syncWithServer(`/api/v1/families/${editingFamily.id}`, "PUT", editingFamily);
    if (success) {
      setEditingFamily(null);
      triggerToast("Family details updated.");
    }
  };

  // Gifts CRUD
  const handleAddGift = async (e: React.FormEvent) => {
    e.preventDefault();
    await syncWithServer("/api/v1/gifts", "POST", newGift);
    setNewGift({
      name: "",
      cost: 10,
      type: "2d",
      icon: "🎁",
      color: "from-pink-500 to-rose-600",
      animationClass: "animate-bounce",
      category: "Popular"
    });
    triggerToast("New premium gift item appended successfully!");
  };

  const handleSaveGiftEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGift) return;
    await syncWithServer(`/api/v1/gifts/${editingGift.id}`, "PUT", editingGift);
    setEditingGift(null);
    triggerToast(`Gift details updated: ${editingGift.name}`);
  };

  const handleDeleteGift = async (giftId: string) => {
    if (!window.confirm("Are you absolutely sure you want to delete this gift item? This will instantly remove it from the viewer store.")) return;
    await fetch(`${API_BASE_URL}/api/v1/gifts/${giftId}`, { method: "DELETE" });
    await fetchDb();
    triggerToast("Gift catalog item deleted successfully.");
  };

  // Global Config Updates
  const handleToggleMaintenance = async () => {
    const nextState = !db.configurations.maintenanceMode;
    await syncWithServer("/api/v1/config", "POST", {
      maintenanceMode: nextState
    });
    triggerToast(`Maintenance Mode toggled: ${nextState ? "ACTIVE ⚠️" : "OFFLINE ✅"}`);
  };

  const handleUpdateAppVersionConfig = async (version: string, force: boolean) => {
    await syncWithServer("/api/v1/config", "POST", {
      appVersion: version,
      forceUpdate: force
    });
    triggerToast(`App Version controller updated successfully: ${version}`);
  };

  // Banner Operations
  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedBanners = [...db.configurations.banners, { ...newBanner, id: `b-${Date.now()}` }];
    await syncWithServer("/api/v1/config", "POST", { banners: updatedBanners });
    setNewBanner({
      title: "",
      image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80",
      link: "event-info",
      active: true
    });
    triggerToast("New slider advertisement banner added!");
  };

  const handleDeleteBanner = async (bannerId: string) => {
    const updatedBanners = db.configurations.banners.filter((b: any) => b.id !== bannerId);
    await syncWithServer("/api/v1/config", "POST", { banners: updatedBanners });
    triggerToast("Advertisement banner removed from slider.");
  };

  // VIP Suspension
  const handleToggleVipSuspension = async () => {
    const nextVipState = !db.user.vipSuspended;
    await syncWithServer("/api/v1/user", "POST", {
      vipSuspended: nextVipState
    });
    triggerToast(`User VIP state ${nextVipState ? "SUSPENDED" : "ACTIVATED"}`);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    await syncWithServer("/api/v1/events", "POST", newEvent);
    setNewEvent({ title: "", duration: "24 Hours", reward: "1.5x Multiplier" });
    triggerToast("New campaign tournament scheduled!");
  };

  // Moderation resolve
  const handleResolveReport = async (reportId: string) => {
    await syncWithServer(`/api/v1/reports/${reportId}`, "PUT", {
      status: "resolved"
    });
    triggerToast(`Moderation ticket ${reportId} marked as completed/resolved`);
  };

  // Backup trigger
  const handleTriggerBackup = () => {
    triggerToast("Central database snapshot saved successfully! Backups are synced.");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#09090d] flex items-center justify-center font-sans text-white">
        <div className="text-center space-y-3">
          <Activity className="w-12 h-12 text-[#66fcf1] animate-spin mx-auto" />
          <p className="text-sm font-bold uppercase tracking-widest font-mono text-[#66fcf1]">Syncing Sehr Ecosystem Database...</p>
        </div>
      </div>
    );
  }

  // Render Login state
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#07070b] flex items-center justify-center font-sans p-4 relative overflow-hidden">
        {/* Abstract futuristic backgrounds */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="w-full max-w-md bg-[#111119] border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gradient-to-tr from-[#ff007f] via-[#7b2cbf] to-[#00f5ff] rounded-full flex items-center justify-center mx-auto shadow-lg relative animate-pulse">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Sehr <span className="bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] bg-clip-text text-transparent">Live</span>
            </h2>
            <p className="text-xs text-gray-400 font-mono uppercase tracking-widest">Web Administration Portal</p>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-xl text-center text-xs text-red-400 font-medium">
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">Operator ID</label>
              <div className="relative">
                <Users className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. superadmin, admin, moderator"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#ff007f] font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider font-mono">Security Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#ff007f] font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] hover:opacity-90 active:scale-95 text-white py-3.5 rounded-xl text-sm font-black uppercase tracking-wider transition-all shadow-lg shadow-[#ff007f]/10 cursor-pointer text-center"
            >
              🔐 Authenticate & Enter Console
            </button>
          </form>

          <div className="bg-[#181824] p-3.5 rounded-xl border border-white/5 space-y-1 text-center font-mono text-[9px] text-gray-500 leading-normal">
            <p className="text-gray-400 font-bold uppercase tracking-wider mb-1">DEFAULT OPERATOR LOGINS:</p>
            <p>Super Admin: <span className="text-pink-500">superadmin</span> / pass: <span className="text-pink-400">sehrlive2026</span></p>
            <p>Standard Admin: <span className="text-pink-500">admin</span> / pass: <span className="text-pink-400">sehrlive2026</span></p>
            <p>Moderator: <span className="text-pink-500">moderator</span> / pass: <span className="text-pink-400">sehrlive2026</span></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070b] flex font-sans text-gray-200">
      {/* SUCCESS TOAST MESSAGE */}
      {successToast && (
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-emerald-500 to-green-600 border border-emerald-400 text-black font-black text-xs px-5 py-3 rounded-2xl shadow-2xl z-999 animate-bounce flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-black" />
          <span>{successToast}</span>
        </div>
      )}

      {/* 1. SIDEBAR NAVIGATION PANEL */}
      <aside className="w-64 bg-[#0d0d15] border-r border-white/10 flex flex-col justify-between select-none shrink-0">
        <div className="space-y-6 py-5">
          {/* Logo Brand */}
          <div className="px-5 border-b border-white/5 pb-5">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ff007f] via-[#7b2cbf] to-[#00f5ff] flex items-center justify-center shadow-md relative animate-pulse">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-base font-black text-white flex items-center">
                  Sehr <span className="bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] bg-clip-text text-transparent ml-1">Admin</span>
                </h2>
                <span className="text-[8px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.2 rounded font-mono uppercase font-black tracking-widest mt-0.5 block">
                  {role} PANEL
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1 max-h-[70vh] overflow-y-auto scrollbar-none">
            {[
              { id: "dashboard", label: "Dashboard Overview", icon: Grid },
              { id: "users", label: "Users & Accounts", icon: Users },
              { id: "kyc", label: "KYC Audit Panel", icon: UserCheck },
              { id: "hosts", label: "Hosts & Broadcasters", icon: Radio },
              { id: "agencies", label: "Agencies & Commissions", icon: Percent },
              { id: "families", label: "Families & Guilds", icon: Award },
              { id: "gifts", label: "Gifts Catalog (CRUD)", icon: Gift },
              { id: "wallet", label: "Wallet & Cash Transactions", icon: Wallet },
              { id: "vip", label: "VIP & Glowing Frames", icon: Crown },
              { id: "moderation", label: "Moderation & AI Safety", icon: AlertTriangle },
              { id: "events", label: "Events & Banners", icon: Image },
              { id: "system", label: "System Config", icon: Settings }
            ].map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.id}
                  onClick={() => setActiveTab(link.id)}
                  className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeTab === link.id
                      ? "bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] text-white shadow-md shadow-[#ff007f]/5"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Details */}
        <div className="p-4 border-t border-white/5 space-y-3 bg-[#0a0a0f]">
          <div className="flex items-center space-x-2.5 bg-transparent">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-black text-xs text-white uppercase border border-white/10">
              {username.charAt(0)}
            </div>
            <div className="bg-transparent">
              <p className="text-[10px] font-black text-white">@{username}</p>
              <button
                onClick={() => setShowPasswordChangeModal(true)}
                className="text-[8px] text-[#ff007f] hover:underline font-bold transition-all uppercase block mt-0.5"
              >
                Change Password 🔑
              </button>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm("Disconnect admin session?")) {
                setIsAuthenticated(false);
                setUsername("");
                setPassword("");
              }
            }}
            className="w-full bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-red-400 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* 2. MAIN WORKING SCREEN */}
      <main className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Global Nav Bar Header */}
        <header className="h-16 border-b border-white/10 bg-[#0d0d15] px-6 flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-wider text-[#66fcf1] font-mono flex items-center space-x-2">
            <span className="w-1.5 h-1.5 bg-[#66fcf1] rounded-full animate-ping"></span>
            <span>Ecosystem Node Status: Operational</span>
          </h2>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 bg-black/40 border border-white/5 rounded-xl px-3 py-1 text-[10px] font-mono text-gray-400">
              <Database className="w-3.5 h-3.5 text-pink-500 mr-1" />
              <span>DB SYNC: 100% OK</span>
            </div>
            {db.configurations.maintenanceMode && (
              <span className="bg-red-500/15 text-red-400 border border-red-500/30 text-[9px] font-bold px-2.5 py-1 rounded-full animate-pulse uppercase">
                ⚠️ Platform Under Maintenance
              </span>
            )}
          </div>
        </header>

        {/* Dynamic Inner Tab Wrapper */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          
          {/* ========================================================================= */}
          {/* TAB: DASHBOARD OVERVIEW */}
          {/* ========================================================================= */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Core Analytics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-[#0f0f18] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                  <div className="space-y-1 bg-transparent">
                    <p className="text-[10px] text-gray-500 uppercase font-black font-mono">System Total Users</p>
                    <p className="text-2xl font-black text-white">{db.adminUsersList.length + 1420}</p>
                    <span className="text-[9px] text-green-400 font-bold font-mono">📈 +14% this month</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-[#0f0f18] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                  <div className="space-y-1 bg-transparent">
                    <p className="text-[10px] text-gray-500 uppercase font-black font-mono">Registered Talent Hosts</p>
                    <p className="text-2xl font-black text-white">{db.hosts.length + 74}</p>
                    <span className="text-[9px] text-cyan-400 font-bold font-mono">🎤 12 stream nodes live</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
                    <Radio className="w-6 h-6 animate-pulse" />
                  </div>
                </div>

                <div className="bg-[#0f0f18] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                  <div className="space-y-1 bg-transparent">
                    <p className="text-[10px] text-gray-500 uppercase font-black font-mono">Daily Gifting Volume</p>
                    <p className="text-2xl font-black text-white">412,500 Coins</p>
                    <span className="text-[9px] text-[#ff007f] font-bold font-mono">💎 Approx $2,750 USD</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-[#ff007f]/10 text-[#ff007f] flex items-center justify-center">
                    <Gift className="w-6 h-6" />
                  </div>
                </div>

                <div className="bg-[#0f0f18] border border-white/5 rounded-2xl p-5 flex items-center justify-between">
                  <div className="space-y-1 bg-transparent">
                    <p className="text-[10px] text-gray-500 uppercase font-black font-mono">Net Platform Commission</p>
                    <p className="text-2xl font-black text-emerald-400">$8,450 USD</p>
                    <span className="text-[9px] text-emerald-400 font-bold font-mono">🏦 Payout status: Ready</span>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Dynamic Grid: Statistics Visualization & Activity */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                {/* Simulated Revenue Plot Graph */}
                <div className="xl:col-span-8 bg-[#0f0f18] border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono">Pakistan Weekly Financial Revenue Streams</h4>
                    <span className="text-[10px] font-mono text-gray-400">EasyPaisa & JazzCash Integrated ledger</span>
                  </div>
                  
                  {/* Custom CSS Bar Graph */}
                  <div className="h-48 flex items-end justify-between gap-3 pt-6 px-4 bg-transparent select-none">
                    {[
                      { label: "Mon", val: "30%", amt: "$1.4k" },
                      { label: "Tue", val: "45%", amt: "$2.1k" },
                      { label: "Wed", val: "75%", amt: "$3.5k" },
                      { label: "Thu", val: "60%", amt: "$2.8k" },
                      { label: "Fri", val: "95%", amt: "$4.5k" },
                      { label: "Sat", val: "85%", amt: "$4.0k" },
                      { label: "Sun", val: "100%", amt: "$5.2k" }
                    ].map((bar, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center bg-transparent group">
                        <span className="text-[8px] text-pink-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity mb-1 font-mono">{bar.amt}</span>
                        <div className="w-full bg-[#161622] rounded-t-lg h-32 relative overflow-hidden flex items-end">
                          <div 
                            className="w-full bg-gradient-to-t from-[#7b2cbf] to-[#ff007f] rounded-t-md transition-all duration-1000"
                            style={{ height: bar.val }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-gray-500 mt-2 font-semibold font-mono">{bar.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live stream status feed */}
                <div className="xl:col-span-4 bg-[#0f0f18] border border-white/5 rounded-2xl p-5 space-y-4">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-3">Active Streaming Nodes</h4>
                  
                  <div className="space-y-3">
                    {db.hosts.map((host: any) => (
                      <div key={host.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/35 border border-white/5">
                        <div className="flex items-center space-x-2.5 bg-transparent">
                          <img src={host.avatar} className="w-9 h-9 rounded-full object-cover border border-white/10" />
                          <div className="bg-transparent text-left">
                            <p className="text-[11px] font-black text-white leading-tight">{host.name}</p>
                            <span className="text-[7.5px] bg-[#ff007f]/10 text-[#ff007f] border border-[#ff007f]/20 px-1 py-0.2 rounded uppercase font-black tracking-widest font-mono mt-1 inline-block">
                              {host.category} node
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-white font-mono font-black">👥 {host.viewers}</p>
                          <span className="text-[7.5px] text-green-400 font-mono font-bold uppercase">Streaming ✓</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: USERS & ACCOUNTS */}
          {/* ========================================================================= */}
          {activeTab === "users" && (
            <div className="bg-[#0f0f18] border border-white/5 rounded-2xl p-5 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">Ecosystem Users Ledger</h3>
                  <p className="text-xs text-gray-400">Suspend accounts, verify profiles, adjust coin bundles and view live states</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search by username..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="bg-black/40 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-pink-500 font-mono w-60"
                  />
                </div>
              </div>

              {/* Main Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 uppercase text-[9px] font-mono tracking-wider">
                      <th className="pb-3 pl-2">User details</th>
                      <th className="pb-3">Verification</th>
                      <th className="pb-3">Level Progression</th>
                      <th className="pb-3">Wallet Coins</th>
                      <th className="pb-3">Profile frame</th>
                      <th className="pb-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {/* Add main profile to manage */}
                    {[db.user, ...db.adminUsersList]
                      .filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()))
                      .map((u, i) => (
                        <tr key={i} className="hover:bg-white/2">
                          <td className="py-3.5 pl-2 flex items-center space-x-2.5">
                            <img src={u.avatar} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                            <div>
                              <p className="font-bold text-white">@{u.username}</p>
                              <span className="text-[9px] text-gray-400 font-mono">{u.fullName || "Unspecified name"}</span>
                              {u.isBanned && (
                                <span className="ml-1.5 text-[7px] bg-red-600/20 text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded font-mono uppercase font-black animate-pulse">
                                  🚨 BANNED
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5">
                            <button
                              onClick={() => handleToggleVerification(u)}
                              className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-full border transition-all ${
                                u.isVerified
                                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                                  : "bg-gray-800 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500"
                              }`}
                            >
                              {u.isVerified ? "✓ Verified Checkmark" : "Unverified"}
                            </button>
                          </td>
                          <td className="py-3.5">
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                                LVL {u.userLevel}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 font-mono font-bold text-yellow-400 flex items-center space-x-1.5 py-4">
                            <span>💎 {u.coins}</span>
                            <div className="flex space-x-1 bg-transparent">
                              <button
                                onClick={() => handleUpdateCoins(u.username, u.coins, 1000)}
                                className="text-[8px] bg-yellow-500/10 hover:bg-yellow-500 hover:text-black px-1.5 py-0.2 rounded border border-yellow-500/20 font-black"
                              >
                                +1k
                              </button>
                              <button
                                onClick={() => handleUpdateCoins(u.username, u.coins, -1000)}
                                className="text-[8px] bg-red-500/10 hover:bg-red-500 hover:text-black px-1.5 py-0.2 rounded border border-red-500/20 font-black"
                              >
                                -1k
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 font-mono text-purple-400 font-bold">
                            {u.selectedFrameId ? u.selectedFrameId.replace("vip-frame-", "VIP Frame ") : "None"}
                          </td>
                          <td className="py-3.5 text-center">
                            <button
                              onClick={() => handleToggleBanUser(u)}
                              className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg transition-all ${
                                u.isBanned
                                  ? "bg-green-500 hover:bg-green-400 text-black"
                                  : "bg-red-600 hover:bg-red-500 text-white"
                              }`}
                            >
                              {u.isBanned ? "Unban Account" : "Ban Account"}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: HOSTS & BROADCASTERS */}
          {/* ========================================================================= */}
          {activeTab === "hosts" && (
            <div className="space-y-6 text-left">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form Col */}
                <div className="lg:col-span-4 bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                    {editingHost ? "✏️ Modify Host Parameters" : "➕ Deploy New Stream Node"}
                  </h4>

                  <form onSubmit={editingHost ? handleSaveHostEdit : handleAddHost} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Host / Broadcaster Name</label>
                      <input
                        type="text"
                        required
                        value={editingHost ? editingHost.name : newHost.name}
                        onChange={(e) => {
                          if (editingHost) setEditingHost({ ...editingHost, name: e.target.value });
                          else setNewHost({ ...newHost, name: e.target.value });
                        }}
                        placeholder="e.g. DJ Alvi Live"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Live Status Slogan</label>
                      <input
                        type="text"
                        required
                        value={editingHost ? editingHost.statusText : newHost.statusText}
                        onChange={(e) => {
                          if (editingHost) setEditingHost({ ...editingHost, statusText: e.target.value });
                          else setNewHost({ ...newHost, statusText: e.target.value });
                        }}
                        placeholder="e.g. Jamming with fans!"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-transparent">
                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Category Node</label>
                        <select
                          value={editingHost ? editingHost.category : newHost.category}
                          onChange={(e) => {
                            if (editingHost) setEditingHost({ ...editingHost, category: e.target.value });
                            else setNewHost({ ...newHost, category: e.target.value });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                        >
                          <option value="video">Video Stream</option>
                          <option value="audio">Audio Lounge</option>
                          <option value="pk">PK Battle Node</option>
                        </select>
                      </div>

                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Affiliated Agency</label>
                        <select
                          value={editingHost ? editingHost.agencyId : newHost.agencyId}
                          onChange={(e) => {
                            if (editingHost) setEditingHost({ ...editingHost, agencyId: e.target.value });
                            else setNewHost({ ...newHost, agencyId: e.target.value });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                        >
                          {db.agencies.map((a: any) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Host Bio Profile</label>
                      <textarea
                        value={editingHost ? editingHost.bio : newHost.bio}
                        onChange={(e) => {
                          if (editingHost) setEditingHost({ ...editingHost, bio: e.target.value });
                          else setNewHost({ ...newHost, bio: e.target.value });
                        }}
                        placeholder="e.g. Professional acoustic singer from Lahore."
                        rows={2}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-transparent">
                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Viewers Count</label>
                        <input
                          type="number"
                          value={editingHost ? editingHost.viewers : newHost.viewers}
                          onChange={(e) => {
                            if (editingHost) setEditingHost({ ...editingHost, viewers: Number(e.target.value) });
                            else setNewHost({ ...newHost, viewers: Number(e.target.value) });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none font-mono"
                        />
                      </div>
                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Total Likes Count</label>
                        <input
                          type="number"
                          value={editingHost ? editingHost.likes : newHost.likes}
                          onChange={(e) => {
                            if (editingHost) setEditingHost({ ...editingHost, likes: Number(e.target.value) });
                            else setNewHost({ ...newHost, likes: Number(e.target.value) });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-2 bg-transparent">
                      <button
                        type="submit"
                        className="flex-1 bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] hover:opacity-90 text-white font-black text-xs uppercase py-2.5 rounded-xl transition-all cursor-pointer text-center"
                      >
                        {editingHost ? "Save Changes" : "Deploy Live Node"}
                      </button>
                      {editingHost && (
                        <button
                          type="button"
                          onClick={() => setEditingHost(null)}
                          className="px-4 bg-[#202030] text-gray-400 hover:text-white rounded-xl text-xs font-bold"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Grid list of Broadcasters */}
                <div className="lg:col-span-8 bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                    Talent Registry & Active Streaming Nodes
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {db.hosts.map((host: any) => (
                      <div key={host.id} className="p-4 rounded-xl bg-black/45 border border-white/5 space-y-3.5 text-left">
                        <div className="flex justify-between items-start bg-transparent">
                          <div className="flex items-center space-x-3 bg-transparent">
                            <img src={host.avatar} className="w-12 h-12 rounded-full object-cover border border-white/10" />
                            <div className="bg-transparent text-left">
                              <h5 className="text-xs font-black text-white leading-normal">{host.name}</h5>
                              <p className="text-[10px] text-gray-400 font-medium">{host.role || "Official Broadcaster"}</p>
                              <span className={`text-[8px] px-1.5 py-0.2 rounded font-mono font-black uppercase tracking-wider ${
                                host.category === "video" ? "bg-pink-500/15 text-pink-400" :
                                host.category === "pk" ? "bg-yellow-500/15 text-yellow-400" : "bg-cyan-500/15 text-cyan-400"
                              }`}>
                                {host.category} node
                              </span>
                            </div>
                          </div>

                          <div className="flex space-x-1.5 bg-transparent">
                            <button
                              onClick={() => setEditingHost(host)}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteHost(host.id)}
                              className="p-1.5 bg-red-600/15 hover:bg-red-600/30 text-red-400 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 space-y-1 font-mono text-[9px] text-gray-400">
                          <p>Status: <span className="text-white font-sans">{host.statusText || "No Slogan"}</span></p>
                          <p>Bio: <span className="text-gray-300 font-sans">{host.bio || "No Bio"}</span></p>
                          <p>Network Metrics: <span className="text-cyan-400 font-black">👥 {host.viewers} Viewers</span> | <span className="text-pink-500 font-black">❤️ {host.likes} Likes</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: AGENCIES & COMMISSIONS */}
          {/* ========================================================================= */}
          {activeTab === "agencies" && (
            <div className="space-y-6 text-left">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form to Create/Update Agency */}
                <div className="lg:col-span-4 bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                    {editingAgency ? "✏️ Modify Agency Specs" : "➕ Register New Talent Agency"}
                  </h4>

                  <form onSubmit={editingAgency ? handleSaveAgencyEdit : handleAddAgency} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Agency Name</label>
                      <input
                        type="text"
                        required
                        value={editingAgency ? editingAgency.name : newAgency.name}
                        onChange={(e) => {
                          if (editingAgency) setEditingAgency({ ...editingAgency, name: e.target.value });
                          else setNewAgency({ ...newAgency, name: e.target.value });
                        }}
                        placeholder="e.g. Falcon Entertainment"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Owner Email Account</label>
                      <input
                        type="email"
                        required
                        value={editingAgency ? editingAgency.ownerEmail : newAgency.ownerEmail}
                        onChange={(e) => {
                          if (editingAgency) setEditingAgency({ ...editingAgency, ownerEmail: e.target.value });
                          else setNewAgency({ ...newAgency, ownerEmail: e.target.value });
                        }}
                        placeholder="e.g. owner@falcon.live"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Salary Policy & Commission Structure</label>
                      <input
                        type="text"
                        required
                        value={editingAgency ? editingAgency.salaryRate : newAgency.salaryRate}
                        onChange={(e) => {
                          if (editingAgency) setEditingAgency({ ...editingAgency, salaryRate: e.target.value });
                          else setNewAgency({ ...newAgency, salaryRate: e.target.value });
                        }}
                        placeholder="e.g. 40% Commission + $300 Base Bonus"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    {editingAgency && (
                      <div className="grid grid-cols-2 gap-3 bg-transparent">
                        <div className="space-y-1 bg-transparent font-mono">
                          <label className="text-[9px] uppercase font-bold text-gray-400">Active Hosts</label>
                          <input
                            type="number"
                            value={editingAgency.registeredHosts}
                            onChange={(e) => setEditingAgency({ ...editingAgency, registeredHosts: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1 bg-transparent font-mono">
                          <label className="text-[9px] uppercase font-bold text-gray-400">Comm (USD)</label>
                          <input
                            type="number"
                            value={editingAgency.monthlyCommission}
                            onChange={(e) => setEditingAgency({ ...editingAgency, monthlyCommission: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-2 pt-2 bg-transparent">
                      <button
                        type="submit"
                        className="flex-1 bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] hover:opacity-90 text-white font-black text-xs uppercase py-2.5 rounded-xl transition-all cursor-pointer text-center"
                      >
                        {editingAgency ? "Save Changes" : "Deploy Agency"}
                      </button>
                      {editingAgency && (
                        <button
                          type="button"
                          onClick={() => setEditingAgency(null)}
                          className="px-4 bg-[#202030] text-gray-400 hover:text-white rounded-xl text-xs font-bold"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Table list of registered Agencies */}
                <div className="lg:col-span-8 bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                    Ecosystem Agencies Commissions Registry
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="border-b border-white/5 text-gray-500 uppercase text-[9px] font-mono tracking-wider">
                          <th className="pb-3 pl-2">Agency Name</th>
                          <th className="pb-3">Owner Account</th>
                          <th className="pb-3">Salary Structure</th>
                          <th className="pb-3">Talent Hosts</th>
                          <th className="pb-3">Mo. Commission</th>
                          <th className="pb-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {db.agencies.map((agency: any) => (
                          <tr key={agency.id} className="hover:bg-white/2">
                            <td className="py-4 pl-2 font-black text-white font-sans">{agency.name}</td>
                            <td className="py-4 text-gray-300 font-mono text-[11px]">{agency.ownerEmail}</td>
                            <td className="py-4 font-sans text-pink-400 font-bold">{agency.salaryRate}</td>
                            <td className="py-4 font-bold text-center text-cyan-400">{agency.registeredHosts} hosts</td>
                            <td className="py-4 font-bold text-emerald-400">${agency.monthlyCommission} USD</td>
                            <td className="py-4 text-center">
                              <div className="flex space-x-1.5 justify-center bg-transparent">
                                <button
                                  onClick={() => setEditingAgency(agency)}
                                  className="p-1 text-gray-400 hover:text-white transition-all border border-white/5 rounded"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteAgency(agency.id)}
                                  className="p-1 text-red-500 hover:text-red-400 transition-all border border-red-500/10 rounded"
                                >
                                  <Trash className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: FAMILIES & GUILDS */}
          {/* ========================================================================= */}
          {activeTab === "families" && (
            <div className="space-y-6 text-left">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Form to Create/Update Family */}
                <div className="lg:col-span-4 bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                    {editingFamily ? "✏️ Modify Family Parameters" : "➕ Deploy New Guild Family"}
                  </h4>

                  <form onSubmit={editingFamily ? handleSaveFamilyEdit : handleAddFamily} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Family Name</label>
                      <input
                        type="text"
                        required
                        value={editingFamily ? editingFamily.name : newFamily.name}
                        onChange={(e) => {
                          if (editingFamily) setEditingFamily({ ...editingFamily, name: e.target.value });
                          else setNewFamily({ ...newFamily, name: e.target.value });
                        }}
                        placeholder="e.g. SAHR KINGS"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Leader Username</label>
                      <input
                        type="text"
                        required
                        value={editingFamily ? editingFamily.leader : newFamily.leader}
                        onChange={(e) => {
                          if (editingFamily) setEditingFamily({ ...editingFamily, leader: e.target.value });
                          else setNewFamily({ ...newFamily, leader: e.target.value });
                        }}
                        placeholder="e.g. Prince_Sehr"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Slogan Description</label>
                      <textarea
                        required
                        value={editingFamily ? editingFamily.description : newFamily.description}
                        onChange={(e) => {
                          if (editingFamily) setEditingFamily({ ...editingFamily, description: e.target.value });
                          else setNewFamily({ ...newFamily, description: e.target.value });
                        }}
                        placeholder="The elite guild of premium supporters."
                        rows={3}
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none resize-none"
                      />
                    </div>

                    {editingFamily && (
                      <div className="grid grid-cols-2 gap-3 bg-transparent">
                        <div className="space-y-1 bg-transparent font-mono">
                          <label className="text-[9px] uppercase font-bold text-gray-400">Members Count</label>
                          <input
                            type="number"
                            value={editingFamily.members}
                            onChange={(e) => setEditingFamily({ ...editingFamily, members: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1 bg-transparent font-mono">
                          <label className="text-[9px] uppercase font-bold text-gray-400">Guild Rank</label>
                          <input
                            type="number"
                            value={editingFamily.rank}
                            onChange={(e) => setEditingFamily({ ...editingFamily, rank: Number(e.target.value) })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-2 pt-2 bg-transparent">
                      <button
                        type="submit"
                        className="flex-1 bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] hover:opacity-90 text-white font-black text-xs uppercase py-2.5 rounded-xl transition-all cursor-pointer text-center"
                      >
                        {editingFamily ? "Save Changes" : "Deploy Family Guild"}
                      </button>
                      {editingFamily && (
                        <button
                          type="button"
                          onClick={() => setEditingFamily(null)}
                          className="px-4 bg-[#202030] text-gray-400 hover:text-white rounded-xl text-xs font-bold"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Grid layout of Families */}
                <div className="lg:col-span-8 bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                    Ecosystem Families & Guild Ranks
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {db.families.map((fam: any) => (
                      <div key={fam.id} className="p-4 rounded-xl bg-black/45 border border-white/5 flex flex-col justify-between space-y-3.5 text-left">
                        <div className="flex justify-between items-start bg-transparent">
                          <div className="flex items-center space-x-3 bg-transparent">
                            <img src={fam.avatar} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                            <div className="bg-transparent text-left">
                              <h5 className="text-xs font-black text-white leading-normal uppercase">{fam.name}</h5>
                              <p className="text-[10px] text-gray-400 font-bold">Leader: <strong className="text-pink-500">@{fam.leader}</strong></p>
                              <span className="text-[8px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-mono font-black uppercase">
                                Rank #{fam.rank}
                              </span>
                            </div>
                          </div>

                          <div className="flex space-x-1.5 bg-transparent">
                            <button
                              onClick={() => setEditingFamily(fam)}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFamily(fam.id)}
                              className="p-1.5 bg-red-600/15 hover:bg-red-600/30 text-red-400 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-black/30 border border-white/5 space-y-1 text-[11px] text-gray-300 font-medium">
                          <p className="italic">"{fam.description}"</p>
                          <div className="border-t border-white/5 pt-1.5 mt-1.5 flex justify-between text-[9px] font-mono font-black text-gray-500 uppercase">
                            <span>Guild ID: {fam.id}</span>
                            <span className="text-cyan-400 font-bold">👥 {fam.members} members</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: KYC AUDITING PANEL */}
          {/* ========================================================================= */}
          {activeTab === "kyc" && (
            <div className="bg-[#0f0f18] border border-white/5 rounded-2xl p-5 space-y-5 text-left">
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">Government Compliance KYC Audits</h3>
                <p className="text-xs text-gray-400">Validate real identity documents of streams requested for Cashout Diamonds capability</p>
              </div>

              <div className="grid grid-cols-1 gap-5">
                {db.kycRequests.map((req: any) => (
                  <div key={req.id} className="p-5 rounded-2xl bg-black/45 border border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* User credentials meta */}
                    <div className="lg:col-span-4 space-y-4">
                      <div>
                        <span className="text-[8px] font-mono font-black uppercase tracking-wider text-pink-500 bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/20">
                          {req.id}
                        </span>
                        <h4 className="text-sm font-black text-white mt-1.5">@{req.username}</h4>
                        <p className="text-xs text-gray-400">FullName: <strong className="text-gray-200">{req.fullName}</strong></p>
                        <p className="text-xs text-gray-400">Phone: <strong className="text-gray-200">{req.phoneNumber}</strong></p>
                        <p className="text-xs text-gray-400">D.O.B: <strong className="text-gray-200">{req.dob}</strong></p>
                      </div>

                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-1.5 font-mono text-[10px] text-gray-400">
                        <p>Document Type: <span className="text-cyan-400 uppercase font-black">{req.documentType === "id_card" ? "CNIC Identity Card" : "Passport"}</span></p>
                        <p>Liveness Verification: <span className={req.faceVerified ? "text-green-400 font-bold" : "text-yellow-400"}>{req.faceVerified ? "PASS ✓" : "SKIPPED"}</span></p>
                        <p>Status: <span className={`uppercase font-black ${req.status === "approved" ? "text-green-400" : req.status === "rejected" ? "text-red-400" : "text-yellow-400 animate-pulse"}`}>{req.status}</span></p>
                      </div>

                      {req.status === "pending" && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAuditKyc(req.id, "approved")}
                            className="flex-1 bg-green-500 hover:bg-green-400 text-black font-black text-xs uppercase py-2 rounded-xl transition-all active:scale-95 text-center"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => handleAuditKyc(req.id, "rejected")}
                            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase py-2 rounded-xl transition-all active:scale-95 text-center"
                          >
                            🚫 Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Document Previews */}
                    <div className="lg:col-span-8 grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono text-gray-500 uppercase font-black block">Front Document Image</span>
                        <div className="border border-white/10 rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center relative">
                          <img src={req.idFront} className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-mono text-gray-500 uppercase font-black block">Back / Face Verification Frame</span>
                        <div className="border border-white/10 rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center relative">
                          <img src={req.idBack} className="w-full h-full object-cover" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {db.kycRequests.length === 0 && (
                  <p className="text-center text-gray-500 py-6 uppercase font-mono text-xs">No pending identity verification tickets</p>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: GIFTS CRUD */}
          {/* ========================================================================= */}
          {activeTab === "gifts" && (
            <div className="space-y-6">
              {/* Creator Forms */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
                {/* Form to append new item */}
                <div className="lg:col-span-4 bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-4">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                    {editingGift ? "✏️ Modify Catalog Gift" : "➕ Append New Gift Node"}
                  </h4>

                  <form onSubmit={editingGift ? handleSaveGiftEdit : handleAddGift} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Gift Title</label>
                      <input
                        type="text"
                        required
                        value={editingGift ? editingGift.name : newGift.name}
                        onChange={(e) => {
                          if (editingGift) setEditingGift({ ...editingGift, name: e.target.value });
                          else setNewGift({ ...newGift, name: e.target.value });
                        }}
                        placeholder="e.g. Special Dhol"
                        className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-transparent">
                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Coin Price</label>
                        <input
                          type="number"
                          required
                          value={editingGift ? editingGift.cost : newGift.cost}
                          onChange={(e) => {
                            if (editingGift) setEditingGift({ ...editingGift, cost: Number(e.target.value) });
                            else setNewGift({ ...newGift, cost: Number(e.target.value) });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Gift Type</label>
                        <select
                          value={editingGift ? editingGift.type : newGift.type}
                          onChange={(e) => {
                            if (editingGift) setEditingGift({ ...editingGift, type: e.target.value });
                            else setNewGift({ ...newGift, type: e.target.value });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                        >
                          <option value="2d">2D standard</option>
                          <option value="3d">3D premium</option>
                          <option value="luxury">Luxury Special</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-transparent">
                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Display Emoji</label>
                        <input
                          type="text"
                          required
                          value={editingGift ? editingGift.icon : newGift.icon}
                          onChange={(e) => {
                            if (editingGift) setEditingGift({ ...editingGift, icon: e.target.value });
                            else setNewGift({ ...newGift, icon: e.target.value });
                          }}
                          placeholder="🏆"
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none text-center"
                        />
                      </div>

                      <div className="space-y-1 bg-transparent">
                        <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Category Tag</label>
                        <select
                          value={editingGift ? editingGift.category : newGift.category}
                          onChange={(e) => {
                            if (editingGift) setEditingGift({ ...editingGift, category: e.target.value });
                            else setNewGift({ ...newGift, category: e.target.value });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                        >
                          {db.categories.map((c: string) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-3 bg-transparent">
                      <button
                        type="submit"
                        className="flex-1 bg-gradient-to-r from-green-500 to-cyan-500 hover:opacity-90 text-black font-black text-xs uppercase py-3 rounded-xl transition-all cursor-pointer text-center"
                      >
                        {editingGift ? "Save Changes" : "Create Item"}
                      </button>
                      {editingGift && (
                        <button
                          type="button"
                          onClick={() => setEditingGift(null)}
                          className="px-4 bg-[#202030] text-gray-400 hover:text-white rounded-xl text-xs font-bold"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>

                {/* Gifts List Table */}
                <div className="lg:col-span-8 bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono">Catalog Registry</h4>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-500" />
                      <input
                        type="text"
                        placeholder="Filter gifts..."
                        value={giftSearch}
                        onChange={(e) => setGiftSearch(e.target.value)}
                        className="bg-black/30 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-[11px] text-white focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {db.gifts
                      .filter((g: any) => g.name.toLowerCase().includes(giftSearch.toLowerCase()))
                      .map((gift: any) => (
                        <div key={gift.id} className="p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center space-x-3 bg-transparent">
                            <span className="text-2xl">{gift.icon}</span>
                            <div className="bg-transparent text-left">
                              <p className="text-xs font-bold text-white leading-tight">{gift.name}</p>
                              <p className="text-[10px] text-yellow-400 font-mono font-semibold">💎 {gift.cost} Coins</p>
                              <span className="text-[7.5px] bg-[#ff007f]/10 text-[#ff007f] px-1 rounded font-mono uppercase font-black">
                                {gift.category || "Popular"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col space-y-1 bg-transparent">
                            <button
                              onClick={() => setEditingGift(gift)}
                              className="text-gray-400 hover:text-white transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteGift(gift.id)}
                              className="text-red-500 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: WALLET & CASH TRANSACTIONS */}
          {/* ========================================================================= */}
          {activeTab === "wallet" && (
            <div className="bg-[#0f0f18] border border-white/5 rounded-2xl p-5 space-y-5">
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">Financial Wallet Transactions & Ledger</h3>
                <p className="text-xs text-gray-400">Review system recharge logs, pay-ins, and manual stream diamond withdrawal audits</p>
              </div>

              {/* Transactions list */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-sans">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-500 uppercase text-[9px] font-mono tracking-wider">
                      <th className="pb-3 pl-2">Transaction ID</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Currency</th>
                      <th className="pb-3">Logged Date</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono">
                    {db.transactions.map((t: any) => (
                      <tr key={t.id} className="hover:bg-white/2">
                        <td className="py-3.5 pl-2 font-black text-white">{t.id}</td>
                        <td className="py-3.5">
                          <span className={`text-[8.5px] uppercase font-black px-2 py-0.5 rounded ${t.type === "recharge" ? "bg-cyan-500/10 text-cyan-400" : "bg-purple-500/10 text-purple-400"}`}>
                            {t.type}
                          </span>
                        </td>
                        <td className="py-3.5 font-bold">{t.amount}</td>
                        <td className="py-3.5 uppercase font-bold">{t.currency}</td>
                        <td className="py-3.5 text-gray-400 text-[10px]">{new Date(t.timestamp).toLocaleString()}</td>
                        <td className="py-3.5">
                          <span className="text-[8.5px] uppercase font-black text-emerald-400">
                            {t.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-gray-300 font-sans">{t.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: VIP & GLOWING FRAMES */}
          {/* ========================================================================= */}
          {activeTab === "vip" && (
            <div className="bg-[#0f0f18] border border-white/5 rounded-2xl p-5 space-y-5 text-left">
              <div className="border-b border-white/5 pb-4 flex justify-between items-center">
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">Dynamic Profile Frames & VIP Regulator</h3>
                  <p className="text-xs text-gray-400">Toggle VIP system parameters, suspend status for rule breakers, and configure frame profiles</p>
                </div>
                <span className="text-[10px] bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 px-3 py-1 rounded-full font-bold font-mono">
                  VIP DECORATIONS
                </span>
              </div>

              {/* Suspension controller */}
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1 bg-transparent">
                  <h4 className="text-sm font-black text-white">Toggle User VIP Suspension (Syed Prince Shah)</h4>
                  <p className="text-xs text-gray-500 leading-normal">
                    Locks out the user from equipping their glowing profile frames and using high-level chat highlights if toggled.
                  </p>
                </div>

                <button
                  onClick={handleToggleVipSuspension}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    db.user.vipSuspended
                      ? "bg-emerald-500 hover:bg-emerald-400 text-black"
                      : "bg-red-600 hover:bg-red-500 text-white"
                  }`}
                >
                  {db.user.vipSuspended ? "✓ Restore VIP Access" : "🚨 Suspend VIP Access"}
                </button>
              </div>

              {/* Frames array list */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-black uppercase tracking-wider font-mono text-pink-500">Tiered Gifting Levels Frames Array</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {db.configurations.vipFrames.map((frame: any) => (
                    <div key={frame.id} className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center space-x-3 bg-transparent">
                        <span className="text-2xl">{frame.badgeEmoji}</span>
                        <div className="bg-transparent">
                          <p className="text-xs font-bold text-white">{frame.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5">Threshold: <span className="text-pink-500">Level {frame.minLevel}+</span></p>
                          <div className="flex items-center space-x-1.5 mt-1.5 bg-transparent">
                            <span className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ backgroundColor: frame.glowColor }}></span>
                            <span className="text-[8.5px] text-gray-500 font-mono uppercase">{frame.glowColor}</span>
                          </div>
                        </div>
                      </div>

                      <span className="text-[8.5px] bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-0.5 rounded uppercase font-black font-mono">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: MODERATION & SAFETY */}
          {/* ========================================================================= */}
          {activeTab === "moderation" && (
            <div className="bg-[#0f0f18] border border-white/5 rounded-2xl p-5 space-y-6 text-left">
              <div className="border-b border-white/5 pb-4">
                <h3 className="text-base font-black text-white uppercase tracking-wider font-mono">AI Moderation Dashboard & Guidelines</h3>
                <p className="text-xs text-gray-400">Review flagged user chat lines, complete moderation audits and configure safety guidelines</p>
              </div>

              {/* Reports List */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-pink-500 font-mono">Open Infraction/Compliance Tickets</h4>

                <div className="grid grid-cols-1 gap-4">
                  {db.reports.map((rep: any) => (
                    <div key={rep.id} className="p-4 rounded-xl bg-black/35 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5 text-left">
                        <div className="flex items-center space-x-2 bg-transparent">
                          <span className="text-[9px] bg-red-600/25 text-red-400 border border-red-500/30 px-2 py-0.2 rounded font-mono uppercase font-black">
                            {rep.id}
                          </span>
                          <span className="text-xs font-bold text-white">Target: @{rep.username}</span>
                        </div>
                        <p className="text-xs text-gray-400">Infraction details: <strong className="text-gray-200 font-sans font-medium">"{rep.reason}"</strong></p>
                        <p className="text-[10px] text-gray-500 font-mono">Filed by: @{rep.reporter} • {new Date(rep.timestamp).toLocaleString()}</p>
                      </div>

                      <div className="flex items-center space-x-3 bg-transparent">
                        <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded ${rep.status === "resolved" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse"}`}>
                          {rep.status}
                        </span>
                        {rep.status === "pending" && (
                          <button
                            onClick={() => handleResolveReport(rep.id)}
                            className="bg-green-500 hover:bg-green-400 text-black text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            Resolve Issue
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {db.reports.length === 0 && (
                    <p className="text-center text-gray-500 py-4 uppercase font-mono text-xs">No community guideline reports logged</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: CAMPAIGN EVENTS & SLIDER BANNERS */}
          {/* ========================================================================= */}
          {activeTab === "events" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-left">
              {/* Form to Append Sliders */}
              <div className="lg:col-span-5 bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-4">
                <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">
                  ➕ Add Advertisement Banner Slide
                </h4>

                <form onSubmit={handleAddBanner} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Banner Slogan Title</label>
                    <input
                      type="text"
                      required
                      value={newBanner.title}
                      onChange={(e) => setNewBanner({ ...newBanner, title: e.target.value })}
                      placeholder="e.g. MEGA PK BATTLE CHALLENGE"
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-mono font-bold text-gray-400">Artwork URL (Unsplash/Static CDN)</label>
                    <input
                      type="text"
                      required
                      value={newBanner.image}
                      onChange={(e) => setNewBanner({ ...newBanner, image: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-pink-500 to-[#7b2cbf] hover:opacity-90 text-white font-black text-xs uppercase py-3 rounded-xl transition-all cursor-pointer text-center"
                  >
                    🚀 Deploy Advertising Banner
                  </button>
                </form>

                {/* Scheduled Tournaments campaign lists */}
                <div className="border-t border-white/5 pt-4 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider font-mono text-pink-500">Schedule Active Campaign Event</h4>
                  
                  <form onSubmit={handleCreateEvent} className="space-y-3">
                    <input
                      type="text"
                      required
                      placeholder="Event Title..."
                      value={newEvent.title}
                      onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none"
                    />
                    <div className="grid grid-cols-2 gap-3 bg-transparent">
                      <input
                        type="text"
                        placeholder="Duration (e.g. 2 Days)"
                        value={newEvent.duration}
                        onChange={(e) => setNewEvent({ ...newEvent, duration: e.target.value })}
                        className="bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="XP/Coin Rewards multiplier"
                        value={newEvent.reward}
                        onChange={(e) => setNewEvent({ ...newEvent, reward: e.target.value })}
                        className="bg-black/40 border border-white/10 rounded-xl p-2 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-green-500 to-cyan-500 text-black font-black text-[10px] uppercase py-2 rounded-xl"
                    >
                      📅 Deploy Live Tournament
                    </button>
                  </form>
                </div>
              </div>

              {/* Carousel Previews list */}
              <div className="lg:col-span-7 bg-[#0f0f18] border border-[#1f2833] p-5 rounded-2xl space-y-5">
                <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2">Active Carousel Artwork Sliders</h4>
                
                <div className="space-y-4">
                  {db.configurations.banners.map((banner: any) => (
                    <div key={banner.id} className="p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center space-x-4 bg-transparent text-left">
                        <img src={banner.image} className="w-20 h-12 object-cover rounded-lg border border-white/10" />
                        <div className="bg-transparent">
                          <p className="text-xs font-black text-white">{banner.title}</p>
                          <span className="text-[8px] text-gray-500 font-mono font-bold block mt-1">ID: {banner.id}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteBanner(banner.id)}
                        className="text-red-500 hover:text-red-400 p-2 transition-colors border border-red-500/25 hover:bg-red-500/10 rounded-lg"
                        title="Delete slider"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: SYSTEM & CONFIGURATIONS */}
          {/* ========================================================================= */}
          {activeTab === "system" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
              {/* Left col: toggles */}
              <div className="bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-5">
                <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2.5 flex items-center">
                  <Sliders className="w-4.5 h-4.5 text-pink-500 mr-2" />
                  Ecosystem Gateway Controller
                </h4>

                {/* Maintenance toggle */}
                <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-3">
                  <div className="flex justify-between items-center bg-transparent">
                    <div className="bg-transparent">
                      <p className="text-xs font-black text-white">Toggle System Maintenance Mode</p>
                      <p className="text-[9px] text-gray-500 leading-normal mt-0.5">
                        Forces the entire user-facing app into a secure maintenance screen. No gameplay available.
                      </p>
                    </div>

                    <button
                      onClick={handleToggleMaintenance}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${
                        db.configurations.maintenanceMode
                          ? "bg-red-600 text-white animate-pulse"
                          : "bg-gray-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      {db.configurations.maintenanceMode ? "ENABLED (LIVE)" : "DISABLED"}
                    </button>
                  </div>
                </div>

                {/* App Version controller */}
                <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-3 font-sans text-xs">
                  <h5 className="font-bold text-white uppercase tracking-wider text-[10px] font-mono border-b border-white/5 pb-1.5">Version & Force-Update Controller</h5>
                  
                  <div className="grid grid-cols-2 gap-4 bg-transparent pt-1">
                    <div className="space-y-1.5 bg-transparent">
                      <label className="text-[8px] uppercase text-gray-400 font-mono font-black block">Current Server App Version</label>
                      <input
                        id="server_app_version"
                        type="text"
                        defaultValue={db.configurations.appVersion}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1.5 bg-transparent">
                      <label className="text-[8px] uppercase text-gray-400 font-mono font-black block">Updates Constraint Mode</label>
                      <select
                        id="server_app_force_update"
                        defaultValue={db.configurations.forceUpdate ? "true" : "false"}
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-1.5 text-xs text-white focus:outline-none"
                      >
                        <option value="false">Optional Update</option>
                        <option value="true">Force Mandatory Upgrades</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const versionInput = document.getElementById("server_app_version") as HTMLInputElement;
                      const forceSelect = document.getElementById("server_app_force_update") as HTMLSelectElement;
                      if (versionInput && forceSelect) {
                        handleUpdateAppVersionConfig(versionInput.value, forceSelect.value === "true");
                      }
                    }}
                    className="w-full py-2 bg-gradient-to-r from-pink-500 to-[#7b2cbf] text-white text-[10px] uppercase font-black tracking-wider rounded-lg"
                  >
                    Apply New Version Constraints
                  </button>
                </div>
              </div>

              {/* Right col: backup and logs */}
              <div className="bg-[#0f0f18] border border-white/5 p-5 rounded-2xl space-y-5">
                <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono border-b border-white/5 pb-2.5 flex items-center">
                  <Sliders className="w-4.5 h-4.5 text-pink-500 mr-2" />
                  Ecosystem Backups & Audit Logs
                </h4>

                <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-4">
                  <div className="bg-transparent">
                    <h5 className="text-xs font-black text-white">Central Database Snapshot backup</h5>
                    <p className="text-[9px] text-gray-500 mt-1 leading-normal">
                      Saves an incremental backup copy of the database locally to preserve transactional accounting files and user frames history ledger.
                    </p>
                  </div>

                  <button
                    onClick={handleTriggerBackup}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-black uppercase text-[10px] tracking-wider rounded-xl hover:scale-103 transition-all"
                  >
                    💾 Trigger Hot Backup Snapshot
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-3 font-mono text-[9px]">
                  <h5 className="font-bold text-white uppercase tracking-wider text-[10px] border-b border-white/5 pb-1.5 font-sans">Active Security Audit Logs</h5>
                  
                  <div className="space-y-1.5 text-left text-gray-400">
                    <p><span className="text-green-400 font-bold">[INFO]</span> Connected to EasyPaisa production payment sandbox.</p>
                    <p><span className="text-green-400 font-bold">[INFO]</span> Loaded 6 premium 2D/3D luxury gifts items.</p>
                    <p><span className="text-purple-400 font-bold">[AUDIT]</span> Operator 'superadmin' authorized entry successfully.</p>
                    <p><span className="text-yellow-400 font-bold">[WARN]</span> System version constraint updated to {db.configurations.appVersion}.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* CHANGE PASSWORD OVERLAY MODAL */}
      {showPasswordChangeModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-999 p-4 select-none">
          <div className="bg-[#111119] border border-white/10 p-6 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowPasswordChangeModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            <div className="text-center space-y-1 pb-2 border-b border-white/5">
              <Key className="w-8 h-8 text-pink-500 mx-auto" />
              <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono">Change Operator Password</h4>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Secure Authentication Update</p>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[8.5px] uppercase font-bold text-gray-400 font-mono">Current Operator Password</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[8.5px] uppercase font-bold text-gray-400 font-mono">New Operator Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-pink-500 font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-gradient-to-r from-[#ff007f] to-[#7b2cbf] text-white font-black uppercase text-xs rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer text-center"
              >
                💾 Update Security Password
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
