'use client';

import {
  createContext,
  useContext,
  useEffect,
  useActionState,
  useRef,
  type ReactNode,
} from 'react';

export type EstadoForm = { erros?: Record<string, string>; mensagem?: string } | null;

const ErrosContext = createContext<Record<string, string>>({});

/** Campos internos do mecanismo de action do Next não pertencem ao formulário. */
function capturar(fd: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [nome, valor] of fd.entries()) {
    if (typeof valor === 'string' && !nome.startsWith('$')) valores[nome] = valor;
  }
  return valores;
}

export function Formulario({
  acao,
  textoSubmit = 'Salvar',
  children,
}: {
  acao: (prev: EstadoForm, fd: FormData) => Promise<EstadoForm>;
  textoSubmit?: string;
  children: ReactNode;
}) {
  const enviados = useRef<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const [estado, dispatch, pendente] = useActionState(async (prev: EstadoForm, fd: FormData) => {
    enviados.current = capturar(fd);
    return acao(prev, fd);
  }, null);

  // Sem isso, um erro de validação devolve o form com os campos vazios e a pessoa
  // redigita tudo — o motivo mais comum de cadastro abandonado.
  useEffect(() => {
    const form = formRef.current;
    if (!form || !estado?.erros) return;
    for (const [nome, valor] of Object.entries(enviados.current)) {
      for (const el of form.querySelectorAll(`[name="${CSS.escape(nome)}"]`)) {
        const campo = el as HTMLInputElement;
        if (campo.type === 'checkbox') campo.checked = valor === '1';
        else if (campo.type !== 'hidden') campo.value = valor;
      }
    }
  }, [estado]);

  return (
    <ErrosContext.Provider value={estado?.erros ?? {}}>
      <form ref={formRef} action={dispatch} className="space-y-4">
        {estado?.mensagem ? (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
            {estado.mensagem}
          </p>
        ) : null}
        {children}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={pendente} className="btn btn-primary">
            {pendente ? 'Salvando…' : textoSubmit}
          </button>
        </div>
      </form>
    </ErrosContext.Provider>
  );
}

export function Campo({
  nome,
  rotulo,
  obrigatorio,
  dica,
  children,
}: {
  nome: string;
  rotulo: string;
  obrigatorio?: boolean;
  dica?: string;
  children: ReactNode;
}) {
  const erro = useContext(ErrosContext)[nome];
  return (
    <label className="block">
      <span className="field-label">
        {rotulo}
        {obrigatorio ? <span className="ml-0.5 text-red-600">*</span> : null}
      </span>
      {children}
      {erro ? (
        <span className="mt-1 block text-xs font-medium text-red-600">{erro}</span>
      ) : dica ? (
        <span className="mt-1 block text-xs text-slate-500">{dica}</span>
      ) : null}
    </label>
  );
}

export function Texto({
  nome,
  valor,
  tipo = 'text',
  placeholder,
  obrigatorio,
}: {
  nome: string;
  valor?: string;
  tipo?: string;
  placeholder?: string;
  obrigatorio?: boolean;
}) {
  return (
    <input
      name={nome}
      type={tipo}
      defaultValue={valor}
      placeholder={placeholder}
      required={obrigatorio}
      className="input"
    />
  );
}

export function Area({ nome, valor, linhas = 3 }: { nome: string; valor?: string; linhas?: number }) {
  return <textarea name={nome} defaultValue={valor} rows={linhas} className="input" />;
}

export function Escolha({
  nome,
  valor,
  opcoes,
  obrigatorio,
}: {
  nome: string;
  valor?: string;
  opcoes: { value: string; label: string }[];
  obrigatorio?: boolean;
}) {
  return (
    <select name={nome} defaultValue={valor} required={obrigatorio} className="input">
      {opcoes.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function EscolhaAgrupada({
  nome,
  valor,
  grupos,
  vazio,
}: {
  nome: string;
  valor?: string;
  grupos: { rotulo: string; opcoes: { value: string; label: string }[] }[];
  vazio?: { value: string; label: string };
}) {
  return (
    <select name={nome} defaultValue={valor} className="input">
      {vazio ? <option value={vazio.value}>{vazio.label}</option> : null}
      {grupos.map((g) => (
        <optgroup key={g.rotulo} label={g.rotulo}>
          {g.opcoes.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function Check({ nome, rotulo, valor }: { nome: string; rotulo: string; valor?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      {/* checkbox desmarcado nao envia nada; o hidden garante que o backend receba "0" */}
      <input type="hidden" name={nome} value="0" />
      <input type="checkbox" name={nome} value="1" defaultChecked={valor} className="size-4" />
      {rotulo}
    </label>
  );
}
