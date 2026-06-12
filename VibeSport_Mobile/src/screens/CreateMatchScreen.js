import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector } from "react-redux";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";

import { createMatch, updateMatch, deleteMatch } from "../services/matchService";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";

const parseDateString = (dateStr) => {
  if (!dateStr) return new Date();
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date();
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
};

const DEFAULT_POSITIONS = [
  { key: "goalkeeper", label: "Thủ môn", icon: "🧤", quantity: 1 },
  { key: "defender", label: "Hậu vệ", icon: "🛡️", quantity: 2 },
  { key: "midfielder", label: "Tiền vệ", icon: "👟", quantity: 1 },
  { key: "striker", label: "Tiền đạo", icon: "⚡", quantity: 1 },
];

const MAX_COST_PER_PERSON = 1000000;

const SPORT_LIMITS = {
  football: {
    maxPlayers: 10,
    maxPlayersHint: "Tối đa 10 người (5v5) • Ví dụ: 5v5 → 10 người",
  },
  badminton: {
    maxPlayers: 4,
    maxPlayersHint: "Tối đa 4 người (đánh đôi) • Đánh đơn 2 người",
  },
  pickleball: {
    maxPlayers: 4,
    maxPlayersHint: "Tối đa 4 người (đánh đôi) • Đánh đơn 2 người",
  },
};

export default function CreateMatchScreen({ navigation, route }) {
  const user = useSelector((state) => state.auth.user);
  const editMatch = route?.params?.editMatch ?? null;
  const isEditMode = !!editMatch;

  const [sport, setSport] = useState(editMatch?.sport || "football");
  const [title, setTitle] = useState(editMatch?.title || "");
  const [selectedDate, setSelectedDate] = useState(
    editMatch?.date ? parseDateString(editMatch.date) : new Date()
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(editMatch?.startTime || "19:00");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(
    editMatch?.maxPlayers ? String(editMatch.maxPlayers) : "10"
  );
  const [costPerPerson, setCostPerPerson] = useState(
    editMatch?.costPerPerson ? String(editMatch.costPerPerson) : ""
  );
  const [locationName, setLocationName] = useState(editMatch?.locationName || "");
  const [locationCoords, setLocationCoords] = useState(
    editMatch?.location?.lat != null
      ? { lat: editMatch.location.lat, lng: editMatch.location.lng }
      : null
  );
  const [note, setNote] = useState(editMatch?.note || "");

  // Format helpers
  const formatDate = (d) => {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getTimeLabel = (val) => {
    if (!val) return "";
    const parts = val.split(":");
    if (parts.length < 2) return val;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return val;
    const period = h >= 12 ? "CH" : "SA";
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const mm = String(m).padStart(2, "0");
    return `${dh}:${mm} ${period}`;
  };

  // Picker handlers
  const onDateChange = (event, date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && date) {
      setSelectedDate(date);
    }
  };

  const onTimeChange = (event, date) => {
    if (Platform.OS === "android") {
      setShowTimePicker(false);
    }
    if (event.type === "set" && date) {
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      setSelectedTimeSlot(`${hh}:${mm}`);
    }
  };

  const getTimeDate = (timeStr) => {
    const [h, m] = (timeStr || "19:00").split(":").map(Number);
    const d = new Date();
    d.setHours(h ?? 19, m ?? 0, 0, 0);
    return d;
  };

  const [positionsNeeded, setPositionsNeeded] = useState(
    editMatch?.positionsNeeded?.length ? editMatch.positionsNeeded : DEFAULT_POSITIONS
  );

  const buildFormDraft = useCallback(
    () => ({
      sport,
      title,
      selectedDate: selectedDate.toISOString(),
      selectedTimeSlot,
      maxPlayers,
      costPerPerson,
      note,
      positionsNeeded,
      locationName,
      locationCoords,
    }),
    [
      sport,
      title,
      selectedDate,
      selectedTimeSlot,
      maxPlayers,
      costPerPerson,
      note,
      positionsNeeded,
      locationName,
      locationCoords,
    ]
  );

  const applyFormDraft = useCallback((draft) => {
    if (!draft) return;
    if (draft.sport) setSport(draft.sport);
    if (draft.title != null) setTitle(draft.title);
    if (draft.selectedDate) setSelectedDate(new Date(draft.selectedDate));
    if (draft.selectedTimeSlot) setSelectedTimeSlot(draft.selectedTimeSlot);
    if (draft.maxPlayers != null) setMaxPlayers(String(draft.maxPlayers));
    if (draft.costPerPerson != null) setCostPerPerson(String(draft.costPerPerson));
    if (draft.note != null) setNote(draft.note);
    if (draft.positionsNeeded?.length) setPositionsNeeded(draft.positionsNeeded);
    if (draft.locationName != null) setLocationName(draft.locationName);
    if (draft.locationCoords) setLocationCoords(draft.locationCoords);
  }, []);

  // Khôi phục form khi quay lại từ MapPicker (tránh mất dữ liệu đã nhập)
  useFocusEffect(
    useCallback(() => {
      const draft = route?.params?.formDraft;
      const loc = route?.params?.selectedLocation;

      if (draft || loc) {
        if (draft) applyFormDraft(draft);
        if (loc) {
          setLocationName(loc.address || "");
          setLocationCoords({ lat: loc.lat, lng: loc.lng });
        }
        navigation.setParams({ formDraft: undefined, selectedLocation: undefined });
      }
    }, [applyFormDraft, navigation, route?.params?.formDraft, route?.params?.selectedLocation])
  );

  const sports = [
    { key: "football", label: "Bóng đá", icon: "⚽" },
    { key: "badminton", label: "Cầu lông", icon: "🏸" },
    { key: "pickleball", label: "Pickleball", icon: "🏓" },
  ];

  const handleSelectSport = (selectedSport) => {
    setSport(selectedSport);

    if (selectedSport === "football") {
      setMaxPlayers("10");
      setPositionsNeeded(DEFAULT_POSITIONS);
    } else {
      setMaxPlayers("2");
    }
  };

  const sportLimits = SPORT_LIMITS[sport] || SPORT_LIMITS.football;

  const handleMaxPlayersChange = (text) => {
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits) {
      setMaxPlayers("");
      return;
    }
    const num = parseInt(digits, 10);
    setMaxPlayers(String(Math.min(num, sportLimits.maxPlayers)));
  };

  const handleCostChange = (text) => {
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits) {
      setCostPerPerson("");
      return;
    }
    const num = parseInt(digits, 10);
    setCostPerPerson(String(Math.min(num, MAX_COST_PER_PERSON)));
  };

  const increasePosition = (key) => {
    setPositionsNeeded((prev) =>
      prev.map((item) =>
        item.key === key
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decreasePosition = (key) => {
    setPositionsNeeded((prev) =>
      prev.map((item) =>
        item.key === key && item.quantity > 0
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
  };

  const buildPayload = () => ({
    sport,
    title: title.trim(),
    date: formatDate(selectedDate),
    startTime: selectedTimeSlot,
    maxPlayers: Number(maxPlayers),
    positionsNeeded: sport === "football" ? positionsNeeded : [],
    costPerPerson: Number(costPerPerson || 0),
    locationName: locationName.trim(),
    location: {
      lat: locationCoords?.lat || null,
      lng: locationCoords?.lng || null,
      address: locationName.trim(),
    },
    note: note.trim(),
    ...(isEditMode ? {} : { createdBy: user?.id || user?._id || null }),
  });

  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên trận đấu");
      return false;
    }
    if (!selectedDate) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn ngày");
      return false;
    }
    if (!selectedTimeSlot) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn giờ bắt đầu");
      return false;
    }
    if (!locationName.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn địa điểm sân trên bản đồ");
      return false;
    }
    if (!maxPlayers || Number(maxPlayers) <= 0) {
      Alert.alert("Dữ liệu không hợp lệ", "Số người tối đa phải lớn hơn 0");
      return false;
    }
    const limits = SPORT_LIMITS[sport] || SPORT_LIMITS.football;
    const playerCount = Number(maxPlayers);
    if (playerCount > limits.maxPlayers) {
      Alert.alert(
        "Dữ liệu không hợp lệ",
        `Số người tối đa cho môn này là ${limits.maxPlayers} người`
      );
      return false;
    }
    const cost = Number(costPerPerson || 0);
    if (cost > MAX_COST_PER_PERSON) {
      Alert.alert(
        "Dữ liệu không hợp lệ",
        `Chi phí tối đa là ${MAX_COST_PER_PERSON.toLocaleString("vi-VN")} VND/người`
      );
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      if (!validateForm()) return;

      const payload = buildPayload();

      if (isEditMode) {
        await updateMatch(editMatch._id, payload);
        Alert.alert("Thành công", "Cập nhật trận đấu thành công");
      } else {
        await createMatch(payload);
        Alert.alert("Thành công", "Tạo trận đấu thành công");
      }

      if (navigation) {
        navigation.navigate("Home", { activeTab: "teams" });
      }
    } catch (error) {
      Alert.alert("Lỗi", error.message);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Xóa trận đấu",
      "Bạn có chắc muốn xóa trận này? Hành động này không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMatch(editMatch._id);
              Alert.alert("Thành công", "Đã xóa trận đấu");
              navigation.navigate("Home", { activeTab: "teams" });
            } catch (error) {
              Alert.alert("Lỗi", error.message);
            }
          },
        },
      ]
    );
  };

  return (
    <Screen style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScreenHeader style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation && navigation.goBack()}
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? "Sửa trận đấu" : "Tạo trận đấu"}</Text>
        <View style={styles.headerSpacer} />
      </ScreenHeader>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* MÔN THỂ THAO */}
        <Text style={styles.sectionLabel}>MÔN THỂ THAO</Text>
        <View style={styles.sportRow}>
          {sports.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.sportButton,
                sport === item.key && styles.sportButtonActive,
              ]}
              onPress={() => handleSelectSport(item.key)}
            >
              <View style={[
                styles.sportIconContainer,
                sport === item.key && styles.sportIconContainerActive,
              ]}>
                <Text style={styles.sportIcon}>{item.icon}</Text>
              </View>
              <Text style={[
                styles.sportLabel,
                sport === item.key && styles.sportLabelActive,
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* TÊN TRẬN ĐẤU */}
        <Text style={styles.sectionLabel}>TÊN TRẬN ĐẤU</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Giao lưu 5v5 tối nay"
            placeholderTextColor="#bbb"
          />
        </View>

        {/* NGÀY & GIỜ BẮT ĐẦU */}
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeCol}>
            <Text style={styles.sectionLabel}>NGÀY</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.pickerButtonText}>
                {formatDate(selectedDate)}
              </Text>
              <Text style={styles.pickerButtonIcon}>📅</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateTimeCol}>
            <Text style={styles.sectionLabel}>GIỜ BẮT ĐẦU</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowTimePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.pickerButtonText}>
                {getTimeLabel(selectedTimeSlot)}
              </Text>
              <Text style={styles.pickerButtonIcon}>🕐</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Picker */}
        {showDatePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={onDateChange}
          />
        )}
        {Platform.OS === "ios" && (
          <Modal visible={showDatePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Chọn ngày</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.modalDone}>Xong</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={selectedDate}
                  mode="date"
                  display="spinner"
                  minimumDate={new Date()}
                  onChange={onDateChange}
                  style={{ height: 200 }}
                  locale="vi-VN"
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Time Picker */}
        {showTimePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={getTimeDate(selectedTimeSlot)}
            mode="time"
            display="spinner"
            is24Hour={true}
            onChange={onTimeChange}
          />
        )}
        {Platform.OS === "ios" && (
          <Modal visible={showTimePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.timeModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>🕐 Chọn giờ bắt đầu</Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.modalDone}>Xong</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={getTimeDate(selectedTimeSlot)}
                  mode="time"
                  display="spinner"
                  is24Hour={true}
                  onChange={onTimeChange}
                  style={{ height: 200 }}
                  locale="vi-VN"
                />
              </View>
            </View>
          </Modal>
        )}

        {/* SỐ NGƯỜI TỐI ĐA / SỐ NGƯỜI THAM GIA */}
        <Text style={styles.sectionLabel}>
          {sport === "football" ? "SỐ NGƯỜI TỐI ĐA" : "SỐ NGƯỜI THAM GIA"}
        </Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={maxPlayers}
            onChangeText={handleMaxPlayersChange}
            keyboardType="numeric"
            placeholder={sport === "football" ? "10" : "2"}
            placeholderTextColor="#bbb"
          />
        </View>
        <Text style={styles.helperText}>{sportLimits.maxPlayersHint}</Text>

        {/* VỊ TRÍ CẦN TÌM (Football only) */}
        {sport === "football" && (
          <>
            <View style={styles.positionSectionHeader}>
              <Text style={styles.sectionLabel}>VỊ TRÍ CẦN TÌM (TÙY CHỌN)</Text>
              <Text style={styles.infoIcon}>ⓘ</Text>
            </View>
            <View style={styles.positionBox}>
              <View style={styles.positionGrid}>
                {positionsNeeded.map((item, index) => (
                  <View key={item.key} style={styles.positionItem}>
                    <Text style={styles.positionIcon}>{item.icon}</Text>
                    <Text style={styles.positionLabel}>{item.label}</Text>

                    <View style={styles.counterRow}>
                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => decreasePosition(item.key)}
                      >
                        <Text style={styles.counterButtonText}>−</Text>
                      </TouchableOpacity>

                      <Text style={styles.counterValue}>{item.quantity}</Text>

                      <TouchableOpacity
                        style={styles.counterButton}
                        onPress={() => increasePosition(item.key)}
                      >
                        <Text style={styles.counterButtonText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.positionHelperText}>
                Để trống nếu không có yêu cầu vị trí cụ thể
              </Text>
            </View>
          </>
        )}

        {/* CHI PHÍ / NGƯỜI */}
        <View style={styles.costLabelRow}>
          <Text style={styles.costEmoji}>💰</Text>
          <Text style={styles.sectionLabel}>CHI PHÍ / NGƯỜI</Text>
        </View>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, styles.costInput]}
            value={costPerPerson}
            onChangeText={handleCostChange}
            keyboardType="numeric"
            placeholder="30000"
            placeholderTextColor="#bbb"
          />
          <Text style={styles.currencySuffix}>VND</Text>
        </View>
        <Text style={styles.helperText}>
          Nhập 0 nếu miễn phí • Người chơi sẽ thấy thông tin này
        </Text>

        {/* ĐỊA ĐIỂM SÂN */}
        <Text style={styles.sectionLabel}>ĐỊA ĐIỂM SÂN</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={locationName}
            placeholder="Sân cỏ nhân tạo Đống Đa"
            placeholderTextColor="#bbb"
            editable={false}
          />
        </View>
        <TouchableOpacity
          style={styles.mapLink}
          onPress={() =>
            navigation.navigate("MapPicker", {
              currentLocation: locationCoords,
              currentAddress: locationName,
              formDraft: buildFormDraft(),
            })
          }
        >
          <Text style={styles.mapLinkIcon}>📍</Text>
          <Text style={styles.mapLinkText}>Chọn vị trí trên bản đồ</Text>
          <Text style={styles.mapLinkArrow}>›</Text>
        </TouchableOpacity>
        {locationCoords && (
          <View style={styles.coordBadge}>
            <Text style={styles.coordBadgeText}>
              ✓ Đã chọn tọa độ: {locationCoords.lat.toFixed(4)}, {locationCoords.lng.toFixed(4)}
            </Text>
          </View>
        )}

        {/* GHI CHÚ (TÙY CHỌN) */}
        <Text style={styles.sectionLabel}>GHI CHÚ (TÙY CHỌN)</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={(text) => {
              if (text.length <= 200) setNote(text);
            }}
            placeholder="Mặc quần áo thể thao, mang giày đinh ngắn.&#10;Tiền sân thanh toán tại chỗ."
            placeholderTextColor="#bbb"
            multiline
            textAlignVertical="top"
          />
        </View>
        <Text style={styles.charCount}>{note.length}/200</Text>

        {/* Bottom spacing for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomButtonContainer}>
        {isEditMode && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
            <Text style={styles.deleteButtonText}>🗑️ Xóa trận đấu</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.createButton} onPress={handleSubmit}>
          <Text style={styles.createButtonIcon}>{isEditMode ? "✓" : "⚽"}</Text>
          <Text style={styles.createButtonText}>
            {isEditMode ? "Lưu thay đổi" : "Tạo trận ngay"}
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8e8e8",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: {
    fontSize: 22,
    color: "#333",
    fontWeight: "500",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginLeft: 8,
  },
  headerSpacer: {
    width: 36,
  },

  // ScrollView
  scrollView: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },

  // Section label
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
  },

  // Sport Selector
  sportRow: {
    flexDirection: "row",
    gap: 12,
  },
  sportButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  sportButtonActive: {
    backgroundColor: "#fff5f2",
    borderColor: "#ff5722",
  },
  sportIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e8e8e8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  sportIconContainerActive: {
    backgroundColor: "#ff5722",
  },
  sportIcon: {
    fontSize: 20,
  },
  sportLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  sportLabelActive: {
    color: "#ff5722",
    fontWeight: "700",
  },

  // Input
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ebebeb",
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: "#333",
  },
  inputIcon: {
    fontSize: 16,
    paddingRight: 12,
    color: "#999",
  },

  // Date Time
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateTimeCol: {
    flex: 1,
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7f7f7",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ebebeb",
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  pickerButtonIcon: {
    fontSize: 16,
    color: "#999",
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  timeModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    maxHeight: "60%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
  },
  modalDone: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ff5722",
  },
  timeGrid: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  timeChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    margin: 4,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "transparent",
  },
  timeChipActive: {
    backgroundColor: "#fff5f2",
    borderColor: "#ff5722",
  },
  timeChipText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  timeChipTextActive: {
    color: "#ff5722",
  },
  timeChipPeriod: {
    fontSize: 10,
    color: "#aaa",
    marginTop: 2,
  },
  timeChipPeriodActive: {
    color: "#ff8a65",
  },

  // Helper text
  helperText: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 6,
    lineHeight: 17,
  },

  // Position Section
  positionSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  infoIcon: {
    fontSize: 14,
    color: "#999",
    marginTop: 18,
  },
  positionBox: {
    borderWidth: 1.5,
    borderColor: "#ff8a65",
    borderStyle: "dashed",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#fffbf8",
  },
  positionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  positionItem: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#f0e0d8",
  },
  positionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  positionLabel: {
    flex: 1,
    fontSize: 13,
    color: "#555",
    fontWeight: "500",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  counterButton: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
  },
  counterButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
    lineHeight: 18,
  },
  counterValue: {
    width: 24,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },
  positionHelperText: {
    fontSize: 11,
    color: "#bbb",
    marginTop: 10,
    textAlign: "center",
    fontStyle: "italic",
  },

  // Cost
  costLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  costEmoji: {
    fontSize: 14,
    marginTop: 18,
  },
  costInput: {
    paddingRight: 4,
  },
  currencySuffix: {
    fontSize: 14,
    fontWeight: "700",
    color: "#999",
    paddingRight: 14,
  },

  // Map link
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 4,
  },
  mapLinkIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  mapLinkText: {
    fontSize: 13,
    color: "#ff5722",
    fontWeight: "600",
    flex: 1,
  },
  mapLinkArrow: {
    fontSize: 20,
    color: "#ff5722",
    fontWeight: "300",
  },
  coordBadge: {
    marginTop: 6,
    backgroundColor: "#e8f5e9",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  coordBadgeText: {
    fontSize: 11,
    color: "#4caf50",
    fontWeight: "600",
  },

  // Note
  noteInput: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: 12,
  },
  charCount: {
    fontSize: 11,
    color: "#ccc",
    textAlign: "right",
    marginTop: 4,
  },

  // Bottom Button
  bottomButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 10 : 20,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 0.5,
    borderTopColor: "#eee",
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff4d2d",
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#ff4d2d",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createButtonIcon: {
    fontSize: 18,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  deleteButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#ef4444",
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  deleteButtonText: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 15,
  },
});