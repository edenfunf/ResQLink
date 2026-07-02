// Demo-mode civic information for the public rescue portal — shelters, road
// closures, lifeline restoration, official announcements, casualty figures.
// These have no backing DB models yet, so for the demo they are generated
// deterministically from the incident id (same incident → same data on every
// load). Everything here is fictional and clearly footnoted as demo data on
// the page.

export interface DemoShelter {
  name: string;
  address: string;
  capacity: number;
  current: number;
  status: "open" | "nearFull" | "full";
  phone: string;
  features: string[];
  lat: number;
  lon: number;
}

export interface DemoRoad {
  road: string;
  section: string;
  status: "封閉" | "單線雙向管制" | "搶通中" | "已搶通";
  note: string;
  agency: string;
  updatedAgoMin: number;
}

export interface DemoUtility {
  name: string;
  unit: string;
  affected: number;
  restoredPct: number;
  eta: string;
  agency: string;
}

export interface DemoAnnouncement {
  seq: number | null; // 應變中心第 N 報；其他單位為 null
  agency: string;
  level: "urgent" | "warning" | "info";
  title: string;
  body: string;
  agoMin: number;
}

export interface DemoCasualties {
  death: number;
  injured: number;
  missing: number;
  rescued: number;
  sheltered: number;
  reportSeq: number;
}

export interface DemoMedical {
  name: string;
  address: string;
  services: string;
  hours: string;
  lat: number;
  lon: number;
}

export interface DemoSupplyLine {
  item: string;
  status: "urgent" | "collecting" | "sufficient";
  needed: number;
  received: number;
  unit: string;
}

export interface DemoCivicInfo {
  announcements: DemoAnnouncement[];
  shelters: DemoShelter[];
  roads: DemoRoad[];
  utilities: DemoUtility[];
  casualties: DemoCasualties;
  medical: DemoMedical[];
  supplyBoard: DemoSupplyLine[];
  donation: { account: string; bank: string; number: string; note: string };
  opLevel: string; // 應變中心開設等級
}

/* ── deterministic RNG ───────────────────────────────────── */

function hashSeed(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed: string) {
  const rnd = mulberry32(hashSeed(seed));
  return {
    next: rnd,
    int: (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1)),
    pick: <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)],
    sample: <T,>(arr: T[], k: number): T[] => {
      const copy = [...arr];
      const out: T[] = [];
      while (out.length < k && copy.length) {
        out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0]);
      }
      return out;
    },
  };
}

type Rng = ReturnType<typeof makeRng>;

/* ── content pools ───────────────────────────────────────── */

const SHELTER_KINDS = [
  { n: "國小活動中心", cap: [120, 250] as const },
  { n: "國中風雨操場", cap: [200, 400] as const },
  { n: "公所大禮堂", cap: [150, 300] as const },
  { n: "社區活動中心", cap: [60, 120] as const },
  { n: "長老教會會堂", cap: [40, 90] as const },
  { n: "村集會所", cap: [30, 80] as const },
  { n: "體育館", cap: [400, 800] as const },
];
const SHELTER_FEATURES = ["無障礙設施", "寵物同行區", "醫護駐點", "提供熱食",
  "淋浴設備", "母嬰空間", "充電站", "Wi-Fi"];
const SHELTER_PREFIX = ["中正", "中山", "光復", "大同", "仁愛", "信義", "和平",
  "復興", "成功", "自強", "民生", "太平"];

const ROADS_POOL = [
  { road: "台9線", section: "溪橋路段" },
  { road: "台11線", section: "海岸路段" },
  { road: "縣道193", section: "堤防沿線" },
  { road: "市區中正路", section: "平交道涵洞" },
  { road: "產業道路", section: "山區聯絡道" },
  { road: "鄉道", section: "跨溪便橋" },
];
const ROAD_NOTES: Record<DemoRoad["status"], string[]> = {
  封閉: ["雙向封閉禁止通行，請改道行駛", "橋梁安全檢測中，開放時間另行公告",
    "土石持續滑落，禁止人車進入"],
  單線雙向管制: ["實施單線雙向管制，尖峰時段請提早出門", "大型車輛禁止通行，小車可通行"],
  搶通中: ["工程單位搶修中，預計今日傍晚搶通", "重機具已進場清除土石"],
  已搶通: ["已恢復雙向通行，路面仍有泥濘請減速慢行", "已開放通行，夜間照明不足請小心"],
};

const ANN_POOL: {
  agency: string; level: DemoAnnouncement["level"]; title: string; body: string;
  scenarios?: string[];
}[] = [
  { agency: "災害應變中心", level: "urgent",
    title: "撤離勸告：低窪與河岸地區居民請立即撤離",
    body: "轄內低窪地區、河岸兩側 500 公尺範圍住戶，請攜帶隨身藥品與證件，依村里幹事引導前往指定收容所。行動不便者可撥打災害專線安排接送。",
    scenarios: ["barrier_lake", "flood", "typhoon"] },
  { agency: "災害應變中心", level: "urgent",
    title: "餘震持續，請勿返回受損建物取物",
    body: "氣象署預估未來 3 日仍有規模 5 以上餘震可能。經張貼紅、黃單之建築物，在完成安全評估前請勿進入。",
    scenarios: ["earthquake"] },
  { agency: "災害應變中心", level: "warning",
    title: "收容所開設情形與收容量能",
    body: "轄內收容所已全數開設，提供熱食、盥洗與臨時醫療服務。收容情形以本頁「避難收容所」一節為準，前往前建議先電話確認床位。" },
  { agency: "公路養護單位", level: "warning",
    title: "轄內道路封閉與管制路段公告",
    body: "受災路段實施封閉或單線管制，最新路況請參閱本頁「道路交通管制」一節，或撥打路況專線查詢。" },
  { agency: "台電區營業處", level: "warning",
    title: "停電搶修進度說明",
    body: "搶修人員已全數投入，優先恢復醫療院所、收容所與淨水場供電。屋內線受損戶須由合格水電技師檢修後始可復電。" },
  { agency: "自來水公司", level: "info",
    title: "供水情形與臨時取水點",
    body: "部分地區降壓供水，臨時取水點設於各收容所與公所前廣場，請自備容器。飲用水煮沸後再飲用。" },
  { agency: "衛生局", level: "info",
    title: "災後防疫與飲食衛生提醒",
    body: "清理家園請穿雨鞋、戴手套口罩，皮膚有傷口請避免接觸污水。泡水食品請勿食用，出現腹瀉發燒症狀請儘速就醫。" },
  { agency: "教育處", level: "info",
    title: "轄內學校停課與復課資訊",
    body: "受災里別轄內學校今日停課一日，校舍安全評估完成後另行公告復課時間，請家長留意學校群組通知。" },
  { agency: "社會處", level: "info",
    title: "災害救助金申請方式",
    body: "受災戶可檢附身分證明與受災照片，向戶籍所在地公所申請災害救助。申請期限為災害發生日起 30 日內。" },
  { agency: "災害應變中心", level: "info",
    title: "志工與物資統一受理窗口",
    body: "為避免資源重複與現場壅塞，志工報名與物資捐贈請一律透過本網站登記，由應變中心統一調度，請勿自行前往災區。" },
  { agency: "環保局", level: "info",
    title: "災後廢棄物清運動線公告",
    body: "泡水家具與垃圾請置於路口指定集運點，清潔隊將加班清運。廢棄物請勿丟入水溝以免二次淹水。" },
];

const SUPPLY_BOARD_POOL: { item: string; unit: string }[] = [
  { item: "瓶裝飲用水", unit: "箱" },
  { item: "睡袋／毛毯", unit: "件" },
  { item: "清淤工具（圓鍬、水桶）", unit: "組" },
  { item: "雨鞋", unit: "雙" },
  { item: "行動電源／照明燈具", unit: "個" },
  { item: "嬰幼兒奶粉尿布", unit: "份" },
  { item: "成人紙尿褲", unit: "包" },
  { item: "常備藥品／急救包", unit: "組" },
];
const SUPPLY_STOP = ["二手衣物", "泡麵（庫存已足）", "含糖飲料", "生鮮食品"];

const OP_LEVEL: Record<string, string> = {
  critical: "一級開設",
  high: "二級開設",
  medium: "三級開設",
  low: "三級開設",
};

/* ── generator ───────────────────────────────────────────── */

export function buildCivicInfo(opts: {
  incidentId: string;
  scenario: string;
  severity: string;
  county?: string | null;
  town?: string | null;
  centerLat?: number | null;
  centerLon?: number | null;
}): DemoCivicInfo {
  const rng = makeRng(opts.incidentId);
  const county = opts.county || "";
  const town = opts.town || "";
  const place = county + town || "災區";
  const lat = opts.centerLat ?? 23.75;
  const lon = opts.centerLon ?? 121.0;
  const jitter = (v: number) => v + (rng.next() - 0.5) * 0.03;
  const areaCode = county.includes("花蓮") || county.includes("台東") ? "03" : "0X";
  const phone = () => `${areaCode}-8${rng.int(100, 999)}${rng.int(100, 999)}`;

  // shelters — occupancy skewed so one or two run near capacity
  const shelters: DemoShelter[] = rng
    .sample(SHELTER_KINDS, 6)
    .map((kind, i) => {
      const capacity = rng.int(kind.cap[0], kind.cap[1]);
      const fill = i === 0 ? rng.next() * 0.25 + 0.75 : rng.next() * 0.7 + 0.1;
      const current = Math.min(capacity, Math.round(capacity * fill));
      const ratio = current / capacity;
      return {
        name: `${rng.pick(SHELTER_PREFIX)}${kind.n}`,
        address: `${place}${rng.pick(SHELTER_PREFIX)}路${rng.int(1, 200)}號`,
        capacity,
        current,
        status: ratio >= 0.98 ? "full" : ratio >= 0.8 ? "nearFull" : "open",
        phone: phone(),
        features: rng.sample(SHELTER_FEATURES, rng.int(2, 4)),
        lat: jitter(lat),
        lon: jitter(lon),
      };
    });
  const sheltered = shelters.reduce((s, x) => s + x.current, 0);

  // roads
  const statuses: DemoRoad["status"][] = ["封閉", "封閉", "單線雙向管制", "搶通中", "已搶通"];
  const roads: DemoRoad[] = rng.sample(ROADS_POOL, rng.int(4, 5)).map((r) => {
    const status = rng.pick(statuses);
    return {
      road: r.road,
      section: `${town || county}${r.section}`,
      status,
      note: rng.pick(ROAD_NOTES[status]),
      agency: r.road.startsWith("台") ? "公路局養護工程分局" : "縣府建設處",
      updatedAgoMin: rng.int(15, 300),
    };
  });

  // lifelines
  const big = opts.severity === "critical";
  const utilities: DemoUtility[] = [
    { name: "電力", unit: "戶", affected: rng.int(big ? 3000 : 800, big ? 12000 : 4000),
      restoredPct: rng.int(55, 90), eta: "預計今日 22:00 前完成主要幹線", agency: "台電區營業處" },
    { name: "自來水", unit: "戶", affected: rng.int(big ? 2000 : 500, big ? 9000 : 3000),
      restoredPct: rng.int(40, 85), eta: "降壓供水中，臨時取水點見公告", agency: "台水營運所" },
    { name: "市話／行動通訊", unit: "基地台", affected: rng.int(3, 18),
      restoredPct: rng.int(60, 95), eta: "行動基地台車已進駐災區", agency: "NCC / 電信業者" },
    { name: "瓦斯", unit: "戶", affected: rng.int(100, 900),
      restoredPct: rng.int(50, 90), eta: "管線檢測完成區域陸續恢復", agency: "導管瓦斯公司" },
  ];

  // casualties — scaled by severity, deliberately modest numbers
  const casualties: DemoCasualties = {
    death: big ? rng.int(0, 4) : rng.int(0, 1),
    injured: big ? rng.int(15, 60) : rng.int(2, 15),
    missing: big ? rng.int(0, 6) : rng.int(0, 2),
    rescued: big ? rng.int(20, 80) : rng.int(3, 20),
    sheltered,
    reportSeq: rng.int(4, 9),
  };

  // announcements — filter by scenario, order newest first
  const pool = ANN_POOL.filter(
    (a) => !a.scenarios || a.scenarios.includes(opts.scenario)
  );
  const picked = rng.sample(pool, Math.min(8, pool.length));
  let ago = rng.int(12, 45);
  const announcements: DemoAnnouncement[] = picked
    .sort((a, b) => (a.level === "urgent" ? -1 : 0) - (b.level === "urgent" ? -1 : 0))
    .map((a) => {
      const item: DemoAnnouncement = {
        seq: a.agency === "災害應變中心" ? null : null,
        agency: a.agency === "災害應變中心" ? `${county}災害應變中心` : a.agency,
        level: a.level,
        title: a.title,
        body: a.body,
        agoMin: ago,
      };
      ago += rng.int(60, 320);
      return item;
    });
  // number the EOC bulletins from newest down
  let seq = casualties.reportSeq;
  for (const a of announcements) {
    if (a.agency.includes("災害應變中心")) a.seq = seq--;
  }

  const medical: DemoMedical[] = [
    { name: `${town || county}衛生所（前進指揮所）`, address: `${place}中山路${rng.int(1, 150)}號`,
      services: "外傷處置、慢性病藥事諮詢、心理關懷", hours: "24 小時",
      lat: jitter(lat), lon: jitter(lon) },
    { name: "災區巡迴醫療站", address: "駐點於各收容所（每日巡迴）",
      services: "一般內科、傷口換藥、血壓血糖量測", hours: "08:00–20:00",
      lat: jitter(lat), lon: jitter(lon) },
  ];

  const supplyBoard: DemoSupplyLine[] = rng
    .sample(SUPPLY_BOARD_POOL, 6)
    .map((s, i) => {
      const needed = rng.int(200, 1500);
      const pct = i < 2 ? rng.next() * 0.35 + 0.05 : rng.next() * 0.75 + 0.2;
      return {
        item: s.item,
        unit: s.unit,
        needed,
        received: Math.round(needed * pct),
        status: (pct < 0.4 ? "urgent" : pct < 0.9 ? "collecting" : "sufficient") as DemoSupplyLine["status"],
      };
    })
    .sort((a, b) => a.received / a.needed - b.received / b.needed);

  return {
    announcements,
    shelters,
    roads,
    utilities,
    casualties,
    medical,
    supplyBoard,
    donation: {
      account: `${county || "縣市"}政府社會救助金專戶（賑災）`,
      bank: "臺灣銀行 分行代碼 004",
      number: `0${rng.int(10, 99)}-004-5${rng.int(10000, 99999)}`,
      note: "匯款請註明「賑災捐款」；收據可申請抵稅。示範頁面，請勿實際匯款。",
    },
    opLevel: OP_LEVEL[opts.severity] || "三級開設",
  };
}

export const STOP_DONATION_ITEMS = SUPPLY_STOP;

/* ── site-admin ops metrics (demo) ───────────────────────── */

export interface SiteOps {
  todayVisits: number;
  totalVisits: number;
  hourly: number[]; // 24 points, index 0 = 24h ago
  avgStay: string;
  shareCount: number;
  sources: { name: string; pct: number }[];
  sections: { name: string; views: number }[];
}

/** Fake-but-plausible traffic metrics for the site admin backend,
 * deterministic per incident. */
export function buildSiteOps(incidentId: string): SiteOps {
  const rng = makeRng(`ops:${incidentId}`);
  // diurnal curve with a post-disaster evening spike
  const hourly = Array.from({ length: 24 }, (_, i) => {
    const hour = (new Date().getHours() - 23 + i + 24) % 24;
    const day = hour >= 7 && hour <= 22 ? 1 : 0.25;
    const peak = hour >= 18 && hour <= 21 ? 1.7 : 1;
    return Math.round((30 + rng.next() * 55) * day * peak);
  });
  const todayVisits = hourly.reduce((s, v) => s + v, 0);
  const rawSources = [
    { name: "LINE 分享", w: 30 + rng.int(0, 15) },
    { name: "Facebook", w: 20 + rng.int(0, 12) },
    { name: "搜尋引擎", w: 12 + rng.int(0, 8) },
    { name: "直接輸入／書籤", w: 8 + rng.int(0, 6) },
    { name: "新聞媒體連結", w: 5 + rng.int(0, 6) },
  ];
  const wSum = rawSources.reduce((s, x) => s + x.w, 0);
  return {
    todayVisits,
    totalVisits: todayVisits * rng.int(3, 6) + rng.int(200, 900),
    hourly,
    avgStay: `${rng.int(1, 3)} 分 ${rng.int(10, 59)} 秒`,
    shareCount: rng.int(120, 800),
    sources: rawSources.map((x) => ({ name: x.name, pct: Math.round((x.w / wSum) * 100) })),
    sections: [
      { name: "災情態勢圖", views: Math.round(todayVisits * (0.5 + rng.next() * 0.2)) },
      { name: "避難收容所", views: Math.round(todayVisits * (0.35 + rng.next() * 0.2)) },
      { name: "災情通報表單", views: Math.round(todayVisits * (0.25 + rng.next() * 0.15)) },
      { name: "道路交通管制", views: Math.round(todayVisits * (0.2 + rng.next() * 0.12)) },
      { name: "物資需求看板", views: Math.round(todayVisits * (0.12 + rng.next() * 0.1)) },
    ].sort((a, b) => b.views - a.views),
  };
}

/* ── FB page admin ops (demo) ────────────────────────────── */

export interface FbMessage {
  kind: "comment" | "message";
  author: string;
  text: string;
  agoMin: number;
  replied: boolean;
  urgent?: boolean;
  reply?: string; // the page's canned reply, shown when replied
}

export interface FbOps {
  followers: number;
  followerGrowth: number; // past 7 days
  reach7d: number[]; // daily reach, index 0 = 6 days ago
  pageViews: number; // past 7 days
  postEngagements: number; // past 7 days
  engagementRate: number; // %
  responseRate: number; // %
  responseTime: string;
  inbox: FbMessage[];
  suggestions: { title: string; why: string }[];
}

const FB_AUTHORS = ["林佳蓉", "陳志明", "張秀琴", "阿賢", "王美玲", "志工小隊長 Kevin",
  "光復在地人", "淑芬", "外地遊子", "王大哥", "黃小姐", "阿嬤的孫女",
  "游先生", "曾媽媽", "在地里民", "Peggy Chen"];

const FB_INBOX_POOL: Omit<FbMessage, "agoMin" | "replied" | "author">[] = [
  { kind: "comment", urgent: true,
    text: "請問國小收容所還有空位嗎？家裡有兩位長者行動不便，需要協助接送。",
    reply: "您好，收容情形請見網站「避難收容所」一節；長者接送已為您轉交應變中心，會有專人電話聯繫。" },
  { kind: "message", urgent: true,
    text: "可以幫忙轉發協尋嗎？我爸昨天下午出門巡田到現在聯絡不上，電話不通。",
    reply: "已收到，請提供姓名、年齡與最後出現地點，我們將轉交警政協尋並協助擴散。" },
  { kind: "comment", urgent: true,
    text: "聽說上游堤防快潰堤了，LINE 群組都在傳，是真的嗎？請盡快說明！",
    reply: "此為不實訊息。經工程單位巡檢，堤防結構目前穩定，最新監測結果以本粉專與應變中心公告為準。" },
  { kind: "comment", urgent: true,
    text: "我家隔壁三合院倒了一半，好像還有人沒出來，119 一直打不進去！" },
  { kind: "comment",
    text: "中正路這邊還在停電，家裡老人家用製氧機，請問什麼時候會修好？",
    reply: "台電已列入優先搶修，製氧機用電需求可撥打 1999 申請臨時電源支援。" },
  { kind: "message",
    text: "我們公司想捐 50 箱瓶裝水和 200 份乾糧，請問要送到哪個集散點？",
    reply: "感謝您！請先於網站「物資捐贈登記」填寫品項與數量，核對需求後會回覆指定集散點與時段。" },
  { kind: "comment", text: "志工報名表填完兩天了都沒收到通知，請問還缺人嗎？" },
  { kind: "comment", text: "感謝今天來幫忙清淤的志工們，辛苦了 🙏🙏" },
  { kind: "message", text: "災情通報表單一直送不出去，顯示錯誤，可以幫忙看一下嗎？" },
  { kind: "comment", text: "請問外縣市過去的志工有交通接駁嗎？還是要自行開車？" },
  { kind: "comment", text: "可以公佈還有營業的藥局名單嗎？慢性病藥快吃完了。" },
  { kind: "message", text: "家裡淹水的照片要傳到哪裡申請災損補助？",
    reply: "災損救助由公所受理，請攜身分證明與受災照片至戶籍地公所辦理，期限為災害發生日起 30 日。" },
  { kind: "comment", text: "學校到底什麼時候復課？家長群組都沒有消息。" },
  { kind: "message", text: "你好，我是記者，想確認目前收容人數與傷亡統計，方便提供聯絡窗口嗎？" },
  { kind: "comment", text: "分享給住那邊的同學了，大家注意安全！" },
  { kind: "comment", text: "建議把取水點的開放時間寫清楚，今天白跑一趟 😥" },
];

const FB_SUGGESTIONS: { title: string; why: string }[] = [
  { title: "18:00 固定更新：收容所空位與取水點", why: "民眾晚間查詢量最高，固定時段更新可減少重複詢問" },
  { title: "闢謠貼文：回應堤防潰堤傳言", why: "收件匣已有多則相關詢問，謠言擴散中" },
  { title: "置頂：災情通報與志工登記入口", why: "近 7 日觸及暴增，新訪客需要最快找到入口" },
  { title: "感謝貼文：志工與捐贈單位", why: "高互動內容，可維持社群動能與信任" },
];

/** Fake-but-plausible page metrics + inbox for the FB admin backend,
 * deterministic per incident. */
export function buildFbOps(incidentId: string): FbOps {
  const rng = makeRng(`fb:${incidentId}`);
  const followers = rng.int(4800, 32000);
  const reach7d = Array.from({ length: 7 }, (_, i) =>
    // reach ramps up hard after the disaster (day 4-5)
    Math.round(followers * (0.16 + rng.next() * 0.25) * (i >= 4 ? 3.4 : 1))
  );
  const reachSum = reach7d.reduce((s, v) => s + v, 0);
  let ago = rng.int(4, 25);
  const inbox: FbMessage[] = rng.sample(FB_INBOX_POOL, 12).map((m, i) => {
    const item: FbMessage = {
      ...m,
      author: rng.pick(FB_AUTHORS),
      agoMin: ago,
      replied: i >= 6, // oldest ones already handled
    };
    ago += rng.int(20, 150);
    return item;
  });
  return {
    followers,
    followerGrowth: rng.int(400, 2600),
    reach7d,
    pageViews: Math.round(reachSum * (0.2 + rng.next() * 0.15)),
    postEngagements: Math.round(reachSum * (0.05 + rng.next() * 0.06)),
    engagementRate: rng.int(6, 14),
    responseRate: rng.int(86, 98),
    responseTime: `${rng.int(8, 40)} 分鐘`,
    inbox,
    suggestions: rng.sample(FB_SUGGESTIONS, 3),
  };
}

export interface FbComment {
  author: string;
  text: string;
  likes: number;
  agoMin: number;
}

const FB_COMMENT_POOL = [
  "已分享，大家注意安全！",
  "請問這是最新消息嗎？",
  "感謝辛苦的救災人員 🙏",
  "住附近的朋友快看",
  "資訊很清楚，感謝整理",
  "需要志工的話我週末可以過去",
  "tag 一下住那邊的家人",
  "希望大家都平安",
  "終於有統一的資訊了，讚",
  "已通知里長，謝謝",
];

/** 2–3 top comments per published post, deterministic per artifact id. */
export function fbPostComments(postId: string): FbComment[] {
  const rng = makeRng(`fbcmt:${postId}`);
  return rng.sample(FB_COMMENT_POOL, rng.int(2, 3)).map((text) => ({
    author: rng.pick(FB_AUTHORS),
    text,
    likes: rng.int(2, 180),
    agoMin: rng.int(10, 700),
  }));
}

/** Per-post performance numbers, deterministic per artifact id. */
export function fbPostMetrics(postId: string): {
  reach: number; likes: number; comments: number; shares: number;
} {
  const rng = makeRng(`fbpost:${postId}`);
  const reach = rng.int(1200, 42000);
  return {
    reach,
    likes: Math.round(reach * (0.02 + rng.next() * 0.05)),
    comments: Math.round(reach * (0.004 + rng.next() * 0.01)),
    shares: Math.round(reach * (0.01 + rng.next() * 0.04)),
  };
}

export const OFFICIAL_LINKS = [
  { name: "中央氣象署", desc: "地震報告、颱風與豪雨特報", url: "https://www.cwa.gov.tw" },
  { name: "公路局即時路況", desc: "省道封閉與管制查詢", url: "https://168.thb.gov.tw" },
  { name: "台電停電查詢", desc: "停電範圍與搶修進度", url: "https://service.taipower.com.tw" },
  { name: "台灣自來水公司", desc: "停水公告與臨時取水點", url: "https://www.water.gov.tw" },
  { name: "內政部消防署", desc: "1991 報平安留言平台", url: "https://www.nfa.gov.tw" },
  { name: "衛福部", desc: "災害救助與心理支持資源", url: "https://www.mohw.gov.tw" },
];
