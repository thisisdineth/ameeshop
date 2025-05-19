
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';

const InstructionItem = ({ title, description }: { title: string; description: string }) => {
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="font-semibold text-tea-700">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
};

const InstructionsCard: React.FC = () => {
  return (
    <Card className="border-l-4 border-l-tea-300">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Info className="h-4 w-4 text-tea-500" />
        <div>
          <CardTitle>Control Panel Instructions</CardTitle>
          <CardDescription>Getting started with your tea distribution management</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          <InstructionItem
            title="Dashboard"
            description="View key metrics and performance indicators at a glance."
          />
          <InstructionItem
            title="Statistics"
            description="Analyze detailed reports and trends about your tea distribution."
          />
          <InstructionItem
            title="Raw Materials"
            description="Monitor and manage tea leaf inventory and suppliers."
          />
          <InstructionItem
            title="Users"
            description="Control access and manage administrator accounts."
          />
          <InstructionItem
            title="Packing & Finishing"
            description="Track production status and manage packaging operations."
          />
          <InstructionItem
            title="Sales & Invoices"
            description="Process orders, generate invoices, and track payments."
          />
          <InstructionItem
            title="Customer Database"
            description="Access customer information and purchase history."
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default InstructionsCard;
