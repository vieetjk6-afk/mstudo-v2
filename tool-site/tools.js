/*
 * DANH SÁCH PHẦN MỀM — file duy nhất cần sửa khi thêm / bớt phần mềm.
 *
 * Thêm phần mềm mới: chép một khối { ... } bên dưới, dán vào cuối mảng `tools`,
 * sửa nội dung rồi đẩy lên. Không cần sửa HTML hay JS khác.
 *
 * Các trường:
 *   id          mã ngắn, không dấu, không trùng (dùng cho link #id)
 *   name        tên phần mềm
 *   tagline     một câu giới thiệu
 *   category    'may-tinh' | 'anh-video' | 'studio' | 'iphone' | ... (thêm nhóm mới ở `categories`)
 *   platforms   mảng: 'windows' | 'mac' | 'web' | 'iphone' | 'android'
 *   price       'free' (Miễn phí) | 'paid' (Có phí) | 'trial' (Dùng thử)
 *   icon        { bg: màu nền, svg: nội dung SVG 24x24 (nét trắng) }
 *   features    vài dòng tính năng chính
 *   github      (tuỳ chọn) { repo: 'chu/repo', asset: 'tên-file.zip' }
 *               → trang tự lấy phiên bản + dung lượng mới nhất từ GitHub Releases
 *               và nút Tải về trỏ thẳng tới file đó.
 *   download    (tuỳ chọn) link tải / mở trực tiếp, dùng khi không có `github`
 *               hoặc khi GitHub chưa có bản phát hành.
 *   action      chữ trên nút chính, mặc định 'Tải về'
 *   links       nút phụ: [{ label, url }]
 *   version     phiên bản hiện ra khi không lấy được từ GitHub
 *   size        dung lượng hiện ra khi không lấy được từ GitHub
 *   requires    yêu cầu hệ thống, ví dụ 'Windows 10/11 · 64-bit'
 *   note        ghi chú nhỏ dưới nút (key, tài khoản…)
 *   added       ngày đưa lên trang (YYYY-MM-DD) — mới trong 30 ngày thì có nhãn "Mới"
 *   hidden      true để tạm ẩn
 */
window.SITE = {
  name: 'vieetjk tools',
  contact: {
    zalo: '0974374744',
    github: 'https://github.com/vieetjk6-afk',
    email: '',
    facebook: '',
  },

  categories: {
    'may-tinh': 'Máy tính',
    'anh-video': 'Ảnh & video',
    studio: 'Quản lý studio',
    iphone: 'iPhone',
  },

  tools: [
    {
      id: 'pc-check',
      name: 'PC Check',
      tagline: 'Kiểm tra máy tính Windows: phần cứng, nhiệt độ, driver, dọn rác, bảo mật và sửa lỗi 1 click.',
      category: 'may-tinh',
      platforms: ['windows'],
      price: 'free',
      icon: {
        bg: '#2563eb',
        svg: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/>',
      },
      features: [
        'Điểm sức khỏe máy 0–100, theo dõi CPU / GPU / RAM / ổ đĩa trực tiếp',
        'Nhiệt độ từng linh kiện, S.M.A.R.T ổ cứng, độ chai pin',
        'Tìm driver thiếu / lỗi, kiểm tra tương thích, điều kiện lên Windows 11',
        'Dọn rác, gỡ sạch phần mềm, tắt chương trình khởi động',
        'Tìm phần mềm theo dõi, điều khiển từ xa; chẩn đoán màn hình xanh',
        'Widget nổi trên màn hình, song ngữ Việt / Anh, tự cập nhật',
      ],
      github: { repo: 'vieetjk6-afk/Cpu-check', asset: 'PcCheck-portable-win-x64.zip' },
      download: 'https://github.com/vieetjk6-afk/Cpu-check/releases',
      links: [{ label: 'Mã nguồn', url: 'https://github.com/vieetjk6-afk/Cpu-check' }],
      size: '~70 MB',
      requires: 'Windows 10/11 · 64-bit · chạy ngay, không cần cài',
      added: '2026-11-23',
    },
    {
      id: 'albumi-studio',
      name: 'Albumi Studio',
      tagline: 'Dàn trang album cưới bằng AI: thả thư mục ảnh vào, nhận về cả cuốn album; làm theo mẫu của bạn.',
      category: 'anh-video',
      platforms: ['windows', 'iphone', 'android'],
      price: 'paid',
      icon: {
        bg: '#b4874f',
        svg: '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/>',
      },
      features: [
        'AI chia chương, dàn layout 1–9 ảnh mỗi trang cho cả cuốn album',
        'Thiết kế theo mẫu khách gửi: JPG, PNG, PDF, PSD',
        'Lọc ảnh (cả RAW): tìm ảnh mờ, nhắm mắt, gom ảnh chụp liên tiếp',
        'Dựng video slide khớp nhịp nhạc, xuất MP4',
        'Xếp ảnh thẻ, ghép ảnh mạng xã hội; bản điện thoại',
        'Xuất JPEG / PDF / PNG / TIFF, RGB hoặc CMYK, 300 dpi',
      ],
      download: 'https://albumai.mstudo.com/',
      action: 'Xem & tải về',
      links: [{ label: 'Nhận key', url: 'https://albumai.mstudo.com/mua.html' }],
      requires: 'Windows 10/11 · 64-bit',
      note: 'Cần key kích hoạt. Có token AI miễn phí hằng tháng.',
      added: '2026-11-23',
    },
    {
      id: 'editer-anh',
      name: 'Editer Ảnh',
      tagline: 'Tự chỉnh màu ảnh cưới theo đúng phong cách của bạn, học từ file .xmp Camera Raw của các job cũ.',
      category: 'anh-video',
      platforms: ['windows'],
      price: 'free',
      icon: {
        bg: '#7c3aed',
        svg: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="#fff" stroke="none" opacity=".35"/><path d="M12 3v18"/>',
      },
      features: [
        'Học phong cách từ RAW + .xmp đã chỉnh, riêng từng đời máy',
        'Chỉnh hàng loạt, ghi ra .xmp để mở lại trong Camera Raw / Lightroom',
        'Giao diện kéo thả, xem trước / sau, điều khiển bằng chat',
        'Ảnh gốc không rời máy, không cần cài Python',
      ],
      github: { repo: 'vieetjk6-afk/Editer', asset: 'Editer-Anh-Windows.zip' },
      download: 'https://github.com/vieetjk6-afk/Editer/releases',
      links: [{ label: 'Mã nguồn', url: 'https://github.com/vieetjk6-afk/Editer' }],
      requires: 'Windows 10/11 · 64-bit · giải nén rồi chạy',
      added: '2026-11-23',
    },
    {
      id: 'theme-iphone',
      name: 'Theme iPhone Studio',
      tagline: 'Tự thiết kế bộ icon và hình nền cho iPhone, cài bằng một file profile. Không jailbreak, không cần Mac.',
      category: 'iphone',
      platforms: ['web', 'iphone'],
      price: 'free',
      icon: {
        bg: '#111827',
        svg: '<rect x="6" y="2" width="12" height="20" rx="3"/><rect x="8.5" y="6" width="3" height="3" rx=".8"/><rect x="12.5" y="6" width="3" height="3" rx=".8"/><rect x="8.5" y="10.5" width="3" height="3" rx=".8"/><rect x="12.5" y="10.5" width="3" height="3" rx=".8"/>',
      },
      features: [
        'Theme làm sẵn: Sương Đen, Than Chì, Mực Đen…',
        'Tự chọn icon, màu, hình nền rồi cài lên máy',
        'Chạy ngay trên trình duyệt, không cần cài app',
      ],
      download: 'https://vieetjk6-afk.github.io/Theme-iphone/',
      action: 'Mở trên trình duyệt',
      links: [{ label: 'Mã nguồn', url: 'https://github.com/vieetjk6-afk/Theme-iphone' }],
      requires: 'Mở bằng Safari trên iPhone',
      added: '2026-11-23',
    },
    {
      id: 'mstudo',
      name: 'mstudo',
      tagline: 'Quản lý studio ảnh cưới: hợp đồng, lịch chụp, khách hàng, báo giá, thu chi. Kèm app Windows tự sao lưu.',
      category: 'studio',
      platforms: ['web', 'windows'],
      price: 'trial',
      icon: {
        bg: '#0f766e',
        svg: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M7.5 14.5h3M7.5 17.5h6"/>',
      },
      features: [
        'Hợp đồng ký online, lịch chụp, khách hàng, báo giá, thu chi',
        'Trang web studio, thiệp cưới, gửi ảnh cho khách',
        'App Windows (MStudo Desktop): tự lưu hợp đồng PDF + Word, xuất Excel hằng ngày',
      ],
      download: 'https://mstudo.com/',
      action: 'Dùng thử',
      note: 'App Windows tải trong mục MStudo Desktop sau khi đăng nhập.',
      requires: 'Trình duyệt · Windows 10/11 cho app máy tính',
      added: '2026-11-23',
    },
  ],
};
