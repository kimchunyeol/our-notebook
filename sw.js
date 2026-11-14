// 우리 둘의 공책 — 알림 받는 일꾼 (서비스 워커)
// 공책이 닫혀 있어도 알림을 띄우고, 앱 아이콘 숫자를 올려 줘요.

// 아이콘 숫자는 공책 화면과 같이 쓰는 작은 저장소(IndexedDB)에 보관
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("nb-badge", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function getCount() {
  try {
    const db = await idb();
    return await new Promise((res) => {
      const q = db.transaction("kv").objectStore("kv").get("count");
      q.onsuccess = () => res(Number(q.result) || 0);
      q.onerror = () => res(0);
    });
  } catch (e) { return 0; }
}
async function setCount(n) {
  try {
    const db = await idb();
    await new Promise((res) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(n, "count");
      tx.oncomplete = res; tx.onerror = res;
    });
  } catch (e) {}
}

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "우리 둘의 공책";
  const options = {
    body: data.body || "새 소식이 있어요",
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url: data.url || self.registration.scope },
  };
  if (data.tag) options.tag = data.tag;
  event.waitUntil((async () => {
    // 공책이 지금 화면에 떠 있으면 알림은 띄우지 않고 숫자만 (아이폰은 알림을 꼭 띄워야 해서 그때만 띄움)
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const visible = wins.some((c) => c.visibilityState === "visible");
    const n = (await getCount()) + 1;
    await setCount(n);
    try { if (self.navigator.setAppBadge) await self.navigator.setAppBadge(n); } catch (e) {}
    if (!visible || /iPhone|iPad|Macintosh/.test(self.navigator.userAgent)) {
      await self.registration.showNotification(title, options);
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.startsWith(self.registration.scope)) {
        c.postMessage({ type: "open", hash: new URL(url).hash });
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
