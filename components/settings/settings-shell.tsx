"use client";
import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SettingsShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/settings">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl dark:text-gray-100">{title}</CardTitle>
            {description && (
              <p className="text-gray-600 dark:text-gray-400">{description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-12 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"
        />
      ))}
    </div>
  );
}
