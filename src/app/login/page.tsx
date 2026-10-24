import FormularioLogin from './formulario';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const busca = await searchParams;
  const depois = typeof busca.depois === 'string' && busca.depois.startsWith('/') ? busca.depois : '/';

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="text-xl font-semibold">Entrar</h1>
      <p className="mt-1 text-sm text-slate-600">
        Acesso interno da gestão de contratos. O perfil define o que você pode alterar: comercial cuida do orçamento,
        financeiro da cobrança, técnico da execução.
      </p>
      <div className="card mt-4">
        <FormularioLogin depois={depois} expirado={busca.expirado !== undefined} />
      </div>
    </div>
  );
}
