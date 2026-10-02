// Link Facebook/Messenger khách nhập: chỉ trang cá nhân mới đổi sang m.me, link bài viết giữ nguyên.
import assert from "node:assert/strict";
import { messengerUrl as m } from "../../src/lib/messenger-url.ts";

const cases = [
  // trang cá nhân → khung chat
  ["https://www.facebook.com/nguyen.van.a", "https://m.me/nguyen.van.a"],
  ["facebook.com/nguyen.van.a/", "https://m.me/nguyen.van.a"],
  ["https://m.facebook.com/nguyen.van.a?mibextid=ZbWKwL", "https://m.me/nguyen.van.a"],
  ["https://www.facebook.com/profile.php?id=100012345678901", "https://m.me/100012345678901"],
  ["https://www.facebook.com/profile.php?id=100012345678901&mibextid=abc", "https://m.me/100012345678901"],
  ["https://www.facebook.com/people/Lan-Phuong/100012345678901/", "https://m.me/100012345678901"],
  ["nguyen.van.a", "https://m.me/nguyen.van.a"],
  ["m.me/abc", "https://m.me/abc"],
  ["https://www.messenger.com/t/123", "https://messenger.com/t/123"],
  // bài viết / chia sẻ / ảnh / nhóm → giữ nguyên link Facebook
  ["https://www.facebook.com/share/p/1AbCdEfGh/", "https://www.facebook.com/share/p/1AbCdEfGh/"],
  ["https://www.facebook.com/share/1AbCdEfGh/", "https://www.facebook.com/share/1AbCdEfGh/"],
  ["https://www.facebook.com/nguyen.van.a/posts/pfbid02abc", "https://www.facebook.com/nguyen.van.a/posts/pfbid02abc"],
  ["https://www.facebook.com/permalink.php?story_fbid=123&id=456", "https://www.facebook.com/permalink.php?story_fbid=123&id=456"],
  ["https://www.facebook.com/photo/?fbid=123&set=a.456", "https://www.facebook.com/photo/?fbid=123&set=a.456"],
  ["https://www.facebook.com/groups/789/posts/123/", "https://www.facebook.com/groups/789/posts/123/"],
  ["https://www.facebook.com/reel/123456", "https://www.facebook.com/reel/123456"],
  ["https://fb.me/abcXYZ", "https://fb.me/abcXYZ"],
  ["facebook.com/share/r/xyz", "https://facebook.com/share/r/xyz"],
  ["", ""],
];
for (const [inp, want] of cases) {
  assert.equal(m(inp), want, inp);
  console.log("✓", inp || "(rỗng)", "→", want);
}
console.log(`\nLink Messenger: ${cases.length} ca đạt`);
