import type {Metadata} from 'next';
import './globals.css';
import { Inter, Space_Grotesk } from 'next/font/google';
import { cn } from "@/lib/utils";
import Providers from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Apaine | Gestão de Louvor',
  description: 'Plataforma para gestão de ministérios de louvor, escalas e repertório.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={cn("antialiased", inter.variable, spaceGrotesk.variable)}>
      <body suppressHydrationWarning className="font-sans min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
