import { useState, useCallback, useEffect } from 'react';
import { TopBar } from '@/components/herald/TopBar';
import { BottomNav } from '@/components/herald/BottomNav';
import { LiveTab } from '@/components/herald/LiveTab';
import { ReportsTab } from '@/components/herald/ReportsTab';
import { useHeraldSync } from '@/hooks/useHeraldSync';
import { getReports } from '@/lib/herald-storage';
import type { HeraldReport } from '@/lib/herald-types';

const Index = () => {
  const [activeTab, setActiveTab] = useState<'live' | 'reports'>('live');
  const [aiStatus, setAiStatus] = useState<'ok' | 'error'>('ok');
  const [reports, setReports] = useState<HeraldReport[]>([]);
  const syncStatus = useHeraldSync();

  useEffect(() => {
    setReports(getReports());
  }, [activeTab]);

  const refreshReports = useCallback(() => {
    setReports(getReports());
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopBar micStatus="granted" aiStatus={aiStatus} syncStatus={syncStatus} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'live' ? (
          <LiveTab
            onAiStatus={setAiStatus}
            onReportSaved={refreshReports}
          />
        ) : (
          <ReportsTab reports={reports} />
        )}
      </div>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
