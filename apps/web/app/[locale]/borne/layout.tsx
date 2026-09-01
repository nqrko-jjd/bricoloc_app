'use client';
import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { resetKioskSession } from '@/lib/kiosk';

const IDLE_MS = 90_000;

export default function BorneLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function reset() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        resetKioskSession();
        if (pathname !== '/borne') router.push('/borne');
      }, IDLE_MS);
    }
    const events = ['pointerdown', 'keydown', 'touchstart', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname, router]);

  return <div className="kiosk">{children}</div>;
}
