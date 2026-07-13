import { Gauge } from "lucide-react";
import { EmptyState } from "../components/Pending";

export function BenchmarkPage() {
  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <EmptyState
        icon={<Gauge className="h-6 w-6" />}
        title="Benchmark er under udvikling"
        text="Ægte CPU-, GPU- og lagringstest kommer i en senere version. Der vises ingen resultater før modulet kører rigtige målinger på din maskine."
      />
    </div>
  );
}
