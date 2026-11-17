import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench, Search, Phone, MessageSquare, ShieldCheck, MapPin,
  Zap, Gauge, Filter, SlidersHorizontal, RotateCcw, Plus,
  Edit3, Trash2, CheckCircle2, XCircle, Clock, Eye,
  ChevronRight, ArrowLeft, Menu, X, Building2,
  Sparkles, LogIn, LogOut, Loader2, Calculator, Users, Award, Mail,
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
  seedFirestoreDatabaseIfEmpty,
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
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    phone: '',
    businessName: '',
    password: '',
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [enquiryName, setEnquiryName] = useState('');
  const [enquiryPhone, setEnquiryPhone] = useState('');
  const [enquirySeed, setEnquirySeed] = useState('Groundnut');
  const [enquirySending, setEnquirySending] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState(false);

  const [calcSeed, setCalcSeed] = useState(SEED_YIELD_GUIDE[0].seed);
  const [calcInputKg, setCalcInputKg] = useState<number>(10);

  const afterAuthSuccess = (message: string) => {
    setShowAuthModal(false);
    setAuthForm({ name: '', email: '', phone: '', businessName: '', password: '' });
    setActiveScreen('seller_dashboard');
    showToast(message);
  };

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
          (m.compatibleSeeds || []).some((s) => s.toLowerCase().includes(query));

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

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!authForm.email || !authForm.password) {
      alert('Please enter email and password.');
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        await registerSeller(authForm.email, authForm.password, {
          businessName: authForm.businessName || authForm.name || 'My Business',
          contactPerson: authForm.name || 'Seller',
          phone: authForm.phone || '',
          city: 'Hyderabad',
          state: 'Telangana',
          workshopAddress: 'Address not added yet',
          businessDescription: 'Seller profile pending setup.',
        });
        afterAuthSuccess('Seller account created successfully.');
      } else {
        await loginEmail(authForm.email, authForm.password);
        afterAuthSuccess('Welcome back!');
      }
    } catch (err: any) {
      alert(err.message || 'Authentication failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    try {
      await loginGoogle();
      afterAuthSuccess('Signed in with Google successfully.');
    } catch (err: any) {
      alert(err.message || 'Google login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const renderHomeScreen = () => (
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
              placeholder="Search seed or machine type..."
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
            View All ({machines.filter((m) => m.status === 'published').length}) →
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => <div key={n} className="h-80 bg-slate-200 rounded-3xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {machines.filter((m) => m.status === 'published').slice(0, 3).map((m) => (
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
                  <button onClick={() => { setSelectedMachineId(m.id); setActiveScreen('machine_detail'); }} className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-bold rounded-xl transition">
                    View Specs
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const renderMachinesScreen = () => (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white border border-slate-200 rounded-3xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Search</label>
            <div className="mt-1 flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-transparent px-2 py-1 text-sm text-slate-700 focus:outline-none" placeholder="Search by seed, model, city" />
            </div>
          </div>

          <div className="w-full lg:w-48">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Type</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none">
              <option value="all">All types</option>
              <option value="domestic_cold_press">Domestic Cold Press</option>
              <option value="commercial_screw_press">Commercial Screw Press</option>
              <option value="hydraulic_press">Hydraulic Press</option>
              <option value="wooden_ghani_rotary">Wooden Ghani Rotary</option>
            </select>
          </div>

          <div className="w-full lg:w-40">
            <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Max Price</label>
            <input type="range" min={5000} max={100000} step={5000} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="mt-3 w-full accent-emerald-600" />
            <div className="text-xs text-slate-500 mt-1">₹{maxPrice.toLocaleString('en-IN')}</div>
          </div>

          <button onClick={resetAllFilters} className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold transition">
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredMachines.map((m) => (
          <div key={m.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition">
            <div onClick={() => { setSelectedMachineId(m.id); setActiveScreen('machine_detail'); }} className="cursor-pointer">
              <div className="h-52 overflow-hidden relative">
                <img src={m.imageUrl} alt={m.name} className="w-full h-full object-cover" />
                <span className="absolute top-3 right-3 bg-white text-emerald-900 text-[11px] font-black px-2.5 py-1 rounded-lg shadow-sm">{m.capacityKgHr} kg/hr</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-400 font-bold">{m.location}</span>
                  <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">{m.status}</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-lg">{m.name}</h3>
                <p className="text-xs text-slate-600 line-clamp-3">{m.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-slate-700">Motor: {m.motorPower}</span>
                  <span className="font-black text-emerald-700">₹{m.price.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderMachineDetailScreen = () => {
    if (!currentMachine) {
      return <div className="max-w-4xl mx-auto py-20 text-center text-slate-600">No machine selected.</div>;
    }

    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => setActiveScreen('machines')} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700 mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to machines
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
            <img src={currentMachine.imageUrl} alt={currentMachine.name} className="w-full h-[420px] object-cover" />
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-full">{currentMachine.machineType.replace(/_/g, ' ')}</span>
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{currentMachine.location}</span>
            </div>

            <h1 className="text-3xl font-black text-slate-900">{currentMachine.name}</h1>
            <p className="text-slate-600">{currentMachine.description}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Capacity</div>
                <div className="mt-2 text-xl font-black text-slate-900">{currentMachine.capacityKgHr} kg/hr</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Price</div>
                <div className="mt-2 text-xl font-black text-emerald-700">₹{currentMachine.price.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 border border-slate-200 p-5">
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-700">
                <div><span className="text-slate-400">Model:</span> <span className="font-bold">{currentMachine.modelNumber}</span></div>
                <div><span className="text-slate-400">Motor:</span> <span className="font-bold">{currentMachine.motorPower}</span></div>
                <div><span className="text-slate-400">Voltage:</span> <span className="font-bold">{currentMachine.voltage}</span></div>
                <div><span className="text-slate-400">Weight:</span> <span className="font-bold">{currentMachine.weightKg} kg</span></div>
                <div><span className="text-slate-400">Warranty:</span> <span className="font-bold">{currentMachine.warranty}</span></div>
                <div><span className="text-slate-400">Seeds:</span> <span className="font-bold">{currentMachine.compatibleSeeds.join(', ')}</span></div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => window.open(`https://wa.me/${currentMachine.sellerPhone || '919999999999'}?text=${encodeURIComponent(`Hi, I am interested in ${currentMachine.name}. Please share pricing and details.`)}`, '_blank')} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition">
                <MessageSquare className="w-4 h-4" /> WhatsApp Seller
              </button>
              <button onClick={() => setShowAuthModal(true)} className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold text-sm transition">
                <LogIn className="w-4 h-4" /> Login / Register
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-4">Send inquiry</h2>
            <form onSubmit={handleEnquirySubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input value={enquiryName} onChange={(e) => setEnquiryName(e.target.value)} placeholder="Your name" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none" />
                <input value={enquiryPhone} onChange={(e) => setEnquiryPhone(e.target.value)} placeholder="Phone / WhatsApp" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none" />
              </div>
              <select value={enquirySeed} onChange={(e) => setEnquirySeed(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none">
                {SEED_YIELD_GUIDE.map((seed) => <option key={seed.seed} value={seed.seed}>{seed.seed}</option>)}
              </select>
              <button disabled={enquirySending} type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-4 py-3 rounded-xl font-bold transition">
                {enquirySending ? 'Sending...' : 'Send Inquiry'}
              </button>
              {enquirySuccess && <div className="text-sm font-bold text-emerald-700">Inquiry sent successfully.</div>}
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-4">Yield calculator</h2>
            <div className="space-y-4">
              <select value={calcSeed} onChange={(e) => setCalcSeed(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none">
                {SEED_YIELD_GUIDE.map((seed) => <option key={seed.seed} value={seed.seed}>{seed.seed}</option>)}
              </select>
              <div className="flex items-center gap-3">
                <input type="number" min={1} max={1000} value={calcInputKg} onChange={(e) => setCalcInputKg(Number(e.target.value) || 0)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none" />
                <span className="text-sm text-slate-500">kg input</span>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-slate-700">
                <div className="font-bold text-emerald-900">Estimated oil yield</div>
                <div className="mt-2 text-2xl font-black text-emerald-700">{estimatedOilLiters} L</div>
                <div className="mt-1 text-xs text-slate-500">{activeSeedData.outOil} per kg</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSellerDashboard = () => (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Seller dashboard</h1>
          <p className="text-sm text-slate-500">Manage your listings and customer enquiries.</p>
        </div>
        <button onClick={() => { setEditingMachine(null); setShowAddEditModal(true); }} className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
          <Plus className="w-4 h-4" /> Add machine
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Listed machines</div>
          <div className="mt-3 text-3xl font-black text-slate-900">{machines.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Open enquiries</div>
          <div className="mt-3 text-3xl font-black text-slate-900">{sellerEnquiries.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Account</div>
          <div className="mt-3 text-lg font-black text-slate-900">{appUser?.displayName || appUser?.email || 'Seller'}</div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-5 py-3 font-bold">Machine</th>
                <th className="px-5 py-3 font-bold">Type</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Price</th>
                <th className="px-5 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id} className="border-t border-slate-200">
                  <td className="px-5 py-4 font-bold text-slate-800">{m.name}</td>
                  <td className="px-5 py-4 text-slate-600">{m.machineType.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-4"><span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1 text-[10px] font-bold uppercase">{m.status}</span></td>
                  <td className="px-5 py-4 font-black text-emerald-700">₹{m.price.toLocaleString('en-IN')}</td>
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button onClick={() => { setSelectedMachineId(m.id); setActiveScreen('machine_detail'); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => { setSelectedMachineId(m.id); setEditingMachine(m); setShowAddEditModal(true); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteMachine(m.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-black text-slate-900 mb-6">Admin dashboard</h1>

      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-5 py-3 font-bold">Machine</th>
              <th className="px-5 py-3 font-bold">Seller</th>
              <th className="px-5 py-3 font-bold">Status</th>
              <th className="px-5 py-3 font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="border-t border-slate-200">
                <td className="px-5 py-4 font-bold text-slate-800">{m.name}</td>
                <td className="px-5 py-4 text-slate-600">{m.sellerName || 'Seller'}</td>
                <td className="px-5 py-4"><span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 text-[10px] font-bold uppercase">{m.status}</span></td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button onClick={() => handleModeration(m.id, 'published')} className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg">Approve</button>
                    <button onClick={() => handleModeration(m.id, 'rejected')} className="px-3 py-1.5 bg-rose-50 text-rose-700 text-xs font-bold rounded-lg">Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAboutScreen = () => (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-black text-slate-900 mb-6">Market guide</h1>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <Gauge className="w-8 h-8 text-emerald-600" />
          <h3 className="mt-4 text-lg font-black text-slate-900">Capacity selection</h3>
          <p className="mt-2 text-sm text-slate-600">Choose models based on seed type, required output, and daily oil extraction needs.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <ShieldCheck className="w-8 h-8 text-emerald-600" />
          <h3 className="mt-4 text-lg font-black text-slate-900">Quality checks</h3>
          <p className="mt-2 text-sm text-slate-600">Look for SS304 material, food-grade finish, motor efficiency, and verified fabricators.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <Building2 className="w-8 h-8 text-emerald-600" />
          <h3 className="mt-4 text-lg font-black text-slate-900">Local support</h3>
          <p className="mt-2 text-sm text-slate-600">Use the direct marketplace to inspect machines and compare options before purchase.</p>
        </div>
      </div>
    </div>
  );

  const renderContactScreen = () => (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-black text-slate-900 mb-6">Support hub</h1>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-700 font-bold"><Phone className="w-5 h-5" /> +91 98765 43210</div>
          <div className="mt-4 flex items-center gap-3 text-slate-700 font-bold"><Mail className="w-5 h-5" /> support@telanganaoilpress.com</div>
          <div className="mt-4 flex items-center gap-3 text-slate-700 font-bold"><MapPin className="w-5 h-5" /> Hyderabad, Telangana</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Need help choosing a machine?</h3>
          <p className="mt-3 text-sm text-slate-600">Share your seed type, target output, and city. We can guide you to the best matching expeller and supplier.</p>
          <button onClick={() => setShowAuthModal(true)} className="mt-5 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition">
            <LogIn className="w-4 h-4" /> Login / Register
          </button>
        </div>
      </div>
    </div>
  );

  const renderSellerProfileScreen = () => (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-3xl font-black text-slate-900 mb-6">Seller profile</h1>
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">{publicSeller?.businessName || sellerProfile?.businessName || 'Business profile'}</h2>
            <p className="mt-1 text-sm text-slate-500">{publicSeller?.city || sellerProfile?.city || 'Hyderabad'}, {publicSeller?.state || sellerProfile?.state || 'Telangana'}</p>
          </div>
          <div className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-[10px] font-black uppercase">Verified</div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 text-sm text-slate-700">
          <div><span className="text-slate-500">Contact person:</span> <span className="font-bold">{publicSeller?.contactPerson || sellerProfile?.contactPerson || '-'}</span></div>
          <div><span className="text-slate-500">Phone:</span> <span className="font-bold">{publicSeller?.phone || sellerProfile?.phone || '-'}</span></div>
          <div className="md:col-span-2"><span className="text-slate-500">Address:</span> <span className="font-bold">{publicSeller?.workshopAddress || sellerProfile?.workshopAddress || '-'}</span></div>
          <div className="md:col-span-2"><span className="text-slate-500">Description:</span> <span className="font-bold">{publicSeller?.businessDescription || sellerProfile?.businessDescription || 'No business description provided yet.'}</span></div>
        </div>
      </div>
    </div>
  );

  const renderMainContent = () => {
    switch (activeScreen) {
      case 'machines':
        return renderMachinesScreen();
      case 'machine_detail':
        return renderMachineDetailScreen();
      case 'seller_profile':
        return renderSellerProfileScreen();
      case 'seller_dashboard':
        return renderSellerDashboard();
      case 'admin_dashboard':
        return renderAdminDashboard();
      case 'about':
        return renderAboutScreen();
      case 'contact':
        return renderContactScreen();
      case 'home':
      default:
        return renderHomeScreen();
    }
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
                Browse Machines ({machines.filter((m) => m.status === 'published').length})
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
                  <button onClick={() => { setEditingMachine(null); setShowAddEditModal(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition">
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
                <button onClick={() => setShowAuthModal(true)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-600/20 transition">
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
                {isAdmin && <button onClick={() => { setActiveScreen('admin_dashboard'); setMobileMenuOpen(false); }} className="block w-full text-left py-2 text-sm font-semibold text-amber-700">Admin</button>}
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="w-full text-center py-2.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-xl mt-2">Sign Out</button>
              </>
            ) : (
              <button onClick={() => { setShowAuthModal(true); setMobileMenuOpen(false); }} className="w-full text-center py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl mt-2">Seller Login / Register</button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{renderMainContent()}</main>

      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <div className="text-lg font-black text-slate-900">Seller Access</div>
                <div className="text-xs text-slate-500">Login or create a seller account</div>
              </div>
              <button onClick={() => setShowAuthModal(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 pt-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-100 rounded-2xl p-1">
                <button onClick={() => setAuthMode('login')} className={`py-2.5 rounded-xl text-sm font-bold transition ${authMode === 'login' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>
                  Login
                </button>
                <button onClick={() => setAuthMode('signup')} className={`py-2.5 rounded-xl text-sm font-bold transition ${authMode === 'signup' ? 'bg-white text-slate-900 shadow' : 'text-slate-500'}`}>
                  Sign Up
                </button>
              </div>
            </div>

            <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
              {authMode === 'signup' && (
                <>
                  <input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="Full name" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none" />
                  <input value={authForm.businessName} onChange={(e) => setAuthForm({ ...authForm, businessName: e.target.value })} placeholder="Business name" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none" />
                  <input value={authForm.phone} onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })} placeholder="Phone number" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none" />
                </>
              )}

              <input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="Email address" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none" required />
              <input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder="Password" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none" required />

              <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-3 rounded-xl font-bold transition">
                {authLoading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create Account'}
              </button>

              <button type="button" onClick={handleGoogleAuth} disabled={authLoading} className="w-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 py-3 rounded-xl font-bold transition">
                Continue with Google
              </button>
            </form>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-8 px-4 mt-auto text-center text-xs text-slate-400">
        <p>© 2026 TelanganaOilPress Marketplace — Hyderabad, Telangana, India.</p>
      </footer>
    </div>
  );
}
