import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { type LegendEntry } from '../types';

interface UseLegendReturn {
  legendEntries: LegendEntry[];
  validInitials: string[];
  loading: boolean;
}

export const useLegend = (): UseLegendReturn => {
  const [legendEntries, setLegendEntries] = useState<LegendEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'legend'),
      where('active', '==', true),
      orderBy('initials', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries: LegendEntry[] = [];
      snapshot.forEach((doc) => {
        entries.push({ id: doc.id, ...doc.data() } as LegendEntry);
      });
      setLegendEntries(entries);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const validInitials = legendEntries.map(entry => entry.initials);

  return { legendEntries, validInitials, loading };
};