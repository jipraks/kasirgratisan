import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type WhatsNewFeature,
  markFeaturesSeen,
} from '@/lib/whats-new';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

interface WhatsNewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  features: WhatsNewFeature[];
  /**
   * When true, ids of shown features are persisted as "seen" on dismiss.
   * Set to false when manually opened from Settings (read-only re-view).
   */
  markSeenOnClose?: boolean;
}

export default function WhatsNewModal({
  open,
  onOpenChange,
  features,
  markSeenOnClose = true,
}: WhatsNewModalProps) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  // Reset to first slide whenever the modal is reopened or the list changes.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open, features]);

  if (features.length === 0) return null;

  const safeIndex = Math.min(index, features.length - 1);
  const current = features[safeIndex];
  const Icon = current.icon;
  const isLast = safeIndex === features.length - 1;
  const isFirst = safeIndex === 0;

  const handleClose = async () => {
    if (markSeenOnClose) {
      await markFeaturesSeen(features.map((f) => f.id));
    }
    onOpenChange(false);
  };

  const handleCta = async () => {
    if (!current.cta) return;
    if (markSeenOnClose) {
      await markFeaturesSeen(features.map((f) => f.id));
    }
    onOpenChange(false);
    navigate(current.cta.to);
  };

  const next = () => {
    if (!isLast) setIndex((i) => i + 1);
  };
  const prev = () => {
    if (!isFirst) setIndex((i) => i - 1);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          // Treat outside-click and ESC as dismissal too — mark as seen.
          void handleClose();
        } else {
          onOpenChange(o);
        }
      }}
    >
      <DialogContent className="max-w-[95vw] rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Yang Baru di KasirGratisan
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Slide content */}
          <div className="flex flex-col items-center text-center space-y-4 py-2">
            <div
              className={cn(
                'w-20 h-20 rounded-3xl flex items-center justify-center',
                current.iconColor,
              )}
            >
              <Icon className="w-10 h-10" />
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {format(new Date(current.publishedAt), 'd MMMM yyyy', { locale: idLocale })}
              </p>
              <h3 className="text-lg font-bold tracking-tight">{current.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {current.description}
              </p>
            </div>
          </div>

          {/* Pagination dots */}
          {features.length > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {features.map((f, i) => (
                <button
                  key={f.id}
                  onClick={() => setIndex(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === safeIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/25',
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-2 pt-1">
            {features.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={prev}
                disabled={isFirst}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}

            {current.cta ? (
              <Button onClick={handleCta} className="flex-1 h-11 text-sm font-semibold">
                {current.cta.label}
              </Button>
            ) : isLast ? (
              <Button onClick={handleClose} className="flex-1 h-11 text-sm font-semibold">
                Selesai
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={handleClose}
                className="flex-1 h-11 text-sm text-muted-foreground"
              >
                Lewati
              </Button>
            )}

            {features.length > 1 && (
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0"
                onClick={isLast ? handleClose : next}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
