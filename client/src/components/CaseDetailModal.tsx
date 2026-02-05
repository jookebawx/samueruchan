import { type CaseStudy } from "@/lib/localCaseStudies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Heart, Trash2 } from "lucide-react";

interface CaseDetailModalProps {
  caseStudy: CaseStudy | null;
  onClose: () => void;
  onFavoriteToggle: (id: number) => void;
  onDelete: (id: number) => void;
}

export function CaseDetailModal({
  caseStudy,
  onClose,
  onFavoriteToggle,
  onDelete,
}: CaseDetailModalProps) {

  if (!caseStudy) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">事例が見つかりませんでした</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleFavoriteClick = () => {
    onFavoriteToggle(caseStudy.id);
  };

  const handleDeleteClick = () => {
    onDelete(caseStudy.id);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl mb-2">{caseStudy.title}</DialogTitle>
              <DialogDescription className="text-base">
                {caseStudy.description}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleFavoriteClick}
                aria-label="Toggle favorite"
              >
                <Heart
                  className={`w-5 h-5 ${
                    caseStudy.isFavorite ? "fill-red-500 text-red-500" : ""
                  }`}
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDeleteClick}
                className="text-destructive hover:text-destructive"
                aria-label="Delete case study"
              >
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Thumbnail */}
          {caseStudy.thumbnailUrl && (
            <div className="w-full rounded-lg overflow-hidden">
              <img
                src={caseStudy.thumbnailUrl}
                alt={caseStudy.title}
                className="w-full h-auto object-cover"
              />
            </div>
          )}

          {/* Tools */}
          <div>
            <h3 className="font-semibold text-lg mb-2">使用ツール</h3>
            <div className="flex flex-wrap gap-2">
              {caseStudy.tools.map((tool: string) => (
                <Badge key={tool} variant="secondary">
                  {tool}
                </Badge>
              ))}
            </div>
          </div>

          {/* Challenge */}
          <div>
            <h3 className="font-semibold text-lg mb-2">解決したい課題</h3>
            <p className="text-foreground leading-relaxed">{caseStudy.challenge}</p>
          </div>

          {/* Solution */}
          <div>
            <h3 className="font-semibold text-lg mb-2">解決策</h3>
            <p className="text-foreground leading-relaxed">{caseStudy.solution}</p>
          </div>

          {/* Steps */}
          <div>
            <h3 className="font-semibold text-lg mb-2">実装ステップ</h3>
            <ol className="list-decimal list-inside space-y-2">
              {caseStudy.steps.map((step: string, index: number) => (
                <li key={index} className="text-foreground leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Impact */}
          {caseStudy.impact && (
            <div>
              <h3 className="font-semibold text-lg mb-2">効果・インパクト</h3>
              <p className="text-foreground leading-relaxed font-medium text-purple-600">
                {caseStudy.impact}
              </p>
            </div>
          )}

          {/* Tags */}
          <div>
            <h3 className="font-semibold text-lg mb-2">タグ</h3>
            <div className="flex flex-wrap gap-2">
              {caseStudy.tags.map((tag: string) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
