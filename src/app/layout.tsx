import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NexoTienda',
  description: 'La tienda online de los comercios de tu pueblo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body className="min-h-screen text-neutral-800 antialiased">{children}</body>
    </html>
  );
}
