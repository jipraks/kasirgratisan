import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function AppLayout() {
  useThemeColor(); // Apply saved theme color on mount

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <main className="pb-20">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
