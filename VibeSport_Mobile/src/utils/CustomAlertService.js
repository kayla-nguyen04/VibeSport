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
    originalAlert(title, message, buttons, options);
  }
};

export const initCustomAlert = () => {
  Alert.alert = customAlert;
};
