import React, { useState, useCallback } from 'react';
import { ArrowLeft, Database, Download, FileJson, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';

interface TableInfo {
  name: string;
  count: number;
}

type TableStatus = 'idle' | 'downloading' | 'done' | 'error';

interface TableProgress {
  status: TableStatus;
  downloaded: number;
  total: number;
}

export const DatabaseBackup = ({ onBack }: { onBack: () => void }) => {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableProgress, setTableProgress] = useState<Record<string, TableProgress>>({});
  const [isBackingUp, setIsBackingUp] = useState(false);
  const { toast } = useToast();

  const fetchTableList = useCallback(async () => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const res = await fetch(`${supabaseUrl}/functions/v1/backup-table?action=list`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();

      const tableList: TableInfo[] = Object.entries(result.tables as Record<string, number>)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setTables(tableList);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to fetch table list', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchTableList();
  }, [fetchTableList]);

  const fetchTableData = async (tableName: string, total: number): Promise<any[]> => {
    const allData: any[] = [];
    const chunkSize = 5000;
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    for (let offset = 0; offset < total; offset += chunkSize) {
      const res = await fetch(
        `${supabaseUrl}/functions/v1/backup-table?action=fetch&table=${tableName}&offset=${offset}&limit=${chunkSize}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!res.ok) throw new Error(`Failed to fetch ${tableName}: ${await res.text()}`);
      const result = await res.json();
      allData.push(...(result.data || []));

      setTableProgress(prev => ({
        ...prev,
        [tableName]: { status: 'downloading', downloaded: Math.min(offset + chunkSize, total), total },
      }));
    }

    return allData;
  };

  const downloadSingleTable = async (tableName: string, total: number) => {
    setTableProgress(prev => ({ ...prev, [tableName]: { status: 'downloading', downloaded: 0, total } }));
    try {
      const data = await fetchTableData(tableName, total);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setTableProgress(prev => ({ ...prev, [tableName]: { status: 'done', downloaded: total, total } }));
      toast({ title: 'Downloaded', description: `${tableName} (${total.toLocaleString()} rows)` });
    } catch (err) {
      setTableProgress(prev => ({ ...prev, [tableName]: { status: 'error', downloaded: 0, total } }));
      toast({ title: 'Download Failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const downloadAllAsZip = async () => {
    setIsBackingUp(true);
    const zip = new JSZip();
    const dateStr = new Date().toISOString().split('T')[0];
    const folder = zip.folder(`backup-${dateStr}`)!;

    // Init progress for all
    const initProgress: Record<string, TableProgress> = {};
    tables.forEach(t => { initProgress[t.name] = { status: 'idle', downloaded: 0, total: t.count }; });
    setTableProgress(initProgress);

    try {
      for (const table of tables) {
        setTableProgress(prev => ({ ...prev, [table.name]: { status: 'downloading', downloaded: 0, total: table.count } }));
        
        if (table.count === 0) {
          folder.file(`${table.name}.json`, '[]');
          setTableProgress(prev => ({ ...prev, [table.name]: { status: 'done', downloaded: 0, total: 0 } }));
          continue;
        }

        const data = await fetchTableData(table.name, table.count);
        folder.file(`${table.name}.json`, JSON.stringify(data, null, 2));
        setTableProgress(prev => ({ ...prev, [table.name]: { status: 'done', downloaded: table.count, total: table.count } }));
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${dateStr}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Full Backup Complete', description: `All ${tables.length} tables downloaded as ZIP` });
    } catch (err) {
      toast({ title: 'Backup Failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsBackingUp(false);
    }
  };

  const totalRows = tables.reduce((sum, t) => sum + t.count, 0);

  const getStatusIcon = (status: TableStatus) => {
    switch (status) {
      case 'downloading': return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'done': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  return (
    <div className="py-4 md:py-6 px-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-display font-bold">Database Backup</h2>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading table info...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {tables.length} tables · {totalRows.toLocaleString()} total rows
            </p>
            <Button onClick={downloadAllAsZip} disabled={isBackingUp || tables.length === 0} size="lg">
              {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {isBackingUp ? 'Backing up...' : 'Download All (ZIP)'}
            </Button>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1fr_100px_120px_60px] gap-2 px-4 py-2 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Table</span>
              <span className="text-right">Rows</span>
              <span className="text-center">Progress</span>
              <span></span>
            </div>

            {tables.map((table) => {
              const progress = tableProgress[table.name];
              const pct = progress && progress.total > 0 ? Math.round((progress.downloaded / progress.total) * 100) : 0;

              return (
                <div key={table.name} className="grid grid-cols-[1fr_100px_120px_60px] gap-2 px-4 py-2.5 border-t border-border items-center hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(progress?.status || 'idle')}
                    <span className="text-sm font-medium truncate">{table.name}</span>
                  </div>
                  <span className="text-sm text-right text-muted-foreground">{table.count.toLocaleString()}</span>
                  <div className="px-1">
                    {progress?.status === 'downloading' && (
                      <Progress value={pct} className="h-2" />
                    )}
                    {progress?.status === 'done' && (
                      <span className="text-xs text-emerald-500">✓ Done</span>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isBackingUp || progress?.status === 'downloading'}
                      onClick={() => downloadSingleTable(table.name, table.count)}
                      title="Download JSON"
                    >
                      <FileJson className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
