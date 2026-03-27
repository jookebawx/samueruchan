import { useState } from "react";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import type { CaseStudy } from "@/lib/caseStudies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

interface AddCaseModalProps {
  onClose: () => void;
  onSuccess: () => void;
  caseStudy?: CaseStudy | null;
  mode?: "create" | "edit";
}

type Category = "prompt" | "automation" | "tools" | "business";

const categories = [
  { id: "prompt" as Category, label: "Prompt Library" },
  { id: "automation" as Category, label: "Automation" },
  { id: "tools" as Category, label: "Tools" },
  { id: "business" as Category, label: "Business" },
];

export function AddCaseModal({
  onClose,
  onSuccess,
  caseStudy,
  mode = "create",
}: AddCaseModalProps) {
  const MAX_IMAGE_WIDTH = 1200;
  const MAX_IMAGE_HEIGHT = 900;
  const JPEG_QUALITY = 0.82;
  const isEditMode = mode === "edit" && Boolean(caseStudy);

  const [formData, setFormData] = useState(() => ({
    title: caseStudy?.title ?? "",
    description: caseStudy?.description ?? "",
    category: (caseStudy?.category ?? "automation") as Category,
    tools: caseStudy?.tools?.join(", ") ?? "",
    challenge: caseStudy?.challenge ?? "",
    solution: caseStudy?.solution ?? "",
    steps: caseStudy?.steps?.join("\n") ?? "",
    impact: caseStudy?.impact ?? "",
  }));
  const [imagePreview, setImagePreview] = useState<string | null>(
    caseStudy?.thumbnailUrl ?? null
  );

  const [isSaving, setIsSaving] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const utils = trpc.useUtils();
  const createMutation = trpc.caseStudies.create.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });
  const updateMutation = trpc.caseStudies.update.useMutation({
    onSuccess: () => utils.caseStudies.list.invalidate(),
  });

  const readFileAsDataUrl = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image."));
      reader.readAsDataURL(file);
    });

  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = src;
    });

  const compressImage = async (file: File) => {
    const originalDataUrl = await readFileAsDataUrl(file);
    const img = await loadImage(originalDataUrl);

    const scale = Math.min(
      1,
      MAX_IMAGE_WIDTH / img.width,
      MAX_IMAGE_HEIGHT / img.height
    );
    const targetWidth = Math.max(1, Math.round(img.width * scale));
    const targetHeight = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context.");
    }

    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });

    if (!blob) {
      throw new Error("Failed to compress image.");
    }

    return readFileAsDataUrl(blob);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      setImagePreview(compressedDataUrl);
    } catch (error) {
      console.error(error);
      toast.error("Failed to compress image.");
      setImagePreview(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    if (!isAuthenticated) {
      toast.error("Login required.");
      window.location.href = getLoginUrl();
      return;
    }
    if (user?.loginMethod !== "google") {
      toast.error("Google login required to post.");
      return;
    }
    setIsSaving(true);

    const toolsArray = formData.tools
      .split(",")
      .map((t: string) => t.trim())
      .filter((t: string) => t.length > 0);

    const stepsArray = formData.steps
      .split("\n")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);

    const thumbnailUrl = imagePreview ?? undefined;

    try {
      if (isEditMode && caseStudy) {
        await updateMutation.mutateAsync({
          id: caseStudy.id,
          title: formData.title,
          description: formData.description,
          category: formData.category,
          tools: toolsArray,
          challenge: formData.challenge,
          solution: formData.solution,
          steps: stepsArray,
          impact: formData.impact || undefined,
          thumbnailUrl,
          thumbnailKey: caseStudy.thumbnailKey ?? undefined,
        });

        toast.success("Post updated.");
        onSuccess();
      } else {
        await createMutation.mutateAsync({
          title: formData.title,
          description: formData.description,
          category: formData.category,
          tools: toolsArray,
          challenge: formData.challenge,
          solution: formData.solution,
          steps: stepsArray,
          impact: formData.impact || undefined,
          thumbnailUrl,
        });

        toast.success("Post created.");
        onSuccess();
      }
    } catch (_error) {
      toast.error(
        isEditMode ? "Failed to update post." : "Failed to create post."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <DialogTitle>
              {isEditMode ? "Edit Post" : "Create New Post"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEditMode
              ? "Update this post."
              : "Share practical AI examples so your team can learn faster together."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Auto-structure meeting notes"
              className="mt-2"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">
              Short Description <span className="text-red-500">*</span>
            </Label>
            <Input
              id="description"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g. AI organizes and classifies rough meeting notes"
              className="mt-2"
            />
          </div>

          {/* Category */}
          <div>
            <Label>
              Category <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {categories.map((category) => (
                <Button
                  key={category.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, category: category.id })}
                  variant={formData.category === category.id ? "default" : "outline"}
                  className={`rounded-full ${
                    formData.category === category.id
                      ? "bg-gradient-to-r from-purple-500 to-blue-500"
                      : ""
                  }`}
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Tools */}
          <div>
            <Label htmlFor="tools">
              Tools Used <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tools"
              required
              value={formData.tools}
              onChange={(e) => setFormData({ ...formData, tools: e.target.value })}
              placeholder="e.g. ChatGPT, GAS (comma-separated)"
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Separate multiple tools with commas.
            </p>
          </div>

          {/* Thumbnail Upload */}
          <div>
            <Label htmlFor="thumbnail">Diagram / Thumbnail</Label>
            <div className="mt-2">
              <input
                id="thumbnail"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              <label
                htmlFor="thumbnail"
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer block"
              >
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Click to change image
                    </p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-foreground">
                      Click or drag to upload an image
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PNG, JPG (recommended: 1200x900px)
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Challenge */}
          <div>
            <Label htmlFor="challenge">
              Problem to Solve <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="challenge"
              required
              value={formData.challenge}
              onChange={(e) => setFormData({ ...formData, challenge: e.target.value })}
              placeholder="e.g. Writing weekly meeting minutes takes 30 minutes every time..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Solution */}
          <div>
            <Label htmlFor="solution">
              Solution <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="solution"
              required
              value={formData.solution}
              onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
              placeholder="e.g. Send rough notes from Google Docs to the ChatGPT API..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Steps */}
          <div>
            <Label htmlFor="steps">
              Implementation Steps <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="steps"
              required
              value={formData.steps}
              onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
              placeholder="Enter one step per line&#10;e.g.&#10;1. Record meeting notes in Google Docs&#10;2. Fetch doc content with GAS&#10;3. Send to the ChatGPT API..."
              rows={5}
              className="mt-2"
            />
          </div>

          {/* Impact */}
          <div>
            <Label htmlFor="impact">Impact (Optional)</Label>
            <Input
              id="impact"
              value={formData.impact}
              onChange={(e) => setFormData({ ...formData, impact: e.target.value })}
              placeholder="e.g. Reduced minutes writing time from 30 min to 5 min"
              className="mt-2"
            />
          </div>

          {/* Info Note */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
            <div className="flex gap-3">
              <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-foreground">
                <p className="font-medium mb-1">After posting...</p>
                <p className="text-muted-foreground">
                  Tags are auto-generated and your post is published to the gallery.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="button" onClick={onClose} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500"
              disabled={isSaving}
            >
              {isSaving
                ? "Saving..."
                : isEditMode
                  ? "Update"
                  : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
