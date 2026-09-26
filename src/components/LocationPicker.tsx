"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { MapPin, Crosshair, Loader2, Link as LinkIcon, Search, X } from "lucide-react";
import type { IntakeLocation } from "@/lib/types";
import { isShortMapsUrl, mapsLink, parseLatLng, validCoords } from "@/lib/map-coords";

/* eslint-disable @typescript-eslint/no-explicit-any */

export { mapsLink, parseLatLng };
export type LatLng = { lat: number; lng: number } | null;

type Hit = { name: string; lat: number; lng: number };

/**
 * Chọn vị trí cho form điền thông tin. 4 cách:
 *  1) Tìm địa chỉ bằng chữ (cần `token` — gọi /api/form/[token]/map).
 *  2) Bấm lên bản đồ (Leaflet + OpenStreetMap — miễn phí, không cần API key).
 *  3) "Vị trí hiện tại" (GPS).
 *  4) Dán link Google Maps (hoặc toạ độ "lat,lng"). Link RÚT GỌN maps.app.goo.gl
 *     (link "Chia sẻ" trên điện thoại) được server mở ra toạ độ → hiện ghim để
 *     khách thấy đúng chỗ trước khi gửi. Không mở được thì vẫn lưu link.
 * Trả về IntakeLocation | null.
 */
export default function LocationPicker({
  value,
  onChange,
  token,
}: {
  value: IntakeLocation | null;
  onChange: (v: IntakeLocation | null) => void;
  /** intake_token của form — bật tìm địa chỉ & mở link rút gọn. */
  token?: string;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const placeRef = useRef<(lat: number, lng: number) => void>(() => {});
  const clearRef = useRef<() => void>(() => {});
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [ready, setReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [link, setLink] = useState(value && !validCoords(value.lat, value.lng) ? value.mapUrl : "");
  const [linkBusy, setLinkBusy] = useState(false);
  // Link vừa xử lý — dán (onPaste) rồi rời ô (onBlur) không mở lại lần nữa.
  const lastLink = useRef("");
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [hits, setHits] = useState<Hit[] | null>(null);

  const coords = value ? validCoords(value.lat, value.lng) : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod: any = await import("leaflet");
      const L = mod.default ?? mod;
      if (cancelled || !mapEl.current || mapRef.current) return;
      // (0,0) là vị trí rác từ bản cũ → coi như chưa chọn.
      const init = value ? validCoords(value.lat, value.lng) : null;
      const start = init ?? { lat: 16.0544, lng: 108.2022 }; // mặc định: giữa Việt Nam, nhìn được cả nước
      const map = L.map(mapEl.current).setView([start.lat, start.lng], init ? 16 : 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      let marker: any = null;
      const draw = (lat: number, lng: number) => {
        if (marker) marker.setLatLng([lat, lng]);
        else
          marker = L.circleMarker([lat, lng], {
            radius: 9,
            color: "#fff",
            weight: 2,
            fillColor: "#0068FF",
            fillOpacity: 1,
          }).addTo(map);
      };
      placeRef.current = (lat: number, lng: number) => {
        draw(lat, lng);
        onChangeRef.current({ lat, lng, mapUrl: mapsLink(lat, lng) });
      };
      clearRef.current = () => {
        if (marker) {
          marker.remove();
          marker = null;
        }
      };
      if (init) draw(init.lat, init.lng);
      map.on("click", (e: any) => {
        setLink("");
        setNote(null);
        placeRef.current(e.latlng.lat, e.latlng.lng);
      });
      // Bản đồ nằm trong khối có thể ẩn/hiện → tính lại kích thước sau khi mount.
      setTimeout(() => map.invalidateSize(), 200);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Khởi tạo một lần.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goTo(lat: number, lng: number) {
    mapRef.current?.setView([lat, lng], 17);
    placeRef.current(lat, lng);
  }

  function useCurrent() {
    if (!navigator.geolocation) {
      setNote({ text: "Trình duyệt không hỗ trợ lấy vị trí — hãy tìm địa chỉ hoặc bấm lên bản đồ.", bad: true });
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const c = validCoords(pos.coords.latitude, pos.coords.longitude);
        if (!c) {
          setNote({ text: "Chưa bắt được GPS. Thử lại ngoài trời hoặc bấm lên bản đồ.", bad: true });
          return;
        }
        setLink("");
        goTo(c.lat, c.lng);
        const acc = Math.round(pos.coords.accuracy || 0);
        setNote({
          text:
            acc > 150
              ? `Vị trí hiện tại lệch khoảng ${acc} m — kiểm tra lại ghim, bấm lên bản đồ để chỉnh cho đúng.`
              : "Đã lấy vị trí hiện tại ✓ Kiểm tra lại ghim trên bản đồ.",
          bad: acc > 150,
        });
      },
      (err) => {
        setLocating(false);
        setNote({
          text:
            err.code === err.PERMISSION_DENIED
              ? "Chưa cho phép truy cập vị trí. Bật quyền vị trí cho trình duyệt, hoặc tìm địa chỉ / dán link Google Maps."
              : "Không lấy được vị trí hiện tại. Thử lại, hoặc tìm địa chỉ / bấm lên bản đồ.",
          bad: true,
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function applyLink(raw: string) {
    const url = raw.trim();
    if (url && url === lastLink.current) return;
    lastLink.current = url;
    if (!url) {
      setNote(null);
      // Xoá link nhưng giữ ghim toạ độ nếu đang có.
      if (value && !coords) onChangeRef.current(null);
      return;
    }
    const c = parseLatLng(url);
    if (c) {
      goTo(c.lat, c.lng);
      setNote({ text: "Đã lấy được vị trí từ link ✓ Kiểm tra lại ghim trên bản đồ." });
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      setNote({ text: "Link chưa hợp lệ — dán link Google Maps hoặc toạ độ dạng 10.762, 106.660.", bad: true });
      return;
    }
    // Lưu link ngay (lỡ khách bấm gửi khi đang mở link) rồi mới thử lấy toạ độ.
    clearRef.current();
    onChangeRef.current({ lat: null, lng: null, mapUrl: url });
    if (token && isShortMapsUrl(url)) {
      setLinkBusy(true);
      try {
        const res = await fetch(`/api/form/${token}/map`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const j = await res.json().catch(() => ({}));
        const loc = j?.location ? validCoords(j.location.lat, j.location.lng) : null;
        if (loc) {
          goTo(loc.lat, loc.lng);
          setNote({ text: "Đã lấy được vị trí từ link ✓ Kiểm tra lại ghim trên bản đồ." });
          return;
        }
      } catch {
        /* rơi xuống ghi chú bên dưới */
      } finally {
        setLinkBusy(false);
      }
    }
    setNote({ text: "Đã lưu link — studio vẫn mở được. Nếu được, bấm lên bản đồ để ghim chính xác hơn." });
  }

  async function search() {
    const query = q.trim();
    if (!token || query.length < 3) return;
    setSearching(true);
    setHits(null);
    try {
      const res = await fetch(`/api/form/${token}/map?q=${encodeURIComponent(query)}`);
      const j = await res.json().catch(() => ({}));
      setHits(Array.isArray(j?.results) ? j.results : []);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  function clearAll() {
    lastLink.current = "";
    clearRef.current();
    setLink("");
    setNote(null);
    onChangeRef.current(null);
  }

  return (
    <div>
      {token && (
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
              <input
                className="input w-full pl-7 text-sm"
                placeholder="Tìm địa chỉ (vd: 12 Lê Lợi, Huế)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    search();
                  }
                }}
              />
            </div>
            <button type="button" onClick={search} disabled={searching || q.trim().length < 3} className="btn-ghost px-2.5 py-1.5 text-xs">
              {searching ? <Loader2 size={12} className="inline animate-spin" /> : "Tìm"}
            </button>
          </div>
          {hits && (
            <div className="mt-1 overflow-hidden rounded-lg border border-white/10">
              {hits.length === 0 ? (
                <p className="px-3 py-2 text-[12px] opacity-70">
                  Không tìm thấy — thử ghi ngắn hơn (tên đường, phường/xã, tỉnh) hoặc bấm lên bản đồ.
                </p>
              ) : (
                hits.map((h, i) => (
                  <button
                    key={`${h.lat},${h.lng},${i}`}
                    type="button"
                    onClick={() => {
                      setHits(null);
                      setLink("");
                      goTo(h.lat, h.lng);
                      setNote({ text: "Đã đặt ghim theo địa chỉ ✓ Nếu chưa đúng nhà, bấm lên bản đồ để chỉnh." });
                    }}
                    className="block w-full px-3 py-2 text-left text-[12.5px] hover:bg-black/5"
                    style={{ borderTop: i ? "1px solid rgba(127,127,127,.15)" : "none" }}
                  >
                    <MapPin size={12} className="mr-1 inline opacity-60" />
                    {h.name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 text-xs opacity-70">
          <MapPin size={13} /> Bấm lên bản đồ để đặt / chỉnh ghim
        </span>
        <button type="button" onClick={useCurrent} disabled={locating} className="btn-ghost px-2 py-1 text-xs">
          {locating ? <Loader2 size={12} className="inline animate-spin" /> : <Crosshair size={12} className="inline" />} Vị trí hiện tại
        </button>
      </div>
      <div
        ref={mapEl}
        className="mt-1.5 w-full overflow-hidden rounded-lg border border-white/10"
        style={{ height: 240 }}
      />
      {!ready && <p className="mt-1 text-[11px] opacity-50">Đang tải bản đồ…</p>}

      {/* Nhập link Google Maps */}
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <LinkIcon size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 opacity-50" />
            <input
              className="input w-full pl-7 text-sm"
              inputMode="url"
              placeholder="Hoặc dán link Google Maps vào đây"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={(e) => applyLink(e.target.value)}
              onPaste={(e) => {
                const t = e.clipboardData.getData("text");
                if (t) {
                  e.preventDefault();
                  setLink(t);
                  applyLink(t);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink((e.target as HTMLInputElement).value);
                }
              }}
            />
          </div>
          <button type="button" onClick={() => applyLink(link)} disabled={linkBusy} className="btn-ghost px-2.5 py-1.5 text-xs">
            {linkBusy ? <Loader2 size={12} className="inline animate-spin" /> : "Áp dụng"}
          </button>
        </div>
      </div>

      {note && (
        <p className="mt-1 text-[11px]" style={{ color: note.bad ? "var(--s-red, #c0392b)" : undefined, opacity: note.bad ? 1 : 0.75 }}>
          {note.text}
        </p>
      )}

      {value && (
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] opacity-80">
          <span>{coords ? `Đã chọn: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Đã lưu link"}</span>·
          <a href={value.mapUrl} target="_blank" rel="noreferrer" style={{ color: "#0068FF" }}>
            mở Google Maps kiểm tra
          </a>
          ·
          <button type="button" onClick={clearAll} className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline">
            <X size={11} /> Xoá
          </button>
        </p>
      )}
    </div>
  );
}
