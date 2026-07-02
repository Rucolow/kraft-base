import { useEffect } from 'react';

// Drives the service-worker update *check*. The reception iPad runs as a
// standalone PWA that stays open for days; the browser only checks for a new SW
// on navigation loads, which may never happen here — so a stale build could
// serve indefinitely (the "needed clear-site-data" incident). registerType is
// 'autoUpdate', so once a new SW is found it installs and reloads on its own;
// all this needs to do is periodically call registration.update() to trigger
// that check. We skip the check while a guest is on the /checkin kiosk so an
// auto-reload never interrupts someone filling the legal register.
export function SWUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }
    let registration: ServiceWorkerRegistration | undefined;
    navigator.serviceWorker.ready.then((r) => {
      registration = r;
    });
    const check = () => {
      if (!registration) {
        return;
      }
      if (window.location.pathname.startsWith('/checkin')) {
        return;
      }
      registration.update().catch(() => undefined);
    };
    const hourly = setInterval(check, 60 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        check();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(hourly);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
