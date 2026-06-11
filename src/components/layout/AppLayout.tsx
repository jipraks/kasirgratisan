import { Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDefaultData } from '@/lib/db';
import { useEffect } from 'react';
import BottomNav from './BottomNav';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useCloudAutoBackup } from '@/hooks/use-cloud-auto-backup';
import Onboarding from '@/components/Onboarding';
import LoginScreen from '@/components/LoginScreen';
import PushPermissionModal from '@/components/PushPermissionModal';
import { useAuth } from '@/hooks/use-auth';

export default function AppLayout() {
  useThemeColor(); // Apply saved theme color on mount
  useCloudAutoBackup(); // Auto cloud backup on app open (if enabled & subscribed)
  const { multiUserEnabled, currentUser, loading } = useAuth();

  useEffect(() => {
    seedDefaultData();
  }, []);

  const storeSettings = useLiveQuery(() => db.storeSettings.toCollection().first());

  // Loading state
  if (storeSettings === undefined || loading) return null;

  // Show onboarding if not done yet
  if (!storeSettings || !storeSettings.onboardingDone) {
    return <Onboarding onComplete={() => { /* Dexie live query will auto-refresh */ }} />;
  }

  // Multi-user mode is on but no one is logged in → show login
  if (multiUserEnabled && !currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-background max-w-lg md:max-w-6xl mx-auto relative">
      <main className="pb-28">
        <Outlet />
      </main>
      <BottomNav />
      <PushPermissionModal />
    </div>
  );
}
