import Link from 'next/link';
import { Cabecalho } from '@/ui/pagina';

const MODULOS = [
  {
    href: '/cadastros/clientes',
    titulo: 'Clientes',
    descricao: 'Condomínio, morador ou empresa. Um condomínio pode ser cliente e ter moradores vinculados.',
  },
  {
    href: '/cadastros/condominios',
    titulo: 'Condomínios e unidades',
    descricao: 'Cadastro do condomínio, síndico e administradora, com as unidades usadas na cobrança por morador.',
  },
  {
    href: '/cadastros/catalogo',
    titulo: 'Catálogo',
    descricao: 'Serviços e equipamentos com preço público, custo de referência e índice de reajuste padrão.',
  },
  {
    href: '/cadastros/equipamentos',
    titulo: 'Equipamentos',
    descricao: 'Bem por número de série: é o que permite cobrar por equipamento e controlar a garantia.',
  },
  {
    href: '/cadastros/indices',
    titulo: 'Índices de reajuste',
    descricao: 'IPCA, IGP-M e INPC por competência. Sem a série completa o reajuste não é calculado.',
  },
];

export default function CadastrosPage() {
  return (
    <>
      <Cabecalho
        titulo="Cadastros"
        descricao="Base do sistema. Nada de contrato, cobrança ou reajuste funciona sem estes registros preenchidos."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODULOS.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="card block hover:border-blue-300 hover:bg-blue-50/40"
          >
            <h2 className="text-base font-semibold">{m.titulo}</h2>
            <p className="mt-1 text-sm text-slate-600">{m.descricao}</p>
            <span className="mt-2 inline-block text-sm font-medium text-blue-800">Abrir →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
