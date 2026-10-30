import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";
import { useToast } from "@/providers/toast-provider";

export function NotificationPanel({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme: { colors: c } } = useTheme();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { notifications, markNotificationsRead, dismissNotification, clearNotifications, runNotificationAction } = useToast();
  const panelWidth = Math.min(420, Math.max(0, width - insets.left - insets.right - 24));
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    if (visible) markNotificationsRead();
  }, [markNotificationsRead, visible]);

  return <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" statusBarTranslucent onRequestClose={onClose}>
    <View style={[styles.overlay, { paddingRight: insets.right }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close notifications" onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} />
      <View accessibilityViewIsModal testID="board-notification-panel" style={[styles.panel, { width: panelWidth, height, backgroundColor: c.card, borderColor: c.border, shadowColor: c.shadow }]}>
        <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: c.border }]}>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: c.foreground }]}>Notifications</Text>
            <Text style={[styles.count, { color: c.mutedForeground }]}>{unreadCount ? `${unreadCount} unread` : "This board"}</Text>
          </View>
          {notifications.length ? <Pressable accessibilityRole="button" accessibilityLabel="Clear all notifications" onPress={clearNotifications} style={styles.headerAction}>
            <Text style={{ color: c.primary, fontSize: 12, fontWeight: "700" }}>Clear all</Text>
          </Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Close notifications panel" onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={20} color={c.mutedForeground} />
          </Pressable>
        </View>
        {notifications.length ? <ScrollView contentContainerStyle={[styles.list, { paddingBottom: 12 + insets.bottom }]} showsVerticalScrollIndicator>
          {notifications.map((notification) => {
            const tone = notification.tone === "error" ? c.destructive : notification.tone === "success" ? c.success : c.primary;
            return <View key={notification.id} style={[styles.item, { backgroundColor: c.backgroundAlt, borderColor: c.border }]}>
              <View style={[styles.dot, { backgroundColor: tone }]} />
              <View style={styles.copy}>
                <Text style={[styles.message, { color: c.foreground }]}>{notification.message}</Text>
                {notification.description ? <Text style={[styles.description, { color: c.mutedForeground }]}>{notification.description}</Text> : null}
              </View>
              {notification.action ? <Pressable accessibilityRole="button" accessibilityLabel={`${notification.action.label}: ${notification.message}`} onPress={() => runNotificationAction(notification.id)} style={[styles.action, { backgroundColor: c.primarySoft }]}>
                <Text style={{ color: c.primary, fontSize: 12, fontWeight: "700" }}>{notification.action.label}</Text>
              </Pressable> : null}
              <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss notification: ${notification.message}`} onPress={() => dismissNotification(notification.id)} hitSlop={6} style={styles.dismiss}>
                <Ionicons name="close" size={16} color={c.mutedForeground} />
              </Pressable>
            </View>;
          })}
        </ScrollView> : <View style={styles.empty}>
          <Ionicons name="checkmark-done-outline" size={28} color={c.mutedForeground} />
          <Text style={[styles.emptyText, { color: c.mutedForeground }]}>No notifications for this board.</Text>
        </View>}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row", justifyContent: "flex-end", alignItems: "center" },
  panel: { maxWidth: "100%", overflow: "hidden", borderWidth: 1, borderRadius: 0, shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 18 },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flex: 1, gap: 2 },
  title: { fontSize: 18, fontWeight: "700" },
  count: { fontSize: 11 },
  headerAction: { minHeight: 40, justifyContent: "center", paddingHorizontal: 4 },
  closeButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  list: { gap: 8, padding: 12 },
  item: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11, paddingVertical: 9, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  message: { fontSize: 13, fontWeight: "600" },
  description: { fontSize: 11, lineHeight: 15 },
  action: { minHeight: 38, justifyContent: "center", paddingHorizontal: 11, borderRadius: 9 },
  dismiss: { width: 34, height: 38, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  emptyText: { fontSize: 13, textAlign: "center" },
});
