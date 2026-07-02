// Shared rescue-portal constants — kept free of Leaflet so they can be
// imported on the server (the map component itself is client-only).

export const NEED_LABEL: Record<string, string> = {
  flooding: "淹水",
  mud_removal: "清淤",
  road_blocked: "道路中斷",
  power_outage: "停電",
  building_collapse: "建物倒塌",
  fire: "火災",
  gas_leak: "瓦斯外洩",
  trapped_person: "受困待救",
  missing_person: "失聯協尋",
  medical_need: "醫療需求",
  supply_need: "物資需求",
  other: "其他需求",
};

export const PRIORITY: Record<string, { c: string; label: string }> = {
  critical: { c: "#dc2626", label: "危急" },
  high: { c: "#ea580c", label: "高" },
  normal: { c: "#d97706", label: "一般" },
  medium: { c: "#d97706", label: "中" },
  low: { c: "#16a34a", label: "低" },
};

export const SCENARIO_LABEL: Record<string, string> = {
  barrier_lake: "堰塞湖災害",
  earthquake: "震災",
  typhoon: "颱風災害",
  flood: "水災",
};

export const REPORT_STATUS_LABEL: Record<string, string> = {
  new: "待處理",
  triaged: "已分流",
  in_progress: "處理中",
  resolved: "已結案",
  archived: "已歸檔",
};

export const SUPPLY_COLOR = "#b45309";
export const VOLUNTEER_COLOR = "#047857";
export const SHELTER_COLOR = "#1d4ed8";
export const MEDICAL_COLOR = "#be123c";
