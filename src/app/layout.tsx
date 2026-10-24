import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { MODULOS } from '@/lib/modulos';

export const metadata: Metadata = {
  title: 'Gestão de Contratos e Cobrança',
  description: 'Locação de câmeras de segurança e portaria eletrônica',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3">
            <Link href="/" className="text-base font-semibold">
              Gestão de Contratos &amp; Cobrança
            </Link>
            <nav className="flex flex-wrap gap-1 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
                Início
              </Link>
              {MODULOS.map((m) =>
                m.pronto ? (
                  <Link
                    key={m.href}
                    href={m.href}
                    className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                  >
                    {m.curto}
                  </Link>
                ) : (
                  <span
                    key={m.href}
                    title="Ainda não implementado nesta entrega"
                    className="cursor-not-allowed rounded-md px-3 py-1.5 text-slate-300"
                  >
                    {m.curto}
                  </span>
                ),
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
