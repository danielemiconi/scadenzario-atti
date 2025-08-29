import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase/config';
import { useAuth } from '../contexts/AuthContext';

export const useTrashCount = () => {
  const [trashCount, setTrashCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || (user.role !== 'admin' && user.email !== 'daniele.miconi@iblegal.it')) {
      setTrashCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    const q = query(
      collection(db, 'deadlines'),
      where('deleted', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTrashCount(snapshot.size);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to trash count:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { trashCount, loading };
};