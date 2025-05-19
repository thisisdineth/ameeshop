
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WelcomeCardProps {
  userName?: string;
}

const WelcomeCard: React.FC<WelcomeCardProps> = ({ userName = 'Administrator' }) => {
  // Get current time of day
  const hour = new Date().getHours();
  let greeting = 'Good Morning';
  
  if (hour >= 12 && hour < 17) {
    greeting = 'Good Afternoon';
  } else if (hour >= 17) {
    greeting = 'Good Evening';
  }

  return (
    <Card className="border-l-4 border-l-tea-600 shadow-md bg-gradient-to-r from-white to-tea-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold tracking-tight">
          {greeting}, {userName}!
        </CardTitle>
        <CardDescription>
          Welcome to your Amee-Tea control panel
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Manage your tea distribution operations from this central dashboard. 
          Use the sidebar to navigate to different sections.
        </p>
      </CardContent>
    </Card>
  );
};

export default WelcomeCard;
