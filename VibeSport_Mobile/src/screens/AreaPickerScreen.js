import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";

// Local fallback dataset in case of no internet
const LOCAL_FALLBACK = [
  {
    name: "Thành phố Hà Nội",
    code: 1,
    districts: [
      {
        name: "Quận Cầu Giấy",
        code: 293,
        wards: [
          { name: "Phường Dịch Vọng Hậu", code: 10099 },
          { name: "Phường Trung Hòa", code: 10102 },
          { name: "Phường Nghĩa Tân", code: 10093 },
          { name: "Phường Quan Hoa", code: 10096 }
        ]
      },
      {
        name: "Quận Đống Đa",
        code: 294,
        wards: [
          { name: "Phường Láng Hạ", code: 10183 },
          { name: "Phường Ô Chợ Dừa", code: 10174 },
          { name: "Phường Kim Liên", code: 10168 }
        ]
      }
    ]
  },
  {
    name: "Thành phố Hồ Chí Minh",
    code: 79,
    districts: [
      {
        name: "Quận 1",
        code: 760,
        wards: [
          { name: "Phường Bến Nghé", code: 26734 },
          { name: "Phường Bến Thành", code: 26743 },
          { name: "Phường Tân Định", code: 26731 }
        ]
      }
    ]
  }
];

export default function AreaPickerScreen({ navigation, route }) {
  const returnTo = route?.params?.returnTo || "CompleteProfile";

  // Address lists
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  // Selected address levels
  const [selectedProvince, setSelectedProvince] = useState(null); // { name, code }
  const [selectedDistrict, setSelectedDistrict] = useState(null); // { name, code }
  const [selectedWard, setSelectedWard] = useState(null); // { name, code }
  const [selectedStreet, setSelectedStreet] = useState(""); // String

  // Loaders
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // Modal selector states
  const [modalVisible, setModalVisible] = useState(false);
  const [activeLevel, setActiveLevel] = useState(""); // "province", "district", "ward", "street"
  const [searchQuery, setSearchQuery] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Load provinces on mount
  useEffect(() => {
    fetchProvinces();
  }, []);

  const fetchProvinces = async () => {
    setLoadingProvinces(true);
    try {
      const res = await fetch("https://provinces.open-api.vn/api/p/");
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setProvinces(data.map(p => ({ name: p.name, code: p.code })));
    } catch (err) {
      // Fallback
      setProvinces(LOCAL_FALLBACK.map(p => ({ name: p.name, code: p.code })));
    } finally {
      setLoadingProvinces(false);
    }
  };

  const fetchDistricts = async (provinceCode) => {
    if (!provinceCode) return;
    setLoadingDistricts(true);
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=2`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setDistricts(data.districts.map(d => ({ name: d.name, code: d.code })));
    } catch (err) {
      // Fallback local search
      const localProv = LOCAL_FALLBACK.find(p => p.code === provinceCode);
      if (localProv) {
        setDistricts(localProv.districts.map(d => ({ name: d.name, code: d.code })));
      } else {
        setDistricts([]);
      }
    } finally {
      setLoadingDistricts(false);
    }
  };

  const fetchWards = async (districtCode) => {
    if (!districtCode) return;
    setLoadingWards(true);
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/d/${districtCode}?depth=2`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setWards(data.wards.map(w => ({ name: w.name, code: w.code })));
    } catch (err) {
      // Fallback local search
      if (selectedProvince) {
        const localProv = LOCAL_FALLBACK.find(p => p.code === selectedProvince.code);
        const localDist = localProv?.districts.find(d => d.code === districtCode);
        if (localDist) {
          setWards(localDist.wards.map(w => ({ name: w.name, code: w.code })));
          return;
        }
      }
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  };

  // Generate generic street options
  const streetList = useMemo(() => {
    return [
      "Đường Trung Tâm",
      "Đường Liên Xã",
      "Phố Mới",
      "Thôn 1",
      "Thôn 2",
      "Thôn 3",
      "Thôn 4",
      "Thôn 5",
      "Đường/Thôn khác..."
    ];
  }, []);

  // Filter options based on active selector modal
  const filteredOptions = useMemo(() => {
    let list = [];
    if (activeLevel === "province") list = provinces;
    else if (activeLevel === "district") list = districts;
    else if (activeLevel === "ward") list = wards;
    else if (activeLevel === "street") return streetList.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase().trim()));

    // Append "Other..." option
    const labelOther = activeLevel === "province" ? "Tỉnh/Thành phố khác..." : activeLevel === "district" ? "Quận/Huyện khác..." : "Xã/Phường khác...";
    const listWithOther = [...list.map(item => item.name), labelOther];

    if (!searchQuery.trim()) return listWithOther;
    const query = searchQuery.toLowerCase().trim();
    return listWithOther.filter(name => name.toLowerCase().includes(query));
  }, [activeLevel, provinces, districts, wards, streetList, searchQuery]);

  const openPicker = (level) => {
    if (level === "district" && !selectedProvince) {
      Alert.alert("Thông báo", "Vui lòng chọn Tỉnh / Thành phố trước.");
      return;
    }
    if (level === "ward" && !selectedDistrict) {
      Alert.alert("Thông báo", "Vui lòng chọn Quận / Huyện trước.");
      return;
    }
    if (level === "street" && !selectedWard) {
      Alert.alert("Thông báo", "Vui lòng chọn Phường / Xã trước.");
      return;
    }

    setActiveLevel(level);
    setSearchQuery("");
    setCustomInput("");
    setShowCustomInput(false);
    setModalVisible(true);
  };

  const handleSelectOption = (option) => {
    if (option.endsWith("khác...")) {
      setShowCustomInput(true);
      return;
    }

    applySelection(option);
  };

  const applySelection = (valueName) => {
    if (activeLevel === "province") {
      const match = provinces.find(p => p.name === valueName);
      const newProv = match || { name: valueName, code: null };
      setSelectedProvince(newProv);
      setSelectedDistrict(null);
      setSelectedWard(null);
      setSelectedStreet("");
      fetchDistricts(newProv.code);
    } else if (activeLevel === "district") {
      const match = districts.find(d => d.name === valueName);
      const newDist = match || { name: valueName, code: null };
      setSelectedDistrict(newDist);
      setSelectedWard(null);
      setSelectedStreet("");
      fetchWards(newDist.code);
    } else if (activeLevel === "ward") {
      const match = wards.find(w => w.name === valueName);
      const newWard = match || { name: valueName, code: null };
      setSelectedWard(newWard);
      setSelectedStreet("");
    } else if (activeLevel === "street") {
      setSelectedStreet(valueName);
    }
    setModalVisible(false);
  };

  const handleConfirmCustom = () => {
    if (!customInput.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập giá trị.");
      return;
    }
    applySelection(customInput.trim());
  };

  const handleConfirm = () => {
    if (!selectedProvince || !selectedDistrict || !selectedWard || !selectedStreet) {
      Alert.alert("Thông báo", "Vui lòng chọn đầy đủ các thông tin địa chỉ.");
      return;
    }

    const formattedAddress = `${selectedStreet}, ${selectedWard.name}, ${selectedDistrict.name}, ${selectedProvince.name}`;

    navigation.navigate({
      name: returnTo,
      params: {
        selectedLocation: {
          address: formattedAddress,
        },
      },
      merge: true,
    });
  };

  const getLevelTitle = () => {
    switch (activeLevel) {
      case "province": return "Chọn Tỉnh / Thành phố";
      case "district": return "Chọn Quận / Huyện";
      case "ward": return "Chọn Phường / Xã";
      case "street": return "Chọn Đường / Thôn / Xóm";
      default: return "Lựa chọn";
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Screen style={styles.safe}>
      <ScreenHeader style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn Khu Vực</Text>
        <View style={{ width: 40 }} />
      </ScreenHeader>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Vui lòng chọn thông tin khu vực:</Text>

        {/* 1. Tỉnh/Thành phố */}
        <TouchableOpacity style={styles.field} onPress={() => openPicker("province")}>
          <View style={styles.fieldLeft}>
            <Text style={styles.fieldLabel}>Tỉnh / Thành phố</Text>
            {loadingProvinces ? (
              <ActivityIndicator size="small" color="#4F46E5" style={{ alignSelf: "flex-start", marginTop: 4 }} />
            ) : (
              <Text style={[styles.fieldValue, !selectedProvince && styles.placeholder]}>
                {selectedProvince?.name || "Bấm chọn Tỉnh / Thành phố"}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* 2. Quận/Huyện */}
        <TouchableOpacity style={styles.field} onPress={() => openPicker("district")}>
          <View style={styles.fieldLeft}>
            <Text style={styles.fieldLabel}>Quận / Huyện</Text>
            {loadingDistricts ? (
              <ActivityIndicator size="small" color="#4F46E5" style={{ alignSelf: "flex-start", marginTop: 4 }} />
            ) : (
              <Text style={[styles.fieldValue, !selectedDistrict && styles.placeholder]}>
                {selectedDistrict?.name || "Bấm chọn Quận / Huyện"}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* 3. Phường/Xã */}
        <TouchableOpacity style={styles.field} onPress={() => openPicker("ward")}>
          <View style={styles.fieldLeft}>
            <Text style={styles.fieldLabel}>Phường / Xã</Text>
            {loadingWards ? (
              <ActivityIndicator size="small" color="#4F46E5" style={{ alignSelf: "flex-start", marginTop: 4 }} />
            ) : (
              <Text style={[styles.fieldValue, !selectedWard && styles.placeholder]}>
                {selectedWard?.name || "Bấm chọn Phường / Xã"}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* 4. Đường/Thôn */}
        <TouchableOpacity style={styles.field} onPress={() => openPicker("street")}>
          <View style={styles.fieldLeft}>
            <Text style={styles.fieldLabel}>Đường / Thôn / Xóm</Text>
            <Text style={[styles.fieldValue, !selectedStreet && styles.placeholder]}>
              {selectedStreet || "Bấm chọn Đường / Thôn / Xóm"}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        {/* Preview Address */}
        {selectedProvince && selectedDistrict && selectedWard && selectedStreet ? (
          <View style={styles.previewContainer}>
            <Ionicons name="location" size={22} color="#10B981" style={styles.previewIcon} />
            <View style={styles.previewRight}>
              <Text style={styles.previewLabel}>Địa điểm đầy đủ:</Text>
              <Text style={styles.previewText}>
                {selectedStreet}, {selectedWard.name}, {selectedDistrict.name}, {selectedProvince.name}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Confirm Button */}
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
          <Text style={styles.confirmBtnText}>Xác nhận</Text>
        </TouchableOpacity>
      </View>

      {/* Picker Selection Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{getLevelTitle()}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {showCustomInput ? (
              // Custom text input form
              <View style={styles.customInputContainer}>
                <Text style={styles.customInputLabel}>Nhập lựa chọn của bạn:</Text>
                <TextInput
                  style={styles.customTextInput}
                  placeholder="Nhập tên cụ thể..."
                  value={customInput}
                  onChangeText={setCustomInput}
                  autoFocus
                />
                <View style={styles.customInputBtnRow}>
                  <TouchableOpacity
                    style={[styles.customBtn, styles.customBtnCancel]}
                    onPress={() => setShowCustomInput(false)}
                  >
                    <Text style={styles.customBtnCancelText}>Quay lại</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.customBtn, styles.customBtnConfirm]}
                    onPress={handleConfirmCustom}
                  >
                    <Text style={styles.customBtnConfirmText}>Đồng ý</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Option search and list selection
              <>
                <View style={styles.searchBarWrapper}>
                  <Ionicons name="search-outline" size={18} color="#9CA3AF" style={styles.searchBarIcon} />
                  <TextInput
                    style={styles.searchBarInput}
                    placeholder="Tìm kiếm..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>

                <FlatList
                  data={filteredOptions}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.optionItem}
                      onPress={() => handleSelectOption(item)}
                    >
                      <Text style={[styles.optionItemText, item.endsWith("khác...") && styles.otherOptionText]}>
                        {item}
                      </Text>
                      {item.endsWith("khác...") ? (
                        <Ionicons name="create-outline" size={16} color="#4F46E5" />
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>Không tìm thấy kết quả.</Text>
                      <TouchableOpacity
                        style={styles.otherOptionLink}
                        onPress={() => setShowCustomInput(true)}
                      >
                        <Text style={styles.otherOptionLinkText}>+ Tự nhập lựa chọn mới</Text>
                      </TouchableOpacity>
                    </View>
                  }
                />
              </>
            )}
          </View>
        </View>
      </Modal>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: Platform.OS === "ios" ? 50 : 56,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4B5563",
    marginBottom: 16,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  fieldLeft: {
    flex: 1,
    paddingRight: 8,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1F2937",
  },
  placeholder: {
    color: "#9CA3AF",
    fontWeight: "400",
  },
  previewContainer: {
    flexDirection: "row",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  previewIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  previewRight: {
    flex: 1,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 2,
  },
  previewText: {
    fontSize: 14,
    color: "#047857",
    fontWeight: "500",
    lineHeight: 18,
  },
  confirmBtn: {
    backgroundColor: "#4F46E5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: "auto",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    minHeight: "50%",
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginVertical: 12,
  },
  searchBarIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    height: 38,
    fontSize: 14,
    color: "#111827",
  },
  optionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  optionItemText: {
    fontSize: 15,
    color: "#374151",
    fontWeight: "500",
  },
  otherOptionText: {
    color: "#4F46E5",
    fontWeight: "600",
  },
  customInputContainer: {
    padding: 20,
  },
  customInputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  customTextInput: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
    marginBottom: 20,
  },
  customInputBtnRow: {
    flexDirection: "row",
    gap: 12,
  },
  customBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  customBtnCancel: {
    backgroundColor: "#F3F4F6",
  },
  customBtnCancelText: {
    color: "#4B5563",
    fontSize: 14,
    fontWeight: "600",
  },
  customBtnConfirm: {
    backgroundColor: "#4F46E5",
  },
  customBtnConfirmText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
    marginBottom: 12,
  },
  otherOptionLink: {
    padding: 8,
  },
  otherOptionLinkText: {
    color: "#4F46E5",
    fontSize: 14,
    fontWeight: "600",
  },
});
