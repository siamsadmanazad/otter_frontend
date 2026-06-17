interface YearlyData {
  postsThisYear: number;
  commentsThisYear: number;
  likesThisYear: number;
  usersJoinedThisYear: number;
}

interface MonthlyData {
  month: string;
  posts: number;
  comments: number;
  likes: number;
  usersJoined: number;
}

interface AnalyticsData {
  yearly: YearlyData;
  monthly: MonthlyData[];
}

interface AnalyticsResponse {
  message: string;
  status: number;
  data: AnalyticsData;
}

export type {
  YearlyData,
  MonthlyData,
  AnalyticsData,
  AnalyticsResponse,
}