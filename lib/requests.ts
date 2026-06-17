import axios, { AxiosError, AxiosResponse, AxiosInstance } from "axios";
import { SignUpData } from "@/types/requests.d";
import { IPayloadProps } from "@/app/api/tribe/search/route";

export class BaseAPI {
  protected readonly apiClient: AxiosInstance;

  constructor() {
    this.apiClient = axios.create({
      // baseURL: process.env.NEXT_PUBLIC_API_URL || '/api/',
      withCredentials: true,
    });
  }
}

class UserAPI extends BaseAPI {
  public getUser = async (id: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(`/api/users?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public updateUser = async (data: any): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.patch(`/api/users`, data);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class LocationAPI extends BaseAPI {
  public getLocations = async (location: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(
        `/api/locations?location=${location}`
      );
      return response.data;
    } catch (err) {
      const axiosError = err as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class ReportAPI extends BaseAPI {
  public createReport = async (data: any): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.post(`/api/report`, { data });
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getReports = async (): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get("/api/report");
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getReport = async (id: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(`/api/report?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public deleteReport = async (id: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.delete(`/api/report?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public updateReport = async (
    id: string,
    status: string
  ): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.patch(`/api/report`, {
        id,
        status,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class ResetPasswordAPI extends BaseAPI {
  public async createEmail(payload: {
    email: string;
    reason: "PASSWORD_RESET";
  }) {
    try {
      const link =
        process.env.PULSE_BASE_URL ?? process.env.NEXT_PUBLIC_PULSE_BASE_URL;
      const response = await this.apiClient.post(`${link}api/email`, payload);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  }
  public async verifyRequest(token: string) {
    try {
      // const link = "http://localhost:10000/api/verification";
      // process.env.PULSE_BASE_URL ?? process.env.NEXT_PUBLIC_PULSE_BASE_URL;
      console.log(`"http://localhost:10000/api/verification/"${token}`);
      const response = await this.apiClient.post(
        `http://localhost:10000/api/verification/${token}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  }
  public async changePassword(email: string, password: string) {
    try {
      const response = await this.apiClient.patch("/api/auth/signup", {
        email,
        password,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  }
}

class ReviewAPI extends BaseAPI {
  public getReviewById = async (id: string): Promise<any> => {
    try {
      const response = await this.apiClient.get(`/api/review?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };

  public getReviews = async (page: number, limit: number): Promise<any> => {
    try {
      const response = await this.apiClient.get(
        `/api/review?page=${page}&limit=${limit}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };

  public createReview = async (data: any): Promise<any> => {
    try {
      const response = await this.apiClient.post(`/api/review`, data);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };

  public updateReview = async (id: string, data: any): Promise<any> => {
    try {
      const response = await this.apiClient.patch(`/api/review?id=${id}`, data);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };

  public deleteReview = async (id: string): Promise<any> => {
    try {
      const response = await this.apiClient.delete(`/api/review?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class FeedAPI extends BaseAPI {
  public getFeed = async (profileId: string, page: number, limit: number): Promise<any> => {
    try {
      const response = await this.apiClient.get(
        `/api/feed?page=${page}&limit=${limit}&id=${profileId}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getFeedForProfile = async (
    page: number,
    limit: number,
    userId: string
  ): Promise<any> => {
    try {
      const response = await this.apiClient.get(
        `/api/feed?page=${page}&limit=${limit}&id=${userId}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class SearchAPI extends BaseAPI {
  public search = async (
    page?: string,
    profile?: string,
    group?: string,
    shop?: string,
    hashtags?: string
  ): Promise<any> => {
    try {
      const response = await this.apiClient.get(
        `/api/search?page=${page}&profile=${profile}&group=${group}&shop=${shop}&hashtags=${hashtags}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class CompanionAPI extends BaseAPI {
  public getCompanions = async (
    userId: string,
    page: number,
    limit: number = 5
  ): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(
        `/api/companion?userId=${userId}&page=${page}&limit=${limit}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class AnalyticsAPI extends BaseAPI {
  public getAnalytics = async (): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get("/api/analytics");
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class AuthAPI extends BaseAPI {
  public signUp = async (data: SignUpData): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.post("/api/auth/signup", data);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class PostAPI extends BaseAPI {
  public getPosts = async (): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get("/api/posts");
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getPost = async (id: string): Promise<AxiosResponse> => {
    if (!id) throw new Error("Post ID is required");
    try {
      const response = await this.apiClient.get(`/api/posts?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public createPost = async (data: any): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.post("/api/posts", data);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public deletePost = async (id: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.delete(`/api/posts?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public updatePost = async (data: {
    postId: string;
    caption?: string;
    location?: string;
  }): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.patch(`/api/posts`, data);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data: any; status: number };
        message: string;
      };
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class MediaAPI extends BaseAPI {
  public getMedia = async (): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get("/api/media");
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public uploadMedia = async (file: File): Promise<AxiosResponse> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await this.apiClient.post("/api/media", formData);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public deleteMedia = async (id: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.delete(`/api/media/${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class LikeAPI extends BaseAPI {
  public likePost = async (postId: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.post(`/api/reaction`, {
        post: postId,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getLikes = async (id: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(`/api/reaction?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class CommentAPI extends BaseAPI {
  public createComment = async (
    postId: string,
    comment: string
  ): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.post(`/api/comment/`, {
        content: comment,
        post: postId,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getComments = async (postId: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(
        `/api/posts/${postId}/comments`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public updateComment = async (
    commentId: string,
    comment: string
  ): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.patch(`/api/comment`, {
        id: commentId,
        content: comment,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public deleteComment = async (commentId: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.delete(
        `/api/comment?id=${commentId}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class FollowAPI extends BaseAPI {
  /**
   * Toggles the follow status for a given target user.
   * If the current user is already following, it unfollows. If not, it follows.
   * @param {string} targetUserId - The ID of the user to follow/unfollow.
   * @returns {Promise<AxiosResponse>} The API response indicating the new follow status and counts.
   */
  public toggleFollow = async (
    targetUserId: string
  ): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.post(`/api/followers`, {
        targetUserId,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };

  /**
   * Retrieves the list of followers or users being followed for a given profile.
   * @param {string} profileId - The ID of the profile to retrieve data for.
   * @param {'followers' | 'following'} type - Specifies whether to retrieve 'followers' or 'following' list.
   * @returns {Promise<AxiosResponse>} The API response containing the list of users.
   */
  public getFollowersOrFollowing = async (
    profileId: string,
    type: "followers" | "following"
  ): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(
        `/api/followers?profileId=${profileId}&type=${type}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as any;
      throw axiosError.response?.data || axiosError.message;
    }
  };
}

class TribeAPI extends BaseAPI {
  public createTribe = async (data: any): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.post(`/api/tribe`, data);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getTribe = async (id: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(`/api/tribe?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getTribeBySerial = async (serial: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(`/api/tribe?serial=${serial}`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getTribeMembers = async (id: string, page: number, limit: number): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(
        `/api/tribe?id=${id}&members=true&page=${page}&limit=${limit}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getTribePosts = async (id: string, page: number, limit: number): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(
        `/api/tribe?id=${id}&posts=true&page=${page}&limit=${limit}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getUserTribes = async (id: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(`/api/tribe?user=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public getTribes = async (
    page: number,
    limit: number
  ): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(
        `/api/tribe?page=${page}&limit=${limit}`
      );
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public updateTribe = async (serial:string, data: any): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.patch(`/api/tribe?serial=${serial}`, data);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public deleteTribe = async (id: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.delete(`/api/tribe?id=${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  };
  public joinTribe = async (tribeId: string, userId: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.post(`api/tribe/join`, {tribeId, userId});
      return response.data;
    } catch(error){
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  }
  public getJoinedTribes = async (userId: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(`api/tribe/join?userId=${userId}`);
      return response.data;
    } catch(error){
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  }
  public getTribesForUser = async (category: "joined" | "created" | "notJoined"): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(`api/tribe?ownership=${category}`);
      return response.data;
    } catch(error){
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  }
  public isTribeMember = async (userId: string, tribeId: string): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.get(`/api/tribe/join?userId=${userId}&tribeId=${tribeId}&requestType=memberCheck`);
      return response.data;
    } catch(error){
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  }
  public searchTribe = async (query: string, filterData: IPayloadProps): Promise<AxiosResponse> => {
    try {
      const response = await this.apiClient.post(`api/tribe/search?searchText=${query}`, filterData);
      return response.data;
    } catch(error){
      const axiosError = error as AxiosError;
      throw axiosError.response?.data || axiosError.message;
    }
  }
}

export const useAuthApi = new AuthAPI();
export const usePostApi = new PostAPI();
export const useMediaApi = new MediaAPI();
export const useLikeApi = new LikeAPI();
export const useCommentApi = new CommentAPI();
export const useUserApi = new UserAPI();
export const useReportApi = new ReportAPI();
export const useLocationApi = new LocationAPI();
export const useFollowApi = new FollowAPI();
export const useAnalyticsApi = new AnalyticsAPI();
export const useResetPasswordAPI = new ResetPasswordAPI();
export const useReviewAPI = new ReviewAPI();
export const useFeedAPI = new FeedAPI();
export const useSearchAPI = new SearchAPI();
export const useCompanionAPI = new CompanionAPI();
export const useTribeAPI = new TribeAPI();
