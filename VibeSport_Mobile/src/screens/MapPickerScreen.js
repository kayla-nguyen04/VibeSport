import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
  ActivityIndicator,
  Keyboard,
  Alert,
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";

const HANOI_LAT = 21.0285;
const HANOI_LNG = 105.8542;

const MAP_BASE_URL = "https://unpkg.com/leaflet@1.9.4/dist/";

const buildMapHtml = (lat, lng) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="${MAP_BASE_URL}leaflet.css" />
  <script src="${MAP_BASE_URL}leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    #map { width: 100%; height: 100%; min-height: 100vh; }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map, marker;

    function post(type, payload) {
      var msg = JSON.stringify(Object.assign({ type: type }, payload || {}));
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(msg);
      }
    }

    window.setLocation = function(lat, lng, animate) {
      if (!map || !marker) return;
      marker.setLatLng([lat, lng]);
      if (animate) {
        map.flyTo([lat, lng], 16, { duration: 0.6 });
      } else {
        map.setView([lat, lng], 16);
      }
      setTimeout(function() { map.invalidateSize(); }, 50);
    };

    function initMap(lat, lng) {
      map = L.map("map", { zoomControl: true }).setView([lat, lng], 16);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
      }).addTo(map);

      marker = L.marker([lat, lng], { draggable: true }).addTo(map);

      map.on("click", function(e) {
        marker.setLatLng(e.latlng);
        post("location", { lat: e.latlng.lat, lng: e.latlng.lng });
      });

      marker.on("dragend", function() {
        var pos = marker.getLatLng();
        post("location", { lat: pos.lat, lng: pos.lng });
      });

      setTimeout(function() {
        map.invalidateSize();
        post("ready", { lat: lat, lng: lng });
      }, 200);
    }

    function handleCommand(raw) {
      try {
        var data = JSON.parse(raw);
        if (data.type === "setLocation" && data.lat != null && data.lng != null) {
          window.setLocation(data.lat, data.lng, data.animate !== false);
        }
      } catch (e) {}
    }

    document.addEventListener("message", function(e) { handleCommand(e.data); });
    window.addEventListener("message", function(e) { handleCommand(e.data); });

    initMap(${lat}, ${lng});
  </script>
</body>
</html>
`;

const fetchWithTimeout = (url, options = {}, timeoutMs = 8000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout")), timeoutMs);
    fetch(url, options)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export default function MapPickerScreen({ navigation, route }) {
  const initialLocation = route?.params?.currentLocation || null;
  const initLat = initialLocation?.lat ?? HANOI_LAT;
  const initLng = initialLocation?.lng ?? HANOI_LNG;

  const [markerCoord, setMarkerCoord] = useState({ lat: initLat, lng: initLng });
  const [address, setAddress] = useState(route?.params?.currentAddress || "");
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [searching, setSearching] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(false);

  const webViewRef = useRef(null);
  const searchTimer = useRef(null);
  const geocodeTimer = useRef(null);
  const gpsFetched = useRef(false);

  const mapHtml = useMemo(() => buildMapHtml(initLat, initLng), [initLat, initLng]);

  const moveMapTo = useCallback((lat, lng, animate = true) => {
    webViewRef.current?.injectJavaScript(
      `window.setLocation(${lat}, ${lng}, ${animate}); true;`
    );
  }, []);

  const doReverseGeocode = useCallback(async (lat, lng) => {
    try {
      setGeocoding(true);
      const res = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`,
        { headers: { "User-Agent": "VibeSportApp/1.0", Accept: "application/json" } }
      );
      const data = await res.json();
      if (data?.display_name) setAddress(data.display_name);
      else setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } catch {
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } finally {
      setGeocoding(false);
    }
  }, []);

  const debouncedReverseGeocode = useCallback(
    (lat, lng) => {
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      geocodeTimer.current = setTimeout(() => doReverseGeocode(lat, lng), 600);
    },
    [doReverseGeocode]
  );

  const applyLocation = useCallback(
    (lat, lng, options = {}) => {
      const { updateAddress = true, moveMap = true, animate = true } = options;
      setMarkerCoord({ lat, lng });
      if (moveMap && mapReady) moveMapTo(lat, lng, animate);
      if (updateAddress) debouncedReverseGeocode(lat, lng);
    },
    [debouncedReverseGeocode, mapReady, moveMapTo]
  );

  const doSearch = useCallback(async (query) => {
    try {
      setSearching(true);
      const res = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=vn&accept-language=vi`,
        { headers: { "User-Agent": "VibeSportApp/1.0", Accept: "application/json" } }
      );
      const data = await res.json();
      if (data?.length > 0) {
        setSearchResults(
          data.map((r, i) => ({
            id: String(i),
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lon),
            name: r.display_name,
            category: r.class || "",
          }))
        );
        setShowResults(true);
      } else {
        setSearchResults([]);
        setShowResults(true);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchTextChange = useCallback(
    (text) => {
      setSearchText(text);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      if (text.trim().length < 2) {
        setSearchResults([]);
        setShowResults(false);
        return;
      }
      searchTimer.current = setTimeout(() => doSearch(text.trim()), 600);
    },
    [doSearch]
  );

  useEffect(() => {
    if (initialLocation) {
      if (!route?.params?.currentAddress) {
        doReverseGeocode(initLat, initLng);
      }
      return;
    }
    if (gpsFetched.current) return;
    gpsFetched.current = true;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const lat = loc.coords.latitude;
        const lng = loc.coords.longitude;
        applyLocation(lat, lng);
      } catch (err) {
        console.log("GPS unavailable:", err.message);
      }
    })();
  }, [applyLocation, doReverseGeocode, initLat, initLng, initialLocation, route?.params?.currentAddress]);

  useEffect(() => {
    if (!mapReady) return;
    moveMapTo(markerCoord.lat, markerCoord.lng, false);
  }, [mapReady]);

  const handleWebViewMessage = useCallback(
    (event) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "ready") {
          setMapReady(true);
          return;
        }
        if (data.type === "location") {
          setMarkerCoord({ lat: data.lat, lng: data.lng });
          debouncedReverseGeocode(data.lat, data.lng);
        }
      } catch {
        // ignore malformed messages
      }
    },
    [debouncedReverseGeocode]
  );

  const handleSelectResult = (item) => {
    Keyboard.dismiss();
    setSearchText("");
    setShowResults(false);
    setSearchResults([]);
    setAddress(item.name);
    applyLocation(item.lat, item.lng, { updateAddress: false, moveMap: true });
  };

  const handleSearchSubmit = async () => {
    if (!searchText.trim()) return;
    Keyboard.dismiss();
    setShowResults(false);
    try {
      setGeocoding(true);
      const res = await fetchWithTimeout(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText.trim())}&limit=1&countrycodes=vn&accept-language=vi`,
        { headers: { "User-Agent": "VibeSportApp/1.0", Accept: "application/json" } },
        10000
      );
      const data = await res.json();
      if (data?.length > 0) {
        const numLat = parseFloat(data[0].lat);
        const numLng = parseFloat(data[0].lon);
        setAddress(data[0].display_name);
        setSearchText("");
        applyLocation(numLat, numLng, { updateAddress: false, moveMap: true });
      } else {
        Alert.alert("Không tìm thấy", "Thử từ khóa khác.");
      }
    } catch {
      Alert.alert("Lỗi kết nối", "Kiểm tra mạng và thử lại.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleGoToMyLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Quyền truy cập", "Cấp quyền vị trí trong Cài đặt.");
        return;
      }
      setGeocoding(true);
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      applyLocation(lat, lng, { updateAddress: true, moveMap: true });
    } catch {
      Alert.alert("Không khả dụng", "Không thể lấy vị trí. Chọn trên bản đồ.");
      setGeocoding(false);
    }
  };

  const handleConfirm = () => {
    navigation.navigate({
      name: "CreateMatch",
      params: {
        selectedLocation: {
          lat: markerCoord.lat,
          lng: markerCoord.lng,
          address:
            address || `${markerCoord.lat.toFixed(6)}, ${markerCoord.lng.toFixed(6)}`,
        },
        formDraft: route?.params?.formDraft,
      },
      merge: true,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Screen style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <ScreenHeader style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chọn vị trí sân</Text>
        <View style={{ width: 36 }} />
      </ScreenHeader>

      <View style={styles.searchBar}>
        <View style={styles.searchWrap}>
          <Text style={{ fontSize: 14, marginRight: 8, opacity: 0.4 }}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={handleSearchTextChange}
            placeholder="Tìm sân bóng, địa chỉ..."
            placeholderTextColor="#aaa"
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            onFocus={() => searchResults.length > 0 && setShowResults(true)}
          />
          {searching && (
            <ActivityIndicator size="small" color="#ff5722" style={{ marginRight: 6 }} />
          )}
          {searchText.length > 0 && !searching && (
            <TouchableOpacity
              onPress={() => {
                setSearchText("");
                setSearchResults([]);
                setShowResults(false);
              }}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: "#ccc",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 10, color: "#fff", fontWeight: "700" }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {showResults && (
          <View style={styles.dropdown}>
            {searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dropItem}
                    onPress={() => handleSelectResult(item)}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: "#fff3f0",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>📍</Text>
                    </View>
                    <Text
                      style={{ flex: 1, fontSize: 13, color: "#333", lineHeight: 18 }}
                      numberOfLines={2}
                    >
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <Text
                style={{ textAlign: "center", paddingVertical: 16, color: "#999", fontSize: 13 }}
              >
                Không tìm thấy
              </Text>
            )}
          </View>
        )}

        <View style={{ flex: 1 }}>
          <WebView
            ref={webViewRef}
            source={{ html: mapHtml, baseUrl: MAP_BASE_URL }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={["*"]}
            mixedContentMode="always"
            allowsInlineMediaPlayback
            androidLayerType="hardware"
            setSupportMultipleWindows={false}
            onMessage={handleWebViewMessage}
            onError={() => setMapLoadError(true)}
            onHttpError={() => setMapLoadError(true)}
            scrollEnabled={false}
            bounces={false}
            overScrollMode="never"
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          />

          {!mapReady && !mapLoadError && (
            <View style={styles.mapOverlay}>
              <ActivityIndicator size="large" color="#E53935" />
              <Text style={styles.mapOverlayText}>Đang tải bản đồ...</Text>
            </View>
          )}

          {mapLoadError && (
            <View style={styles.mapOverlay}>
              <Text style={styles.mapOverlayText}>
                Không tải được bản đồ. Kiểm tra mạng emulator và thử lại.
              </Text>
              <TouchableOpacity
                style={styles.retryMapBtn}
                onPress={() => {
                  setMapLoadError(false);
                  setMapReady(false);
                  webViewRef.current?.reload();
                }}
              >
                <Text style={styles.retryMapBtnText}>Tải lại</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.locBtn}
            onPress={handleGoToMyLocation}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 18 }}>📌</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottom}>
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: "#ddd",
            alignSelf: "center",
            marginBottom: 10,
          }}
        />
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: "#E53935",
              marginTop: 5,
              marginRight: 12,
            }}
          />
          <View style={{ flex: 1 }}>
            {geocoding ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ActivityIndicator size="small" color="#ff5722" />
                <Text style={{ fontSize: 13, color: "#999" }}>Đang tìm địa chỉ...</Text>
              </View>
            ) : (
              <>
                <Text
                  style={{ fontSize: 14, color: "#333", fontWeight: "500", lineHeight: 20 }}
                  numberOfLines={2}
                >
                  {address || "Chạm vào bản đồ để chọn vị trí"}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: "#bbb",
                    marginTop: 2,
                    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
                  }}
                >
                  {markerCoord.lat.toFixed(6)}, {markerCoord.lng.toFixed(6)}
                </Text>
              </>
            )}
          </View>
        </View>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            Xác nhận vị trí này
          </Text>
        </TouchableOpacity>
      </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e0e0e0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f5f5",
  },
  backIcon: { fontSize: 20, color: "#333" },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#1a1a1a", marginLeft: 12 },
  searchBar: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f2f2f2",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: "#333", paddingVertical: 0 },
  dropdown: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    maxHeight: 240,
    backgroundColor: "#fff",
    borderRadius: 14,
    zIndex: 100,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e0e0e0",
    overflow: "hidden",
  },
  dropItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  locBtn: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  bottom: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 16 : 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  confirmBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E53935",
    paddingVertical: 15,
    borderRadius: 14,
    elevation: 5,
    shadowColor: "#E53935",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  mapOverlayText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  retryMapBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#E53935",
    borderRadius: 10,
  },
  retryMapBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
