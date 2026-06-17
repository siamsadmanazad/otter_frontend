"use client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { getInitials } from "@/lib/name-format"
import { useFollowApi } from "@/lib/requests"
import axios from "axios"
import { useEffect, useState } from "react"

interface IResponseUser {
  _id: string
  fullName: string
  username: string
  profileImage?: string
  location?: string
  isFollowing?: boolean
}

interface FollowModalProps {
  type: 'Following' | 'Followers'
  children: React.ReactNode
  userId?: string
  currentLoggedInUserId?: string;
}

export function FollowModal({ type, children, userId, currentLoggedInUserId }: FollowModalProps) {
  const [users, setUsers] = useState<IResponseUser[]>([])
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    async function fetchData() {
      if (!userId) {
        setUsers([]);
        return;
      }
      try {
        const response = await axios.get(`/api/followers?profileId=${userId}`);
        const data = response.data.data;

        if (type === 'Following') {
          const mappedUsers = data.following.map((u: IResponseUser) => ({ ...u, isFollowing: true }));
          setUsers(mappedUsers);
        } else {
          setUsers(data.followers);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    }
    fetchData();
  }, [userId, type]);

  const handleToggleFollow = async (userIdToToggle: string, isCurrentlyFollowing: boolean) => {
    setIsUpdating(true)
    try {
      const response = await useFollowApi.toggleFollow(userIdToToggle)

      if (response.status === 200) {
        setUsers(prevUsers =>
          prevUsers.map(user =>
            user._id === userIdToToggle
              ? { ...user, isFollowing: !isCurrentlyFollowing }
              : user
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle follow status:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog>
      <DialogTrigger>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>{type}</DialogTitle>
          <DialogDescription>
            {type === 'Following'
              ? 'Users you are currently following.'
              : 'Users who are following this profile.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto py-2">
          {users.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {type === 'Following' ? 'Not following anyone yet.' : 'No followers yet.'}
            </div>
          ) : (
            users.map((user) => (
              <div key={user._id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <img
                    src={user.profileImage || `https://placehold.co/40x40/E0E0E0/333333?text=${getInitials(user.fullName)}`}
                    alt={user.fullName}
                    className="w-10 h-10 rounded-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = `https://placehold.co/40x40/E0E0E0/333333?text=${getInitials(user.fullName)}`;
                    }}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{user.fullName}</span>
                    {user.location && <span className="text-xs text-gray-500">{user.location}</span>}
                  </div>
                </div>

                <div className="flex gap-2">
                  {user._id !== currentLoggedInUserId && (
                    user.isFollowing ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleFollow(user._id, true)}
                        disabled={isUpdating}
                      >
                        Unfollow
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleToggleFollow(user._id, false)}
                        disabled={isUpdating}
                      >
                        Follow
                      </Button>
                    )
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-4">
          <DialogClose>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
