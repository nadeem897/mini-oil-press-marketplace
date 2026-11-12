import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { AppUser, SellerProfile } from '../types';
import { 
  loginWithEmail as apiLoginEmail, 
  loginWithGoogle as apiLoginGoogle, 
  registerWithEmail as apiRegisterSeller, 
  logoutUser, 
  syncUserProfile 
} from '../services/api';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  appUser: AppUser | null;
  sellerProfile: SellerProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  loginEmail: (email: string, pass: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  registerSeller: (email: string, pass: string, profile: Omit<SellerProfile, 'userId'>) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as any);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (user: FirebaseUser) => {
    try {
      const uSnap = await getDoc(doc(db, 'users', user.uid));
      if (uSnap.exists()) {
        const uData = uSnap.data() as AppUser;
        setAppUser(uData);

        if (uData.role === 'seller' || uData.role === 'admin') {
          const sSnap = await getDoc(doc(db, 'seller_profiles', user.uid));
          if (sSnap.exists()) {
            setSellerProfile(sSnap.data() as SellerProfile);
          }
        }
      } else {
        const synced = await syncUserProfile(user);
        setAppUser(synced);
      }
    } catch (err) {
      setAppUser({
        uid: user.uid,
        email: user.email || '',
        role: 'seller',
        displayName: user.displayName || 'Seller',
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await fetchUserData(user);
      } else {
        setAppUser(null);
        setSellerProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginEmail = async (email: string, pass: string) => {
    const user = await apiLoginEmail(email, pass);
    setAppUser(user);
    if (auth.currentUser) await fetchUserData(auth.currentUser);
  };

  const loginGoogle = async () => {
    const user = await apiLoginGoogle('seller');
    setAppUser(user);
    if (auth.currentUser) await fetchUserData(auth.currentUser);
  };

  const registerSeller = async (email: string, pass: string, profile: Omit<SellerProfile, 'userId'>) => {
    const user = await apiRegisterSeller(email, pass, profile);
    setAppUser(user);
    if (auth.currentUser) await fetchUserData(auth.currentUser);
  };

  const logout = async () => {
    await logoutUser();
    setFirebaseUser(null);
    setAppUser(null);
    setSellerProfile(null);
  };

  const refreshUser = async () => {
    if (auth.currentUser) await fetchUserData(auth.currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        appUser,
        sellerProfile,
        loading,
        isAdmin: appUser?.role === 'admin',
        isSeller: appUser?.role === 'seller' || appUser?.role === 'admin',
        loginEmail,
        loginGoogle,
        registerSeller,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);