
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Package,
  Home,
  Users,
  LayoutDashboard,
  FileText,
  ShoppingCart,
  CreditCard,
  Settings,
  ChartBar,
  ChartPie,
  Info,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

type SidebarItemProps = {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
};

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  active = false,
  onClick,
}) => {
  return (
    <Button
      variant="ghost"
      className={cn(
        'w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active && 'bg-sidebar-accent text-sidebar-accent-foreground'
      )}
      onClick={onClick}
    >
      {icon}
      <span className="truncate">{label}</span>
    </Button>
  );
};

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarItems = [
    { icon: <Home size={20} />, label: 'Dashboard', active: true },
    { icon: <ChartBar size={20} />, label: 'Statistics' },
    { icon: <Package size={20} />, label: 'Raw Materials' },
    { icon: <Users size={20} />, label: 'Users' },
    { icon: <Package size={20} />, label: 'Packing' },
    { icon: <FileText size={20} />, label: 'Finishing' },
    { icon: <ShoppingCart size={20} />, label: 'Sales' },
    { icon: <CreditCard size={20} />, label: 'Invoices' },
    { icon: <ChartPie size={20} />, label: 'Customer Database' },
    { icon: <Settings size={20} />, label: 'Settings' },
  ];

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setCollapsed(!collapsed);
    }
  };

  // Handle mobile sidebar visibility
  const sidebarClasses = cn(
    'bg-sidebar h-screen flex flex-col overflow-y-auto transition-all duration-300 ease-in-out bg-sidebar-default border-r border-sidebar-border',
    collapsed ? 'w-[70px]' : 'w-[250px]',
    isMobile && 'fixed top-0 left-0 z-40',
    isMobile && !mobileOpen && '-translate-x-full'
  );

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile toggle button */}
      {isMobile && (
        <button
          className="fixed top-5 left-5 z-50 p-2 rounded-full bg-primary text-white shadow-md"
          onClick={toggleSidebar}
        >
          {mobileOpen ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
        </button>
      )}

      <aside className={sidebarClasses}>
        {/* Sidebar Header */}
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <img src="/tealeaf.svg" alt="Amee-Tea Logo" className="h-8 w-8" />
            {!collapsed && <h2 className="font-bold text-lg text-sidebar-foreground">Amee-Tea</h2>}
          </div>
          
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-accent"
              onClick={toggleSidebar}
            >
              {collapsed ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
            </Button>
          )}
        </div>
        
        {/* Sidebar Content */}
        <div className="flex-1 py-4 px-2 space-y-1">
          {sidebarItems.map((item, index) => (
            <SidebarItem 
              key={index} 
              icon={item.icon} 
              label={item.label} 
              active={item.active} 
            />
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <SidebarItem 
            icon={<Info size={20} />} 
            label="Help & Support" 
          />
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
