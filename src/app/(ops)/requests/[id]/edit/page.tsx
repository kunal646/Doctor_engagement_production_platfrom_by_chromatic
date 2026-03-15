import { notFound } from "next/navigation";

import { NewRequestForm } from "@/components/new-request-form";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { RequestRow } from "@/lib/types";

function normalizeInitialFormData(formData: RequestRow["form_data"]) {
  const values: Record<string, string> = {};

  for (const [key, value] of Object.entries(formData)) {
    values[key] = Array.isArray(value) ? value.join(", ") : String(value ?? "");
  }

  return values;
}

export default async function EditDraftRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("requests")
    .select("*")
    .eq("id", id)
    .maybeSingle<RequestRow>();

  if (!request || request.status !== "draft") {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Draft Request</h1>
        <p className="text-sm text-muted-foreground">
          Continue filling the draft, optionally send it to the doctor for review, or submit it
          when ready.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <NewRequestForm
            requestId={request.id}
            initialDoctorName={request.doctor_name}
            initialFormData={normalizeInitialFormData(request.form_data)}
            initialYoungPhotoPath={String(request.form_data.young_photo_path ?? "")}
            initialCurrentPhotoPath={String(request.form_data.current_photo_path ?? "")}
            initialJourneyAudioPath={String(request.form_data.journey_audio_path ?? "")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
