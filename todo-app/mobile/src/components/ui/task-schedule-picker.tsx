import { useState } from "react";
import { addDays, addMonths, format, isSameDay, isSameMonth, startOfMonth } from "date-fns";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/providers/theme-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { applyScheduleTime, readScheduleDate, scheduleCalendarDays, selectScheduleDay, validScheduleTime } from "@/lib/utils/task-schedule";
import { Button } from "./button";
import { Input } from "./input";
import { SelectionLed } from "./selection-led";
import { tactileSurface } from "./tactile";

export function TaskSchedulePicker({ value, onChange, dateLocked = false, now = new Date() }: {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Creation from a calendar day already supplies the date; only edit its time. */
  dateLocked?: boolean;
  now?: Date;
}) {
  const { theme: { colors: c, scheme } } = useTheme();
  const { calendarWeekStart } = usePreferences();
  const [wide, setWide] = useState(false);
  const due = readScheduleDate(value);
  const timeOnly = dateLocked && due !== null;
  const [month, setMonth] = useState(() => startOfMonth(due ?? now));
  const days = scheduleCalendarDays(month, calendarWeekStart);
  const endOfDay = due?.getHours() === 23 && due.getMinutes() === 59;
  const chooseDay = (day: Date) => {
    onChange(selectScheduleDay(day, due));
    setMonth(startOfMonth(day));
  };
  const weekdays = calendarWeekStart === 1 ? ["M", "T", "W", "T", "F", "S", "S"] : ["S", "M", "T", "W", "T", "F", "S"];

  const shortcuts = [{ label: "Today", day: now }, { label: "Tomorrow", day: addDays(now, 1) }, { label: "+1 week", day: addDays(now, 7) }];
  return <View testID="task-schedule-picker" onLayout={(event) => setWide(event.nativeEvent.layout.width >= 560)} style={[styles.root, timeOnly && styles.timeOnlyRoot, { borderColor: c.border, backgroundColor: c.card }]}>
    <View style={[styles.content, wide && !timeOnly && styles.wideContent]}>
    {!timeOnly ? <View testID="schedule-calendar" style={[styles.calendar, wide && styles.wideCalendar]}>
      <View style={styles.monthHeading}>
        <View style={styles.monthCopy}><Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[styles.monthTitle, { color: c.foreground }]}>{format(month, "MMMM yyyy")}</Text><Text style={[styles.hint, { color: c.mutedForeground }]}>Choose a deadline</Text></View>
        <View style={styles.monthNavigation}>{[{ delta: -1, label: "Previous picker month", glyph: "‹" }, { delta: 1, label: "Next picker month", glyph: "›" }].map(({ delta, label, glyph }) => <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} onPress={() => setMonth(addMonths(month, delta))} style={({ pressed }) => [styles.monthArrow, { opacity: pressed ? 0.5 : 1 }]}><View pointerEvents="none" style={[styles.arrowFace, { borderColor: c.border }]}><Text style={[styles.arrow, { color: c.foreground }]}>{glyph}</Text></View></Pressable>)}</View>
      </View>
      <View style={styles.dateShortcuts}>{shortcuts.map(({ label, day }) => {
        const selected = Boolean(due && isSameDay(day, due));
        return <Pressable key={label} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} aria-pressed={selected} onPress={() => chooseDay(day)} style={({ pressed }) => [styles.dateShortcut, { backgroundColor: selected ? c.cardElevated : c.secondary, borderColor: c.border }, tactileSurface({ pressed, selected, dark: scheme === "dark" })]}><Text style={[styles.dateShortcutText, { color: c.foreground }]}>{label}</Text><SelectionLed selected={selected} /></Pressable>;
      })}</View>
      <View style={styles.weekdays}>{weekdays.map((label, index) => <Text key={index} style={[styles.weekday, { color: c.mutedForeground }]}>{label}</Text>)}</View>
      <View style={styles.grid}>{days.map((day) => {
        const selected = Boolean(due && isSameDay(day, due));
        const today = isSameDay(day, now);
        return <Pressable key={day.toISOString()} accessibilityRole="button" accessibilityLabel={`Choose ${format(day, "EEEE, MMMM d, yyyy")}`} accessibilityHint={today ? "Today" : undefined} accessibilityState={{ selected }} aria-pressed={selected} onPress={() => chooseDay(day)} style={({ pressed }) => [styles.day, { opacity: isSameMonth(day, month) ? 1 : 0.38, backgroundColor: selected ? c.secondary : pressed ? c.cardElevated : "transparent", borderColor: selected ? c.borderStrong : "transparent" }]}>
          <Text style={[styles.dayText, { color: today && !selected ? c.success : c.foreground }]}>{format(day, "d")}</Text>
          {selected ? <SelectionLed selected /> : null}
        </Pressable>;
      })}</View>
    </View> : null}
    <View style={[styles.timeColumn, wide && !timeOnly && styles.wideTimeColumn]}><ScheduleTimePanel key={value ?? "unscheduled"} date={due} onApply={onChange} showTitle={!timeOnly} /></View>
    </View>
    <View style={[styles.summary, { borderColor: c.border }]}><Text accessibilityLiveRegion="polite" style={[styles.hint, styles.flex, { color: c.mutedForeground }]}>{due ? `${format(due, "EEE, d MMM yyyy")} · ${endOfDay ? "End of day" : format(due, "HH:mm")}` : "No deadline · choose a day above"}</Text>{due && !timeOnly ? <Button label="Remove" variant="ghost" accessibilityLabel="Clear due date" onPress={() => onChange(null)} /> : null}</View>
  </View>;
}

function ScheduleTimePanel({ date, onApply, showTitle = true }: { date: Date | null; onApply: (value: string) => void; showTitle?: boolean }) {
  const { theme: { colors: c } } = useTheme();
  const [hour, setHour] = useState(date ? format(date, "HH") : "");
  const [minute, setMinute] = useState(date ? format(date, "mm") : "");
  const [error, setError] = useState(false);
  const valid = validScheduleTime(hour, minute);
  const apply = () => {
    if (!date) return;
    const next = applyScheduleTime(date, hour, minute);
    if (!next) { setError(true); return; }
    onApply(next);
  };
  return <View testID="schedule-time-panel" style={[styles.panel, { borderColor: c.border, backgroundColor: c.input }]}>
    {showTitle ? <Text accessibilityRole="header" style={[styles.monthTitle, { color: c.foreground }]}>Time</Text> : null}
    <Text style={[styles.hint, { color: c.mutedForeground }]}>{date ? "Optional · 24-hour time" : "Choose a date to add a time"}</Text>
    <View style={styles.timeFields}>
      <View style={styles.timeField}><Text style={[styles.caption, { color: c.mutedForeground }]}>HOUR</Text><Input accessibilityLabel="Due hour" accessibilityHint="0 to 23" editable={Boolean(date)} placeholder="—" inputMode="numeric" maxLength={2} value={hour} onChangeText={(text) => { setHour(text.replace(/\D/g, "")); setError(false); }} onSubmitEditing={apply} selectTextOnFocus style={styles.timeInput} /></View>
      <Text style={[styles.colon, { color: c.mutedForeground }]}>:</Text>
      <View style={styles.timeField}><Text style={[styles.caption, { color: c.mutedForeground }]}>MINUTE</Text><Input accessibilityLabel="Due minute" accessibilityHint="0 to 59" editable={Boolean(date)} placeholder="—" inputMode="numeric" maxLength={2} value={minute} onChangeText={(text) => { setMinute(text.replace(/\D/g, "")); setError(false); }} onSubmitEditing={apply} selectTextOnFocus style={styles.timeInput} /></View>
    </View>
    {date && (!valid || error) ? <Text accessibilityLiveRegion="polite" style={[styles.hint, { color: c.destructive }]}>{error && valid ? "This time does not exist on this date." : "Use an hour from 0–23 and minutes from 0–59."}</Text> : null}
    <View style={styles.shortcuts}>{[["Morning", "09", "00"], ["Afternoon", "14", "00"], ["End of day", "23", "59"]].map(([label, h, m]) => <Button key={label} variant="secondary" label={label} disabled={!date} onPress={() => { setHour(h); setMinute(m); setError(false); }} style={styles.shortcut} />)}</View>
    <Button variant="secondary" label="Apply time" disabled={!date || !valid} onPress={apply} />
    <Text style={[styles.hint, { color: c.mutedForeground }]}>Dates default to 23:59 until you apply a specific time.</Text>
  </View>;
}

const styles = StyleSheet.create({
  root: { marginTop: 6, padding: 12, borderRadius: 14, borderWidth: 1, gap: 14 },
  timeOnlyRoot: { maxWidth: 420, width: "100%" },
  content: { gap: 20 },
  wideContent: { flexDirection: "row", alignItems: "flex-start" },
  calendar: { minWidth: 0, gap: 10 },
  wideCalendar: { flex: 1 },
  timeColumn: { minWidth: 0 },
  wideTimeColumn: { width: 220 },
  caption: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  panel: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 12 },
  monthHeading: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 3 },
  monthCopy: { flex: 1, minWidth: 0, gap: 4 },
  monthTitle: { fontSize: 15, fontWeight: "700" },
  hint: { fontSize: 11, lineHeight: 16 },
  monthNavigation: { flexDirection: "row", alignItems: "center" },
  monthArrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  arrowFace: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  arrow: { fontSize: 22, lineHeight: 24, fontWeight: "400" },
  dateShortcuts: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, paddingBottom: 4 },
  dateShortcut: { flex: 1, minWidth: 72, minHeight: 44, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dateShortcutText: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  shortcuts: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 4 },
  shortcut: { flexGrow: 1, paddingHorizontal: 8, borderRadius: 9 },
  weekdays: { flexDirection: "row" },
  weekday: { width: "14.2857%", textAlign: "center", fontSize: 10, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  day: { width: "14.2857%", height: 44, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 12, fontWeight: "600" },
  summary: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, paddingTop: 8, minHeight: 44 },
  flex: { flex: 1, minWidth: 0 },
  timeFields: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 6 },
  timeField: { flex: 1, maxWidth: 100, gap: 6 },
  timeInput: { height: 60, fontSize: 28, fontWeight: "600", textAlign: "center", borderRadius: 12 },
  colon: { fontSize: 26, paddingTop: 14 },
});
