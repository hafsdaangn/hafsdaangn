import { member } from "@/lib/auth";
import { failure } from "@/lib/http";
import { z } from "zod";
import { mediaBytes } from "@/lib/media-cache";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { client } = await member();
    const { id } = await params;
    z.uuid().parse(id);
    const size = new URL(request.url).searchParams.get("w");
    const width = size ? Number(z.enum(["320", "640"]).parse(size)) : 0;
    const { data: media, error } = await client
      .from("media")
      .select("path")
      .eq("id", id)
      .single();
    if (error || !media) throw new Error("사진을 찾을 수 없어요.");
    const bytes = await mediaBytes(media.path, width, async () => {
      const { data, error } = await client.storage
        .from("images")
        .download(media.path);
      if (error || !data) throw new Error("사진을 불러오지 못했어요.");
      return Buffer.from(await data.arrayBuffer());
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": width ? "private, max-age=60" : "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (e) {
    return failure(e, 404);
  }
}
