"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type RequestFormPreviewField = {
  key: string;
  label: string;
  value: string;
  section: string;
  required?: boolean;
  description?: string;
};

export function RequestFormPreview({ fields }: { fields: RequestFormPreviewField[] }) {
  const [isOpen, setIsOpen] = useState(true);
  const sections = Array.from(new Set(fields.map((field) => field.section)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filled Form Preview</CardTitle>
        <CardDescription>
          See the request as form answers with proper labels, including fields left blank.
        </CardDescription>
        <CardAction>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen((v) => !v)}>
            {isOpen ? (
              <>
                <EyeOffIcon className="size-4" />
                Hide
              </>
            ) : (
              <>
                <EyeIcon className="size-4" />
                Preview
              </>
            )}
          </Button>
        </CardAction>
      </CardHeader>
      {isOpen ? (
        <CardContent className="space-y-6">
          {sections.map((section) => (
            <div key={section} className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {section}
              </p>
              <div className="grid gap-3">
                {fields
                  .filter((field) => field.section === section)
                  .map((field) => {
                    const isBlank = field.value.trim().length === 0;
                    return (
                      <div key={field.key} className="rounded-sm border bg-muted/20 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">
                            {field.label}
                            {field.required ? " *" : ""}
                          </p>
                          {isBlank ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                              Not filled
                            </span>
                          ) : null}
                        </div>
                        {field.description ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {field.description}
                          </p>
                        ) : null}
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                          {isBlank ? "-" : field.value}
                        </p>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}
