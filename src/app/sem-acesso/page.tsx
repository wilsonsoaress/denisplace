import { sessaoAtual } from '@/auth/guard';
import { Sair } from '@/ui/sair';

export const metadata = { title: 'Sem acesso' };

/**
 * Página sem NENHUMA guarda de permissão: é o destino de quem não tem acesso
 * nem ao próprio módulo `inicio`, caso que não pode redirecionar para "/" sem
 * entrar em loop (ver `exigirPagina` em src/auth/guard.ts). Precisa existir
 * mesmo para sessões "zeradas" ou com token antigo sem permissões carregadas.
 */
export default async function SemAcessoPage() {
  const usuario = await sessaoAtual();
  return (
    <div className="mx-auto mt-16 max-w-md space-y-4 text-center">
      <h1 className="text-lg font-semibold">Sem acesso a nenhum módulo</h1>
      <p className="text-sm text-slate-600">
        {usuario
          ? `O perfil ${usuario.papel.toLowerCase()} de ${usuario.nome} não tem acesso a nenhuma tela no momento.`
          : 'Sua sessão não tem acesso a nenhuma tela no momento.'}{' '}
        Se isso é inesperado, peça para o administrador conferir em Usuários → Gerenciar perfis, ou saia e entre de
        novo — mudanças recentes de permissão só valem a partir do próximo login.
      </p>
      <Sair />
    </div>
  );
}
