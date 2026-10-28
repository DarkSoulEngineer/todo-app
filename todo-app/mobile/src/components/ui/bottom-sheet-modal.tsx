import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/providers/theme-provider";
import { mobileModalMaxWidth } from "@/theme/layout";

const OPEN_MS = 280;
const CLOSE_MS = 220;
const BACKDROP_IN_MS = 200;
const BACKDROP_OUT_MS = 160;
const WEB_DRAG_STYLE: ViewStyle & { touchAction: "none" } = { touchAction: "none" };

export function BottomSheetModal({
  visible,
  onClose,
  children,
  style,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(visible);
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(Math.max(windowHeight, 480)));
  const [dragY] = useState(() => new Animated.Value(0));
  const sheetHeightRef = useRef(windowHeight);
  const closingRef = useRef(false);
  const heightRef = useRef(Math.max(windowHeight, 480));
  const useNativeDriver = Platform.OS !== "web";
  const requestClose = useCallback(() => {
    if (!visible || closingRef.current) return;
    closingRef.current = true;
    Keyboard.dismiss();
    onClose();
  }, [onClose, visible]);
  const swipe = useMemo(() => {
    const snapBack = () => Animated.spring(dragY, { toValue: 0, tension: 140, friction: 18, useNativeDriver }).start();
    // PanResponder stores these callbacks; refs are read only when a gesture fires.
    // eslint-disable-next-line react-hooks/refs
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gesture) => visible && !closingRef.current && gesture.numberActiveTouches === 1 && gesture.dy > 6 && gesture.dy > Math.abs(gesture.dx) * 1.2,
      onPanResponderGrant: () => { Keyboard.dismiss(); dragY.stopAnimation(); },
      onPanResponderMove: (_, gesture) => {
        if (visible && !closingRef.current) dragY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        const distance = Math.min(96, Math.max(48, sheetHeightRef.current * 0.25));
        if (gesture.dy >= distance || (gesture.dy > 24 && gesture.vy > 0.9)) requestClose();
        else snapBack();
      },
      onPanResponderTerminate: snapBack,
      onPanResponderTerminationRequest: () => false,
    });
  }, [dragY, requestClose, useNativeDriver, visible]);

  useEffect(() => {
    heightRef.current = windowHeight;
  }, [windowHeight]);

  useEffect(() => {
    // Keep the sheet mounted until its exit animation finishes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (visible) setRendered(true);
  }, [visible]);

  useEffect(() => {
    if (!rendered) return;

    const offscreenY = Math.max(heightRef.current, 480);

    if (visible) {
      closingRef.current = false;
      dragY.stopAnimation();
      dragY.setValue(0);
      backdropOpacity.setValue(0);
      translateY.setValue(offscreenY);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: BACKDROP_IN_MS,
          useNativeDriver,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: OPEN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: BACKDROP_OUT_MS,
          useNativeDriver,
        }),
        Animated.timing(translateY, {
          toValue: offscreenY,
          duration: CLOSE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver,
        }),
      ]).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }

    return () => {
      backdropOpacity.stopAnimation();
      translateY.stopAnimation();
      dragY.stopAnimation();
    };
  }, [backdropOpacity, dragY, rendered, translateY, useNativeDriver, visible]);

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </Animated.View>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
          pointerEvents={visible ? "auto" : "none"}
          style={styles.keyboard}
        >
          <Animated.View
            testID="bottom-sheet-surface"
            onLayout={(event) => { sheetHeightRef.current = event.nativeEvent.layout.height; }}
            style={[
              styles.sheet,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                borderTopLeftRadius: theme.radius.xl,
                borderTopRightRadius: theme.radius.xl,
                shadowColor: theme.colors.shadow,
              },
              style,
              { transform: [{ translateY: Animated.add(translateY, dragY) }] },
            ]}
          >
            <View testID="bottom-sheet-drag-handle" {...swipe.panHandlers} style={[styles.dragArea, Platform.OS === "web" && WEB_DRAG_STYLE]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" accessibilityHint="Drag down or activate to close" onPress={requestClose} style={styles.handleButton}>
                <View pointerEvents="none" style={[styles.handle, { backgroundColor: theme.colors.borderStrong }]} />
              </Pressable>
            </View>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dragArea: { flexShrink: 0 },
  handleButton: { height: 44, alignItems: "center", justifyContent: "center" },
  handle: { width: 42, height: 4, borderRadius: 2 },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  keyboard: {
    width: "100%",
    maxWidth: mobileModalMaxWidth,
    maxHeight: "92%",
    alignSelf: "center",
  },
  sheet: {
    width: "100%",
    maxHeight: "100%",
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
});
