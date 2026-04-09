import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 1024;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isMobileDevice = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    return isMobileDevice || (window.innerWidth < MOBILE_BREAKPOINT && 'ontouchstart' in window);
  });

  useEffect(() => {
    const handleResize = () => {
      const isMobileDevice = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
      setIsMobile(isMobileDevice || (window.innerWidth < MOBILE_BREAKPOINT && 'ontouchstart' in window));
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return isMobile;
}
