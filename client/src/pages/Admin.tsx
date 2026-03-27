import { useMemo, useState } from "react";
import { ExternalLink, Flag, LogOut, ShieldAlert, Ticket, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

const formatDateTime = (timestamp: number) =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));

export default function Admin() {
  const { user, loading: authLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingQuestId, setDeletingQuestId] = useState<number | null>(null);
  const [unreportingCaseStudyId, setUnreportingCaseStudyId] = useState<number | null>(null);

  const listQuery = trpc.caseStudies.list.useQuery(undefined, {
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });
  const questListQuery = trpc.quests.list.useQuery(undefined, {
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });
  const reportListQuery = trpc.caseStudies.reportList.useQuery(undefined, {
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = trpc.caseStudies.delete.useMutation({
    onSuccess: async () => {
      await utils.caseStudies.list.invalidate();
      toast.success("Post deleted.");
    },
  });
  const deleteQuestMutation = trpc.quests.delete.useMutation({
    onSuccess: async () => {
      await utils.quests.list.invalidate();
      toast.success("Quest deleted.");
    },
  });
  const clearReportsMutation = trpc.caseStudies.clearReports.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.caseStudies.list.invalidate(),
        utils.caseStudies.reportList.invalidate(),
      ]);
      toast.success("Reports cleared for this post.");
    },
  });

  const posts = useMemo(() => listQuery.data ?? [], [listQuery.data]);
  const quests = useMemo(() => questListQuery.data ?? [], [questListQuery.data]);
  const reportEntries = useMemo(() => reportListQuery.data ?? [], [reportListQuery.data]);
  const reportEntriesByCaseStudyId = useMemo(() => {
    const grouped = new Map<number, typeof reportEntries>();
    for (const entry of reportEntries) {
      const current = grouped.get(entry.caseStudyId) ?? [];
      current.push(entry);
      grouped.set(entry.caseStudyId, current);
    }
    return grouped;
  }, [reportEntries]);
  const reportedPosts = useMemo(
    () => posts.filter(post => (post.reportCount ?? 0) > 0),
    [posts]
  );
  const totalReports = useMemo(
    () => reportedPosts.reduce((sum, post) => sum + (post.reportCount ?? 0), 0),
    [reportedPosts]
  );

  const handleDelete = async (id: number, title: string) => {
    const confirmed = window.confirm(
      `Delete "${title}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingId(id);
      await deleteMutation.mutateAsync({ id });
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete post.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteQuest = async (id: number, title: string) => {
    const confirmed = window.confirm(
      `Delete quest "${title}"?\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeletingQuestId(id);
      await deleteQuestMutation.mutateAsync({ id });
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete quest.");
    } finally {
      setDeletingQuestId(null);
    }
  };

  const handleUnreport = async (caseStudyId: number, title: string) => {
    const confirmed = window.confirm(
      `Clear all reports for "${title}"?`
    );
    if (!confirmed) return;

    try {
      setUnreportingCaseStudyId(caseStudyId);
      await clearReportsMutation.mutateAsync({ caseStudyId });
    } catch (error) {
      console.error(error);
      toast.error("Failed to clear reports.");
    } finally {
      setUnreportingCaseStudyId(null);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    } finally {
      window.location.href = getLoginUrl({ promptSelectAccount: true });
    }
  };

  if (authLoading) {
    return (
      <div className="container py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container py-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Admin Access Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-muted-foreground">
              You do not have permission to view this page.
            </p>
            <Button asChild variant="outline">
              <a href="/">Back to Home</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin Console</h1>
          <p className="text-muted-foreground text-sm">
            Review posts and moderate quests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <a href="/">Back to Home</a>
          </Button>
          <Button
            onClick={handleSwitchAccount}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Switch account
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Posts</h2>
        {listQuery.isLoading ? (
          <p className="text-muted-foreground">Loading posts...</p>
        ) : posts.length === 0 ? (
          <p className="text-muted-foreground">No posts found.</p>
        ) : (
          <div className="space-y-3">
            {reportedPosts.length > 0 && (
              <Card className="border-amber-500/50 bg-amber-50/40 dark:bg-amber-950/10">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Flag className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium">Report Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        {reportedPosts.length} posts have been reported ({totalReports} reports total).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {posts.map(post => (
              <Card key={post.id}>
                <CardContent className="pt-6">
                  {(() => {
                    const postReports = reportEntriesByCaseStudyId.get(post.id) ?? [];
                    return (
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{post.title}</h3>
                        <Badge variant="outline">{post.category}</Badge>
                        {(post.reportCount ?? 0) > 0 && (
                          <Badge variant="destructive">
                            Reported x{post.reportCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {post.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Nickname: {post.authorName ?? "Unknown user"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Post ID: {post.id} | Owner User ID: {post.userId}
                      </p>
                      {postReports.length > 0 && (
                        <div className="rounded-md border bg-amber-50/40 dark:bg-amber-950/10 p-3 space-y-2 mt-2">
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                            Report Messages ({postReports.length})
                          </p>
                          {postReports.map(report => (
                            <div key={report.id} className="text-xs text-muted-foreground space-y-1">
                              <p className="text-foreground whitespace-pre-wrap">
                                {report.message?.trim() || "(No message provided)"}
                              </p>
                              <p>
                                Reported by {report.reporterName ?? "Unknown user"} at{" "}
                                {formatDateTime(report.createdAt)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {postReports.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnreport(post.id, post.title)}
                          disabled={unreportingCaseStudyId === post.id}
                        >
                          <Undo2 className="w-4 h-4" />
                          {unreportingCaseStudyId === post.id ? "Clearing..." : "Unreport"}
                        </Button>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <a href={`/?post=${post.id}`}>
                          <ExternalLink className="w-4 h-4" />
                          Check
                        </a>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(post.id, post.title)}
                        disabled={deletingId === post.id}
                      >
                        <Trash2 className="w-4 h-4" />
                        {deletingId === post.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Quests</h2>
        {questListQuery.isLoading ? (
          <p className="text-muted-foreground">Loading quests...</p>
        ) : quests.length === 0 ? (
          <p className="text-muted-foreground">No quests found.</p>
        ) : (
          <div className="space-y-3">
            {quests.map(quest => (
              <Card key={quest.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{quest.title}</h3>
                        <Badge variant="outline" className="capitalize">
                          {quest.status}
                        </Badge>
                        <Badge variant="outline" className="gap-1">
                          <Ticket className="w-3.5 h-3.5" />
                          {quest.answerCount} answers
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {quest.content}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Poster: {quest.authorName ?? "Unknown user"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Quest ID: {quest.id} | Owner User ID: {quest.userId}
                      </p>
                    </div>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteQuest(quest.id, quest.title)}
                      disabled={deletingQuestId === quest.id}
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingQuestId === quest.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
