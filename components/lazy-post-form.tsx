"use client";
import dynamic from "next/dynamic";

export const PostForm = dynamic(
  () => import("./post-form").then((module) => module.PostForm),
  {
    loading: () => (
      <div className="loading-page" role="status">
        작성 화면을 불러오는 중…
      </div>
    ),
  },
);
