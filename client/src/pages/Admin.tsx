import { useMemo, useState } from "react";
import { LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function Admin() {
  const { user, loading: authLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
  });
  const isAdmin = user?.role === "admin";
  const utils = trpc.useUtils();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const listQuery = trpc.caseStudies.list.useQuery(undefined, {
    enabled: isAdmin,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = trpc.caseStudies.delete.useMutation({
    onSuccess: async () => {
      await utils.caseStudies.list.invalidate();
      toast.success("Post deleted.");
    },
  });

  const posts = useMemo(() => listQuery.data ?? [], [listQuery.data]);

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
            Force-delete any post from the library.
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

      {listQuery.isLoading ? (
        <p className="text-muted-foreground">Loading posts...</p>
      ) : posts.length === 0 ? (
        <p className="text-muted-foreground">No posts found.</p>
      ) : (
        <div className="space-y-3">
          {posts.map(post => (
            <Card key={post.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="font-medium">{post.title}</h2>
                      <Badge variant="outline">{post.category}</Badge>
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
                  </div>

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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
