import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { member } from "@/lib/auth";
import { storageAdmin } from "@/lib/supabase/server";
import { failure, json, sameOrigin } from "@/lib/http";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client, user } = await member();
    const size = Number(request.headers.get("content-length"));
    if (size > 11 * 1024 * 1024)
      throw new Error("사진은 10MB 이하로 올려 주세요.");
    const form = await request.formData(),
      file = form.get("file"),
      room = form.get("conversation_id");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024)
      throw new Error("10MB 이하의 사진을 선택해 주세요.");
    const conversation_id = room ? z.uuid().parse(room) : null;
    const { error: rateError } = await client.rpc("mutate", {
      op: "upload.consume",
      payload: { conversation_id },
    });
    if (rateError) throw new Error(rateError.message);
    let bytes: Buffer;
    try {
      bytes = await sharp(Buffer.from(await file.arrayBuffer()), {
        limitInputPixels: 40_000_000,
      })
        .rotate()
        .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new Error(
        "이 사진을 읽을 수 없어요. JPG, PNG 또는 WebP로 다시 올려 주세요.",
      );
    }
    const admin = storageAdmin(),
      id = randomUUID(),
      path = `${user.id}/${id}.webp`;
    const { error } = await admin.storage
      .from("images")
      .upload(path, bytes, { contentType: "image/webp", upsert: false });
    if (error) throw new Error("사진을 저장하지 못했어요.");
    const { error: recordError } = await admin
      .from("media")
      .insert({ id, owner_id: user.id, path, conversation_id });
    if (recordError) {
      await admin.storage.from("images").remove([path]);
      throw new Error("사진 정보를 저장하지 못했어요.");
    }
    return json({ id });
  } catch (e) {
    return failure(e);
  }
}
