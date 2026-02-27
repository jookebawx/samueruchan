import { useEffect, useMemo, useState } from "react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Quest } from "@/lib/quests";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  Home,
  MessageSquare,
  PauseCircle,
  Send,
  Ticket,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type QuestStatus = "open" | "finished" | "suspended" | "unsolved";
type QuestCloseOutcome = Exclude<QuestStatus, "open">;
type QuestFilter = "all" | QuestStatus;
type ParticipantRole = "poster" | "solver" | "replier";

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

function normalizeQuestStatus(status: string | null | undefined): QuestStatus {
  if (status === "open") return "open";
  if (status === "finished") return "finished";
  if (status === "suspended") return "suspended";
  if (status === "unsolved") return "unsolved";
  if (status === "closed") return "unsolved";
  return "unsolved";
}

function getQuestStatusMeta(status: QuestStatus) {
  switch (status) {
    case "open":
      return {
        label: "Open",
        className: "bg-primary/10 text-primary border-primary/30",
        icon: Circle,
      };
    case "finished":
      return {
        label: "Finished",
        className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
        icon: CheckCircle2,
      };
    case "suspended":
      return {
        label: "Suspended",
        className: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
        icon: PauseCircle,
      };
    case "unsolved":
      return {
        label: "Unsolved",
        className: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300",
        icon: XCircle,
      };
    default:
      return {
        label: "Unsolved",
        className: "bg-rose-500/10 text-rose-700 border-rose-500/30 dark:text-rose-300",
        icon: XCircle,
      };
  }
}

function getParticipantRole(
  userId: number,
  questOwnerId: number,
  solverUserId: number | null | undefined
): ParticipantRole {
  if (solverUserId && userId === solverUserId) return "solver";
  if (userId === questOwnerId) return "poster";
  return "replier";
}

function getParticipantMeta(role: ParticipantRole) {
  switch (role) {
    case "poster":
      return {
        label: "Poster",
        textClass: "text-sky-700 dark:text-sky-300",
        badgeClass:
          "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      };
    case "solver":
      return {
        label: "Solver",
        textClass: "text-emerald-700 dark:text-emerald-300",
        badgeClass:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    case "replier":
      return {
        label: "Replier",
        textClass: "text-amber-700 dark:text-amber-300",
        badgeClass:
          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    default:
      return {
        label: "Replier",
        textClass: "text-amber-700 dark:text-amber-300",
        badgeClass:
          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
  }
}

export default function QuestPage() {
  const utils = trpc.useUtils();
  const { isAuthenticated, user } = useAuth();

  const [filter, setFilter] = useState<QuestFilter>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuestId, setSelectedQuestId] = useState<number | null>(null);
  const [newQuestTitle, setNewQuestTitle] = useState("");
  const [newQuestContent, setNewQuestContent] = useState("");
  const [newAnswerContent, setNewAnswerContent] = useState("");
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [closeOutcome, setCloseOutcome] = useState<QuestCloseOutcome>("finished");
  const [selectedSolvedAnswerId, setSelectedSolvedAnswerId] = useState("");

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
  const selectedQuestStatus = normalizeQuestStatus(selectedQuest?.status);
  const answers = detailQuery.data?.answers ?? [];
  const isSelectedQuestOwner = Boolean(selectedQuest && user?.id === selectedQuest.userId);
  const isSelectedQuestClosed = Boolean(selectedQuest && selectedQuestStatus !== "open");
  const selectedSolvedAnswer = useMemo(() => {
    if (!selectedQuest?.solvedAnswerId) return null;
    return answers.find(answer => answer.id === selectedQuest.solvedAnswerId) ?? null;
  }, [answers, selectedQuest?.solvedAnswerId]);

  useEffect(() => {
    if (!isCloseDialogOpen) return;
    if (selectedQuest?.solvedAnswerId) {
      setCloseOutcome("finished");
      setSelectedSolvedAnswerId(String(selectedQuest.solvedAnswerId));
      return;
    }
    setCloseOutcome(answers.length > 0 ? "finished" : "unsolved");
    setSelectedSolvedAnswerId("");
  }, [isCloseDialogOpen, selectedQuest?.solvedAnswerId, answers.length]);

  useEffect(() => {
    if (closeOutcome === "finished" && answers.length === 0) {
      setCloseOutcome("unsolved");
    }
  }, [answers.length, closeOutcome]);

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
      setIsCloseDialogOpen(false);
      toast.success("Quest closed.");
    },
  });

  const filteredQuests = useMemo(() => {
    return quests.filter(quest => {
      const status = normalizeQuestStatus(quest.status);
      const matchesFilter = filter === "all" || status === filter;
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
    const counts: Record<QuestStatus, number> = {
      open: 0,
      finished: 0,
      suspended: 0,
      unsolved: 0,
    };

    for (const quest of quests) {
      counts[normalizeQuestStatus(quest.status)] += 1;
    }

    return {
      all: quests.length,
      ...counts,
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

  const handleConfirmCloseQuest = async () => {
    if (!selectedQuestId || !isSelectedQuestOwner) return;

    const isFinished = closeOutcome === "finished";
    if (isFinished && answers.length === 0) {
      toast.error("Cannot mark as finished without any answers.");
      return;
    }
    if (isFinished && !selectedSolvedAnswerId) {
      toast.error("Choose the solver comment before closing as finished.");
      return;
    }

    try {
      await closeQuestMutation.mutateAsync({
        questId: selectedQuestId,
        outcome: closeOutcome,
        solvedAnswerId: isFinished ? Number(selectedSolvedAnswerId) : undefined,
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
            Ask prompt questions, share answers, and close quests with a clear outcome.
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
            <div className="flex flex-wrap gap-2">
              {([
                { id: "all", label: `All (${questCounts.all})` },
                { id: "open", label: `Open (${questCounts.open})` },
                { id: "finished", label: `Finished (${questCounts.finished})` },
                { id: "suspended", label: `Suspended (${questCounts.suspended})` },
                { id: "unsolved", label: `Unsolved (${questCounts.unsolved})` },
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
                const status = normalizeQuestStatus(quest.status);
                const statusMeta = getQuestStatusMeta(status);
                const StatusIcon = statusMeta.icon;
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
                      <Badge variant="outline" className={cn("gap-1", statusMeta.className)}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {statusMeta.label}
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
                      {(() => {
                        const statusMeta = getQuestStatusMeta(selectedQuestStatus);
                        const StatusIcon = statusMeta.icon;
                        return (
                          <Badge
                            variant="outline"
                            className={cn("flex items-center gap-1", statusMeta.className)}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            {statusMeta.label}
                          </Badge>
                        );
                      })()}
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(selectedQuest.createdAt)}
                      </span>
                    </div>
                    {selectedQuestStatus === "finished" && selectedSolvedAnswer && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        Solved by {selectedSolvedAnswer.authorName ?? "Unknown user"}
                      </p>
                    )}
                  </div>
                  {isSelectedQuestOwner && !isSelectedQuestClosed && (
                    <Button
                      onClick={() => setIsCloseDialogOpen(true)}
                      disabled={closeQuestMutation.isPending}
                      variant="outline"
                    >
                      Close Quest
                    </Button>
                  )}
                </div>
                <a
                  href={`/users/${selectedQuest.userId}`}
                  className="inline-flex items-center gap-2 text-sm hover:underline w-fit"
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage
                      src={selectedQuest.authorAvatarUrl ?? undefined}
                      alt={`${selectedQuest.authorName ?? "Unknown user"} avatar`}
                    />
                    <AvatarFallback>{getInitials(selectedQuest.authorName)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sky-700 dark:text-sky-300">
                    {selectedQuest.authorName ?? "Unknown user"}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                  >
                    Poster
                  </Badge>
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
                  answers.map(answer => {
                    const role = getParticipantRole(
                      answer.userId,
                      selectedQuest.userId,
                      selectedQuest.solverUserId
                    );
                    const participant = getParticipantMeta(role);
                    return (
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
                            <span className={cn("font-medium", participant.textClass)}>
                              {answer.authorName ?? "Unknown user"}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn("text-[10px]", participant.badgeClass)}
                            >
                              {participant.label}
                            </Badge>
                          </a>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(answer.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{answer.content}</p>
                      </div>
                    );
                  })
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

      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Quest</DialogTitle>
            <DialogDescription>
              Choose the final result for this quest. If finished, select the solver
              comment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-3">
              {([
                {
                  id: "finished",
                  label: "Finished",
                  description: "Problem solved with a valid answer.",
                },
                {
                  id: "suspended",
                  label: "Suspended",
                  description: "Paused for now. Can revisit later.",
                },
                {
                  id: "unsolved",
                  label: "Unsolved",
                  description: "Closed without a working solution.",
                },
              ] as Array<{
                id: QuestCloseOutcome;
                label: string;
                description: string;
              }>).map(option => {
                const isDisabled = option.id === "finished" && answers.length === 0;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setCloseOutcome(option.id)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      closeOutcome === option.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40",
                      isDisabled && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {closeOutcome === "finished" && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Solver Comment</p>
                {answers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No answers yet. Add answers before marking as finished.
                  </p>
                ) : (
                  <select
                    value={selectedSolvedAnswerId}
                    onChange={event => setSelectedSolvedAnswerId(event.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  >
                    <option value="">Select the solver comment</option>
                    {answers.map(answer => (
                      <option key={answer.id} value={answer.id}>
                        {(answer.authorName ?? "Unknown user") +
                          ": " +
                          answer.content.replace(/\s+/g, " ").slice(0, 72)}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCloseDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCloseQuest}
              disabled={
                closeQuestMutation.isPending ||
                (closeOutcome === "finished" &&
                  (answers.length === 0 || !selectedSolvedAnswerId))
              }
            >
              {closeQuestMutation.isPending ? "Closing..." : "Confirm Close"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
