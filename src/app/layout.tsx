import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { MODULOS } from '@/lib/modulos';
import { sessaoAtual } from '@/auth/guard';
import { PAPEIS_LABEL, pode } from '@/auth/perfis';
import { Sair } from '@/ui/sair';

export const metadata: Metadata = {
  title: 'Gestão de Contratos e Cobrança',
  description: 'Locação de câmeras de segurança e portaria eletrônica',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await sessaoAtual();

  return (
    <html lang="pt-BR">
      <body className="min-h-screen">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-4 px-4 py-3">
            <Link href="/" className="text-base font-semibold">
              Gestão de Contratos &amp; Cobrança
            </Link>
            {usuario ? (
              <>
                <nav className="flex flex-wrap gap-1 text-sm">
                  <Link href="/" className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
                    Início
                  </Link>
                  {MODULOS.filter((m) => m.pronto && pode(usuario.papel, m.modulo)).map((m) => (
                    <Link
                      key={m.href}
                      href={m.href}
                      className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                    >
                      {m.curto}
                    </Link>
                  ))}
                </nav>
                <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
                  <span>
                    <b>{usuario.nome}</b> · {PAPEIS_LABEL[usuario.papel]}
                  </span>
                  <Sair />
                </div>
              </>
            ) : null}
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
