import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
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
  const heightRef = useRef(Math.max(windowHeight, 480));
  const useNativeDriver = Platform.OS !== "web";

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
    };
  }, [backdropOpacity, rendered, translateY, useNativeDriver, visible]);

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {
        if (visible) onClose();
      }}
    >
      <View style={styles.overlay}>
        <Animated.View
          pointerEvents="box-none"
          style={[StyleSheet.absoluteFill, { opacity: backdropOpacity }]}
        >
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
            onPress={() => {
              if (visible) onClose();
            }}
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
              { transform: [{ translateY }] },
            ]}
          >
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
