import type { Metadata } from "next";
import { MAX_FILES, MAX_FILE_MB, pinRequired } from "@/lib/quick-share";
import UploadBox from "./UploadBox";
import { requireUser } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gửi file nhanh",
  description: "Tải file lên, nhận link rút gọn để tải về. File tự xoá sau 30 phút.",
  robots: { index: false, follow: false },
};

/** vieetjk.com/up — tải 1 hoặc nhiều file lên, nhận một link rút gọn. */
export default async function UploadPage() {
  // Chỉ người đã đăng nhập mới gửi được (route /api/quick-share cũng chặn).
  const user = await requireUser();
  return (
    <main className="min-h-dvh bg-neutral-950 text-neutral-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-semibold text-center">Gửi file nhanh</h1>
        <p className="mt-1 mb-6 text-center text-sm text-neutral-400">
          Tối đa {MAX_FILES} file, mỗi file {MAX_FILE_MB}MB · Link tự hết hạn sau 30 phút
        </p>
        {user ? (
          <UploadBox needPin={pinRequired()} maxFiles={MAX_FILES} maxMb={MAX_FILE_MB} />
        ) : (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-center">
            <p className="text-sm text-neutral-300">Đăng nhập tài khoản mstudo để gửi file.</p>
            <a
              href="/login?next=%2Fup"
              className="mt-4 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900"
            >
              Đăng nhập
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
