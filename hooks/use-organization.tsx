'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './use-auth';

interface Organization { id: string; name: string; slug: string; ownerId: string; }
interface ContextType { currentOrg: Organization | null; userRole: string | null; loading: boolean; }

const OrgContext = createContext<ContextType>({ currentOrg: null, userRole: null, loading: true });

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !profile?.currentOrganizationId) {
      setCurrentOrg(null); setUserRole(null); setLoading(false); return;
    }
    const orgId = profile.currentOrganizationId;
    const unsubOrg = onSnapshot(doc(db, 'organizations', orgId), (d) => {
      if (d.exists()) setCurrentOrg({ id: d.id, ...d.data() } as Organization);
    });
    const unsubMem = onSnapshot(doc(db, 'organizations', orgId, 'members', user.uid), (d) => {
      if (d.exists()) setUserRole(d.data().role);
      setLoading(false);
    });
    return () => { unsubOrg(); unsubMem(); };
  }, [user, profile?.currentOrganizationId]);

  return <OrgContext.Provider value={{ currentOrg, userRole, loading }}>{children}</OrgContext.Provider>;
}
export const useOrganization = () => useContext(OrgContext);
