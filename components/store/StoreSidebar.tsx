'use client';

import {
  LayoutDashboard,
  Package,
  Barcode,
  ClipboardList,
  Wallet,
  Building2,
  Users,
  Leaf,
  KeyRound,
  LogOut,
} from 'lucide-react';

import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

import type { PublicUser } from '@/lib/auth';

type StoreSidebarProps = {
  user: PublicUser;
  view: string;
  onNavigate: (view: string) => void;
  onLogout: () => void;
  onPasswordChange: () => void;
};

const nav = [
  { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'stock', label: 'Estoque', icon: Package },
  { id: 'sales', label: 'Vendas', icon: Barcode },
  { id: 'orders', label: 'Pedidos', icon: ClipboardList },
  { id: 'payments', label: 'Contas a pagar', icon: Wallet },
  { id: 'mei', label: 'Gastos por MEI', icon: Building2 },
];

export default function StoreSidebar({
  user,
  view,
  onNavigate,
  onLogout,
  onPasswordChange,
}: StoreSidebarProps) {
  const menus =
    user.role === 'admin'
      ? [...nav, { id: 'users', label: 'Usuários', icon: Users }]
      : nav;

  return (
    <Sidebar className="store-sidebar">
      <SidebarHeader>
        <div className="brand">
          <span>
            <Leaf size={26} />
          </span>

          <div>
            Casa de Ração
            <small>GESTÃO DA LOJA</small>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <p className="nav-caption">OPERAÇÃO</p>

        <SidebarMenu>
          {menus.map((n) => (
            <SidebarMenuItem key={n.id}>
              <SidebarMenuButton
                isActive={view === n.id}
                onClick={() => onNavigate(n.id)}
                className="nav-button"
              >
                <n.icon size={20} />
                <span>{n.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <div className="sidebar-tip">
          <Barcode size={25} />
          <b>Pronto para o balcão</b>
          <p>
            Use o leitor USB no campo de código de barras das vendas.
          </p>
        </div>
      </SidebarContent>

      <SidebarFooter>
        <div className="footer-store">
          <div className="store-avatar">CR</div>

          <div>
            {user.name}
            <small>
              {user.role === 'admin'
                ? 'Administrador'
                : 'Funcionário'}
            </small>
          </div>
        </div>

        <div className="account-actions">
          <button onClick={onPasswordChange}>
            <KeyRound size={16} />
            Trocar senha
          </button>

          <button onClick={onLogout}>
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}