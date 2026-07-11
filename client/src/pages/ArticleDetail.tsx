import { trpc } from "@/lib/trpc";
import { useParams, Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Eye,
  Tag,
  ChevronRight,
  MessageSquare,
  Share2,
  BookOpen,
  User,
  Clock,
  ArrowLeft,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  strategy: "Strategy",
  deck_guide: "Deck Guide",
  set_review: "Set Review",
  tournament: "Tournament",
  collector: "Collector",
  news: "News",
};

const CATEGORY_COLORS: Record<string, string> = {
  strategy: "bg-blue-100 text-blue-700",
  deck_guide: "bg-purple-100 text-purple-700",
  set_review: "bg-green-100 text-green-700",
  tournament: "bg-orange-100 text-orange-700",
  collector: "bg-yellow-100 text-yellow-700",
  news: "bg-red-100 text-red-700",
};

function estimateReadTime(content: string) {
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function formatDate(iso: string | null) {
  if (!iso) return "Draft";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Improved markdown-to-HTML renderer with proper fenced code block support
function renderMarkdown(content: string) {
  const lines = content.split("\n");
  const html: string[] = [];
  let inList = false;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle fenced code blocks
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        if (inList) { html.push("</ul>"); inList = false; }
        inCodeBlock = true;
        codeLines = [];
      } else {
        inCodeBlock = false;
        const code = codeLines.join("\n").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        html.push(`<pre class="bg-gray-900 text-green-400 rounded-xl p-4 my-4 overflow-x-auto text-sm font-mono"><code>${code}</code></pre>`);
        codeLines = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!trimmed) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push("<div class=\"my-2\"></div>");
      continue;
    }

    if (trimmed.startsWith("### ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h3 class="text-lg font-bold text-gray-900 mt-6 mb-2">${inlineMarkdown(trimmed.slice(4))}</h3>`);
    } else if (trimmed.startsWith("## ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h2 class="text-xl font-bold text-gray-900 mt-8 mb-3">${inlineMarkdown(trimmed.slice(3))}</h2>`);
    } else if (trimmed.startsWith("# ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<h1 class="text-2xl font-bold text-gray-900 mt-8 mb-4">${inlineMarkdown(trimmed.slice(2))}</h1>`);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      if (!inList) { html.push('<ul class="list-disc pl-6 my-3 space-y-1">'); inList = true; }
      html.push(`<li class="text-gray-700">${inlineMarkdown(trimmed.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<ol class="list-decimal pl-6 my-3"><li class="text-gray-700">${inlineMarkdown(trimmed.replace(/^\d+\.\s/, ""))}</li></ol>`);
    } else if (trimmed.startsWith("> ")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<blockquote class="border-l-4 border-blue-400 pl-4 py-1 my-4 bg-blue-50 rounded-r-lg text-gray-700 italic">${inlineMarkdown(trimmed.slice(2))}</blockquote>`);
    } else if (trimmed.startsWith("---") || trimmed.startsWith("***")) {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push('<hr class="my-6 border-gray-200" />');
    } else {
      if (inList) { html.push("</ul>"); inList = false; }
      html.push(`<p class="text-gray-700 leading-relaxed my-3">${inlineMarkdown(trimmed)}</p>`);
    }
  }

  // Close any open structures
  if (inList) html.push("</ul>");
  if (inCodeBlock && codeLines.length > 0) {
    const code = codeLines.join("\n").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html.push(`<pre class="bg-gray-900 text-green-400 rounded-xl p-4 my-4 overflow-x-auto text-sm font-mono"><code>${code}</code></pre>`);
  }

  return html.join("\n");
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 text-red-600 px-1 rounded text-sm font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 underline hover:text-blue-700" target="_blank" rel="noopener noreferrer">$1</a>');
}

export default function ArticleDetail() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug ?? "";
  const { user, isAuthenticated } = useAuth();
  const [comment, setComment] = useState("");

  const { data: article, isLoading, error, refetch } = trpc.articles.getBySlug.useQuery(
    { slug },
    { enabled: !!slug }
  );

  const addCommentMutation = trpc.articles.addComment.useMutation({
    onSuccess: () => {
      toast.success("Comment posted!");
      setComment("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="space-y-3 mt-8">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Article Not Found</h1>
          <p className="text-gray-500 mb-6">This article doesn't exist or has been removed.</p>
          <Link href="/articles">
            <Button>Browse Articles</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Author data from joined query
  const authorName = (article as { authorName?: string | null }).authorName ?? "TCG Arena Staff";
  const authorUsername = (article as { authorUsername?: string | null }).authorUsername;
  const authorAvatarUrl = (article as { authorAvatarUrl?: string | null }).authorAvatarUrl;

  const readTime = estimateReadTime(article.content);
  const categoryColor = CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-700";
  const categoryLabel = CATEGORY_LABELS[article.category] ?? article.category;
  const tags = Array.isArray(article.tags) ? article.tags as string[] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-gray-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/articles" className="hover:text-blue-600 transition-colors">Articles</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-800 font-medium truncate max-w-[200px]">{article.title}</span>
        </nav>

        {/* Cover Image */}
        {article.coverImageUrl && (
          <div className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 aspect-[21/9]"
            style={/official-artwork|images\.pokemontcg\.io/.test(article.coverImageUrl)
              ? { background: "linear-gradient(135deg, #0B1220 0%, #2b1a55 55%, #5B21B6 100%)" }
              : undefined}>
            <img
              src={article.coverImageUrl}
              alt={article.title}
              className={/official-artwork|images\.pokemontcg\.io/.test(article.coverImageUrl)
                ? "w-full h-full object-contain p-6 drop-shadow-2xl"
                : "w-full h-full object-cover"}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        {/* Article Header */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          {/* Category + Tags */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge className={`${categoryColor} border-0 text-xs font-semibold`}>
              {categoryLabel}
            </Badge>
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs text-gray-500 border-gray-200">
                <Tag className="w-2.5 h-2.5 mr-1" />
                {tag}
              </Badge>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-3xl font-extrabold text-gray-900 leading-tight mb-3">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="text-lg text-gray-500 mb-6">{article.subtitle}</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pb-6 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <Avatar className="w-8 h-8">
                {authorAvatarUrl && <AvatarImage src={authorAvatarUrl} alt={authorName} />}
                <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                  {getInitials(authorName)}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="font-medium text-gray-700 block leading-tight">{authorName}</span>
                {authorUsername && (
                  <span className="text-xs text-gray-400">@{authorUsername}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formatDate(article.publishedAt)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{readTime} min read</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{article.viewCount.toLocaleString()} views</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{article.comments.length} comments</span>
            </div>
            <button
              onClick={handleShare}
              className="ml-auto flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>
          </div>

          {/* Article Content */}
          <div
            className="prose prose-gray max-w-none mt-6"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
          />
        </div>

        {/* Tags footer */}
        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-500">Tags:</span>
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs text-gray-600 border-gray-200 hover:bg-gray-50 cursor-pointer">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Comments Section */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">
              Comments ({article.comments.length})
            </h2>
          </div>

          {/* Comment Form */}
          {isAuthenticated ? (
            <div className="mb-8">
              <div className="flex gap-3">
                <Avatar className="w-9 h-9 flex-shrink-0">
                  <AvatarFallback className="bg-blue-600 text-white text-xs font-bold">
                    {user?.name ? getInitials(user.name) : "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-3">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your thoughts on this article..."
                    className="resize-none border-gray-200 focus:border-blue-400 rounded-xl"
                    rows={3}
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{comment.length}/2000</span>
                    <Button
                      size="sm"
                      disabled={!comment.trim() || addCommentMutation.isPending}
                      onClick={() => addCommentMutation.mutate({ articleId: article.id, content: comment.trim() })}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {addCommentMutation.isPending ? "Posting..." : "Post Comment"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <User className="w-4 h-4" />
                <span>Sign in to leave a comment</span>
              </div>
              <a href={getLoginUrl()}>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Sign In</Button>
              </a>
            </div>
          )}

          {/* Comment List */}
          {article.comments.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No comments yet. Be the first to share your thoughts!</p>
            </div>
          ) : (
            <div className="space-y-5">
              {article.comments.map((c, idx) => (
                <div key={c.id}>
                  {idx > 0 && <Separator className="mb-5" />}
                  <div className="flex gap-3">
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      <AvatarFallback className="bg-gray-200 text-gray-600 text-xs font-bold">
                        U{c.userId}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-800">User #{c.userId}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(c.createdAt).toLocaleDateString("en-US", {
                            month: "short", day: "numeric", year: "numeric"
                          })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Back Button */}
        <Link href="/articles">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Articles
          </Button>
        </Link>
      </div>
    </div>
  );
}
