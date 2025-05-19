
import React from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import WelcomeCard from '@/components/dashboard/WelcomeCard';
import StatsOverview from '@/components/dashboard/StatsOverview';
import InstructionsCard from '@/components/dashboard/InstructionsCard';

const Index = () => {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-tea-800">Control Panel</h1>
          <p className="text-muted-foreground">Manage your tea distribution operations</p>
        </div>
        
        {/* Welcome Card */}
        <WelcomeCard />
        
        {/* Stats Overview */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-tea-700">Overview</h2>
          <StatsOverview />
        </div>
        
        {/* Main Content */}
        <div className="grid gap-6 md:grid-cols-2">
          <InstructionsCard />
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
                <CardDescription>Your latest actions in the system</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4 border-l-2 border-tea-500 pl-3 py-1">
                    <div className="w-full">
                      <p className="text-sm font-medium">New shipment received</p>
                      <p className="text-xs text-muted-foreground">Today, 10:24 AM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 border-l-2 border-tea-500 pl-3 py-1">
                    <div className="w-full">
                      <p className="text-sm font-medium">Invoice #4832 generated</p>
                      <p className="text-xs text-muted-foreground">Yesterday, 5:10 PM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 border-l-2 border-tea-500 pl-3 py-1">
                    <div className="w-full">
                      <p className="text-sm font-medium">New customer added</p>
                      <p className="text-xs text-muted-foreground">Yesterday, 3:45 PM</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 border-l-2 border-tea-500 pl-3 py-1">
                    <div className="w-full">
                      <p className="text-sm font-medium">Production target updated</p>
                      <p className="text-xs text-muted-foreground">May 18, 2025, 9:20 AM</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Frequently used operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="border-tea-200 hover:border-tea-500 hover:bg-tea-50 h-24 flex flex-col gap-2 items-center justify-center">
                    <Package className="h-6 w-6 text-tea-600" />
                    <span className="text-sm">New Order</span>
                  </Button>
                  <Button variant="outline" className="border-tea-200 hover:border-tea-500 hover:bg-tea-50 h-24 flex flex-col gap-2 items-center justify-center">
                    <FileText className="h-6 w-6 text-tea-600" />
                    <span className="text-sm">Create Invoice</span>
                  </Button>
                  <Button variant="outline" className="border-tea-200 hover:border-tea-500 hover:bg-tea-50 h-24 flex flex-col gap-2 items-center justify-center">
                    <Users className="h-6 w-6 text-tea-600" />
                    <span className="text-sm">Add Customer</span>
                  </Button>
                  <Button variant="outline" className="border-tea-200 hover:border-tea-500 hover:bg-tea-50 h-24 flex flex-col gap-2 items-center justify-center">
                    <ChartBar className="h-6 w-6 text-tea-600" />
                    <span className="text-sm">View Reports</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChartBar, FileText, Package, Users } from 'lucide-react';

export default Index;
