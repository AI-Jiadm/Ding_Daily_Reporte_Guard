import { useMemo, useState } from "react";
import type { DayInfo } from "../types";
import DayCell from "./DayCell";
import DayDetail from "./DayDetail";

// ============================================================
// 月历组件
// 显示当月日历网格，每个日期单元格用颜色标记日报状态
// ============================================================

const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

interface CalendarProps {
  days: DayInfo[];
  month: string; // 'YYYY-MM'
}

export default function Calendar({ days, month }: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 构建日期查找表
  const dayMap = useMemo(() => {
    const map = new Map<string, DayInfo>();
    days.forEach((d) => map.set(d.date, d));
    return map;
  }, [days]);

  // 生成日历网格
  const calendarGrid = useMemo(() => {
    const [year, monthNum] = month.split("-").map(Number);
    const firstDay = new Date(year, monthNum - 1, 1);
    const lastDay = new Date(year, monthNum, 0);
    const totalDays = lastDay.getDate();

    // 第一天是周几（0=周日, 1=周一...）
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // 转为周一=0

    const cells: (DayInfo | null)[] = [];

    // 填充前面的空白
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(null);
    }

    // 填充日期
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayInfo = dayMap.get(dateStr) || null;
      cells.push(dayInfo || {
        date: dateStr,
        status: "future",
        isWorkday: false,
        hasReport: false,
      });
    }

    return cells;
  }, [month, dayMap]);

  const selectedDay = selectedDate ? dayMap.get(selectedDate) || null : null;

  return (
    <>
      <div style={styles.calendar}>
        {/* 星期头 */}
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} style={styles.weekdayHeader}>
            {label}
          </div>
        ))}

        {/* 日期格子 */}
        {calendarGrid.map((day, i) =>
          day ? (
            <DayCell
              key={day.date}
              day={day}
              isSelected={selectedDate === day.date}
              onClick={() => setSelectedDate(day.date)}
            />
          ) : (
            <div key={`empty-${i}`} style={styles.emptyCell} />
          ),
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedDay && (
        <DayDetail day={selectedDay} onClose={() => setSelectedDate(null)} />
      )}
    </>
  );
}

// ============================================================
// 内联样式
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  calendar: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    marginBottom: 16,
  },
  weekdayHeader: {
    textAlign: "center",
    fontSize: 13,
    fontWeight: 600,
    color: "#999",
    padding: "8px 0",
  },
  emptyCell: {
    aspectRatio: "1",
    background: "transparent",
    borderRadius: 8,
  },
};
