import { member } from "@/lib/auth";
import { failure, json } from "@/lib/http";
import { searchKeywords } from "@/lib/domain";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const started = performance.now();
    const { client, user } = await member();
    const authenticated = performance.now();
    const params = new URL(request.url).searchParams;
    let query = client
      .from("posts")
      .select("*, author:profiles!author_id(id,display_name)")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (params.get("mine") === "true") query = query.eq("author_id", user.id);
    if (params.get("completed") === "true")
      query = query.eq("status", "completed");
    if (params.get("completed") === "false")
      query = query.neq("status", "completed");
    const id = params.get("id");
    if (id) {
      z.uuid().parse(id);
      query = query.eq("id", id);
    }
    const before = params.get("before"),
      beforeId = params.get("beforeId");
    if (before && beforeId) {
      z.iso.datetime({ offset: true }).parse(before);
      z.uuid().parse(beforeId);
      query = query.or(
        `created_at.lt.${before},and(created_at.eq.${before},id.lt.${beforeId})`,
      );
    }
    const type = params.get("type");
    if (type === "market") query = query.in("kind", ["giveaway"]);
    if (type === "lost") query = query.in("kind", ["lost", "found"]);
    for (const word of searchKeywords(params.get("q")))
      query = query.or(
        ["title", "body", "wanted", "custody"]
          .map((column) => `${column}.ilike.%${word}%`)
          .join(","),
      );
    const category = params.get("category");
    if (category) query = query.eq("category", category);
    const kind = params.get("kind");
    if (kind) query = query.eq("kind", kind);
    const place = params.get("place");
    if (place) query = query.eq("place", place);
    if (params.get("available") === "true")
      query = query.neq("status", "completed");
    const { data, error } = await query.limit(41);
    if (error) throw new Error("게시글을 불러오지 못했어요.");
    const page = data.slice(0, 40);
    const response = json({
      posts: page.map(({ author, ...post }) => {
        void author;
        return post;
      }),
      profiles: page.flatMap(({ author }) => (author ? [author] : [])),
      hasMore: data.length > 40,
    });
    response.headers.set(
      "Server-Timing",
      `auth;dur=${(authenticated - started).toFixed(1)}, db;dur=${(performance.now() - authenticated).toFixed(1)}`,
    );
    return response;
  } catch (e) {
    return failure(e);
  }
}
