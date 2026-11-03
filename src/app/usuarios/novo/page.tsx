import { Cabecalho } from '@/ui/pagina';
import { exigirPagina } from '@/auth/guard';
import { criarUsuario } from '@/server/acoes/usuarios';
import { FormUsuario } from '../form';

export const metadata = { title: 'Novo usuário' };

export default async function NovoUsuarioPage() {
  await exigirPagina('/usuarios/novo');
  return (
    <>
      <Cabecalho
        titulo="Novo usuário"
        descricao="Cria a conta de acesso já com a senha definitiva: avise a pessoa por fora deste sistema."
        voltar={{ href: '/usuarios', label: 'Voltar para usuários' }}
      />
      <div className="card max-w-2xl">
        <FormUsuario acao={criarUsuario} />
      </div>
    </>
  );
}
