"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

interface Summary {
  pendingRewardHolds: number;
  pendingRewardMinor: number;
  atRiskUsers: number;
  signalsLast7d: number;
  pendingRoutes: number;
  pendingSegments: number;
  activitiesTotal: number;
  activitiesLast7d: number;
  xpAwardedTotal: number;
  activeUsersLast7d: number;
}

interface RewardHold {
  id: string;
  userName: string;
  username: string;
  amountMinor: number;
  reference: string;
  note: string | null;
  createdAt: string;
  riskState: string;
  riskScore: number;
}

interface AtRiskUser {
  userId: string;
  userName: string;
  username: string;
  riskScore: number;
  riskState: string;
  signalCount: number;
  lastSignalAt: string;
}

interface FraudSignal {
  id: string;
  userName: string;
  username: string;
  sourceType: string;
  signalKey: string;
  severity: number;
  createdAt: string;
}

interface PendingRoute {
  id: string;
  name: string;
  activityType: string;
  distanceMeters: number;
  completionsCount: number;
  creatorName: string;
  createdAt: string;
}

interface PendingSegment {
  id: string;
  name: string;
  activityType: string;
  attemptsCount: number;
  creatorName: string;
  createdAt: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const body = await res.json();
  return body.data as T;
}

function riskBadgeVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
  switch (state) {
    case "INVESTIGATE":
      return "destructive";
    case "RESTRICTED":
      return "destructive";
    case "MONITOR":
      return "secondary";
    default:
      return "outline";
  }
}

export function AdminDashboard() {
  const qc = useQueryClient();

  const summary = useQuery({
    queryKey: ["admin", "summary"],
    queryFn: () => fetchJson<Summary>("/api/admin/summary"),
  });

  const holds = useQuery({
    queryKey: ["admin", "reward-holds"],
    queryFn: () => fetchJson<RewardHold[]>("/api/admin/reward-holds?status=PENDING"),
  });

  const atRisk = useQuery({
    queryKey: ["admin", "at-risk-users"],
    queryFn: () => fetchJson<AtRiskUser[]>("/api/admin/at-risk-users"),
  });

  const signals = useQuery({
    queryKey: ["admin", "fraud-signals"],
    queryFn: () => fetchJson<FraudSignal[]>("/api/admin/fraud-signals"),
  });

  const pendingRoutes = useQuery({
    queryKey: ["admin", "routes"],
    queryFn: () => fetchJson<PendingRoute[]>("/api/admin/routes"),
  });

  const pendingSegments = useQuery({
    queryKey: ["admin", "segments"],
    queryFn: () => fetchJson<PendingSegment[]>("/api/admin/segments"),
  });

  const resolveHold = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "release" | "reject" }) => {
      const res = await fetch(`/api/admin/reward-holds/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("Failed to resolve hold");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reward-holds"] });
      qc.invalidateQueries({ queryKey: ["admin", "summary"] });
    },
  });

  const verifyRoute = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/routes/${id}/verify`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to verify route");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "routes"] });
      qc.invalidateQueries({ queryKey: ["admin", "segments"] });
      qc.invalidateQueries({ queryKey: ["admin", "summary"] });
    },
  });

  const s = summary.data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <h1 className="text-2xl font-bold dark:text-gray-100">Otter Trails · Moderation</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Pending reward holds" value={s?.pendingRewardHolds} />
          <StatCard label="Held (poisha)" value={s?.pendingRewardMinor} />
          <StatCard label="At-risk users (30d)" value={s?.atRiskUsers} />
          <StatCard label="Fraud signals (7d)" value={s?.signalsLast7d} />
          <StatCard label="Pending routes" value={s?.pendingRoutes} />
          <StatCard label="Pending segments" value={s?.pendingSegments} />
          <StatCard label="Activities (7d)" value={s?.activitiesLast7d} />
          <StatCard label="Active users (7d)" value={s?.activeUsersLast7d} />
        </div>

        <Tabs defaultValue="holds">
          <TabsList>
            <TabsTrigger value="holds">Reward holds</TabsTrigger>
            <TabsTrigger value="risk">At-risk users</TabsTrigger>
            <TabsTrigger value="signals">Fraud signals</TabsTrigger>
            <TabsTrigger value="routes">Pending routes</TabsTrigger>
            <TabsTrigger value="segments">Pending segments</TabsTrigger>
          </TabsList>

          <TabsContent value="holds">
            <Card>
              <CardHeader>
                <CardTitle>Pending reward holds (§54/§55)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(holds.data ?? []).map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{h.userName} (@{h.username})</TableCell>
                        <TableCell>{h.amountMinor} poisha</TableCell>
                        <TableCell>{h.reference}</TableCell>
                        <TableCell>
                          <Badge variant={riskBadgeVariant(h.riskState)}>
                            {h.riskState} ({h.riskScore})
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            onClick={() => resolveHold.mutate({ id: h.id, action: "release" })}
                            disabled={resolveHold.isPending}
                          >
                            Release
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => resolveHold.mutate({ id: h.id, action: "reject" })}
                            disabled={resolveHold.isPending}
                          >
                            Reject
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {holds.data?.length === 0 && <EmptyRow colSpan={5} label="No pending holds." />}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="risk">
            <Card>
              <CardHeader>
                <CardTitle>At-risk users (§54, MONITOR and above, 30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Signals</TableHead>
                      <TableHead>Last signal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(atRisk.data ?? []).map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell>{u.userName} (@{u.username})</TableCell>
                        <TableCell>
                          <Badge variant={riskBadgeVariant(u.riskState)}>
                            {u.riskState} ({u.riskScore})
                          </Badge>
                        </TableCell>
                        <TableCell>{u.signalCount}</TableCell>
                        <TableCell>{new Date(u.lastSignalAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {atRisk.data?.length === 0 && <EmptyRow colSpan={4} label="No at-risk users." />}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signals">
            <Card>
              <CardHeader>
                <CardTitle>Recent fraud signals (§54)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Signal</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(signals.data ?? []).map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>{f.userName} (@{f.username})</TableCell>
                        <TableCell>{f.sourceType}</TableCell>
                        <TableCell>{f.signalKey}</TableCell>
                        <TableCell>{f.severity}</TableCell>
                        <TableCell>{new Date(f.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {signals.data?.length === 0 && <EmptyRow colSpan={5} label="No fraud signals recorded." />}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routes">
            <Card>
              <CardHeader>
                <CardTitle>Pending route verification (§27/§28)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Route</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Distance</TableHead>
                      <TableHead>Follows</TableHead>
                      <TableHead>Creator</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pendingRoutes.data ?? []).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.activityType}</TableCell>
                        <TableCell>{Math.round(r.distanceMeters)}m</TableCell>
                        <TableCell>{r.completionsCount}</TableCell>
                        <TableCell>{r.creatorName}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => verifyRoute.mutate(r.id)}
                            disabled={verifyRoute.isPending}
                          >
                            Verify
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {pendingRoutes.data?.length === 0 && (
                      <EmptyRow colSpan={6} label="No routes waiting on verification." />
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="segments">
            <Card>
              <CardHeader>
                <CardTitle>Pending segments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Segments inherit their source route&apos;s verified state — verify the route
                  in the Pending routes tab to clear it here too.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Segment</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Creator</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pendingSegments.data ?? []).map((seg) => (
                      <TableRow key={seg.id}>
                        <TableCell>{seg.name}</TableCell>
                        <TableCell>{seg.activityType}</TableCell>
                        <TableCell>{seg.attemptsCount}</TableCell>
                        <TableCell>{seg.creatorName}</TableCell>
                      </TableRow>
                    ))}
                    {pendingSegments.data?.length === 0 && (
                      <EmptyRow colSpan={4} label="No segments waiting on verification." />
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold dark:text-gray-100">{value ?? "—"}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}
