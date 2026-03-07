import { createCompanyWithOpsAction, addUserToCompanyAction } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Profile } from "@/lib/types";

export default async function AdminCompaniesPage() {
  const supabase = await createClient();

  const { data: companies } = await supabase
    .from("companies")
    .select("id,name,created_at")
    .order("created_at", { ascending: false });

  const { data: userProfiles } = await supabase
    .from("profiles")
    .select("company_id,role")
    .in("role", ["ops", "supervisor"])
    .returns<Pick<Profile, "company_id" | "role">[]>();

  const countsByCompany = (userProfiles ?? []).reduce<
    Record<string, { ops: number; supervisor: number }>
  >((acc, item) => {
    if (item.company_id) {
      if (!acc[item.company_id]) {
        acc[item.company_id] = { ops: 0, supervisor: 0 };
      }
      if (item.role === "ops") {
        acc[item.company_id].ops++;
      } else if (item.role === "supervisor") {
        acc[item.company_id].supervisor++;
      }
    }
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-6 md:py-8 lg:px-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
        <p className="text-sm text-muted-foreground">
          Create company accounts and provision user credentials.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Company + User</CardTitle>
          <CardDescription>
            Create a new company and an associated user account (ops or supervisor).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createCompanyWithOpsAction} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input id="company_name" name="company_name" required placeholder="Acme Health" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">User Full Name</Label>
              <Input id="full_name" name="full_name" required placeholder="Jane Smith" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required placeholder="user@company.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Min 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                defaultValue="ops"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="ops">Operator (Ops)</option>
                <option value="supervisor">Supervisor (Read-Only)</option>
              </select>
            </div>
            <div className="flex items-end md:col-span-1">
              <SubmitButton type="submit" className="w-full">Create Company</SubmitButton>
            </div>
          </form>
        </CardContent>
      </Card>

      {companies && companies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Add User to Existing Company</CardTitle>
            <CardDescription>
              Add an ops or supervisor account to an existing company.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={addUserToCompanyAction} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="add_company_id">Company</Label>
                <select
                  id="add_company_id"
                  name="company_id"
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select a company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add_full_name">User Full Name</Label>
                <Input id="add_full_name" name="full_name" required placeholder="Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add_email">Email</Label>
                <Input id="add_email" name="email" type="email" required placeholder="user@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add_password">Password</Label>
                <Input
                  id="add_password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min 8 characters"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add_role">Role</Label>
                <select
                  id="add_role"
                  name="role"
                  defaultValue="ops"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="ops">Operator (Ops)</option>
                  <option value="supervisor">Supervisor (Read-Only)</option>
                </select>
              </div>
              <div className="flex items-end md:col-span-1">
                <SubmitButton type="submit" className="w-full">Add User</SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Companies</CardTitle>
          <CardDescription>
            {companies?.length ?? 0} companies registered on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Ops Users</TableHead>
                <TableHead>Supervisors</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(companies ?? []).map((company) => {
                const counts = countsByCompany[company.id] ?? { ops: 0, supervisor: 0 };
                return (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{counts.ops}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{counts.supervisor}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(company.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!companies || companies.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No companies created yet.
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
