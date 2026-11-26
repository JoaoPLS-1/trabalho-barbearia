import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, Phone, Scissors, Search, Store } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { cnpj, phone } from '../../lib/format';
import type { Empresa } from '../../lib/types';
import { StatePanel } from '../../components/StatePanel';
import { useCompanySelection } from '../../app/company-context';

export function CompanyChoice() {
  const [search, setSearch] = useState('');
  const { choose } = useCompanySelection();
  const navigate = useNavigate();
  const companies = useQuery({
    queryKey: ['empresas'],
    queryFn: ({ signal }) => api<Empresa[]>('/empresas?ativa=true', { signal }),
  });
  const active = companies.data?.filter((company) => company.ativa) ?? [];
  const filtered = active.filter((company) =>
    (company.nome + ' ' + company.cnpj)
      .toLocaleLowerCase('pt-BR')
      .includes(search.trim().toLocaleLowerCase('pt-BR')),
  );
  return (
    <main id="conteudo" className="choice-page">
      <header className="choice-top">
        <a className="brand" href="/">
          <span className="brand-icon">
            <Scissors aria-hidden="true" />
          </span>
          <span>
            Barbearia<span className="brand-caption">Sistema de recepção</span>
          </span>
        </a>
        <span className="choice-top-note">
          Um lugar para organizar seus atendimentos
        </span>
      </header>
      <section className="choice-intro">
        <span className="eyebrow">VAMOS COMEÇAR</span>
        <h1>
          Qual barbearia
          <br />
          vamos atender?
        </h1>
        <p>
          Escolha a empresa para abrir a recepção e acompanhar os atendimentos
          do dia.
        </p>
      </section>
      <section className="company-selection" aria-label="Empresas disponíveis">
        <div className="choice-toolbar">
          <div>
            <h2>Suas empresas</h2>
            <p>
              {companies.isSuccess
                ? `${active.length} ${active.length === 1 ? 'empresa disponível' : 'empresas disponíveis'}`
                : 'Selecione onde deseja trabalhar'}
            </p>
          </div>
          <label className="search-field">
            <Search aria-hidden="true" />
            <span className="sr-only">Buscar empresa</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar pelo nome ou CNPJ"
              type="search"
            />
          </label>
        </div>
        {companies.isPending ? (
          <StatePanel kind="loading" title="Carregando empresas" />
        ) : companies.isError ? (
          <StatePanel
            kind="error"
            title="Não foi possível carregar as empresas"
            action={
              <button
                className="button"
                onClick={() => void companies.refetch()}
              >
                Tentar novamente
              </button>
            }
          >
            <p>{errorMessage(companies.error)}</p>
          </StatePanel>
        ) : active.length === 0 ? (
          <StatePanel title="Nenhuma empresa disponível">
            <p>
              Peça à pessoa responsável para verificar se há uma empresa ativa
              no cadastro.
            </p>
          </StatePanel>
        ) : filtered.length === 0 ? (
          <StatePanel
            title="Nenhuma empresa encontrada"
            action={
              <button
                className="button secondary"
                onClick={() => setSearch('')}
              >
                Limpar busca
              </button>
            }
          >
            <p>Tente outro nome ou CNPJ.</p>
          </StatePanel>
        ) : (
          <div className="company-grid">
            {filtered.map((company) => (
              <article className="company-card" key={company.id}>
                <span className="company-card-icon">
                  <Store aria-hidden="true" />
                </span>
                <span className="available-label">
                  Disponível para atendimento
                </span>
                <h3>{company.nome}</h3>
                <p className="company-detail">
                  <Building2 aria-hidden="true" />
                  {cnpj(company.cnpj)}
                </p>
                <p className="company-detail">
                  <Phone aria-hidden="true" />
                  {company.telefone
                    ? phone(company.telefone)
                    : 'Telefone não informado'}
                </p>
                <button
                  className="button"
                  onClick={() => {
                    choose(company.id);
                    navigate('/painel', { replace: true });
                  }}
                  aria-label={'Entrar na empresa ' + company.nome}
                >
                  Entrar na unidade
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer className="choice-footer">
        <Scissors aria-hidden="true" />A empresa escolhida ficará sempre visível
        durante o atendimento.
      </footer>
    </main>
  );
}
