import type { Metadata } from 'next';
import './globals.css';

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
            <span className="text-base font-semibold">Gestão de Contratos &amp; Cobrança</span>
            <nav className="flex flex-wrap gap-1 text-sm">
              <NavItem href="/">Início</NavItem>
              <NavItem href="/financeiro/dashboard">Dashboard</NavItem>
              <NavItem href="/financeiro/contas-a-receber">Contas a receber</NavItem>
              <NavItem href="/financeiro/matriz">Matriz de inadimplência</NavItem>
              <NavItem href="/cadastros">Cadastros</NavItem>
              <NavItem href="/contratos">Contratos</NavItem>
              <NavItem href="/orcamentos">Orçamentos</NavItem>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-5">{children}</main>
      </body>
    </html>
  );
}

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100">
      {children}
    </a>
  );
}
