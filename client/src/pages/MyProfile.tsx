import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getLevelProgress } from "@/lib/leveling";
import { trpc } from "@/lib/trpc";

function getQuestStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "finished":
      return "Solved";
    case "unsolved":
      return "Unsolved";
    case "suspended":
      return "Suspended";
    case "open":
      return "Open";
    default:
      return "Unsolved";
  }
}

export default function MyProfile() {
  const { user, loading: authLoading } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const utils = trpc.useUtils();
  const [name, setName] = useState(user?.name ?? "");

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  const myPostsQuery = trpc.profile.myPosts.useQuery(undefined, {
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
  });
  const myQuestsQuery = trpc.profile.myQuests.useQuery(undefined, {
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
  });
  const myNotificationsQuery = trpc.profile.myNotifications.useQuery(undefined, {
    enabled: Boolean(user),
    refetchOnWindowFocus: false,
  });

  const updateNameMutation = trpc.profile.updateName.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      toast.success("Name updated.");
    },
  });

  const posts = useMemo(() => myPostsQuery.data ?? [], [myPostsQuery.data]);
  const quests = useMemo(() => myQuestsQuery.data ?? [], [myQuestsQuery.data]);
  const notifications = useMemo(
    () => myNotificationsQuery.data ?? [],
    [myNotificationsQuery.data]
  );
  const levelProgress = useMemo(
    () => getLevelProgress(user?.exp),
    [user?.exp]
  );

  const handleSaveName = async () => {
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

  if (authLoading) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your name and see your posts.
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
          <div>
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <p className="text-sm">{user?.email ?? "-"}</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Display name</p>
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

          <div className="space-y-2 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Level {levelProgress.level}</p>
              <p className="text-xs text-muted-foreground">
                {levelProgress.currentLevelExp} / {levelProgress.nextLevelExp} EXP
              </p>
            </div>
            <Progress value={levelProgress.progressPercent} />
            <p className="text-xs text-muted-foreground">
              {levelProgress.expToNextLevel} EXP to next level.
              {" "}
              Total EXP: {levelProgress.totalExp}
            </p>
            <p className="text-xs text-muted-foreground">
              Gain EXP by posting and solving quests.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Posts ({posts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {myPostsQuery.isLoading ? (
            <p className="text-muted-foreground">Loading posts...</p>
          ) : posts.length === 0 ? (
            <p className="text-muted-foreground">You have not posted anything yet.</p>
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
                    Nickname: {user?.name ?? "Unknown user"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated: {formatDateTime(post.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My Quests ({quests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {myQuestsQuery.isLoading ? (
            <p className="text-muted-foreground">Loading quests...</p>
          ) : quests.length === 0 ? (
            <p className="text-muted-foreground">You have not posted any quests yet.</p>
          ) : (
            <div className="space-y-3">
              {quests.map(quest => (
                <div key={quest.id} className="rounded-md border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{quest.title}</p>
                    <Badge variant="outline">{getQuestStatusLabel(quest.status)}</Badge>
                    <Badge variant="secondary">{quest.answerCount} answers</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {quest.content}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Updated: {formatDateTime(quest.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {myNotificationsQuery.isLoading ? (
            <p className="text-muted-foreground">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-muted-foreground">No notifications yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map(item => (
                <div key={item.id} className="rounded-md border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {item.message}
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
