/**
 * Supabase Presence hook — tracks which devices are online for a shift.
 *
 * Both crew and field devices join the same presence channel.
 * The crew page watches for field device presence to know if data is flowing.
 */
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useShiftPresence(
  shiftKey: string | undefined,
  deviceType: 'crew' | 'field',
) {
  const [fieldOnline, setFieldOnline] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!shiftKey) return;

    const channel = supabase.channel(`shift-presence-${shiftKey}`, {
      config: { presence: { key: deviceType + '-' + Math.random().toString(36).slice(2, 8) } },
    });

    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      let hasField = false;
      for (const key of Object.keys(state)) {
        for (const p of state[key] as any[]) {
          if (p.device_type === 'field') { hasField = true; break; }
        }
        if (hasField) break;
      }
      setFieldOnline(hasField);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          device_type: deviceType,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [shiftKey, deviceType]);

  return { fieldOnline };
}
