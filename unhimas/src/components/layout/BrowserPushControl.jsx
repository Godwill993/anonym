import { useEffect, useState } from 'react';
import { MdNotifications, MdNotificationsActive } from 'react-icons/md';
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
  const label = !supported
    ? 'Push notifications unavailable'
    : permissionDenied
      ? 'Allow notifications in browser settings'
      : subscription
        ? 'Push notifications enabled'
        : 'Enable push notifications';

  return (
    <button
      type="button"
      className={`btn btn-sm ${subscription ? 'btn-primary' : 'btn-outline'}`}
      onClick={handleToggle}
      disabled={!supported || permissionDenied || isBusy}
      aria-label={translateText(label)}
      title={translateText(label)}
      aria-pressed={Boolean(subscription)}
    >
      {subscription ? <MdNotificationsActive /> : <MdNotifications />}
      {translateText(isBusy ? 'Updating notifications…' : label)}
    </button>
  );
}
