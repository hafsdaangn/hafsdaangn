import { member } from "@/lib/auth";
import { failure, json, sameOrigin } from "@/lib/http";
import { messageSchema, postSchema } from "@/lib/domain";
import { z } from "zod";
import { after } from "next/server";
import { notifyChat, notifyPost } from "@/lib/push";
import type { Message, Post } from "@/lib/domain";
import { captureServerEvent } from "@/lib/posthog-server";
import { emitPostHogLog, flushPostHogLogs } from "@/instrumentation";
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

async function captureMutation(
  request: Request,
  distinctId: string,
  op: keyof typeof schemas,
  data: unknown,
  isNewPost: boolean,
) {
  if (op === "post.save") {
    const post = data as Post;
    await captureServerEvent({
      request,
      distinctId,
      event: isNewPost ? "post_created" : "post_updated",
      properties: {
        post_kind: post.kind,
        post_category: post.category,
        image_count: post.image_ids.length,
      },
    });
  } else if (op === "post.status") {
    await captureServerEvent({
      request,
      distinctId,
      event: "post_status_updated",
      properties: { status: (data as Post).status },
    });
  } else if (op === "post.delete") {
    await captureServerEvent({ request, distinctId, event: "post_deleted" });
  } else if (op === "conversation.create") {
    await captureServerEvent({
      request,
      distinctId,
      event: "conversation_started",
    });
  } else if (op === "message.send") {
    const message = data as Message;
    await captureServerEvent({
      request,
      distinctId,
      event: "message_sent",
      properties: { has_attachment: Boolean(message.image_id) },
    });
  }
}

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { client, user } = await member();
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
    await captureMutation(
      request,
      user.id,
      op as keyof typeof schemas,
      data,
      op === "post.save" && !("id" in parsed.data),
    );
    emitPostHogLog("Mutation completed", { operation: op });
    after(flushPostHogLogs);
    if (op === "message.send")
      after(async () => {
        try {
          await notifyChat(data as Message);
        } catch {
          console.error("Chat push processing failed");
        }
      });
    if (op === "post.save" && !("id" in parsed.data))
      after(async () => {
        try {
          await notifyPost(data as Post);
        } catch {
          console.error("Post push processing failed");
        }
      });
    return json(data);
  } catch (e) {
    return failure(e);
  }
}
