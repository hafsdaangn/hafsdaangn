import Link from "next/link";
export default function NotFound() {
  return (
    <div className="loading-page">
      <h1>페이지를 찾을 수 없어요</h1>
      <Link href="/" className="button primary">
        처음으로
      </Link>
    </div>
  );
}
