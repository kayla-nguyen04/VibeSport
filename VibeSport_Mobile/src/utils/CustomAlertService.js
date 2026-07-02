import { Alert } from "react-native";

let alertRef = null;
const originalAlert = Alert.alert;

export const setAlertRef = (ref) => {
  alertRef = ref;
};

export const customAlert = (title, message, buttons, options) => {
  if (alertRef) {
    alertRef.show(title, message, buttons, options);
  } else {
    // Fallback to original React Native Alert if custom modal is not mounted yet
    originalAlert(title, message, buttons, options);
  }
};

// Global override registration helper
export const initCustomAlert = () => {
  Alert.alert = customAlert;
};
