import React, { useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // ĐÃ SỬA: Chuyển sang import từ thư viện safe area context chuyên dụng
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

        {/* Images List */}
        <FlatList
          data={images}
          keyExtractor={(item, index) => `${item}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex || 0}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          getItemLayout={(data, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index,
          })}
          renderItem={({ item }) => (
            <View style={viewerStyles.imageSlide}>
              <Image source={{ uri: item }} style={viewerStyles.fullImage} />
            </View>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Grid Component ───────────────────────────────────────────────────
export function PostImages({ images }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedIndex, setActionIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const openViewer = (index) => {
    setActionIndex(index);
    setModalVisible(true);
  };

  const count = images.length;

  // 1 Image
  if (count === 1) {
    return (
      <View style={styles.gridContainer}>
        <TouchableOpacity onPress={() => openViewer(0)} activeOpacity={0.9} style={styles.singleImageWrap}>
          <Image source={{ uri: images[0] }} style={styles.singleImage} />
        </TouchableOpacity>
        <ImageViewerModal
          images={images}
          initialIndex={selectedIndex}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  // 2 Images
  if (count === 2) {
    return (
      <View style={styles.gridContainer}>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => openViewer(0)} activeOpacity={0.9} style={styles.halfCell}>
            <Image source={{ uri: images[0] }} style={styles.imageCover} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openViewer(1)} activeOpacity={0.9} style={styles.halfCell}>
            <Image source={{ uri: images[1] }} style={styles.imageCover} />
          </TouchableOpacity>
        </View>
        <ImageViewerModal
          images={images}
          initialIndex={selectedIndex}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  // 3 Images
  if (count === 3) {
    return (
      <View style={styles.gridContainer}>
        <View style={styles.row}>
          <TouchableOpacity onPress={() => openViewer(0)} activeOpacity={0.9} style={[styles.cell, { flex: 2, height: 210 }]}>
            <Image source={{ uri: images[0] }} style={styles.imageCover} />
          </TouchableOpacity>
          <View style={{ flex: 1, gap: 4 }}>
            <TouchableOpacity onPress={() => openViewer(1)} activeOpacity={0.9} style={[styles.cell, { height: 103 }]}>
              <Image source={{ uri: images[1] }} style={styles.imageCover} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openViewer(2)} activeOpacity={0.9} style={[styles.cell, { height: 103 }]}>
              <Image source={{ uri: images[2] }} style={styles.imageCover} />
            </TouchableOpacity>
          </View>
        </View>
        <ImageViewerModal
          images={images}
          initialIndex={selectedIndex}
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  // 4+ Images
  return (
    <View style={styles.gridContainer}>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => openViewer(0)} activeOpacity={0.9} style={[styles.cell, { flex: 1, height: 210 }]}>
          <Image source={{ uri: images[0] }} style={styles.imageCover} />
        </TouchableOpacity>
        <View style={{ flex: 1, gap: 4 }}>
          <TouchableOpacity onPress={() => openViewer(1)} activeOpacity={0.9} style={[styles.cell, { height: 67 }]}>
            <Image source={{ uri: images[1] }} style={styles.imageCover} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openViewer(2)} activeOpacity={0.9} style={[styles.cell, { height: 67 }]}>
            <Image source={{ uri: images[2] }} style={styles.imageCover} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openViewer(3)} activeOpacity={0.9} style={[styles.cell, { height: 72 }]}>
            <Image source={{ uri: images[3] }} style={styles.imageCover} />
            {count > 4 && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>+{count - 4}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <ImageViewerModal
        images={images}
        initialIndex={selectedIndex}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ─── Grid Render Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  gridContainer: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  singleImageWrap: {
    width: '100%',
    maxHeight: 320,
    backgroundColor: '#E5E7EB',
  },
  singleImage: {
    width: '100%',
    height: 240,
    resizeMode: 'cover',
  },
  halfCell: {
    flex: 1,
    height: 160,
    backgroundColor: '#E5E7EB',
  },
  cell: {
    backgroundColor: '#E5E7EB',
  },
  imageCover: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: {
    color: '#FFFFFF',
    fontSize: 24,
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
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: '100%',
    resizeMode: 'contain',
  },
});