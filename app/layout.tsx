import type {Metadata} from 'next';
import './globals.css';
import { Inter, Space_Grotesk, Roboto_Condensed } from 'next/font/google';
import { cn } from "@/lib/utils";
import Providers from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-display' });
const robotoCondensed = Roboto_Condensed({ subsets: ['latin'], variable: '--font-roboto' });

export const metadata: Metadata = {
  title: 'Aplaine | Gestão de Louvor',
  description: 'Plataforma para gestão de ministérios de louvor Aplaine, escalas e repertório.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={cn("antialiased", inter.variable, spaceGrotesk.variable, robotoCondensed.variable)}>
      <body suppressHydrationWarning className="font-sans min-h-screen bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
