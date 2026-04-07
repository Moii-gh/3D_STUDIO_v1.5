import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < MOBILE_BREAKPOINT || 
           ('ontouchstart' in window && window.innerWidth < 1024);
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        window.innerWidth < MOBILE_BREAKPOINT || 
        ('ontouchstart' in window && window.innerWidth < 1024)
      );
    };

    // Also check orientation change for tablets
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return isMobile;
}
