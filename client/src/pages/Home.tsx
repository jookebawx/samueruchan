import { type CaseStudy } from "@/lib/caseStudies";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Flag, Heart, LogOut, MessageCircle, Moon, Pencil, Plus, Search, Share2, Sun, Ticket, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AddCaseModal } from "@/components/AddCaseModal";
import { CaseDetailModal } from "@/components/CaseDetailModal";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

type Category = "all" | "trending" | "liked" | "prompt" | "automation" | "tools" | "business";
const AI_DISCUSSION_EMBED_URL = "https://udify.app/chatbot/xeLQIFLhBycwJRFF";

const categories = [
  { id: "all" as Category, label: "ALL" },
  { id: "trending" as Category, label: "Trending" },
  { id: "liked" as Category, label: "❤️ Favorites" },
  { id: "prompt" as Category, label: "Prompt Library" },
  { id: "automation" as Category, label: "Automation" },
  { id: "tools" as Category, label: "Tools" },
  { id: "business" as Category, label: "Business" },
];

function getInitials(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Home() {
  const utils = trpc.useUtils();
  const { isAuthenticated, user, logout } = useAuth();
  const canPost = isAuthenticated && user?.loginMethod === "google";
  const listQuery = trpc.caseStudies.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const cases: CaseStudy[] = listQuery.data ?? [];
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState<number | null>(null);
  const [isAiDiscussionOpen, setIsAiDiscussionOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportTarget, setReportTarget] = useState<{ caseId: number } | null>(null);
  const hasHandledSharedPostRef = useRef(false);
  const { theme, toggleTheme, switchable } = useTheme();
  const toggleFavoriteMutation = trpc.caseStudies.toggleFavorite.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
  const reportMutation = trpc.caseStudies.report.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
  const deleteMutation = trpc.caseStudies.delete.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
  const selectedCase = selectedCaseId
    ? cases.find((item) => item.id === selectedCaseId) ?? null
    : null;
  const editingCase = editingCaseId
    ? cases.find((item) => item.id === editingCaseId) ?? null
    : null;
  const canManageSelected =
    Boolean(selectedCase) &&
    Boolean(user) &&
    selectedCase?.userId === user?.id;
  const canEditSelected = canManageSelected && user?.loginMethod === "google";
  const canDeleteSelected =
    Boolean(selectedCase) &&
    Boolean(user) &&
    (selectedCase?.userId === user?.id || user?.role === "admin");
  const canReportSelected = Boolean(
    selectedCase &&
      selectedCase.userId !== user?.id &&
      !selectedCase.isReported
  );

  const filteredCases = useMemo(() => {
    const matched = cases.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        activeCategory === "all" ||
        activeCategory === "trending" ||
        (activeCategory === "liked" ? c.isFavorite : c.category === activeCategory);
      return matchesSearch && matchesCategory;
    });

    if (activeCategory !== "trending") {
      return matched;
    }

    return [...matched].sort((a, b) => {
      const likeDelta = (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0);
      if (likeDelta !== 0) return likeDelta;
      return b.createdAt - a.createdAt;
    });
  }, [cases, searchQuery, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<Category, number> = {
      all: cases.length,
      trending: cases.length,
      liked: 0,
      prompt: 0,
      automation: 0,
      tools: 0,
      business: 0,
    };

    for (const item of cases) {
      counts[item.category] += 1;
      if (item.isFavorite) counts.liked += 1;
    }

    return counts;
  }, [cases]);

  const handleFavoriteClick = async (e: React.MouseEvent, caseId: number) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    try {
      await toggleFavoriteMutation.mutateAsync({ caseStudyId: caseId });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update favorites.");
    }
  };

  const handleFavoriteToggle = async (caseId: number) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    try {
      await toggleFavoriteMutation.mutateAsync({ caseStudyId: caseId });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update favorites.");
    }
  };

  const handleDeleteCase = async (caseId: number) => {
    if (!window.confirm("Delete this case study?")) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    try {
      const result = await deleteMutation.mutateAsync({ id: caseId });
      if (result?.success) {
        setSelectedCaseId(null);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete case study.");
    }
  };

  const handleReportCase = (caseId: number, ownerUserId: number) => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (user?.id === ownerUserId) {
      toast.error("You cannot report your own post.");
      return;
    }

    setReportTarget({ caseId });
    setReportMessage("");
    setIsReportDialogOpen(true);
  };

  const handleSubmitReport = async () => {
    if (!reportTarget) return;

    const message = reportMessage.trim();
    if (message.length < 5) {
      toast.error("Please provide at least 5 characters for the report reason.");
      return;
    }

    try {
      const result = await reportMutation.mutateAsync({
        caseStudyId: reportTarget.caseId,
        message,
      });
      if (result.alreadyReported) {
        toast.error("You already reported this post.");
        setIsReportDialogOpen(false);
        setReportTarget(null);
        setReportMessage("");
        return;
      }
      toast.success("Post reported. Admin has been notified.");
      setIsReportDialogOpen(false);
      setReportTarget(null);
      setReportMessage("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to report this post.");
    }
  };

  const handleAddClick = () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (user?.loginMethod !== "google") {
      toast.error("Google login required to post.");
      return;
    }
    setIsAddModalOpen(true);
  };

  const handleEditCase = (caseId: number) => {
    setSelectedCaseId(null);
    setEditingCaseId(caseId);
  };

  const getShareUrl = (caseId: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("post", String(caseId));
    return url.toString();
  };

  const handleShareCase = async (
    caseStudy: Pick<CaseStudy, "id" | "title" | "description">,
    event?: React.MouseEvent
  ) => {
    event?.stopPropagation();

    const shareUrl = getShareUrl(caseStudy.id);
    const shareData: ShareData = {
      title: caseStudy.title,
      text: caseStudy.description,
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Share link copied. Paste it on social media.");
        return;
      }

      window.prompt("Copy this link to share:", shareUrl);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      console.error(error);
      toast.error("Failed to share this post.");
    }
  };

  const formatDateTime = (timestamp: number) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));

  const handleLoginClick = () => {
    window.location.href = getLoginUrl();
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

  const handleReportDialogOpenChange = (open: boolean) => {
    setIsReportDialogOpen(open);
    if (!open && !reportMutation.isPending) {
      setReportTarget(null);
      setReportMessage("");
    }
  };

  useEffect(() => {
    if (listQuery.isLoading || hasHandledSharedPostRef.current) {
      return;
    }

    hasHandledSharedPostRef.current = true;

    const rawPostId = new URLSearchParams(window.location.search).get("post");
    if (!rawPostId) {
      return;
    }

    const sharedPostId = Number(rawPostId);
    if (!Number.isInteger(sharedPostId)) {
      return;
    }

    if (cases.some((item) => item.id === sharedPostId)) {
      setSelectedCaseId(sharedPostId);
    }
  }, [cases, listQuery.isLoading]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
        <div className="container py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <img
                src="/newlogo.png"
                alt="CAI Library logo"
                className="w-50 h-20 rounded-xl object-cover"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 flex-wrap justify-end">
              {switchable && (
                <div className="flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-2">
                  <Sun
                    className={`w-4 h-4 ${
                      theme === "light" ? "text-foreground" : "text-muted-foreground"
                    }`}
                  />
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={() => toggleTheme?.()}
                    aria-label="Toggle dark mode"
                  />
                  <Moon
                    className={`w-4 h-4 ${
                      theme === "dark" ? "text-foreground" : "text-muted-foreground"
                    }`}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsAiDiscussionOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 text-foreground hover:bg-muted rounded-full transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Ask AI</span>
              </button>

              <Button asChild variant="outline" className="rounded-full">
                <a href="/quest" className="flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  <span className="text-sm">Quest</span>
                </a>
              </Button>

              {!isAuthenticated ? (
                <Button
                  onClick={handleLoginClick}
                  variant="outline"
                  className="flex items-center gap-2 rounded-full"
                >
                  <span className="text-sm">Log in with Google</span>
                </Button>
              ) : canPost ? (
                <Button
                  onClick={handleAddClick}
                  variant="outline"
                  className="flex items-center gap-2 rounded-full"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">Post</span>
                </Button>
              ) : null}
              {user?.role === "admin" && (
                <Button asChild variant="outline" className="rounded-full">
                  <a href="/admin">
                    <span className="text-sm">Admin</span>
                  </a>
                </Button>
              )}
              {isAuthenticated && (
                <Button asChild variant="outline" className="rounded-full flex items-center gap-2">
                  <a href="/profile">
                    <User className="w-4 h-4" />
                    <span className="text-sm">My Profile</span>
                  </a>
                </Button>
              )}
              {isAuthenticated && (
                <Button
                  onClick={handleSwitchAccount}
                  variant="outline"
                  className="flex items-center gap-2 rounded-full"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Switch account</span>
                </Button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-4">
            <div className="relative mx-auto w-full max-w-4xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-muted border-border rounded-full"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-3 mt-6 overflow-x-auto scrollbar-hide pb-1">
            {categories.map((category) => {
              const isActive = activeCategory === category.id;
              return (
                <Button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  variant={isActive ? "default" : "outline"}
                  className={`rounded-full whitespace-nowrap ${
                    isActive
                      ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                      : ""
                  }`}
                >
                  {category.label} ({categoryCounts[category.id] ?? 0})
                </Button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        {listQuery.isLoading ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">Loading...</p>
          </div>
        ) : filteredCases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredCases.map((caseStudy) => {
              const isEdited =
                typeof caseStudy.updatedAt === "number" &&
                caseStudy.updatedAt > caseStudy.createdAt;
              const authorName = caseStudy.authorName ?? "Unknown user";
              return (
                <Card
                  key={caseStudy.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow group"
                  onClick={() => setSelectedCaseId(caseStudy.id)}
                >
                  {caseStudy.thumbnailUrl && (
                    <div className="relative w-full h-56 overflow-hidden rounded-t-lg">
                      <img
                        src={caseStudy.thumbnailUrl}
                        alt={caseStudy.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <a
                      href={`/users/${caseStudy.userId}`}
                      onClick={e => e.stopPropagation()}
                      className="mb-3 inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={caseStudy.authorAvatarUrl ?? undefined}
                          alt={`${authorName} avatar`}
                        />
                        <AvatarFallback>{getInitials(authorName)}</AvatarFallback>
                      </Avatar>
                      <p className="text-sm text-muted-foreground truncate hover:underline">
                        {authorName}
                      </p>
                    </a>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-xl">{caseStudy.title}</CardTitle>
                        {isEdited && <Badge variant="outline">Edited</Badge>}
                        </div>
                      <div className="flex items-center">
                        {user?.loginMethod === "google" && caseStudy.userId === user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditCase(caseStudy.id);
                            }}
                            aria-label="Edit case study"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleFavoriteClick(e, caseStudy.id)}
                          aria-label="Toggle favorite"
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              caseStudy.isFavorite ? "fill-red-500 text-red-500" : ""
                            }`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => handleShareCase(caseStudy, e)}
                          aria-label="Share post"
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={
                            reportMutation.isPending ||
                            caseStudy.userId === user?.id ||
                            caseStudy.isReported
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReportCase(caseStudy.id, caseStudy.userId);
                          }}
                          aria-label="Report post"
                        >
                          <Flag
                            className={`w-4 h-4 ${
                              caseStudy.isReported ? "fill-amber-500 text-amber-500" : ""
                            }`}
                          />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{caseStudy.description}</CardDescription>
                    {isEdited && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Edited: {formatDateTime(caseStudy.updatedAt)}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {caseStudy.tools.map((tool: string) => (
                        <Badge key={tool} variant="secondary">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                    {caseStudy.isRecommended === 1 && (
                      <Badge variant="default" className="bg-gradient-to-r from-purple-500 to-blue-500">
                        Recommended
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No matching case studies found.</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedCaseId && (
        <CaseDetailModal
          caseStudy={selectedCase}
          onClose={() => setSelectedCaseId(null)}
          onFavoriteToggle={handleFavoriteToggle}
          onReport={handleReportCase}
          onShare={handleShareCase}
          onEdit={handleEditCase}
          onDelete={handleDeleteCase}
          canEdit={canEditSelected}
          canDelete={canDeleteSelected}
          canReport={canReportSelected}
        />
      )}

      {isAddModalOpen && (
        <AddCaseModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            utils.caseStudies.list.invalidate();
          }}
        />
      )}

      {editingCase && (
        <AddCaseModal
          mode="edit"
          caseStudy={editingCase}
          onClose={() => setEditingCaseId(null)}
          onSuccess={() => {
            setEditingCaseId(null);
            utils.caseStudies.list.invalidate();
          }}
        />
      )}

      <Dialog open={isReportDialogOpen} onOpenChange={handleReportDialogOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Report Post</DialogTitle>
            <DialogDescription>
              Tell admins why this post should be reviewed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={reportMessage}
              onChange={(event) => setReportMessage(event.target.value)}
              placeholder="Explain the issue (spam, misleading content, abuse, etc.)"
              className="min-h-28"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {reportMessage.length}/500
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleReportDialogOpenChange(false)}
              disabled={reportMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitReport}
              disabled={reportMutation.isPending || reportMessage.trim().length < 5}
            >
              {reportMutation.isPending ? "Reporting..." : "Submit Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isAiDiscussionOpen} onOpenChange={setIsAiDiscussionOpen}>
        <DialogContent className="h-[90vh] w-[95vw] max-w-6xl overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>AI Discussion</DialogTitle>
            <DialogDescription>Embedded chatbot for AI discussion.</DialogDescription>
          </DialogHeader>
          <iframe
            src={AI_DISCUSSION_EMBED_URL}
            title="AI Discussion Chatbot"
            style={{ width: "100%", height: "100%", minHeight: "700px" }}
            frameBorder="0"
            allow="microphone"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}


