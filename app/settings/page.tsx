import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModeToggle } from "@/components/ui/theme-provider";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "Settings",
      default: "Settings",
    },
  };
}

export default function Settings() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <Card className="dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl dark:text-gray-100">Preview Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 border rounded-lg dark:border-gray-700">
              <div className="flex flex-row items-center justify-between">
                <div className="flex flex-col">
                  <h3 className="font-semibold mb-2 dark:text-gray-100">Theme settings</h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Turn on dark mode or switch to light mode.
                  </p>
                </div>
                <ModeToggle/>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl dark:text-gray-100">Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Link href="/settings/account-settings">
              <div className="p-4 border rounded-lg dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <h3 className="font-semibold mb-2 dark:text-gray-100">Account Settings</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Manage your account preferences and privacy settings.
                </p>
              </div>
            </Link>
            {/* Dimmed sections */}
            <div className="p-4 border rounded-lg opacity-50 grayscale cursor-not-allowed dark:border-gray-700">
              <h3 className="font-semibold mb-2 dark:text-gray-100">Notifications</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Control how you receive notifications.
              </p>
            </div>
            <div className="p-4 border rounded-lg opacity-50 grayscale cursor-not-allowed dark:border-gray-700">
              <h3 className="font-semibold mb-2 dark:text-gray-100">Privacy</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your privacy and data settings.
              </p>
            </div>
            <div className="p-4 border rounded-lg opacity-50 grayscale cursor-not-allowed dark:border-gray-700">
              <h3 className="font-semibold mb-2 dark:text-gray-100">Business</h3>
              <p className="text-gray-600 dark:text-gray-400">Customize your ecommerce experience.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-4 dark:bg-gray-800 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-2xl dark:text-gray-100">Others</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Link href="/misc/analytics">
              <div className="p-4 border rounded-lg dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <h3 className="font-semibold mb-2 dark:text-gray-100">Analytics</h3>
                <p className="text-gray-600 dark:text-gray-400">Check the platforms analytics</p>
              </div>
            </Link>

            <Link href="/misc/reviews">
              <div className="p-4 border rounded-lg dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <h3 className="font-semibold mb-2 dark:text-gray-100">Reviews and Issues</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Check what users are saying and updates of the created issues.
                </p>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
