import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  increment 
} from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signOut as fbSignOut, 
  User as FirebaseUser 
} from 'firebase/auth';

import { auth, db, googleProvider } from '../firebase/config';
import { AppUser, SellerProfile, Machine, Enquiry, UserRole } from '../types';
import { compressImageToBase64 } from '../utils/imageCompressor';

const USERS_COL = 'users';
const SELLERS_COL = 'seller_profiles';
const MACHINES_COL = 'machines';
const ENQUIRIES_COL = 'enquiries';

export async function syncUserProfile(user: FirebaseUser, defaultRole: UserRole = 'seller'): Promise<AppUser> {
  try {
    const ref = doc(db, USERS_COL, user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      return snap.data() as AppUser;
    }

    const newUser: AppUser = {
      uid: user.uid,
      email: user.email || '',
      role: defaultRole,
      displayName: user.displayName || user.email?.split('@')[0] || 'User',
      createdAt: new Date().toISOString(),
    };

    await setDoc(ref, newUser);
    return newUser;
  } catch (err) {
    return {
      uid: user.uid,
      email: user.email || '',
      role: defaultRole,
      displayName: user.displayName || 'User',
      createdAt: new Date().toISOString(),
    };
  }
}

export async function registerWithEmail(
  email: string, 
  pass: string, 
  profileData: Omit<SellerProfile, 'userId'>
): Promise<AppUser> {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  const appUser = await syncUserProfile(cred.user, 'seller');

  await setDoc(doc(db, SELLERS_COL, cred.user.uid), {
    userId: cred.user.uid,
    ...profileData,
    rating: 5.0,
    verified: false,
    createdAt: new Date().toISOString(),
  });

  return appUser;
}

export async function loginWithEmail(email: string, pass: string): Promise<AppUser> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return await syncUserProfile(cred.user);
}

export async function loginWithGoogle(role: UserRole = 'seller'): Promise<AppUser> {
  const cred = await signInWithPopup(auth, googleProvider);
  const appUser = await syncUserProfile(cred.user, role);

  const sellerRef = doc(db, SELLERS_COL, cred.user.uid);
  const snap = await getDoc(sellerRef);
  if (!snap.exists() && role === 'seller') {
    await setDoc(sellerRef, {
      userId: cred.user.uid,
      businessName: `${cred.user.displayName || 'Enterprise'} Machinery Works`,
      contactPerson: cred.user.displayName || 'Authorized Representative',
      phone: '919876543210',
      city: 'Hyderabad',
      state: 'Telangana',
      workshopAddress: 'Jeedimetla Industrial Corridor, Hyderabad',
      rating: 5.0,
      verified: true,
    });
  }

  return appUser;
}

export async function logoutUser(): Promise<void> {
  await fbSignOut(auth);
}

export async function getSellerProfile(userId: string): Promise<SellerProfile | null> {
  try {
    const snap = await getDoc(doc(db, SELLERS_COL, userId));
    if (snap.exists()) return snap.data() as SellerProfile;
    return null;
  } catch (err) {
    return null;
  }
}

export async function getPublishedMachines(): Promise<Machine[]> {
  try {
    const q = query(collection(db, MACHINES_COL), where('status', '==', 'published'));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Machine));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    return [];
  }
}

export async function getSellerMachines(sellerId: string): Promise<Machine[]> {
  try {
    const q = query(collection(db, MACHINES_COL), where('sellerId', '==', sellerId));
    const snap = await getDocs(q);
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Machine));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    return [];
  }
}

export async function getAllMachinesForAdmin(): Promise<Machine[]> {
  try {
    const snap = await getDocs(collection(db, MACHINES_COL));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Machine));
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (err) {
    return [];
  }
}

export async function createMachine(
  sellerId: string, 
  data: Partial<Machine>, 
  file?: File | null
): Promise<string> {
  let finalImageUrl = data.imageUrl || 'https://images.unsplash.com/photo-1589365278144-c9e705f843ba?auto=format&fit=crop&w=800&q=80';

  if (file) {
    finalImageUrl = await compressImageToBase64(file);
  }

  const sellerSnap = await getDoc(doc(db, SELLERS_COL, sellerId));
  const sellerData = sellerSnap.exists() ? (sellerSnap.data() as SellerProfile) : null;

  const payload: Omit<Machine, 'id'> = {
    sellerId,
    sellerName: sellerData?.businessName || 'Verified Regional Seller',
    sellerPhone: sellerData?.phone || '919876543210',
    name: data.name || '',
    modelNumber: data.modelNumber || 'MOD-01',
    description: data.description || '',
    price: Number(data.price) || 0,
    capacityKgHr: Number(data.capacityKgHr) || 1,
    motorPower: data.motorPower || '1 HP Pure Copper',
    machineType: data.machineType || 'domestic_cold_press',
    voltage: data.voltage || '220V Single Phase',
    weightKg: Number(data.weightKg) || 15,
    warranty: data.warranty || '1 Year Comprehensive',
    location: data.location || 'Hyderabad, Telangana',
    status: 'pending',
    compatibleSeeds: data.compatibleSeeds || ['Groundnut', 'Mustard', 'Sesame'],
    imageUrl: finalImageUrl,
    inquiriesCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const docRef = await addDoc(collection(db, MACHINES_COL), payload);
  return docRef.id;
}

export async function updateMachine(
  id: string, 
  data: Partial<Machine>, 
  file?: File | null
): Promise<void> {
  const updateData: any = {
    ...data,
    status: 'pending',
    updatedAt: new Date().toISOString(),
  };

  if (file) {
    updateData.imageUrl = await compressImageToBase64(file);
  }

  await updateDoc(doc(db, MACHINES_COL, id), updateData);
}

export async function deleteMachine(id: string): Promise<void> {
  await deleteDoc(doc(db, MACHINES_COL, id));
}

export async function setMachineStatus(id: string, status: 'published' | 'rejected'): Promise<void> {
  await updateDoc(doc(db, MACHINES_COL, id), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function submitEnquiry(enquiry: Omit<Enquiry, 'id' | 'createdAt'>): Promise<string> {
  const docRef = await addDoc(collection(db, ENQUIRIES_COL), {
    ...enquiry,
    createdAt: new Date().toISOString(),
    status: 'new',
  });

  try {
    await updateDoc(doc(db, MACHINES_COL, enquiry.machineId), {
      inquiriesCount: increment(1),
    });
  } catch (_) {}

  return docRef.id;
}

export async function getSellerEnquiries(sellerId: string): Promise<Enquiry[]> {
  try {
    const q = query(collection(db, ENQUIRIES_COL), where('sellerId', '==', sellerId));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Enquiry));
  } catch (err) {
    return [];
  }
}

export const INITIAL_TELANGANA_SEED: Omit<Machine, 'id'>[] = [
  {
    sellerId: 'demo-seller-telangana',
    sellerName: 'Deccan Agro Machinery & Extruders',
    sellerPhone: '919876543210',
    name: 'EcoPress Pro 300 SS304 Tabletop Extractor',
    modelNumber: 'EP-300-SS',
    description: 'Food-grade stainless steel SS304 multi-purpose cold press oil expeller for home kitchens and micro-shops. True cold press technology (< 45°C) to protect vital fatty acids. Easy disassembly and 5-minute cleaning.',
    price: 24500,
    capacityKgHr: 4.5,
    motorPower: '450W Pure Copper',
    machineType: 'domestic_cold_press',
    voltage: '220V Single Phase',
    weightKg: 11.5,
    warranty: '1 Year Comprehensive Warranty',
    location: 'Jeedimetla, Hyderabad',
    status: 'published',
    compatibleSeeds: ['Groundnut', 'Mustard', 'Sesame (Til)', 'Sunflower', 'Almond'],
    imageUrl: 'https://images.unsplash.com/photo-1589365278144-c9e705f843ba?auto=format&fit=crop&w=800&q=80',
    inquiriesCount: 19,
    createdAt: new Date().toISOString(),
  },
  {
    sellerId: 'demo-seller-telangana',
    sellerName: 'Deccan Agro Machinery & Extruders',
    sellerPhone: '919876543210',
    name: 'Kisan Shakti Mini Commercial Expeller 10KG',
    modelNumber: 'KS-1000-C',
    description: 'High-torque screw expeller with case-hardened alloy worm shaft. Engineered for retail oil shops, kirana stores, and farmer cooperatives across Telangana.',
    price: 68000,
    capacityKgHr: 12.0,
    motorPower: '1.5 HP Induction Motor',
    machineType: 'commercial_screw_press',
    voltage: '230V Single Phase',
    weightKg: 65.0,
    warranty: '2 Years Manufacturer Motor Warranty',
    location: 'Secunderabad, Telangana',
    status: 'published',
    compatibleSeeds: ['Peanut / Groundnut', 'Castor', 'Mustard', 'Dry Copra'],
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
    inquiriesCount: 34,
    createdAt: new Date().toISOString(),
  },
  {
    sellerId: 'demo-seller-telangana',
    sellerName: 'Sri Krishna Extruders & Spares',
    sellerPhone: '919848012345',
    name: 'HydroPure Virgin Coconut Cold Hydraulic Unit',
    modelNumber: 'HP-HYD-50',
    description: 'Specialty hydraulic cold press designed for zero-friction virgin coconut, walnut, and black seed (kalonji) oil extraction without heat damage.',
    price: 44000,
    capacityKgHr: 6.0,
    motorPower: '750W Low RPM German Drive',
    machineType: 'hydraulic_press',
    voltage: '220V Single Phase',
    weightKg: 38.0,
    warranty: '1 Year Free On-Site Replacement',
    location: 'Kukatpally, Hyderabad',
    status: 'published',
    compatibleSeeds: ['Dry Copra / Coconut', 'Walnut', 'Black Seed (Kalonji)', 'Moringa'],
    imageUrl: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=800&q=80',
    inquiriesCount: 11,
    createdAt: new Date().toISOString(),
  }
];

export async function seedFirestoreDatabaseIfEmpty(): Promise<Machine[]> {
  try {
    const existing = await getPublishedMachines();
    if (existing.length > 0) return existing;

    const inserted: Machine[] = [];
    for (const item of INITIAL_TELANGANA_SEED) {
      const docRef = await addDoc(collection(db, MACHINES_COL), item);
      inserted.push({ id: docRef.id, ...item });
    }
    return inserted;
  } catch (err) {
    return INITIAL_TELANGANA_SEED.map((item, idx) => ({ id: `m-${idx + 1}`, ...item }));
  }
}