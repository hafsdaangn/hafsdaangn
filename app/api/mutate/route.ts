import { member } from "@/lib/auth";
import { failure, json, sameOrigin } from "@/lib/http";
import { messageSchema, postSchema } from "@/lib/domain";
import { z } from "zod";
import { after } from "next/server";
import { notifyChat } from "@/lib/push";
import type { Message } from "@/lib/domain";
const schemas = {
  "post.save": postSchema,
  "post.status": z.object({
    id: z.uuid(),
    status: z.enum(["active", "reserved", "completed"]),
    updated_at: z.iso.datetime({ offset: true }),
  }),
  "post.delete": z.object({ id: z.uuid() }),
  "conversation.create": z.object({ post_id: z.uuid() }),
  "message.send": messageSchema,
  "message.read": z.object({
    conversation_id: z.uuid(),
    seq: z.number().int().nonnegative(),
  }),
};
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client } = await member();
    const { op, payload } = await request.json();
    if (typeof op !== "string" || !Object.hasOwn(schemas, op))
      throw new Error("허용되지 않은 작업입니다.");
    const parsed = schemas[op as keyof typeof schemas].safeParse(payload);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const { data, error } = await client.rpc("mutate", {
      op,
      payload: parsed.data,
    });
    if (error) {
      console.error("Mutation failed", {
        op,
        code: error.code,
        message: error.message,
      });
      throw new Error(
        error.code === "P0001"
          ? error.message
          : "요청한 내용을 저장하지 못했어요. 입력을 확인하고 다시 시도해 주세요.",
      );
    }
    if (op === "message.send")
      after(async () => {
        try {
          await notifyChat(data as Message);
        } catch {
          console.error("Chat push processing failed");
        }
      });
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
