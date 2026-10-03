// Ép mở bằng trình duyệt thật: nhận diện webview Zalo/Facebook, trang nào bị chặn, khi nào tự nhảy.
import assert from "node:assert/strict";
import {
  browserEscapeUrl,
  canAutoEscape,
  detectInAppBrowser,
  isGatedPath,
} from "../../src/lib/in-app-browser.ts";

const UA = {
  zaloIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/536 ZaloTheme/light ZaloLanguage/vn",
  zaloAndroid: "Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36 Zalo android/12100621 ZaloTheme/light ZaloLanguage/vi",
  fbIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/612345678;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/vi_VN;FBOP/5]",
  fbAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.134 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/473.0.0.40.109;]",
  messengerAndroid: "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.134 Mobile Safari/537.36 [FB_IAB/Orca-Android;FBAV/465.0.0.39.109;]",
  bankAndroid: "Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.6422.165 Mobile Safari/537.36",
  safari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  chromeIos: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1",
  chromeAndroid: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
  desktop: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

// ── Nhận diện ────────────────────────────────────────────────────────────────
assert.deepEqual(detectInAppBrowser(UA.zaloIos), { app: "zalo", os: "ios" });
assert.deepEqual(detectInAppBrowser(UA.zaloAndroid), { app: "zalo", os: "android" });
assert.deepEqual(detectInAppBrowser(UA.fbIos), { app: "facebook", os: "ios" });
assert.deepEqual(detectInAppBrowser(UA.fbAndroid), { app: "facebook", os: "android" });
assert.deepEqual(detectInAppBrowser(UA.messengerAndroid), { app: "messenger", os: "android" });
assert.deepEqual(detectInAppBrowser(UA.bankAndroid), { app: "other", os: "android" });
console.log("✓ nhận ra Zalo / Facebook / Messenger / webview lạ trên iPhone và Android");

for (const k of ["safari", "chromeIos", "chromeAndroid", "desktop"]) {
  assert.equal(detectInAppBrowser(UA[k]), null, k);
}
assert.equal(detectInAppBrowser(UA.zaloIos, { standalone: true }), null);
console.log("✓ trình duyệt thật, máy tính, webapp đã cài → không chặn");

// ── Trang nào bị chặn ────────────────────────────────────────────────────────
for (const p of ["/portal/abc", "/c/abc", "/album/cuoi-a-b", "/a/chon-anh", "/q/tok", "/voucher/tok", "/form/tok"]) {
  assert.equal(isGatedPath(p), true, p);
}
for (const p of ["/", "/thiep/abc", "/story/abc", "/site/may/", "/book/tok", "/gia/may", "/dashboard/studio", "/albums", "/a", null]) {
  assert.equal(isGatedPath(p), false, String(p));
}
console.log("✓ chỉ chặn trang gửi khách; thiệp, story, website, đặt lịch, khu quản lý thì không");

// ── Khi nào được tự nhảy ─────────────────────────────────────────────────────
assert.equal(canAutoEscape(detectInAppBrowser(UA.zaloAndroid)), true);
assert.equal(canAutoEscape(detectInAppBrowser(UA.fbAndroid)), true);
assert.equal(canAutoEscape(detectInAppBrowser(UA.zaloIos)), false);
assert.equal(canAutoEscape(detectInAppBrowser(UA.fbIos)), false);
assert.equal(canAutoEscape(detectInAppBrowser(UA.bankAndroid)), false);
console.log("✓ chỉ tự nhảy ở Android với app đã biết; iPhone và webview lạ phải bấm nút");

// ── Đường thoát ──────────────────────────────────────────────────────────────
assert.equal(
  browserEscapeUrl("https://mayanh.mstudo.com/portal/tok?x=1#anh", "ios"),
  "x-safari-https://mayanh.mstudo.com/portal/tok?x=1",
);
const intent = browserEscapeUrl("https://mayanh.mstudo.com/portal/tok?x=1#anh", "android");
assert.ok(intent.startsWith("intent://mayanh.mstudo.com/portal/tok?x=1#Intent;scheme=https;"), intent);
assert.ok(intent.includes(`S.browser_fallback_url=${encodeURIComponent("https://mayanh.mstudo.com/portal/tok?x=1")};end`), intent);
assert.equal(browserEscapeUrl("javascript:alert(1)", "android"), null);
console.log("✓ link thoát Safari / Chrome đúng dạng, bỏ #hash, chặn lược đồ lạ");

console.log("\nTất cả kiểm thử đạt");
