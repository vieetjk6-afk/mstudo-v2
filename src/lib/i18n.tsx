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
  driveFolder: { vi: "Tải ảnh gốc", en: "Download originals" },
  driveFolderPick: { vi: "Tải ảnh gốc", en: "Download originals" },
  originalTitle: { vi: "Cần file ảnh gốc?", en: "Need the original files?" },
  originalHint: {
    vi: "Ảnh gốc nằm trên Google Drive của studio. Mở thư mục rồi lưu cả loạt về máy — không giới hạn số lượng.",
    en: "The original files live in the studio's Google Drive. Open the folder and save them all at once.",
  },
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
  // Tìm ảnh theo khuôn mặt. Máy chủ quét album một lần (cron /api/cron/face-scan),
  // khách chỉ bấm — hoặc gửi một ảnh của mình lên và máy chủ so hộ. Máy khách
  // KHÔNG tải mô hình nào cả, kể cả ở đường tải ảnh lên.
  faceFindTitle: { vi: "Tìm ảnh có mặt bạn", en: "Find photos you're in" },
  faceClear: { vi: "Xem cả album", en: "Show all" },
  faceOnePerson: { vi: "Một người trong album", en: "Someone in this album" },
  faceUpload: { vi: "Tải ảnh của bạn lên", en: "Upload a photo of yourself" },
  faceUploadCost: {
    vi: "Ảnh bạn gửi chỉ dùng để so khuôn mặt rồi bỏ, không được lưu lại.",
    en: "The photo you send is only used to match a face, then discarded.",
  },
  faceLoading: { vi: "Đang chuẩn bị ảnh…", en: "Preparing the photo…" },
  faceSearching: { vi: "Đang tìm…", en: "Searching…" },
  faceFound: { vi: "Đã tìm thấy bạn.", en: "Found you." },
  faceUsedBiggest: {
    vi: "Ảnh có nhiều người nên lấy khuôn mặt lớn nhất.",
    en: "The photo had several faces, so the largest one was used.",
  },
  faceNoneInPhoto: {
    vi: "Không thấy khuôn mặt nào trong ảnh bạn chọn. Thử một tấm chụp rõ mặt hơn.",
    en: "No face found in that photo. Try one where the face is clearer.",
  },
  faceNoMatch: {
    vi: "Không tìm thấy bạn trong album này. Bạn vẫn có thể tự chọn một khuôn mặt ở trên.",
    en: "Couldn't find you in this album. You can still pick a face above.",
  },
  faceNoSupport: {
    vi: "Trình duyệt này không đọc được ảnh bạn chọn. Bạn vẫn chọn được khuôn mặt ở trên.",
    en: "This browser couldn't read that photo. You can still pick a face above.",
  },
  // Album vừa tạo: máy chủ đang quét, khuôn mặt chưa có. Nói ra chứ đừng để
  // trống — trống thì khách (và studio) tưởng tính năng không tồn tại.
  //
  // {n}/{m} KHÔNG phải trang trí. Câu cũ là "vài phút nữa bạn quay lại nhé", và
  // với album 400–1.000 ảnh thì đó là NÓI SAI: bộ quét chạy được khoảng 300 ảnh
  // mỗi lượt cron, tức hàng giờ. Khách quay lại sau năm phút, đọc lại đúng câu
  // hẹn cũ, và kết luận tính năng hỏng — trong khi nó đang chạy đúng. Một con số
  // nhìn thấy nhích lên nói thật được điều mà một lời hẹn không giữ nổi.
  facePreparing: {
    vi: "Đang tìm khuôn mặt trong album: đã quét {n}/{m} ảnh. Ảnh được quét dần vào ban đêm — mai quay lại là tìm được nhiều hơn.",
    en: "Finding faces in this album: {n}/{m} photos scanned. Photos are scanned overnight — check back tomorrow for more.",
  },
  faceFailed: { vi: "Không tìm được, thử lại giúp tôi.", en: "Search failed, please try again." },
  personHint: {
    vi: "Đang chỉ hiện ảnh có mặt người này. Bấm lại vào khuôn mặt đó để xem cả album.",
    en: "Showing only photos this person appears in. Tap that face again for the whole album.",
  },
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
  // customer album (giao diện mới)
  // {n}/{name}/{limit} là chỗ điền số / tên — thay bằng .replace() như facePreparing.
  language: { vi: "Ngôn ngữ", en: "Language" },
  close: { vi: "Đóng", en: "Close" },
  zoomIn: { vi: "Phóng to", en: "Zoom in" },
  zoomOut: { vi: "Thu nhỏ", en: "Zoom out" },
  prevPhoto: { vi: "Ảnh trước", en: "Previous photo" },
  nextPhoto: { vi: "Ảnh sau", en: "Next photo" },
  loadingOriginal: { vi: "Đang tải ảnh gốc…", en: "Loading original…" },
  photoAlbum: { vi: "Album ảnh", en: "Photo album" },
  nPhotos: { vi: "{n} ảnh", en: "{n} photos" },
  caCopyNames: { vi: "Chép tên ảnh đã chọn", en: "Copy selected photo names" },
  caExportTxt: { vi: "Tải danh sách ảnh (.txt)", en: "Download photo list (.txt)" },
  caShareBusy: { vi: "Đang tạo link…", en: "Creating link…" },
  caShareSelected: { vi: "Chia sẻ ảnh đã chọn", en: "Share selected photos" },
  caShareSelectedHint: { vi: "Người nhận chỉ xem đúng những ảnh này", en: "Recipients see only these photos" },
  caOpenDrive: { vi: "Mở thư mục Google Drive", en: "Open the Google Drive folder" },
  caEmptyAlbum: { vi: "Album chưa có ảnh nào", en: "This album has no photos yet" },
  caEmptyAlbumHint: {
    vi: "Studio đang đưa ảnh lên. Bạn quay lại sau ít phút nhé.",
    en: "The studio is uploading photos. Please check back in a few minutes.",
  },
  caViewAll: { vi: "Xem tất cả ảnh", en: "View all photos" },
  caTapCircleHint: { vi: "Chạm vòng tròn ở góc ảnh để chọn.", en: "Tap the circle in a photo's corner to select it." },
  caAllPickedTitle: { vi: "Bạn đã xem hết ảnh chưa chọn", en: "You've gone through every unselected photo" },
  caAllPickedHint: { vi: "Mọi ảnh còn lại đều đã được chọn.", en: "Every remaining photo has been selected." },
  caViewSelected: { vi: "Xem ảnh đã chọn", en: "View selected photos" },
  caAllDisliked: { vi: "Mọi ảnh ở đây đã được đánh dấu không thích", en: "Every photo here is marked as disliked" },
  caNoMatch: { vi: "Không có ảnh nào khớp bộ lọc", en: "No photos match this filter" },
  caNoMatchHint: { vi: "Thử thư mục khác hoặc bỏ lọc khuôn mặt.", en: "Try another folder or clear the face filter." },
  caSharedSub: { vi: "Ảnh được chia sẻ", en: "Shared photos" },
  caAlbumSub: { vi: "Album chọn ảnh", en: "Photo selection album" },
  caSaveAlbum: { vi: "Lưu album", en: "Save album" },
  caMoreActions: { vi: "Thêm thao tác", en: "More actions" },
  caSharedWithYou: { vi: "{name} đã chia sẻ với bạn", en: "{name} shared this with you" },
  caMaxPick: { vi: "Chọn tối đa {n} ảnh", en: "Select up to {n} photos" },
  caSharedCount: { vi: "{n} ảnh được chia sẻ", en: "{n} shared photos" },
  caSharedCalloutBody: {
    vi: "Người gửi link chọn sẵn những ảnh này cho bạn xem.",
    en: "The person who sent this link picked these photos for you.",
  },
  caHowTo: { vi: "Cách chọn ảnh", en: "How to select photos" },
  caHowToBody: {
    vi: "Chạm vòng tròn ở góc ảnh để chọn{limit}. Mở ảnh lớn để ghi chú hoặc đánh dấu không thích. Lựa chọn tự lưu — xong thì bấm “Đã chọn xong”.",
    en: "Tap the circle in a photo's corner to select it{limit}. Open a photo full-size to add a note or mark it as disliked. Your picks save automatically — tap “Done selecting” when you're finished.",
  },
  caHowToLimit: { vi: " (tối đa {n} ảnh)", en: " (up to {n} photos)" },
  caUnpicked: { vi: "Chưa chọn", en: "Not selected" },
  caPicked: { vi: "Đã chọn", en: "Selected" },
  caDislike: { vi: "Không thích", en: "Dislike" },
  caUndislikeShort: { vi: "Bỏ không thích", en: "Undo dislike" },
  caFolders: { vi: "Thư mục ảnh", en: "Photo folders" },
  caPhotosOf: { vi: "Ảnh của {name}", en: "Photos of {name}" },
  caPhotosOfThis: { vi: "Ảnh của người này", en: "Photos of this person" },
  caHidingDupes: { vi: "Đang ẩn {n} ảnh na ná", en: "Hiding {n} near-identical photos" },
  caShowAgain: { vi: "Hiện lại", en: "Show them" },
  caViewPhoto: { vi: "Xem ảnh {name}", en: "View photo {name}" },
  caInAlbum: { vi: "{n} ảnh trong album", en: "{n} photos in this album" },
  caSending: { vi: "Đang gửi…", en: "Sending…" },
  caNotifyAgain: { vi: "Báo lại studio", en: "Notify the studio again" },
  caDoneSelecting: { vi: "Đã chọn xong", en: "Done selecting" },
  caTapHintA: { vi: "Chạm", en: "Tap" },
  caTapHintB: { vi: "ở góc ảnh", en: "in a photo's corner" },
  caTapHintC: { vi: "để chọn", en: "to select" },
  caResetAndNotes: { vi: "và mọi ghi chú.", en: "and all notes." },
  caShareTitle: { vi: "Chia sẻ {n} ảnh đã chọn", en: "Share {n} selected photos" },
  caShareSubtitle: {
    vi: "Gửi link này — người nhận sẽ chỉ xem đúng những ảnh bạn đã chọn.",
    en: "Send this link — recipients will see only the photos you selected.",
  },
  caStatusDisliked: { vi: "Ảnh này ở mục Không thích", en: "This photo is in Disliked" },
  caStatusPicked: { vi: "Đã chọn ảnh này · {n}", en: "Selected · {n}" },
  caStatusUnpicked: { vi: "Chưa chọn · đã chọn {n}", en: "Not selected · {n} selected" },
  caNotePlaceholder: { vi: "Viết ghi chú cho ảnh này…", en: "Write a note for this photo…" },
  caSelectPhoto: { vi: "Chọn ảnh", en: "Select" },
  caNoteWhyDisliked: {
    vi: "Cho studio biết vì sao bạn không thích ảnh này (tuỳ chọn).",
    en: "Let the studio know why you don't like this photo (optional).",
  },
  caNoteEditHint: {
    vi: "Để lại ghi chú để studio biết bạn muốn chỉnh sửa gì cho ảnh này.",
    en: "Leave a note so the studio knows what you'd like edited in this photo.",
  },
  caNoteMovedDisliked: { vi: "Ảnh này đã chuyển sang mục Không thích", en: "This photo was moved to Disliked" },
  caNotePicked: { vi: "Ảnh này đã được chọn", en: "This photo is selected" },
  caNoteUnpicked: { vi: "Ảnh chưa được chọn", en: "This photo isn't selected" },
  caOtherGroup: { vi: "Khác", en: "Other" },
  caDoneNotSynced: {
    vi: "Chưa gửi xong lựa chọn lên studio. Đợi viên “Đã lưu” rồi báo lại nhé.",
    en: "Your picks haven't reached the studio yet. Wait until they show as saved, then try again.",
  },
  caDoneOffline: {
    vi: "Đang mất mạng. Lựa chọn đã lưu trên máy — có mạng lại rồi bấm báo studio.",
    en: "You're offline. Your picks are saved on this device — notify the studio once you're back online.",
  },
  caDoneSent: { vi: "Đã báo studio bạn chọn xong ✓", en: "The studio has been told you're done ✓" },
  caDoneFailed: { vi: "Không gửi được thông báo, thử lại sau.", en: "Couldn't send the notification. Please try again later." },
  caDoneNoConn: { vi: "Mất kết nối khi báo studio.", en: "Lost connection while notifying the studio." },
  // hộp chia sẻ · nút cài webapp · link Drive (dùng chung, trang khách)
  shareDialogTitle: { vi: "Chia sẻ ảnh đã chọn", en: "Share selected photos" },
  shareDialogDefault: { vi: "Ảnh chia sẻ", en: "Shared photos" },
  pwaInstall: { vi: "Tạo Webapp", en: "Create Web app" },
  pwaInstallTitle: { vi: "Cài đặt mstudo", en: "Install mstudo" },
  pwaIos1a: { vi: "1. Nhấn nút", en: "1. Tap the" },
  pwaIos1b: { vi: "Chia sẻ", en: "Share" },
  pwaIos1c: { vi: "ở thanh Safari bên dưới", en: "button in Safari's bottom bar" },
  pwaIos2a: { vi: "2. Cuộn xuống và chọn", en: "2. Scroll down and choose" },
  pwaIos2b: { vi: "“Thêm vào Màn hình chính”", en: "“Add to Home Screen”" },
  pwaIos3a: { vi: "3. Nhấn", en: "3. Tap" },
  pwaIos3b: { vi: "Thêm", en: "Add" },
  driveFolderFallback: { vi: "Thư mục Drive", en: "Drive folder" },
  // tìm theo khuôn mặt · ảnh na ná (ngăn kéo, giao diện mới)
  faceFinderDesc: {
    vi: "Chạm vào một khuôn mặt để xem những ảnh có người đó.",
    en: "Tap a face to see the photos that person is in.",
  },
  faceFindByPhoto: { vi: "Tìm bằng ảnh của bạn", en: "Search with your own photo" },
  dupEmptyTitle: { vi: "Gom những tấm chụp liên tiếp", en: "Group burst shots together" },
  dupEmptyHint: {
    vi: "Bấm “Tìm ảnh na ná nhau” ở dưới. Máy sẽ xếp những tấm giống nhau cạnh nhau và chỉ ra tấm nét nhất — bạn tự quyết lấy tấm nào.",
    en: "Tap “Find near-identical photos” below. Similar shots will be placed side by side with the sharpest one marked — you decide which to keep.",
  },
  dupNoAutoPick: {
    vi: "Máy KHÔNG tự chọn tấm nào. Bấm một tấm để xem lớn và lật qua cả nhóm; ưng tấm nào thì chạm vòng tròn ở góc để chọn.",
    en: "Nothing is selected automatically. Tap a photo to view it large and swipe through the group; tap the circle in the corner of the one you like to select it.",
  },
  // album tham khảo (showcase, giao diện mới)
  showcaseSub: { vi: "Album tham khảo", en: "Reference album" },
  showcaseViewOnly: { vi: "Album tham khảo · chỉ để xem", en: "Reference album · view only" },
  showcaseEmpty: { vi: "Album này chưa có ảnh.", en: "This album has no photos yet." },
  showcaseView: { vi: "Xem {name}", en: "View {name}" },
  home: { vi: "Trang chủ", en: "Home" },
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

/** Bản tiếng Việt cố định — cho thành phần dùng chung khi nằm NGOÀI LangProvider. */
const VI_FALLBACK: LangContextValue = {
  lang: "vi",
  setLang: () => {},
  t: (key) => dict[key]?.vi ?? String(key),
};

/**
 * Như useLang nhưng không ném lỗi khi thiếu LangProvider (trả về tiếng Việt).
 * Dùng cho thành phần dùng chung (hộp chia sẻ, nút cài webapp…) có lúc được vẽ ở
 * trang không bọc LangProvider, vd. /login/mfa qua InAppBrowserPrompt.
 */
export function useLangOptional(): LangContextValue {
  return useContext(LangContext) ?? VI_FALLBACK;
}
