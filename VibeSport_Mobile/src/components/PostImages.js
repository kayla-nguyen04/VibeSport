import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Full-screen Image Viewer Modal ─────────────────────────────────────────
function ImageViewerModal({ images, initialIndex, visible, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <SafeAreaView style={viewerStyles.container}>
        {/* Close button */}
        <TouchableOpacity style={viewerStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Counter */}
        <View style={viewerStyles.counter}>
          <Text style={viewerStyles.counterText}>
            {currentIndex + 1} / {images.length}
          </Text>
        </View>

        {/* Image List */}
        <FlatList
          data={images}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          initialScrollIndex={initialIndex || 0}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={viewerStyles.imageSlide}>
              <Image
                source={{ uri: item }}
                style={viewerStyles.fullImage}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {/* Dot indicators */}
        {images.length > 1 && (
          <View style={viewerStyles.dotRow}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[viewerStyles.dot, i === currentIndex && viewerStyles.dotActive]}
              />
            ))}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main PostImages Component ────────────────────────────────────────────────
/**
 * Props:
 *  - images: string[]   — array of image URIs
 *  - containerWidth: number (optional) — width of the card for sizing
 */
export function PostImages({ images, containerWidth }) {
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const cardWidth = containerWidth || SCREEN_WIDTH - 32 - 32; // subtract margins + card padding
  const MAX_VISIBLE = 2; // max tiles shown in the grid
  const hiddenCount = images.length - MAX_VISIBLE; // how many are hidden under the overlay

  const openViewer = (index) => {
    setViewerIndex(index);
    setViewerVisible(true);
  };

  // ── Single image ──────────────────────────────────────────────────────────
  if (images.length === 1) {
    return (
      <>
        <TouchableOpacity
          style={styles.singleContainer}
          onPress={() => openViewer(0)}
          activeOpacity={0.92}
        >
          <Image
            source={{ uri: images[0] }}
            style={[styles.singleImage, { width: cardWidth }]}
            resizeMode="cover"
          />
        </TouchableOpacity>

        <ImageViewerModal
          images={images}
          initialIndex={0}
          visible={viewerVisible}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  // ── Two images ────────────────────────────────────────────────────────────
  if (images.length === 2) {
    const tileWidth = (cardWidth - GRID_GAP) / 2;
    return (
      <>
        <View style={[styles.gridRow, { width: cardWidth }]}>
          {images.map((uri, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => openViewer(i)}
              activeOpacity={0.92}
              style={{ borderRadius: 12, overflow: 'hidden' }}
            >
              <Image
                source={{ uri }}
                style={{ width: tileWidth, height: DUAL_HEIGHT }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>

        <ImageViewerModal
          images={images}
          initialIndex={viewerIndex}
          visible={viewerVisible}
          onClose={() => setViewerVisible(false)}
        />
      </>
    );
  }

  // ── Three or more images: show first 2, overlay on the 2nd ───────────────
  const visibleImages = images.slice(0, MAX_VISIBLE);
  const tileWidth = (cardWidth - GRID_GAP) / 2;

  return (
    <>
      <View style={[styles.gridRow, { width: cardWidth }]}>
        {visibleImages.map((uri, i) => {
          const isLast = i === MAX_VISIBLE - 1 && hiddenCount > 0;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => openViewer(i)}
              activeOpacity={0.92}
              style={{ borderRadius: 12, overflow: 'hidden' }}
            >
              <Image
                source={{ uri }}
                style={{ width: tileWidth, height: DUAL_HEIGHT }}
                resizeMode="cover"
              />
              {/* Dark overlay with "+N" on the last visible tile */}
              {isLast && (
                <View style={styles.overlay}>
                  <Text style={styles.overlayText}>+{hiddenCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      <ImageViewerModal
        images={images}
        initialIndex={viewerIndex}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const GRID_GAP = 4;
const DUAL_HEIGHT = 200;

// ─── Grid Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  singleContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  singleImage: {
    height: 240,
    backgroundColor: '#E5E7EB',
  },
  gridRow: {
    flexDirection: 'row',
    gap: GRID_GAP,
    marginTop: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

// ─── Viewer Styles ────────────────────────────────────────────────────────────
const viewerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  closeBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 6,
  },
  counter: {
    position: 'absolute',
    top: 56,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imageSlide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 24,
    paddingTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: '#FF6B35',
    width: 18,
    borderRadius: 4,
  },
});
