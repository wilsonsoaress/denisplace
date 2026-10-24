import { salvarEquipamento } from '@/server/acoes/equipamentos';
import { Cabecalho } from '@/ui/pagina';
import { FormEquipamento } from '../form';
import { listasParaEquipamento } from '../dados';

export const metadata = { title: 'Novo equipamento' };

export default async function NovoEquipamentoPage() {
  const { condominios, grupos } = await listasParaEquipamento();
  return (
    <>
      <Cabecalho
        titulo="Novo equipamento"
        descricao="Cadastre com a situação real: em estoque enquanto não foi instalado."
        voltar={{ href: '/cadastros/equipamentos', label: 'Voltar para equipamentos' }}
      />
      <div className="card max-w-4xl">
        <FormEquipamento acao={salvarEquipamento.bind(null, null)} condominios={condominios} grupos={grupos} />
      </div>
    </>
  );
}
