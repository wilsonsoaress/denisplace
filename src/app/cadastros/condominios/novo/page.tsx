import { prisma } from '@/server/db';
import { salvarCondominio } from '@/server/acoes/condominios';
import { Cabecalho } from '@/ui/pagina';
import { FormCondominio } from '../form';

export const metadata = { title: 'Novo condomínio' };

export default async function NovoCondominioPage() {
  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });

  return (
    <>
      <Cabecalho
        titulo="Novo condomínio"
        descricao="Depois de salvar, cadastre as unidades na mesma tela."
        voltar={{ href: '/cadastros/condominios', label: 'Voltar para condomínios' }}
      />
      <div className="card max-w-4xl">
        <FormCondominio acao={salvarCondominio.bind(null, null)} clientes={clientes} />
      </div>
    </>
  );
}
