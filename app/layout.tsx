import type { Metadata } from 'next';
import { Inter, Archivo_Black, Source_Sans_3 } from 'next/font/google';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

// Label typography. The existing Illustrator artwork uses Arial Black for the
// SKU and Myriad Pro for the descriptive lines; these are the closest freely
// available equivalents, so printed labels stay consistent with current stock
// and the designer can install the same faces to open the exported SVG.
const archivoBlack = Archivo_Black({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-label-display',
});

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-label-text',
});

export const metadata: Metadata = {
  title: 'Luken Lighting - Architectural Lighting',
  description: 'Architectural lighting designed to disappear. Clean, minimal fixtures that let the space shine.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${archivoBlack.variable} ${sourceSans.variable}`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}

