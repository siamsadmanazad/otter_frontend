"use client";
import React, { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettingsApi } from "@/lib/requests";
import { DEFAULT_PREFERENCES, type BusinessPrefs } from "@/lib/preferences";
import { SettingsShell, SettingsSkeleton } from "./settings-shell";

export default function BusinessForm() {
  const [prefs, setPrefs] = useState<BusinessPrefs>(
    DEFAULT_PREFERENCES.business
  );

  const { data, isLoading } = useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      const res: any = await useSettingsApi.getPreferences();
      return res?.data;
    },
  });

  useEffect(() => {
    if (data?.preferences?.business) setPrefs(data.preferences.business);
  }, [data]);

  const save = useMutation({
    mutationFn: () => useSettingsApi.updatePreferences({ business: prefs }),
    onSuccess: () => toast.success("Business settings saved."),
    onError: (e: any) => toast.error(e?.message || "Failed to save."),
  });

  const disabled = !prefs.isBusiness;
  const set = (k: keyof BusinessPrefs, v: any) =>
    setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <SettingsShell
      title="Business"
      description="Customize your business / ecommerce profile."
    >
      {isLoading ? (
        <SettingsSkeleton />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <Label className="dark:text-gray-100">Business account</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Enable business features and fields.
              </p>
            </div>
            <Switch
              checked={prefs.isBusiness}
              onCheckedChange={(v) => set("isBusiness", v)}
            />
          </div>

          <div className="space-y-2">
            <Label className="dark:text-gray-100">Business name</Label>
            <Input
              value={prefs.businessName}
              disabled={disabled}
              onChange={(e) => set("businessName", e.target.value)}
              placeholder="Otter Travels Co."
            />
          </div>
          <div className="space-y-2">
            <Label className="dark:text-gray-100">Category</Label>
            <Input
              value={prefs.category}
              disabled={disabled}
              onChange={(e) => set("category", e.target.value)}
              placeholder="Travel agency"
            />
          </div>
          <div className="space-y-2">
            <Label className="dark:text-gray-100">Website</Label>
            <Input
              value={prefs.website}
              disabled={disabled}
              onChange={(e) => set("website", e.target.value)}
              placeholder="https://example.com"
            />
          </div>
          <div className="space-y-2">
            <Label className="dark:text-gray-100">Contact email</Label>
            <Input
              value={prefs.contactEmail}
              disabled={disabled}
              onChange={(e) => set("contactEmail", e.target.value)}
              placeholder="hello@example.com"
            />
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving..." : "Save changes"}
          </Button>
        </>
      )}
    </SettingsShell>
  );
}
