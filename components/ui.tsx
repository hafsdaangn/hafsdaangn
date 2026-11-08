"use client";
import Link from "./app-link";
import Image from "next/image";
import {
  ArrowLeft,
  PackageOpen,
  UserRound,
  LoaderCircle,
  Search,
  Plus,
  Tag,
} from "lucide-react";
import { type ReactNode } from "react";
import {
  type Post,
  priceLabel,
  relativeTime,
  statusLabel,
  isMarket,
} from "@/lib/domain";
import { useApp } from "./provider";
export function Brand({ full = false }: { full?: boolean }) {
  return (
    <span className={`brand${full ? " brand-full" : ""}`}>
      <Image
        src={`/brand/${full ? "logo" : "symbol"}.svg`}
        alt="합스당근"
        width={full ? 1042 : 562}
        height={607}
        priority
        className="brand-logo"
      />
    </span>
  );
}
export function Avatar({
  name = "",
  large = false,
}: {
  name?: string;
  large?: boolean;
}) {
  const initial = name.match(/\p{L}/u)?.[0];
  return (
    <span className={`avatar ${large ? "large" : ""}`} aria-hidden="true">
      {initial ?? <UserRound size={20} />}
    </span>
  );
}
export function Spinner() {
  return <LoaderCircle className="spin" size={19} aria-label="처리 중" />;
}
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <PackageOpen size={40} strokeWidth={1.3} />
      <h2>{title}</h2>
      {body && <p>{body}</p>}
      {action}
    </div>
  );
}
export function PageHeading({
  title,
  back,
  action,
}: {
  title: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      {back ? (
        <Link href={back} className="icon-button" aria-label="뒤로 가기">
          <ArrowLeft />
        </Link>
      ) : null}
      <h1>{title}</h1>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <p className="error-notice" role="alert">
      {message}
    </p>
  ) : null;
}
export function StatusBadge({ post }: { post: Pick<Post, "kind" | "status"> }) {
  return (
    <span
      className={`badge ${post.status === "completed" ? "muted" : post.kind === "giveaway" ? "green" : ""}`}
    >
      {statusLabel(post)}
    </span>
  );
}
export function PostPhoto({ post, index = 0 }: { post: Post; index?: number }) {
  const { image } = useApp();
  const src = post.image_ids[index] ? image(post.image_ids[index]) : "";
  return src ? (
    <img src={src} alt={post.title} loading="lazy" />
  ) : (
    <span
      className="post-photo-placeholder"
      role="img"
      aria-label="등록된 사진 없음"
    >
      <Tag aria-hidden="true" />
    </span>
  );
}
export function PostCard({ post }: { post: Post }) {
  const { base } = useApp();
  return (
    <Link
      className={`post-card ${post.status === "completed" ? "completed" : ""}`}
      href={`${base}/posts/${post.id}`}
    >
      <div className="post-thumb">
        <PostPhoto post={post} />
      </div>
      <div className="post-copy">
        <h2>
          {post.status !== "active" && <StatusBadge post={post} />}
          <span>{post.title}</span>
        </h2>
        {!isMarket(post.kind) && (
          <span
            className={`kind-tag ${post.kind === "found" ? "blue" : "orange"}`}
          >
            {priceLabel(post)}
          </span>
        )}
        <p className={!isMarket(post.kind) ? "post-location" : undefined}>
          {isMarket(post.kind) ? post.category : post.place || null}
          {(isMarket(post.kind) || post.place) && <span>·</span>}
          {relativeTime(post.created_at)}
        </p>
        {post.kind === "barter" ? (
          <small>받고 싶은 물건 · {post.wanted}</small>
        ) : post.kind === "sale" ? (
          <strong>{priceLabel(post)}</strong>
        ) : post.kind === "lost" && post.status === "active" ? (
          <small>찾는 중</small>
        ) : null}
      </div>
    </Link>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-input">
      <Search size={20} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}
export function WriteButton({ lost = false }: { lost?: boolean }) {
  const { base } = useApp();
  return (
    <Link
      className="write-button"
      href={`${base}/new${lost ? "?type=lost" : ""}`}
    >
      <Plus size={20} />
      글쓰기
    </Link>
  );
}
