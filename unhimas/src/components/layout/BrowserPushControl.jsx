import { useEffect, useState } from 'react';
import { MdNotificationsActive, MdNotificationsOff } from 'react-icons/md';
import { toast } from '../common/Toast';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../i18n';
import {
  disableBrowserPush,
  enableBrowserPush,
  getBrowserPushSubscription,
  getBrowserPushSupport,
  saveSubscription,
} from '../../services/browserPush';

export default function BrowserPushControl() {
  const { profile } = useAuth();
  const { translateText } = useTranslation();
  const [pushStatus, setPushStatus] = useState({ userId: null, supported: false, subscription: null });
  const [isBusy, setIsBusy] = useState(false);
  const supported = getBrowserPushSupport();
  const subscription = pushStatus.userId === profile?.id && pushStatus.supported === supported
    ? pushStatus.subscription
    : null;

  useEffect(() => {
    let isCurrent = true;

    if (!supported || !profile?.id || Notification.permission !== 'granted') {
      return () => {
        isCurrent = false;
      };
    }

    getBrowserPushSubscription()
      .then(async (currentSubscription) => {
        if (currentSubscription) await saveSubscription(profile.id, currentSubscription);
        if (isCurrent) {
          setPushStatus({ userId: profile.id, supported, subscription: currentSubscription });
        }
      })
      .catch((error) => {
        console.error('Unable to load browser push subscription:', error);
        toast.error('Unable to check browser push notification status.');
      });

    return () => {
      isCurrent = false;
    };
  }, [profile?.id, supported]);

  const handleToggle = async () => {
    if (!profile?.id || !supported) return;

    setIsBusy(true);
    try {
      if (subscription) {
        await disableBrowserPush(profile.id, subscription);
        setPushStatus({ userId: profile.id, supported, subscription: null });
        toast.success('Browser push notifications disabled.');
      } else {
        const newSubscription = await enableBrowserPush(profile.id);
        setPushStatus({ userId: profile.id, supported, subscription: newSubscription });
        toast.success('Browser push notifications enabled.');
      }
    } catch (error) {
      console.error('Unable to update browser push notifications:', error);
      toast.error(error.message || 'Unable to update browser push notification settings.');
    } finally {
      setIsBusy(false);
    }
  };

  if (!profile?.id) return null;

  const permissionDenied = supported && Notification.permission === 'denied';
  const title = !supported
    ? 'Browser push notifications are not available or configured.'
    : permissionDenied
      ? 'Browser notification permission is blocked in browser settings.'
      : subscription
        ? 'Disable browser push notifications on this device.'
        : 'Enable browser push notifications on this device.';

  return (
    <button
      type="button"
      className={`icon-btn${subscription ? ' push-notifications-enabled' : ''}`}
      onClick={handleToggle}
      disabled={!supported || permissionDenied || isBusy}
      aria-label={translateText(title)}
      title={translateText(title)}
      aria-pressed={Boolean(subscription)}
    >
      {subscription ? <MdNotificationsActive /> : <MdNotificationsOff />}
    </button>
  );
}
