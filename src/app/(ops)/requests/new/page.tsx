import { NewRequestForm } from "@/components/new-request-form";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

export default function NewRequestPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Request</h1>
        <p className="text-sm text-muted-foreground">
          Start a new request, save it as a draft, or submit it when it is ready for production.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <NewRequestForm />
        </CardContent>
      </Card>
    </div>
  );
}
