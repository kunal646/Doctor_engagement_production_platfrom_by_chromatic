import { ReactNode } from "react";
import { addCommentAction } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface CommentItem {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

interface CommentThreadProps {
  requestId: string;
  comments: CommentItem[];
  canComment?: boolean;
  actions?: ReactNode;
}

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (email?.[0] ?? "U").toUpperCase();
}

export function CommentThread({
  requestId,
  comments,
  canComment = false,
  actions,
}: CommentThreadProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium">Comments</h2>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">
                  {getInitials(comment.profiles?.full_name, comment.profiles?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {comment.profiles?.full_name || comment.profiles?.email || "User"}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{comment.comment}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {canComment ? (
        <>
          <Separator />
          <form action={addCommentAction} className="space-y-3">
            <input type="hidden" name="request_id" value={requestId} />
            <Textarea
              name="comment"
              required
              rows={3}
              placeholder="Write your feedback or requested changes..."
            />
            <SubmitButton type="submit" size="sm">
              Post Comment
            </SubmitButton>
          </form>
        </>
      ) : null}

      {actions ? (
        <>
          <Separator />
          {actions}
        </>
      ) : null}
    </section>
  );
}
