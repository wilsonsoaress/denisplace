import { Cabecalho } from '@/ui/pagina';
import { salvarCliente } from '@/server/acoes/clientes';
import { FormCliente } from '../form';

export const metadata = { title: 'Novo cliente' };

export default function NovoClientePage() {
  return (
    <>
      <Cabecalho
        titulo="Novo cliente"
        descricao="Cadastre antes de criar contrato ou orçamento."
        voltar={{ href: '/cadastros/clientes', label: 'Voltar para clientes' }}
      />
      <div className="card max-w-4xl">
        <FormCliente acao={salvarCliente.bind(null, null)} />
      </div>
    </>
  );
}
