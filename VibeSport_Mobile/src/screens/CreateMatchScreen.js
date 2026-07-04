import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import { createMatch, updateMatch, deleteMatch } from "../services/matchService";
import { getPostsRequest } from "../services/postApi";
import { Screen } from "../components/Screen";
import { ScreenHeader } from "../components/ScreenHeader";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const parseDateString = (dateStr) => {
  if (!dateStr) return new Date();
  const parts = dateStr.split("/");
  if (parts.length !== 3) return new Date();
  const [day, month, year] = parts.map(Number);
  return new Date(year, month - 1, day);
};

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

function RacketCourt({ maxPlayers, sport }) {
  const courtWidth = SCREEN_WIDTH - 80;
  const courtHeight = courtWidth * COURT_ASPECT;
  const fmt = RACKET_FORMATS[maxPlayers] || RACKET_FORMATS[4];
  const perSide = fmt.playerCountPerSide;

  const sportColor = sport === "pickleball" ? "#f59e0b" : "#3b82f6";
  const sportLabel = sport === "pickleball" ? "Pickleball" : "Cầu lông";

  // Generate player dot positions for each side
  const generateDots = (side) => {
    // side: "top" or "bottom"
    const dots = [];
    if (perSide === 1) {
      dots.push({ x: 0.5, y: side === "top" ? 0.22 : 0.78 });
    } else {
      dots.push({ x: 0.3, y: side === "top" ? 0.22 : 0.78 });
      dots.push({ x: 0.7, y: side === "top" ? 0.22 : 0.78 });
    }
    return dots;
  };

  const topDots = generateDots("top");
  const bottomDots = generateDots("bottom");

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

      {/* Player dots top */}
      {topDots.map((dot, idx) => (
        <View
          key={`top_${idx}`}
          style={[
            courtStyles.playerDot,
            {
              left: dot.x * courtWidth - 18,
              top: dot.y * courtHeight - 18,
              backgroundColor: sportColor,
            },
          ]}
        >
          <Text style={courtStyles.playerDotText}>P{idx + 1}</Text>
        </View>
      ))}

      {/* Player dots bottom */}
      {bottomDots.map((dot, idx) => (
        <View
          key={`bot_${idx}`}
          style={[
            courtStyles.playerDot,
            {
              left: dot.x * courtWidth - 18,
              top: dot.y * courtHeight - 18,
              backgroundColor: sportColor + "cc",
            },
          ]}
        >
          <Text style={courtStyles.playerDotText}>P{idx + 1}</Text>
        </View>
      ))}
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
  const editMatch = route?.params?.editMatch ?? null;
  const isEditMode = !!editMatch;

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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
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
    return 22; // default is 11 vs 11 (22 players)
  });



  const [racketMaxPlayers, setRacketMaxPlayers] = useState(() => {
    if ((editMatch?.sport === "badminton" || editMatch?.sport === "pickleball") && editMatch?.maxPlayers) {
      return editMatch.maxPlayers;
    }
    return 4; // default is 2 vs 2
  });

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

  const buildFormDraft = useCallback(
    () => ({
      sport,
      title,
      selectedDate: selectedDate.toISOString(),
      selectedTimeSlot,
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
    }),
    [
      sport,
      title,
      selectedDate,
      selectedTimeSlot,
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
    ]
  );

  const applyFormDraft = useCallback((draft) => {
    if (!draft) return;
    if (draft.sport) setSport(draft.sport);
    if (draft.title != null) setTitle(draft.title);
    if (draft.selectedDate) setSelectedDate(new Date(draft.selectedDate));
    if (draft.selectedTimeSlot) setSelectedTimeSlot(draft.selectedTimeSlot);
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
    if (selectedSport !== "football") {
      setMaxPlayersOther("2");
      setSelectedPositionIds([]);
      if (selectedSport === "badminton" || selectedSport === "pickleball") {
        setRacketMaxPlayers(4);
      }
    } else {
      setFootballMaxPlayers(22);
      setSelectedPositionIds([]);
    }
  };

  const handleSelectFootballMaxPlayers = (maxP) => {
    setFootballMaxPlayers(maxP);
    const limit = (FOOTBALL_FORMATS[maxP] || FOOTBALL_FORMATS[22]).playerCountPerTeam;
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
    setCostPerPerson(String(Math.min(num, MAX_COST_PER_PERSON)));
  };

  const handleBenchTeam1Change = (text) => {
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits) {
      setBenchMembersTeam1("");
      return;
    }
    const num = parseInt(digits, 10);
    setBenchMembersTeam1(String(Math.min(num, 3)));
  };

  const handleBenchTeam2Change = (text) => {
    const digits = text.replace(/[^0-9]/g, "");
    if (!digits) {
      setBenchMembersTeam2("");
      return;
    }
    const num = parseInt(digits, 10);
    setBenchMembersTeam2(String(Math.min(num, 3)));
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
      ? footballMaxPlayers
      : (sport === "badminton" || sport === "pickleball")
        ? racketMaxPlayers
        : Number(maxPlayersOther);
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
    const cost = Number(costPerPerson || 0);
    if (cost > MAX_COST_PER_PERSON) {
      Alert.alert(
        "Dữ liệu không hợp lệ",
        `Chi phí tối đa là ${MAX_COST_PER_PERSON.toLocaleString("vi-VN")} VND/người`
      );
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
    return true;
  };

  const handleSubmit = async () => {
    try {
      if (!validateForm()) return;

      const payload = buildPayload();

      if (isEditMode) {
        await updateMatch(editMatch._id, payload);
        Alert.alert("Thành công", "Cập nhật trận đấu thành công", [
          {
            text: "OK",
            onPress: () => {
              if (navigation) {
                navigation.navigate("MatchesTab");
              }
            }
          }
        ]);
      } else {
        await createMatch(payload);
        Alert.alert(
          "Thành công",
          "Đã tạo đội của bạn thành công và đồng bộ với trận đấu!",
          [
            {
              text: "OK",
              onPress: () => {
                if (navigation) {
                  navigation.navigate("TeamsTab");
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
              navigation.navigate("MatchesTab");
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
          <Text style={pitchModal.title}>Chọn vị trí cần tìm ({(FOOTBALL_FORMATS[footballMaxPlayers] || FOOTBALL_FORMATS[22]).label})</Text>
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
          <FootballPitch
            selectedIds={selectedPositionIds}
            onToggle={togglePosition}
            maxPlayers={footballMaxPlayers}
          />

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
            <Text style={pitchModal.benchLabel}>🪑 Thành viên dự bị (không bắt buộc)</Text>
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

        {sport === "football" && (
          <>
            <Text style={styles.sectionLabel}>SỐ NGƯỜI TỐI ĐA (LOẠI SÂN)</Text>
            <View style={styles.footballMaxPlayersRow}>
              {[
                { maxPlayers: 10, label: "5 vs 5", count: "10 người" },
                { maxPlayers: 14, label: "7 vs 7", count: "14 người" },
                { maxPlayers: 22, label: "11 vs 11", count: "22 người" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.maxPlayers}
                  style={[
                    styles.footballMaxPlayersButton,
                    footballMaxPlayers === item.maxPlayers && styles.footballMaxPlayersButtonActive,
                  ]}
                  onPress={() => handleSelectFootballMaxPlayers(item.maxPlayers)}
                >
                  <Text
                    style={[
                      styles.footballMaxPlayersLabel,
                      footballMaxPlayers === item.maxPlayers && styles.footballMaxPlayersLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.footballMaxPlayersSubLabel,
                      footballMaxPlayers === item.maxPlayers && styles.footballMaxPlayersSubLabelActive,
                    ]}
                  >
                    {item.count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              Tổng số người tối đa cả 2 đội • Số người cần tìm sẽ được chọn trên sơ đồ bên dưới
            </Text>
          </>
        )}

        {/* NGƯỜI CHƠI ĐANG TÌM ĐỘI */}
        <Text style={styles.sectionLabel}>NGƯỜI CHƠI ĐANG TÌM ĐỘI ({SPORT_MAP[sport]?.toUpperCase()})</Text>
        {loadingPosts ? (
          <View style={styles.loadingPostsContainer}>
            <ActivityIndicator size="small" color="#ff5722" />
            <Text style={styles.loadingPostsText}>Đang tải danh sách tìm đội...</Text>
          </View>
        ) : filteredPosts.length === 0 ? (
          <View style={styles.emptyPostsBox}>
            <Text style={styles.emptyPostsText}>Chưa có bài đăng tìm đội nào cho môn này.</Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.findTeamScroll}
          >
            {filteredPosts.map((item) => {
              const author = item.userId;
              const authorName = author?.name || "Người dùng";
              const authorInitial = authorName.charAt(0).toUpperCase();
              const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : "";

              return (
                <TouchableOpacity
                  key={item._id}
                  style={styles.findTeamCard}
                  activeOpacity={0.9}
                  onPress={() => navigation?.navigate?.("PostDetail", { postId: item._id, post: item })}
                >
                  <View style={styles.cardHeaderRow}>
                    {author?.picture ? (
                      <Image source={{ uri: author.picture }} style={styles.cardAvatar} />
                    ) : (
                      <View style={styles.cardAvatarPlaceholder}>
                        <Text style={styles.cardAvatarText}>{authorInitial}</Text>
                      </View>
                    )}
                    <View style={styles.cardMeta}>
                      <Text style={styles.cardAuthorName} numberOfLines={1}>
                        {authorName}
                      </Text>
                      <Text style={styles.cardDate}>{dateStr}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardContent} numberOfLines={3}>
                    {item.content}
                  </Text>
                  <View style={styles.cardFooter}>
                    <Text style={styles.cardDetailLink}>Xem chi tiết ›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

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

        {/* ── SỐ NGƯỜI CẦN TÌM (football: auto, other: manual) ── */}
        {sport === "football" ? (
          <>
            {/* VỊ TRÍ CẦN TÌM – tap to open pitch modal */}
            <View style={styles.positionSectionHeader}>
              <Text style={styles.sectionLabel}>VỊ TRÍ CẦN TÌM (TÙY CHỌN)</Text>
              <Text style={styles.infoIcon}>ⓘ</Text>
            </View>

            {/* Tap area to open map */}
            <TouchableOpacity
              style={styles.pitchTrigger}
              onPress={() => setShowPitchModal(true)}
              activeOpacity={0.8}
            >
              {/* Mini pitch preview */}
              <View style={styles.pitchTriggerLeft}>
                <Text style={styles.pitchTriggerIcon}>🗺️</Text>
                <View>
                  <Text style={styles.pitchTriggerTitle}>Sơ đồ vị trí ({(FOOTBALL_FORMATS[footballMaxPlayers] || FOOTBALL_FORMATS[22]).label})</Text>
                  <Text style={styles.pitchTriggerSub}>
                    {selectedPositionIds.length > 0 || Number(benchMembersTeam1 || 0) > 0 || Number(benchMembersTeam2 || 0) > 0
                      ? `Đã chọn ${selectedPositionIds.length} vị trí${(Number(benchMembersTeam1 || 0) + Number(benchMembersTeam2 || 0)) > 0 ? ` + ${Number(benchMembersTeam1 || 0) + Number(benchMembersTeam2 || 0)} dự bị` : ""}`
                      : "Nhấn để mở sơ đồ sân"}
                  </Text>
                </View>
              </View>
              <Text style={styles.pitchTriggerArrow}>›</Text>
            </TouchableOpacity>

            {/* Role chips summary */}
            {Object.keys(selectedRoleSummary).length > 0 && (
              <View style={styles.roleChipsRow}>
                {Object.entries(selectedRoleSummary).map(([role, qty]) => (
                  <View
                    key={role}
                    style={[
                      styles.roleChip,
                      { backgroundColor: ROLE_COLORS[role] + "18", borderColor: ROLE_COLORS[role] + "66" },
                    ]}
                  >
                    <View style={[styles.roleChipDot, { backgroundColor: ROLE_COLORS[role] }]} />
                    <Text style={[styles.roleChipText, { color: ROLE_COLORS[role] }]}>
                      {roleLabels[role]} ×{qty}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* SỐ NGƯỜI CẦN TÌM – auto */}
            <Text style={styles.sectionLabel}>SỐ NGƯỜI CẦN TÌM</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                value={totalNeeded > 0 ? `${totalNeeded} người` : ""}
                placeholder="Chưa chọn vị trí"
                placeholderTextColor="#bbb"
                editable={false}
              />
            </View>
            <Text style={styles.helperText}>
              Số vị trí cần tìm • Tự động tính theo số vị trí đã chọn trên sơ đồ
            </Text>
          </>
        ) : (
          <>
            {/* SỐ NGƯỜI TỐI ĐA (1vs1 / 2vs2) */}
            <Text style={styles.sectionLabel}>SỐ NGƯỜI TỐI ĐA (LOẠI SÂN)</Text>
            <View style={styles.footballMaxPlayersRow}>
              {[
                { maxPlayers: 2, label: "1 vs 1", count: "2 người" },
                { maxPlayers: 4, label: "2 vs 2", count: "4 người" },
              ].map((item) => (
                <TouchableOpacity
                  key={item.maxPlayers}
                  style={[
                    styles.footballMaxPlayersButton,
                    racketMaxPlayers === item.maxPlayers && styles.footballMaxPlayersButtonActive,
                  ]}
                  onPress={() => setRacketMaxPlayers(item.maxPlayers)}
                >
                  <Text
                    style={[
                      styles.footballMaxPlayersLabel,
                      racketMaxPlayers === item.maxPlayers && styles.footballMaxPlayersLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.footballMaxPlayersSubLabel,
                      racketMaxPlayers === item.maxPlayers && styles.footballMaxPlayersSubLabelActive,
                    ]}
                  >
                    {item.count}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              Tổng số người tối đa cả 2 bên
            </Text>

            {/* Court diagram */}
            <Text style={styles.sectionLabel}>SƠ ĐỒ SÂN</Text>
            <RacketCourt maxPlayers={racketMaxPlayers} sport={sport} />
            <Text style={[styles.helperText, { textAlign: "center", marginTop: 8 }]}>
              Bên A ({RACKET_FORMATS[racketMaxPlayers]?.playerCountPerSide || 1} người) vs Bên B ({RACKET_FORMATS[racketMaxPlayers]?.playerCountPerSide || 1} người) • Tối đa {racketMaxPlayers} người
            </Text>
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
            placeholder={`Mặc quần áo thể thao, mang giày đinh ngắn.\nTiền sân thanh toán tại chỗ.`}
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

      {/* Pitch selection modal */}
      {renderPitchModal()}
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

  // Football Max Players Selector
  footballMaxPlayersRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  footballMaxPlayersButton: {
    flex: 1,
    minWidth: "22%",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  footballMaxPlayersButtonActive: {
    backgroundColor: "#fff5f2",
    borderColor: "#ff5722",
  },
  footballMaxPlayersLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#555",
  },
  footballMaxPlayersLabelActive: {
    color: "#ff5722",
  },
  footballMaxPlayersSubLabel: {
    fontSize: 10,
    color: "#aaa",
    marginTop: 2,
    fontWeight: "500",
  },
  footballMaxPlayersSubLabelActive: {
    color: "#ff8a65",
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
    color: "#ff5722",
  },

  // Helper text
  helperText: {
    fontSize: 12,
    color: "#aaa",
    marginTop: 6,
    lineHeight: 17,
  },

  // Position section trigger
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
  pitchTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9f0",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#4ade80",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pitchTriggerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pitchTriggerIcon: {
    fontSize: 28,
  },
  pitchTriggerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#166534",
  },
  pitchTriggerSub: {
    fontSize: 12,
    color: "#4ade80",
    marginTop: 2,
    fontWeight: "500",
  },
  pitchTriggerArrow: {
    fontSize: 24,
    color: "#4ade80",
    fontWeight: "300",
  },

  // Role chips summary (below trigger)
  roleChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  roleChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleChipText: {
    fontSize: 12,
    fontWeight: "600",
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
    shadowColor: "#ff5722",
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
    backgroundColor: "#ff5722",
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
    color: "#ff5722",
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
    color: "#ff5722",
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
    color: "#ff5722",
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
    color: "#ff5722",
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
});