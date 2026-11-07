import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import {
  presentEmergencyNotification,
  playEmergencyAlarmSound,
  stopEmergencyAlarmSound,
  triggerResponderVibration,
  stopResponderVibration,
} from './services/notifications';

// Shared live report list for responders and admins.
// Loads everything once, then keeps it fresh through the realtime socket.
export function useReports() {
  const { socket, user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertReport, setAlertReport] = useState(null);

  const load = useCallback(async () => {
    try {
      const { reports: list } = await api.get('/api/reports?scope=all');
      setReports(list);
    } catch {
      // keep whatever we already have; the next refresh will retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (r) => {
      setReports((prev) => [r, ...prev.filter((x) => x.id !== r.id)]);
      setAlertReport(r);

      // Trigger high-urgency vibration, siren alarm sound, and local notification ONLY on responder users
      if (user?.role === 'responder') {
        triggerResponderVibration(user);
        playEmergencyAlarmSound(user);
        presentEmergencyNotification(r, user);
      }
    };
    const onUpdate = (r) => setReports((prev) => prev.map((x) => (x.id === r.id ? r : x)));
    socket.on('report:new', onNew);
    socket.on('report:update', onUpdate);
    socket.on('connect', load);
    return () => {
      socket.off('report:new', onNew);
      socket.off('report:update', onUpdate);
      socket.off('connect', load);
    };
  }, [socket, load, user]);

  const patch = useCallback(
    (r) => setReports((prev) => prev.map((x) => (x.id === r.id ? r : x))),
    []
  );

  const dismissAlert = useCallback(() => {
    stopEmergencyAlarmSound();
    stopResponderVibration();
    setAlertReport(null);
  }, []);

  return { reports, loading, reload: load, patch, alertReport, dismissAlert };
}
