"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "vi" | "en";

type Dict = Record<string, { vi: string; en: string }>;

export const dict: Dict = {
  brand: { vi: "mstudo", en: "mstudo" },
  tagline: {
    vi: "Bộ sưu tập ảnh dành cho khách hàng",
    en: "Photo collection for customers",
  },
  // nav / auth
  login: { vi: "Đăng nhập", en: "Sign in" },
  logout: { vi: "Đăng xuất", en: "Sign out" },
  dashboard: { vi: "Bảng điều khiển", en: "Dashboard" },
  email: { vi: "Email", en: "Email" },
  password: { vi: "Mật khẩu", en: "Password" },
  fullName: { vi: "Họ và tên", en: "Full name" },
  signingIn: { vi: "Đang đăng nhập…", en: "Signing in…" },
  loginSubtitle: {
    vi: "Khu vực dành cho nhiếp ảnh gia & quản trị viên",
    en: "For photographers & administrators",
  },
  // dashboard
  myAlbums: { vi: "Album của tôi", en: "My albums" },
  newAlbum: { vi: "Tạo album", en: "New album" },
  admin: { vi: "Quản trị", en: "Admin" },
  noAlbums: { vi: "Chưa có album nào.", en: "No albums yet." },
  photos: { vi: "ảnh", en: "photos" },
  selections: { vi: "lượt chọn", en: "selections" },
  edit: { vi: "Sửa", en: "Edit" },
  view: { vi: "Xem", en: "View" },
  open: { vi: "Mở", en: "Open" },
  draft: { vi: "Nháp", en: "Draft" },
  published: { vi: "Đã xuất bản", en: "Published" },
  status: { vi: "Trạng thái", en: "Status" },
  showcaseOnHome: { vi: "Hiển thị ngoài trang chủ (album tham khảo)", en: "Show on homepage (reference album)" },
  showcaseHint: {
    vi: "Album sẽ hiện ở mục “Album tham khảo” trên trang chủ — chỉ để xem, không cho chọn ảnh.",
    en: "Appears under “Reference albums” on the homepage — view-only, no selection.",
  },
  pinnedFeatured: { vi: "Ghim nổi bật (ưu tiên hiển thị)", en: "Pin as featured" },
  albumKind: { vi: "Thể loại", en: "Category" },
  // album editor
  albumTitle: { vi: "Tên album", en: "Album title" },
  description: { vi: "Mô tả", en: "Description" },
  slug: { vi: "Đường dẫn (slug)", en: "URL slug" },
  cover: { vi: "Ảnh bìa", en: "Cover image" },
  setCover: { vi: "Đặt làm bìa", en: "Set as cover" },
  albumPassword: { vi: "Mật khẩu album", en: "Album password" },
  passwordHint: {
    vi: "Để trống nếu không cần mật khẩu. Nhập để đặt/đổi.",
    en: "Leave empty for no password. Type to set/change.",
  },
  selectionLimit: { vi: "Giới hạn số ảnh chọn", en: "Selection limit" },
  unlimited: { vi: "Không giới hạn", en: "Unlimited" },
  watermark: { vi: "Watermark", en: "Watermark" },
  watermarkText: { vi: "Chữ watermark", en: "Watermark text" },
  enableWatermark: { vi: "Bật watermark", en: "Enable watermark" },
  sources: { vi: "Nguồn ảnh (Google Drive)", en: "Image sources (Google Drive)" },
  sourceName: { vi: "Tên nhóm", en: "Group name" },
  driveLink: { vi: "Link Drive (file hoặc folder)", en: "Drive link (file or folder)" },
  addSource: { vi: "Thêm nguồn", en: "Add source" },
  syncDrive: { vi: "Đồng bộ ảnh từ Drive", en: "Sync photos from Drive" },
  syncing: { vi: "Đang đồng bộ…", en: "Syncing…" },
  save: { vi: "Lưu", en: "Save" },
  saving: { vi: "Đang lưu…", en: "Saving…" },
  saved: { vi: "Đã lưu", en: "Saved" },
  delete: { vi: "Xóa", en: "Delete" },
  remove: { vi: "Gỡ", en: "Remove" },
  settings: { vi: "Cài đặt", en: "Settings" },
  back: { vi: "Quay lại", en: "Back" },
  // customer view
  enterPassword: { vi: "Nhập mật khẩu để xem album", en: "Enter password to view this album" },
  wrongPassword: { vi: "Mật khẩu không đúng", en: "Wrong password" },
  enter: { vi: "Vào xem", en: "Enter" },
  selectPhotos: { vi: "Chọn ảnh", en: "Select photos" },
  selected: { vi: "đã chọn", en: "selected" },
  selectThis: { vi: "Chọn", en: "Select" },
  deselect: { vi: "Bỏ chọn", en: "Deselect" },
  limitReached: {
    vi: "Đã đạt giới hạn số ảnh được chọn.",
    en: "You have reached the selection limit.",
  },
  yourSelection: { vi: "Ảnh bạn đã chọn", en: "Your selection" },
  exportList: { vi: "Xuất danh sách", en: "Export list" },
  copyList: { vi: "Copy danh sách", en: "Copy list" },
  copied: { vi: "Đã copy!", en: "Copied!" },
  downloadPhoto: { vi: "Tải ảnh", en: "Download photo" },
  driveFolder: { vi: "Tải ảnh từ Drive", en: "Download from Drive" },
  driveFolderPick: { vi: "Tải ảnh từ Drive", en: "Download from Drive" },
  // Gợi ý cho khách dùng điện thoại: nhấn giữ ảnh là Safari/Chrome lưu thẳng
  // vào thư viện Ảnh của máy — không tốn thêm băng thông, vì ảnh đã tải sẵn.
  saveToPhotosHint: {
    vi: "Nhấn giữ ảnh → “Thêm vào Ảnh” để lưu về máy",
    en: "Press and hold the photo → “Add to Photos” to save it",
  },
  preparingZip: { vi: "Đang nén ảnh…", en: "Preparing ZIP…" },
  yourName: { vi: "Tên của bạn (tuỳ chọn)", en: "Your name (optional)" },
  submitSelection: { vi: "Gửi lựa chọn cho photographer", en: "Send selection to photographer" },
  submitted: { vi: "Đã gửi lựa chọn của bạn!", en: "Your selection has been sent!" },
  allPhotos: { vi: "Tất cả", en: "All" },
  viewingSelected: { vi: "Đang xem ảnh đã chọn", en: "Viewing selected photos" },
  selectedCount: { vi: "Ảnh đã chọn", en: "Selected photos" },
  noneSelected: { vi: "Chưa chọn ảnh nào", en: "No photos selected" },
  saveErr: { vi: "Chưa lưu được lựa chọn", en: "Could not save selection" },
  savedForStudio: { vi: "Đã lưu cho studio", en: "Saved for studio" },
  noSelectedPhotos: { vi: "Chưa có ảnh nào được chọn", en: "No photos selected yet" },
  heartHint: { vi: "Nhấn vào trái tim ở góc mỗi ảnh để chọn.", en: "Tap the heart on any photo to select it." },
  // ảnh không thích (customer)
  dislikeThis: { vi: "Không thích ảnh này", en: "I don't like this photo" },
  disliked: { vi: "Không thích", en: "Disliked" },
  dislikedCount: { vi: "Ảnh không thích", en: "Disliked photos" },
  undislike: { vi: "Bỏ khỏi mục không thích", en: "Remove from disliked" },
  undislikedBack: {
    vi: "Đã bỏ ảnh khỏi mục “Không thích”.",
    en: "Photo removed from “Disliked”.",
  },
  dislikedMoved: {
    vi: "Đã chuyển ảnh sang mục “Không thích” — studio sẽ xoá nếu bạn yêu cầu.",
    en: "Moved to “Disliked” — the studio can delete it at your request.",
  },
  noDislikedPhotos: { vi: "Chưa có ảnh nào bị đánh dấu không thích", en: "No disliked photos yet" },
  dislikeHint: {
    vi: "Nhấn dấu × ở góc trái mỗi ảnh để đánh dấu không thích — ảnh sẽ được ẩn khỏi lưới chọn.",
    en: "Tap the × on any photo to mark it as disliked — it will be hidden from the grid.",
  },
  // bỏ chọn tất cả
  cancel: { vi: "Huỷ", en: "Cancel" },
  resetPicks: { vi: "Bỏ chọn tất cả", en: "Clear all picks" },
  resetAsk: { vi: "Bỏ hết lựa chọn? Sẽ mất", en: "Clear every pick? You will lose" },
  resetAskSelected: { vi: "ảnh đã chọn", en: "selected photos" },
  resetAskDisliked: { vi: "ảnh không thích", en: "disliked photos" },
  resetConfirm: { vi: "Bỏ hết", en: "Clear all" },
  resetDone: { vi: "Đã bỏ toàn bộ lựa chọn.", en: "All picks cleared." },
  // gợi ý ảnh trùng (bộ lọc chạy ngay trên máy khách)
  dupTitle: { vi: "Ảnh na ná nhau", en: "Near-identical photos" },
  dupIntro: {
    vi: "Máy ảnh bấm liên tiếp nên nhiều tấm gần như giống hệt nhau. Bấm nút dưới đây để nhóm chúng lại và gợi ý bản nét nhất — bạn vẫn là người chọn.",
    en: "Cameras shoot in bursts, so many frames look almost identical. Group them and see the sharpest one — you still choose.",
  },
  dupRun: { vi: "Tìm ảnh na ná nhau", en: "Find near-identical photos" },
  dupRunning: { vi: "Đang xem ảnh…", en: "Looking through the photos…" },
  dupStop: { vi: "Dừng", en: "Stop" },
  dupPrivacy: {
    vi: "Ảnh được xem ngay trên máy bạn, không gửi đi đâu cả.",
    en: "Everything happens on your device — no photo is uploaded anywhere.",
  },
  dupNone: {
    vi: "Không có tấm nào na ná nhau — album này đã được chọn lọc rồi.",
    en: "No near-identical frames — this album is already curated.",
  },
  dupFound: { vi: "nhóm ảnh na ná nhau", en: "groups of near-identical photos" },
  dupBest: { vi: "Nét nhất", en: "Sharpest" },
  dupHide: { vi: "Tách khỏi lưới ảnh", en: "Keep them out of the grid" },
  dupHideOn: {
    vi: "Các bản trùng đã được tách khỏi lưới — lưới chỉ còn bản nét nhất mỗi nhóm. Ảnh bạn đã chọn thì luôn hiện.",
    en: "Duplicates are kept out of the grid — it now shows one frame per group. Photos you picked always stay visible.",
  },
  dupPickHere: {
    vi: "Đây là những tấm đã tách riêng. Máy KHÔNG chọn hộ tấm nào — bấm vào một tấm để xem lớn và lật qua cả chuỗi, thấy tấm nào ưng thì thả tim để đưa vào lựa chọn.",
    en: "These are the frames set aside. Nothing is picked for you — tap a frame to view it large and flip through the burst, then heart the ones you want.",
  },
  dupInGroup: { vi: "đã chọn", en: "picked" },
  // selections view (photographer)
  customerSelections: { vi: "Lượt chọn của khách", en: "Customer selections" },
  note: { vi: "Ghi chú", en: "Note" },
  addNote: { vi: "Thêm ghi chú", en: "Add note" },
  noSelections: { vi: "Chưa có lượt chọn nào.", en: "No selections yet." },
  session: { vi: "Phiên", en: "Session" },
  // admin
  photographers: { vi: "Nhiếp ảnh gia", en: "Photographers" },
  plan: { vi: "Gói", en: "Plan" },
  planFree: { vi: "Miễn phí", en: "Free" },
  cycleMonth: { vi: "tháng", en: "month" },
  cycleYear: { vi: "năm", en: "year" },
  gallery: { vi: "Gallery", en: "Gallery" },
  expiresShort: { vi: "HH", en: "Exp" },
  deleteAccount: { vi: "Xoá tài khoản", en: "Delete account" },
  confirmDeleteUser: {
    vi: "Xoá tài khoản {email}? Không thể hoàn tác.",
    en: "Delete account {email}? This cannot be undone.",
  },
  role: { vi: "Vai trò", en: "Role" },
  active: { vi: "Kích hoạt", en: "Active" },
  maxAlbums: { vi: "Giới hạn album", en: "Album limit" },
  monthlyLimit: { vi: "Album/tháng", en: "Albums/month" },
  canZip: { vi: "Cho tải ảnh", en: "Allow download" },
  canNotes: { vi: "Cho ghi chú", en: "Allow notes" },
  update: { vi: "Cập nhật", en: "Update" },
  createUser: { vi: "Tạo tài khoản", en: "Create account" },
  upgrade: { vi: "Nâng cấp", en: "Upgrade" },
  filterPhotos: { vi: "Lọc ảnh", en: "Filter" },
  compressPhotos: { vi: "Nén ảnh", en: "Compress" },
  galleries: { vi: "Gallery khách", en: "Galleries" },
  themeLight: { vi: "Giao diện sáng", en: "Light mode" },
  themeDark: { vi: "Giao diện tối", en: "Dark mode" },
  // misc
  loading: { vi: "Đang tải…", en: "Loading…" },
  confirmDelete: { vi: "Bạn chắc chắn muốn xóa?", en: "Are you sure you want to delete?" },
  error: { vi: "Có lỗi xảy ra", en: "Something went wrong" },
  notFound: { vi: "Không tìm thấy", en: "Not found" },
  albumNotReady: { vi: "Album chưa được xuất bản.", en: "This album is not published yet." },
};

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dict) => string;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("vi");

  useEffect(() => {
    const stored = window.localStorage.getItem("vk_lang") as Lang | null;
    if (stored === "vi" || stored === "en") setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("vk_lang", l);
  };

  const t = (key: keyof typeof dict) => dict[key]?.[lang] ?? String(key);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
