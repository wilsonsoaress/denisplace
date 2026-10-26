import { Cabecalho } from '@/ui/pagina';
import { exigirPagina } from '@/auth/guard';
import { prisma } from '@/server/db';
import { salvarCliente } from '@/server/acoes/clientes';
import { FormCliente } from '../form';

export const metadata = { title: 'Novo cliente' };

export default async function NovoClientePage() {
  await exigirPagina('/cadastros/clientes/novo');
  const condominios = await prisma.condominio.findMany({
    select: { id: true, nome: true, cidade: true },
    orderBy: [{ cidade: 'asc' }, { nome: 'asc' }],
  });
  return (
    <>
      <Cabecalho
        titulo="Novo cliente"
        descricao="Cadastre antes de criar contrato ou orçamento."
        voltar={{ href: '/cadastros/clientes', label: 'Voltar para clientes' }}
      />
      <div className="card max-w-4xl">
        <FormCliente acao={salvarCliente.bind(null, null)} condominios={condominios} />
      </div>
    </>
  );
}
