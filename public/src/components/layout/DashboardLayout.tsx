
import React from 'react';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const isMobile = useIsMobile();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className={cn(
        "flex-1 overflow-auto",
        isMobile ? "pl-0" : "pl-0"
      )}>
        <div className="container mx-auto px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
