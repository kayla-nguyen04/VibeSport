# MongoDB Setup Hướng Dẫn

## 1️⃣ Chuẩn bị

### Cài đặt MongoDB

**Windows:**
- Tải từ: https://www.mongodb.com/try/download/community
- Chọn phiên bản Community mới nhất
- Chạy installer và chọn "Install MongoDB as a Service"
- MongoDB sẽ tự chạy khi khởi động

**macOS (nếu dùng Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Linux (Ubuntu):**
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

## 2️⃣ Kiểm tra MongoDB đang chạy

```bash
# Kiểm tra nhanh
npm run health

# Hoặc kiểm tra manual bằng mongosh
mongosh
> db.version()
```

## 3️⃣ Chạy Migration (Import dữ liệu từ db.json)

```bash
npm run migrate
```

Script này sẽ:
- ✓ Kết nối tới MongoDB
- ✓ Đọc dữ liệu từ db.json
- ✓ Import users vào MongoDB
- ✓ Bỏ qua users đã tồn tại
- ✓ Hiển thị thống kê

## 4️⃣ Kiểm tra dữ liệu trong MongoDB

```bash
mongosh
> use vibesport
> db.users.find()
```

## 5️⃣ Bắt đầu API Server

```bash
npm run api
```

Server sẽ:
- ✓ Kết nối tới MongoDB
- ✓ Lắng nghe ở http://0.0.0.0:4000
- ✓ Sử dụng Users collection từ MongoDB

## 📝 Lưu ý quan trọng

- **Backup**: Giữ lại db.json hoặc đổi tên thành db.json.backup
- **Xóa db.json**: Sau khi xác nhận dữ liệu đã import xong, bạn có thể xóa db.json
- **MONGODB_URI**: Đã cấu hình trong `.env` mặc định là `mongodb://127.0.0.1:27017/vibesport`

## 🔧 Tùy chỉnh MongoDB URI

Nếu MongoDB chạy ở server khác, cập nhật `.env`:
```
MONGODB_URI=mongodb://username:password@host:port/vibesport
```

## ✅ Hoàn tất!

Ứng dụng của bạn giờ đã sử dụng MongoDB thay vì db.json. Tất cả API endpoints vẫn hoạt động như cũ nhưng lưu dữ liệu trong MongoDB.
