import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector, useDispatch } from "react-redux";
import {
  View,
  Pressable,
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
  Image,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  SafeAreaView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { WebView } from "react-native-webview";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

const inlineGoogleMapHtml = (lat, lng) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #f3f4f6; }
    #map { width: 100%; height: 100%; min-height: 220px; border-radius: 12px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map, marker;
    var initLat = ${lat || 21.0285};
    var initLng = ${lng || 105.8542};

    function post(type, payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, payload || {})));
      }
    }

    function initMap() {
      map = L.map("map", { zoomControl: true, attributionControl: false }).setView([initLat, initLng], 15);
      L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"]
      }).addTo(map);

      marker = L.marker([initLat, initLng], { draggable: true }).addTo(map);

      map.on("click", function(e) {
        marker.setLatLng(e.latlng);
        post("location", { lat: e.latlng.lat, lng: e.latlng.lng });
      });

      marker.on("dragend", function() {
        var pos = marker.getLatLng();
        post("location", { lat: pos.lat, lng: pos.lng });
      });

      setTimeout(function() { map.invalidateSize(); }, 250);
    }

    document.addEventListener("DOMContentLoaded", initMap);
  </script>
</body>
</html>
`;

import { createMatch, updateMatch, deleteMatch } from "../services/matchService";
import * as ImagePicker from "expo-image-picker";
import { openConversation, updateGroupInfo, fetchConversations } from "../redux/chatSlice";
import { getPostsRequest } from "../services/postApi";
import { getFollowingListRequest, getUserProfileRequest, getMutualFriendsRequest } from "../services/userApi";
import { CourtDetailModal, COURT_DIRECTORY, getServiceCostRange } from "../components/CourtDetailModal";
import { getCourtsRequest } from "../services/courtService";
import { Screen } from "../components/Screen";
import { TagIcon } from "../components/TagIcon";
import { primary } from "../theme";

import GroupCreationModal from '../components/GroupCreationModal';
const ORANGE = primary.DEFAULT; // '#FF6B3D'

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const parseDateString = (dateStr) => {
  if (!dateStr) return new Date();
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date();
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
};

const formatNumberWithDots = (val) => {
  if (!val) return "";
  const digits = val.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const getInitials = (name) => {
  if (!name) return "?";
  const p = name.trim().split(" ");
  return p.length > 1 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

function PickleballIcon({ color, size = 32 }) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: size * 0.75,
        height: size * 0.75,
        position: 'relative',
        transform: [{ rotate: '-35deg' }],
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {/* Racket Head */}
        <View style={{
          width: size * 0.46,
          height: size * 0.53,
          borderRadius: size * 0.12,
          borderWidth: 2,
          borderColor: color,
          position: 'absolute',
          top: 0,
          left: size * 0.03,
          backgroundColor: 'transparent',
        }} />
        {/* Handle */}
        <View style={{
          width: size * 0.09,
          height: size * 0.28,
          backgroundColor: color,
          position: 'absolute',
          bottom: 0,
          left: size * 0.22,
          borderRadius: size * 0.03,
        }} />
      </View>
      {/* Two balls on top right */}
      <View style={{
        width: size * 0.12,
        height: size * 0.12,
        borderRadius: size * 0.06,
        borderWidth: 1.5,
        borderColor: color,
        position: 'absolute',
        top: size * 0.18,
        right: size * 0.12,
      }} />
      <View style={{
        width: size * 0.09,
        height: size * 0.09,
        borderRadius: size * 0.045,
        borderWidth: 1.5,
        borderColor: color,
        position: 'absolute',
        top: size * 0.38,
        right: size * 0.06,
      }} />
    </View>
  );
}

function SoccerFieldIcon({ color = '#1A1A1A' }) {
  return (
    <View style={{
      width: 40,
      height: 28,
      borderWidth: 1.5,
      borderColor: color,
      borderRadius: 3,
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    }}>
      <View style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '50%',
        width: 1.2,
        backgroundColor: color,
      }} />
      <View style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1.2,
        borderColor: color,
        position: 'absolute',
      }} />
      <View style={{
        width: 2,
        height: 2,
        borderRadius: 1,
        backgroundColor: color,
        position: 'absolute',
      }} />
      <View style={{
        position: 'absolute',
        left: 0,
        top: 5,
        bottom: 5,
        width: 7,
        borderWidth: 1.2,
        borderColor: color,
        borderLeftWidth: 0,
      }} />
      <View style={{
        position: 'absolute',
        right: 0,
        top: 5,
        bottom: 5,
        width: 7,
        borderWidth: 1.2,
        borderColor: color,
        borderRightWidth: 0,
      }} />
    </View>
  );
}

function NeoButton({ isSelected, onPress, children }) {
  const shadowColor = "#E0E0E0";
  const borderColor = isSelected ? ORANGE : "#CCCCCC";
  return (
    <View style={styles.neoContainer}>
      <View style={[styles.neoShadow, { backgroundColor: shadowColor }]} />
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={[
          styles.neoContent,
          {
            borderColor: borderColor,
            backgroundColor: '#FFFFFF',
            top: isSelected ? 3 : 0,
            left: isSelected ? 3 : 0,
          }
        ]}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
}

function CourtTypeButton({ label, subLabel, isSelected, onPress }) {
  const shadowColor = "#E0E0E0";
  const borderColor = isSelected ? ORANGE : "#CCCCCC";
  return (
    <View style={styles.courtTypeContainer}>
      <View style={[styles.courtTypeShadow, { backgroundColor: shadowColor }]} />
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.9}
        style={[
          styles.courtTypeContent,
          {
            borderColor: borderColor,
            backgroundColor: '#FFFFFF',
            top: isSelected ? 3 : 0,
            left: isSelected ? 3 : 0,
          },
        ]}
      >
        <Text style={[styles.courtTypeLabel, { color: isSelected ? ORANGE : '#1A1A1A' }]}>{label}</Text>
        <Text style={[styles.courtTypeSubLabel, { color: isSelected ? ORANGE : '#999' }]}>{subLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Football formations ────────────────────────────────────────────────────
// Each position: { id, label, role, x, y } – x/y in 0..1 relative to pitch
// y=0 = top (forward zone), y=1 = bottom (goalkeeper zone)
// Team 1 occupies top half (y: 0..0.5), Team 2 occupies bottom half (y: 0.5..1)

const TEAM1_POSITIONS = [
  // Goalkeeper
  { id: "t1_gk",  label: "Thủ môn", role: "goalkeeper", x: 0.50, y: 0.05 },
  // Defenders
  { id: "t1_lb",  label: "Hậu vệ",  role: "defender",   x: 0.15, y: 0.15 },
  { id: "t1_cb",  label: "Hậu vệ",  role: "defender",   x: 0.50, y: 0.15 },
  { id: "t1_cb1", label: "Hậu vệ",  role: "defender",   x: 0.35, y: 0.15 },
  { id: "t1_cb2", label: "Hậu vệ",  role: "defender",   x: 0.65, y: 0.15 },
  { id: "t1_rb",  label: "Hậu vệ",  role: "defender",   x: 0.85, y: 0.15 },
  // Midfielders
  { id: "t1_dm1", label: "Tiền vệ",  role: "midfielder", x: 0.35, y: 0.24 },
  { id: "t1_dm2", label: "Tiền vệ",  role: "midfielder", x: 0.65, y: 0.24 },
  { id: "t1_lm",  label: "Tiền vệ",  role: "midfielder", x: 0.18, y: 0.30 },
  { id: "t1_cm1", label: "Tiền vệ",  role: "midfielder", x: 0.35, y: 0.30 },
  { id: "t1_cm",  label: "Tiền vệ",  role: "midfielder", x: 0.50, y: 0.30 },
  { id: "t1_cm2", label: "Tiền vệ",  role: "midfielder", x: 0.65, y: 0.30 },
  { id: "t1_rm",  label: "Tiền vệ",  role: "midfielder", x: 0.82, y: 0.30 },
  { id: "t1_am",  label: "Tiền vệ",  role: "midfielder", x: 0.50, y: 0.36 },
  // Strikers
  { id: "t1_lw",  label: "Tiền đạo", role: "striker",    x: 0.20, y: 0.40 },
  { id: "t1_lf",  label: "Tiền đạo", role: "striker",    x: 0.38, y: 0.42 },
  { id: "t1_st",  label: "Tiền đạo", role: "striker",    x: 0.50, y: 0.44 },
  { id: "t1_rf",  label: "Tiền đạo", role: "striker",    x: 0.62, y: 0.42 },
  { id: "t1_rw",  label: "Tiền đạo", role: "striker",    x: 0.80, y: 0.40 },
];

const TEAM2_POSITIONS = [
  // Strikers
  { id: "t2_rw",  label: "Tiền đạo", role: "striker",    x: 0.80, y: 0.60 },
  { id: "t2_rf",  label: "Tiền đạo", role: "striker",    x: 0.62, y: 0.58 },
  { id: "t2_st",  label: "Tiền đạo", role: "striker",    x: 0.50, y: 0.56 },
  { id: "t2_lf",  label: "Tiền đạo", role: "striker",    x: 0.38, y: 0.58 },
  { id: "t2_lw",  label: "Tiền đạo", role: "striker",    x: 0.20, y: 0.60 },
  // Midfielders
  { id: "t2_am",  label: "Tiền vệ",  role: "midfielder", x: 0.50, y: 0.64 },
  { id: "t2_rm",  label: "Tiền vệ",  role: "midfielder", x: 0.82, y: 0.70 },
  { id: "t2_cm2", label: "Tiền vệ",  role: "midfielder", x: 0.65, y: 0.70 },
  { id: "t2_cm",  label: "Tiền vệ",  role: "midfielder", x: 0.50, y: 0.70 },
  { id: "t2_cm1", label: "Tiền vệ",  role: "midfielder", x: 0.35, y: 0.70 },
  { id: "t2_lm",  label: "Tiền vệ",  role: "midfielder", x: 0.18, y: 0.70 },
  { id: "t2_dm2", label: "Tiền vệ",  role: "midfielder", x: 0.65, y: 0.76 },
  { id: "t2_dm1", label: "Tiền vệ",  role: "midfielder", x: 0.35, y: 0.76 },
  // Defenders
  { id: "t2_rb",  label: "Hậu vệ",  role: "defender",   x: 0.85, y: 0.85 },
  { id: "t2_cb2", label: "Hậu vệ",  role: "defender",   x: 0.65, y: 0.85 },
  { id: "t2_cb1", label: "Hậu vệ",  role: "defender",   x: 0.35, y: 0.85 },
  { id: "t2_cb",  label: "Hậu vệ",  role: "defender",   x: 0.50, y: 0.85 },
  { id: "t2_lb",  label: "Hậu vệ",  role: "defender",   x: 0.15, y: 0.85 },
  // Goalkeeper
  { id: "t2_gk",  label: "Thủ môn", role: "goalkeeper", x: 0.50, y: 0.95 },
];

const ALL_POSITIONS = [...TEAM1_POSITIONS, ...TEAM2_POSITIONS];

const FOOTBALL_FORMATS = {
  10: {
    label: "5 vs 5",
    playerCountPerTeam: 5,
    team1Ids: ["t1_gk", "t1_cb1", "t1_cb2", "t1_cm", "t1_st"],
    team2Ids: ["t2_gk", "t2_cb1", "t2_cb2", "t2_cm", "t2_st"],
  },
  14: {
    label: "7 vs 7",
    playerCountPerTeam: 7,
    team1Ids: ["t1_gk", "t1_lb", "t1_rb", "t1_lm", "t1_cm", "t1_rm", "t1_st"],
    team2Ids: ["t2_gk", "t2_lb", "t2_rb", "t2_lm", "t2_cm", "t2_rm", "t2_st"],
  },
  22: {
    label: "11 vs 11",
    playerCountPerTeam: 11,
    team1Ids: ["t1_gk", "t1_lb", "t1_cb1", "t1_cb2", "t1_rb", "t1_dm1", "t1_dm2", "t1_lm", "t1_am", "t1_rm", "t1_st"],
    team2Ids: ["t2_gk", "t2_lb", "t2_cb1", "t2_cb2", "t2_rb", "t2_dm1", "t2_dm2", "t2_lm", "t2_am", "t2_rm", "t2_st"],
  },
};

// ─── Badminton / Pickleball formats ───────────────────────────────────────────
const RACKET_FORMATS = {
  2: { label: "1 vs 1", playerCountPerSide: 1, totalPlayers: 2 },
  4: { label: "2 vs 2", playerCountPerSide: 2, totalPlayers: 4 },
};

const ROLE_COLORS = {
  goalkeeper: "#22c55e",
  defender:   "#3b82f6",
  midfielder: "#f59e0b",
  striker:    "#ef4444",
};

// Role label short
const ROLE_ICONS = {
  goalkeeper: "TM",
  defender:   "HV",
  midfielder: "TV",
  striker:    "TĐ",
};

const MAX_COST_PER_PERSON = 1000000;
const MAX_BENCH = 6;

const SPORT_MAP = {
  football: "Bóng đá",
  badminton: "Cầu lông",
  pickleball: "Pickleball",
};

const SPORT_LIMITS = {
  football: {
    maxPlayers: 22,
    maxPlayersHint: "Ví dụ: 5v5 → 10 người • 7v7 → 14 người",
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

// ─── Pitch SVG-like component rendered with Views ──────────────────────────
const PITCH_ASPECT = 1.45; // height / width ratio

function FootballPitch({ selectedIds, onToggle, maxPlayers }) {
  const pitchWidth = SCREEN_WIDTH - 48;
  const pitchHeight = pitchWidth * PITCH_ASPECT;

  const formatInfo = FOOTBALL_FORMATS[22];
  const allowedIds = [...formatInfo.team1Ids, ...formatInfo.team2Ids];
  const visiblePositions = ALL_POSITIONS.filter((pos) => allowedIds.includes(pos.id));

  return (
    <View style={[pitchStyles.pitch, { width: pitchWidth, height: pitchHeight }]}>
      {/* Field markings */}
      <View style={pitchStyles.outerBorder} />
      {/* Center line */}
      <View style={[pitchStyles.centerLine, { top: pitchHeight * 0.5 }]} />
      {/* Center circle */}
      <View
        style={[
          pitchStyles.centerCircle,
          {
            top: pitchHeight * 0.5 - pitchWidth * 0.18,
            left: pitchWidth * 0.5 - pitchWidth * 0.18,
            width: pitchWidth * 0.36,
            height: pitchWidth * 0.36,
            borderRadius: pitchWidth * 0.18,
          },
        ]}
      />
      {/* Center dot */}
      <View
        style={[
          pitchStyles.centerDot,
          {
            top: pitchHeight * 0.5 - 3,
            left: pitchWidth * 0.5 - 3,
          },
        ]}
      />
      {/* Top penalty box */}
      <View
        style={[
          pitchStyles.penaltyBox,
          {
            top: 0,
            left: pitchWidth * 0.22,
            width: pitchWidth * 0.56,
            height: pitchHeight * 0.14,
          },
        ]}
      />
      {/* Top goal box */}
      <View
        style={[
          pitchStyles.goalBox,
          {
            top: 0,
            left: pitchWidth * 0.34,
            width: pitchWidth * 0.32,
            height: pitchHeight * 0.06,
          },
        ]}
      />
      {/* Bottom penalty box */}
      <View
        style={[
          pitchStyles.penaltyBox,
          {
            bottom: 0,
            left: pitchWidth * 0.22,
            width: pitchWidth * 0.56,
            height: pitchHeight * 0.14,
          },
        ]}
      />
      {/* Bottom goal box */}
      <View
        style={[
          pitchStyles.goalBox,
          {
            bottom: 0,
            left: pitchWidth * 0.34,
            width: pitchWidth * 0.32,
            height: pitchHeight * 0.06,
          },
        ]}
      />

      {/* Team labels */}
      <View style={[pitchStyles.teamLabel, { top: 8, left: 8 }]}>
        <Text style={pitchStyles.teamLabelText}>ĐỘI 1 ({formatInfo.playerCountPerTeam})</Text>
      </View>
      <View style={[pitchStyles.teamLabel, { bottom: 8, left: 8 }]}>
        <Text style={pitchStyles.teamLabelText}>ĐỘI 2 ({formatInfo.playerCountPerTeam})</Text>
      </View>

      {/* Player positions */}
      {visiblePositions.map((pos) => {
        const isSelected = selectedIds.includes(pos.id);
        const color = ROLE_COLORS[pos.role];
        const dotSize = isSelected ? 36 : 18;
        const left = pos.x * pitchWidth - dotSize / 2;
        const top = pos.y * pitchHeight - dotSize / 2;

        return (
          <TouchableOpacity
            key={pos.id}
            style={[
              pitchStyles.playerDot,
              {
                left,
                top,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: isSelected ? color : "rgba(255,255,255,0.2)",
                borderColor: isSelected ? color : "rgba(255,255,255,0.5)",
                borderWidth: isSelected ? 0 : 1,
              },
            ]}
            onPress={() => onToggle(pos.id)}
            activeOpacity={0.7}
          >
            {isSelected ? (
              <Text
                style={[
                  pitchStyles.playerDotText,
                  { color: "#fff", fontSize: 10, fontWeight: "bold" },
                ]}
              >
                {ROLE_ICONS[pos.role]}
              </Text>
            ) : (
              <Text
                style={[
                  pitchStyles.playerDotText,
                  { color: "rgba(255,255,255,0.7)", fontSize: 7, fontWeight: "600" },
                ]}
              >
                {ROLE_ICONS[pos.role]}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const pitchStyles = StyleSheet.create({
  pitch: {
    backgroundColor: "#3a8a3a",
    borderRadius: 8,
    overflow: "hidden",
    alignSelf: "center",
  },
  outerBorder: {
    position: "absolute",
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    borderRadius: 4,
  },
  centerLine: {
    position: "absolute",
    left: 6,
    right: 6,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  centerCircle: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "transparent",
  },
  centerDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  penaltyBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "transparent",
  },
  goalBox: {
    position: "absolute",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "transparent",
  },
  teamLabel: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  teamLabelText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  playerDot: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  playerDotText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0,
  },
});

// ─── Legend row ──────────────────────────────────────────────────────────────
function RoleLegend() {
  const entries = [
    { role: "goalkeeper", label: "Thủ môn" },
    { role: "defender",   label: "Hậu vệ" },
    { role: "midfielder", label: "Tiền vệ" },
    { role: "striker",    label: "Tiền đạo" },
  ];
  return (
    <View style={legendStyles.row}>
      {entries.map((e) => (
        <View key={e.role} style={legendStyles.item}>
          <View style={[legendStyles.dot, { backgroundColor: ROLE_COLORS[e.role] }]} />
          <Text style={legendStyles.label}>{e.label}</Text>
        </View>
      ))}
    </View>
  );
}

const legendStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 11,
    color: "#555",
    fontWeight: "500",
  },
});

// ─── Racket Court (Badminton / Pickleball) ──────────────────────────────────
const COURT_ASPECT = 1.8; // height/width ratio (portrait court)

function RacketCourt({ maxPlayers, sport, selectedIds = [], onToggle }) {
  const courtWidth = SCREEN_WIDTH - 80;
  const courtHeight = courtWidth * COURT_ASPECT;
  const fmt = RACKET_FORMATS[maxPlayers] || RACKET_FORMATS[4];
  const perSide = fmt.playerCountPerSide;

  const sportColor = sport === "pickleball" ? "#f59e0b" : "#3b82f6";
  const sportLabel = sport === "pickleball" ? "Pickleball" : "Cầu lông";

  const allRacketDots = [
    { id: "racket_a1", label: "A1", x: perSide === 1 ? 0.5 : 0.3, y: 0.22 },
    { id: "racket_a2", label: "A2", x: 0.7, y: 0.22, hidden: perSide === 1 },
    { id: "racket_b1", label: "B1", x: perSide === 1 ? 0.5 : 0.3, y: 0.78 },
    { id: "racket_b2", label: "B2", x: 0.7, y: 0.78, hidden: perSide === 1 },
  ].filter((d) => !d.hidden);

  return (
    <View style={[courtStyles.court, { width: courtWidth, height: courtHeight }]}>
      {/* Outer border */}
      <View style={courtStyles.outerBorder} />
      {/* Center net */}
      <View style={[courtStyles.net, { top: courtHeight * 0.5 - 1 }]} />
      {/* Net posts */}
      <View style={[courtStyles.netPost, { top: courtHeight * 0.5 - 6, left: 0 }]} />
      <View style={[courtStyles.netPost, { top: courtHeight * 0.5 - 6, right: 0 }]} />
      {/* Service lines top */}
      <View style={[courtStyles.serviceLine, { top: courtHeight * 0.25 }]} />
      {/* Service lines bottom */}
      <View style={[courtStyles.serviceLine, { top: courtHeight * 0.75 }]} />
      {/* Center service line */}
      <View style={[courtStyles.centerServiceLine, { top: courtHeight * 0.25, height: courtHeight * 0.25 }]} />
      <View style={[courtStyles.centerServiceLine, { top: courtHeight * 0.5, height: courtHeight * 0.25 }]} />

      {/* Side label top */}
      <View style={[courtStyles.sideLabel, { top: 8, alignSelf: "center", left: 8 }]}>
        <Text style={courtStyles.sideLabelText}>BÊN A ({perSide})</Text>
      </View>
      {/* Side label bottom */}
      <View style={[courtStyles.sideLabel, { bottom: 8, left: 8 }]}>
        <Text style={courtStyles.sideLabelText}>BÊN B ({perSide})</Text>
      </View>

      {/* Sport label center */}
      <View style={[courtStyles.sportBadge, { top: courtHeight * 0.5 - 10 }]}>
        <Text style={[courtStyles.sportBadgeText, { color: sportColor }]}>{sportLabel}</Text>
      </View>

      {/* Interactive Player Dots */}
      {allRacketDots.map((dot) => {
        const isSelected = selectedIds.includes(dot.id);
        const dotSize = isSelected ? 36 : 28;
        const left = dot.x * courtWidth - dotSize / 2;
        const top = dot.y * courtHeight - dotSize / 2;

        return (
          <TouchableOpacity
            key={dot.id}
            style={[
              courtStyles.playerDot,
              {
                left,
                top,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: isSelected ? ORANGE : sportColor,
                borderColor: isSelected ? "#fff" : "rgba(255,255,255,0.7)",
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => onToggle && onToggle(dot.id)}
            activeOpacity={0.7}
          >
            <Text style={{ color: "#fff", fontSize: isSelected ? 11 : 9.5, fontWeight: "700" }}>
              {isSelected ? "✓" : dot.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const courtStyles = StyleSheet.create({
  court: {
    backgroundColor: "#1565c0",
    borderRadius: 8,
    overflow: "hidden",
    alignSelf: "center",
    position: "relative",
  },
  outerBorder: {
    position: "absolute",
    top: 8, left: 8, right: 8, bottom: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.7)",
    borderRadius: 4,
  },
  net: {
    position: "absolute",
    left: 0, right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  netPost: {
    position: "absolute",
    width: 8,
    height: 12,
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  serviceLine: {
    position: "absolute",
    left: 8, right: 8,
    height: 1.5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  centerServiceLine: {
    position: "absolute",
    left: "50%",
    width: 1.5,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  sideLabel: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sideLabelText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sportBadge: {
    position: "absolute",
    alignSelf: "center",
    left: 0, right: 0,
    alignItems: "center",
  },
  sportBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  playerDot: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  playerDotText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function CreateMatchScreen({ navigation, route }) {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const conversations = useSelector((state) => state.chat.conversations || []);
  const editMatch = route?.params?.editMatch ?? null;
  const isEditMode = !!editMatch;

  const [selectedChatGroupId, setSelectedChatGroupId] = useState(
    editMatch?.chatGroupId?._id || editMatch?.chatGroupId || null
  );
  const [showGroupPickerModal, setShowGroupPickerModal] = useState(false);
  const [showInlineCreateGroupModal, setShowInlineCreateGroupModal] = useState(false);
  const [newGroupNameInput, setNewGroupNameInput] = useState("");
  const [creatingGroupInline, setCreatingGroupInline] = useState(false);
  const [groupCreationStepInline, setGroupCreationStepInline] = useState(1);
  const [selectedAvatarImage, setSelectedAvatarImage] = useState(null);

  const [mutualFriends, setMutualFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState([]);
  const [friendSearchText, setFriendSearchText] = useState("");

  const getAvatarColor = (name) => {
    if (!name) return '#0b74ff';
    const colors = ['#F59E0B', '#10B981', '#6366F1', '#EC4899', '#8B5CF6', '#3B82F6', '#EF4444'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const fixMediaUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return url;
  };

  const loadMutualFriends = async () => {
    if (!token) return;
    try {
      setLoadingFriends(true);
      const res = await getMutualFriendsRequest(token);
      setMutualFriends(res.data || []);
    } catch (err) {
      console.error("Load mutual friends error:", err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleToggleSelectGroupUser = (userId) => {
    const normId = String(userId);
    setSelectedGroupUserIds((prev) =>
      prev.includes(normId)
        ? prev.filter((id) => id !== normId)
        : [...prev, normId]
    );
  };

  const filteredMutualFriends = useMemo(() => {
    const kw = friendSearchText.trim().toLowerCase();
    return mutualFriends.filter((f) => {
      if (!kw) return true;
      return f.name?.toLowerCase().includes(kw);
    });
  }, [mutualFriends, friendSearchText]);

  const userChatGroups = useMemo(() => {
    return conversations.filter((c) => c.isGroup);
  }, [conversations]);

  // Load danh sách nhóm chat khi màn hình được focus
  useFocusEffect(
    useCallback(() => {
      if (token) dispatch(fetchConversations());
    }, [token])
  );

  const [sport, setSport] = useState(editMatch?.sport || "football");
  const [findTeamPosts, setFindTeamPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    const loadPosts = async () => {
      try {
        setLoadingPosts(true);
        const res = await getPostsRequest(1, 50, token, "Tìm đội");
        if (isMounted) {
          setFindTeamPosts(res.data || []);
        }
      } catch (err) {
        console.log("Load find team posts error:", err);
      } finally {
        if (isMounted) {
          setLoadingPosts(false);
        }
      }
    };
    loadPosts();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const filteredPosts = findTeamPosts.filter((post) => {
    const targetSport = SPORT_MAP[sport];
    return (
      post.sportType === targetSport ||
      post.tags?.includes(targetSport)
    );
  });

  const [title, setTitle] = useState(editMatch?.title || "");
  const [selectedDate, setSelectedDate] = useState(
    editMatch?.date ? parseDateString(editMatch.date) : new Date()
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(editMatch?.startTime || "19:00");
  const [endTimeSlot, setEndTimeSlot] = useState(editMatch?.endTime || "20:30");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
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
  const [contactPhone, setContactPhone] = useState(editMatch?.contactPhone || "");
  const [contactPhoneError, setContactPhoneError] = useState("");
  const [contactZalo, setContactZalo] = useState(editMatch?.contactZalo || "");
  const [contactFacebook, setContactFacebook] = useState(editMatch?.contactFacebook || "");
  const [courtDescription, setCourtDescription] = useState(editMatch?.courtDescription || "");
  const [specificAddress, setSpecificAddress] = useState(editMatch?.specificAddress || "");
  const [addressInputType, setAddressInputType] = useState("preset");
  const [selectedCourtObj, setSelectedCourtObj] = useState(editMatch?.selectedCourtObj || null);
  const [showCourtDetailModal, setShowCourtDetailModal] = useState(false);
  const [isCourtPresetsExpanded, setIsCourtPresetsExpanded] = useState(false);

  const handleSwitchAddressInputType = (newMode) => {
    if (newMode !== addressInputType) {
      setAddressInputType(newMode);
      setLocationName("");
      setSpecificAddress("");
      setCourtDescription("");
      setSelectedCourtObj(null);
      setLocationCoords(null);
      if (typeof setSelectedContactUser === "function") setSelectedContactUser(null);
      setContactPhone(normalizePhone(""));
      setServiceCost("");
      setServiceCostMin("");
      setServiceCostMax("");
    }
  };

  const normalizePhone = (val) => {
    if (val == null) return "";
    const s = String(val || "").replace(/\D/g, "");
    return s.slice(0, 10);
  };

  const handlePhoneBlur = () => {
    if (!contactPhone || contactPhone.trim() === "") {
      setContactPhoneError("Số điện thoại không được để trống");
    } else if (contactPhone.length > 11) {
      setContactPhoneError("Số điện thoại tối đa 11 chữ số");
    } else {
      setContactPhoneError("");
    }
  };

  const activePitchType = useMemo(() => {
    if (sport === "football") {
      return footballMaxPlayers === 10 ? "Sân 5" : footballMaxPlayers === 14 ? "Sân 7" : "Sân 11";
    }
    return racketMaxPlayers === 2 ? "Sân đơn" : "Sân đôi";
  }, [sport, footballMaxPlayers, racketMaxPlayers]);

  const activeTotalPeople = useMemo(() => {
    if (sport === "football") {
      const b1 = Number(benchMembersTeam1 || 0);
      const b2 = Number(benchMembersTeam2 || 0);
      const fMax = Number(footballMaxPlayers || 10);
      return fMax + b1 + b2;
    }
    if (sport === "badminton" || sport === "pickleball") {
      return Number(racketMaxPlayers || 4);
    }
    return Number(maxPlayersOther || 2);
  }, [sport, footballMaxPlayers, benchMembersTeam1, benchMembersTeam2, racketMaxPlayers, maxPlayersOther]);

  const activePitchTypeLabel = useMemo(() => {
    if (sport === "football") {
      if (footballMaxPlayers === 10) return "Sân 5 - 5vs5";
      if (footballMaxPlayers === 14) return "Sân 7 - 7vs7";
      return "Sân 11 - 11vs11";
    }
    if (racketMaxPlayers === 2) return "Sân đơn - 1vs1";
    return "Sân đôi - 2vs2";
  }, [sport, footballMaxPlayers, racketMaxPlayers]);

  const activePitchDisplayTag = useMemo(() => {
    if (sport === "football") {
      if (footballMaxPlayers === 10) return "Sân 5v5";
      if (footballMaxPlayers === 14) return "Sân 7v7";
      return "Sân 11v11";
    }
    if (racketMaxPlayers === 2) return "Sân 1v1";
    return "Sân 2v2";
  }, [sport, footballMaxPlayers, racketMaxPlayers]);

  const checkCourtSupportsPitch = useCallback((court, pitchType) => {
    if (!court || !pitchType) return false;

    // Check pitchOptions from MongoDB
    if (Array.isArray(court.pitchOptions) && court.pitchOptions.length > 0) {
      const targetTag = pitchType.includes("5") ? "5v5" 
                      : pitchType.includes("7") ? "7v7" 
                      : pitchType.includes("11") ? "11v11" 
                      : pitchType.includes("1") || pitchType.includes("đơn") ? "1v1" 
                      : "2v2";
      return court.pitchOptions.some((opt) => opt.pitchType === targetTag || opt.pitchType === pitchType);
    }

    const types = court.pitchTypes || court.fieldTypes;
    if (!types || !Array.isArray(types) || types.length === 0) return true;
    
    const digitMatch = pitchType.match(/\d+/);
    const targetDigit = digitMatch ? digitMatch[0] : "";

    if (targetDigit) {
      return types.some((t) => {
        if (!t) return false;
        const tStr = String(t);
        if (tStr === pitchType) return true;
        const tDigitMatch = tStr.match(/\d+/);
        return tDigitMatch && tDigitMatch[0] === targetDigit;
      });
    }

    return true;
  }, []);

  const getCourtPriceForPitch = useCallback((court, pitchType) => {
    if (!court) return 300000;

    // 1. Direct MongoDB pitchOptions array check
    if (Array.isArray(court.pitchOptions) && court.pitchOptions.length > 0) {
      const targetTag = pitchType.includes("5") ? "5v5" 
                      : pitchType.includes("7") ? "7v7" 
                      : pitchType.includes("11") ? "11v11" 
                      : pitchType.includes("1") || pitchType.includes("đơn") ? "1v1" 
                      : "2v2";
      const foundOpt = court.pitchOptions.find((opt) => opt.pitchType === targetTag || opt.pitchType === pitchType);
      if (foundOpt && foundOpt.pricePerHour) {
        return foundOpt.pricePerHour;
      }
    }

    // 2. pricesByPitchType object fallback
    if (court.pricesByPitchType && court.pricesByPitchType[pitchType]) {
      return court.pricesByPitchType[pitchType];
    }

    // 3. Mathematical fallback
    const pFrom = Number(court.priceFrom || court.hourlyRate || 300000);
    const pTo = Number(court.priceTo || pFrom * 2);

    if (pitchType === "Sân 5" || pitchType.includes("5")) return pFrom;
    if (pitchType === "Sân 7" || pitchType.includes("7")) return Math.round((pFrom + pTo) / 2);
    if (pitchType === "Sân 11" || pitchType.includes("11")) return pTo >= 900000 ? pTo : Math.round(pFrom * 2.5);

    if (pitchType === "Sân đơn" || pitchType.includes("đơn") || pitchType.includes("1")) return pFrom;
    if (pitchType === "Sân đôi" || pitchType.includes("đôi") || pitchType.includes("2")) return pTo > pFrom ? pTo : Math.round(pFrom * 1.5);

    return court.hourlyRate || pFrom;
  }, []);

  const [dbCourts, setDbCourts] = useState([]);

  useEffect(() => {
    let isMounted = true;
    setDbCourts([]); // Clear previous courts on sport change
    getCourtsRequest(sport).then((courts) => {
      if (isMounted && Array.isArray(courts) && courts.length > 0) {
        setDbCourts(courts);
      }
    });
    return () => { isMounted = false; };
  }, [sport]);

  const filteredCourts = useMemo(() => {
    const list = dbCourts.length > 0 ? dbCourts : COURT_DIRECTORY;
    return list.filter((c) => c.sportType === sport);
  }, [sport, dbCourts]);

  useEffect(() => {
    // When activePitchType changes, reset selected court state so user must choose a court for the new pitch type
    setSelectedCourtObj(null);
    setLocationName("");
    setSpecificAddress("");
    setCostPerPerson("");
  }, [activePitchType]);
  const [skillLevel, setSkillLevel] = useState(editMatch?.skillLevel || "Người mới");
  const [serviceCost, setServiceCost] = useState(
    editMatch?.serviceCost ? String(editMatch.serviceCost) : ""
  );
  const [serviceCostMin, setServiceCostMin] = useState(() => {
    if (editMatch?.serviceCost) {
      const parts = String(editMatch.serviceCost).split("-");
      return parts[0] || "";
    }
    return "";
  });
  const [serviceCostMax, setServiceCostMax] = useState(() => {
    if (editMatch?.serviceCost) {
      const parts = String(editMatch.serviceCost).split("-");
      return parts[1] || "";
    }
    return "";
  });
  const [selectedContactUser, setSelectedContactUser] = useState(
    editMatch?.contactAppUser || null
  );
  const [showTagUserModal, setShowTagUserModal] = useState(false);
  const [followingList, setFollowingList] = useState([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState("");

  const handleOpenTagModal = async () => {
    if (selectedCourtObj) {
      Alert.alert(
        "Chủ sân gắn liền với mẫu sân",
        `Chủ sân đã được tự động liên kết với mẫu sân "${selectedCourtObj.name}". Để đổi chủ sân khác, vui lòng chọn mẫu sân tương ứng.`
      );
      return;
    }
    try {
      setLoadingFollowing(true);
      setShowTagUserModal(true);
      const res = await getFollowingListRequest(token);
      setFollowingList(res?.data || []);
    } catch (err) {
      Alert.alert("Lỗi", "Không thể tải danh sách người theo dõi");
    } finally {
      setLoadingFollowing(false);
    }
  };

  const handleSelectTagUser = (u) => {
    setSelectedContactUser(u);
    const userPhone = u?.phone || u?.phoneNumber || u?.contactPhone || "";
    if (userPhone) {
      setContactPhone(normalizePhone(userPhone));
    } else {
      const targetId = u?._id || u?.id;
      if (targetId) {
        getUserProfileRequest(targetId, token)
          .then((res) => {
            const fullUserData = res?.data || res;
              if (fullUserData?.phone) {
              setContactPhone(normalizePhone(fullUserData.phone));
              setSelectedContactUser((prev) => (prev ? { ...prev, phone: fullUserData.phone } : prev));
            }
          })
          .catch(() => {});
      }
    }
    setShowTagUserModal(false);
    setSearchUserQuery("");
  };

  useEffect(() => {
    if (selectedContactUser) {
      const userPhone = selectedContactUser.phone || selectedContactUser.phoneNumber || selectedContactUser.contactPhone || "";
      if (userPhone) {
        setContactPhone(normalizePhone(userPhone));
      } else {
        const targetId = selectedContactUser._id || selectedContactUser.id;
        if (targetId) {
          getUserProfileRequest(targetId, token)
            .then((res) => {
              const fullUserData = res?.data || res;
              if (fullUserData?.phone) {
                setContactPhone(normalizePhone(fullUserData.phone));
                setSelectedContactUser((prev) => (prev ? { ...prev, phone: fullUserData.phone } : prev));
              }
            })
            .catch(() => {});
        }
      }
    }
  }, [selectedContactUser, token]);

  const filteredFollowingList = useMemo(() => {
    if (!searchUserQuery.trim()) return followingList;
    const q = searchUserQuery.toLowerCase().trim();
    return followingList.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [followingList, searchUserQuery]);

  // ── Position map state ──
  // selectedPositionIds: list of position ids ticked on the pitch
  const [selectedPositionIds, setSelectedPositionIds] = useState(() => {
    if (editMatch?.selectedPositionIds?.length) {
      return editMatch.selectedPositionIds;
    }
    return [];
  });
  const [showPitchModal, setShowPitchModal] = useState(false);

  // Bench members for Team 1 and Team 2 (optional, max 3 each)
  const [benchMembersTeam1, setBenchMembersTeam1] = useState(
    editMatch?.benchMembersTeam1 ? String(editMatch.benchMembersTeam1) : ""
  );
  const [benchMembersTeam2, setBenchMembersTeam2] = useState(
    editMatch?.benchMembersTeam2 ? String(editMatch.benchMembersTeam2) : ""
  );

  // Auto-calculate số người cần tìm = selected positions + reserves of both teams
  const totalNeeded = selectedPositionIds.length + Number(benchMembersTeam1 || 0) + Number(benchMembersTeam2 || 0);

  // For non-football sports keep a manual maxPlayers field
  const [maxPlayersOther, setMaxPlayersOther] = useState(
    editMatch?.maxPlayers ? String(editMatch.maxPlayers) : "2"
  );

  const [footballMaxPlayers, setFootballMaxPlayers] = useState(() => {
    if (editMatch?.sport === "football" && editMatch?.maxPlayers) {
      return editMatch.maxPlayers;
    }
    return 10; // default is 5 vs 5 (10 players)
  });

  const [racketMaxPlayers, setRacketMaxPlayers] = useState(() => {
    if ((editMatch?.sport === "badminton" || editMatch?.sport === "pickleball") && editMatch?.maxPlayers) {
      return editMatch.maxPlayers;
    }
    return 4; // default is 2 vs 2
  });

  // ── Effect to update form fields when editMatch changes ──
  useEffect(() => {
    if (editMatch) {
      setSport(editMatch.sport || "football");
      setTitle(editMatch.title || "");
      setSelectedDate(editMatch.date ? parseDateString(editMatch.date) : new Date());
      setSelectedTimeSlot(editMatch.startTime || "19:00");
      setEndTimeSlot(editMatch.endTime || "20:30");
      setCostPerPerson(editMatch.costPerPerson ? String(editMatch.costPerPerson) : "");
      setLocationName(editMatch.locationName || "");
      setLocationCoords(editMatch.location?.lat != null ? { lat: editMatch.location.lat, lng: editMatch.location.lng } : null);
      setNote(editMatch.note || "");
      setContactPhone(normalizePhone(editMatch.contactPhone || ""));
      setContactZalo(editMatch.contactZalo || "");
      setContactFacebook(editMatch.contactFacebook || "");
      setCourtDescription(editMatch.courtDescription || "");
      setSpecificAddress(editMatch.specificAddress || "");
      setSkillLevel(editMatch.skillLevel || "Người mới");
      setServiceCost(editMatch.serviceCost ? String(editMatch.serviceCost) : "");
      setSelectedContactUser(editMatch.contactAppUser || null);
      setSelectedPositionIds(editMatch.selectedPositionIds || []);
      setBenchMembersTeam1(editMatch.benchMembersTeam1 ? String(editMatch.benchMembersTeam1) : "");
      setBenchMembersTeam2(editMatch.benchMembersTeam2 ? String(editMatch.benchMembersTeam2) : "");
      setMaxPlayersOther(editMatch.maxPlayers ? String(editMatch.maxPlayers) : "2");
      setSelectedChatGroupId(editMatch.chatGroupId?._id || editMatch.chatGroupId || null);
      if (editMatch.sport === "football" && editMatch.maxPlayers) {
        setFootballMaxPlayers(editMatch.maxPlayers);
      }
      if ((editMatch.sport === "badminton" || editMatch.sport === "pickleball") && editMatch.maxPlayers) {
        setRacketMaxPlayers(editMatch.maxPlayers);
      }
    }
  }, [editMatch]);

  const handleOpenCreateGroupModal = () => {
    setShowGroupPickerModal(false);
    setShowInlineCreateGroupModal(true);
    setGroupCreationStepInline(1);
    setNewGroupNameInput("");
    setSelectedGroupUserIds([]);
    setFriendSearchText("");
    setSelectedAvatarImage(null);
    loadMutualFriends();
  };

  const handleNextStepInline = () => {
    if (selectedGroupUserIds.length >= 2) {
      setGroupCreationStepInline(2);
    } else {
      Alert.alert("Thông báo", "Vui lòng chọn ít nhất 2 người dùng để tạo nhóm");
    }
  };

  const handlePickGroupAvatar = () => {
    Alert.alert(
      'Chọn ảnh đại diện nhóm',
      'Chọn phương thức để lấy ảnh',
      [
        {
          text: 'Chụp ảnh mới',
          onPress: () => processGroupImagePick('camera')
        },
        {
          text: 'Chọn từ thư viện',
          onPress: () => processGroupImagePick('library')
        },
        { text: 'Hủy', style: 'cancel' }
      ]
    );
  };

  const processGroupImagePick = async (mode) => {
    try {
      let result;
      if (mode === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập máy ảnh để chụp ảnh.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện để chọn ảnh.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
        });
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedAvatarImage(result.assets[0]);
      }
    } catch (err) {
      console.error('Lỗi chọn ảnh nhóm:', err);
      Alert.alert('Lỗi', 'Không thể chọn ảnh.');
    }
  };

  const handleCreateGroupInline = async () => {
    if (!newGroupNameInput.trim() || selectedGroupUserIds.length < 2) return;
    setCreatingGroupInline(true);
    try {
      const result = await dispatch(
        openConversation({ recipientIds: selectedGroupUserIds, name: newGroupNameInput.trim() })
      ).unwrap();

      const newConv = result.data || result;
      const createdId = newConv?._id || newConv?.id;

      if (selectedAvatarImage && createdId) {
        try {
          const formData = new FormData();
          formData.append('name', newGroupNameInput.trim());

          const uri = selectedAvatarImage.uri;
          const uriParts = uri.split('.');
          const fileType = uriParts[uriParts.length - 1];
          const fileName = uri.split('/').pop();

          formData.append('avatar', {
            uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
            name: fileName || `avatar.${fileType}`,
            type: `image/${fileType}`,
          });

          await dispatch(updateGroupInfo({ conversationId: createdId, formData })).unwrap();
        } catch (uploadErr) {
          console.error('Lỗi upload avatar lúc tạo nhóm:', uploadErr);
        }
      }

      if (createdId) {
        setSelectedChatGroupId(createdId);
        Alert.alert("Thành công", `Đã tạo nhóm "${newGroupNameInput.trim()}" và gắn vào trận đấu!`);
      }

      setShowInlineCreateGroupModal(false);
      setShowGroupPickerModal(false);
      setNewGroupNameInput("");
      setSelectedGroupUserIds([]);
      setSelectedAvatarImage(null);
      setGroupCreationStepInline(1);
    } catch (err) {
      Alert.alert('Lỗi', typeof err === 'string' ? err : 'Không thể tạo nhóm trò chuyện');
    } finally {
      setCreatingGroupInline(false);
    }
  };

  const renderFriendItem = ({ item }) => {
    const fId = String(item._id || item.id);
    const isSelected = selectedGroupUserIds.includes(fId);
    const displayName = item.name || 'Thành viên VibeSport';
    const avatarColor = getAvatarColor(displayName);

    return (
      <TouchableOpacity
        style={styles.friendItem}
        activeOpacity={0.8}
        onPress={() => handleToggleSelectGroupUser(fId)}
      >
        {item.picture ? (
          <Image source={{ uri: fixMediaUrl(item.picture) }} style={styles.friendAvatar} />
        ) : (
          <View style={[styles.friendAvatarFallback, { backgroundColor: avatarColor }]}>
            <Text style={styles.friendAvatarText}>{getInitials(displayName)}</Text>
          </View>
        )}
        <Text style={styles.friendName} numberOfLines={1}>
          {displayName}
        </Text>
        <View style={[styles.checkCircle, isSelected && styles.checkCircleSelected]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

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
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    return `${hh}g ${mm}p`;
  };

  const combineDateAndTime = (dateObj, timeStr) => {
    try {
      const base = dateObj ? new Date(dateObj) : new Date();
      const parts = (timeStr || "00:00").split(":").map(Number);
      const hh = Number.isFinite(parts[0]) ? parts[0] : 0;
      const mm = Number.isFinite(parts[1]) ? parts[1] : 0;
      base.setHours(hh, mm, 0, 0);
      return base;
    } catch (e) {
      return new Date();
    }
  };

  const roundUpMinutes = (date, step = 15) => {
    const ms = 1000 * 60 * step;
    return new Date(Math.ceil(date.getTime() / ms) * ms);
  };

  // Picker handlers
  const onDateChange = (event, date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event.type === "set" && date) {
      setSelectedDate(date);
      // If user picks today, ensure start time is not in the past
      const now = new Date();
      const pickedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (pickedDay.getTime() === todayDay.getTime()) {
        const currentRounded = roundUpMinutes(new Date(now.getTime() + 30 * 60 * 1000), 15);
        const curH = String(currentRounded.getHours()).padStart(2, "0");
        const curM = String(currentRounded.getMinutes()).padStart(2, "0");
        const candidate = `${curH}:${curM}`;
        const currentStartDT = combineDateAndTime(date, selectedTimeSlot);
        const nowDT = new Date();
        if (currentStartDT < nowDT) {
          setSelectedTimeSlot(candidate);
          // set sensible default end time = +1h
          const endDT = new Date(currentRounded.getTime() + 60 * 60 * 1000);
          setEndTimeSlot(`${String(endDT.getHours()).padStart(2, "0")}:${String(endDT.getMinutes()).padStart(2, "0")}`);
        }
      }
    }
  };

  const onStartTimeChange = (event, date) => {
    if (Platform.OS === "android") {
      setShowStartTimePicker(false);
    }
    if (event.type === "set" && date) {
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      const newSlot = `${hh}:${mm}`;
      // Validate: if selectedDate is today, disallow times in the past
      const newStartDT = combineDateAndTime(selectedDate || new Date(), newSlot);
      const now = new Date();
      if (newStartDT < now && (new Date(selectedDate).toDateString() === now.toDateString())) {
        Alert.alert("Lỗi", "Không thể chọn thời gian đã qua.");
        return;
      }
      // Validate: start must be strictly before end
      const curEndDT = combineDateAndTime(selectedDate || new Date(), endTimeSlot || "23:59");
      if (newStartDT >= curEndDT) {
        Alert.alert("Lỗi", "Giờ bắt đầu phải nhỏ hơn giờ kết thúc.");
        return;
      }
      setSelectedTimeSlot(newSlot);
    }
  };

  const onEndTimeChange = (event, date) => {
    if (Platform.OS === "android") {
      setShowEndTimePicker(false);
    }
    if (event.type === "set" && date) {
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      const newSlot = `${hh}:${mm}`;
      // Validate: if selectedDate is today, disallow end times in the past
      const newEndDT = combineDateAndTime(selectedDate || new Date(), newSlot);
      const now = new Date();
      if (newEndDT < now && (new Date(selectedDate).toDateString() === now.toDateString())) {
        Alert.alert("Lỗi", "Không thể chọn thời gian đã qua.");
        return;
      }
      const curStartDT = combineDateAndTime(selectedDate || new Date(), selectedTimeSlot || "00:00");
      if (newEndDT <= curStartDT) {
        Alert.alert("Lỗi", "Giờ kết thúc phải lớn hơn giờ bắt đầu.");
        return;
      }
      setEndTimeSlot(newSlot);
    }
  };

  const getTimeDate = (timeStr, defaultHour = 19, defaultMin = 0) => {
    const [h, m] = (timeStr || `${defaultHour}:${defaultMin}`).split(":").map(Number);
    const d = new Date();
    d.setHours(h ?? defaultHour, m ?? defaultMin, 0, 0);
    return d;
  };

  const calculateTotalHours = useCallback((startTimeStr, endTimeStr) => {
    if (!startTimeStr || !endTimeStr) return 1;
    const [startH, startM] = startTimeStr.split(":").map(Number);
    const [endH, endM] = endTimeStr.split(":").map(Number);
    
    let startMin = (startH || 0) * 60 + (startM || 0);
    let endMin = (endH || 0) * 60 + (endM || 0);

    if (endMin <= startMin) {
      endMin += 24 * 60;
    }

    const diffMin = endMin - startMin;
    const hours = diffMin / 60;
    return Math.max(hours, 0.5);
  }, []);

  const buildFormDraft = useCallback(
    () => ({
      sport,
      title,
      selectedDate: selectedDate ? selectedDate.toISOString() : new Date().toISOString(),
      selectedTimeSlot,
      endTimeSlot,
      maxPlayersOther,
      footballMaxPlayers,
      racketMaxPlayers,
      costPerPerson,
      note,
      selectedPositionIds,
      benchMembersTeam1,
      benchMembersTeam2,
      locationName,
      locationCoords,
      contactPhone,
      contactZalo,
      contactFacebook,
      courtDescription,
      specificAddress,
      skillLevel,
      serviceCost,
      selectedContactUser,
      addressInputType,
      selectedCourtObj,
    }),
    [
      sport,
      title,
      selectedDate,
      selectedTimeSlot,
      endTimeSlot,
      maxPlayersOther,
      footballMaxPlayers,
      racketMaxPlayers,
      costPerPerson,
      note,
      selectedPositionIds,
      benchMembersTeam1,
      benchMembersTeam2,
      locationName,
      locationCoords,
      contactPhone,
      contactZalo,
      contactFacebook,
      courtDescription,
      specificAddress,
      skillLevel,
      serviceCost,
      selectedContactUser,
      addressInputType,
      selectedCourtObj,
    ]
  );

  const applyFormDraft = useCallback((draft) => {
    if (!draft) return;
    if (draft.sport) setSport(draft.sport);
    if (draft.title != null) setTitle(draft.title);
    if (draft.selectedDate) setSelectedDate(new Date(draft.selectedDate));
    if (draft.selectedTimeSlot) setSelectedTimeSlot(draft.selectedTimeSlot);
    if (draft.endTimeSlot) setEndTimeSlot(draft.endTimeSlot);
    if (draft.maxPlayersOther != null) setMaxPlayersOther(String(draft.maxPlayersOther));
    if (draft.footballMaxPlayers != null) setFootballMaxPlayers(Number(draft.footballMaxPlayers));
    if (draft.racketMaxPlayers != null) setRacketMaxPlayers(Number(draft.racketMaxPlayers));
    if (draft.costPerPerson != null) setCostPerPerson(String(draft.costPerPerson));
    if (draft.note != null) setNote(draft.note);
    if (draft.selectedPositionIds != null) setSelectedPositionIds(draft.selectedPositionIds);
    if (draft.benchMembersTeam1 != null) setBenchMembersTeam1(String(draft.benchMembersTeam1));
    if (draft.benchMembersTeam2 != null) setBenchMembersTeam2(String(draft.benchMembersTeam2));
    if (draft.locationName != null) setLocationName(draft.locationName);
    if (draft.locationCoords) setLocationCoords(draft.locationCoords);
    if (draft.contactPhone != null) setContactPhone(normalizePhone(draft.contactPhone));
    if (draft.contactZalo != null) setContactZalo(draft.contactZalo);
    if (draft.contactFacebook != null) setContactFacebook(draft.contactFacebook);
    if (draft.courtDescription != null) setCourtDescription(draft.courtDescription);
    if (draft.specificAddress != null) setSpecificAddress(draft.specificAddress);
    if (draft.skillLevel != null) setSkillLevel(draft.skillLevel);
    if (draft.serviceCost != null) setServiceCost(String(draft.serviceCost));
    if (draft.selectedContactUser !== undefined) setSelectedContactUser(draft.selectedContactUser);
    if (draft.addressInputType !== undefined) setAddressInputType(draft.addressInputType);
    if (draft.selectedCourtObj !== undefined) setSelectedCourtObj(draft.selectedCourtObj);
  }, []);

  // Khôi phục form khi quay lại từ MapPicker
  useFocusEffect(
    useCallback(() => {
      const draft = route?.params?.formDraft;
      const loc = route?.params?.selectedLocation;

      if (draft || loc) {
        if (draft) applyFormDraft(draft);
        if (loc) {
          setLocationName(loc.address || "");
          setSpecificAddress(loc.address || "");
          setLocationCoords({ lat: loc.lat, lng: loc.lng });
        }
        navigation.setParams({ formDraft: undefined, selectedLocation: undefined });
      }
    }, [applyFormDraft, navigation, route?.params?.formDraft, route?.params?.selectedLocation])
  );

  const sports = [
    { key: "badminton", label: "Cầu lông" },
    { key: "football", label: "Bóng đá" },
    { key: "pickleball", label: "Pickleball" },
  ];

  const handleSelectSport = (selectedSport) => {
    if (isEditMode) {
      Alert.alert("Thông báo", "Không thể thay đổi môn thể thao khi sửa trận đấu.");
      return;
    }
    setSport(selectedSport);
    if (selectedSport !== "football") {
      setMaxPlayersOther("2");
      setSelectedPositionIds([]);
      if (selectedSport === "badminton" || selectedSport === "pickleball") {
        setRacketMaxPlayers(4);
      }
    } else {
      setFootballMaxPlayers(10);
      setSelectedPositionIds([]);
    }
  };

  const handleSelectFootballMaxPlayers = (maxP) => {
    const numP = Number(maxP);
    setFootballMaxPlayers(numP);
    setIsCourtPresetsExpanded(true);
    const limit = (FOOTBALL_FORMATS[numP] || FOOTBALL_FORMATS[22]).playerCountPerTeam;
    setSelectedPositionIds((prev) => {
      const t1 = prev.filter((id) => id.startsWith("t1_"));
      const t2 = prev.filter((id) => id.startsWith("t2_"));
      return [...t1.slice(0, limit), ...t2.slice(0, limit)];
    });
  };

  const handleIncreaseRole = (role) => {
    const limit = (FOOTBALL_FORMATS[footballMaxPlayers] || FOOTBALL_FORMATS[22]).playerCountPerTeam;

    // Count current selections for Team 1 and Team 2
    const t1Count = selectedPositionIds.filter((id) => id.startsWith("t1_")).length;
    const t2Count = selectedPositionIds.filter((id) => id.startsWith("t2_")).length;

    const formatInfo = FOOTBALL_FORMATS[22];
    const allowedIds = [...formatInfo.team1Ids, ...formatInfo.team2Ids];

    let candidate = null;

    // Try Team 1 first if it has slots remaining
    if (t1Count < limit) {
      candidate = TEAM1_POSITIONS.find(
        (pos) => allowedIds.includes(pos.id) && pos.role === role && !selectedPositionIds.includes(pos.id)
      );
    }

    // Try Team 2 if Team 1 didn't have candidates or was full
    if (!candidate && t2Count < limit) {
      candidate = TEAM2_POSITIONS.find(
        (pos) => allowedIds.includes(pos.id) && pos.role === role && !selectedPositionIds.includes(pos.id)
      );
    }

    if (candidate) {
      setSelectedPositionIds((prev) => [...prev, candidate.id]);
    } else {
      Alert.alert(
        "Giới hạn đội hình",
        `Cả hai đội đã chọn tối đa số vị trí (${limit} người/đội) hoặc không còn vị trí ${roleLabels[role]} trống trên sơ đồ.`
      );
    }
  };

  const handleDecreaseRole = (role) => {
    // Find a selected position on the pitch of this role to remove
    const candidate = ALL_POSITIONS.find(
      (pos) => pos.role === role && selectedPositionIds.includes(pos.id)
    );
    
    if (candidate) {
      setSelectedPositionIds((prev) => prev.filter((id) => id !== candidate.id));
    }
  };

  const handleMaxPlayersOtherChange = (text) => {
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits) {
      setMaxPlayersOther("");
      return;
    }
    const num = parseInt(digits, 10);
    const limit = SPORT_LIMITS[sport]?.maxPlayers || 4;
    setMaxPlayersOther(String(Math.min(num, limit)));
  };

  const handleCostChange = (text) => {
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits) {
      setCostPerPerson("");
      return;
    }
    const num = parseInt(digits, 10);
    setCostPerPerson(String(num));
  };

  const handleBenchTeam1Change = (text) => {
    const digits = text.replace(/[^0-9]/g, "");
    const val = digits ? String(Math.min(parseInt(digits, 10), 3)) : "";
    setBenchMembersTeam1(val);
  };

  const handleBenchTeam2Change = (text) => {
    const digits = text.replace(/[^0-9]/g, "");
    const val = digits ? String(Math.min(parseInt(digits, 10), 3)) : "";
    setBenchMembersTeam2(val);
  };

  const togglePosition = (id) => {
    const isTeam1 = id.startsWith("t1_");
    const limit = (FOOTBALL_FORMATS[footballMaxPlayers] || FOOTBALL_FORMATS[22]).playerCountPerTeam;

    if (selectedPositionIds.includes(id)) {
      setSelectedPositionIds((prev) => prev.filter((x) => x !== id));
    } else {
      const teamCount = selectedPositionIds.filter((x) => x.startsWith(isTeam1 ? "t1_" : "t2_")).length;
      if (teamCount >= limit) {
        Alert.alert(
          "Giới hạn đội hình",
          `Mỗi đội chỉ được chọn tối đa ${limit} vị trí cần tìm cho sơ đồ ${(FOOTBALL_FORMATS[footballMaxPlayers] || FOOTBALL_FORMATS[22]).label}.`
        );
        return;
      }
      setSelectedPositionIds((prev) => [...prev, id]);
    }
  };

  // Build role summary from selected positions
  const selectedRoleSummary = useMemo(() => {
    const counts = {};
    ALL_POSITIONS.filter((p) => selectedPositionIds.includes(p.id)).forEach((p) => {
      counts[p.role] = (counts[p.role] || 0) + 1;
    });
    return counts;
  }, [selectedPositionIds]);

  const roleLabels = {
    goalkeeper: "Thủ môn",
    defender: "Hậu vệ",
    midfielder: "Tiền vệ",
    striker: "Tiền đạo",
  };

  const buildPayload = () => {
    const maxPlayers = sport === "football"
      ? (totalNeeded > 0 ? Math.min(totalNeeded, activeTotalPeople) : activeTotalPeople)
      : activeTotalPeople;
    // Build positionsNeeded from selected positions for backward-compat
    const positionsNeeded = Object.entries(selectedRoleSummary).map(([role, qty]) => ({
      key: role,
      label: roleLabels[role] || role,
      quantity: qty,
    }));

    const b1 = Number(benchMembersTeam1 || 0);
    const b2 = Number(benchMembersTeam2 || 0);

    return {
      sport,
      title: title.trim(),
      date: formatDate(selectedDate),
      startTime: selectedTimeSlot,
      endTime: endTimeSlot,
      time: `${selectedTimeSlot} - ${endTimeSlot}`,
      totalHours: calculateTotalHours(selectedTimeSlot, endTimeSlot),
      totalCourtCost: Math.round(Number(costPerPerson || 0) * calculateTotalHours(selectedTimeSlot, endTimeSlot)),
      maxPlayers,
      positionsNeeded: sport === "football" ? positionsNeeded : [],
      selectedPositionIds: sport === "football" ? selectedPositionIds : [],
      benchMembers: sport === "football" ? (b1 + b2) : 0,
      benchMembersTeam1: sport === "football" ? b1 : 0,
      benchMembersTeam2: sport === "football" ? b2 : 0,
      costPerPerson: Number(costPerPerson || 0),
      locationName: locationName.trim(),
      location: {
        lat: locationCoords?.lat || null,
        lng: locationCoords?.lng || null,
        address: locationName.trim(),
      },
      note: note.trim(),
      contactPhone: contactPhone.trim(),
      contactZalo: contactZalo.trim(),
      contactFacebook: contactFacebook.trim(),
      courtDescription: courtDescription.trim(),
      specificAddress: specificAddress.trim(),
      skillLevel,
      serviceCost: serviceCost ? String(serviceCost) : "",
      chatGroupId: selectedChatGroupId || (editMatch?.chatGroupId?._id || editMatch?.chatGroupId) || null,
      contactAppUser: selectedContactUser ? (selectedContactUser._id || selectedContactUser.id) : null,
      ...(isEditMode ? {} : { createdBy: user?.id || user?._id || null }),
    };
  };

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
    if (sport === "football" && totalNeeded === 0) {
      Alert.alert("Thiếu thông tin", "Vui lòng chọn ít nhất 1 vị trí cần tìm trên sơ đồ");
      return false;
    }
    if (sport !== "football" && (!maxPlayersOther || Number(maxPlayersOther) <= 0)) {
      Alert.alert("Dữ liệu không hợp lệ", "Số người tham gia phải lớn hơn 0");
      return false;
    }
    if (sport === "football") {
      if (benchMembersTeam1 && Number(benchMembersTeam1) > 3) {
        Alert.alert("Dữ liệu không hợp lệ", "Đội 1 tối đa là 3 thành viên dự bị");
        return false;
      }
      if (benchMembersTeam2 && Number(benchMembersTeam2) > 3) {
        Alert.alert("Dữ liệu không hợp lệ", "Đội 2 tối đa là 3 thành viên dự bị");
        return false;
      }
    }
    if (!contactPhone || contactPhone.trim() === "") {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập số điện thoại liên hệ");
      return false;
    }
    if (!/^\d{1,11}$/.test(contactPhone)) {
      Alert.alert("Dữ liệu không hợp lệ", "Số điện thoại chỉ được chứa chữ số và tối đa 11 ký tự");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      if (!validateForm()) return;

      if (isEditMode) {
        if (editMatch?.teamStatus === "ongoing") {
          Alert.alert("Thông báo", "Trận đấu đang diễn ra, không thể Sửa.");
          return;
        }
        if (isMatchStartingWithinOneHour(editMatch)) {
          Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 1 tiếng (hoặc đã diễn ra), không thể Chỉnh sửa!");
          return;
        }
      }

      const payload = buildPayload();

      const processSave = async () => {
        try {
          if (isEditMode) {
            await updateMatch(editMatch._id, payload, token);
            Alert.alert("Thành công", "Cập nhật trận đấu thành công", [
              {
                text: "OK",
                onPress: () => {
                  if (navigation) {
                    navigation.setParams({ editMatch: null });
                    navigation.navigate("Home", { screen: "MatchesTab" });
                  }
                }
              }
            ]);
          } else {
            await createMatch(payload, token);
            Alert.alert(
              "Thành công 🎉",
              "Đã tạo trận đấu thành công!",
              [
                {
                  text: "OK",
                  onPress: () => {
                    if (navigation) {
                      navigation.setParams({ editMatch: null });
                      navigation.navigate("Home", { screen: "MatchesTab" });
                    }
                  }
                }
              ]
            );
          }
        } catch (error) {
          Alert.alert("Lỗi", error.message);
        }
      };

      const b1 = Number(benchMembersTeam1 || 0);
      const b2 = Number(benchMembersTeam2 || 0);
      const hasNoBench = (b1 === 0 && b2 === 0);

      if (!isEditMode && hasNoBench) {
        Alert.alert(
          "Thông báo vị trí dự bị ",
          "Trận đấu này chưa chọn vị trí dự bị nào. Bạn vẫn có thể tiếp tục tạo trận đấu!",
          [
            { text: "Tiếp tục tạo trận", onPress: processSave },
            { text: "Hủy ", style: "cancel" },
          ]
        );
      } else {
        await processSave();
      }
    } catch (error) {
      Alert.alert("Lỗi", error.message);
    }
  };

  const isMatchStartingWithinOneHour = (matchObj) => {
    if (!matchObj || !matchObj.date) return false;
    try {
      let year, month, day;
      if (matchObj.date.includes("/")) {
        const parts = matchObj.date.split("/").map(Number);
        day = parts[0];
        month = parts[1];
        year = parts[2];
      } else if (matchObj.date.includes("-")) {
        const parts = matchObj.date.split("-");
        if (parts[0].length === 4) {
          year = Number(parts[0]);
          month = Number(parts[1]);
          day = Number(parts[2]);
        } else {
          day = Number(parts[0]);
          month = Number(parts[1]);
          year = Number(parts[2]);
        }
      } else {
        return false;
      }

      const startStr = matchObj.startTime || "19:00";
      const [h, m] = startStr.split(":").map(Number);

      const matchStart = new Date(year, month - 1, day, h || 0, m || 0, 0);
      const now = new Date();

      const diffMs = matchStart.getTime() - now.getTime();
      return diffMs <= 60 * 60 * 1000;
    } catch (e) {
      return false;
    }
  };

  const handleDelete = () => {
    if (editMatch?.teamStatus === "ongoing") {
      Alert.alert("Thông báo", "Trận đấu đang diễn ra, không thể xóa!");
      return;
    }
    if (isMatchStartingWithinOneHour(editMatch)) {
      Alert.alert("Thông báo", "Trận đấu sắp diễn ra trong vòng 1 tiếng (hoặc đã diễn ra), không thể Xóa!");
      return;
    }
    Alert.alert(
      "Xác nhận xóa trận đấu",
      "Bạn có chắc chắn muốn xóa trận đấu này không? Thao tác này sẽ hủy trận và không thể hoàn tác.",
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa trận đấu",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await deleteMatch(editMatch._id, token);
              if (res?.isDeleted) {
                Alert.alert("Thành công", res.message || "Đã xóa trận đấu thành công.");
                navigation.navigate("Home", { screen: "MatchesTab" });
              } else if (res?.pendingVote) {
                Alert.alert("Biểu quyết xóa", res.message);
                navigation.navigate("Home", { screen: "MatchesTab" });
              } else {
                Alert.alert("Thông báo", res.message || "Đã xử lý yêu cầu.");
              }
            } catch (error) {
              Alert.alert("Lỗi", error.message);
            }
          },
        },
      ]
    );
  };

  // ─── Pitch Selection Modal ────────────────────────────────────────────────
  const renderPitchModal = () => (
    <Modal
      visible={showPitchModal}
      animationType="slide"
      transparent={false}
      onRequestClose={() => setShowPitchModal(false)}
    >
      <View style={pitchModal.safeArea}>
        {/* Header */}
        <View style={pitchModal.header}>
          <TouchableOpacity
            style={pitchModal.closeBtn}
            onPress={() => setShowPitchModal(false)}
          >
            <Text style={pitchModal.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={pitchModal.title}>Chọn vị trí cần tìm</Text>
          <TouchableOpacity
            style={pitchModal.doneBtn}
            onPress={() => setShowPitchModal(false)}
          >
            <Text style={pitchModal.doneBtnText}>Xong</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={pitchModal.scrollContent}
        >
          {/* Instruction */}
          <Text style={pitchModal.instruction}>
            Nhấn vào từng vị trí trên sơ đồ để chọn cần tìm
          </Text>

          {/* Legend */}
          <RoleLegend />

          {/* Count badge */}
          <View style={pitchModal.countBadge}>
            <Text style={pitchModal.countBadgeText}>
              Đã chọn:{" "}
              <Text style={pitchModal.countBadgeNum}>{selectedPositionIds.length}</Text>
              {" "}vị trí
            </Text>
          </View>

          {/* Pitch */}
          {sport === "football" ? (
            <FootballPitch
              selectedIds={selectedPositionIds}
              onToggle={togglePosition}
              maxPlayers={footballMaxPlayers}
            />
          ) : (
            <RacketCourt
              maxPlayers={racketMaxPlayers}
              sport={sport}
              selectedIds={selectedPositionIds}
              onToggle={togglePosition}
            />
          )}

          {/* Role adjustment */}
          <View style={pitchModal.breakdownBox}>
            <Text style={pitchModal.breakdownTitle}>Vị trí cần tìm:</Text>
            <View style={pitchModal.adjustableRolesContainer}>
              {Object.entries(roleLabels).map(([role, label]) => {
                const qty = selectedRoleSummary[role] || 0;
                
                // Total dots on the entire field for this role
                const totalAvailable = ALL_POSITIONS.filter((pos) => pos.role === role).length;
                
                const limit = (FOOTBALL_FORMATS[footballMaxPlayers] || FOOTBALL_FORMATS[22]).playerCountPerTeam;
                const t1Count = selectedPositionIds.filter((id) => id.startsWith("t1_")).length;
                const t2Count = selectedPositionIds.filter((id) => id.startsWith("t2_")).length;
                
                const isMaxReached = (t1Count >= limit && t2Count >= limit) || qty >= totalAvailable;

                return (
                  <View key={role} style={pitchModal.adjustableRoleRow}>
                    <View style={pitchModal.adjustableRoleLeft}>
                      <View style={[pitchModal.breakdownDot, { backgroundColor: ROLE_COLORS[role], marginRight: 8 }]} />
                      <Text style={[pitchModal.adjustableRoleLabel, { color: ROLE_COLORS[role] || "#333", fontWeight: "700" }]}>
                        {label}
                      </Text>
                      <Text style={pitchModal.adjustableRoleLimit}>
                        {"  "}(đã chọn {qty})
                      </Text>
                    </View>
                    <View style={pitchModal.counterRow}>
                      <TouchableOpacity
                        style={[pitchModal.counterBtn, qty === 0 && pitchModal.counterBtnDisabled]}
                        onPress={() => handleDecreaseRole(role)}
                        disabled={qty === 0}
                        activeOpacity={0.6}
                      >
                        <Text style={pitchModal.counterBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={pitchModal.counterVal}>{qty}</Text>
                      <TouchableOpacity
                        style={[pitchModal.counterBtn, isMaxReached && pitchModal.counterBtnDisabled]}
                        onPress={() => handleIncreaseRole(role)}
                        disabled={isMaxReached}
                        activeOpacity={0.6}
                      >
                        <Text style={pitchModal.counterBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Status summary */}
            <Text style={{ fontSize: 11, color: "#666", marginTop: 10, fontStyle: "italic", textAlign: "center" }}>
              Đội 1: {selectedPositionIds.filter(id => id.startsWith("t1_")).length}/{(FOOTBALL_FORMATS[footballMaxPlayers] || FOOTBALL_FORMATS[22]).playerCountPerTeam} vị trí • Đội 2: {selectedPositionIds.filter(id => id.startsWith("t2_")).length}/{(FOOTBALL_FORMATS[footballMaxPlayers] || FOOTBALL_FORMATS[22]).playerCountPerTeam} vị trí
            </Text>
          </View>

          {/* Bench */}
          <View style={pitchModal.benchSection}>
            <Text style={pitchModal.benchLabel}>Thành viên dự bị (không bắt buộc)</Text>
            <Text style={pitchModal.benchHint}>Mỗi đội tối đa 3 người dự bị • Để trống nếu không cần</Text>
            <View style={pitchModal.benchRow}>
              {/* Team 1 Bench */}
              <View style={pitchModal.benchCol}>
                <Text style={pitchModal.benchSubLabel}>Đội 1</Text>
                <View style={[styles.inputWrapper, { backgroundColor: "#fff" }]}>
                  <TextInput
                    style={styles.input}
                    value={benchMembersTeam1}
                    onChangeText={handleBenchTeam1Change}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    maxLength={1}
                  />
                  <Text style={styles.currencySuffix}>dự bị</Text>
                </View>
              </View>

              {/* Team 2 Bench */}
              <View style={pitchModal.benchCol}>
                <Text style={pitchModal.benchSubLabel}>Đội 2</Text>
                <View style={[styles.inputWrapper, { backgroundColor: "#fff" }]}>
                  <TextInput
                    style={styles.input}
                    value={benchMembersTeam2}
                    onChangeText={handleBenchTeam2Change}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#bbb"
                    maxLength={1}
                  />
                  <Text style={styles.currencySuffix}>dự bị</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <Screen style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation && navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? "Sửa trận đấu" : "Tạo trận đấu"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Chọn môn thể thao */}
        <Text style={styles.sectionLabel}>Chọn môn thể thao</Text>
        <View style={styles.sportRow}>
          {sports.map((item) => (
            <NeoButton
              key={item.key}
              isSelected={sport === item.key}
              onPress={() => handleSelectSport(item.key)}
            >
              {item.key === "badminton" && (
                <TagIcon
                  tagName="Cầu lông"
                  size={32}
                  color={sport === "badminton" ? ORANGE : "#333"}
                />
              )}
              {item.key === "football" && (
                <TagIcon
                  tagName="Bóng đá"
                  size={32}
                  color={sport === "football" ? ORANGE : "#333"}
                />
              )}
              {item.key === "pickleball" && (
                <TagIcon
                  tagName="Pickleball"
                  size={32}
                  color={sport === "pickleball" ? ORANGE : "#333"}
                />
              )}
            </NeoButton>
          ))}
        </View>

        {/* Chọn loại sân */}
        <Text style={styles.sectionLabel}>Chọn loại sân</Text>
        <View style={styles.footballMaxPlayersRow}>
          {sport === "football" ? (
            <>
              {[
                { maxPlayers: 10, label: "5 vs 5", count: "10 người" },
                { maxPlayers: 14, label: "7 vs 7", count: "14 người" },
                { maxPlayers: 22, label: "11 vs 11", count: "22 người" },
              ].map((item) => (
                <CourtTypeButton
                  key={item.maxPlayers}
                  label={item.label}
                  subLabel={item.count}
                  isSelected={footballMaxPlayers === item.maxPlayers}
                  onPress={() => handleSelectFootballMaxPlayers(item.maxPlayers)}
                />
              ))}
            </>
          ) : (
            <>
              {[
                { maxPlayers: 2, label: "1 vs 1", count: "2 người" },
                { maxPlayers: 4, label: "2 vs 2", count: "4 người" },
              ].map((item) => (
                <CourtTypeButton
                  key={item.maxPlayers}
                  label={item.label}
                  subLabel={item.count}
                  isSelected={racketMaxPlayers === item.maxPlayers}
                  onPress={() => {
                    setRacketMaxPlayers(item.maxPlayers);
                    setIsCourtPresetsExpanded(true);
                  }}
                />
              ))}
            </>
          )}
        </View>

        {/* Tên trận đấu */}
        <Text style={styles.sectionLabel}>Tên trận đấu</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Anh em giao lưu vui vẻ"
            placeholderTextColor="#bbb"
          />
        </View>

        {/* Ngày & Giờ bắt đầu và kết thúc */}
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeCol}>
            <Text style={styles.sectionLabel}>Ngày/ tháng/ Năm</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.pickerButtonText}>
                {formatDate(selectedDate)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Giờ bắt đầu và kết thúc</Text>
        <View style={styles.dateTimeRow}>
          <View style={styles.dateTimeCol}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280", marginBottom: 4 }}>
              Giờ bắt đầu
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowStartTimePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.pickerButtonText}>
                🕐 {getTimeLabel(selectedTimeSlot)}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dateTimeCol}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: "#6B7280", marginBottom: 4 }}>
              Giờ kết thúc
            </Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowEndTimePicker(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.pickerButtonText}>
                🕕 {getTimeLabel(endTimeSlot)}
              </Text>
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

        {/* Time Pickers (Start & End) */}
        {/* Start Time Android */}
        {showStartTimePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={getTimeDate(selectedTimeSlot, 19, 0)}
            mode="time"
            display="spinner"
            is24Hour={true}
            onChange={onStartTimeChange}
          />
        )}
        {/* Start Time iOS */}
        {Platform.OS === "ios" && (
          <Modal visible={showStartTimePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.timeModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>🕐 Chọn giờ bắt đầu</Text>
                  <TouchableOpacity onPress={() => setShowStartTimePicker(false)}>
                    <Text style={styles.modalDone}>Xong</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={getTimeDate(selectedTimeSlot, 19, 0)}
                  mode="time"
                  display="spinner"
                  is24Hour={true}
                  onChange={onStartTimeChange}
                  style={{ height: 200 }}
                  locale="vi-VN"
                />
              </View>
            </View>
          </Modal>
        )}

        {/* End Time Android */}
        {showEndTimePicker && Platform.OS === "android" && (
          <DateTimePicker
            value={getTimeDate(endTimeSlot, 20, 30)}
            mode="time"
            display="spinner"
            is24Hour={true}
            onChange={onEndTimeChange}
          />
        )}
        {/* End Time iOS */}
        {Platform.OS === "ios" && (
          <Modal visible={showEndTimePicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.timeModalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>🕕 Chọn giờ kết thúc</Text>
                  <TouchableOpacity onPress={() => setShowEndTimePicker(false)}>
                    <Text style={styles.modalDone}>Xong</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={getTimeDate(endTimeSlot, 20, 30)}
                  mode="time"
                  display="spinner"
                  is24Hour={true}
                  onChange={onEndTimeChange}
                  style={{ height: 200 }}
                  locale="vi-VN"
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Sơ đồ & Số người cần tìm – chỉ hiện với bóng đá */}
        {sport === "football" && (
          <>
            <Text style={styles.sectionLabel}>Vị trí cần tìm ( tùy chọn)</Text>

            <View style={styles.pitchTriggerContainer}>
              <View style={styles.pitchTriggerShadow} />
              <TouchableOpacity
                style={styles.pitchTriggerContent}
                onPress={() => setShowPitchModal(true)}
                activeOpacity={0.9}
              >
                <View style={styles.pitchTriggerLeft}>
                  <SoccerFieldIcon color="#1A1A1A" />
                  <View style={styles.pitchTriggerTextContainer}>
                    <Text style={styles.pitchTriggerTitle}>
                      {`Sơ đồ vị trí ( ${footballMaxPlayers === 10 ? "5vs 5" : footballMaxPlayers === 14 ? "7vs 7" : "11vs 11"} )`}
                    </Text>
                    <Text style={styles.pitchTriggerSub}>Nhấn để mở sơ đồ</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Role chips summary */}
            {(selectedPositionIds.length > 0 || Number(benchMembersTeam1 || 0) > 0 || Number(benchMembersTeam2 || 0) > 0) && (
              <View style={styles.roleChipsRow}>
                {Object.entries(selectedRoleSummary).map(([role, qty]) => (
                  <View key={role} style={styles.roleChip}>
                    <Text style={styles.roleChipText}>
                      {roleLabels[role]} x{qty}
                    </Text>
                  </View>
                ))}
                {Number(benchMembersTeam1 || 0) > 0 && (
                  <View style={styles.roleChip}>
                    <Text style={styles.roleChipText}>
                      Dự bị Đội 1 x{benchMembersTeam1}
                    </Text>
                  </View>
                )}
                {Number(benchMembersTeam2 || 0) > 0 && (
                  <View style={styles.roleChip}>
                    <Text style={styles.roleChipText}>
                      Dự bị Đội 2 x{benchMembersTeam2}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </>
        )}

        <Text style={styles.sectionLabel}>Số người cần tìm</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={
              sport === "football"
                ? (totalNeeded > 0 ? `${totalNeeded} người` : "")
                : (selectedPositionIds.length > 0 ? `${selectedPositionIds.length} người` : "Chưa chọn (Tự do)")
            }
           
          />
        </View>

        {/* Notice Banner & Địa điểm sân (Short title) */}
        <Text style={styles.sectionLabel}>Địa điểm sân</Text>

        <View style={{
          backgroundColor: "#FFFBEB",
          borderWidth: 1,
          borderColor: "#FCD34D",
          borderRadius: 12,
          padding: 10,
          marginBottom: 10,
          flexDirection: "row",
          gap: 8,
          alignItems: "flex-start",
        }}>
          <Ionicons name="warning" size={18} color="#D97706" style={{ marginTop: 2 }} />
          <Text style={{ flex: 1, fontSize: 12, color: "#92400E", lineHeight: 17, fontWeight: "500" }}>
            <Text style={{ fontWeight: "700" }}>Lưu ý: </Text>
            VibeSport chỉ cung cấp thông tin sân. Vui lòng liên hệ sân để xác nhận tình trạng còn trống trước khi tạo hoặc tham gia trận đấu.
          </Text>
        </View>

        {/* Sleek Court Picker Card matching User Image design */}
        {!isCourtPresetsExpanded ? (
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: isEditMode ? "#F3F4F6" : "#FFFFFF",
              borderRadius: 24,
              height: 56,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              elevation: 1,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.04,
              shadowRadius: 3,
              marginBottom: 12,
            }}
            onPress={() => {
              if (isEditMode) {
                Alert.alert("Thông báo", "Không thể thay đổi sân thi đấu khi sửa trận đấu.");
                return;
              }
              setIsCourtPresetsExpanded(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name={isEditMode ? "lock-closed" : "location-outline"} size={22} color={isEditMode ? "#9CA3AF" : "#1F2937"} style={{ marginRight: 12 }} />
            
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: selectedCourtObj || specificAddress ? "#111827" : "#6B7280" }} numberOfLines={1}>
                {selectedCourtObj 
                  ? selectedCourtObj.name 
                  : (specificAddress || "Chọn sân")}
              </Text>
              {selectedCourtObj ? (
                <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }} numberOfLines={1}>
                  {selectedCourtObj.address}
                </Text>
              ) : null}
            </View>

            {isEditMode ? (
              <Text style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic", marginLeft: 6 }}>Sân cố định</Text>
            ) : (
              <Ionicons name="chevron-down" size={22} color="#6B7280" style={{ marginLeft: 8 }} />
            )}
          </TouchableOpacity>
        ) : (
          <View style={{
            backgroundColor: "#FFFFFF",
            borderRadius: 20,
            padding: 14,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            elevation: 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            marginBottom: 12,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="location-outline" size={22} color="#1F2937" />
                <Text style={{ fontSize: 15, fontWeight: "700", color: "#111827" }}>
                  Chọn sân 
                </Text>
              </View>
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={() => setIsCourtPresetsExpanded(false)}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-up" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
              {[
                { mode: "preset", label: "Mẫu sân" },
                { mode: "map", label: "Bản đồ" },
                { mode: "custom", label: "Tự nhập" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.mode}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 16,
                    backgroundColor: addressInputType === item.mode ? ORANGE : "#F3F4F6",
                    alignItems: "center",
                  }}
                  onPress={() => handleSwitchAddressInputType(item.mode)}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: addressInputType === item.mode ? "#fff" : "#374151",
                    fontSize: 13,
                    fontWeight: "600"
                  }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mẫu sân list */}
            {addressInputType === "preset" && (
              <View style={{ gap: 8 }}>
                {filteredCourts.map((court) => {
                  const isSelected = Boolean(selectedCourtObj) && Boolean(
                    (court._id && selectedCourtObj._id === court._id) ||
                    (court.id && selectedCourtObj.id === court.id) ||
                    (court.name && selectedCourtObj.name === court.name)
                  );
                  
                  const activePitchKey = sport === "football"
                    ? (footballMaxPlayers === 10 ? "5v5" : footballMaxPlayers === 14 ? "7v7" : "11v11")
                    : (racketMaxPlayers === 2 ? "1v1" : "2v2");

                  const activePitchDisplayTag = sport === "football"
                    ? (footballMaxPlayers === 10 ? "Sân 5v5" : footballMaxPlayers === 14 ? "Sân 7v7" : "Sân 11v11")
                    : (racketMaxPlayers === 2 ? "Sân 1v1" : "Sân 2v2");

                  let isSupported = true;
                  let priceForActiveType = court.hourlyRate || court.priceFrom || 300000;

                  if (Array.isArray(court.pitchOptions) && court.pitchOptions.length > 0) {
                    const opt = court.pitchOptions.find((o) => o.pitchType === activePitchKey);
                    if (opt && opt.pricePerHour) {
                      isSupported = true;
                      priceForActiveType = opt.pricePerHour;
                    } else {
                      isSupported = false;
                    }
                  } else if (court.pricesByPitchType) {
                    const pKey = footballMaxPlayers === 10 ? "Sân 5" : footballMaxPlayers === 14 ? "Sân 7" : "Sân 11";
                    if (court.pricesByPitchType[pKey]) {
                      isSupported = true;
                      priceForActiveType = court.pricesByPitchType[pKey];
                    } else {
                      isSupported = false;
                    }
                  } else if (court.pitchTypes || court.fieldTypes) {
                    const types = court.pitchTypes || court.fieldTypes;
                    const targetDigit = footballMaxPlayers === 10 ? "5" : footballMaxPlayers === 14 ? "7" : "11";
                    isSupported = types.some((t) => String(t).includes(targetDigit));
                    if (isSupported) {
                      const pFrom = Number(court.priceFrom || 300000);
                      const pTo = Number(court.priceTo || pFrom * 2);
                      priceForActiveType = footballMaxPlayers === 10 ? pFrom : footballMaxPlayers === 14 ? Math.round((pFrom + pTo) / 2) : (pTo >= 900000 ? pTo : Math.round(pFrom * 2.5));
                    }
                  }

                  return (
                    <TouchableOpacity
                      key={court._id || court.id || `court_${court.name}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        padding: 12,
                        backgroundColor: isSelected ? "#FFF7ED" : isSupported ? "#F9FAFB" : "#F3F4F6",
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: isSelected ? ORANGE : "#E5E7EB",
                        opacity: isSupported ? 1 : 0.45,
                        gap: 10,
                      }}
                      onPress={() => {
                        if (!isSupported) {
                          Alert.alert("Sân không hỗ trợ", `${court.name} không có sẵn loại ${activePitchDisplayTag}. Vui lòng chọn sân khác.`);
                          return;
                        }

                        // Bấm thêm 1 lần nữa => Bỏ chọn sân
                        if (isSelected) {
                          setSelectedCourtObj(null);
                          setLocationName("");
                          setSpecificAddress("");
                          setCourtDescription("");
                          setLocationCoords(null);
                          setSelectedContactUser(null);
                          setContactPhone(normalizePhone(""));
                          setServiceCost("");
                          setServiceCostMin("");
                          setServiceCostMax("");
                          return;
                        }

                        // Chọn sân
                        setSelectedCourtObj(court);
                        setLocationName(court.name);
                        setSpecificAddress(court.address);
                        setCourtDescription(court.intro || court.description);
                        setCostPerPerson(String(priceForActiveType));
                        // Tính giá DV range từ serviceDetails
                        const dMin = court.serviceDetails?.drinkService?.minPrice || 10000;
                        const dMax = court.serviceDetails?.drinkService?.maxPrice || 25000;
                        const eMin = court.serviceDetails?.equipmentService?.minPrice || 30000;
                        const eMax = court.serviceDetails?.equipmentService?.maxPrice || 60000;
                        const overallMin = Math.min(dMin, eMin);
                        const overallMax = Math.max(dMax, eMax);
                        setServiceCost(`${overallMin}-${overallMax}`);
                        setServiceCostMin(String(overallMin));
                        setServiceCostMax(String(overallMax));
                        setLocationCoords(court.locationCoords || court.coords);
                        const targetOwner = (typeof court.owner === "object" && court.owner !== null)
                          ? court.owner
                          : (court.ownerUser || {
                            _id: typeof court.owner === "string" ? court.owner : (court.ownerId || "6a6465f17b201152379c08cc"),
                            id: typeof court.owner === "string" ? court.owner : (court.ownerId || "6a6465f17b201152379c08cc"),
                            name: court.ownerName || court.contactName || (court.name ? `Chủ sân ${court.name}` : "Chủ sân"),
                            phone: court.phone || court.contactPhone || "",
                            picture: court.ownerPicture || null,
                          });

                        setSelectedContactUser(targetOwner);
                        setContactPhone(normalizePhone(targetOwner.phone || targetOwner.phoneNumber || court.phone || ""));
                        setIsCourtPresetsExpanded(false);
                      }}
                    >
                      <Ionicons
                        name={isSelected ? "radio-button-on" : "radio-button-off"}
                        size={18}
                        color={isSelected ? ORANGE : "#9CA3AF"}
                      />
                      <View style={{ flex: 1 }}>
                        {/* 1. Tên sân & Tag môn */}
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <Text style={{ fontSize: 14, color: isSupported ? "#111827" : "#9CA3AF", fontWeight: "700", flex: 1 }}>
                            {court.name}
                          </Text>
                          {(() => {
                            const tagMap = {
                              football: { label: "Bóng đá", bg: "#ECFDF5", color: "#047857", border: "#A7F3D0" },
                              badminton: { label: "Cầu lông", bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
                              pickleball: { label: "Pickleball", bg: "#F3E8FF", color: "#7E22CE", border: "#E9D5FF" },
                            };
                            const tag = tagMap[court.sportType] || tagMap.football;
                            return (
                              <View style={{
                                backgroundColor: tag.bg,
                                borderColor: tag.border,
                                borderWidth: 1,
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                                borderRadius: 10,
                              }}>
                                <Text style={{ color: tag.color, fontSize: 10, fontWeight: "700" }}>
                                  {tag.label}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>

                        {/* Thông báo nếu không hỗ trợ */}
                        {!isSupported && (
                          <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600", marginTop: 2 }}>
                            (Không hỗ trợ {activePitchDisplayTag})
                          </Text>
                        )}

                        {/* 2. Địa điểm */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                          <Ionicons name="location-outline" size={13} color="#6B7280" />
                          <Text style={{ fontSize: 12, color: "#6B7280" }} numberOfLines={1}>
                            {court.address}
                          </Text>
                        </View>

                        {/* 3, 4 & Tag Giá Dịch Vụ */}
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                          <View style={{
                            backgroundColor: "#FFF7ED",
                            borderWidth: 1,
                            borderColor: "#FFD8A8",
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8,
                          }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: "#C2410C" }}>
                              {activePitchDisplayTag}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12.5, color: ORANGE, fontWeight: "800" }}>
                            {formatNumberWithDots(String(priceForActiveType))}đ / giờ
                          </Text>

                          <View style={{
                            backgroundColor: "#F3F4F6",
                            borderWidth: 1,
                            borderColor: "#E5E7EB",
                            paddingHorizontal: 7,
                            paddingVertical: 2.5,
                            borderRadius: 6,
                            marginLeft: "auto",
                          }}>
                            <Text style={{ fontSize: 10.5, color: "#374151", fontWeight: "600" }}>
                              {(() => {
                                const { min, max } = getServiceCostRange();
                                const fmt = (n) => formatNumberWithDots(String(n));
                                return `Giá DV: ${fmt(min)}–${fmt(max)}đ`;
                              })()}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Map link option */}
            {addressInputType === "map" && (
              <View style={{ gap: 10 }}>
                <View style={{ height: 220, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#E5E7EB" }}>
                  <WebView
                    originWhitelist={["*"]}
                    source={{ html: inlineGoogleMapHtml(locationCoords?.lat, locationCoords?.lng) }}
                    style={{ flex: 1 }}
                    onMessage={async (event) => {
                      try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === "location" && data.lat != null && data.lng != null) {
                          const newCoords = { lat: data.lat, lng: data.lng };
                          setLocationCoords(newCoords);
                          try {
                            const resp = await fetch(
                              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.lat}&lon=${data.lng}&zoom=18&addressdetails=1&accept-language=vi`,
                              { headers: { 'User-Agent': 'VibeSportMobile/1.0' } }
                            );
                            const json = await resp.json();
                            if (json && json.display_name) {
                              setLocationName(json.display_name);
                              setSpecificAddress(json.display_name);
                            }
                          } catch (e) {}
                        }
                      } catch (e) {}
                    }}
                    scrollEnabled={false}
                  />
                </View>

                {/* Ô hiển thị & nhập Vị trí/Địa chỉ đã chọn từ bản đồ */}
                <View style={{ marginTop: 2 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 6 }}>
                    📍 Vị trí / Địa chỉ chọn từ bản đồ:
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: (locationName || specificAddress) ? "#FFF7ED" : "#F9FAFB",
                        borderColor: (locationName || specificAddress) ? "#FFD8A8" : "#E5E7EB",
                        color: (locationName || specificAddress) ? "#C2410C" : "#111827",
                        fontWeight: "600",
                        fontSize: 13.5,
                        minHeight: 46,
                      },
                    ]}
                    value={locationName || specificAddress}
                    onChangeText={(text) => {
                      setLocationName(text);
                      setSpecificAddress(text);
                    }}
                    placeholder="Chạm trên bản đồ hoặc bấm nút dưới để chọn vị trí..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                  />
                </View>

                <TouchableOpacity
                  style={styles.mapLink}
                  onPress={() =>
                    navigation.navigate("MapPicker", {
                      currentLocation: locationCoords,
                      currentAddress: locationName || specificAddress,
                      formDraft: buildFormDraft(),
                    })
                  }
                  activeOpacity={0.8}
                >
                  <Ionicons name="map-outline" size={18} color={ORANGE} style={styles.mapLinkIcon} />
                  <Text style={styles.mapLinkText}>📌 Mở rộng bản đồ Google Maps toàn màn hình</Text>
                </TouchableOpacity>

                {locationCoords && (
                  <View style={[styles.coordBadge, { marginTop: 2 }]}>
                    <Text style={styles.coordBadgeText}>
                      ✓ Tọa độ Google Maps: {locationCoords.lat.toFixed(4)}, {locationCoords.lng.toFixed(4)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Tự nhập option */}
            {addressInputType === "custom" && (
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={specificAddress}
                  onChangeText={(text) => {
                    setSpecificAddress(text);
                    setLocationName(text);
                  }}
                  placeholder="Nhập địa chỉ"
                  placeholderTextColor="#bbb"
                />
              </View>
            )}
          </View>
        )}

        {/* Mô tả sân (Short title) */}
        

        {selectedCourtObj ? (
          <TouchableOpacity
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#EFF6FF",
              borderWidth: 1,
              borderColor: "#BFDBFE",
              padding: 10,
              borderRadius: 10,
              marginBottom: 8,
              gap: 6,
            }}
            onPress={() => setShowCourtDetailModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="information-circle" size={18} color="#2563EB" />
            <Text style={{ color: "#2563EB", fontWeight: "700", fontSize: 12.5 }}>
              Chi tiết {selectedCourtObj.name} 
            </Text>
          </TouchableOpacity>
        ) : null}

        

        {/* Giá thuê 1 giờ */}
        <Text style={styles.sectionLabel}>Giá thuê 1 giờ</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, styles.costInput]}
            value={formatNumberWithDots(costPerPerson)}
            onChangeText={handleCostChange}
            keyboardType="numeric"
            placeholder="100.000"
            placeholderTextColor="#bbb"
          />
          <Text style={styles.currencySuffix}>VND</Text>
        </View>

        {/* Tính toán Tổng giờ thuê & Tổng tiền thuê sân */}
        {(() => {
          const pricePerHourNum = Number(costPerPerson || 0);
          const totalHours = calculateTotalHours(selectedTimeSlot, endTimeSlot);
          const totalCourtCost = Math.round(pricePerHourNum * totalHours);

          return (
            <View style={{
              backgroundColor: "#FFF7ED",
              borderRadius: 14,
              borderWidth: 1.5,
              borderColor: "#FFD8A8",
              padding: 12,
              marginBottom: 14,
              gap: 8,
            }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151" }}>
                  Tổng giờ thuê:
                </Text>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#111827" }}>
                  {totalHours % 1 === 0 ? totalHours.toFixed(0) : totalHours.toFixed(1)} giờ ({selectedTimeSlot} - {endTimeSlot})
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: "#FFE8D6" }} />

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#C2410C" }}>
                   Tổng tiền thuê sân:
                </Text>
                <Text style={{ fontSize: 15, fontWeight: "800", color: ORANGE }}>
                  {formatNumberWithDots(String(totalCourtCost))} VND
                </Text>
              </View>

              <View style={{ height: 1, backgroundColor: "#FFE8D6" }} />

              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#059669" }}>
                  💵 Giá thuê 1 người:
                </Text>
                <Text style={{ fontSize: 14.5, fontWeight: "800", color: "#059669" }}>
                  {formatNumberWithDots(String(Math.round(totalCourtCost / Math.max(activeTotalPeople, 1))))} VND 
                </Text>
              </View>
            </View>
          );
        })()}

        {/* Chi phí dịch vụ (Short title) */}
        <Text style={styles.sectionLabel}>Giá dịch vụ</Text>
        {selectedCourtObj ? (
          <View style={[styles.inputWrapper, { backgroundColor: "#F3F4F6" }]}>
            <Ionicons name="lock-closed" size={16} color="#9CA3AF" style={{ marginLeft: 12, marginRight: 4 }} />
            <Text style={{ flex: 1, color: "#374151", fontSize: 14, fontWeight: "700", paddingVertical: 12 }}>
              {(() => {
                const minFmt = serviceCostMin ? formatNumberWithDots(serviceCostMin) : "";
                const maxFmt = serviceCostMax ? formatNumberWithDots(serviceCostMax) : "";
                if (minFmt && maxFmt) return `${minFmt} – ${maxFmt} VND`;
                if (minFmt) return `Từ ${minFmt} VND`;
                return serviceCost ? `${formatNumberWithDots(serviceCost)} VND` : "Liên hệ sân";
              })()}
            </Text>
            <Text style={{ fontSize: 11, color: "#9CA3AF", marginRight: 10, fontStyle: "italic" }}>Từ mẫu sân</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Ô nhập Từ ... VND */}
            <View style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FFF",
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 12,
              paddingHorizontal: 12,
            }}>
              <Text style={{ fontSize: 13, color: "#6B7280", fontWeight: "600", marginRight: 4 }}>Từ</Text>
              <TextInput
                style={{ flex: 1, paddingVertical: 10, fontSize: 14, fontWeight: "700", color: "#111827" }}
                value={formatNumberWithDots(serviceCostMin)}
                onChangeText={(text) => {
                  const raw = text.replace(/[^0-9]/g, "");
                  setServiceCostMin(raw);
                  const combined = serviceCostMax ? `${raw}-${serviceCostMax}` : raw;
                  setServiceCost(combined);
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#BBB"
              />
              <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "600", marginLeft: 4 }}>VND</Text>
            </View>

            <Text style={{ fontSize: 14, fontWeight: "700", color: "#6B7280" }}>–</Text>

            {/* Ô nhập Đến ... VND */}
            <View style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#FFF",
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 12,
              paddingHorizontal: 12,
            }}>
              <Text style={{ fontSize: 13, color: "#6B7280", fontWeight: "600", marginRight: 4 }}>Đến</Text>
              <TextInput
                style={{ flex: 1, paddingVertical: 10, fontSize: 14, fontWeight: "700", color: "#111827" }}
                value={formatNumberWithDots(serviceCostMax)}
                onChangeText={(text) => {
                  const raw = text.replace(/[^0-9]/g, "");
                  setServiceCostMax(raw);
                  const combined = serviceCostMin ? `${serviceCostMin}-${raw}` : raw;
                  setServiceCost(combined);
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="#BBB"
              />
              <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "600", marginLeft: 4 }}>VND</Text>
            </View>
          </View>
        )}

        {/* Trình độ (Short title) */}
        <Text style={styles.sectionLabel}>Trình độ</Text>
        <View style={{ flexDirection: "row", gap: 10, marginVertical: 8 }}>
          {["Người mới", "Trung cấp", "Chuyên nghiệp"].map((level) => (
            <TouchableOpacity
              key={level}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: skillLevel === level ? ORANGE : "#f5f5f5",
                borderWidth: 1,
                borderColor: skillLevel === level ? ORANGE : "#e0e0e0",
                alignItems: "center"
              }}
              onPress={() => setSkillLevel(level)}
              activeOpacity={0.7}
            >
              <Text style={{
                color: skillLevel === level ? "#fff" : "#333",
                fontSize: 13,
                fontWeight: "700"
              }}>{level}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Liên hệ chủ sân (Short title) */}
        <Text style={styles.sectionLabel}>Liên hệ chủ sân</Text>
        <View style={{ gap: 10, marginBottom: 12 }}>
          {/* Tag account card / picker */}
          

          {selectedContactUser ? (
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 14,
                backgroundColor: "#FFF7ED",
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: "#FFD8A8",
              }}
              onPress={() => {
                const rawId = typeof selectedContactUser === "object"
                  ? (selectedContactUser._id || selectedContactUser.id)
                  : selectedContactUser;
                const targetId = String(rawId || "6a6465f17b201152379c08cc");
                navigation.navigate("UserProfile", {
                  userId: targetId,
                  initialProfile: selectedContactUser,
                });
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                {selectedContactUser.picture ? (
                  <Image source={{ uri: selectedContactUser.picture }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>{getInitials(selectedContactUser.name)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#333" }} numberOfLines={1}>
                    {selectedContactUser.name}
                  </Text>
                 
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                {selectedCourtObj ? (
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    backgroundColor: "#F3F4F6",
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: "#E5E7EB",
                  }}>
                    <Ionicons name="lock-closed" size={12} color="#6B7280" />
                    <Text style={{ color: "#6B7280", fontSize: 11.5, fontWeight: "700" }}>Gắn liền với sân</Text>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={{ backgroundColor: ORANGE, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                      onPress={handleOpenTagModal}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>Đổi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{ backgroundColor: "#eee", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}
                      onPress={() => setSelectedContactUser(null)}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: "#666", fontSize: 12, fontWeight: "700" }}>Gỡ</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                backgroundColor: "#fff",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#e0e0e0",
                gap: 10
              }}
              onPress={handleOpenTagModal}
              activeOpacity={0.7}
            >
              <Ionicons name="person-add-outline" size={20} color="#666" />
              <Text style={{ color: "#555", fontSize: 13, fontWeight: "500" }}>
                Chọn tài khoản 
              </Text>
            </TouchableOpacity>
          )}

          <View style={[styles.inputWrapper, selectedCourtObj ? { backgroundColor: "#F3F4F6" } : null]}>
            <Ionicons name={selectedCourtObj ? "lock-closed" : "call-outline"} size={16} color={selectedCourtObj ? "#9CA3AF" : "#666"} style={{ marginLeft: 12, marginRight: -4 }} />
            <TextInput
              style={[styles.input, selectedCourtObj ? { color: "#6B7280" } : null]}
              value={contactPhone}
              onChangeText={(val) => { const v = normalizePhone(val); setContactPhone(v); if (contactPhoneError) setContactPhoneError(""); }}
              placeholder="Số điện thoại liên hệ"
              placeholderTextColor="#bbb"
              keyboardType="phone-pad"
              maxLength={11}
              onBlur={handlePhoneBlur}
              editable={!selectedCourtObj}
            />
            {selectedCourtObj && (
              <Text style={{ fontSize: 11, color: "#9CA3AF", marginRight: 10, fontStyle: "italic" }}>Từ mẫu sân</Text>
            )}
          </View>
          {contactPhoneError ? (
            <Text style={{ color: "#dc2626", fontSize: 12, marginTop: 6, marginLeft: 12 }}>{contactPhoneError}</Text>
          ) : null}
        </View>

        {/* Nhóm chat gắn với trận đấu */}
        <Text style={[styles.sectionLabel, { marginBottom: 10, marginTop: 4 }]}>Nhóm chat gắn với trận đấu</Text>

        {/* 2 nút hành động */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: showGroupPickerModal ? "#EFF6FF" : "#F3F4F6",
              paddingVertical: 11,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: showGroupPickerModal ? "#3B82F6" : "#E5E7EB",
            }}
            onPress={() => setShowGroupPickerModal((prev) => !prev)}
            activeOpacity={0.8}
          >
            <Ionicons name="people-outline" size={18} color={showGroupPickerModal ? "#3B82F6" : "#555"} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: showGroupPickerModal ? "#3B82F6" : "#555" }}>Chọn nhóm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              backgroundColor: "#FFF7ED",
              paddingVertical: 11,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: "#FFD8A8",
            }}
            onPress={handleOpenCreateGroupModal}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={18} color={ORANGE} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: ORANGE }}>Tạo nhóm</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginBottom: 14, gap: 8 }}>
          {/* Hiển thị nhóm đang được chọn khi list đóng */}
          {!showGroupPickerModal && selectedChatGroupId !== null && (() => {
            const selectedGroup = userChatGroups.find((g) => String(g._id) === String(selectedChatGroupId));
            if (!selectedGroup) return null;
            return (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#FFF7ED", borderWidth: 1.5, borderColor: ORANGE }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="people" size={18} color="#FFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }} numberOfLines={1}>{selectedGroup.name || "Nhóm chat"}</Text>
                  <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>👥 {selectedGroup.participants?.length || 1} thành viên</Text>
                </View>
                <Ionicons name="checkmark-circle" size={20} color={ORANGE} />
              </View>
            );
          })()}

          {/* Không gắn nhóm chat – luôn hiện */}
          {!showGroupPickerModal && selectedChatGroupId === null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB" }}>
              <Ionicons name="ban" size={16} color="#9CA3AF" />
              <Text style={{ fontSize: 13, color: "#9CA3AF" }}>Chưa gắn nhóm chat nào</Text>
            </View>
          )}

          {/* Danh sách chọn nhóm – hiện khi bấm "Chọn nhóm" */}
          {showGroupPickerModal && (
            <>
              {/* Option: Không gắn */}
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: selectedChatGroupId === null ? "#FFF7ED" : "#FAFAFA",
                  borderWidth: 1.5,
                  borderColor: selectedChatGroupId === null ? ORANGE : "#E5E7EB",
                }}
                onPress={() => { setSelectedChatGroupId(null); setShowGroupPickerModal(false); }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: selectedChatGroupId === null ? ORANGE : "#E5E7EB", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="ban" size={16} color={selectedChatGroupId === null ? "#FFF" : "#6B7280"} />
                  </View>
                  <Text style={{ fontSize: 13.5, fontWeight: "700", color: selectedChatGroupId === null ? ORANGE : "#374151" }}>
                    Không gắn nhóm chat
                  </Text>
                </View>
                {selectedChatGroupId === null && (
                  <Ionicons name="checkmark-circle" size={20} color={ORANGE} />
                )}
              </TouchableOpacity>

              {/* Danh sách các nhóm chat sẵn có */}
              {userChatGroups.length === 0 ? (
                <Text style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13, paddingVertical: 16, fontStyle: "italic" }}>
                  Bạn chưa có nhóm chat nào. Hãy tạo nhóm mới!
                </Text>
              ) : (
                userChatGroups.map((g) => {
                  const isSelected = String(g._id) === String(selectedChatGroupId);
                  const memberCount = g.participants?.length || 1;
                  return (
                    <TouchableOpacity
                      key={g._id}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: isSelected ? "#FFF7ED" : "#FFFFFF",
                        borderWidth: 1.5,
                        borderColor: isSelected ? ORANGE : "#E5E7EB",
                      }}
                      onPress={() => { setSelectedChatGroupId(g._id); setShowGroupPickerModal(false); }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isSelected ? ORANGE : "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="people" size={18} color={isSelected ? "#FFF" : ORANGE} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }} numberOfLines={1}>
                            {g.name || "Nhóm chat"}
                          </Text>
                          <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 1 }}>
                            👥 {memberCount} thành viên
                          </Text>
                        </View>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={20} color={ORANGE} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}
        </View>

        {/* Ghi chú mô tả */}
        <Text style={styles.sectionLabel}>Ghi chú mô tả</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={(text) => {
              if (text.length <= 200) setNote(text);
            }}
            placeholder={`Nhập mô tả`}
            placeholderTextColor="#bbb"
            multiline
            textAlignVertical="top"
          />
        </View>
        <Text style={styles.charCount}>{note.length}/200</Text>

        {/* Bottom spacing for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {!isKeyboardVisible && (
        <View style={styles.bottomButtonContainer}>
          {isEditMode && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} activeOpacity={0.7}>
              <Text style={styles.deleteButtonText}>🗑️ Xóa trận đấu</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.createButton} onPress={handleSubmit} activeOpacity={0.8}>
            <Text style={styles.createButtonText}>
              {isEditMode ? "Lưu thay đổi" : "Tạo trận đấu"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pitch selection modal */}
      {renderPitchModal()}

      <GroupCreationModal
        visible={showInlineCreateGroupModal}
        onClose={() => setShowInlineCreateGroupModal(false)}
        onGroupCreated={() => {
          setShowInlineCreateGroupModal(false);
        }}
      />

      {/* Court Detail Modal */}
      <CourtDetailModal
        visible={showCourtDetailModal}
        court={selectedCourtObj}
        onClose={() => setShowCourtDetailModal(false)}
        navigation={navigation}
      />

      {/* Tag User Modal */}
      <Modal visible={showTagUserModal} animationType="slide">
        <Screen style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => setShowTagUserModal(false)}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Tag tài khoản VibeSport</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={{ padding: 20, flex: 1 }}>
            <View style={[styles.inputWrapper, { marginBottom: 16, height: 50 }]}>
              <Ionicons name="search-outline" size={20} color="#888" style={{ marginLeft: 14, marginRight: -2 }} />
              <TextInput
                style={[styles.input, { fontSize: 15 }]}
                value={searchUserQuery}
                onChangeText={setSearchUserQuery}
                placeholder="Tìm kiếm người bạn đã theo dõi..."
                placeholderTextColor="#bbb"
              />
            </View>

            {loadingFollowing ? (
              <ActivityIndicator size="large" color={ORANGE} style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
                {/* Option 1: Myself */}
                {user && (
                  <TouchableOpacity
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      padding: 16,
                      backgroundColor: selectedContactUser && (selectedContactUser._id || selectedContactUser.id) === (user.id || user._id) ? "#FFF7ED" : "#fff",
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: selectedContactUser && (selectedContactUser._id || selectedContactUser.id) === (user.id || user._id) ? ORANGE : "#e5e7eb",
                      gap: 14,
                    }}
                    onPress={() => handleSelectTagUser(user)}
                    activeOpacity={0.7}
                  >
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: ORANGE, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{getInitials(user.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#333" }}>{user.name} (Chính tôi)</Text>
                      <Text style={{ fontSize: 12.5, color: "#888", marginTop: 2 }}>Tag tài khoản cá nhân của bạn</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={24} color={selectedContactUser && (selectedContactUser._id || selectedContactUser.id) === (user.id || user._id) ? ORANGE : "#ccc"} />
                  </TouchableOpacity>
                )}

                {/* Following Users List */}
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#555", marginTop: 10, marginBottom: 4 }}>
                  Đang theo dõi ({filteredFollowingList.length})
                </Text>

                {filteredFollowingList.length === 0 ? (
                  <Text style={{ textAlign: "center", color: "#999", marginVertical: 30, fontStyle: "italic", fontSize: 14 }}>
                    {searchUserQuery ? "Không tìm thấy người dùng phù hợp" : "Chưa theo dõi người dùng nào"}
                  </Text>
                ) : (
                  filteredFollowingList.map((u) => {
                    const uid = u._id || u.id;
                    const isSelected = selectedContactUser && (selectedContactUser._id || selectedContactUser.id) === uid;
                    return (
                      <TouchableOpacity
                        key={uid}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          padding: 16,
                          backgroundColor: isSelected ? "#FFF7ED" : "#fff",
                          borderRadius: 14,
                          borderWidth: 1.5,
                          borderColor: isSelected ? ORANGE : "#e5e7eb",
                          gap: 14,
                        }}
                        onPress={() => handleSelectTagUser(u)}
                        activeOpacity={0.7}
                      >
                        {u.picture ? (
                          <Image source={{ uri: u.picture }} style={{ width: 46, height: 46, borderRadius: 23 }} />
                        ) : (
                          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#3b82f6", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>{getInitials(u.name)}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: "#333" }}>{u.name}</Text>
                          {u.email ? <Text style={{ fontSize: 12.5, color: "#888", marginTop: 2 }}>{u.email}</Text> : null}
                        </View>
                        <Ionicons name="checkmark-circle" size={24} color={isSelected ? ORANGE : "#ccc"} />
                      </TouchableOpacity>
                    );
                  })
                )}

                {/* Clear tag button */}
                <TouchableOpacity
                  style={{
                    paddingVertical: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#f5f5f5",
                    borderRadius: 12,
                    marginTop: 12,
                  }}
                  onPress={() => {
                    setSelectedContactUser(null);
                    setShowTagUserModal(false);
                  }}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 14 }}>Gỡ tag tài khoản</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </Screen>
      </Modal>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F2F3F5",
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 9,
    marginTop: Platform.OS === 'ios' ? 4 : 8,
    marginBottom: 0,
    height: 58,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderWidth: 1,
    borderColor: 'rgba(99, 94, 94, 0.19)',
    zIndex: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginLeft: 12,
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
    fontSize: 14,
    fontWeight: "600",
    color: "#1A1A1A",
    marginTop: 18,
    marginBottom: 8,
  },

  // Neo-brutalist button wrapper
  neoContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  neoShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  neoContent: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderWidth: 1.5,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Court Type Button wrapper
  courtTypeContainer: {
    position: 'relative',
    flex: 1,
    height: 55,
    marginRight: 5,
  },
  courtTypeShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  courtTypeContent: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courtTypeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  courtTypeSubLabel: {
    fontSize: 11,
    marginTop: 2,
    color: '#888',
  },

  // Pitch preview trigger Neo-brutalist wrapper
  pitchTriggerContainer: {
    position: 'relative',
    width: '100%',
    height: 58,
    marginBottom: 8,
  },
  pitchTriggerShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    backgroundColor: '#CCCCCC',
    borderRadius: 14,
  },
  pitchTriggerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pitchTriggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pitchTriggerTextContainer: {
    justifyContent: 'center',
  },
  pitchTriggerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  pitchTriggerSub: {
    fontSize: 10,
    color: '#888',
    marginTop: 1,
  },

  // Sport Selector
  sportRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
    marginBottom: 4,
  },

  // Football Max Players Selector
  footballMaxPlayersRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },

  // Input
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: "#333",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E8E8",
    paddingHorizontal: 14,
    paddingVertical: 11,
    justifyContent: "center",
  },
  pickerButtonText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    textAlign: "center",
    width: "100%",
  },

  // Modal (date/time pickers)
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
    color: "#FF6B35",
  },

  // Helper text
  helperText: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 6,
    lineHeight: 17,
  },

  // Role chips summary (below trigger)
  roleChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    marginBottom: 4,
  },
  roleChip: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1A1A1A",
  },

  // Cost
  costInput: {
    paddingRight: 4,
  },
  currencySuffix: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    paddingRight: 14,
  },

  // Map link
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 3,
    gap: 4,
  },
  mapLinkIcon: {
    marginRight: 0,
  },
  mapLinkText: {
    fontSize: 12,
    color: "#FF6B35",
    fontWeight: "600",
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
    paddingHorizontal: 15,
    paddingBottom: Platform.OS === "ios" ? 10 : 20,
    paddingTop: 10,
    backgroundColor: "transparent",
    borderTopWidth: 0,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ORANGE, // #FF5F3D
    height: 44,
    borderRadius: 10,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6, 
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 18,
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

  // Find team posts section
  loadingPostsContainer: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ebebeb",
  },
  loadingPostsText: {
    fontSize: 12,
    color: "#666",
    marginTop: 6,
  },
  emptyPostsBox: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderStyle: "dashed",
  },
  emptyPostsText: {
    fontSize: 13,
    color: "#999",
    fontStyle: "italic",
  },
  findTeamScroll: {
    paddingVertical: 4,
    gap: 12,
  },
  findTeamCard: {
    width: 250,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#ffdcd0",
    shadowColor: "#FF6B35",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginRight: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  cardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#eee",
  },
  cardAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  cardMeta: {
    marginLeft: 8,
    flex: 1,
  },
  cardAuthorName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#333",
  },
  cardDate: {
    fontSize: 10,
    color: "#aaa",
  },
  cardContent: {
    fontSize: 12,
    color: "#555",
    lineHeight: 16,
    height: 48,
  },
  cardFooter: {
    marginTop: 8,
    alignItems: "flex-end",
  },
  cardDetailLink: {
    fontSize: 11,
    color: "#FF6B35",
    fontWeight: "600",
  },
});

// ─── Pitch Modal Styles ───────────────────────────────────────────────────────
const pitchModal = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e8e8e8",
    paddingTop: Platform.OS === "ios" ? 50 : 14,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 18,
    color: "#666",
    fontWeight: "600",
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  doneBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF6B35",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  instruction: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 4,
  },
  countBadge: {
    alignSelf: "center",
    backgroundColor: "#fff5f2",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#ff8a65",
    marginBottom: 12,
  },
  countBadgeText: {
    fontSize: 13,
    color: "#FF6B35",
    fontWeight: "600",
  },
  countBadgeNum: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ff4d2d",
  },
  breakdownBox: {
    marginTop: 14,
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ebebeb",
  },
  breakdownTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#888",
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  adjustableRolesContainer: {
    gap: 10,
  },
  adjustableRoleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#f0f0f0",
  },
  adjustableRoleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  adjustableRoleLabel: {
    fontSize: 14,
  },
  adjustableRoleLimit: {
    fontSize: 11,
    color: "#999",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  counterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  counterBtnDisabled: {
    backgroundColor: "#f5f5f5",
    borderColor: "#e8e8e8",
    opacity: 0.5,
  },
  counterBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FF6B35",
  },
  counterVal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    minWidth: 18,
    textAlign: "center",
  },
  benchSection: {
    marginTop: 20,
    padding: 14,
    backgroundColor: "#f7f7f7",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ebebeb",
  },
  benchLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  benchHint: {
    fontSize: 11,
    color: "#aaa",
    marginBottom: 10,
  },
  benchRow: {
    flexDirection: "row",
    gap: 12,
  },
  benchCol: {
    flex: 1,
  },
  benchSubLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
  },

  // Group Modal Styles (Exact match with ChatListScreen)
  groupModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  groupModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    height: '90%',
    paddingBottom: 20,
  },
  groupModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#DBDBDB',
  },
  cancelBtnText: {
    color: '#0b74ff',
    fontSize: 16,
    fontWeight: '400',
  },
  groupModalTitle: {
    color: '#262626',
    fontSize: 17,
    fontWeight: '600',
  },
  nextBtnText: {
    color: '#0b74ff',
    fontSize: 16,
    fontWeight: '600',
  },
  nextBtnTextDisabled: {
    color: '#C7C7C7',
  },
  modalSearchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFEFEF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    color: '#262626',
    fontSize: 15,
    padding: 0,
  },
  suggestionTitle: {
    color: '#8E8E8E',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FAFAFA',
  },
  modalLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  friendsList: {
    paddingBottom: 20,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#EFEFEF',
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFEFEF',
  },
  friendAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  friendName: {
    flex: 1,
    color: '#262626',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DBDBDB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: '#0b74ff',
    borderColor: '#0b74ff',
  },
  emptyFriendsText: {
    color: '#8E8E8E',
    textAlign: 'center',
    fontSize: 14,
    paddingTop: 40,
  },
  groupNameContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    width: '100%',
  },
  groupNameInput: {
    color: '#262626',
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#DBDBDB',
    paddingVertical: 8,
    textAlign: 'center',
  },
  groupCreationBody: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  groupAvatarPicker: {
    position: 'relative',
    marginBottom: 20,
    alignSelf: 'center',
  },
  groupAvatarPreview: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E5E7EB',
  },
  groupAvatarPreviewFallback: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarFallbackText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    fontWeight: '600',
  },
  groupAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0b74ff',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
