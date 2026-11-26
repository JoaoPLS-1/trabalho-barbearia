import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Scissors,
  Users,
  UserRound,
  ClipboardList,
} from 'lucide-react';
import { useActiveCompany, useChangeCompany } from './company-context';
import { Dialog } from '../components/Dialog';

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const company = useActiveCompany();
  const change = useChangeCompany();
  const location = useLocation();
  const groups = [
    {
      label: 'Cliente',
      icon: Users,
      path: '/clientes',
      links: [
        ['Listar clientes', '/clientes'],
        ['Novo cliente', '/clientes/novo'],
      ],
    },
    {
      label: 'Profissional',
      icon: UserRound,
      path: '/profissionais',
      links: [
        ['Listar profissionais', '/profissionais'],
        ['Novo profissional', '/profissionais/novo'],
      ],
    },
    {
      label: 'Serviço',
      icon: Scissors,
      path: '/servicos',
      links: [
        ['Listar serviços', '/servicos'],
        ['Novo serviço', '/servicos/novo'],
      ],
    },
    {
      label: 'Agendamento',
      icon: CalendarDays,
      path: '/agendamentos',
      links: [
        ['Agenda', '/agendamentos'],
        ['Novo agendamento', '/agendamentos/novo'],
        ['Histórico', '/agendamentos/historico'],
      ],
    },
  ];
  return (
    <>
      <div className="sidebar-brand">
        <span className="brand-icon">
          <Scissors aria-hidden="true" />
        </span>
        <span>
          Barbearia<span className="brand-caption">Sistema de recepção</span>
        </span>
      </div>
      <div className="operating-company">
        <Building2 aria-hidden="true" />
        <div>
          <span>Empresa em operação</span>
          <strong title={company.nome}>{company.nome}</strong>
        </div>
      </div>
      <nav className="navigation" aria-label="Menu principal">
        <span className="nav-caption">ATENDIMENTO</span>
        <NavLink
          to="/painel"
          className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}
          onClick={onNavigate}
        >
          <LayoutDashboard aria-hidden="true" />
          Visão geral
        </NavLink>
        {groups.map(({ label, icon: Icon, path, links }) => (
          <details
            className="nav-group"
            key={label}
            open={location.pathname.startsWith(path) || undefined}
          >
            <summary>
              <Icon aria-hidden="true" />
              <span>{label}</span>
              <ChevronDown className="nav-chevron" aria-hidden="true" />
            </summary>
            <div className="nav-submenu">
              {links.map(([text, target]) => (
                <NavLink
                  key={target}
                  end
                  to={target}
                  className={({ isActive }) =>
                    'nav-sub-link ' + (isActive ? 'active' : '')
                  }
                  onClick={onNavigate}
                >
                  {text}
                </NavLink>
              ))}
            </div>
          </details>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span>
          <ClipboardList aria-hidden="true" />
          Recepção organizada, atendimento melhor.
        </span>
        <button
          className="change-company"
          onClick={() => {
            onNavigate?.();
            change();
          }}
        >
          <RefreshCw aria-hidden="true" />
          Alterar empresa
        </button>
      </div>
    </>
  );
}

export function Shell() {
  const company = useActiveCompany();
  const [menu, setMenu] = useState(false);
  return (
    <div className="shell">
      <aside className="sidebar">
        <Navigation />
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              aria-expanded={menu}
              onClick={() => setMenu(true)}
            >
              <Menu aria-hidden="true" />
            </button>
            <span className="breadcrumb">
              Recepção <span>/</span> <strong>Atendimento</strong>
            </span>
          </div>
          <div className="topbar-company">
            <span className="company-avatar">
              <Building2 aria-hidden="true" />
            </span>
            <div>
              <span>Você está atendendo em</span>
              <strong>{company.nome}</strong>
            </div>
          </div>
        </header>
        <main id="conteudo" className="main-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          Sistema de Barbearia <span>Feito para a rotina da recepção</span>
        </footer>
      </div>
      {menu && (
        <Dialog
          title="Menu da recepção"
          onClose={() => setMenu(false)}
          className="drawer"
        >
          <Navigation onNavigate={() => setMenu(false)} />
        </Dialog>
      )}
    </div>
  );
}
