import { useEffect, useMemo, useState } from "react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import type { Quest } from "@/lib/quests";
import { CheckCircle2, Circle, Home, MessageSquare, Send, Ticket } from "lucide-react";
import { toast } from "sonner";

type QuestFilter = "all" | "open" | "closed";

function getInitials(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? "")
    .join("");
}

const formatDateTime = (timestamp: number) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));

export default function QuestPage() {
  const utils = trpc.useUtils();
  const { isAuthenticated, user } = useAuth();

  const [filter, setFilter] = useState<QuestFilter>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuestId, setSelectedQuestId] = useState<number | null>(null);
  const [newQuestTitle, setNewQuestTitle] = useState("");
  const [newQuestContent, setNewQuestContent] = useState("");
  const [newAnswerContent, setNewAnswerContent] = useState("");

  const listQuery = trpc.quests.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const quests: Quest[] = listQuery.data ?? [];

  useEffect(() => {
    if (quests.length === 0) {
      setSelectedQuestId(null);
      return;
    }
    if (!selectedQuestId || !quests.some(quest => quest.id === selectedQuestId)) {
      setSelectedQuestId(quests[0].id);
    }
  }, [quests, selectedQuestId]);

  const detailQuery = trpc.quests.getById.useQuery(
    { id: selectedQuestId ?? 0 },
    {
      enabled: Boolean(selectedQuestId),
      refetchOnWindowFocus: false,
    }
  );

  const selectedFromList = quests.find(quest => quest.id === selectedQuestId) ?? null;
  const selectedQuest = detailQuery.data?.quest ?? selectedFromList;
  const answers = detailQuery.data?.answers ?? [];
  const isSelectedQuestOwner = Boolean(selectedQuest && user?.id === selectedQuest.userId);
  const isSelectedQuestClosed = selectedQuest?.status === "closed";

  const createQuestMutation = trpc.quests.create.useMutation({
    onSuccess: async (result) => {
      await utils.quests.list.invalidate();
      setSelectedQuestId(result.id);
      setNewQuestTitle("");
      setNewQuestContent("");
      toast.success("Quest created.");
    },
  });

  const answerMutation = trpc.quests.answer.useMutation({
    onSuccess: async () => {
      if (selectedQuestId) {
        await utils.quests.getById.invalidate({ id: selectedQuestId });
      }
      await utils.quests.list.invalidate();
      setNewAnswerContent("");
      toast.success("Answer posted.");
    },
  });

  const closeQuestMutation = trpc.quests.close.useMutation({
    onSuccess: async (result) => {
      if (selectedQuestId) {
        await utils.quests.getById.invalidate({ id: selectedQuestId });
      }
      await utils.quests.list.invalidate();
      if (result.alreadyClosed) {
        toast.message("Quest was already closed.");
        return;
      }
      toast.success("Quest closed.");
    },
  });

  const filteredQuests = useMemo(() => {
    return quests.filter(quest => {
      const matchesFilter = filter === "all" || quest.status === filter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q.length === 0 ||
        quest.title.toLowerCase().includes(q) ||
        quest.content.toLowerCase().includes(q) ||
        (quest.authorName ?? "").toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [filter, quests, searchQuery]);

  const questCounts = useMemo(() => {
    const open = quests.filter(quest => quest.status === "open").length;
    const closed = quests.filter(quest => quest.status === "closed").length;
    return {
      all: quests.length,
      open,
      closed,
    };
  }, [quests]);

  const handleCreateQuest = async () => {
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }

    const title = newQuestTitle.trim();
    const content = newQuestContent.trim();
    if (!title || !content) {
      toast.error("Title and question are required.");
      return;
    }

    try {
      await createQuestMutation.mutateAsync({
        title,
        content,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to create quest.");
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedQuestId) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    if (isSelectedQuestClosed) {
      toast.error("This quest is already closed.");
      return;
    }

    const content = newAnswerContent.trim();
    if (!content) {
      toast.error("Answer cannot be empty.");
      return;
    }

    try {
      await answerMutation.mutateAsync({
        questId: selectedQuestId,
        content,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to post answer.");
    }
  };

  const handleCloseQuest = async () => {
    if (!selectedQuestId || !isSelectedQuestOwner) return;
    const confirmed = window.confirm("Close this quest as resolved?");
    if (!confirmed) return;

    try {
      await closeQuestMutation.mutateAsync({
        questId: selectedQuestId,
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to close quest.");
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Ticket className="w-6 h-6" />
            Quest Board
          </h1>
          <p className="text-sm text-muted-foreground">
            Ask prompt questions, share answers, and close quests when resolved.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Back to Home
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open a New Quest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={newQuestTitle}
            onChange={event => setNewQuestTitle(event.target.value)}
            placeholder="Short title for your question"
            maxLength={160}
          />
          <Textarea
            value={newQuestContent}
            onChange={event => setNewQuestContent(event.target.value)}
            placeholder="Describe your prompt problem and what you already tried"
            className="min-h-28"
            maxLength={5000}
          />
          <div className="flex items-center justify-end gap-2">
            {!isAuthenticated && (
              <Button
                onClick={() => {
                  window.location.href = getLoginUrl();
                }}
                variant="outline"
              >
                Login to Post
              </Button>
            )}
            <Button
              onClick={handleCreateQuest}
              disabled={createQuestMutation.isPending}
            >
              {createQuestMutation.isPending ? "Creating..." : "Create Quest"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="space-y-3">
            <CardTitle>Quests</CardTitle>
            <Input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search quests"
            />
            <div className="flex gap-2">
              {([
                { id: "all", label: `All (${questCounts.all})` },
                { id: "open", label: `Open (${questCounts.open})` },
                { id: "closed", label: `Closed (${questCounts.closed})` },
              ] as Array<{ id: QuestFilter; label: string }>).map(item => (
                <Button
                  key={item.id}
                  onClick={() => setFilter(item.id)}
                  variant={filter === item.id ? "default" : "outline"}
                  size="sm"
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[70vh] overflow-auto">
            {listQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading quests...</p>
            ) : filteredQuests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quests found.</p>
            ) : (
              filteredQuests.map(quest => {
                const isSelected = quest.id === selectedQuestId;
                return (
                  <button
                    key={quest.id}
                    type="button"
                    onClick={() => setSelectedQuestId(quest.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight">{quest.title}</p>
                      <Badge variant={quest.status === "closed" ? "secondary" : "default"}>
                        {quest.status === "closed" ? "Closed" : "Open"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {quest.content}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{quest.authorName ?? "Unknown user"}</span>
                      <span>{quest.answerCount} answers</span>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>

        {!selectedQuest ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a quest to see details and answers.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <CardTitle className="text-2xl">{selectedQuest.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isSelectedQuestClosed ? "secondary" : "default"}
                        className="flex items-center gap-1"
                      >
                        {isSelectedQuestClosed ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Circle className="w-3.5 h-3.5" />
                        )}
                        {isSelectedQuestClosed ? "Closed" : "Open"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(selectedQuest.createdAt)}
                      </span>
                    </div>
                  </div>
                  {isSelectedQuestOwner && !isSelectedQuestClosed && (
                    <Button
                      onClick={handleCloseQuest}
                      disabled={closeQuestMutation.isPending}
                      variant="outline"
                    >
                      {closeQuestMutation.isPending ? "Closing..." : "Close Quest"}
                    </Button>
                  )}
                </div>
                <a
                  href={`/users/${selectedQuest.userId}`}
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:underline w-fit"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage
                      src={selectedQuest.authorAvatarUrl ?? undefined}
                      alt={`${selectedQuest.authorName ?? "Unknown user"} avatar`}
                    />
                    <AvatarFallback>{getInitials(selectedQuest.authorName)}</AvatarFallback>
                  </Avatar>
                  <span>{selectedQuest.authorName ?? "Unknown user"}</span>
                </a>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {selectedQuest.content}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Answers ({answers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {detailQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading answers...</p>
                ) : answers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No answers yet. Be the first to help.
                  </p>
                ) : (
                  answers.map(answer => (
                    <div key={answer.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <a
                          href={`/users/${answer.userId}`}
                          className="inline-flex items-center gap-2 text-sm hover:underline"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage
                              src={answer.authorAvatarUrl ?? undefined}
                              alt={`${answer.authorName ?? "Unknown user"} avatar`}
                            />
                            <AvatarFallback>{getInitials(answer.authorName)}</AvatarFallback>
                          </Avatar>
                          <span>{answer.authorName ?? "Unknown user"}</span>
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(answer.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{answer.content}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Post an Answer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {isSelectedQuestClosed ? (
                  <p className="text-sm text-muted-foreground">
                    This quest is closed. New answers are disabled.
                  </p>
                ) : (
                  <>
                    <Textarea
                      value={newAnswerContent}
                      onChange={event => setNewAnswerContent(event.target.value)}
                      placeholder="Share your prompt suggestions or solution"
                      className="min-h-28"
                      maxLength={5000}
                    />
                    <div className="flex items-center justify-end gap-2">
                      {!isAuthenticated && (
                        <Button
                          onClick={() => {
                            window.location.href = getLoginUrl();
                          }}
                          variant="outline"
                        >
                          Login to Answer
                        </Button>
                      )}
                      <Button
                        onClick={handleSubmitAnswer}
                        disabled={answerMutation.isPending}
                        className="flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        {answerMutation.isPending ? "Posting..." : "Post Answer"}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
