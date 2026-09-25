import { member } from "@/lib/auth";
import { failure } from "@/lib/http";
import { z } from "zod";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { client } = await member();
    const { id } = await params;
    z.uuid().parse(id);
    const { data: media, error } = await client
      .from("media")
      .select("path")
      .eq("id", id)
      .single();
    if (error || !media) throw new Error("사진을 찾을 수 없어요.");
    const { data, error: downloadError } = await client.storage
      .from("images")
      .download(media.path);
    if (downloadError || !data) throw new Error("사진을 불러오지 못했어요.");
    return new Response(data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (e) {
    return failure(e, 404);
  }
}
