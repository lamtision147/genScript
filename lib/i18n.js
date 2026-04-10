import { normalizeLanguage } from "@/lib/i18n-core";

export { LANGUAGE_OPTIONS, LANGUAGE_STORAGE_KEY, normalizeLanguage, toAiLang } from "@/lib/i18n-core";
export { getLocalizedProductConfig } from "@/lib/i18n-product-config";

const copyEn = {
  locale: "en-US",
  common: {
    language: "Language",
    studio: "Studio",
    videoScript: "Video Script",
    tiktokScheduler: "Reminder Planner",
    profile: "Profile",
    upgrade: "Upgrade Pro",
    login: "Login",
    logout: "Logout",
    copy: "Copy",
    download: "Download",
    delete: "Delete",
    open: "Open"
  },
  header: {
    brand: "Seller Studio"
  },
  script: {
    eyebrow: "Seller Studio",
    title: "Turn product info into sales-ready content — in seconds.",
    subtitle: "Paste your product details, pick a style, and generate compelling copy for TikTok Shop, Shopee, and beyond."
  },
  form: {
    panelTitle: "Product Input",
    sampleData: "Sample",
    reset: "Reset",
    imageSet: "Product Images",
    imageCounter: (count) => `${count}/1 image`,
    imageDropEmpty: "Drop images or click to upload",
    imageDropFilled: "Replace or add images",
    imageHint: "Clear product photos help generate more natural and accurate content. Max 1 image, 8MB per file.",
    autoSuggestOptions: "Auto Suggest Options",
    analyzing: "Analyzing...",
    confidenceLabel: "Confidence",
    addImageShort: "Add image",
    productName: "Product Name",
    productNamePlaceholder: "Example: Mini portable blender 600ml",
    category: "Category",
    subcategory: "Subcategory",
    channel: "Sales Channel",
    tone: "Tone",
    brandStyle: "Brand Style",
    mood: "Mood",
    targetCustomer: "Primary target customer",
    shortDescription: "Short context / core use case",
    highlights: "Product highlights (one per line)",
    highlightsHelper: (count) => `One point per line (${count}/8)`,
    priceSegment: "Target price segment",
    priceSegmentPlaceholder: "Example: 329k / mid-high segment",
    attributes: "Extra attributes / proof (one per line)",
    attributesHelper: (count) => `One point per line (${count}/10)`,
    usage: "How to Use",
    skinConcern: "Skin Concern",
    routineStep: "Routine Step",
    dimensions: "Detailed Dimensions",
    warranty: "Warranty",
    usageSpace: "Best Space",
    specs: "Key Specs",
    compatibility: "Compatibility",
    sizeGuide: "Size Guide",
    careGuide: "Care Guide",
    exchangePolicy: "Exchange / Sizing",
    generate: "Generate Content",
    generating: "Generating...",
    usagePlaceholder: "Use AM/PM after toner, before moisturizer",
    skinConcernPlaceholder: "Dryness, irritation, dehydration",
    routineStepPlaceholder: "Hydrating / recovery serum step",
    dimensionsPlaceholder: "22 x 14 x 10 cm",
    warrantyPlaceholder: "12-month warranty",
    usageSpacePlaceholder: "Desk, bedroom, kitchen",
    specsPlaceholder: "Bluetooth 5.3, 30h battery",
    compatibilityPlaceholder: "iOS, Android, laptop",
    sizeGuidePlaceholder: "S: 84-88 | M: 88-92 | L: 92-96",
    careGuidePlaceholder: "Gentle wash, no long soak, iron inside out",
    exchangePolicyPlaceholder: "One-time size exchange if tags are intact"
  },
  output: {
    title: "Product Intro Content",
    sourceAi: "Source: Generated",
    sourceFallback: "Source: Fallback",
    qualityLabel: "Quality",
    readabilityHint: "Layout is optimized for fast reading on TikTok Shop/Shopee.",
    optimizeHintPrefix: "Optimization tip:",
    selectedVariant: "Selected variant",
    variant: "Variant",
    loading: "Generating product intro content...",
    empty: "Fill product info and click Generate Content to see generated output.",
    loginPrompt: "Log in to save history, sync content, and manage favorites.",
    improve: "Improve",
    edit: "Edit",
    save: "Save",
    saving: "Saving...",
    cancel: "Cancel",
    contentLabel: "Content",
    hashtagsLabel: "Hashtags",
    contentPlaceholder: "Separate paragraphs with a blank line",
    hashtagsPlaceholder: "Example: #fashion #review",
    profileLabel: "Applied style",
    moodLabel: "Mood",
    sourceFallbackHint: "Fallback mode: style/mood effect can be reduced when the generation service is unavailable.",
    copy: "Copy",
    download: "Download"
  },
  history: {
    title: "Content History",
    versions: (count) => `${count} versions`,
    loginSyncNeeded: "Login required for sync",
    tipHasHistory: "Tip: pick a good version and click Improve for a stronger sales-ready version.",
    tipEmpty: "No version yet. Generate your first one to start history.",
    loginPrompt: "Want synced history and favorites? Please log in.",
    empty: "No saved history yet",
    open: "Open",
    delete: "Delete"
  },
  profile: {
    title: "Profile Settings",
    settingsTitle: "Profile Settings",
    favoritesCount: (count) => `${count} favorites`,
    notLoggedIn: "You need to log in to view profile and favorites.",
    emptyFavorites: "No favorites yet",
    changePassword: "Change Password",
    currentPassword: "Current Password",
    newPassword: "New Password",
    savePassword: "Save New Password"
  },
  auth: {
    login: "Login",
    signup: "Sign Up",
    resetPassword: "Forgot Password",
    continueGoogle: "Continue with Google",
    googleUnavailable: "Google sign-in appears after client ID is configured.",
    loginSubtitle: "Log in to save history, favorites, and sync data by account.",
    email: "Email",
    otpCode: "OTP Code",
    password: "Password",
    newPassword: "New Password",
    displayName: "Display Name",
    sendOtp: "Send OTP",
    sending: "Sending...",
    verifying: "Verifying...",
    resetPasswordAction: "Reset Password",
    processing: "Processing...",
    submitLogin: "Login",
    verifyOtp: "Verify OTP",
    resendOtp: "Resend OTP",
    resending: "Resending...",
    otpDemoPrefix: "Demo OTP"
  },
  messages: {
    enterEmail: "Please enter your email.",
    enterPassword: "Please enter your password.",
    enterDisplayName: "Please enter your display name.",
    pwdMin6: "Password must be at least 6 characters.",
    enterOtp: "Please enter OTP code.",
    newPwdMin6: "New password must be at least 6 characters.",
    otpSent: "OTP has been sent to your email.",
    otpResent: "A new OTP has been sent to your email.",
    resetOtpSent: "Password reset OTP has been sent.",
    resetSuccess: "Password reset successful. You can log in now.",
    genericError: "Something went wrong.",
    generateError: "Unable to generate content at this moment.",
    changePasswordSuccess: "Password changed successfully.",
    changePasswordError: "Unable to change password.",
    otpFallbackNoDebug: "OTP delivery failed. Please configure SMTP or try again later.",
    historyDateLocale: "en-US",
    untitled: "Untitled"
  }
};

const copyVi = {
  locale: "vi-VN",
  common: {
    language: "Ngôn ngữ",
    studio: "Trang tạo nội dung",
    videoScript: "Kịch bản video",
    tiktokScheduler: "Lịch nhắc việc",
    profile: "Hồ sơ",
    upgrade: "Nâng cấp Pro",
    login: "Đăng nhập",
    logout: "Đăng xuất",
    copy: "Copy",
    download: "Tải về",
    delete: "Xóa",
    open: "Xem lại"
  },
  header: {
    brand: "Seller Studio"
  },
  script: {
    eyebrow: "Seller Studio",
    title: "Tạo nội dung giới thiệu sản phẩm sẵn sàng đăng bán — chỉ trong vài giây.",
    subtitle: "Nhập thông tin, chọn phong cách, hệ thống sẽ tạo bản mô tả rõ lợi ích, nêu điểm khác biệt và gợi ý CTA để tăng tỉ lệ chốt đơn trên TikTok Shop/Shopee."
  },
  form: {
    panelTitle: "Nhập dữ liệu sản phẩm",
    sampleData: "Dữ liệu mẫu",
    reset: "Làm mới",
    imageSet: "Bộ ảnh sản phẩm",
    imageCounter: (count) => `${count}/1 ảnh`,
    imageDropEmpty: "Kéo thả ảnh hoặc bấm để tải lên",
    imageDropFilled: "Thay đổi hoặc thêm ảnh",
    imageHint: "Ảnh rõ sản phẩm giúp nội dung tạo ra tự nhiên và đúng ngữ cảnh hơn. Tối đa 1 ảnh, 8MB mỗi file.",
    autoSuggestOptions: "Gợi ý tự động",
    analyzing: "Đang phân tích...",
    confidenceLabel: "Độ tin cậy",
    addImageShort: "Thêm ảnh",
    productName: "Tên sản phẩm",
    productNamePlaceholder: "Ví dụ: Máy xay mini đa năng 600ml",
    category: "Danh mục",
    subcategory: "Dòng sản phẩm",
    channel: "Kênh bán",
    tone: "Phong cách",
    brandStyle: "Phong cách thương hiệu",
    mood: "Mood nội dung",
    targetCustomer: "Khách hàng mục tiêu chính",
    shortDescription: "Mô tả ngắn / bối cảnh sử dụng",
    highlights: "Điểm nổi bật sản phẩm (mỗi dòng 1 ý)",
    highlightsHelper: (count) => `Mỗi dòng 1 ý (${count}/8)`,
    priceSegment: "Phân khúc giá mục tiêu",
    priceSegmentPlaceholder: "Ví dụ: 329k / phân khúc trung cao",
    attributes: "Thuộc tính/Bằng chứng bổ sung (mỗi dòng 1 ý)",
    attributesHelper: (count) => `Mỗi dòng 1 ý (${count}/10)`,
    usage: "Cách dùng",
    skinConcern: "Vấn đề da",
    routineStep: "Bước trong routine",
    dimensions: "Kích thước chi tiết",
    warranty: "Bảo hành",
    usageSpace: "Không gian phù hợp",
    specs: "Thông số chính",
    compatibility: "Tương thích",
    sizeGuide: "Bảng size",
    careGuide: "Bảo quản",
    exchangePolicy: "Đổi trả / size",
    generate: "Tạo nội dung",
    generating: "Đang tạo...",
    usagePlaceholder: "Dùng sáng và tối sau toner, trước kem dưỡng",
    skinConcernPlaceholder: "Khô ráp, thiếu ẩm, dễ kích ứng",
    routineStepPlaceholder: "Serum phục hồi / serum cấp ẩm",
    dimensionsPlaceholder: "22 x 14 x 10 cm",
    warrantyPlaceholder: "Bảo hành 6 tháng",
    usageSpacePlaceholder: "Bàn làm việc, bếp, phòng ngủ",
    specsPlaceholder: "Bluetooth 5.3, pin 30h",
    compatibilityPlaceholder: "iOS, Android, laptop",
    sizeGuidePlaceholder: "S: 84-88 | M: 88-92 | L: 92-96",
    careGuidePlaceholder: "Giặt nhẹ, không ngâm lâu, ủi mặt trái",
    exchangePolicyPlaceholder: "Hỗ trợ đổi size 1 lần nếu còn tag"
  },
  output: {
    title: "Nội dung giới thiệu sản phẩm",
    sourceAi: "Nguồn: Tự động",
    sourceFallback: "Nguồn: Dự phòng",
    qualityLabel: "Chất lượng",
    readabilityHint: "Bố cục đã tối ưu theo chuẩn đọc nhanh trên TikTok Shop/Shopee.",
    optimizeHintPrefix: "Gợi ý tối ưu:",
    selectedVariant: "Biến thể đã chọn",
    variant: "Biến thể",
    loading: "Đang tạo nội dung...",
    empty: "Điền thông tin sản phẩm rồi bấm Tạo nội dung để xem phần giới thiệu được sinh tự động.",
    loginPrompt: "Đăng nhập để lưu lịch sử, đồng bộ nội dung và đánh dấu yêu thích theo tài khoản của bạn.",
    improve: "Cải tiến thêm",
    edit: "Chỉnh sửa",
    save: "Lưu",
    saving: "Đang lưu...",
    cancel: "Hủy",
    contentLabel: "Nội dung",
    hashtagsLabel: "Hashtag",
    contentPlaceholder: "Mỗi đoạn cách nhau 1 dòng trống",
    hashtagsPlaceholder: "Ví dụ: #thoitrang #review",
    profileLabel: "Phong cách đã áp dụng",
    moodLabel: "Mood",
    sourceFallbackHint: "Đang dùng fallback: hiệu ứng phong cách/mood có thể giảm khi dịch vụ tạo nội dung chưa sẵn sàng.",
    copy: "Copy",
    download: "Tải về"
  },
  history: {
    title: "Lịch sử nội dung",
    versions: (count) => `${count} phiên bản`,
    loginSyncNeeded: "Cần đăng nhập để đồng bộ",
    tipHasHistory: "Mẹo: chọn bản tốt nhất, bấm Cải tiến thêm để tạo bản chốt sale nhanh hơn.",
    tipEmpty: "Chưa có bản nào. Hãy tạo bản đầu tiên để bắt đầu lưu lịch sử.",
    loginPrompt: "Muốn xem lịch sử nội dung và lưu nội dung yêu thích? Hãy đăng nhập để đồng bộ theo tài khoản của bạn.",
    empty: "Chưa có lịch sử",
    open: "Xem lại",
    delete: "Xóa"
  },
  profile: {
    title: "Cài đặt hồ sơ",
    settingsTitle: "Cài đặt hồ sơ",
    favoritesCount: (count) => `${count} nội dung yêu thích`,
    notLoggedIn: "Bạn cần đăng nhập để xem phần profile và nội dung yêu thích.",
    emptyFavorites: "Chưa có nội dung yêu thích",
    changePassword: "Đổi mật khẩu",
    currentPassword: "Mật khẩu hiện tại",
    newPassword: "Mật khẩu mới",
    savePassword: "Lưu mật khẩu mới"
  },
  auth: {
    login: "Đăng nhập",
    signup: "Tạo tài khoản",
    resetPassword: "Quên mật khẩu",
    continueGoogle: "Tiếp tục với Google",
    googleUnavailable: "Google sign-in sẽ bật khi có cấu hình client ID.",
    loginSubtitle: "Đăng nhập để lưu lịch sử, đánh dấu nội dung yêu thích và đồng bộ dữ liệu theo tài khoản của bạn.",
    email: "Email",
    otpCode: "Mã OTP",
    password: "Mật khẩu",
    newPassword: "Mật khẩu mới",
    displayName: "Tên hiển thị",
    sendOtp: "Gửi OTP",
    sending: "Đang gửi...",
    verifying: "Đang xác thực...",
    resetPasswordAction: "Đặt lại mật khẩu",
    processing: "Đang xử lý...",
    submitLogin: "Đăng nhập",
    verifyOtp: "Xác thực OTP",
    resendOtp: "Gửi lại OTP",
    resending: "Đang gửi lại...",
    otpDemoPrefix: "OTP thử nghiệm"
  },
  messages: {
    enterEmail: "Vui lòng nhập email.",
    enterPassword: "Vui lòng nhập mật khẩu.",
    enterDisplayName: "Vui lòng nhập tên hiển thị.",
    pwdMin6: "Mật khẩu cần ít nhất 6 ký tự.",
    enterOtp: "Vui lòng nhập mã OTP.",
    newPwdMin6: "Mật khẩu mới cần ít nhất 6 ký tự.",
    otpSent: "OTP đã được gửi đến email của bạn.",
    otpResent: "OTP mới đã được gửi lại đến email của bạn.",
    resetOtpSent: "OTP đặt lại mật khẩu đã được gửi.",
    resetSuccess: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.",
    genericError: "Đã xảy ra lỗi.",
    generateError: "Không thể tạo nội dung lúc này.",
    changePasswordSuccess: "Đổi mật khẩu thành công.",
    changePasswordError: "Không thể đổi mật khẩu.",
    otpFallbackNoDebug: "Không thể gửi OTP. Vui lòng cấu hình SMTP hoặc thử lại sau.",
    historyDateLocale: "vi-VN",
    untitled: "Chưa có tiêu đề"
  }
};

const copyZh = {
  ...copyEn,
  locale: "zh-CN",
  common: { ...copyEn.common, language: "语言", videoScript: "视频脚本", login: "登录", logout: "退出", delete: "删除", open: "查看" },
  script: {
    eyebrow: "Seller Studio",
    title: "几秒内将商品信息变成吸引买家的销售文案。",
    subtitle: "填写商品信息，选择风格，系统会为你生成适合TikTok、淘宝、拼多多的专业文案。"
  },
  form: {
    ...copyEn.form,
    panelTitle: "商品信息",
    sampleData: "示例",
    reset: "重置",
    imageSet: "商品图片",
    imageCounter: (count) => `${count}/1 张图片`,
    autoSuggestOptions: "自动建议",
    analyzing: "分析中...",
    confidenceLabel: "置信度",
    addImageShort: "添加图片",
    generate: "生成内容",
    generating: "生成中..."
  },
  output: {
    ...copyEn.output,
    title: "商品介绍内容",
    sourceAi: "来源：自动生成",
    sourceFallback: "来源：Fallback",
    qualityLabel: "质量",
    improve: "优化",
    download: "下载"
  },
  history: {
    ...copyEn.history,
    title: "内容历史",
    versions: (count) => `${count} 个版本`,
    loginSyncNeeded: "登录后可同步",
    empty: "暂无历史",
    open: "查看",
    delete: "删除"
  },
  profile: {
    ...copyEn.profile,
    title: "个人设置",
    settingsTitle: "个人设置",
    favoritesCount: (count) => `${count} 个收藏`,
    emptyFavorites: "暂无收藏",
    changePassword: "修改密码",
    currentPassword: "当前密码",
    newPassword: "新密码",
    savePassword: "保存新密码"
  },
  auth: {
    ...copyEn.auth,
    login: "登录",
    signup: "注册",
    resetPassword: "忘记密码",
    continueGoogle: "使用 Google 继续",
    sendOtp: "发送 OTP",
    verifyOtp: "验证 OTP",
    submitLogin: "登录"
  },
  messages: {
    ...copyEn.messages,
    historyDateLocale: "zh-CN"
  }
};

const copyJa = {
  ...copyEn,
  locale: "ja-JP",
  common: { ...copyEn.common, language: "言語", videoScript: "動画台本", login: "ログイン", logout: "ログアウト", delete: "削除", open: "開く" },
  script: {
    eyebrow: "Seller Studio",
    title: "商品情報を数秒で売れる文章に変換する。",
    subtitle: "商品情報を入力してスタイルを選ぶだけ。システムがTikTok・楽天・Amazonに対応した魅力的な文章を生成します。"
  },
  form: {
    ...copyEn.form,
    panelTitle: "商品入力",
    sampleData: "サンプル",
    reset: "リセット",
    imageSet: "商品画像",
    imageCounter: (count) => `${count}/1 画像`,
    autoSuggestOptions: "自動提案",
    analyzing: "分析中...",
    confidenceLabel: "信頼度",
    addImageShort: "画像追加",
    generate: "コンテンツ生成",
    generating: "生成中..."
  },
  output: {
    ...copyEn.output,
    title: "商品紹介コンテンツ",
    sourceAi: "ソース: 自動生成",
    sourceFallback: "ソース: Fallback",
    qualityLabel: "品質",
    improve: "改善",
    download: "ダウンロード"
  },
  history: {
    ...copyEn.history,
    title: "履歴",
    versions: (count) => `${count} バージョン`,
    loginSyncNeeded: "同期にはログインが必要です",
    empty: "履歴はまだありません",
    open: "開く",
    delete: "削除"
  },
  profile: {
    ...copyEn.profile,
    title: "プロフィール設定",
    settingsTitle: "プロフィール設定",
    favoritesCount: (count) => `お気に入り ${count} 件`,
    emptyFavorites: "お気に入りはまだありません",
    changePassword: "パスワード変更",
    currentPassword: "現在のパスワード",
    newPassword: "新しいパスワード",
    savePassword: "新しいパスワードを保存"
  },
  auth: {
    ...copyEn.auth,
    login: "ログイン",
    signup: "登録",
    resetPassword: "パスワードを忘れた",
    continueGoogle: "Google で続行",
    sendOtp: "OTP を送信",
    verifyOtp: "OTP を確認",
    submitLogin: "ログイン"
  },
  messages: {
    ...copyEn.messages,
    historyDateLocale: "ja-JP"
  }
};

const copyKo = {
  ...copyEn,
  locale: "ko-KR",
  common: { ...copyEn.common, language: "언어", videoScript: "영상 스크립트", login: "로그인", logout: "로그아웃", delete: "삭제", open: "보기" },
  script: {
    eyebrow: "Seller Studio",
    title: "상품 정보를 몇 초 만에 판매용 콘텐츠로 변환하세요.",
    subtitle: "상품 정보를 입력하고 스타일을 선택하면 시스템이 TikTok·쿠팡·스마트스토어에 최적화된 문구를 작성해 드립니다."
  },
  form: {
    ...copyEn.form,
    panelTitle: "상품 입력",
    sampleData: "샘플",
    reset: "초기화",
    imageSet: "상품 이미지",
    imageCounter: (count) => `${count}/1 이미지`,
    autoSuggestOptions: "자동 제안",
    analyzing: "분석 중...",
    confidenceLabel: "신뢰도",
    addImageShort: "이미지 추가",
    generate: "콘텐츠 생성",
    generating: "생성 중..."
  },
  output: {
    ...copyEn.output,
    title: "상품 소개 콘텐츠",
    sourceAi: "출처: 자동 생성",
    sourceFallback: "출처: Fallback",
    qualityLabel: "품질",
    improve: "개선",
    download: "다운로드"
  },
  history: {
    ...copyEn.history,
    title: "히스토리",
    versions: (count) => `${count}개 버전`,
    loginSyncNeeded: "동기화하려면 로그인 필요",
    empty: "저장된 히스토리가 없습니다",
    open: "보기",
    delete: "삭제"
  },
  profile: {
    ...copyEn.profile,
    title: "프로필 설정",
    settingsTitle: "프로필 설정",
    favoritesCount: (count) => `즐겨찾기 ${count}개`,
    emptyFavorites: "즐겨찾기가 없습니다",
    changePassword: "비밀번호 변경",
    currentPassword: "현재 비밀번호",
    newPassword: "새 비밀번호",
    savePassword: "새 비밀번호 저장"
  },
  auth: {
    ...copyEn.auth,
    login: "로그인",
    signup: "회원가입",
    resetPassword: "비밀번호 찾기",
    continueGoogle: "Google로 계속",
    sendOtp: "OTP 보내기",
    verifyOtp: "OTP 확인",
    submitLogin: "로그인"
  },
  messages: {
    ...copyEn.messages,
    historyDateLocale: "ko-KR"
  }
};

const copyEs = {
  ...copyEn,
  locale: "es-ES",
  common: { ...copyEn.common, language: "Idioma", videoScript: "Guion de video", login: "Iniciar sesión", logout: "Cerrar sesión" },
  script: {
    eyebrow: "Seller Studio",
    title: "Convierte la info de tu producto en texto de ventas — en segundos.",
    subtitle: "Pega los datos del producto, elige el estilo y deja que el sistema escriba el copy perfecto para TikTok Shop y más."
  },
  form: {
    ...copyEn.form,
    autoSuggestOptions: "Sugerencia automática",
    analyzing: "Analizando...",
    confidenceLabel: "Confianza",
    addImageShort: "Agregar imagen"
  }
};
const copyFr = {
  ...copyEn,
  locale: "fr-FR",
  common: { ...copyEn.common, language: "Langue", videoScript: "Script vidéo", login: "Connexion", logout: "Déconnexion" },
  script: {
    eyebrow: "Seller Studio",
    title: "Transformez vos infos produit en contenu de vente — en quelques secondes.",
    subtitle: "Saisissez les détails, choisissez le style, et laissez le système rédiger des textes percutants pour TikTok Shop, Amazon et plus."
  },
  form: {
    ...copyEn.form,
    autoSuggestOptions: "Suggestion automatique",
    analyzing: "Analyse en cours...",
    confidenceLabel: "Confiance",
    addImageShort: "Ajouter image"
  }
};
const copyDe = {
  ...copyEn,
  locale: "de-DE",
  common: { ...copyEn.common, language: "Sprache", videoScript: "Video-Skript", login: "Anmelden", logout: "Abmelden" },
  script: {
    eyebrow: "Seller Studio",
    title: "Produktinfos in Sekunden in verkaufsstarke Texte verwandeln.",
    subtitle: "Produktdaten eingeben, Stil wählen – das System schreibt überzeugende Texte für TikTok Shop, Amazon und mehr."
  },
  form: {
    ...copyEn.form,
    autoSuggestOptions: "Automatische Vorschläge",
    analyzing: "Wird analysiert...",
    confidenceLabel: "Vertrauen",
    addImageShort: "Bild hinzufügen"
  }
};

const COPY_BY_LANG = {
  vi: copyVi,
  en: copyEn,
  zh: copyZh,
  ja: copyJa,
  ko: copyKo,
  es: copyEs,
  fr: copyFr,
  de: copyDe
};

export function getCopy(language) {
  const normalized = normalizeLanguage(language);
  return COPY_BY_LANG[normalized] || copyEn;
}

const knownMessageMap = {
  "Vui lòng nhập email.": "enterEmail",
  "Vui lòng nhập mật khẩu.": "enterPassword",
  "Vui lòng nhập tên hiển thị.": "enterDisplayName",
  "Mật khẩu cần ít nhất 6 ký tự.": "pwdMin6",
  "Vui lòng nhập mã OTP.": "enterOtp",
  "Mật khẩu mới cần ít nhất 6 ký tự.": "newPwdMin6",
  "OTP đã được gửi đến email của bạn.": "otpSent",
  "OTP đặt lại mật khẩu đã được gửi.": "resetOtpSent",
  "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.": "resetSuccess",
  "Đã xảy ra lỗi.": "genericError",
  "Không thể tạo nội dung lúc này.": "generateError",
  "Dịch vụ tạo nội dung đang tạm bận hoặc trả kết quả chưa hợp lệ. Vui lòng thử lại.": "generateError",
  "Đổi mật khẩu thành công.": "changePasswordSuccess",
  "Không thể đổi mật khẩu.": "changePasswordError"
};

export function localizeKnownMessage(message, copy) {
  const key = knownMessageMap[String(message || "").trim()];
  if (!key) return message;
  return copy?.messages?.[key] || message;
}



