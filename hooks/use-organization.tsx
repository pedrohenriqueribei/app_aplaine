'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './use-auth';

interface Organization { id: string; name: string; slug: string; ownerId: string; }
interface ContextType { currentOrg: Organization | null; userRole: string | null; loading: boolean; }

const OrgContext = createContext<ContextType>({ currentOrg: null, userRole: null, loading: true });

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin: isSuperAdmin } = useAuth();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile?.currentOrganizationId) {
      setCurrentOrg(null); setUserRole(null); setLoading(false); return;
    }
    const orgId = profile.currentOrganizationId;
    const unsubOrg = onSnapshot(doc(db, 'organizations', orgId), {
      next: (d) => {
        if (d.exists()) setCurrentOrg({ id: d.id, ...d.data() } as Organization);
      },
      error: (err) => {
        console.error("Organization fetch error:", err);
        setLoading(false);
      }
    });

    const unsubMem = onSnapshot(doc(db, 'organizations', orgId, 'members', user.uid), {
      next: (d) => {
        if (d.exists()) {
          setUserRole(d.data().role);
        } else if (isSuperAdmin) {
          setUserRole('ADMIN');
        } else {
          setUserRole(null);
        }
        setLoading(false);
      },
      error: (err) => {
        if (isSuperAdmin) {
          setUserRole('ADMIN');
        } else {
          console.error("Member role fetch error:", err);
        }
        setLoading(false);
      }
    });
    return () => { unsubOrg(); unsubMem(); };
  }, [user, profile?.currentOrganizationId, isSuperAdmin]);

  return <OrgContext.Provider value={{ currentOrg, userRole, loading }}>{children}</OrgContext.Provider>;
}
export const useOrganization = () => useContext(OrgContext);
