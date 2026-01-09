import { WifiOff, RefreshCw, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const { pendingCount, isSyncing, isOffline, syncAll } = useOfflineSync();

  if (!isOffline && pendingCount === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 flex items-center gap-3 border-2 border-border px-4 py-2 shadow-md",
      isOffline ? "bg-destructive text-destructive-foreground" : "bg-card"
    )}>
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">Offline Mode</span>
          {pendingCount > 0 && (
            <span className="text-xs">({pendingCount} pending)</span>
          )}
        </>
      ) : pendingCount > 0 ? (
        <>
          <Cloud className="h-4 w-4" />
          <span className="text-sm font-medium">{pendingCount} to sync</span>
          <Button
            size="sm"
            variant="outline"
            onClick={syncAll}
            disabled={isSyncing}
            className="h-7 px-2"
          >
            <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
          </Button>
        </>
      ) : null}
    </div>
  );
}
