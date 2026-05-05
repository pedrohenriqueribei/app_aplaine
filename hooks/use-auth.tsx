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
      try {
        setUser(u);
        if (u) {
          // Listen for admin status
          const adminRef = doc(db, 'admins', u.uid);
          const unsubAdmin = onSnapshot(adminRef, {
            next: (snap) => setIsAdmin(snap.exists()),
            error: (err) => console.error("Admin status check error:", err)
          });

          const ref = doc(db, 'users', u.uid);
          const snap = await getDoc(ref);
          
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
            setProfile(snap.data());
            onSnapshot(ref, {
              next: (d) => setProfile(d.data()),
              error: (err) => console.error("Profile sync error:", err)
            });
          }
          // Note: we don't return unsubAdmin here because the parent unsub will handle the logout case
        } else { 
          setProfile(null); 
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
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
