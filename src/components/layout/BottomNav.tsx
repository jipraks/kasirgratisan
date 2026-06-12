import { Home, Package, BarChart3, Settings, ShoppingCart } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', icon: Home, label: 'Beranda' },
  { to: '/products', icon: Package, label: 'Produk' },
  { to: '/cashier', icon: ShoppingCart, label: 'Kasir', isCta: true },
  { to: '/reports', icon: BarChart3, label: 'Laporan' },
  { to: '/settings', icon: Settings, label: 'Lainnya' },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:px-4">
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center rounded-[2rem] border border-border/70 bg-card/95 px-2 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl md:max-w-xl">
        {navItems.map(({ to, icon: Icon, label, isCta }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'group flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl text-center transition-all active:scale-95',
                isCta ? 'relative -mt-5' : 'h-14 px-1.5',
                !isCta && (isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'),
              )
            }
          >
            {({ isActive }) =>
              isCta ? (
                <>
                  <div
                    className={cn(
                      'flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/25 transition-transform group-hover:-translate-y-0.5',
                      isActive && 'ring-4 ring-primary/20',
                    )}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2.5} />
                  </div>
                  <span className={cn('text-[10px] font-extrabold leading-none', isActive ? 'text-primary' : 'text-muted-foreground')}>
                    {label}
                  </span>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      'flex h-8 w-11 items-center justify-center rounded-full transition-colors',
                      isActive ? 'bg-primary/10' : 'group-hover:bg-muted',
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className="max-w-full truncate text-[10px] font-bold leading-none">{label}</span>
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
