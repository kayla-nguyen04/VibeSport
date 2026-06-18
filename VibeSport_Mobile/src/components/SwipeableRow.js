import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const SWIPE_THRESHOLD = 50;

export function SwipeableRow({ children, onDelete, onMute, isMuted }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [isOpen, setIsOpen] = useState(false);
  const startX = useRef(0);
  const startTranslate = useRef(0);
  const isSwiping = useRef(false);
  const containerRef = useRef(null);

  const handleTouchStart = (e) => {
    startX.current = e.nativeEvent.pageX;
    startTranslate.current = translateX._value;
    isSwiping.current = false;
  };

  const handleTouchMove = (e) => {
    const currentX = e.nativeEvent.pageX;
    const deltaX = currentX - startX.current;

    if (Math.abs(deltaX) > 15 && !isSwiping.current) {
      isSwiping.current = true;
    }

    if (isSwiping.current && deltaX < 0) {
      const newValue = startTranslate.current + deltaX;
      translateX.setValue(Math.max(newValue, -160));
    }
  };

  const handleTouchEnd = (e) => {
    const deltaX = e.nativeEvent.pageX - startX.current;

    if (isSwiping.current) {
      if (deltaX < -SWIPE_THRESHOLD) {
        Animated.spring(translateX, {
          toValue: -160,
          useNativeDriver: true,
        }).start();
        setIsOpen(true);
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
        setIsOpen(false);
      }
    }

    isSwiping.current = false;
  };

  const closeSwipe = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    setIsOpen(false);
  };

  const handleMute = () => {
    closeSwipe();
    setTimeout(() => onMute(), 100);
  };

  const handleDelete = () => {
    closeSwipe();
    setTimeout(() => onDelete(), 100);
  };

  return (
    <View style={styles.container} ref={containerRef}>
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionBtn, isMuted ? styles.actionBtnMuted : styles.actionBtnMute]}
          onPress={handleMute}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isMuted ? 'notifications' : 'notifications-off-outline'}
            size={22}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnDelete]}
          onPress={handleDelete}
          activeOpacity={0.8}
        >
          <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <View
        style={styles.touchCapture}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Animated.View style={[styles.rowContent, { transform: [{ translateX }] }]}>
          {children}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  actionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  actionBtn: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnMute: {
    backgroundColor: '#F59E0B',
  },
  actionBtnMuted: {
    backgroundColor: '#10B981',
  },
  actionBtnDelete: {
    backgroundColor: '#EF4444',
  },
  touchCapture: {
    flex: 1,
  },
  rowContent: {
    backgroundColor: '#FFFFFF',
  },
});
