import { useEffect, useState } from 'react';
import { getOnlineService, type OnlineConfig, type OnlineService } from '../state/index.ts';

export type ServiceState =
  | { status: 'unconfigured' }
  | { status: 'connecting' }
  | { status: 'failed' }
  | { status: 'ready'; service: OnlineService };

/** Connect to the online backend (once per page) and report progress. */
export function useOnlineService(config: OnlineConfig | null): ServiceState {
  const [state, setState] = useState<ServiceState>(
    config ? { status: 'connecting' } : { status: 'unconfigured' },
  );
  useEffect(() => {
    if (!config) return;
    let active = true;
    getOnlineService(config).then(
      (service) => active && setState({ status: 'ready', service }),
      () => active && setState({ status: 'failed' }),
    );
    return () => {
      active = false;
    };
  }, [config]);
  return state;
}
