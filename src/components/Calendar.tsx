import { useMemo, useState } from "react";
import type { DayInfo } from "../types";
import DayCell from "./DayCell";
import DayDetail from "./DayDetail";

// ============================================================
// 月历卡片 — CC Switch 风格
// 圆角卡片 + 微阴影 + 7 列弹性布局
// ============================================================

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

interface CalendarProps {
  days: DayInfo[];
  month: string;
  onRefresh?: () => void; // 日报提交后通知刷新
}

export default function Calendar({ days, month, onRefresh }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dayMap = useMemo(() => {
    const m = new Map<string, DayInfo>();
    days.forEach((d) => m.set(d.date, d));
    return m;
  }, [days]);

  const calendarGrid = useMemo(() => {
    const [year, monthNum] = month.split("-").map(Number);
    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0);
    const totalDays = lastDay.getDate();

    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;

    const cells: (DayInfo | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const ds = `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push(dayMap.get(ds) || { date: ds, status: "future" as const, isWorkday: false, hasReport: false });
    }
    return cells;
  }, [month, dayMap]);

  const selectedDay = selectedDate ? dayMap.get(selectedDate) || null : null;

  return (
    <>
      <div style={s.card}>
        {/* 星期头 */}
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} style={s.weekdayHeader}>{label}</div>
        ))}
        {/* 日期格子 */}
        {calendarGrid.map((day, i) =>
          day ? (
            <DayCell key={day.date} day={day} isSelected={selectedDate === day.date} onClick={() => setSelectedDate(day.date)} />
          ) : (
            <div key={`e-${i}`} style={s.emptyCell} />
          ),
        )}
      </div>
      {selectedDay && <DayDetail day={selectedDay} onClose={() => setSelectedDate(null)} onSubmitted={onRefresh} />}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gridTemplateRows: "auto repeat(6, 1fr)",
    gap: 2,
    background: "var(--color-surface)",
    borderRadius: "var(--radius-lg)",
    padding: "12px 16px",
    boxShadow: "var(--shadow-md)",
    margin: "12px 20px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  weekdayHeader: {
    textAlign: "center",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-text-tertiary)",
    padding: "4px 0 6px",
    letterSpacing: "0.5px",
  },
  emptyCell: {
    background: "transparent",
    borderRadius: "var(--radius-sm)",
    minHeight: 0,
  },
};
