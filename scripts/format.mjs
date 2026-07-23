export function formatManwon(value) {
  if (value == null || Number.isNaN(value) || value === 0) return "정보없음";
  const eok = Math.floor(value / 10000);
  const man = value % 10000;
  const parts = [];
  if (eok > 0) parts.push(`${eok}억`);
  if (man > 0) parts.push(`${man.toLocaleString("ko-KR")}만원`);
  return parts.length > 0 ? parts.join(" ") : "0원";
}

export function pyeong(record) {
  if (record["공급면적평수"] != null) return record["공급면적평수"];
  if (record["공급면적"] != null) return Math.round(record["공급면적"] / 3.3058);
  return "-";
}

export function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd ?? "-";
  return `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}`;
}
