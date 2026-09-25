import { member } from "@/lib/auth";
import { failure, json } from "@/lib/http";
import { z } from "zod";
export async function GET(request: Request) {
  try {
    const { client } = await member();
    const p = new URL(request.url).searchParams;
    const id = z.uuid().parse(p.get("conversation"));
    let query = client
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("seq", { ascending: false });
    const before = p.get("before");
    if (before)
      query = query.lt("seq", z.coerce.number().int().positive().parse(before));
    const { data, error } = await query.limit(51);
    if (error) throw new Error("대화를 불러오지 못했어요.");
    return json({
      messages: data.slice(0, 50).reverse(),
      hasMore: data.length > 50,
    });
  } catch (e) {
    return failure(e);
  }
}
