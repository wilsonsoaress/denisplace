'use client';

import { useActionState } from 'react';
import { MODULOS_SISTEMA, MODULOS_LABEL, PAPEIS_LABEL, PAPEIS_SISTEMA, PERNO_LABEL, papelTravado, type MapaPermissoes, type Modulo, type Perno } from '@/auth/perfis';
import type { Papel } from '@prisma/client';
import { salvarMatrizPermissoes } from '@/server/acoes/perfis';

const NIVEIS: Perno[] = ['nenhum', 'ver', 'editar'];

export function FormMatrizPermissoes({ matriz }: { matriz: Record<Papel, MapaPermissoes> }) {
  const [estado, dispatch, pendente] = useActionState(salvarMatrizPermissoes, null);

  return (
    <form action={dispatch} className="space-y-4">
      {estado?.erros?._ ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {estado.erros._}
        </p>
      ) : null}
      {estado?.mensagem ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
          {estado.mensagem}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="data text-sm">
          <thead>
            <tr>
              <th>Módulo</th>
              {PAPEIS_SISTEMA.map((p) => (
                <th key={p}>{PAPEIS_LABEL[p]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULOS_SISTEMA.map((modulo: Modulo) => (
              <tr key={modulo}>
                <td>{MODULOS_LABEL[modulo]}</td>
                {PAPEIS_SISTEMA.map((papel) => {
                  const travado = papelTravado(papel, modulo);
                  const nome = `${papel}__${modulo}`;
                  if (travado) {
                    return (
                      <td key={papel} className="text-xs text-slate-500">
                        <input type="hidden" name={nome} value="editar" />
                        Altera <span className="text-slate-400">(fixo)</span>
                      </td>
                    );
                  }
                  return (
                    <td key={papel}>
                      <select
                        key={matriz[papel][modulo]}
                        name={nome}
                        defaultValue={matriz[papel][modulo]}
                        className="input py-1 text-xs"
                      >
                        {NIVEIS.map((n) => (
                          <option key={n} value={n}>
                            {PERNO_LABEL[n]}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="submit" disabled={pendente} className="btn btn-primary">
        {pendente ? 'Salvando…' : 'Salvar permissões'}
      </button>
    </form>
  );
}
