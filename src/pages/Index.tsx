import { useState, useMemo, useCallback } from "react";
import { BarChart3, FileText, Loader2, RefreshCw } from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { MultiSelect } from "@/components/MultiSelect";
import { MetricChart } from "@/components/MetricChart";
import {
  parseExcelData,
  calculateMetrics,
  formatTime,
  formatMonth,
  type CarrierMetric,
} from "@/lib/lto-parser";

const Index = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<CarrierMetric[]>([]);
  const [carriers, setCarriers] = useState<string[]>([]);
  const [allMonths, setAllMonths] = useState<string[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = useCallback((data: ArrayBuffer, name: string) => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      try {
        const rows = parseExcelData(data);
        if (rows.length === 0) {
          setError("Plik nie zawiera prawidłowych danych. Sprawdź nazwy kolumn.");
          setLoading(false);
          return;
        }
        const result = calculateMetrics(rows);
        setMetrics(result.metrics);
        setCarriers(result.carriers);
        setAllMonths(result.months);
        setFileName(name);
        setSelectedCarriers([]);
        setSelectedMonths([]);
      } catch (e) {
        setError(`Błąd parsowania pliku: ${e instanceof Error ? e.message : "nieznany błąd"}`);
      }
      setLoading(false);
    }, 50);
  }, []);

  const visibleMonths = useMemo(
    () => (selectedMonths.length === 0 ? allMonths : allMonths.filter((m) => selectedMonths.includes(m))),
    [allMonths, selectedMonths]
  );

  const filteredData = useMemo(() => {
    let d = metrics;
    const sc = selectedCarriers.filter((c) => c !== "__none__");
    const sm = selectedMonths.filter((m) => m !== "__none__");
    if (selectedCarriers.includes("__none__") && sc.length === 0) return [];
    if (selectedMonths.includes("__none__") && sm.length === 0) return [];
    if (sc.length > 0 && sc.length < carriers.length) d = d.filter((r) => sc.includes(r.carrier));
    if (sm.length > 0 && sm.length < allMonths.length) d = d.filter((r) => sm.includes(r.month));
    return d;
  }, [metrics, selectedCarriers, selectedMonths, carriers, allMonths]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-4">
        <Loader2 className="w-14 h-14 text-primary animate-spin" />
        <p className="text-lg font-medium text-muted-foreground">
          ⚙️ Ładuję dane i szykuję raport...
        </p>
      </div>
    );
  }

  if (!fileName) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-extrabold text-foreground">
              Raport Analityczny LTO
            </h1>
            <p className="text-muted-foreground mt-2">
              Wgraj plik danych (XLSX/CSV) aby wygenerować raporty wydajności
            </p>
          </div>
          <FileUpload onFileLoaded={handleFile} />
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-xl text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  const isSingleCarrier = selectedCarriers.length === 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-[1920px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Raport LTO</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="w-3 h-3" />
                <span>{fileName}</span>
                <span>•</span>
                <span>{allMonths.length} mies.</span>
                <span>•</span>
                <span>{carriers.length} przewoźników</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <MultiSelect
              label="Przewoźnik"
              items={carriers}
              value={selectedCarriers}
              onChange={setSelectedCarriers}
              allLabel="Wszyscy przewoźnicy"
              countLabel={(n) => `${n} przewoźników`}
            />
            <MultiSelect
              label="Miesiąc"
              items={allMonths}
              value={selectedMonths}
              onChange={setSelectedMonths}
              allLabel="Wszystkie miesiące"
              formatItem={formatMonth}
              countLabel={(n) => `${n} miesięcy`}
            />
            <button
              onClick={() => {
                setFileName(null);
                setMetrics([]);
                setCarriers([]);
                setAllMonths([]);
              }}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg border border-border hover:bg-accent"
            >
              <RefreshCw className="w-4 h-4" />
              Zmień plik
            </button>
          </div>
        </div>
      </header>

      <main
        className={`max-w-[1920px] mx-auto px-6 py-8 grid gap-6 ${
          isSingleCarrier ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
        }`}
      >
        <MetricChart
          title="Wydajność – paczki"
          subtitle="Paczki / kurier / dzień roboczy"
          data={filteredData}
          dataKey="parcelEfficiency"
          months={visibleMonths}
          selectedCarriers={selectedCarriers}
          carriers={carriers}
          color="hsl(220, 70%, 50%)"
          formatValue={(v) => String(Math.round(v))}
        />
        <MetricChart
          title="Wydajność – stopy"
          subtitle="Stopy / kurier / dzień roboczy"
          data={filteredData}
          dataKey="stopEfficiency"
          months={visibleMonths}
          selectedCarriers={selectedCarriers}
          carriers={carriers}
          color="hsl(160, 60%, 45%)"
          formatValue={(v) => String(Math.round(v))}
        />
        <MetricChart
          title="Czas pracy na rejonie"
          subtitle="Średni czas (h:min) na kuriera dziennie"
          data={filteredData}
          dataKey="avgRouteTime"
          months={visibleMonths}
          selectedCarriers={selectedCarriers}
          carriers={carriers}
          unit=" h"
          color="hsl(35, 90%, 55%)"
          formatValue={formatTime}
        />
        <MetricChart
          title="Średnia liczba kurierów"
          subtitle="Standardowi kurierzy (bez dodatków, skoczków, pojazdów specjalnych)"
          data={filteredData}
          dataKey="avgCouriers"
          months={visibleMonths}
          selectedCarriers={selectedCarriers}
          carriers={carriers}
          color="hsl(280, 60%, 55%)"
        />
      </main>

      {error && (
        <div className="max-w-[1920px] mx-auto px-6 pb-6">
          <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm">{error}</div>
        </div>
      )}
    </div>
  );
};

export default Index;
