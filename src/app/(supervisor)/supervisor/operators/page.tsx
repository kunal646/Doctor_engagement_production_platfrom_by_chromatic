import Link from "next/link";
import { EyeIcon, UserIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Profile, RequestRow } from "@/lib/types";

export default async function SupervisorOperatorsPage() {
  const { profile } = await getCurrentUserAndProfile();
  const supabase = await createClient();

  const { data: operators } = await supabase
    .from("profiles")
    .select("id,full_name,email,created_at")
    .eq("company_id", profile.company_id!)
    .eq("role", "ops")
    .order("created_at", { ascending: true })
    .returns<Pick<Profile, "id" | "full_name" | "email" | "created_at">[]>();

  const { data: requests } = await supabase
    .from("requests")
    .select("id,created_by,status")
    .eq("company_id", profile.company_id!)
    .returns<Pick<RequestRow, "id" | "created_by" | "status">[]>();

  const statsByOperator = new Map<
    string,
    { total: number; delivered: number; pending: number }
  >();
  for (const req of requests ?? []) {
    const stats = statsByOperator.get(req.created_by) ?? {
      total: 0,
      delivered: 0,
      pending: 0,
    };
    stats.total++;
    if (req.status === "video_delivered") {
      stats.delivered++;
    } else {
      stats.pending++;
    }
    statsByOperator.set(req.created_by, stats);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operators</h1>
          <p className="text-sm text-muted-foreground">
            All operator accounts in your company.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5 text-xs">
          <EyeIcon className="size-3" />
          Read Only
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operator Accounts</CardTitle>
          <CardDescription>
            {operators?.length ?? 0} operators in your company.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4 md:pl-6">Operator</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Total Requests</TableHead>
                <TableHead className="text-center">Delivered</TableHead>
                <TableHead className="text-center">In Progress</TableHead>
                <TableHead className="pr-4 text-right md:pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(operators ?? []).map((op) => {
                const stats = statsByOperator.get(op.id) ?? {
                  total: 0,
                  delivered: 0,
                  pending: 0,
                };
                return (
                  <TableRow key={op.id}>
                    <TableCell className="pl-4 md:pl-6">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-muted">
                          <UserIcon className="size-3.5 text-muted-foreground" />
                        </div>
                        <span className="font-medium">
                          {op.full_name || "Unnamed"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {op.email}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {stats.total}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {stats.delivered}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {stats.pending}
                    </TableCell>
                    <TableCell className="pr-4 text-right md:pr-6">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/supervisor/dashboard?operator=${op.id}`}
                        >
                          View Requests
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!operators || operators.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No operators found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
