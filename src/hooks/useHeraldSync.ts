import { useEffect, useRef, useState } from 'react';
import { getUnsyncedReports, markSynced } from '@/lib/herald-storage';
import { syncReport } from '@/lib/herald-api';
import { toSyncPayload } from '@/lib/herald-sync';

const SYNC_INTERVAL_MS = 5000;

export function useHeraldSync() {
  const [syncStatus, setSyncStatus] = useState<'ok' | 'error' | 'offline'>('ok');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const doSync = async () => {
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }

      const unsynced = getUnsyncedReports();
      if (unsynced.length === 0) {
        setSyncStatus('ok');
        return;
      }

      let allOk = true;
      for (const report of unsynced) {
        try {
          const ok = await syncReport(toSyncPayload(report));
          if (ok) {
            markSynced(report.id);
          } else {
            allOk = false;
          }
        } catch {
          allOk = false;
        }
      }
      setSyncStatus(allOk ? 'ok' : 'error');
    };

    const triggerSync = () => {
      void doSync();
    };

    triggerSync();
    intervalRef.current = setInterval(triggerSync, SYNC_INTERVAL_MS);
    window.addEventListener('online', triggerSync);
    window.addEventListener('focus', triggerSync);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('online', triggerSync);
      window.removeEventListener('focus', triggerSync);
    };
  }, []);

  return syncStatus;
}
