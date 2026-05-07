import React, { useState } from 'react';
import {
  LayoutDashboard, MessageSquare, Users, Settings as SettingsIcon,
  LogOut, ShieldCheck, Calendar, Kanban, Bot, Sun, Moon, ChevronLeft, ChevronRight,
  Megaphone, Route
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

const ALL_MENU_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard de Disparos', icon: LayoutDashboard },
  { id: 'campaigns',  label: 'Gestão de Campanhas',   icon: Megaphone },
  { id: 'journeys',   label: 'Jornada Automatizada',  icon: Route },
  { id: 'chat',       label: 'Inbox (Atendimento)',   icon: MessageSquare },
  { id: 'pipeline',   label: 'Pipeline Comercial',    icon: Kanban },
  { id: 'contacts',   label: 'Contatos / Leads',      icon: Users },
  { id: 'scheduling', label: 'Calendário',            icon: Calendar },
  { id: 'settings',   label: 'Configurações',         icon: SettingsIcon },
];

interface SidebarProps {
  open: boolean;
  setOpen: (v: boolean) => void;
}

const NavItem: React.FC<{
  item: typeof ALL_MENU_ITEMS[0];
  isActive: boolean;
  open: boolean;
}> = ({ item, isActive, open }) => {
  const navigate = useNavigate();
  const Icon = item.icon;

  return (
    <button
      onClick={() => navigate(`/${item.id}`)}
      title={!open ? item.label : undefined}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-150 group relative
        ${isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}
      `}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
      )}
      <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};

const SidebarContent: React.FC<SidebarProps> = ({ open, setOpen }) => {
  const { companyName } = useCompanySettings();
  const { user, userRole, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname.substring(1) || 'dashboard';

  const menuItems = ALL_MENU_ITEMS.filter(item => {
    if (item.id === 'settings' && userRole === 'atendimento') return false;
    return true;
  });

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso');
      navigate('/auth', { replace: true });
    } catch {
      toast.error('Erro ao fazer logout');
    }
  };

  const getUserInitials = () => {
    if (!user?.email) return 'US';
    return user.email.substring(0, 2).toUpperCase();
  };

  const getDisplayName = () => {
    return user?.user_metadata?.full_name || 'Usuário';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 px-1">
        <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center glow-primary-sm">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <p className="text-sm font-bold text-foreground whitespace-nowrap leading-none">
                  {companyName || 'Workspace'}
                </p>
                <p className="text-[10px] text-primary uppercase tracking-widest font-medium mt-0.5">
                  FEIMI CRM
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {menuItems.map(item => (
          <NavItem
            key={item.id}
            item={item}
            isActive={currentPath.startsWith(item.id)}
            open={open}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-border/50 space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-150"
        >
          {theme === 'dark'
            ? <Sun className="h-4 w-4 flex-shrink-0" />
            : <Moon className="h-4 w-4 flex-shrink-0" />}
          <AnimatePresence>
            {open && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap"
              >
                {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-all duration-150 group">
          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
            {getUserInitials()}
          </div>
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-hidden min-w-0"
              >
                <p className="text-xs font-medium text-foreground whitespace-nowrap truncate">{getDisplayName()}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {open && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleLogout}
                className="p-1 rounded-md hover:bg-destructive/10 transition-colors flex-shrink-0"
                title="Sair"
              >
                <LogOut className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive transition-colors" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const AppSidebar: React.FC = () => {
  const [open, setOpen] = useState(true);

  return (
    <motion.aside
      animate={{ width: open ? 220 : 64 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col h-screen flex-shrink-0 bg-sidebar border-r border-border/50 overflow-hidden"
    >
      <div className="flex flex-col h-full p-3 overflow-hidden">
        <SidebarContent open={open} setOpen={setOpen} />
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all duration-150 z-10 shadow-sm"
      >
        {open ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </motion.aside>
  );
};

export default AppSidebar;
