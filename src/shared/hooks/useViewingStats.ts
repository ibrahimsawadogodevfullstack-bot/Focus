import { useEffect, useState } from 'react';

import type { ViewingStats } from '../../domain/viewing';
import {
  getViewingStats,
  initViewingStats,
  subscribeViewingStats,
} from '../../../services/viewingStats';

/**
 * Abonnement aux statistiques locales. L'initialisation est faite au
 * démarrage de l'application ; le hook relance la lecture si besoin (web,
 * rechargement à chaud) sans jamais bloquer l'écran.
 */
export function useViewingStats(profileId?: string): ViewingStats | null {
  const [stats, setStats] = useState<ViewingStats | null>(() => getViewingStats());

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeViewingStats((value) => {
      if (active) setStats(value);
    });

    initViewingStats(profileId)
      .then((value) => {
        if (active) setStats(value);
      })
      .catch(() => {
        // Le suivi est un confort : l'écran reste utilisable sans lui.
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [profileId]);

  return stats;
}
