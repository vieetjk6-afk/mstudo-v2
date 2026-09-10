import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPhotos } from "@/lib/photos";
import { fetchThumbChiTiet, loadNets, modelDir, scanJpeg, wasmDir } from "@/lib/face-node";
import { pendingRows, type ScanRow } from "@/lib/face-scan-server";
import { chuAlbumDuocTimMat } from "@/lib/face-pending";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * THỬ QUÉT VÀI ẢNH RỒI BÁO CÁO SỐ ĐO — luôn trả lời trong vài giây.
 *
 * Vì sao cần route riêng thay vì dùng /face-scan?chay=1: cái đó quét cả album
 * với hạn 240 giây, và khi máy chủ cắt hàm ở 60 giây thì trình duyệt chỉ quay
 * mãi rồi trắng — không có câu lỗi, không có số nào. Một công cụ chẩn đoán mà
 * treo thì vô dụng đúng lúc cần nhất.
 *
 * Route này có hạn RẤT NGẮN và trần vài ảnh, nên nó luôn kịp trả về. Nó trả lời
 * đúng bốn câu mà chỉ máy chủ thật mới biết:
 *
 *   1. Trọng số và file .wasm có ĐI THEO gói triển khai không (thiếu khai báo
 *      outputFileTracingIncludes thì build vẫn xanh mà chạy thật là "not found").
 *   2. Nạp mô hình mất bao lâu trên CPU của Vercel.
 *   3. Một ảnh mất bao lâu — con số quyết định cron chia mẻ ra sao.
 *   4. Bộ dò có TÌM RA MẶT trên ảnh cưới THẬT không. Đây là số duy nhất không
 *      kiểm được ở máy phát triển: hộp cát không tải được ảnh người thật về, mà
 *      mặt vẽ bằng canvas thì không đại diện cho phân bố mô hình được huấn luyện.
 *
 * KHÔNG ghi gì xuống DB: đây là phép đo, không phải lượt quét.
 */

/** Trần ảnh mỗi lượt thử. Giữ nhỏ để luôn còn thời gian trả lời. */
const MAC_DINH = 3;
const TOI_DA = 10;
/** Dừng trước hạn hàm đủ xa để còn kịp dựng JSON. */
const HAN_MS = 25_000;

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: own } = await supabase.from("albums").select("id, owner_id").eq("id", params.id).maybeSingle();
  if (!own) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const so = Math.min(TOI_DA, Math.max(1, Number(url.searchParams.get("so") ?? MAC_DINH) || MAC_DINH));
  const t0 = Date.now();
  const db = createAdminClient();

  const out: Record<string, unknown> = {
    // Hỏi trước khi nạp: thiếu file thì nói thẳng thiếu, đừng để lỗi nạp mô hình
    // che mất nguyên nhân thật.
    coTrongSo: !!modelDir(),
    coFileWasm: !!wasmDir(),
    /*
     * Cổng gói được BÁO CÁO ở đây, không phải chặn ở đây — có chủ ý.
     *
     * Route này không ghi gì và không quét cả album: nó đo xem trọng số có đi
     * theo gói triển khai, một ảnh mất bao lâu, bộ dò có tìm ra mặt trên ảnh
     * thật. Ba câu đó nói về BẢN TRIỂN KHAI, không nói về gói của studio. Chặn
     * theo gói ở đây chỉ đạt một việc: lấy đi đúng công cụ trả lời "tại sao
     * không thấy gì", ngay lúc cần nó nhất, mà không giữ lại đồng nào — vì
     * không dòng khuôn mặt nào được ghi và không chip nào hiện ra.
     *
     * Nói thẳng ra thì hơn: có gói không, và nếu không thì cron sẽ bỏ qua album
     * này dù mọi số đo bên dưới đều đẹp.
     */
    goiChoTimMat: await chuAlbumDuocTimMat(db, own.owner_id),
  };
  if (!out.coTrongSo || !out.coFileWasm) {
    out.loi = "thieu_file_mo_hinh_tren_may_chu";
    out.viecPhaiLam =
      "Trọng số hoặc file .wasm không đi theo gói triển khai — kiểm outputFileTracingIncludes trong next.config.mjs.";
    return NextResponse.json(out);
  }

  const rows = (await fetchAllPhotos(db, params.id, "id, drive_file_id, name, is_video, faces_scanned_at")) as ScanRow[];
  const todo = pendingRows(rows).slice(0, so);
  out.tongAnh = rows.length;
  out.conChuaQuet = pendingRows(rows).length;
  if (todo.length === 0) {
    out.ghiChu = "Không còn ảnh nào chưa quét trong album này.";
    return NextResponse.json(out);
  }

  const tNap = Date.now();
  try {
    await loadNets();
  } catch (e) {
    out.napMoHinhMs = Date.now() - tNap;
    out.loi = "khong_nap_duoc_mo_hinh";
    out.chiTiet = e instanceof Error ? e.message : String(e);
    return NextResponse.json(out);
  }
  out.napMoHinhMs = Date.now() - tNap;

  const anh: unknown[] = [];
  for (const p of todo) {
    if (Date.now() - t0 > HAN_MS) break;
    const t = Date.now();
    try {
      const { bytes, lyDo } = await fetchThumbChiTiet(p.drive_file_id);
      const tTai = Date.now() - t;
      if (!bytes) {
        // `lyDo` là câu Google trả về (http-403, khong-phai-anh, anh-giu-cho…).
        // Không có nó thì màn chẩn đoán chỉ nói "không tải được" — đúng nhưng
        // vô dụng, vì năm nguyên nhân cần năm cách sửa khác nhau.
        anh.push({ ten: p.name, loi: "khong_tai_duoc_anh_tu_drive", lyDo, taiMs: tTai });
        continue;
      }
      const tQuet = Date.now();
      const faces = await scanJpeg(bytes);
      anh.push({
        ten: p.name,
        kb: Math.round(bytes.length / 1024),
        taiMs: tTai,
        quetMs: Date.now() - tQuet,
        soMat: faces.length,
        // Kích thước khung mặt lớn nhất, để biết nó bắt được mặt to hay chỉ nhiễu.
        matToNhat: faces.length
          ? Number(Math.max(...faces.map((f) => f.box.w * f.box.h)).toFixed(4))
          : 0,
      });
    } catch (e) {
      anh.push({ ten: p.name, loi: e instanceof Error ? e.message : String(e), ms: Date.now() - t });
    }
  }

  const daQuet = anh.filter((a) => typeof (a as { soMat?: number }).soMat === "number") as { soMat: number; quetMs: number }[];
  out.anh = anh;
  out.tongMatTimDuoc = daQuet.reduce((n, a) => n + a.soMat, 0);
  out.quetMsTrungBinh = daQuet.length ? Math.round(daQuet.reduce((n, a) => n + a.quetMs, 0) / daQuet.length) : null;
  out.tongMs = Date.now() - t0;
  out.ketLuan =
    daQuet.length === 0
      ? "KHÔNG quét được ảnh nào — xem trường `loi` của từng ảnh."
      : (out.tongMatTimDuoc as number) > 0
        ? "Bộ nhận diện CHẠY ĐƯỢC và tìm ra mặt trên ảnh thật."
        : "Chạy được nhưng KHÔNG thấy mặt nào trong mấy ảnh này — thử ?so=10, hoặc mấy tấm đầu album là ảnh phong cảnh.";
  return NextResponse.json(out);
}
