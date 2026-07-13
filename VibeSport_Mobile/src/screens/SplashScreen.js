import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen } from "../components/Screen";

export function SplashScreen({ onNavigateToRegister, onNavigateToLogin }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <LinearGradient colors={["#0e1726", "#1a0d0e"]} style={styles.gradient}>
      <Screen style={styles.container}>
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.logoContainer,
              { transform: [{ scale: scaleAnim }], opacity: fadeAnim },
            ]}
          >
            <View style={styles.logoCircle}>
              <Image
                resizeMode="contain"
                source={require("../../assets/logo_vibesport_icon.png")}
                style={styles.logoImage}
              />
            </View>
            <Text style={styles.logoSubtext}>KẾT NỐI ĐAM MÊ THỂ THAO</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.textContainer,
              { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
            ]}
          >
            <Text style={styles.title}>
              Tìm người chơi{"\n"}cùng{" "}
              <Text style={styles.highlightText}>đam mê</Text> với bạn
            </Text>
            <Text style={styles.subtitle}>
              Bóng đá · Cầu lông · Pickleball{"\n"}và nhiều môn thể thao khác
            </Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.tagContainer,
              { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
            ]}
          >
            <View style={styles.row}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>⚽ Bóng đá</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>🎾 Cầu lông</Text>
              </View>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>🏓 Pickleball</Text>
            </View>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.buttonContainer,
            { transform: [{ translateY: slideAnim }], opacity: fadeAnim },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onNavigateToRegister}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Tạo tài khoản miễn phí</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onNavigateToLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>
              Đã có tài khoản? Đăng nhập
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Screen>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 30,
  },

  logoImage: {
    width: 120,
    height: 120,
  },
  logoSubtext: {
    color: "#8f9cae",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 2,
    marginTop: 20,
    textAlign: "center",
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 30,
    width: "100%",
  },
  title: {
    color: "#ffffff",
    fontSize: 35,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 16,
  },
  highlightText: {
    color: "#e14d2a",
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  tagContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 5,
  },
  tagText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  buttonContainer: {
    paddingBottom: 36,
    width: "85%",
    alignSelf: "center",
  },
  primaryButton: {
    backgroundColor: "#e14d2a",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    width: "100%",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
