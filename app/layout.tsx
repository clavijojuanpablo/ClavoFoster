import type { Metadata } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';

import './globals.css';

// Títulos y cifras. Ver docs/15-sistema-de-diseno.md
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
});

// Texto e interfaz.
const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: { default: 'Agenda para tu negocio', template: '%s' },
  description: 'Reservas en línea, agenda y caja para barberías, peluquerías y spas.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-CO" className={`${bricolage.variable} ${figtree.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
