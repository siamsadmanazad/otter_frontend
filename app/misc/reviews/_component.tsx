"use client";

import React, { useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  MessageSquareText,
  Bug,
  Tag,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  User,
  Loader2,
} from "lucide-react";
import { useReviewAPI } from "@/lib/requests";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useInfiniteQuery } from "@tanstack/react-query";

dayjs.extend(relativeTime);

import type { ReviewDocument, ReviewCardProps } from "./types";
import { GridMedia } from "@/components/feed/shared/grid-media";

export const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  const mediaUrls = review.media?.map((mediaItem) => mediaItem.url) || [];

  const formatDate = (dateString: string) => {
    const date = dayjs(dateString);
    return date.format("MMM D, YYYY h:mm A");
  };

  const getTimeAgo = (dateString: string) => {
    return dayjs(dateString).fromNow();
  };

  const getTypeIcon = (type: ReviewDocument["type"]) => {
    switch (type) {
      case "REVIEW":
        return <MessageSquareText className="h-5 w-5 text-blue-500 dark:text-blue-400" />;
      case "BUG_REPORT":
        return <Bug className="h-5 w-5 text-red-500 dark:text-red-400" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: ReviewDocument["status"]) => {
    let bgColor = "bg-gray-200 dark:bg-gray-700";
    let textColor = "text-gray-700 dark:text-gray-300";
    let icon = <AlertTriangle className="h-4 w-4 mr-1" />;

    switch (status) {
      case "PENDING":
        bgColor = "bg-yellow-100 dark:bg-yellow-800/20";
        textColor = "text-yellow-700 dark:text-yellow-300";
        icon = <AlertTriangle className="h-4 w-4 mr-1" />;
        break;
      case "APPROVED":
        bgColor = "bg-green-100 dark:bg-green-800/20";
        textColor = "text-green-700 dark:text-green-300";
        icon = <CheckCircle className="h-4 w-4 mr-1" />;
        break;
      case "REJECTED":
        bgColor = "bg-red-100 dark:bg-red-800/20";
        textColor = "text-red-700 dark:text-red-300";
        icon = <XCircle className="h-4 w-4 mr-1" />;
        break;
    }

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bgColor} ${textColor}`}
      >
        {icon}
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 p-6 mb-6 min-w-[300px] dark:bg-gray-800 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {review.user.profileImage ? (
            <Image
              src={review.user.profileImage}
              alt={review.user.fullName}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover mr-3"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3 dark:bg-gray-700">
              <User className="h-6 w-6 text-gray-500 dark:text-gray-300" />
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {review.user.fullName}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">@{review.user.username}</p>
          </div>
        </div>
        <div
          className="flex items-center text-sm text-gray-500 dark:text-gray-400"
          title={formatDate(review.createdAt)}
        >
          <Clock className="h-4 w-4 mr-1" />
          {getTimeAgo(review.createdAt)}
        </div>
      </div>

      <div className="flex items-center space-x-4 mb-4">
        <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
          {getTypeIcon(review.type)}
          <span className="ml-1 font-medium">
            {review.type.replace("_", " ")}
          </span>
        </div>
        <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
          <Tag className="h-4 w-4" />
          <span className="ml-1">{review.scope.replace("_", " ")}</span>
        </div>
        {review.status && getStatusBadge(review.status)}
      </div>

      {review.type === "REVIEW" && review.review && (
        <p className="text-gray-800 text-base mb-4 dark:text-gray-200">{review.review}</p>
      )}

      {review.type === "BUG_REPORT" && (
        <div className="mb-4">
          {review.title && (
            <h4 className="text-lg font-semibold text-gray-900 mb-1 dark:text-gray-100">
              {review.title}
            </h4>
          )}
          {review.description && (
            <p className="text-gray-800 text-base whitespace-pre-wrap dark:text-gray-200">
              {review.description}
            </p>
          )}
        </div>
      )}

      {mediaUrls.length > 0 && (
        <div className="mt-4 flex justify-center items-center">
          <GridMedia media={mediaUrls} className="w-[300px] h-[300px]" />
        </div>
      )}
    </div>
  );
};

export default function ReviewContainer() {
  const ITEMS_PER_PAGE = 10;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useInfiniteQuery({
    queryKey: ["reviews"],
    queryFn: async ({ pageParam = 1 }) => {
      const response = await useReviewAPI.getReviews(pageParam, ITEMS_PER_PAGE);
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.data.length < ITEMS_PER_PAGE) {
        return undefined;
      }
      return allPages.length + 1;
    },
    staleTime: 1000 * 60 * 5,
    initialPageParam: 1,
  });

  const reviews = data?.pages.flatMap((page) => page.data) || [];
  const observerElem = useRef<HTMLDivElement | null>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage]
  );

  useEffect(() => {
    const element = observerElem.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "100px",
      threshold: 0.1,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [handleObserver]);

  if (isLoading && !isFetchingNextPage) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl dark:bg-gray-900 min-h-screen">
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 dark:text-blue-400" />
          <span className="ml-2 text-gray-600 dark:text-gray-300">Loading reviews...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl dark:bg-gray-900 min-h-screen">
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300"
          role="alert"
        >
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline ml-2">
            {error?.message || "Failed to load reviews."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center dark:text-gray-100">
        User Reviews & Bug Reports
      </h1>

      {reviews.length === 0 ? (
        <div className="text-center text-gray-500 py-10 dark:text-gray-400">
          No reviews or bug reports found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {reviews.map((review: ReviewDocument) => (
            <ReviewCard key={review._id} review={review} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <div
          ref={observerElem}
          className="flex justify-center items-center py-4"
        >
          {isFetchingNextPage ? (
            <Loader2 className="h-6 w-6 animate-spin text-blue-500 dark:text-blue-400" />
          ) : (
            <span className="text-gray-500 dark:text-gray-400">Loading more...</span>
          )}
        </div>
      )}

      {!hasNextPage && reviews.length > 0 && (
        <div className="text-center text-gray-500 py-4 dark:text-gray-400">
          You've reached the end of the reviews.
        </div>
      )}
    </div>
  );
}
