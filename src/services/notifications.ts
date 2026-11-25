export type NotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function getNotificationStatus(): NotificationStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  const result = await Notification.requestPermission();
  return result;
}

export async function sendDisasterNotification(title: string, body: string, tag = 'siaga-tapteng-alert') {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          tag,
          requireInteraction: true,
        });
        return true;
      }
    }
    new Notification(title, { body, icon: '/icon.svg', tag });
    return true;
  } catch {
    return false;
  }
}
