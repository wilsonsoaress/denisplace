import { exigirPagina } from '@/auth/guard';
import { buscarMatrizCompleta } from '@/server/permissoes';
import { Cabecalho } from '@/ui/pagina';
import { FormMatrizPermissoes } from './form';

export const metadata = { title: 'Gerenciar perfis' };

export default async function PerfisPage() {
  await exigirPagina('/usuarios/perfis');
  const matriz = await buscarMatrizCompleta();

  return (
    <>
      <Cabecalho
        titulo="Gerenciar perfis"
        descricao="O que cada perfil (Administrador, Comercial, Financeiro, Técnico) pode ver ou alterar em cada módulo. Quem já está logado só vê a mudança na próxima vez que entrar."
        voltar={{ href: '/usuarios', label: 'Voltar para usuários' }}
      />
      <div className="card">
        <FormMatrizPermissoes matriz={matriz} />
      </div>
    </>
  );
}
