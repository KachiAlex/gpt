// Custom hook to prevent memory leaks and DOM node warnings
import { useEffect, useRef } from 'react';

/**
 * Hook to track if component is mounted and prevent state updates after unmount
 * Usage: const isMounted = useCleanup();
 */
export const useCleanup = () => {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef.current;
};

/**
 * Hook to safely call async functions and prevent state updates after unmount
 * Usage: const safeAsync = useSafeAsync();
 */
export const useSafeAsync = () => {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeAsync = async (asyncFn) => {
    try {
      const result = await asyncFn();
      if (isMountedRef.current) {
        return result;
      }
    } catch (error) {
      if (isMountedRef.current) {
        throw error;
      }
    }
  };

  return safeAsync;
};
