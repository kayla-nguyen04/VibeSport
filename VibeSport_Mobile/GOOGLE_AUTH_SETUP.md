# Cấu hình đăng nhập Google

## 1. Tạo OAuth Client trên Google Cloud Console

- Vào `Google Cloud Console`
- Chọn hoặc tạo project mới
- Vào `APIs & Services` > `OAuth consent screen`
- Khai báo app name, email hỗ trợ, test users
- Vào `Credentials` > `Create Credentials` > `OAuth client ID`

Tạo 3 client:

1. `Android`
2. `iOS`
3. `Web application`

## 2. Điền client ID vào app

Mở file [src/components/constants/googleAuth.js](./src/components/constants/googleAuth.js) và thay:

- `YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com`
- `YOUR_IOS_CLIENT_ID.apps.googleusercontent.com`
- `YOUR_WEB_CLIENT_ID.apps.googleusercontent.com`

## 3. Redirect scheme đang dùng

App đã cấu hình:

- `scheme`: `vibesportmobile`
- Android package: `com.vibesport.vpapp`
- iOS bundle identifier: `com.vibesport.vpapp`

Redirect native hiện tại:

```text
vibesportmobile://oauthredirect
```

## 4. Lưu ý quan trọng

- Google login kiểu này không chạy trong `Expo Go`
- Phải dùng `development build`

## 5. Chạy project

API:

```powershell
npm run api
```

App:

```powershell
npx expo start --clear
```

Nếu cần build để test Google login trên máy thật:

```powershell
npx expo run:android
```

Hoặc dùng EAS/dev build nếu bạn đã cấu hình môi trường native.
