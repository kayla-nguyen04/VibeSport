import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";

export default function MyTeamsScreen() {
  return (
    <Screen style={styles.container}>
      <ScreenHeader style={styles.screenHeader}>
        <Text style={styles.headerTitle}>Đội</Text>
      </ScreenHeader>
      <View style={styles.content}>
        <Text style={styles.text}>Chức năng đang được phát triển</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  screenHeader: {
    paddingTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
    textAlign: "center",
  },
});
