import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

type UserProfileProps = {
  userId: number;
};

function getInitials(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function UserProfile({ userId }: UserProfileProps) {
  const { loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");

  const profileQuery = trpc.profile.byUserId.useQuery(
    { userId },
    {
      enabled: Number.isFinite(userId) && userId > 0,
      refetchOnWindowFocus: false,
    }
  );

  const updateNameMutation = trpc.profile.updateName.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.auth.me.invalidate(),
        utils.profile.byUserId.invalidate({ userId }),
        utils.profile.myPosts.invalidate(),
      ]);
      toast.success("Name updated.");
    },
  });

  const profile = profileQuery.data?.user ?? null;
  const posts = useMemo(() => profileQuery.data?.posts ?? [], [profileQuery.data?.posts]);
  const isOwner = Boolean(profileQuery.data?.isOwner);

  useEffect(() => {
    setName(profile?.name ?? "");
  }, [profile?.name, userId]);

  const handleSaveName = async () => {
    if (!isOwner) return;
    const next = name.trim();
    if (!next) {
      toast.error("Name cannot be empty.");
      return;
    }
    try {
      await updateNameMutation.mutateAsync({ name: next });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update name.");
    }
  };

  const formatDateTime = (timestamp: number) =>
    new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));

  if (!Number.isFinite(userId) || userId <= 0) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Invalid profile URL.</p>
      </div>
    );
  }

  if (authLoading || profileQuery.isLoading) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container py-12 space-y-4">
        <p className="text-muted-foreground">User not found.</p>
        <Button asChild variant="outline">
          <a href="/">Back to Home</a>
        </Button>
      </div>
    );
  }

  const displayName = profile.name ?? "Unknown user";

  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{isOwner ? "My Profile" : "User Profile"}</h1>
          <p className="text-sm text-muted-foreground">
            {isOwner
              ? "Manage your name and see your posts."
              : "See this user and their posts."}
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/">Back to Home</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={profile.avatarUrl ?? undefined} alt={`${displayName} avatar`} />
              <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-xs text-muted-foreground">Display name</p>
              <p className="text-sm font-medium">{displayName}</p>
            </div>
          </div>

          {isOwner && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Change display name</p>
              <div className="flex items-center gap-2 max-w-md">
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                />
                <Button
                  onClick={handleSaveName}
                  disabled={updateNameMutation.isPending}
                >
                  {updateNameMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Posts ({posts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-muted-foreground">No posts yet.</p>
          ) : (
            <div className="space-y-3">
              {posts.map(post => (
                <div key={post.id} className="rounded-md border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{post.title}</p>
                    <Badge variant="outline">{post.category}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{post.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Updated: {formatDateTime(post.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
