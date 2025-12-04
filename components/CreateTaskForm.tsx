import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TaskSuggestions {
  priorityLevel: number;
  suggestedSubtasks: string[];
  improvements: string[];
  estimatedTime: string;
}

interface CreateTaskFormProps {
  onSubmit: (title: string, description: string) => Promise<void>;
}

export function CreateTaskForm({ onSubmit }: CreateTaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestions | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(title, description);
      setTitle("");
      setDescription("");
      setSuggestions(null);
      setShowSuggestions(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSmartSuggestions = async () => {
    if (!title.trim()) {
      setError("Please enter a task title to get suggestions");
      return;
    }

    setIsLoadingSuggestions(true);
    setError(null);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("You must be logged in to get suggestions");
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/get-task-suggestions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ title, description }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get suggestions");
      }

      const suggestionsData = await response.json();
      setSuggestions(suggestionsData);
      setShowSuggestions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const applyPriority = () => {
    if (suggestions) {
      // Priority is already stored in suggestions, we could update the task when creating
      // For now, we'll just show it in the UI
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title"
            required
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter task description"
            rows={3}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={getSmartSuggestions}
            disabled={isLoadingSuggestions || !title.trim()}
            className="flex items-center gap-2"
          >
            {isLoadingSuggestions ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Get AI Suggestions
              </>
            )}
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? "Creating..." : "Create Task"}
          </Button>
        </div>
        {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
      </form>

      {showSuggestions && suggestions && (
        <Card className="mt-4 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              AI Smart Suggestions
            </CardTitle>
            <CardDescription>
              Get insights and recommendations for your task
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">Priority Level</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant={
                      suggestions.priorityLevel >= 4
                        ? "destructive"
                        : suggestions.priorityLevel >= 3
                        ? "default"
                        : "secondary"
                    }
                    className="text-base px-3 py-1"
                  >
                    {suggestions.priorityLevel}/5
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {suggestions.estimatedTime && (
                      <>Est. time: {suggestions.estimatedTime}</>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {suggestions.suggestedSubtasks.length > 0 && (
              <div>
                <Label className="text-sm font-semibold">Suggested Subtasks</Label>
                <ul className="mt-2 space-y-1">
                  {suggestions.suggestedSubtasks.map((subtask, index) => (
                    <li
                      key={index}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-purple-600 dark:text-purple-400 mt-1">
                        •
                      </span>
                      <span>{subtask}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {suggestions.improvements.length > 0 && (
              <div>
                <Label className="text-sm font-semibold">Improvements</Label>
                <ul className="mt-2 space-y-1">
                  {suggestions.improvements.map((improvement, index) => (
                    <li
                      key={index}
                      className="text-sm text-muted-foreground flex items-start gap-2"
                    >
                      <span className="text-pink-600 dark:text-pink-400 mt-1">
                        💡
                      </span>
                      <span>{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSuggestions(false)}
              className="w-full"
            >
              Close
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
