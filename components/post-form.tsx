"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, X, ArrowLeft, ArrowRight } from "lucide-react";
import {
  categories,
  places,
  type Kind,
  type Post,
  postSchema,
  isMarket,
} from "@/lib/domain";
import { useApp } from "./provider";
import { PageHeading, ErrorNotice, Spinner } from "./ui";
export function PostForm({
  post,
  lost = false,
}: {
  post?: Post;
  lost?: boolean;
}) {
  const { base, mutate, upload, image } = useApp(),
    router = useRouter(),
    fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>(
      post?.kind ?? (lost ? "lost" : "giveaway"),
    ),
    [photos, setPhotos] = useState(post?.image_ids ?? []),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [uploading, setUploading] = useState(false);
  async function files(files: FileList | null) {
    if (!files) return;
    if (files.length + photos.length > 5) {
      setError("사진은 최대 5장까지 올릴 수 있어요.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const id = await upload(file);
        setPhotos((old) => [...old, id]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    const form = new FormData(event.currentTarget);
    const raw = {
      ...(post ? { id: post.id } : {}),
      kind,
      title: form.get("title"),
      body: form.get("body"),
      price: 0,
      category: form.get("category") ?? "기타",
      place: form.get("place"),
      occurred_on: isMarket(kind) ? null : form.get("occurred_on"),
      custody: form.get("custody") ?? "",
      wanted: "",
      image_ids: photos,
    };
    const parsed = postSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await mutate<Post>("post.save", parsed.data);
      router.push(`${base}/posts/${saved.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const market = isMarket(kind);
  return (
    <section className="form-page">
      <PageHeading
        title={post ? "게시글 수정" : lost ? "분실물 글쓰기" : "나눔 글쓰기"}
        back={post ? `${base}/posts/${post.id}` : lost ? `${base}/lost` : base}
      />
      <form onSubmit={submit} className="post-form">
        <fieldset disabled={busy}>
          <legend className="sr-only">게시글 정보</legend>
          <div className="field">
            <label>
              사진{" "}
              <span className="field-hint">
                {market ? "1~5장" : "선택, 최대 5장"}
              </span>
            </label>
            <div className="upload-list">
              <button
                type="button"
                className="upload-button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || photos.length >= 5}
              >
                <Camera size={24} />
                <span>{uploading ? "올리는 중…" : `${photos.length} / 5`}</span>
              </button>
              {photos.map((id, i) => (
                <div className="upload-preview" key={id}>
                  <img src={image(id)} alt={`업로드 사진 ${i + 1}`} />
                  {i === 0 && <span className="cover-label">대표</span>}
                  <button
                    type="button"
                    className="remove-photo"
                    onClick={() =>
                      setPhotos((old) => old.filter((x) => x !== id))
                    }
                    aria-label={`사진 ${i + 1} 삭제`}
                  >
                    <X size={14} />
                  </button>
                  <div className="photo-order">
                    {i > 0 && (
                      <button
                        type="button"
                        aria-label={`사진 ${i + 1} 앞으로`}
                        onClick={() =>
                          setPhotos((old) => {
                            const a = [...old];
                            [a[i - 1], a[i]] = [a[i], a[i - 1]];
                            return a;
                          })
                        }
                      >
                        <ArrowLeft size={13} />
                      </button>
                    )}
                    {i < photos.length - 1 && (
                      <button
                        type="button"
                        aria-label={`사진 ${i + 1} 뒤로`}
                        onClick={() =>
                          setPhotos((old) => {
                            const a = [...old];
                            [a[i], a[i + 1]] = [a[i + 1], a[i]];
                            return a;
                          })
                        }
                      >
                        <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              multiple
              hidden
              onChange={(e) => void files(e.target.files)}
            />
            <p className="field-help">
              개인정보가 보이지 않는 사진을 올려 주세요. 파일당 최대 10MB.
            </p>
          </div>
          <div className="field">
            <label>글 유형</label>
            <div className="segmented">
              {(lost || !market
                ? [
                    { value: "lost", label: "잃어버렸어요" },
                    { value: "found", label: "주웠어요" },
                  ]
                : [{ value: "giveaway", label: "나눔" }]
              ).map((item) => (
                <button
                  type="button"
                  key={item.value}
                  className={kind === item.value ? "selected" : ""}
                  aria-pressed={kind === item.value}
                  disabled={!!post && kind !== item.value}
                  onClick={() => setKind(item.value as Kind)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {post && (
              <p className="field-help">
                등록 후에는 글 유형을 바꿀 수 없어요.
              </p>
            )}
          </div>
          <div className="field">
            <label htmlFor="title">제목</label>
            <input
              id="title"
              name="title"
              maxLength={60}
              required
              defaultValue={post?.title}
              placeholder={
                market ? "어떤 물건인가요?" : "어떤 물건을 찾거나 주우셨나요?"
              }
            />
          </div>
          {market && (
            <div className="field">
              <label htmlFor="category">카테고리</label>
              <select
                id="category"
                name="category"
                defaultValue={post?.category ?? categories[0]}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="body">설명</label>
            <textarea
              id="body"
              name="body"
              rows={6}
              required
              minLength={5}
              maxLength={3000}
              defaultValue={post?.body}
              placeholder={
                market
                  ? "사용 상태, 하자, 구성품 등을 알려 주세요."
                  : "물건의 특징과 발견에 도움이 되는 정보를 알려 주세요."
              }
            />
          </div>
          {market ? (
            <div className="field">
              <label htmlFor="place">희망 장소</label>
              <input
                id="place"
                name="place"
                maxLength={60}
                required
                defaultValue={post?.place ?? ""}
                placeholder="희망하는 나눔 장소를 입력해 주세요 (예: 도서관 앞, 기숙사 로비)"
              />
            </div>
          ) : (
            <div className="form-columns">
              <div className="field">
                <label htmlFor="place">분실·발견 장소</label>
                <select
                  id="place"
                  name="place"
                  defaultValue={post?.place ?? places[0]}
                >
                  {places.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="occurred">분실·발견 날짜</label>
                <input
                  id="occurred"
                  name="occurred_on"
                  type="date"
                  required
                  defaultValue={post?.occurred_on ?? ""}
                  max={new Date().toLocaleDateString("en-CA", {
                    timeZone: "Asia/Seoul",
                  })}
                />
              </div>
            </div>
          )}
          {kind === "found" && (
            <div className="field">
              <label htmlFor="custody">보관 방법</label>
              <input
                id="custody"
                name="custody"
                required
                maxLength={100}
                defaultValue={post?.custody || "직접 보관 중"}
                placeholder="직접 보관 중 또는 맡긴 장소"
              />
            </div>
          )}
          <ErrorNotice message={error} />
          <button
            className="button primary full"
            type="submit"
            disabled={busy || uploading}
          >
            {busy ? (
              <>
                <Spinner />
                저장하는 중
              </>
            ) : post ? (
              "수정 완료"
            ) : (
              "등록하기"
            )}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
