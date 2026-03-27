import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function About() {
  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">About Promptarium</h1>
          <p className="text-sm text-muted-foreground">
            A community hub to share AI prompts, workflows, and practical quest solutions.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/">Back to Home</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What Promptarium Is</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Promptarium is a place where people publish reusable prompts, automation
            ideas, and tool stacks that actually work.
          </p>
          <p>
            You can post your own workflows, ask quests when you are blocked, and learn
            from how others solve similar AI tasks.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Posting and solving quests earns EXP, which increases your public level.
            Likes on your posts also grant a smaller EXP bonus.
          </p>
          <p>
            Moderation is handled by admins to keep content useful and safe for the
            community.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
