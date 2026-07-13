import { FlaskConical } from "lucide-react";
import { EmptyState } from "../components/Pending";

export function LabPage() {
  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <EmptyState
        icon={<FlaskConical className="h-6 w-6" />}
        title="Lab er tomt lige nu"
        text="Her lander eksperimentelle værktøjer, når de er klar til at køre mod rigtige systemdata. Ingen fiktive funktioner vises."
      />
    </div>
  );
}
