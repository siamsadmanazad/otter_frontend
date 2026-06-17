"use client";
import { useAnalyticsApi } from "@/lib/requests";
import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/ui/loading-splash";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
);

import type {
  MonthlyData,
  AnalyticsData,
} from "./types";

export default function Analytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await useAnalyticsApi.getAnalytics();
        if (response.status === 200) {
          setAnalyticsData(response.data);
        } else {
          setError("Failed to fetch analytics data.");
        }
      } catch (err: any) {
        console.error("Error fetching analytics:", err);
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    if (!analyticsData && loading) {
      fetchData();
    }
  }, [analyticsData, loading]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <div className="md:ml-[300px] mx-auto p-6 text-center text-red-500 dark:bg-gray-900 dark:text-red-400 min-h-screen">
        <h2 className="text-2xl font-bold mb-4">Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="md:ml-[300px] mx-auto p-6 text-center text-gray-500 dark:bg-gray-900 dark:text-gray-400 min-h-screen">
        <h2 className="text-2xl font-bold mb-4">No Analytics Data Available</h2>
        <p>Please try again later.</p>
      </div>
    );
  }

  const { yearly, monthly } = analyticsData;

  const yearlyDistributionData = {
    labels: ["Posts", "Comments", "Likes", "Users Joined"],
    datasets: [
      {
        label: "Count",
        data: [
          yearly.postsThisYear,
          yearly.commentsThisYear,
          yearly.likesThisYear,
          yearly.usersJoinedThisYear,
        ],
        backgroundColor: [
          "rgba(255, 99, 132, 0.6)",
          "rgba(54, 162, 235, 0.6)",
          "rgba(255, 206, 86, 0.6)",
          "rgba(75, 192, 192, 0.6)",
        ],
        borderColor: [
          "rgba(255, 99, 132, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(255, 206, 86, 1)",
          "rgba(75, 192, 192, 1)",
        ],
        borderWidth: 1,
      },
    ],
  };

  const yearlyDistributionOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "rgb(156, 163, 175)", // Tailwind gray-400 for dark mode
        },
      },
      title: {
        display: true,
        text: "Yearly Activity Distribution",
        font: {
          size: 18,
        },
        color: "rgb(229, 231, 235)", // Tailwind gray-200 for dark mode
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || "";
            const value = context.raw;
            const total = context.dataset.data.reduce(
              (acc: number, val: number) => acc + val,
              0
            );
            const percentage =
              total > 0 ? ((value / total) * 100).toFixed(2) : 0;
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  const monthLabels = monthly.map((data) => data.month);

  const createMonthlyChartData = (
    label: string,
    dataKey: keyof MonthlyData,
    color: string
  ) => ({
    labels: monthLabels,
    datasets: [
      {
        label: label,
        data: monthly.map((data) => data[dataKey]),
        backgroundColor: color,
        borderColor: color.replace("0.6", "1"),
        borderWidth: 1,
      },
    ],
  });

  const monthlyChartOptions = (titleText: string) => ({
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "rgb(156, 163, 175)", // Tailwind gray-400 for dark mode
        },
      },
      title: {
        display: true,
        text: titleText,
        font: {
          size: 18,
        },
        color: "rgb(229, 231, 235)", // Tailwind gray-200 for dark mode
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Count",
          color: "rgb(156, 163, 175)", // Tailwind gray-400
        },
        ticks: {
          color: "rgb(156, 163, 175)", // Tailwind gray-400
        },
        grid: {
          color: "rgba(100, 100, 100, 0.2)", // Lighter grid lines for dark mode
        },
      },
      x: {
        title: {
          display: true,
          text: "Month",
          color: "rgb(156, 163, 175)", // Tailwind gray-400
        },
        ticks: {
          color: "rgb(156, 163, 175)", // Tailwind gray-400
        },
        grid: {
          color: "rgba(100, 100, 100, 0.2)", // Lighter grid lines for dark mode
        },
      },
    },
  });

  const postsMonthlyData = createMonthlyChartData(
    "Posts",
    "posts",
    "rgba(255, 99, 132, 0.6)"
  );
  const commentsMonthlyData = createMonthlyChartData(
    "Comments",
    "comments",
    "rgba(54, 162, 235, 0.6)"
  );
  const likesMonthlyData = createMonthlyChartData(
    "Likes",
    "likes",
    "rgba(255, 206, 86, 0.6)"
  );
  const usersJoinedMonthlyData = createMonthlyChartData(
    "Users Joined",
    "usersJoined",
    "rgba(75, 192, 192, 0.6)"
  );

  return (
    <div className="md:ml-[300px] mx-auto p-4 sm:p-6 lg:p-8 font-inter bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Link href="/settings">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Settings
        </Button>
      </Link>
      <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 mb-8 text-center dark:text-gray-100">
        TripOtter Analytics
      </h1>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center dark:text-gray-200">
          Yearly Overview ({new Date().getFullYear()})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-300">
            <p className="text-sm font-semibold opacity-80 mb-2">Total Posts</p>
            <p className="text-4xl font-bold">{yearly.postsThisYear}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-teal-600 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-300">
            <p className="text-sm font-semibold opacity-80 mb-2">
              Total Comments
            </p>
            <p className="text-4xl font-bold">{yearly.commentsThisYear}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-orange-600 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-300">
            <p className="text-sm font-semibold opacity-80 mb-2">Total Likes</p>
            <p className="text-4xl font-bold">{yearly.likesThisYear}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-500 to-cyan-600 text-white p-6 rounded-xl shadow-lg flex flex-col items-center justify-center transform hover:scale-105 transition-transform duration-300">
            <p className="text-sm font-semibold opacity-80 mb-2">
              New Users Joined
            </p>
            <p className="text-4xl font-bold">{yearly.usersJoinedThisYear}</p>
          </div>
        </div>
      </section>

      <section className="mb-12 bg-white p-6 rounded-xl shadow-lg dark:bg-gray-800 dark:border-gray-700">
        <div className="max-w-md mx-auto">
          <Doughnut
            data={yearlyDistributionData}
            options={yearlyDistributionOptions}
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold text-gray-700 mb-6 text-center dark:text-gray-200">
          Monthly Trends ({new Date().getFullYear()})
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-lg h-[400px] dark:bg-gray-800 dark:border-gray-700">
            <Bar
              data={postsMonthlyData}
              options={monthlyChartOptions("Monthly Posts")}
            />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg h-[400px] dark:bg-gray-800 dark:border-gray-700">
            <Bar
              data={commentsMonthlyData}
              options={monthlyChartOptions("Monthly Comments")}
            />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg h-[400px] dark:bg-gray-800 dark:border-gray-700">
            <Bar
              data={likesMonthlyData}
              options={monthlyChartOptions("Monthly Likes")}
            />
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg h-[400px] dark:bg-gray-800 dark:border-gray-700">
            <Bar
              data={usersJoinedMonthlyData}
              options={monthlyChartOptions("Monthly Users Joined")}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
