'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: () => Promise<void>;
  signInEmail: (email: string, pass: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
  user: null, 
  profile: null, 
  loading: true, 
  isAdmin: false,
  signIn: async () => {}, 
  signInEmail: async () => {},
  logOut: async () => {} 
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const ref = doc(db, 'users', u.uid);
        const snap = await getDoc(ref);
        
        // Verificando se é admin global (super admin)
        const adminRef = doc(db, 'admins', u.uid);
        const adminSnap = await getDoc(adminRef);
        setIsAdmin(adminSnap.exists());

        if (!snap.exists()) {
          const p = { 
            email: u.email, 
            displayName: u.displayName || u.email?.split('@')[0], 
            photoURL: u.photoURL, 
            createdAt: new Date().toISOString() 
          };
          await setDoc(ref, p);
          setProfile(p);
        } else {
          onSnapshot(ref, (d) => setProfile(d.data()));
        }
      } else { 
        setProfile(null); 
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signIn = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { console.error(e); } };
  const signInEmail = async (email: string, pass: string) => { 
    try { await signInWithEmailAndPassword(auth, email, pass); } catch (e) { console.error(e); throw e; } 
  };
  const logOut = async () => { try { await signOut(auth); } catch (e) { console.error(e); } };

  return <AuthContext.Provider value={{ user, profile, loading, isAdmin, signIn, signInEmail, logOut }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
