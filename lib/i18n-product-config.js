import { categoryHints as categoryHintsVi, subcategoryMap as subcategoryMapVi } from "@/lib/product-config";
import { normalizeLanguage } from "@/lib/i18n-core";

const categoryLabelsByLang = {
  vi: {
    fashion: "Thời trang",
    skincare: "Mỹ phẩm / Skincare",
    beautyTools: "Dụng cụ làm đẹp / Chăm sóc cá nhân",
    home: "Gia dụng",
    furnitureDecor: "Nội thất / Trang trí",
    electronics: "Điện tử / Phụ kiện",
    food: "Thực phẩm / Đồ uống",
    householdEssentials: "Hàng tiêu dùng nhanh",
    footwear: "Giày dép",
    bags: "Túi xách / Ví",
    accessories: "Phụ kiện",
    fragrance: "Nước hoa / Hương thơm",
    pet: "Thú cưng",
    sports: "Thể thao / Fitness",
    motherBaby: "Mẹ & Bé",
    healthCare: "Sức khỏe",
    booksStationery: "Sách / Văn phòng phẩm",
    toysGames: "Đồ chơi / Board game",
    autoMoto: "Ô tô / Xe máy / Xe đạp",
    phoneTablet: "Điện thoại / Tablet",
    computerOffice: "Máy tính / Thiết bị văn phòng",
    cameraDrone: "Máy ảnh / Drone",
    homeAppliances: "Điện gia dụng",
    toolsHardware: "Dụng cụ / Cải tạo nhà",
    digitalGoods: "Sản phẩm số / Voucher",
    other: "Khác"
  },
  en: {
    fashion: "Fashion",
    skincare: "Skincare / Beauty",
    beautyTools: "Beauty Tools / Personal Care",
    home: "Home",
    furnitureDecor: "Furniture / Decor",
    electronics: "Electronics / Accessories",
    food: "Food / Beverage",
    householdEssentials: "Household Essentials",
    footwear: "Footwear",
    bags: "Bags / Wallets",
    accessories: "Accessories",
    fragrance: "Fragrance",
    pet: "Pet",
    sports: "Sports / Fitness",
    motherBaby: "Mother & Baby",
    healthCare: "Health Care",
    booksStationery: "Books / Stationery",
    toysGames: "Toys / Games",
    autoMoto: "Auto / Moto / Bicycle",
    phoneTablet: "Phone / Tablet",
    computerOffice: "Computer / Office",
    cameraDrone: "Camera / Drone",
    homeAppliances: "Home Appliances",
    toolsHardware: "Tools / Hardware",
    digitalGoods: "Digital Goods / Voucher",
    other: "Other"
  },
  zh: {
    fashion: "时尚",
    skincare: "护肤 / 美妆",
    beautyTools: "美容工具 / 个护设备",
    home: "家居",
    furnitureDecor: "家具 / 装饰",
    electronics: "电子 / 配件",
    food: "食品 / 饮品",
    householdEssentials: "日用快消品",
    footwear: "鞋类",
    bags: "包袋 / 钱包",
    accessories: "配饰",
    fragrance: "香氛",
    pet: "宠物",
    sports: "运动 / 健身",
    motherBaby: "母婴",
    healthCare: "健康护理",
    booksStationery: "图书 / 文具",
    toysGames: "玩具 / 桌游",
    autoMoto: "汽车 / 摩托 / 自行车",
    phoneTablet: "手机 / 平板",
    computerOffice: "电脑 / 办公设备",
    cameraDrone: "相机 / 无人机",
    homeAppliances: "家电",
    toolsHardware: "工具 / 五金",
    digitalGoods: "数字商品 / 礼券",
    other: "其他"
  },
  ja: {
    fashion: "ファッション",
    skincare: "スキンケア / 美容",
    beautyTools: "美容ツール / パーソナルケア機器",
    home: "ホーム",
    furnitureDecor: "家具 / インテリア",
    electronics: "電子機器 / アクセサリー",
    food: "食品 / 飲料",
    householdEssentials: "日用品",
    footwear: "シューズ",
    bags: "バッグ / 財布",
    accessories: "アクセサリー",
    fragrance: "フレグランス",
    pet: "ペット",
    sports: "スポーツ / フィットネス",
    motherBaby: "マタニティ / ベビー",
    healthCare: "ヘルスケア",
    booksStationery: "書籍 / 文房具",
    toysGames: "おもちゃ / ボードゲーム",
    autoMoto: "自動車 / バイク / 自転車",
    phoneTablet: "スマホ / タブレット",
    computerOffice: "PC / オフィス機器",
    cameraDrone: "カメラ / ドローン",
    homeAppliances: "家電",
    toolsHardware: "工具 / DIY",
    digitalGoods: "デジタル商品 / バウチャー",
    other: "その他"
  },
  ko: {
    fashion: "패션",
    skincare: "스킨케어 / 뷰티",
    beautyTools: "뷰티 도구 / 퍼스널케어 기기",
    home: "리빙",
    furnitureDecor: "가구 / 인테리어",
    electronics: "전자 / 액세서리",
    food: "식품 / 음료",
    householdEssentials: "생활필수품",
    footwear: "신발",
    bags: "가방 / 지갑",
    accessories: "액세서리",
    fragrance: "향수",
    pet: "반려동물",
    sports: "스포츠 / 피트니스",
    motherBaby: "유아 / 출산",
    healthCare: "헬스케어",
    booksStationery: "도서 / 문구",
    toysGames: "완구 / 보드게임",
    autoMoto: "자동차 / 오토바이 / 자전거",
    phoneTablet: "스마트폰 / 태블릿",
    computerOffice: "컴퓨터 / 오피스",
    cameraDrone: "카메라 / 드론",
    homeAppliances: "가전",
    toolsHardware: "공구 / 하드웨어",
    digitalGoods: "디지털 상품 / 바우처",
    other: "기타"
  }
};

const subcategoryMapEn = {
  fashion: ["Women office wear", "Men basic style", "Plus-size fashion", "Streetwear", "Sleepwear / loungewear"],
  skincare: ["Acne-sensitive", "Brightening", "Barrier repair", "Sunscreen", "Cleansing"],
  beautyTools: ["Hair styling tools", "Skin care devices", "Makeup tools", "Nail tools", "Personal hygiene tools"],
  home: ["Kitchen essentials", "Home cleaning", "Room decor", "Storage", "Bedroom care"],
  furnitureDecor: ["Sofa / chairs", "Desk / shelves", "Decor lighting", "Curtains / rugs", "Tabletop decor"],
  electronics: ["Phone accessories", "Audio / gaming", "Smart home", "Charging / battery", "Office devices"],
  food: ["Snacks", "Convenient drinks", "Eat-clean", "Food gifts", "Quick cooking"],
  householdEssentials: ["Tissue and paper", "Laundry detergent / softener", "Kitchen cleaning", "Bathroom care", "Daily consumables"],
  footwear: ["Sneakers", "Sandals", "Running shoes", "Office shoes", "Daily slippers"],
  bags: ["Office bags", "Mini bags", "Backpacks", "Wallets", "Travel bags"],
  accessories: ["Jewelry", "Hats / glasses", "Belts / scarves", "Watches", "Hair accessories"],
  fragrance: ["Women fragrance", "Men fragrance", "Room scent", "Body mist", "Essential oil"],
  pet: ["Cat food/snacks", "Dog care", "Pet accessories", "Pet toys", "Pet hygiene"],
  sports: ["Gym", "Yoga / pilates", "Running", "Sports accessories", "Water bottles"],
  motherBaby: ["Milk / diapers", "Baby food", "Newborn essentials", "Stroller / carrier", "Early learning toys"],
  healthCare: ["Vitamins / minerals", "Health trackers", "Joint support", "Sleep support", "Personal care"],
  booksStationery: ["Self-help books", "Kids books", "Stationery", "Study tools", "Planner / calendar"],
  toysGames: ["Educational toys", "Board games", "Building sets", "Active toys", "Collectibles"],
  autoMoto: ["Motorbike accessories", "Car accessories", "Helmets", "Car care", "Vehicle electronics"],
  phoneTablet: ["Smartphones", "Tablets", "Cases / screen protector", "Chargers / cables", "Earphones"],
  computerOffice: ["Laptops", "Monitors", "Keyboard / mouse", "Networking", "Office accessories"],
  cameraDrone: ["Action camera", "Security camera", "Camera", "Drone", "Shooting accessories"],
  homeAppliances: ["Blender / juicer", "Air fryer / cooker", "Vacuum", "Air purifier", "Fan / heater"],
  toolsHardware: ["Hand tools", "Drill / screwdriver", "Measurement", "Safety gear", "Repair supplies"],
  digitalGoods: ["Digital voucher", "Gift card", "Software license", "Online course", "Digital service package"],
  other: ["General", "Seasonal", "Gift", "Lifestyle", "Other"]
};

const subcategoryMapZh = {
  fashion: ["女装通勤", "男装基础款", "大码时尚", "街头风", "睡衣/家居服"],
  skincare: ["痘痘敏感肌", "提亮肤色", "屏障修护", "防晒", "清洁"],
  beautyTools: ["美发工具", "护肤仪器", "彩妆工具", "美甲工具", "个人清洁工具"],
  home: ["厨房用品", "家居清洁", "房间装饰", "收纳", "卧室护理"],
  furnitureDecor: ["沙发/椅子", "桌子/置物架", "装饰灯", "窗帘/地毯", "桌面摆件"],
  electronics: ["手机配件", "音频/游戏", "智能家居", "充电/电池", "办公设备"],
  food: ["零食", "即饮饮品", "轻食健身", "食品礼盒", "快手烹饪"],
  householdEssentials: ["纸品", "洗衣液/柔顺剂", "厨房清洁", "卫浴清洁", "日常耗材"],
  footwear: ["运动鞋", "凉鞋", "跑鞋", "通勤鞋", "日常拖鞋"],
  bags: ["通勤包", "迷你包", "背包", "钱包", "旅行包"],
  accessories: ["饰品", "帽子/眼镜", "腰带/围巾", "手表", "发饰"],
  fragrance: ["女士香水", "男士香水", "室内香氛", "身体喷雾", "精油"],
  pet: ["猫粮/零食", "狗狗护理", "宠物配件", "宠物玩具", "宠物清洁"],
  sports: ["健身", "瑜伽/普拉提", "跑步", "运动配件", "水杯"],
  motherBaby: ["奶粉/纸尿裤", "婴儿辅食", "新生儿用品", "婴儿车/背带", "早教玩具"],
  healthCare: ["维生素", "健康监测设备", "关节养护", "助眠", "个人护理"],
  booksStationery: ["技能书", "儿童读物", "文具", "学习工具", "手账/日历"],
  toysGames: ["益智玩具", "桌游", "拼装", "运动玩具", "模型"],
  autoMoto: ["摩托配件", "汽车配件", "头盔", "洗车护理", "车载电子"],
  phoneTablet: ["手机", "平板", "保护壳/钢化膜", "充电线", "耳机"],
  computerOffice: ["笔记本", "显示器", "键鼠", "网络设备", "办公配件"],
  cameraDrone: ["运动相机", "监控相机", "相机", "无人机", "拍摄配件"],
  homeAppliances: ["搅拌/榨汁", "空气炸锅/电锅", "吸尘器", "空气净化", "风扇/取暖"],
  toolsHardware: ["手动工具", "电钻", "测量工具", "防护用品", "维修材料"],
  digitalGoods: ["电子券", "礼品卡", "软件授权", "在线课程", "数字服务包"],
  other: ["通用", "季节性", "礼物", "生活方式", "其他"]
};

const subcategoryMapJa = {
  fashion: ["レディース通勤", "メンズベーシック", "プラスサイズ", "ストリート", "ルームウェア"],
  skincare: ["敏感・ニキビ", "ブライトニング", "バリア補修", "日焼け止め", "洗浄"],
  beautyTools: ["ヘアスタイリング機器", "スキンケアデバイス", "メイクツール", "ネイルツール", "パーソナル清潔用品"],
  home: ["キッチン用品", "掃除用品", "部屋デコ", "収納", "寝室ケア"],
  furnitureDecor: ["ソファ/チェア", "デスク/シェルフ", "装飾ライト", "カーテン/ラグ", "卓上デコ"],
  electronics: ["スマホアクセ", "オーディオ/ゲーム", "スマートホーム", "充電/バッテリー", "オフィス機器"],
  food: ["スナック", "ドリンク", "ヘルシー", "ギフト食品", "時短料理"],
  householdEssentials: ["紙製品", "洗濯洗剤/柔軟剤", "キッチン洗浄", "バスルームケア", "日常消耗品"],
  footwear: ["スニーカー", "サンダル", "ランニング", "通勤シューズ", "スリッパ"],
  bags: ["通勤バッグ", "ミニバッグ", "バックパック", "財布", "旅行バッグ"],
  accessories: ["アクセサリー", "帽子/メガネ", "ベルト/スカーフ", "時計", "ヘアアクセ"],
  fragrance: ["レディース香水", "メンズ香水", "ルームフレグランス", "ボディミスト", "アロマ"],
  pet: ["猫フード/おやつ", "犬ケア", "ペット用品", "ペット玩具", "衛生用品"],
  sports: ["ジム", "ヨガ/ピラティス", "ランニング", "スポーツ小物", "ボトル"],
  motherBaby: ["ミルク/おむつ", "ベビーフード", "新生児用品", "ベビーカー/抱っこ紐", "知育玩具"],
  healthCare: ["ビタミン", "健康計測機器", "関節ケア", "睡眠サポート", "パーソナルケア"],
  booksStationery: ["実用書", "児童書", "文房具", "学習用品", "手帳/カレンダー"],
  toysGames: ["知育玩具", "ボードゲーム", "組み立て", "運動玩具", "フィギュア"],
  autoMoto: ["バイク用品", "カー用品", "ヘルメット", "洗車用品", "車載電子"],
  phoneTablet: ["スマホ", "タブレット", "ケース/保護フィルム", "充電器/ケーブル", "イヤホン"],
  computerOffice: ["ノートPC", "モニター", "キーボード/マウス", "ネットワーク", "オフィス小物"],
  cameraDrone: ["アクションカメラ", "防犯カメラ", "カメラ", "ドローン", "撮影アクセ"],
  homeAppliances: ["ミキサー/ジューサー", "エアフライヤー/調理家電", "掃除機", "空気清浄機", "ファン/ヒーター"],
  toolsHardware: ["手工具", "電動ドリル", "計測工具", "保護具", "補修材"],
  digitalGoods: ["デジタルクーポン", "ギフトカード", "ソフトウェアライセンス", "オンライン講座", "デジタルサービスパック"],
  other: ["一般", "季節", "ギフト", "ライフスタイル", "その他"]
};

const subcategoryMapKo = {
  fashion: ["여성 오피스룩", "남성 베이식", "빅사이즈", "스트릿", "잠옷/홈웨어"],
  skincare: ["여드름 민감", "브라이트닝", "장벽 회복", "선케어", "클렌징"],
  beautyTools: ["헤어 스타일링 기기", "스킨케어 디바이스", "메이크업 도구", "네일 도구", "개인 위생 도구"],
  home: ["주방용품", "홈클리닝", "룸데코", "수납", "침실 케어"],
  furnitureDecor: ["소파/의자", "책상/선반", "장식 조명", "커튼/러그", "테이블 데코"],
  electronics: ["폰 액세서리", "오디오/게이밍", "스마트홈", "충전/배터리", "오피스 기기"],
  food: ["스낵", "간편 음료", "헬시푸드", "선물 식품", "간편 요리"],
  householdEssentials: ["휴지/페이퍼", "세탁세제/유연제", "주방 클리닝", "욕실 케어", "생활 소모품"],
  footwear: ["스니커즈", "샌들", "러닝화", "오피스 슈즈", "슬리퍼"],
  bags: ["오피스백", "미니백", "백팩", "지갑", "여행가방"],
  accessories: ["주얼리", "모자/안경", "벨트/스카프", "시계", "헤어 액세서리"],
  fragrance: ["여성 향수", "남성 향수", "룸 향", "바디미스트", "에센셜 오일"],
  pet: ["고양이 사료/간식", "강아지 케어", "펫 액세서리", "펫 장난감", "위생용품"],
  sports: ["헬스", "요가/필라테스", "러닝", "스포츠 소품", "물병"],
  motherBaby: ["분유/기저귀", "이유식", "신생아 용품", "유모차/아기띠", "교육 완구"],
  healthCare: ["비타민", "건강 측정기", "관절 케어", "수면 보조", "퍼스널 케어"],
  booksStationery: ["자기계발서", "아동 도서", "문구", "학습 도구", "플래너/달력"],
  toysGames: ["교육 완구", "보드게임", "조립", "액티브 완구", "피규어"],
  autoMoto: ["오토바이 용품", "자동차 용품", "헬멧", "세차용품", "차량 전자"],
  phoneTablet: ["스마트폰", "태블릿", "케이스/필름", "충전기/케이블", "이어폰"],
  computerOffice: ["노트북", "모니터", "키보드/마우스", "네트워크", "오피스 액세서리"],
  cameraDrone: ["액션캠", "보안카메라", "카메라", "드론", "촬영 액세서리"],
  homeAppliances: ["믹서/주서", "에어프라이어/전기조리", "청소기", "공기청정기", "선풍기/히터"],
  toolsHardware: ["수공구", "전동드릴", "측정기", "보호장비", "수리자재"],
  digitalGoods: ["디지털 바우처", "기프트 카드", "소프트웨어 라이선스", "온라인 강의", "디지털 서비스 패키지"],
  other: ["일반", "시즌", "선물", "라이프스타일", "기타"]
};

const subcategoryExtraMapEn = {
  fashion: ["Athleisure / sporty chic", "Y2K / edgy", "Party dresses", "Kids fashion", "Couple outfits"],
  skincare: ["Anti-aging", "Deep hydration", "Body care", "Masks / treatment", "Hair care"],
  beautyTools: ["Hair curler / straightener", "Facial cleansing device", "Hair removal device", "Makeup brush sets", "Mini dryer"],
  home: ["Laundry", "Bathroom", "Lighting", "Dining essentials", "Smart home living"],
  furnitureDecor: ["Multifunction furniture", "Modular shelves", "LED decor lights", "Minimal decor", "Rental room styling"],
  electronics: ["Livestream gear", "Online learning devices", "Smart watches", "Laptop accessories", "Car electronics"],
  food: ["Frozen food", "Pantry essentials", "Regional specialties", "Healthy drinks", "Mother-baby nutrition"],
  householdEssentials: ["Floor cleaner", "Laundry pods", "Premium toilet tissue", "Biodegradable trash bags", "Mild dishwashing liquid"],
  footwear: ["Heels", "Flats", "Boots", "Kids shoes", "Outdoor shoes"],
  bags: ["Tote bags", "Laptop bags", "Gym bags", "Suitcases", "Mother-baby bags"],
  accessories: ["Earrings / rings", "Hair accessories", "Leather belts", "Unisex accessories", "Holiday accessories"],
  fragrance: ["Niche fragrance", "Candles / wax", "Fabric spray", "Mini perfume", "Body deodorizing"],
  pet: ["Pet litter", "Pet beds", "Walking gear", "Oral care", "Pet supplements"],
  sports: ["Cycling", "Swimming", "Badminton / tennis", "Home training", "Recovery tools"],
  motherBaby: ["Maternity", "Postpartum care", "Baby bath & care", "Baby room", "School items for kids"],
  healthCare: ["Home medical devices", "Oral care", "Digestive support", "Immunity support", "Rehab tools"],
  booksStationery: ["Language books", "Business books", "Notebooks", "Drawing tools", "Desk setup"],
  toysGames: ["Infant toys", "STEM toys", "RC toys", "Puzzles", "Role-play toys"],
  autoMoto: ["Dash cams", "Car interior", "Maintenance", "Emergency gear", "Bicycle accessories"],
  phoneTablet: ["Gaming phones", "Study tablets", "MagSafe accessories", "Power banks", "Phone stands"],
  computerOffice: ["PC components", "Printers / scanners", "Storage", "Webcams / mics", "Ergonomic desks/chairs"],
  cameraDrone: ["Lenses", "Gimbals", "Lighting", "Memory / storage", "Studio accessories"],
  homeAppliances: ["Coffee machines", "Mini washer/dryer", "Water filtration", "Garment care", "Smart kitchen gear"],
  toolsHardware: ["Garden tools", "Paint / finishing", "Electrical/plumbing", "Locks / security", "Ladders / lifting"],
  digitalGoods: ["Game codes", "Streaming passes", "Digital templates", "Photo presets", "Cloud storage plans"],
  other: ["Handmade", "Digital goods", "Corporate gifts", "Collectibles", "Service bundles"]
};

const subcategoryExtraMapZh = {
  fashion: ["运动休闲", "Y2K", "派对礼服", "童装", "情侣装"],
  skincare: ["抗老", "深层补水", "身体护理", "面膜/护理", "护发"],
  beautyTools: ["卷发/直发器", "洁面仪", "脱毛仪", "化妆刷套装", "迷你吹风机"],
  home: ["洗护", "卫浴", "照明", "餐桌用品", "智能家居"],
  furnitureDecor: ["多功能家具", "模块化置物架", "LED装饰灯", "极简装饰", "租房软装"],
  electronics: ["直播设备", "在线学习设备", "智能手表", "笔记本配件", "车载电子"],
  food: ["冷冻食品", "干货", "地方特产", "健康饮品", "母婴营养"],
  householdEssentials: ["地板清洁剂", "洗衣凝珠", "高端卷纸", "可降解垃圾袋", "温和洗洁精"],
  footwear: ["高跟鞋", "平底鞋", "靴子", "童鞋", "户外鞋"],
  bags: ["托特包", "电脑包", "运动包", "行李箱", "母婴包"],
  accessories: ["耳环/戒指", "发饰", "皮带", "中性配饰", "节日配饰"],
  fragrance: ["沙龙香", "香薰蜡烛", "织物喷雾", "小样香水", "身体除味"],
  pet: ["猫砂", "宠物床", "遛宠用品", "口腔护理", "宠物营养"],
  sports: ["骑行", "游泳", "羽毛球/网球", "居家训练", "恢复工具"],
  motherBaby: ["孕产", "产后护理", "婴儿洗护", "婴儿房", "儿童上学用品"],
  healthCare: ["家用医疗设备", "口腔护理", "肠胃支持", "免疫支持", "康复工具"],
  booksStationery: ["语言学习书", "商业书籍", "笔记本", "绘画工具", "桌面布置"],
  toysGames: ["婴幼儿玩具", "STEM玩具", "遥控玩具", "拼图", "角色扮演"],
  autoMoto: ["行车记录仪", "车内用品", "保养", "应急工具", "自行车配件"],
  phoneTablet: ["游戏手机", "学习平板", "MagSafe配件", "移动电源", "手机支架"],
  computerOffice: ["电脑配件", "打印/扫描", "存储", "摄像头/麦克风", "人体工学桌椅"],
  cameraDrone: ["镜头", "云台", "灯光", "存储卡", "影棚配件"],
  homeAppliances: ["咖啡机", "迷你洗烘", "净水设备", "衣物护理", "智能厨房"],
  toolsHardware: ["园艺工具", "涂装", "水电工具", "锁具/安防", "梯子/升降"],
  digitalGoods: ["游戏兑换码", "观影会员码", "数字模板", "修图预设", "云存储套餐"],
  other: ["手作", "数字商品", "企业礼品", "收藏品", "服务套装"]
};

const subcategoryExtraMapJa = {
  fashion: ["アスレジャー", "Y2K", "パーティードレス", "キッズ", "ペアルック"],
  skincare: ["エイジングケア", "高保湿", "ボディケア", "マスク/集中ケア", "ヘアケア"],
  beautyTools: ["ヘアアイロン", "洗顔デバイス", "脱毛デバイス", "メイクブラシセット", "ミニドライヤー"],
  home: ["ランドリー", "バス用品", "照明", "ダイニング", "スマートホーム"],
  furnitureDecor: ["多機能家具", "モジュール棚", "LED装飾ライト", "ミニマル装飾", "賃貸向けデコ"],
  electronics: ["配信機材", "オンライン学習機器", "スマートウォッチ", "ノートPCアクセ", "車載電子"],
  food: ["冷凍食品", "乾物", "地方特産", "ヘルシードリンク", "ママベビー栄養"],
  householdEssentials: ["床用クリーナー", "洗濯ジェルボール", "高品質トイレットペーパー", "生分解ごみ袋", "低刺激食器用洗剤"],
  footwear: ["ヒール", "フラット", "ブーツ", "キッズシューズ", "アウトドア"],
  bags: ["トート", "PCバッグ", "ジムバッグ", "スーツケース", "マザーズバッグ"],
  accessories: ["ピアス/リング", "ヘアアクセ", "レザーベルト", "ユニセックス", "季節アクセ"],
  fragrance: ["ニッチ香水", "キャンドル", "ファブリックスプレー", "ミニ香水", "デオドラント"],
  pet: ["猫砂", "ペットベッド", "散歩用品", "口腔ケア", "サプリ"],
  sports: ["サイクリング", "スイミング", "バドミントン/テニス", "ホームトレ", "リカバリー"],
  motherBaby: ["マタニティ", "産後ケア", "ベビー洗浄", "ベビールーム", "通園通学用品"],
  healthCare: ["家庭用医療機器", "口腔ケア", "消化サポート", "免疫サポート", "リハビリ用品"],
  booksStationery: ["語学書", "ビジネス書", "ノート", "画材", "デスクセットアップ"],
  toysGames: ["乳幼児玩具", "STEM玩具", "ラジコン", "パズル", "ごっこ遊び"],
  autoMoto: ["ドラレコ", "車内用品", "メンテ用品", "緊急用品", "自転車アクセ"],
  phoneTablet: ["ゲーミングスマホ", "学習タブレット", "MagSafeアクセ", "モバイルバッテリー", "スマホスタンド"],
  computerOffice: ["PCパーツ", "プリンタ/スキャナ", "ストレージ", "Webカメラ/マイク", "人間工学家具"],
  cameraDrone: ["レンズ", "ジンバル", "照明", "メモリー", "スタジオ用品"],
  homeAppliances: ["コーヒーメーカー", "小型洗濯乾燥", "浄水", "衣類ケア", "スマートキッチン"],
  toolsHardware: ["園芸工具", "塗装", "電気/配管", "ロック/防犯", "はしご/昇降"],
  digitalGoods: ["ゲームコード", "配信パス", "デジタルテンプレート", "写真プリセット", "クラウド保存プラン"],
  other: ["ハンドメイド", "デジタル商品", "法人ギフト", "コレクション", "サービス付き商品"]
};

const subcategoryExtraMapKo = {
  fashion: ["애슬레저", "Y2K", "파티 드레스", "키즈 패션", "커플룩"],
  skincare: ["안티에이징", "고보습", "바디케어", "마스크/트리트먼트", "헤어케어"],
  beautyTools: ["헤어 고데기", "세안 디바이스", "제모 디바이스", "메이크업 브러시 세트", "미니 드라이어"],
  home: ["세탁", "욕실", "조명", "다이닝", "스마트홈"],
  furnitureDecor: ["멀티 기능 가구", "모듈 선반", "LED 장식 조명", "미니멀 데코", "원룸 인테리어"],
  electronics: ["라이브 방송 장비", "온라인 학습 기기", "스마트워치", "노트북 액세서리", "차량 전자"],
  food: ["냉동식품", "건식품", "지역 특산", "헬시 음료", "모자 영양"],
  householdEssentials: ["바닥 클리너", "세탁 캡슐", "프리미엄 화장지", "생분해 쓰레기봉투", "저자극 주방세제"],
  footwear: ["하이힐", "플랫슈즈", "부츠", "키즈 신발", "아웃도어"],
  bags: ["토트백", "노트북백", "짐백", "캐리어", "기저귀 가방"],
  accessories: ["귀걸이/반지", "헤어 액세서리", "가죽 벨트", "유니섹스", "시즌 액세서리"],
  fragrance: ["니치 향수", "캔들", "패브릭 스프레이", "미니 향수", "데오도란트"],
  pet: ["고양이 모래", "펫 베드", "산책 용품", "구강 케어", "펫 영양제"],
  sports: ["사이클", "수영", "배드민턴/테니스", "홈트", "리커버리"],
  motherBaby: ["임산부", "산후 케어", "아기 목욕/케어", "아기방", "등원/등교 용품"],
  healthCare: ["가정용 의료기기", "구강 케어", "소화 지원", "면역 지원", "재활 도구"],
  booksStationery: ["어학 서적", "비즈니스 서적", "노트", "드로잉 도구", "데스크 셋업"],
  toysGames: ["영유아 완구", "STEM 완구", "RC 완구", "퍼즐", "역할놀이"],
  autoMoto: ["블랙박스", "차량 인테리어", "정비용품", "비상용품", "자전거 액세서리"],
  phoneTablet: ["게이밍 폰", "학습 태블릿", "MagSafe 액세서리", "보조배터리", "휴대폰 거치대"],
  computerOffice: ["PC 부품", "프린터/스캐너", "스토리지", "웹캠/마이크", "인체공학 가구"],
  cameraDrone: ["렌즈", "짐벌", "조명", "메모리/저장", "스튜디오 액세서리"],
  homeAppliances: ["커피머신", "미니 세탁/건조", "정수", "의류 케어", "스마트 키친"],
  toolsHardware: ["정원 공구", "도장", "전기/배관", "잠금/보안", "사다리/리프팅"],
  digitalGoods: ["게임 코드", "스트리밍 패스", "디지털 템플릿", "사진 프리셋", "클라우드 저장 플랜"],
  other: ["핸드메이드", "디지털 상품", "기업 선물", "수집품", "서비스 결합 상품"]
};

function mergeSubcategoryMap(baseMap, extraMap) {
  for (const [category, extras] of Object.entries(extraMap)) {
    const baseList = Array.isArray(baseMap[category]) ? baseMap[category] : [];
    const seen = new Set(baseList.map((item) => String(item || "").toLowerCase().trim()));
    const mergedExtras = (Array.isArray(extras) ? extras : []).filter((item) => {
      const key = String(item || "").toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    baseMap[category] = [...baseList, ...mergedExtras];
  }
}

mergeSubcategoryMap(subcategoryMapEn, subcategoryExtraMapEn);
mergeSubcategoryMap(subcategoryMapZh, subcategoryExtraMapZh);
mergeSubcategoryMap(subcategoryMapJa, subcategoryExtraMapJa);
mergeSubcategoryMap(subcategoryMapKo, subcategoryExtraMapKo);

const channelOptionsByLang = {
  vi: ["TikTok Shop", "Shopee", "TikTok Shop + Shopee"],
  en: ["TikTok Shop", "Shopee", "TikTok Shop + Shopee"],
  zh: ["TikTok 店铺", "Shopee", "TikTok 店铺 + Shopee"],
  ja: ["TikTok Shop", "Shopee", "TikTok Shop + Shopee"],
  ko: ["TikTok Shop", "Shopee", "TikTok Shop + Shopee"]
};

const toneOptionsByLang = {
  vi: ["Review tự nhiên", "Chuyên gia", "Chốt sale mạnh"],
  en: ["Natural review", "Expert", "Sales-focused"],
  zh: ["自然评测", "专家风", "强销售"],
  ja: ["ナチュラルレビュー", "専門家トーン", "セール重視"],
  ko: ["자연스러운 리뷰", "전문가 톤", "판매 집중"]
};

const brandStyleOptionsByLang = {
  vi: ["Cao cấp tối giản", "Trẻ trung hiện đại", "Chuyên gia đáng tin", "Bình dân chỉn chu"],
  en: ["Premium minimal", "Young modern", "Trusted expert", "Accessible polished"],
  zh: ["高级极简", "年轻现代", "专业可信", "亲民精致"],
  ja: ["上質ミニマル", "モダン", "信頼できる専門家", "親しみやすく丁寧"],
  ko: ["프리미엄 미니멀", "젊고 모던", "신뢰형 전문가", "대중적이고 깔끔함"]
};

const moodOptionsByLang = {
  vi: ["Tinh gọn sang trọng", "Ấm áp gần gũi", "Năng động cuốn hút", "Tự tin thuyết phục"],
  en: ["Refined luxury", "Warm and close", "Energetic and catchy", "Confident and persuasive"],
  zh: ["精致高级", "温暖亲和", "活力吸引", "自信说服"],
  ja: ["洗練ラグジュアリー", "あたたかく親しみ", "活発で魅力的", "自信ある訴求"],
  ko: ["세련되고 고급", "따뜻하고 친근", "에너지 있고 매력적", "자신감 있고 설득력"]
};

const categoryHintsEn = {
  fashion: { short: "Clean silhouette, easy styling, and flattering fit.", highlights: "Refined collar detail\nFlattering A-line shape\nSuitable for work or casual", attrs: "fabric details\nsize range\ncolor options", target: "Customers who prefer polished, feminine, and wearable daily style..." },
  skincare: { short: "Light texture, daily-friendly, and easy to blend into routines.", highlights: "Fast absorption\nNon-sticky finish\nAM/PM ready", attrs: "active ingredients\nskin type\ntexture", target: "Dry or sensitive skin users who want a simple but effective routine..." },
  beautyTools: { short: "Beauty tools should feel practical, safe, and easy to sustain in daily routines.", highlights: "Easy handling\nSimple cleaning\nDaily consistency", attrs: "water resistance\ncontact surface\ncharging method", target: "Users who want faster, easier personal-care routines with consistent results..." },
  home: { short: "Practical design, compact footprint, and easy for daily use.", highlights: "Quick setup\nSpace-efficient\nEasy to clean", attrs: "core function\ndimensions\nmaterial", target: "Apartment users, young families, and anyone who prefers tidy spaces..." },
  furnitureDecor: { short: "Furniture and decor should improve both visual harmony and practical room usage.", highlights: "Aesthetic boost\nFlexible placement\nSmall-space fit", attrs: "dimensions\nmaterial\nstyle tone", target: "Users upgrading home setup for both utility and style in limited space..." },
  electronics: { short: "Compact, practical, and clearly useful in everyday workflow.", highlights: "Stable connection\nReliable battery\nSimple controls", attrs: "main feature\nconnectivity\nbattery", target: "Office workers and users who like clean desk setups..." },
  food: { short: "Balanced taste, convenient pack, and clear ingredient profile.", highlights: "Easy to enjoy\nPortable\nBalanced sweetness", attrs: "ingredients\nflavor\npack size", target: "Busy users who want convenient and healthier snack options..." },
  householdEssentials: { short: "Household essentials should prioritize repeat-use convenience and stable cleaning outcomes.", highlights: "Easy dosing\nFast routine use\nConsistent results", attrs: "pack size\ncore formula\nusage note", target: "Families and busy households needing simple, reliable daily consumption products..." },
  footwear: { short: "Clean shape, easy to wear, and elevates everyday outfit.", highlights: "Comfortable sole\nEasy fit\nVersatile styling", attrs: "material\nsize\ncolor", target: "Users who prioritize comfort and daily versatility..." },
  bags: { short: "Compact, polished, and easy to pair with many outfits.", highlights: "Structured shape\nUseful compartments\nLight carry", attrs: "material\ndimensions\ncolor", target: "Users who prefer compact and refined accessories..." },
  accessories: { short: "Small detail with visible impact on overall styling.", highlights: "Finishes outfit\nEasy color match\nRefined detail", attrs: "material\nsize\ncolor", target: "Users who complete looks with subtle but effective details..." },
  fragrance: { short: "Clean scent profile suitable for daily and flexible occasions.", highlights: "Pleasant opening\nBalanced projection\nEveryday friendly", attrs: "scent family\nvolume\nlongevity", target: "Users seeking modern, clean, and wearable scents..." },
  pet: { short: "Practical and safe product for everyday pet care.", highlights: "Safe to use\nEasy maintenance\nRoutine-friendly", attrs: "pet type\nmaterial / ingredients\ncare note", target: "Pet owners prioritizing safety, ease, and reliability..." },
  sports: { short: "Durable and functional for active daily routines.", highlights: "Reliable grip\nGood durability\nEasy to carry", attrs: "material\nsize\nuse case", target: "Users with regular fitness habits needing practical gear..." },
  motherBaby: { short: "Safety-first products with clear daily usability for parents.", highlights: "Safer materials\nEasy cleaning\nParent-friendly details", attrs: "safety standard\nsize\nusage note", target: "Parents looking for trustworthy baby products for daily care..." },
  healthCare: { short: "Clear practical benefit with easy interpretation for home health routines.", highlights: "Quick readout\nEasy operation\nStable tracking", attrs: "core metric\npower source\ncare note", target: "Adults tracking health indicators at home with confidence..." },
  booksStationery: { short: "Useful everyday tools that improve planning, learning, and consistency.", highlights: "Clear layout\nComfortable writing\nDaily usable", attrs: "paper/spec\npage count\nextras", target: "Students and office users who want practical productivity tools..." },
  toysGames: { short: "Fun and safe play value with clear social or educational benefit.", highlights: "Easy to start\nReplay value\nInteractive", attrs: "age range\nplayer count\nmaterials", target: "Families and groups who want engaging and meaningful play time..." },
  autoMoto: { short: "Reliable accessories focused on safety, stability, and real road usage.", highlights: "Secure fit\nRoad-stable\nQuick install", attrs: "fit standard\nmaterial\ncompatibility", target: "Daily riders and drivers needing durable practical add-ons..." },
  phoneTablet: { short: "Balanced mobile experience with practical focus on screen, battery, and smoothness.", highlights: "Clear display\nLong battery\nSmooth daily use", attrs: "screen\nRAM/ROM\nconnectivity", target: "Users needing dependable devices for study, work, and entertainment..." },
  computerOffice: { short: "Workspace-ready gear that improves comfort and consistency in daily tasks.", highlights: "Stable connection\nEasy setup\nProductivity boost", attrs: "connection\nsize\nos compatibility", target: "Office and remote workers building efficient desk setups..." },
  cameraDrone: { short: "Capture-focused gear prioritizing image quality, stability, and practical workflow.", highlights: "Clear footage\nStable capture\nEasy file handling", attrs: "resolution\nlens/angle\nstorage", target: "Creators and users who need reliable recording in real situations..." },
  homeAppliances: { short: "Time-saving appliances with practical daily utility and easy maintenance.", highlights: "Fast routine\nEasy to clean\nFamily-friendly", attrs: "power\ncapacity\nmodes", target: "Busy households looking for practical home automation support..." },
  toolsHardware: { short: "Durable tool-focused products built for practical repair and installation work.", highlights: "Strong output\nControlled operation\nLong-lasting", attrs: "power/battery\nspeed settings\nincluded tools", target: "DIY users and technicians needing reliable tools for real tasks..." },
  digitalGoods: { short: "Digital goods should clearly communicate instant utility, access scope, and workflow impact.", highlights: "Instant delivery\nEasy adoption\nProductivity gain", attrs: "file format\naccess rights\nupdate policy", target: "Creators and online sellers looking to accelerate content and operations with ready-made digital assets..." },
  other: { short: "Clear value proposition with practical everyday benefits.", highlights: "Clear strengths\nEasy to use\nUseful value", attrs: "main details\nbasic dimensions\nkey advantages", target: "Users looking for practical, easy-to-understand products..." }
};

const subcategoryByLang = {
  vi: subcategoryMapVi,
  en: subcategoryMapEn,
  zh: subcategoryMapZh,
  ja: subcategoryMapJa,
  ko: subcategoryMapKo
};

const categoryOrder = [
  "fashion",
  "skincare",
  "beautyTools",
  "home",
  "furnitureDecor",
  "electronics",
  "food",
  "householdEssentials",
  "footwear",
  "bags",
  "accessories",
  "fragrance",
  "pet",
  "sports",
  "motherBaby",
  "healthCare",
  "booksStationery",
  "toysGames",
  "autoMoto",
  "phoneTablet",
  "computerOffice",
  "cameraDrone",
  "homeAppliances",
  "toolsHardware",
  "digitalGoods",
  "other"
];

export function getLocalizedProductConfig(language) {
  const lang = normalizeLanguage(language);
  const categoryLabels = categoryLabelsByLang[lang] || categoryLabelsByLang.en;
  const subcategoryMap = subcategoryByLang[lang] || subcategoryByLang.en;

  return {
    categoryOptions: categoryOrder.map((value) => ({ value, label: categoryLabels[value] || value })),
    channelOptions: channelOptionsByLang[lang] || channelOptionsByLang.en,
    subcategoryMap,
    toneOptions: toneOptionsByLang[lang] || toneOptionsByLang.en,
    brandStyleOptions: brandStyleOptionsByLang[lang] || brandStyleOptionsByLang.en,
    moodOptions: moodOptionsByLang[lang] || moodOptionsByLang.en,
    categoryHints: lang === "vi" ? categoryHintsVi : categoryHintsEn
  };
}
