
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartBar, Package, ShoppingCart, Users } from 'lucide-react';

const StatsCard = ({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-8 w-8 rounded-full bg-primary/20 p-1 text-primary flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-tea-700">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
};

const StatsOverview: React.FC = () => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatsCard
        title="Total Sales"
        value="$12,589"
        icon={<ChartBar size={18} />}
        description="+8% from last month"
      />
      <StatsCard
        title="Active Orders"
        value="24"
        icon={<ShoppingCart size={18} />}
        description="12 pending delivery"
      />
      <StatsCard
        title="Inventory Items"
        value="145"
        icon={<Package size={18} />}
        description="32 items low stock"
      />
      <StatsCard
        title="Total Customers"
        value="573"
        icon={<Users size={18} />}
        description="18 new this week"
      />
    </div>
  );
};

export default StatsOverview;
