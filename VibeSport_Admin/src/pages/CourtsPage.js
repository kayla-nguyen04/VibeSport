import React, { useEffect, useState, useCallback, useRef } from 'react';
import api from '../utils/api';
import './CourtsPage.css';

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const SPORT_OPTIONS = [
  { key: 'football',   label: '⚽ Bóng đá',    bg: '#ECFDF5', border: '#A7F3D0', color: '#059669' },
  { key: 'badminton',  label: '🏸 Cầu lông',   bg: '#EFF6FF', border: '#BFDBFE', color: '#2563EB' },
  { key: 'pickleball', label: '🏓 Pickleball', bg: '#F3E8FF', border: '#E9D5FF', color: '#7C3AED' },
];

const FILTER_SPORTS = [
  { key: 'all', label: 'Tất cả môn' },
  ...SPORT_OPTIONS,
];

const STATUS_FILTERS = [
  { key: 'all',    label: 'Tất cả trạng thái' },
  { key: 'active', label: '🟢 Đang hoạt động' },
  { key: 'hidden', label: '🔴 Đã ẩn sân' },
];

// Loại sân theo môn thể thao
const SPORT_PITCH_TYPES = {
  football:   ['Sân 5 (5v5)', 'Sân 7 (7v7)', 'Sân 11 (11v11)'],
  badminton:  ['Sân đơn (1v1)', 'Sân đôi (2v2)'],
  pickleball: ['Sân đơn (1v1)', 'Sân đôi (2v2)'],
};

// Giá mặc định khi thêm môn mới
const DEFAULT_PRICES_BY_SPORT = {
  football: {
    'Sân 5 (5v5)':    300000,
    'Sân 7 (7v7)':    600000,
    'Sân 11 (11v11)': 1000000,
  },
  badminton: {
    'Sân đơn (1v1)': 120000,
    'Sân đôi (2v2)': 200000,
  },
  pickleball: {
    'Sân đơn (1v1)': 150000,
    'Sân đôi (2v2)': 250000,
  },
};

// Chuẩn hóa / tìm giá cho 1 loại sân từ pitchOptions mới hoặc priceTable cũ
const normalizePitchKey = (value = '') => {
  const raw = String(value || '').toLowerCase();
  if (!raw) return '';
  if (raw.includes('5v5') || raw.includes('5')) return '5v5';
  if (raw.includes('7v7') || raw.includes('7')) return '7v7';
  if (raw.includes('11v11') || raw.includes('11')) return '11v11';
  if (raw.includes('1v1') || raw.includes('đơn') || raw.includes('1')) return '1v1';
  if (raw.includes('2v2') || raw.includes('đôi') || raw.includes('2')) return '2v2';
  return raw;
};

const findPriceForPitch = (priceSource, sportKey, pitchType, defaultPrice = 300000) => {
  const list = Array.isArray(priceSource) ? priceSource : [];
  if (list.length === 0) {
    return defaultPrice;
  }

  const targetKey = normalizePitchKey(pitchType);
  const exactMatch = list.find((item) => {
    const rowPitch = String(item?.pitchType || item?.fieldType || item?.label || '').toLowerCase();
    const rowKey = normalizePitchKey(rowPitch);
    const rowSport = String(item?.sportKey || '').toLowerCase();
    const sportMatch = !sportKey || !rowSport || rowSport === String(sportKey).toLowerCase();
    return sportMatch && (rowKey === targetKey || rowPitch.includes(String(pitchType || '').toLowerCase()) || String(pitchType || '').toLowerCase().includes(rowPitch));
  });
  if (exactMatch) {
    const price = Number(exactMatch.pricePerHour ?? exactMatch.price ?? 0);
    if (price > 0) return price;
  }

  const fallbackMatch = list.find((item) => {
    const rowPitch = String(item?.pitchType || item?.fieldType || item?.label || '').toLowerCase();
    const rowKey = normalizePitchKey(rowPitch);
    const rowSport = String(item?.sportKey || '').toLowerCase();
    const sportMatch = !sportKey || !rowSport || rowSport === String(sportKey).toLowerCase();
    return sportMatch && (rowKey === targetKey || rowPitch.includes(targetKey) || targetKey.includes(rowKey));
  });
  if (fallbackMatch) {
    const price = Number(fallbackMatch.pricePerHour ?? fallbackMatch.price ?? 0);
    if (price > 0) return price;
  }

  if (Array.isArray(list) && list.length > 0) {
    const legacyPrice = Number(list.find((r) => r.fieldType === pitchType)?.price ?? 0);
    if (legacyPrice > 0) return legacyPrice;
  }

  return defaultPrice;
};

const buildDefaultPriceTableFor = (sports) => {
  const rows = [];
  sports.forEach((sportKey) => {
    const pitches = SPORT_PITCH_TYPES[sportKey] || [];
    pitches.forEach((pitchType) => {
      rows.push({
        sportKey,
        fieldType: pitchType,
        price: DEFAULT_PRICES_BY_SPORT[sportKey]?.[pitchType] || 300000,
      });
    });
  });
  return rows;
};

const EMPTY_FORM = {
  name: '',
  sports: ['football'],
  address: '',
  district: '',
  phone: '',
  openTime: '06:00',
  closeTime: '23:00',
  priceFrom: 300000,
  priceTo: 800000,
  courtCount: 5,
  drinkServiceMin: 10000,
  drinkServiceMax: 20000,
  equipmentServiceMin: 25000,
  equipmentServiceMax: 50000,
  status: 'active',
  description: '',
  images: [],
  owner: null,
  priceTable: buildDefaultPriceTableFor(['football']),
};

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
export default function CourtsPage() {
  const [courts, setCourts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notification, setNotification] = useState(null);

  const [activeMenuId, setActiveMenuId] = useState(null);

  const [selectedCourt, setSelectedCourt] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [confirmModal, setConfirmModal] = useState({
    visible: false, title: '', message: '', actionType: null, targetCourt: null,
  });

  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});

  // Accordion state for price editor (in form)
  const [openAccordions, setOpenAccordions] = useState(['football']);

  // Image upload state
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const imageInputRef = useRef(null);

  const [serviceMenuImageUploading, setServiceMenuImageUploading] = useState(false);
  const [serviceMenuImagePreviews, setServiceMenuImagePreviews] = useState([]);
  const serviceMenuImageInputRef = useRef(null);

  // Owner search state
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [ownerSearchResults, setOwnerSearchResults] = useState([]);
  const [ownerSearchLoading, setOwnerSearchLoading] = useState(false);
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const ownerSearchRef = useRef(null);

  // Detail modal gallery
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imageViewer, setImageViewer] = useState(null);

  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveMenuId(null);
      }
      if (ownerSearchRef.current && !ownerSearchRef.current.contains(e.target)) {
        setShowOwnerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Owner search ──────────────────────────────────────
  const handleOwnerSearch = async (q = '') => {
    setOwnerSearchQuery(q);
    setOwnerSearchLoading(true);
    setShowOwnerDropdown(true);
    try {
      const res = await api.get('/users', { params: { search: q.trim() || undefined, limit: 8 } });
      setOwnerSearchResults(res.data?.data || res.data?.users || []);
    } catch (err) {
      console.error('Owner search error:', err);
      setOwnerSearchResults([]);
    } finally {
      setOwnerSearchLoading(false);
    }
  };

  const handleSelectOwner = (user) => {
    setFormData((prev) => ({ ...prev, owner: user }));
    setOwnerSearchQuery('');
    setOwnerSearchResults([]);
    setShowOwnerDropdown(false);
  };

  const handleClearOwner = () => {
    setFormData((prev) => ({ ...prev, owner: null }));
  };

  // ── Price table helpers ───────────────────────────────
  const handlePriceChange = (sportKey, fieldType, value) => {
    setFormData((prev) => {
      const updated = prev.priceTable.map((row) => {
        if (row.sportKey === sportKey && row.fieldType === fieldType) {
          return { ...row, price: value };
        }
        return row;
      });
      return { ...prev, priceTable: updated };
    });
    // Clear validation error for this cell
    setFormErrors((prev) => {
      const key = `${sportKey}_${fieldType}`;
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  };

  // ── Sport checkbox toggle ─────────────────────────────
  const handleToggleSportCheckbox = (spKey) => {
    setFormData((prev) => {
      const current = prev.sports || [];
      if (current.includes(spKey)) {
        if (current.length === 1) return prev; // must have at least 1 sport
        const newSports = current.filter((s) => s !== spKey);
        // Remove price rows for that sport
        const newPriceTable = prev.priceTable.filter((r) => r.sportKey !== spKey);
        return { ...prev, sports: newSports, priceTable: newPriceTable };
      }
      // Add sport → add default price rows
      const newRows = buildDefaultPriceTableFor([spKey]);
      setOpenAccordions((acc) => [...acc, spKey]);
      return {
        ...prev,
        sports: [...current, spKey],
        priceTable: [...prev.priceTable, ...newRows],
      };
    });
  };

  // ── Notifications ─────────────────────────────────────
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── Fetch courts ──────────────────────────────────────
  const fetchCourts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/courts', {
        params: {
          sportType: sportFilter !== 'all' ? sportFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchQuery.trim() || undefined,
        },
      });
      if (res.data?.success) {
        setCourts(res.data.data || []);
      }
    } catch (err) {
      showNotification('Không thể tải dữ liệu: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setLoading(false);
    }
  }, [sportFilter, statusFilter, searchQuery]);

  useEffect(() => { fetchCourts(); }, [fetchCourts]);

  // ── Helpers ───────────────────────────────────────────
  const getCourtSports = (court) => {
    if (Array.isArray(court.sports) && court.sports.length > 0) return court.sports;
    if (court.sportType) return [court.sportType];
    return ['football'];
  };

  // Lấy giá thấp nhất để hiển thị trên card
  const getDisplayPrice = (court) => {
    const pitchOptions = Array.isArray(court.pitchOptions) ? court.pitchOptions : [];
    if (pitchOptions.length > 0) {
      const prices = pitchOptions.map((r) => Number(r.pricePerHour ?? r.price ?? 0)).filter((p) => p > 0);
      if (prices.length > 0) {
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        if (minP === maxP) return `${minP.toLocaleString('vi-VN')}đ / giờ`;
        return `${minP.toLocaleString('vi-VN')}đ – ${maxP.toLocaleString('vi-VN')}đ / giờ`;
      }
    }
    // Ưu tiên priceTable
    if (Array.isArray(court.priceTable) && court.priceTable.length > 0) {
      const prices = court.priceTable.map((r) => Number(r.price)).filter((p) => p > 0);
      if (prices.length > 0) {
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        if (minP === maxP) return `${minP.toLocaleString('vi-VN')}đ / giờ`;
        return `${minP.toLocaleString('vi-VN')}đ – ${maxP.toLocaleString('vi-VN')}đ / giờ`;
      }
    }
    // Fallback priceFrom / priceTo
    const from = Number(court.priceFrom || 0);
    const to = Number(court.priceTo || 0);
    if (from === 0 && to === 0) return 'Liên hệ';
    if (to && to !== from) return `${from.toLocaleString('vi-VN')}đ – ${to.toLocaleString('vi-VN')}đ / giờ`;
    return `${from.toLocaleString('vi-VN')}đ / giờ`;
  };

  const renderSportBadges = (court) => {
    const sports = getCourtSports(court);
    return (
      <div className="sport-badges-list">
        {sports.map((spKey) => {
          const match = SPORT_OPTIONS.find((s) => s.key === spKey);
          return <span key={spKey} className={`court-badge ${spKey}`}>{match ? match.label : spKey}</span>;
        })}
      </div>
    );
  };

  // ── Open modal helpers ────────────────────────────────
  const handleViewDetail = (court) => {
    setSelectedCourt(court);
    setGalleryIndex(0);
    setShowDetailModal(true);
    setActiveMenuId(null);
  };

  const initFormForAdd = () => {
    setIsEditing(false);
    const defaultSports = ['football'];
    setFormData({
      ...EMPTY_FORM,
      sports: defaultSports,
      priceTable: buildDefaultPriceTableFor(defaultSports),
    });
    setOpenAccordions(defaultSports);
    setFormErrors({});
    setImagePreviews([]);
    setServiceMenuImagePreviews([]);
    setShowFormModal(true);
    setActiveMenuId(null);
  };

  const handleOpenEdit = (court) => {
    setIsEditing(true);
    setSelectedCourt(court);
    const existingSports = getCourtSports(court);
    const drinkSvc = court.serviceDetails?.drinkService || {};
    const equipSvc = court.serviceDetails?.equipmentService || {};
    const existingImages = court.images || [];
    const existingServiceMenuImages = court.serviceMenuImages || [];

    // Xây dựng priceTable đầy đủ & chính xác theo từng môn thể thao của sân
    const loadedPriceTable = [];
    existingSports.forEach((sportKey) => {
      const pitches = SPORT_PITCH_TYPES[sportKey] || [];
      pitches.forEach((pitchType) => {
        const defaultPrice = DEFAULT_PRICES_BY_SPORT[sportKey]?.[pitchType] || court.priceFrom || 300000;
        const sourcePrice = Array.isArray(court.pitchOptions) && court.pitchOptions.length > 0
          ? court.pitchOptions
          : court.priceTable;
        const price = findPriceForPitch(sourcePrice, sportKey, pitchType, defaultPrice);
        loadedPriceTable.push({
          sportKey,
          fieldType: pitchType,
          price,
        });
      });
    });

    setFormData({
      name: court.name || '',
      sports: existingSports,
      address: court.address || '',
      district: court.district || '',
      phone: court.phone || '',
      openTime: court.openTime || '06:00',
      closeTime: court.closeTime || '23:00',
      priceFrom: court.priceFrom || 300000,
      priceTo: court.priceTo || 800000,
      courtCount: court.courtCount || 5,
      drinkServiceMin: drinkSvc.minPrice || 10000,
      drinkServiceMax: drinkSvc.maxPrice || 20000,
      equipmentServiceMin: equipSvc.minPrice || 25000,
      equipmentServiceMax: equipSvc.maxPrice || 50000,
      status: court.status || 'active',
      description: court.description || '',
      images: existingImages,
      serviceMenuImages: existingServiceMenuImages,
      owner: court.owner || null,
      priceTable: loadedPriceTable,
    });
    setOpenAccordions(existingSports);
    setFormErrors({});
    setImagePreviews(existingImages.map((url) => ({ url, source: 'existing' })));
    setServiceMenuImagePreviews(existingServiceMenuImages.map((url) => ({ url, source: 'existing' })));
    setShowFormModal(true);
    setActiveMenuId(null);
  };

  // ── Image upload ──────────────────────────────────────
  const handleImageFilesSelected = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const localPreviews = files.map((f) => ({ url: URL.createObjectURL(f), source: 'uploading' }));
    setImagePreviews((prev) => [...prev, ...localPreviews]);
    setImageUploading(true);

    try {
      const formDataUpload = new FormData();
      files.forEach((f) => formDataUpload.append('images', f));

      const res = await api.post('/courts/upload-images', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data.urls?.length) {
        const newUrls = res.data.urls;
        setImagePreviews((prev) => {
          const withoutUploading = prev.filter((p) => p.source !== 'uploading');
          return [...withoutUploading, ...newUrls.map((url) => ({ url, source: 'new' }))];
        });
        setFormData((prev) => ({ ...prev, images: [...(prev.images || []), ...newUrls] }));
        showNotification(`Đã tải lên ${newUrls.length} ảnh thành công!`);
      }
    } catch (err) {
      setImagePreviews((prev) => prev.filter((p) => p.source !== 'uploading'));
      showNotification('Lỗi upload ảnh: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setImageUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (idxToRemove) => {
    setImagePreviews((prev) => {
      const updated = prev.filter((_, i) => i !== idxToRemove);
      setFormData((fd) => ({ ...fd, images: updated.map((p) => p.url) }));
      return updated;
    });
  };

  const handleServiceMenuImageFilesSelected = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const localPreviews = files.map((f) => ({ url: URL.createObjectURL(f), source: 'uploading' }));
    setServiceMenuImagePreviews((prev) => [...prev, ...localPreviews]);
    setServiceMenuImageUploading(true);

    try {
      const formDataUpload = new FormData();
      files.forEach((f) => formDataUpload.append('images', f));

      const res = await api.post('/courts/upload-images', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.success && res.data.urls?.length) {
        const newUrls = res.data.urls;
        setServiceMenuImagePreviews((prev) => {
          const withoutUploading = prev.filter((p) => p.source !== 'uploading');
          return [...withoutUploading, ...newUrls.map((url) => ({ url, source: 'new' }))];
        });
        setFormData((prev) => ({ ...prev, serviceMenuImages: [...(prev.serviceMenuImages || []), ...newUrls] }));
        showNotification(`Đã tải lên ${newUrls.length} ảnh bảng giá/dịch vụ thành công!`);
      }
    } catch (err) {
      setServiceMenuImagePreviews((prev) => prev.filter((p) => p.source !== 'uploading'));
      showNotification('Lỗi upload ảnh giá dịch vụ: ' + (err.response?.data?.error || err.message), 'error');
    } finally {
      setServiceMenuImageUploading(false);
      if (serviceMenuImageInputRef.current) serviceMenuImageInputRef.current.value = '';
    }
  };

  const handleRemoveServiceMenuImage = (idxToRemove) => {
    setServiceMenuImagePreviews((prev) => {
      const updated = prev.filter((_, i) => i !== idxToRemove);
      setFormData((fd) => ({ ...fd, serviceMenuImages: updated.map((p) => p.url) }));
      return updated;
    });
  };

  // ── Validate price table ──────────────────────────────
  const validatePriceTable = () => {
    const errors = {};
    formData.sports.forEach((sportKey) => {
      const pitches = SPORT_PITCH_TYPES[sportKey] || [];
      pitches.forEach((pitchType) => {
        const row = formData.priceTable.find(
          (r) => r.sportKey === sportKey && r.fieldType === pitchType
        );
        const price = Number(row?.price);
        if (!row || isNaN(price) || price <= 0) {
          errors[`${sportKey}_${pitchType}`] = 'Vui lòng nhập giá';
        }
      });
    });
    return errors;
  };

  // ── Submit form ───────────────────────────────────────
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (imageUploading) {
      showNotification('Vui lòng chờ ảnh tải lên xong!', 'error');
      return;
    }

    // Validate price table
    const priceErrors = validatePriceTable();
    if (Object.keys(priceErrors).length > 0) {
      setFormErrors(priceErrors);
      // Open all accordions that have errors
      const errSports = [...new Set(Object.keys(priceErrors).map((k) => k.split('_')[0]))];
      setOpenAccordions((prev) => [...new Set([...prev, ...errSports])]);
      showNotification('Vui lòng nhập đầy đủ giá cho tất cả loại sân!', 'error');
      return;
    }

    try {
      const mainSport = formData.sports[0] || 'football';
      const drinkMin = Number(formData.drinkServiceMin || 10000);
      const drinkMax = Number(formData.drinkServiceMax || 20000);
      const equipMin = Number(formData.equipmentServiceMin || 25000);
      const equipMax = Number(formData.equipmentServiceMax || 50000);

      const pitchOptions = (formData.priceTable || []).map((p) => ({
        pitchType: (() => {
          const raw = String(p.fieldType || '').trim();
          if (raw.includes('5v5') || raw.includes('5')) return '5v5';
          if (raw.includes('7v7') || raw.includes('7')) return '7v7';
          if (raw.includes('11v11') || raw.includes('11')) return '11v11';
          if (raw.includes('1v1') || raw.includes('đơn') || raw.includes('1')) return '1v1';
          if (raw.includes('2v2') || raw.includes('đôi') || raw.includes('2')) return '2v2';
          return raw;
        })(),
        label: String(p.fieldType || '').trim(),
        pricePerHour: Number(p.price || 0),
      }));

      const payload = {
        name: formData.name.trim(),
        sportType: mainSport,
        sports: formData.sports,
        address: formData.address.trim(),
        district: formData.district.trim(),
        phone: formData.phone.trim(),
        openTime: formData.openTime,
        closeTime: formData.closeTime,
        priceFrom: Number(formData.priceFrom || 0),
        priceTo: Number(formData.priceTo || 0),
        courtCount: Number(formData.courtCount || 0),
        status: formData.status,
        owner: formData.owner?._id || null,
        pitchOptions,
        serviceMenuImages: serviceMenuImagePreviews.map((p) => p.url),
        priceTable: (formData.priceTable || []).map((p) => ({
          sportKey: String(p.sportKey || '').trim(),
          fieldType: String(p.fieldType || '').trim(),
          price: Number(p.price || 0),
        })),
        serviceDetails: {
          drinkService: {
            name: 'Nước uống giải khát',
            priceRange: `${drinkMin.toLocaleString('vi-VN')}đ - ${drinkMax.toLocaleString('vi-VN')}đ / chai`,
            minPrice: drinkMin,
            maxPrice: drinkMax,
            avgPrice: (drinkMin + drinkMax) / 2,
          },
          equipmentService: {
            name: 'Thuê dụng cụ thi đấu',
            priceRange: `${equipMin.toLocaleString('vi-VN')}đ - ${equipMax.toLocaleString('vi-VN')}đ / lượt`,
            minPrice: equipMin,
            maxPrice: equipMax,
            avgPrice: (equipMin + equipMax) / 2,
          },
          avgServiceCost: Math.round(((drinkMin + drinkMax) / 2 + (equipMin + equipMax) / 2) / 2),
        },
        description: formData.description.trim(),
        images: imagePreviews.map((p) => p.url),
      };

      if (isEditing && selectedCourt) {
        await api.put(`/courts/${selectedCourt._id}`, payload);
        showNotification('Cập nhật toàn bộ thông tin sân thành công!');
      } else {
        await api.post('/courts', payload);
        showNotification('Thêm sân mới vào cơ sở dữ liệu thành công!');
      }
      setShowFormModal(false);
      fetchCourts();
    } catch (err) {
      showNotification('Lỗi khi lưu dữ liệu sân: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // ── Confirm actions ───────────────────────────────────
  const handlePromptDelete = (court) => {
    setActiveMenuId(null);
    setConfirmModal({
      visible: true,
      title: '🗑️ Xác nhận xóa sân bãi',
      message: `Bạn có chắc chắn muốn xóa sân bãi "${court.name}" khỏi cơ sở dữ liệu không?`,
      actionType: 'delete',
      targetCourt: court,
    });
  };

  const handlePromptToggleStatus = (court) => {
    setActiveMenuId(null);
    const isHidden = court.status === 'hidden';
    setConfirmModal({
      visible: true,
      title: isHidden ? '👁️ Xác nhận hiển thị sân' : '🙈 Xác nhận ẩn sân bãi',
      message: isHidden
        ? `Bạn có muốn đổi trạng thái sân "${court.name}" sang ĐANG HOẠT ĐỘNG không?`
        : `Bạn có muốn ẨN sân bãi "${court.name}" khỏi danh sách tìm kiếm không?`,
      actionType: 'toggle_status',
      targetCourt: court,
    });
  };

  const handleConfirmAction = async () => {
    const { actionType, targetCourt } = confirmModal;
    try {
      if (actionType === 'delete') {
        await api.delete(`/courts/${targetCourt._id}`);
        showNotification(`Đã xóa sân "${targetCourt.name}" thành công.`);
      } else if (actionType === 'toggle_status') {
        const newStatus = targetCourt.status === 'hidden' ? 'active' : 'hidden';
        await api.put(`/courts/${targetCourt._id}`, { status: newStatus });
        showNotification(`Đã đổi trạng thái sân thành công.`);
      }
      setConfirmModal({ visible: false, title: '', message: '', actionType: null, targetCourt: null });
      fetchCourts();
    } catch (err) {
      showNotification('Lỗi: ' + (err.response?.data?.error || err.message), 'error');
    }
  };

  // ── Render price table in detail modal ────────────────
  const renderDetailPriceTable = (court) => {
    const sports = getCourtSports(court);
    return sports.map((sportKey) => {
      const sportMeta = SPORT_OPTIONS.find((s) => s.key === sportKey);
      if (!sportMeta) return null;
      const pitches = SPORT_PITCH_TYPES[sportKey] || [];
      const rows = pitches.map((pitchType) => {
        const defaultPrice = DEFAULT_PRICES_BY_SPORT[sportKey]?.[pitchType] || court.priceFrom || 300000;
        const sourcePrice = Array.isArray(court.pitchOptions) && court.pitchOptions.length > 0 ? court.pitchOptions : court.priceTable;
        const price = findPriceForPitch(sourcePrice, sportKey, pitchType, defaultPrice);
        return { pitchType, price };
      });

      if (rows.length === 0) return null;

      return (
        <div
          key={sportKey}
          style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${sportMeta.border}`, marginBottom: 10 }}
        >
          <div
            style={{
              background: sportMeta.bg,
              padding: '10px 14px',
              fontWeight: 700,
              fontSize: 13.5,
              color: '#111827',
              borderBottom: `1px solid ${sportMeta.border}`,
            }}
          >
            {sportMeta.label}
          </div>
          <table className="mobile-price-table" style={{ borderRadius: 0, border: 'none' }}>
            <thead>
              <tr>
                <th>Loại sân</th>
                <th>Giá thuê / giờ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ pitchType, price }) => (
                <tr key={pitchType}>
                  <td>{pitchType}</td>
                  <td className="price-green">
                    {Number(price).toLocaleString('vi-VN')}đ
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    });
  };

  // ── Render form price accordion ────────────────────────
  const renderPriceAccordion = () => {
    return formData.sports.map((sportKey) => {
      const sportMeta = SPORT_OPTIONS.find((s) => s.key === sportKey);
      if (!sportMeta) return null;
      const pitches = SPORT_PITCH_TYPES[sportKey] || [];
      const isOpen = openAccordions.includes(sportKey);
      const hasError = pitches.some((pt) => !!formErrors[`${sportKey}_${pt}`]);

      return (
        <div
          key={sportKey}
          className="price-accordion-block"
          style={{ marginBottom: 10, borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${hasError ? '#ef4444' : sportMeta.border}` }}
        >
          {/* Header */}
          <button
            type="button"
            className="price-accordion-header"
            style={{ background: sportMeta.bg, borderColor: sportMeta.border }}
            onClick={() =>
              setOpenAccordions((prev) =>
                prev.includes(sportKey) ? prev.filter((k) => k !== sportKey) : [...prev, sportKey]
              )
            }
          >
            <span style={{ fontWeight: 700, fontSize: 14 }}>
              {sportMeta.label}
              {hasError && <span style={{ color: '#ef4444', marginLeft: 8, fontSize: 12 }}>⚠ Chưa nhập giá</span>}
            </span>
            <span style={{ fontSize: 13, color: '#374151' }}>{isOpen ? '▲' : '▼'}</span>
          </button>

          {/* Body */}
          {isOpen && (
            <div className="price-accordion-body">
              <table className="form-price-table">
                <thead>
                  <tr>
                    <th style={{ width: '50%' }}>Loại sân</th>
                    <th>Giá thuê / giờ (VND)</th>
                  </tr>
                </thead>
                <tbody>
                  {pitches.map((pitchType) => {
                    const row = formData.priceTable.find(
                      (r) => r.sportKey === sportKey && r.fieldType === pitchType
                    );
                    const price = row?.price ?? '';
                    const errKey = `${sportKey}_${pitchType}`;
                    const hasRowErr = !!formErrors[errKey];

                    return (
                      <tr key={pitchType}>
                        <td style={{ fontWeight: 600, fontSize: 13.5, color: '#374151' }}>
                          {pitchType}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="10000"
                            className={`table-input price${hasRowErr ? ' input-error' : ''}`}
                            value={price}
                            onChange={(e) => handlePriceChange(sportKey, pitchType, e.target.value)}
                            placeholder="Nhập giá (VND)"
                          />
                          {hasRowErr && (
                            <div className="field-error-msg">Vui lòng nhập giá hợp lệ</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    });
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════
  const filteredCourts = courts; // server already filters

  return (
    <div className="courts-page">
      {/* Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🏟️ Quản lý Sân bãi</h1>
          <p className="page-subtitle">{courts.length} sân bãi trong cơ sở dữ liệu</p>
        </div>
        <button className="btn-add-court" onClick={initFormForAdd}>+ Thêm sân mới</button>
      </div>

      {/* Filters */}
      <div className="filter-card">
        <div className="filter-group">
          <div className="sport-tabs">
            {FILTER_SPORTS.map((s) => (
              <button
                key={s.key}
                className={`tab-btn${sportFilter === s.key ? ' active' : ''}`}
                onClick={() => setSportFilter(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <select
            className="status-select-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </div>
        <div className="search-box">
          <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên sân, địa chỉ..."
          />
        </div>
      </div>

      {/* Courts Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner" />
          <p>Đang tải dữ liệu sân bãi...</p>
        </div>
      ) : filteredCourts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏟️</div>
          <h3 className="empty-title">Không tìm thấy sân bãi nào</h3>
          <p className="empty-subtitle">Thử thay đổi bộ lọc hoặc thêm sân mới</p>
        </div>
      ) : (
        <div className="courts-grid">
          {filteredCourts.map((court) => (
            <div key={court._id} className={`court-card${court.status === 'hidden' ? ' is-hidden-card' : ''}`}>
              {/* Image */}
              <div className="court-img-wrap">
                {court.images?.[0] ? (
                  <img src={court.images[0]} alt={court.name} className="court-img" onClick={() => setImageViewer({ src: court.images[0], alt: court.name })} style={{ cursor: 'pointer' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 48 }}>🏟️</div>
                )}
                <div className="badge-overlay">{renderSportBadges(court)}</div>
                <span className={`status-tag-badge ${court.status}`}>
                  {court.status === 'active' ? '🟢 Hoạt động' : '🔴 Đã ẩn'}
                </span>
                {/* Kebab menu */}
                <div className="kebab-menu-container" ref={menuRef}>
                  <button
                    className="kebab-btn"
                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(activeMenuId === court._id ? null : court._id); }}
                  >
                    ⋮
                  </button>
                  {activeMenuId === court._id && (
                    <div className="kebab-dropdown">
                      <button className="dropdown-item" onClick={() => handleViewDetail(court)}>👁️ Xem chi tiết</button>
                      <button className="dropdown-item" onClick={() => handleOpenEdit(court)}>✏️ Chỉnh sửa sân</button>
                      <button className="dropdown-item" onClick={() => handlePromptToggleStatus(court)}>
                        {court.status === 'hidden' ? '🟢 Hiển thị lại' : '🙈 Ẩn sân bãi'}
                      </button>
                      <button className="dropdown-item danger" onClick={() => handlePromptDelete(court)}>🗑️ Xóa sân bãi</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="court-body">
                <h3 className="court-title">{court.name}</h3>
                <p className="court-address">📍 {court.address}</p>
                <div className="court-meta-row">
                  <span>⏰ {court.openTime} – {court.closeTime}</span>
                  <span>⭐ {court.rating?.toFixed(1) || '4.5'}</span>
                </div>
                <div className="court-price-row">
                  <span className="price-label">💰 Giá thuê:</span>
                  <span className="price-val">{getDisplayPrice(court)}</span>
                </div>
                <div className="court-bottom-row">
                  <button className="btn-detail-mobile-style" onClick={() => handleViewDetail(court)}>
                    Xem chi tiết →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── DETAIL MODAL ─────────────────────────────────── */}
      {showDetailModal && selectedCourt && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content mobile-detail-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="mobile-modal-header">
              <div className="flex-center-gap">
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedCourt.name}</h2>
                <span className={`status-tag-badge inline ${selectedCourt.status}`}>
                  {selectedCourt.status === 'active' ? '🟢 Hoạt động' : '🔴 Đã ẩn'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="rating-badge-mobile">⭐ {selectedCourt.rating?.toFixed(1) || '4.5'} ({selectedCourt.reviewCount || 0} đánh giá)</span>
                <button className="close-btn" onClick={() => setShowDetailModal(false)}>✕</button>
              </div>
            </div>

            {/* Body */}
            <div className="mobile-modal-body">
              {/* Gallery */}
              {selectedCourt.images?.length > 0 && (
                <div className="mobile-gallery-wrap">
                  <img src={selectedCourt.images[galleryIndex]} alt="" className="mobile-main-img" onClick={() => setImageViewer({ src: selectedCourt.images[galleryIndex], alt: selectedCourt.name })} style={{ cursor: 'pointer' }} />
                  {selectedCourt.images.length > 1 && (
                    <div className="mobile-thumbs-row">
                      {selectedCourt.images.map((img, i) => (
                        <img
                          key={i} src={img} alt="" className="mobile-thumb-img"
                          style={{ border: i === galleryIndex ? '2px solid #ff6b00' : '2px solid #fff', cursor: 'pointer' }}
                          onClick={() => {
                            setGalleryIndex(i);
                            setImageViewer({ src: img, alt: selectedCourt.name });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Info card */}
              <div className="mobile-court-info-card">
                <h2 className="mobile-court-name">{selectedCourt.name}</h2>
                <div className="mobile-sports-row">
                  <span className="meta-label">Môn thể thao:</span>
                  {renderSportBadges(selectedCourt)}
                </div>
                <p className="meta-label">Địa chỉ</p>
                <p className="mobile-meta-item">📍 {selectedCourt.address}</p>
                <div className="mobile-meta-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="meta-box">
                    <span className="box-icon">⏰</span>
                    <div>
                      <span className="box-title">Giờ mở cửa</span>
                      <span className="box-val">{selectedCourt.openTime} – {selectedCourt.closeTime}</span>
                    </div>
                  </div>
                  <div className="meta-box">
                    <span className="box-icon">💰</span>
                    <div>
                      <span className="box-title">Khoảng giá</span>
                      <span className="box-val green">
                        {getDisplayPrice(selectedCourt)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Owner info */}
              {selectedCourt.owner && (
                <div className="mobile-section-card">
                  <h3 className="mobile-sec-title">Thông tin Chủ sân</h3>
                  <div className="owner-card-content">
                    {selectedCourt.owner.avatar ? (
                      <img src={selectedCourt.owner.avatar} alt="" className="owner-card-avatar" />
                    ) : (
                      <div className="owner-card-avatar-fallback">
                        {(selectedCourt.owner.displayName || selectedCourt.owner.name || 'O')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="owner-card-info">
                      <p className="owner-card-name">{selectedCourt.owner.displayName || selectedCourt.owner.name}</p>
                      <span className="owner-card-tag">👑 Chủ sân</span>
                      <div className="owner-card-details">
                        {selectedCourt.owner.email && <span>📧 {selectedCourt.owner.email}</span>}
                        {selectedCourt.owner.phone && <span>📞 {selectedCourt.owner.phone}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Price table */}
              <div className="mobile-section-card">
                <h3 className="mobile-sec-title">Bảng giá thuê sân (theo loại sân)</h3>
                {renderDetailPriceTable(selectedCourt)}
              </div>

              {/* Services */}
              {selectedCourt.serviceDetails && (
                <div className="mobile-section-card">
                  <h3 className="mobile-sec-title">Dịch vụ đi kèm</h3>
                  <div className="service-menu-grid">
                    {selectedCourt.serviceDetails.drinkService && (
                      <div className="service-item-card">
                        <span className="service-icon">🥤</span>
                        <div>
                          <span className="service-name">Nước uống giải khát</span>
                          <span className="service-price">{selectedCourt.serviceDetails.drinkService.priceRange}</span>
                        </div>
                      </div>
                    )}
                    {selectedCourt.serviceDetails.equipmentService && (
                      <div className="service-item-card">
                        <span className="service-icon">🏸</span>
                        <div>
                          <span className="service-name">Thuê dụng cụ thi đấu</span>
                          <span className="service-price">{selectedCourt.serviceDetails.equipmentService.priceRange}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {(selectedCourt.serviceMenuImages || []).length > 0 && (
                    <div className="service-menu-gallery-wrap">
                      <p className="service-gallery-title">Ảnh bảng giá dịch vụ & menu thuê dụng cụ</p>
                      <div className="service-menu-gallery-grid">
                        {(selectedCourt.serviceMenuImages || []).map((img, index) => (
                          <img
                            key={index}
                            src={img}
                            alt={`Menu dịch vụ ${index + 1}`}
                            className="service-menu-image"
                            onClick={() => setImageViewer({ src: img, alt: `Menu dịch vụ ${index + 1}` })}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {selectedCourt.description && (
                <div className="mobile-section-card">
                  <h3 className="mobile-sec-title">Mô tả</h3>
                  <p className="mobile-desc-text">{selectedCourt.description}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mobile-modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailModal(false)}>Đóng</button>
              <button className="btn-primary" onClick={() => { setShowDetailModal(false); handleOpenEdit(selectedCourt); }}>✏️ Chỉnh sửa</button>
            </div>
          </div>
        </div>
      )}

      {imageViewer && (
        <div className="modal-overlay image-viewer-overlay" onClick={() => setImageViewer(null)}>
          <div className="image-viewer-modal" onClick={(e) => e.stopPropagation()}>
            <button className="image-viewer-close" type="button" onClick={() => setImageViewer(null)}>✕</button>
            <img src={imageViewer.src} alt={imageViewer.alt || 'Full size'} className="image-viewer-img" />
          </div>
        </div>
      )}

      {/* ─── FORM MODAL ───────────────────────────────────── */}
      {showFormModal && (
        <div className="modal-overlay" onClick={() => setShowFormModal(false)}>
          <div className="modal-content form-modal" style={{ maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isEditing ? '✏️ Chỉnh sửa sân bãi' : '➕ Thêm sân bãi mới'}</h2>
              <button className="close-btn" onClick={() => setShowFormModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div className="modal-body">
                <div className="form-grid">
                  {/* Tên sân */}
                  <div className="form-group full">
                    <label>Tên sân bãi <span className="req">*</span></label>
                    <input
                      required
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="VD: Sân bóng đá Hà Nội Sport"
                    />
                  </div>

                  {/* Môn thể thao */}
                  <div className="form-group full">
                    <label>Môn thể thao <span className="req">*</span></label>
                    <div className="checkbox-sports-group">
                      {SPORT_OPTIONS.map((s) => (
                        <label key={s.key} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={formData.sports.includes(s.key)}
                            onChange={() => handleToggleSportCheckbox(s.key)}
                          />
                          {s.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="form-group full">
                    <label>Địa chỉ <span className="req">*</span></label>
                    <input
                      required
                      value={formData.address}
                      onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                      placeholder="Số nhà, đường, phường..."
                    />
                  </div>

                  {/* District */}
                  <div className="form-group">
                    <label>Quận / Huyện</label>
                    <input
                      value={formData.district}
                      onChange={(e) => setFormData((p) => ({ ...p, district: e.target.value }))}
                      placeholder="VD: Quận Đống Đa"
                    />
                  </div>

                  {/* Phone */}
                  <div className="form-group">
                    <label>Số điện thoại</label>
                    <input
                      value={formData.phone}
                      onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="VD: 0912345678"
                    />
                  </div>

                  {/* Open / Close time */}
                  <div className="form-group">
                    <label>Giờ mở cửa</label>
                    <input type="time" value={formData.openTime} onChange={(e) => setFormData((p) => ({ ...p, openTime: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Giờ đóng cửa</label>
                    <input type="time" value={formData.closeTime} onChange={(e) => setFormData((p) => ({ ...p, closeTime: e.target.value }))} />
                  </div>

                  {/* Price range */}
                  <div className="form-group">
                    <label>Giá từ (VND)</label>
                    <input type="number" min="0" value={formData.priceFrom}
                      onChange={(e) => setFormData((p) => ({ ...p, priceFrom: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Giá đến (VND)</label>
                    <input type="number" min="0" value={formData.priceTo}
                      onChange={(e) => setFormData((p) => ({ ...p, priceTo: e.target.value }))} />
                  </div>



                  {/* Status */}
                  <div className="form-group">
                    <label>Trạng thái</label>
                    <select value={formData.status} onChange={(e) => setFormData((p) => ({ ...p, status: e.target.value }))}>
                      <option value="active">🟢 Đang hoạt động</option>
                      <option value="hidden">🔴 Ẩn sân bãi</option>
                    </select>
                  </div>

                  {/* ── BẢNG GIÁ THEO LOẠI SÂN ── */}
                  <div className="form-group full">
                    <label>
                      💰 Bảng giá thuê sân (theo loại sân) <span className="req">*</span>
                    </label>
                    <p style={{ margin: '4px 0 10px', fontSize: 12.5, color: '#6b7280' }}>
                      Nhập giá thuê (VND/giờ) cho từng loại sân của mỗi môn thể thao. Tất cả các trường bắt buộc.
                    </p>
                    <div className="price-editor-section">
                      {renderPriceAccordion()}
                    </div>
                  </div>

                  {/* Services */}
                  <div className="form-group full">
                    <label>🛎️ Giá dịch vụ đi kèm</label>
                    <div className="service-editor-section">
                      <div className="service-form-grid">
                        <div className="service-box-group">
                          <span className="svc-box-title">🥤 Nước uống giải khát (đ/chai)</span>
                          <div className="svc-box-inputs">
                            <div>
                              <label>Giá từ (đ)</label>
                              <input type="number" min="0" value={formData.drinkServiceMin}
                                onChange={(e) => setFormData((p) => ({ ...p, drinkServiceMin: e.target.value }))} />
                            </div>
                            <div>
                              <label>Giá đến (đ)</label>
                              <input type="number" min="0" value={formData.drinkServiceMax}
                                onChange={(e) => setFormData((p) => ({ ...p, drinkServiceMax: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                        <div className="service-box-group">
                          <span className="svc-box-title">🏸 Thuê dụng cụ thi đấu (đ/lượt)</span>
                          <div className="svc-box-inputs">
                            <div>
                              <label>Giá từ (đ)</label>
                              <input type="number" min="0" value={formData.equipmentServiceMin}
                                onChange={(e) => setFormData((p) => ({ ...p, equipmentServiceMin: e.target.value }))} />
                            </div>
                            <div>
                              <label>Giá đến (đ)</label>
                              <input type="number" min="0" value={formData.equipmentServiceMax}
                                onChange={(e) => setFormData((p) => ({ ...p, equipmentServiceMax: e.target.value }))} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Owner picker */}
                  <div className="form-group full">
                    <label>👑 Chủ sân (tùy chọn)</label>
                    {formData.owner ? (
                      <div className="owner-selected-card">
                        {formData.owner.avatar
                          ? <img src={formData.owner.avatar} alt="" className="owner-sel-avatar" />
                          : <div className="owner-sel-avatar" style={{ background: '#ff6b00', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, borderRadius: '50%' }}>
                              {(formData.owner.displayName || formData.owner.name || 'O')[0].toUpperCase()}
                            </div>
                        }
                        <div className="owner-sel-info">
                          <span className="owner-sel-name">{formData.owner.displayName || formData.owner.name}</span>
                          <span className="owner-sel-email">{formData.owner.email}</span>
                        </div>
                        <button type="button" className="owner-clear-btn" onClick={handleClearOwner}>✕</button>
                      </div>
                    ) : (
                      <div className="owner-search-wrap" ref={ownerSearchRef}>
                        <input
                          className="owner-search-input"
                          value={ownerSearchQuery}
                          onChange={(e) => handleOwnerSearch(e.target.value)}
                          onFocus={() => { if (!ownerSearchQuery) handleOwnerSearch(''); }}
                          placeholder="Tìm kiếm người dùng theo tên hoặc email..."
                        />
                        {showOwnerDropdown && (
                          <div className="owner-search-dropdown">
                            {ownerSearchLoading ? (
                              <div className="owner-search-loading">
                                <div className="spinner small" /> Đang tìm kiếm...
                              </div>
                            ) : ownerSearchResults.length === 0 ? (
                              <div className="owner-no-result">Không tìm thấy người dùng nào</div>
                            ) : (
                              ownerSearchResults.map((u) => (
                                <button key={u._id} type="button" className="owner-result-item" onClick={() => handleSelectOwner(u)}>
                                  {u.avatar
                                    ? <img src={u.avatar} alt="" className="owner-res-avatar" />
                                    : <div className="owner-res-avatar" style={{ background: '#ff6b00', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, borderRadius: '50%', width: 36, height: 36 }}>
                                        {(u.displayName || u.name || 'U')[0].toUpperCase()}
                                      </div>
                                  }
                                  <div className="owner-res-info">
                                    <span className="owner-res-name">{u.displayName || u.name}</span>
                                    <span className="owner-res-email">{u.email}</span>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="form-group full">
                    <label>Mô tả sân bãi</label>
                    <textarea
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Mô tả chi tiết về sân bãi, dịch vụ, tiện ích..."
                    />
                  </div>

                  {/* Images */}
                  <div className="form-group full">
                    <label>📷 Ảnh sân bãi</label>
                    <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageFilesSelected} />
                    <div className="image-upload-zone" onClick={() => imageInputRef.current?.click()}>
                      <div className="upload-hint">
                        <span className="upload-icon">📁</span>
                        <span>{imageUploading ? 'Đang tải lên...' : 'Nhấn để chọn ảnh'}</span>
                        <span className="upload-sub">PNG, JPG, WEBP tối đa 10MB mỗi ảnh</span>
                      </div>
                    </div>
                    {imagePreviews.length > 0 && (
                      <div className="image-preview-grid">
                        {imagePreviews.map((p, i) => (
                          <div key={i} className={`img-preview-item${p.source === 'uploading' ? ' uploading' : ''}`}>
                            <img src={p.url} alt="" />
                            {p.source === 'uploading' && (
                              <div className="img-uploading-overlay"><div className="spinner small" /></div>
                            )}
                            {p.source !== 'uploading' && (
                              <button type="button" className="img-remove-btn" onClick={() => handleRemoveImage(i)}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-group full">
                    <label>🧾 Ảnh bảng giá dịch vụ & menu thuê dụng cụ</label>
                    <input ref={serviceMenuImageInputRef} type="file" accept="image/*" multiple hidden onChange={handleServiceMenuImageFilesSelected} />
                    <div className="image-upload-zone" onClick={() => serviceMenuImageInputRef.current?.click()}>
                      <div className="upload-hint">
                        <span className="upload-icon">🧾</span>
                        <span>{serviceMenuImageUploading ? 'Đang tải lên...' : 'Nhấn để chọn ảnh bảng giá'}</span>
                        <span className="upload-sub">Ảnh niêm yết giá dịch vụ, đồ uống, thuê dụng cụ</span>
                      </div>
                    </div>
                    {serviceMenuImagePreviews.length > 0 && (
                      <div className="image-preview-grid">
                        {serviceMenuImagePreviews.map((p, i) => (
                          <div key={i} className={`img-preview-item${p.source === 'uploading' ? ' uploading' : ''}`}>
                            <img src={p.url} alt="" />
                            {p.source === 'uploading' && (
                              <div className="img-uploading-overlay"><div className="spinner small" /></div>
                            )}
                            {p.source !== 'uploading' && (
                              <button type="button" className="img-remove-btn" onClick={() => handleRemoveServiceMenuImage(i)}>✕</button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowFormModal(false)}>Hủy</button>
                <button type="submit" className="btn-primary" disabled={imageUploading}>
                  {imageUploading ? 'Đang xử lý...' : isEditing ? '💾 Lưu thay đổi' : '➕ Thêm sân'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRM DIALOG ───────────────────────────────── */}
      {confirmModal.visible && (
        <div className="modal-overlay">
          <div className="modal-content confirm-dialog-modal">
            <div className="modal-header">
              <h2>{confirmModal.title}</h2>
              <button className="close-btn"
                onClick={() => setConfirmModal({ visible: false, title: '', message: '', actionType: null, targetCourt: null })}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="confirm-dialog-msg">{confirmModal.message}</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary"
                onClick={() => setConfirmModal({ visible: false, title: '', message: '', actionType: null, targetCourt: null })}>
                Hủy
              </button>
              <button
                className={`btn-primary${confirmModal.actionType === 'delete' ? ' danger' : ''}`}
                onClick={handleConfirmAction}
              >
                {confirmModal.actionType === 'delete' ? '🗑️ Xóa ngay' : '✅ Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
