export type UserRole = 'buyer' | 'seller' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  createdAt?: string;
}

export interface SellerProfile {
  userId: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  city: string;
  state: string;
  workshopAddress: string;
  businessDescription?: string;
  rating?: number;
  verified?: boolean;
}

export type MachineType = 
  | 'domestic_cold_press' 
  | 'commercial_screw_press' 
  | 'hydraulic_press' 
  | 'wooden_ghani_rotary';

export type MachineStatus = 'draft' | 'pending' | 'published' | 'rejected';

export interface Machine {
  id: string;
  sellerId: string;
  sellerName?: string;
  sellerPhone?: string;
  name: string;
  modelNumber: string;
  description: string;
  price: number;
  capacityKgHr: number;
  motorPower: string;
  machineType: MachineType;
  voltage: string;
  weightKg: number;
  warranty: string;
  location: string;
  status: MachineStatus;
  compatibleSeeds: string[];
  imageUrl: string;
  inquiriesCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Enquiry {
  id?: string;
  machineId: string;
  machineName: string;
  sellerId: string;
  buyerName: string;
  buyerPhone: string;
  targetSeed: string;
  message?: string;
  createdAt: string;
  status?: 'new' | 'contacted' | 'closed';
}

export const SEED_YIELD_GUIDE = [
  { seed: 'Groundnut (Peanut)', oilPercent: '44% - 48%', avgPrice: '₹85 / kg', outOil: '450 ml / kg' },
  { seed: 'Sesame (Til)', oilPercent: '48% - 52%', avgPrice: '₹140 / kg', outOil: '500 ml / kg' },
  { seed: 'Mustard (Rai)', oilPercent: '33% - 36%', avgPrice: '₹75 / kg', outOil: '350 ml / kg' },
  { seed: 'Dry Copra (Coconut)', oilPercent: '60% - 65%', avgPrice: '₹130 / kg', outOil: '620 ml / kg' },
  { seed: 'Sunflower Seeds', oilPercent: '38% - 42%', avgPrice: '₹70 / kg', outOil: '400 ml / kg' },
];