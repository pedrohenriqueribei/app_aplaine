'use client';

import { AuthProvider } from '@/hooks/use-auth';
import { OrganizationProvider } from '@/hooks/use-organization';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrganizationProvider>
        {children}
      </OrganizationProvider>
    </AuthProvider>
  );
}
