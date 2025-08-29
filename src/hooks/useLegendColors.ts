import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { type LegendEntry } from '../types';

interface LegendColors {
  backgroundColor: string;
  textColor: string;
}

interface UseLegendColorsReturn {
  getColors: (initials: string) => LegendColors;
  loading: boolean;
}

export const useLegendColors = (): UseLegendColorsReturn => {
  const [colorsMap, setColorsMap] = useState<Record<string, LegendColors>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'legend'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newColorsMap: Record<string, LegendColors> = {};
      
      snapshot.forEach((doc) => {
        const entry = doc.data() as LegendEntry;
        newColorsMap[entry.initials] = {
          backgroundColor: entry.backgroundColor || '#f3f4f6',
          textColor: entry.textColor || '#1f2937',
        };
      });
      
      setColorsMap(newColorsMap);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getColors = (initials: string): LegendColors => {
    return colorsMap[initials] || {
      backgroundColor: '#f3f4f6',
      textColor: '#1f2937',
    };
  };

  return { getColors, loading };
};