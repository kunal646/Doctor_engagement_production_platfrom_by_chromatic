import { notFound } from "next/navigation";

import { NewRequestForm } from "@/components/new-request-form";
import { parseAdditionalReferencePhotos } from "@/lib/additional-reference-photos";
import { parseSupportingPhotos } from "@/lib/supporting-photos";
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
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-5 md:px-6 md:py-8 lg:px-8">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Draft Workflow
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em]">Edit Draft Request</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Continue filling the draft, optionally send it to the doctor for review, or submit it
          when ready.
        </p>
      </div>
      <NewRequestForm
        requestId={request.id}
        initialDoctorName={request.doctor_name}
        initialFormData={normalizeInitialFormData(request.form_data)}
        initialYoungPhotoPath={String(request.form_data.young_photo_path ?? "")}
        initialCurrentPhotoPath={String(request.form_data.current_photo_path ?? "")}
        initialJourneyAudioPath={String(request.form_data.journey_audio_path ?? "")}
        initialAdditionalReferencePhotos={parseAdditionalReferencePhotos(
          request.form_data.additional_reference_photos,
        )}
        initialSupportingPhotos={parseSupportingPhotos(request.form_data.supporting_photos)}
      />
    </div>
  );
}
