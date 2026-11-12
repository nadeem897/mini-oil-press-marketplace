import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, Search, Phone, MessageSquare, ShieldCheck, MapPin, 
  Zap, Gauge, Filter, SlidersHorizontal, RotateCcw, Plus, 
  Edit3, Trash2, CheckCircle2, XCircle, Clock, Eye, 
  ChevronRight, ArrowLeft, Menu, X, Building2, 
  Sparkles, LogIn, LogOut, Loader2, Calculator, Users, Award, Mail
} from 'lucide-react';

import { useAuth } from './context/AuthContext';
import { Machine, MachineType, MachineStatus, SellerProfile, Enquiry, SEED_YIELD_GUIDE } from './types';
import { 
  getPublishedMachines, 
  getSellerMachines, 
  getAllMachinesForAdmin, 
  createMachine, 
  updateMachine, 
  deleteMachine, 
  setMachineStatus, 
  submitEnquiry, 
  getSellerEnquiries,
  getSellerProfile,
  seedFirestoreDatabaseIfEmpty 
} from './services/api';

type ActiveScreen = 
  | 'home' 
  | 'machines' 
  | 'machine_detail' 
  | 'seller_profile' 
  | 'seller_dashboard' 
  | 'admin_dashboard' 
  | 'about' 
  | 'contact';

export default function App() {
  const { firebaseUser, appUser, sellerProfile, isAdmin, isSeller, loginEmail, loginGoogle, registerSeller, logout } = useAuth();

  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [publicSeller, setPublicSeller] = useState<SellerProfile | null>(null);
  const [sellerEnquiries, setSellerEnquiries] = useState<Enquiry[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<number>(100000);
  const [minCapacity, setMinCapacity] = useState<number>(0);
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'capacity_desc'>('price_asc');

  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [enquirySeed, setEnquirySeed] = useState('Groundnut');
  const [enquirySending, setEnquirySending] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState(false);

  const [calcSeed, setCalcSeed] = useState(SEED_YIELD_GUIDE[0].seed);
  const [calcInputKg, setCalcInputKg] = useState<number>(10);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeScreen === 'admin_dashboard' && isAdmin) {
        const data = await getAllMachinesForAdmin();
        setMachines(data);
      } else if (activeScreen === 'seller_dashboard' && firebaseUser) {
        const data = await getSellerMachines(firebaseUser.uid);
        setMachines(data);
        const leads = await getSellerEnquiries(firebaseUser.uid);
        setSellerEnquiries(leads);
      } else {
        let publicList = await getPublishedMachines();
        if (publicList.length === 0) {
          publicList = await seedFirestoreDatabaseIfEmpty();
        }
        setMachines(publicList);
        if (publicList.length > 0 && !selectedMachineId) {
          setSelectedMachineId(publicList[0].id);
        }
      }
    } catch (err: any) {
      showToast('Error syncing with Firestore database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeScreen, firebaseUser, isAdmin]);

  useEffect(() => {
    if (activeScreen === 'seller_profile' && selectedSellerId) {
      getSellerProfile(selectedSellerId).then((profile) => {
        setPublicSeller(profile);
      });
    }
  }, [activeScreen, selectedSellerId]);

  const filteredMachines = useMemo(() => {
    return machines
      .filter((m) => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          (m.name || '').toLowerCase().includes(query) ||
          (m.description || '').toLowerCase().includes(query) ||
          (m.location || '').toLowerCase().includes(query) ||
          (m.compatibleSeeds || []).some(s => s.toLowerCase().includes(query));

        const matchesType = selectedType === 'all' || m.machineType === selectedType;
        const matchesPrice = m.price <= maxPrice;
        const matchesCapacity = m.capacityKgHr >= minCapacity;
        const matchesCity = selectedCity === 'all' || (m.location || '').toLowerCase().includes(selectedCity.toLowerCase());

        return matchesSearch && matchesType && matchesPrice && matchesCapacity && matchesCity;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.price - b.price;
        if (sortBy === 'price_desc') return b.price - a.price;
        if (sortBy === 'capacity_desc') return b.capacityKgHr - a.capacityKgHr;
        return 0;
      });
  }, [machines, searchQuery, selectedType, maxPrice, minCapacity, selectedCity, sortBy]);

  const currentMachine = useMemo(() => {
    return machines.find((m) => m.id === selectedMachineId) || machines[0] || null;
  }, [machines, selectedMachineId]);

  const activeSeedData = useMemo(() => {
    return SEED_YIELD_GUIDE.find((s) => s.seed === calcSeed) || SEED_YIELD_GUIDE[0];
  }, [calcSeed]);

  const estimatedOilLiters = useMemo(() => {
    const rawVal = parseFloat(activeSeedData.outOil.split(' ')[0]);
    return ((rawVal * calcInputKg) / 1000).toFixed(1);
  }, [activeSeedData, calcInputKg]);

  const handleSaveMachine = async (data: Partial<Machine>, file?: File | null) => {
    if (!firebaseUser) return;
    try {
      if (editingMachine) {
        await updateMachine(editingMachine.id, data, file);
        showToast('Listing updated and marked pending review.');
      } else {
        await createMachine(firebaseUser.uid, data, file);
        showToast('Machine submitted! Pending Admin Approval.');
      }
      setShowAddEditModal(false);
      setEditingMachine(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save listing.');
    }
  };

  const handleDeleteMachine = async (id: string) => {
    if (!window.confirm('Delete this listing permanently from database?')) return;
    try {
      await deleteMachine(id);
      setMachines((prev) => prev.filter((m) => m.id !== id));
      showToast('Machine listing removed.');
    } catch (err: any) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleModeration = async (id: string, status: 'published' | 'rejected') => {
    try {
      await setMachineStatus(id, status);
      setMachines((prev) => prev.map((m) => m.id === id ? { ...m, status } : m));
      showToast(`Machine status set to ${status}.`);
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMachine || !enquiryName.trim() || !enquiryPhone.trim()) return;

    if (enquiryPhone.replace(/\D/g, '').length < 10) {
      alert('Please enter a valid 10-digit phone or WhatsApp number.');
      return;
    }

    setEnquirySending(true);
    try {
      await submitEnquiry({
        machineId: currentMachine.id,
        machineName: currentMachine.name,
        sellerId: currentMachine.sellerId,
        buyerName: enquiryName.trim(),
        buyerPhone: enquiryPhone.trim(),
        targetSeed: enquirySeed,
        message: `Inquiry submitted via marketplace detail page for ${currentMachine.name}`,
      });

      setEnquirySuccess(true);
      showToast('Inquiry logged and sent directly to manufacturer!');
      setTimeout(() => {
        setEnquirySuccess(false);
        setEnquiryName('');
        setEnquiryPhone('');
      }, 4000);
    } catch (err: any) {
      alert('Error sending inquiry: ' + err.message);
    } finally {
      setEnquirySending(false);
    }
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setMaxPrice(100000);
    setMinCapacity(0);
    setSelectedCity('all');
    setSortBy('price_asc');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div onClick={() => setActiveScreen('home')} className="flex items-center gap-2.5 cursor-pointer select-none">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-slate-900 block leading-tight">
                  Telangana<span className="text-emerald-600">OilPress</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Machinery Marketplace
                </span>
              </div>
            </div>

            <nav className="hidden md:flex items-center space-x-7 text-sm font-semibold text-slate-600">
              <button onClick={() => setActiveScreen('home')} className={`hover:text-emerald-600 transition ${activeScreen === 'home' ? 'text-emerald-600 font-bold' : ''}`}>
                Home
              </button>
              <button onClick={() => setActiveScreen('machines')} className={`hover:text-emerald-600 transition ${activeScreen === 'machines' ? 'text-emerald-600 font-bold' : ''}`}>
                Browse Machines ({machines.filter(m => m.status === 'published').length})
              </button>
              <button onClick={() => setActiveScreen('about')} className={`hover:text-emerald-600 transition ${activeScreen === 'about' ? 'text-emerald-600 font-bold' : ''}`}>
                Market Guide
              </button>
              <button onClick={() => setActiveScreen('contact')} className={`hover:text-emerald-600 transition ${activeScreen === 'contact' ? 'text-emerald-600 font-bold' : ''}`}>
                Support Hub
              </button>
            </nav>

            <div className="hidden sm:flex items-center gap-3">
              {firebaseUser ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => setActiveScreen('seller_dashboard')} className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition">
                    Seller Dashboard
                  </button>
                  <button onClick={() => { setEditingMachine(null); setShowAddEditModal(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition">
                    <Plus className="w-3.5 h-3.5" /> List Machine
                  </button>
                  {isAdmin && (
                    <button onClick={() => setActiveScreen('admin_dashboard')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-xl transition">
                      <ShieldCheck className="w-4 h-4 text-amber-600" /> Admin
                    </button>
                  )}
                  <button onClick={logout} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-xl transition" title="Sign Out">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition">
                  <LogIn className="w-3.5 h-3.5" /> Seller Login / Register
                </button>
              )}
            </div>

            <div className="flex md:hidden">
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 rounded-xl text-slate-600 hover:bg-slate-100">
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-5 pt-3 pb-6 space-y-3">
            <button onClick={() => { setActiveScreen('home'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-sm font-semibold">Home</button>
            <button onClick={() => { setActiveScreen('machines'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-sm font-semibold">Browse Machines</button>
            <button onClick={() => { setActiveScreen('about'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-sm font-semibold">Market Guide</button>
            <button onClick={() => { setActiveScreen('contact'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-sm font-semibold">Support Hub</button>
            {firebaseUser ? (
              <>
                <button onClick={() => { setActiveScreen('seller_dashboard'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-sm font-semibold text-emerald-700">Seller Dashboard</button>
                {isAdmin && <button onClick={() => { setActiveScreen('admin_dashboard'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-sm font-semibold text-amber-700">Admin Panel</button>}
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-full text-center py-2.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl mt-2">Sign Out</button>
              </>
            ) : (
              <button onClick={() => { setShowAuthModal(true); setMobileMenuOpen(false); }} className="w-full text-center py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl mt-2">Seller Login / Register</button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">
        {activeScreen === 'home' && (
          <div className="space-y-16 pb-20">
            <section className="bg-gradient-to-b from-emerald-50/70 via-white to-white pt-12 sm:pt-20 pb-16 px-4 text-center border-b border-slate-200/80">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/80 text-emerald-900 text-xs font-bold border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                  Verified Equipment Fabricators in Hyderabad, Jeedimetla & Warangal
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight leading-[1.15]">
                  Discover Direct <span className="text-emerald-600">Mini Oil Press</span> Machines
                </h1>
                <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-600">
                  Connect directly with Telangana equipment fabricators. Compare crushing capacity (3 to 30 kg/hr), inspect SS304 food-grade parts, and chat on WhatsApp without agent commissions.
                </p>

                <div className="max-w-2xl mx-auto flex items-center bg-white p-2 rounded-2xl shadow-xl border border-slate-200">
                  <Search className="w-5 h-5 text-slate-400 ml-3 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setActiveScreen('machines'); }}
                    placeholder="Search seed (groundnut, mustard, coconut) or machine type..."
                    className="w-full px-3 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
                  />
                  <button onClick={() => setActiveScreen('machines')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl text-xs sm:text-sm transition shrink-0">
                    Search Models
                  </button>
                </div>
              </div>
            </section>

            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Featured Oil Expellers</h2>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">Ready for dispatch across Telangana & Andhra Pradesh</p>
                </div>
                <button onClick={() => setActiveScreen('machines')} className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-3.5 py-2 rounded-xl transition">
                  View All ({machines.filter(m => m.status === 'published').length}) →
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map(n => <div key={n} className="h-80 bg-slate-200 rounded-3xl animate-pulse" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {machines.filter(m => m.status === 'published').slice(0, 3).map((m) => (
                    <div key={m.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
                      <div onClick={() => { setSelectedMachineId(m.id); setActiveScreen('machine_detail'); }} className="cursor-pointer">
                        <div className="h-48 bg-slate-100 overflow-hidden relative">
                          <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                          <span className="absolute top-3 right-3 bg-white text-emerald-900 text-[11px] font-black px-2.5 py-1 rounded-lg shadow-sm">
                            {m.capacityKgHr} kg/hr
                          </span>
                        </div>
                        <div className="p-5 space-y-1.5">
                          <span className="text-[11px] text-slate-400 font-bold block">{m.location}</span>
                          <h3 className="font-extrabold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-emerald-700 transition">{m.name}</h3>
                          <p className="text-xs text-slate-500">Motor: {m.motorPower}</p>
                        </div>
                      </div>
                      <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between">
                        <span className="text-lg font-black text-emerald-700">₹{m.price.toLocaleString('en-IN')}</span>
                        <button onClick={() => { setSelectedMachineId(m.id); setActiveScreen('machine_detail'); }} className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl text-xs font-bold transition">
                          View Specs
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Dynamic Fallback: Screens automatically load here based on activeScreen */}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 px-4 mt-auto text-center text-xs text-slate-400">
        <p>© 2026 TelanganaOilPress Marketplace — Hyderabad, Telangana, India.</p>
      </footer>
    </div>
  );
}