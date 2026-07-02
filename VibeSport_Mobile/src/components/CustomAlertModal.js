import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";
import { setAlertRef } from "../utils/CustomAlertService";

export default function CustomAlertModal() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [buttons, setButtons] = useState([]);
  const [options, setOptions] = useState(null);

  useEffect(() => {
    setAlertRef({
      show: (t, m, b, o) => {
        setTitle(t || "");
        setMessage(m || "");
        setButtons(b || []);
        setOptions(o || null);
        setVisible(true);
      },
    });
    return () => setAlertRef(null);
  }, []);

  const handleDismiss = () => {
    if (options?.cancelable !== false) {
      setVisible(false);
    }
  };

  const handleButtonPress = (onPress) => {
    setVisible(false);
    if (onPress) {
      onPress();
    }
  };

  const renderButtons = () => {
    if (!buttons || buttons.length === 0) {
      return (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => setVisible(false)}
          >
            <Text style={styles.confirmButtonText}>Đồng ý</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (buttons.length <= 2) {
      // Show horizontally (mockup style)
      // Reverse buttons order if we want Hủy on the left, Đồng ý on the right.
      // Often React Native sets cancel style or first item as cancel. Let's arrange them based on style.
      // Usually, cancel style goes on the left (first), confirm on the right (last).
      const sortedButtons = [...buttons].sort((a, b) => {
        if (a.style === "cancel") return -1;
        if (b.style === "cancel") return 1;
        return 0;
      });

      return (
        <View style={styles.buttonRow}>
          {sortedButtons.map((btn, index) => {
            const isCancel = btn.style === "cancel";
            const isDestructive = btn.style === "destructive";

            let btnStyle = styles.confirmButton;
            let textStyle = styles.confirmButtonText;

            if (isCancel) {
              btnStyle = styles.cancelButton;
              textStyle = styles.cancelButtonText;
            } else if (isDestructive) {
              btnStyle = [styles.confirmButton, styles.destructiveButton];
              textStyle = styles.confirmButtonText;
            }

            return (
              <TouchableOpacity
                key={index}
                style={btnStyle}
                onPress={() => handleButtonPress(btn.onPress)}
              >
                <Text style={textStyle}>{btn.text}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    // Stack vertically for 3+ buttons
    return (
      <View style={styles.buttonCol}>
        {buttons.map((btn, index) => {
          const isCancel = btn.style === "cancel";
          const isDestructive = btn.style === "destructive";

          let btnStyle = styles.verticalConfirmButton;
          let textStyle = styles.verticalConfirmButtonText;

          if (isCancel) {
            btnStyle = styles.verticalCancelButton;
            textStyle = styles.verticalCancelButtonText;
          } else if (isDestructive) {
            btnStyle = [styles.verticalConfirmButton, styles.destructiveButton];
            textStyle = styles.verticalConfirmButtonText;
          }

          return (
            <TouchableOpacity
              key={index}
              style={btnStyle}
              onPress={() => handleButtonPress(btn.onPress)}
            >
              <Text style={textStyle}>{btn.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <TouchableWithoutFeedback onPress={handleDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.alertBox}>
              <Text style={styles.title}>{title}</Text>
              {message ? <Text style={styles.message}>{message}</Text> : null}
              {renderButtons()}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)", // Slate overlay
    justifyContent: "center",
    alignItems: "center",
  },
  alertBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "82%",
    maxWidth: 340,
    shadowColor: "#0f172a",
    shadowOpacity: 0.15,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
  },
  buttonCol: {
    flexDirection: "column",
    gap: 8,
    width: "100%",
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b", // Black cancel text
  },
  confirmButton: {
    backgroundColor: "#0b74ff", // Blue confirm button background
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  destructiveButton: {
    backgroundColor: "#dc2626", // Red destructive solid
  },
  verticalConfirmButton: {
    backgroundColor: "#0b74ff", // Blue vertical confirm button background
    borderRadius: 12,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  verticalConfirmButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  verticalCancelButton: {
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  verticalCancelButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b", // Black vertical cancel text
  },
});
