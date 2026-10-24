import Link from 'next/link';
import type { ReactNode } from 'react';

export function Cabecalho({
  titulo,
  descricao,
  voltar,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  voltar?: { href: string; label: string };
  acoes?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        {voltar ? (
          <Link href={voltar.href} className="text-xs text-slate-500 hover:text-blue-800">
            ← {voltar.label}
          </Link>
        ) : null}
        <h1 className="text-xl font-semibold">{titulo}</h1>
        {descricao ? <p className="mt-1 max-w-3xl text-sm text-slate-600">{descricao}</p> : null}
      </div>
      {acoes ? <div className="flex flex-wrap items-center gap-2">{acoes}</div> : null}
    </div>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <div className="card mt-4 text-center text-sm text-slate-500" role="status">
      {children}
    </div>
  );
}

/** Filtro GET simples: preservamos os termos ja digitados no form. */
export function Filtro({
  acao,
  q,
  placeholder = 'Buscar…',
  children,
}: {
  acao: string;
  q: string;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <form action={acao} className="mb-4 flex flex-wrap items-end gap-2">
      <input name="q" defaultValue={q} placeholder={placeholder} className="input max-w-xs" />
      {children}
      <button type="submit" className="btn">
        Filtrar
      </button>
      {q ? (
        <Link href={acao} className="text-xs text-slate-500 hover:text-red-700">
          limpar
        </Link>
      ) : null}
    </form>
  );
}
