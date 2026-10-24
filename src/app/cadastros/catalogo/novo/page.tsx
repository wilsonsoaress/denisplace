import { prisma } from '@/server/db';
import { salvarCatalogoItem } from '@/server/acoes/catalogo';
import { Cabecalho } from '@/ui/pagina';
import { FormCatalogoItem } from '../form';

export const metadata = { title: 'Novo item de catálogo' };

export default async function NovoCatalogoPage() {
  const indices = await prisma.indiceReajuste.findMany({ orderBy: { sigla: 'asc' } });
  return (
    <>
      <Cabecalho
        titulo="Novo item de catálogo"
        voltar={{ href: '/cadastros/catalogo', label: 'Voltar para o catálogo' }}
      />
      <div className="card max-w-4xl">
        <FormCatalogoItem acao={salvarCatalogoItem.bind(null, null)} indices={indices} />
      </div>
    </>
  );
}
