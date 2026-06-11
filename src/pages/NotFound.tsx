import { Home, SearchX } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-sm border-border/70 bg-card/80 shadow-soft backdrop-blur-sm">
        <CardContent className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-muted text-muted-foreground">
            <SearchX className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-primary">404</p>
            <h1 className="text-2xl font-extrabold tracking-tight">Halaman tidak ditemukan</h1>
            <p className="text-sm text-muted-foreground">
              Rute <span className="font-mono">{location.pathname}</span> tidak tersedia atau sudah dipindahkan.
            </p>
          </div>
          <Button asChild className="h-11 w-full rounded-full">
            <Link to="/dashboard">
              <Home className="mr-2 h-4 w-4" />
              Kembali ke Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotFound;
