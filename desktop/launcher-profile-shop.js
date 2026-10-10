(() => {
  'use strict';
  const api = window.onePieceDesktop;
  const $ = id => document.getElementById(id);
  const GAME_META = [
    { id: 'card', title: '偉大航道爭霸戰', english: 'GRAND LINE RIVALRY', cover: 'launcher_card_cover_perspective_v2.webp' },
    { id: 'board', title: '新世界航海錄', english: 'NEW WORLD VOYAGE', cover: 'launcher_board_cover_logo_perspective_v5.webp' },
    { id: 'chess', title: '霸海戰棋', english: 'PIRATE WAR CHESS', cover: 'launcher_chess_cover_logo_perspective_v5.webp' }
  ];
  const COLLECTION_TABS = [
    ['avatars', '頭像'], ['walls', '牆面'], ['flags', '旗幟'], ['launcher', '展示室'], ['titles', '榮譽'], ['board', '航海圖鑑'], ['chess', '戰棋']
  ];
  const SHOP_TABS = [['avatar', '頭像'], ['room_scene', '房間場景'], ['room_furniture', '房間家具'], ['room_character', 'Q版夥伴'], ['background', '背景'], ['frame', '相框'], ['wall', '牆面'], ['flag', '旗幟'], ['layout', '排版'], ['decoration', '貼紙'], ['bgm', '音樂'], ['guestbook_style', '留言板'], ['comment_style', '留言紙'], ['guestbook', '留言板解鎖']];
  const TYPE_LABEL = { avatar: '頭像', room_scene: '房間場景', room_furniture: '房間家具', room_character: 'Q版夥伴', background: '背景', frame: '相框', wall: '牆面', flag: '旗幟', layout: '排版', decoration: '貼紙', bgm: '音樂', guestbook: '留言板解鎖', guestbook_style: '留言板', comment_style: '留言紙' };
  const ROOM_TYPES = ['room_scene', 'room_furniture', 'room_character'];
  const SLOTS = [['header', '上方'], ['side', '側邊'], ['footer', '下方']];
  const RARITY = { common: '普通', rare: '稀有', epic: '史詩', legend: '傳說' };
  const MAX_AVATAR_ID = 222;
  // BEGIN GENERATED LOCAL SHOP CATALOG
  const LOCAL_SHOP_CATALOG = [{"id":"ava-31","type":"avatar","key":31,"name":"路奇","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/31.webp"},{"id":"ava-32","type":"avatar","key":32,"name":"大和","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/32.webp"},{"id":"ava-33","type":"avatar","key":33,"name":"弗朗基","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/33.webp"},{"id":"ava-34","type":"avatar","key":34,"name":"艾斯","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/34.webp"},{"id":"ava-35","type":"avatar","key":35,"name":"巴索羅-大熊","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/35.webp"},{"id":"ava-36","type":"avatar","key":36,"name":"鑽石裘斯","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/36.webp"},{"id":"ava-37","type":"avatar","key":37,"name":"暴走喬巴","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/37.webp"},{"id":"ava-38","type":"avatar","key":38,"name":"草帽的傳承","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/38.webp"},{"id":"ava-39","type":"avatar","key":39,"name":"魯夫紅藍光影","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/39.webp"},{"id":"ava-40","type":"avatar","key":40,"name":"海軍的未來 克比","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/40.webp"},{"id":"ava-41","type":"avatar","key":41,"name":"多拉格","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/41.webp"},{"id":"ava-42","type":"avatar","key":42,"name":"火拳艾斯","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/42.webp"},{"id":"ava-43","type":"avatar","key":43,"name":"ACE","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/43.webp"},{"id":"ava-44","type":"avatar","key":44,"name":"不死鳥馬可","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/44.webp"},{"id":"ava-45","type":"avatar","key":45,"name":"未來海賊王的左右手","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/45.webp"},{"id":"ava-46","type":"avatar","key":46,"name":"艾斯剪影","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/46.webp"},{"id":"ava-47","type":"avatar","key":47,"name":"魯夫","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/47.webp"},{"id":"ava-48","type":"avatar","key":48,"name":"海軍元帥 赤犬","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/48.webp"},{"id":"ava-49","type":"avatar","key":49,"name":"尼卡大笑","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/49.webp"},{"id":"ava-50","type":"avatar","key":50,"name":"尼卡防風鏡","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/50.webp"},{"id":"ava-51","type":"avatar","key":51,"name":"香吉士","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/51.webp"},{"id":"ava-52","type":"avatar","key":52,"name":"騙人布","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/52.webp"},{"id":"ava-53","type":"avatar","key":53,"name":"甚平","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/53.webp"},{"id":"ava-54","type":"avatar","key":54,"name":"布魯克","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/54.webp"},{"id":"ava-55","type":"avatar","key":55,"name":"妮可·羅賓","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/55.webp"},{"id":"ava-56","type":"avatar","key":56,"name":"托拉法爾加·羅","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/56.webp"},{"id":"ava-57","type":"avatar","key":57,"name":"波雅·漢考克","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/57.webp"},{"id":"ava-58","type":"avatar","key":58,"name":"薩波","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/58.webp"},{"id":"ava-59","type":"avatar","key":59,"name":"紅髮傑克","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/59.webp"},{"id":"ava-60","type":"avatar","key":60,"name":"喬拉可爾·密佛格","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/60.webp"},{"id":"ava-61","type":"avatar","key":61,"name":"白鬍子","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/61.webp"},{"id":"ava-62","type":"avatar","key":62,"name":"巴其","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/62.webp"},{"id":"ava-63","type":"avatar","key":63,"name":"薇薇","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/63.webp"},{"id":"ava-64","type":"avatar","key":64,"name":"培羅娜","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/64.webp"},{"id":"ava-65","type":"avatar","key":65,"name":"可亞拉","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/65.webp"},{"id":"ava-66","type":"avatar","key":66,"name":"波妮","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/66.webp"},{"id":"ava-67","type":"avatar","key":67,"name":"蕾貝卡・競技場","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/67.webp"},{"id":"ava-68","type":"avatar","key":68,"name":"白星","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/68.webp"},{"id":"ava-69","type":"avatar","key":69,"name":"凱洛特","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/69.webp"},{"id":"ava-70","type":"avatar","key":70,"name":"麗珠","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/70.webp"},{"id":"ava-71","type":"avatar","key":71,"name":"布琳","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/71.webp"},{"id":"ava-72","type":"avatar","key":72,"name":"達絲琪","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/72.webp"},{"id":"ava-73","type":"avatar","key":73,"name":"斯摩格","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/73.webp"},{"id":"ava-74","type":"avatar","key":74,"name":"克洛克達爾","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/74.webp"},{"id":"ava-75","type":"avatar","key":75,"name":"多佛朗明哥","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/75.webp"},{"id":"ava-76","type":"avatar","key":76,"name":"卡塔克利","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/76.webp"},{"id":"ava-77","type":"avatar","key":77,"name":"艾涅爾","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/77.webp"},{"id":"ava-78","type":"avatar","key":78,"name":"路奇 CP0","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/78.webp"},{"id":"ava-79","type":"avatar","key":79,"name":"巴托洛米奧","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/79.webp"},{"id":"ava-80","type":"avatar","key":80,"name":"卡文迪許","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/80.webp"},{"id":"ava-81","type":"avatar","key":81,"name":"基德","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/81.webp"},{"id":"ava-82","type":"avatar","key":82,"name":"基拉","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/82.webp"},{"id":"ava-83","type":"avatar","key":83,"name":"柯拉松","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/83.webp"},{"id":"ava-84","type":"avatar","key":84,"name":"雷利","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/84.webp"},{"id":"ava-85","type":"avatar","key":85,"name":"克比","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/85.webp"},{"id":"ava-86","type":"avatar","key":86,"name":"貝魯梅伯","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/86.webp"},{"id":"ava-87","type":"avatar","key":87,"name":"希娜","rarity":"common","price":5,"asset":"opui://launcher/images/board/avatars/87.webp"},{"id":"ava-88","type":"avatar","key":88,"name":"戰桃丸","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/88.webp"},{"id":"ava-89","type":"avatar","key":89,"name":"魯夫・和之國","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/89.webp"},{"id":"ava-90","type":"avatar","key":90,"name":"索隆・和之國","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/90.webp"},{"id":"ava-91","type":"avatar","key":91,"name":"娜美・和之國","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/91.webp"},{"id":"ava-92","type":"avatar","key":92,"name":"羅賓・和之國","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/92.webp"},{"id":"ava-93","type":"avatar","key":93,"name":"魯夫・墨影","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/93.webp"},{"id":"ava-94","type":"avatar","key":94,"name":"索隆・墨影","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/94.webp"},{"id":"ava-95","type":"avatar","key":95,"name":"羅・墨影","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/95.webp"},{"id":"ava-96","type":"avatar","key":96,"name":"基德・墨影","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/96.webp"},{"id":"ava-97","type":"avatar","key":97,"name":"卡塔克利・墨影","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/97.webp"},{"id":"ava-98","type":"avatar","key":98,"name":"艾斯・航海印記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/98.webp"},{"id":"ava-99","type":"avatar","key":99,"name":"紅髮傑克・航海印記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/99.webp"},{"id":"ava-100","type":"avatar","key":100,"name":"薩波・航海印記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/100.webp"},{"id":"ava-101","type":"avatar","key":101,"name":"克洛克達爾・航海印記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/101.webp"},{"id":"ava-102","type":"avatar","key":102,"name":"柯拉松・航海印記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/102.webp"},{"id":"ava-103","type":"avatar","key":103,"name":"索隆・和之國・浮世浪","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/103.webp"},{"id":"ava-104","type":"avatar","key":104,"name":"魯夫・和之國・浮世浪","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/104.webp"},{"id":"ava-105","type":"avatar","key":105,"name":"娜美・和之國・浮世浪","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/105.webp"},{"id":"ava-106","type":"avatar","key":106,"name":"羅賓・和之國・浮世浪","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/106.webp"},{"id":"ava-107","type":"avatar","key":107,"name":"甚平・浮世浪","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/107.webp"},{"id":"ava-108","type":"avatar","key":108,"name":"薇薇・水彩航信","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/108.webp"},{"id":"ava-109","type":"avatar","key":109,"name":"白星・水彩航信","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/109.webp"},{"id":"ava-110","type":"avatar","key":110,"name":"培羅娜・水彩航信","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/110.webp"},{"id":"ava-111","type":"avatar","key":111,"name":"凱洛特・水彩航信","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/111.webp"},{"id":"ava-112","type":"avatar","key":112,"name":"喬巴・水彩航信","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/112.webp"},{"id":"ava-113","type":"avatar","key":113,"name":"漢考克・彩窗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/113.webp"},{"id":"ava-114","type":"avatar","key":114,"name":"羅賓・彩窗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/114.webp"},{"id":"ava-115","type":"avatar","key":115,"name":"布魯克・彩窗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/115.webp"},{"id":"ava-116","type":"avatar","key":116,"name":"佛朗基・彩窗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/116.webp"},{"id":"ava-117","type":"avatar","key":117,"name":"騙人布・彩窗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/117.webp"},{"id":"ava-118","type":"avatar","key":118,"name":"香吉士・霓光","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/118.webp"},{"id":"ava-119","type":"avatar","key":119,"name":"娜美・霓光","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/119.webp"},{"id":"ava-120","type":"avatar","key":120,"name":"艾斯・霓光","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/120.webp"},{"id":"ava-121","type":"avatar","key":121,"name":"薩波・霓光","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/121.webp"},{"id":"ava-122","type":"avatar","key":122,"name":"魯夫・尼卡・霓光","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/122.webp"},{"id":"ava-123","type":"avatar","key":123,"name":"魯夫・懷舊動畫","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/123.webp"},{"id":"ava-124","type":"avatar","key":124,"name":"索隆・懷舊動畫","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/124.webp"},{"id":"ava-125","type":"avatar","key":125,"name":"娜美・懷舊動畫","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/125.webp"},{"id":"ava-126","type":"avatar","key":126,"name":"香吉士・懷舊動畫","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/126.webp"},{"id":"ava-127","type":"avatar","key":127,"name":"騙人布・懷舊動畫","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/127.webp"},{"id":"ava-128","type":"avatar","key":128,"name":"紅髮傑克・油彩典藏","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/128.webp"},{"id":"ava-129","type":"avatar","key":129,"name":"鷹眼・油彩典藏","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/129.webp"},{"id":"ava-130","type":"avatar","key":130,"name":"漢考克・油彩典藏","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/130.webp"},{"id":"ava-131","type":"avatar","key":131,"name":"克洛克達爾・油彩典藏","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/131.webp"},{"id":"ava-132","type":"avatar","key":132,"name":"雷利・油彩典藏","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/132.webp"},{"id":"ava-133","type":"avatar","key":133,"name":"艾斯・冒險厚塗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/133.webp"},{"id":"ava-134","type":"avatar","key":134,"name":"薩波・冒險厚塗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/134.webp"},{"id":"ava-135","type":"avatar","key":135,"name":"羅・冒險厚塗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/135.webp"},{"id":"ava-136","type":"avatar","key":136,"name":"基德・冒險厚塗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/136.webp"},{"id":"ava-137","type":"avatar","key":137,"name":"卡塔克利・冒險厚塗","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/137.webp"},{"id":"ava-138","type":"avatar","key":138,"name":"喬巴・彩鉛航記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/138.webp"},{"id":"ava-139","type":"avatar","key":139,"name":"薇薇・彩鉛航記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/139.webp"},{"id":"ava-140","type":"avatar","key":140,"name":"羅賓・彩鉛航記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/140.webp"},{"id":"ava-141","type":"avatar","key":141,"name":"佛朗基・彩鉛航記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/141.webp"},{"id":"ava-142","type":"avatar","key":142,"name":"布魯克・彩鉛航記","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/142.webp"},{"id":"ava-143","type":"avatar","key":143,"name":"培羅娜・柔彩海風","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/143.webp"},{"id":"ava-144","type":"avatar","key":144,"name":"凱洛特・柔彩海風","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/144.webp"},{"id":"ava-145","type":"avatar","key":145,"name":"白星・柔彩海風","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/145.webp"},{"id":"ava-146","type":"avatar","key":146,"name":"可亞拉・柔彩海風","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/146.webp"},{"id":"ava-147","type":"avatar","key":147,"name":"大和・柔彩海風","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/147.webp"},{"id":"ava-148","type":"avatar","key":148,"name":"吉貝爾・鋼筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/148.webp"},{"id":"ava-149","type":"avatar","key":149,"name":"馬可・鋼筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/149.webp"},{"id":"ava-150","type":"avatar","key":150,"name":"斯摩格・鋼筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/150.webp"},{"id":"ava-151","type":"avatar","key":151,"name":"達絲琪・鋼筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/151.webp"},{"id":"ava-152","type":"avatar","key":152,"name":"克比・鋼筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/152.webp"},{"id":"ava-153","type":"avatar","key":153,"name":"白鬍子・黑金刻印","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/153.webp"},{"id":"ava-154","type":"avatar","key":154,"name":"羅傑・黑金刻印","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/154.webp"},{"id":"ava-155","type":"avatar","key":155,"name":"凱多・黑金刻印","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/155.webp"},{"id":"ava-156","type":"avatar","key":156,"name":"燼・黑金刻印","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/156.webp"},{"id":"ava-157","type":"avatar","key":157,"name":"多佛朗明哥・黑金刻印","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/157.webp"},{"id":"ava-158","type":"avatar","key":158,"name":"魯夫・疊紙航旅","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/158.webp"},{"id":"ava-159","type":"avatar","key":159,"name":"娜美・疊紙航旅","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/159.webp"},{"id":"ava-160","type":"avatar","key":160,"name":"羅賓・疊紙航旅","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/160.webp"},{"id":"ava-161","type":"avatar","key":161,"name":"騙人布・疊紙航旅","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/161.webp"},{"id":"ava-162","type":"avatar","key":162,"name":"吉貝爾・疊紙航旅","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/162.webp"},{"id":"ava-163","type":"avatar","key":163,"name":"香吉士・手塑物語","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/163.webp"},{"id":"ava-164","type":"avatar","key":164,"name":"艾斯・手塑物語","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/164.webp"},{"id":"ava-165","type":"avatar","key":165,"name":"薩波・手塑物語","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/165.webp"},{"id":"ava-166","type":"avatar","key":166,"name":"紅髮傑克・手塑物語","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/166.webp"},{"id":"ava-167","type":"avatar","key":167,"name":"培羅娜・手塑物語","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/167.webp"},{"id":"ava-168","type":"avatar","key":168,"name":"索隆・像素冒險","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/168.webp"},{"id":"ava-169","type":"avatar","key":169,"name":"羅・像素冒險","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/169.webp"},{"id":"ava-170","type":"avatar","key":170,"name":"佛朗基・像素冒險","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/170.webp"},{"id":"ava-171","type":"avatar","key":171,"name":"布魯克・像素冒險","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/171.webp"},{"id":"ava-172","type":"avatar","key":172,"name":"漢考克・像素冒險","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/172.webp"},{"id":"ava-173","type":"avatar","key":173,"name":"薇薇・琺瑯寶彩","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/173.webp"},{"id":"ava-174","type":"avatar","key":174,"name":"白星・琺瑯寶彩","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/174.webp"},{"id":"ava-175","type":"avatar","key":175,"name":"凱洛特・琺瑯寶彩","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/175.webp"},{"id":"ava-176","type":"avatar","key":176,"name":"大和・琺瑯寶彩","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/176.webp"},{"id":"ava-177","type":"avatar","key":177,"name":"鷹眼・琺瑯寶彩","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/177.webp"},{"id":"ava-178","type":"avatar","key":178,"name":"羅傑・海圖銅刻","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/178.webp"},{"id":"ava-179","type":"avatar","key":179,"name":"雷利・海圖銅刻","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/179.webp"},{"id":"ava-180","type":"avatar","key":180,"name":"白鬍子・海圖銅刻","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/180.webp"},{"id":"ava-181","type":"avatar","key":181,"name":"卡普・海圖銅刻","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/181.webp"},{"id":"ava-182","type":"avatar","key":182,"name":"斯摩格・海圖銅刻","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/182.webp"},{"id":"ava-183","type":"avatar","key":183,"name":"魯夫・木刻傳承","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/183.webp"},{"id":"ava-184","type":"avatar","key":184,"name":"索隆・木刻傳承","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/184.webp"},{"id":"ava-185","type":"avatar","key":185,"name":"吉貝爾・木刻傳承","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/185.webp"},{"id":"ava-186","type":"avatar","key":186,"name":"紅髮傑克・木刻傳承","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/186.webp"},{"id":"ava-187","type":"avatar","key":187,"name":"御田・木刻傳承","rarity":"legend","price":25,"asset":"opui://launcher/images/board/avatars/187.webp"},{"id":"ava-188","type":"avatar","key":188,"name":"艾斯・彩頁躍動","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/188.webp"},{"id":"ava-189","type":"avatar","key":189,"name":"香吉士・彩頁躍動","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/189.webp"},{"id":"ava-190","type":"avatar","key":190,"name":"娜美・彩頁躍動","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/190.webp"},{"id":"ava-191","type":"avatar","key":191,"name":"羅賓・彩頁躍動","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/191.webp"},{"id":"ava-192","type":"avatar","key":192,"name":"卡塔克利・彩頁躍動","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/192.webp"},{"id":"ava-193","type":"avatar","key":193,"name":"魯夫・夜光彩墨","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/193.webp"},{"id":"ava-194","type":"avatar","key":194,"name":"艾斯・夜光彩墨","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/194.webp"},{"id":"ava-195","type":"avatar","key":195,"name":"馬可・夜光彩墨","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/195.webp"},{"id":"ava-196","type":"avatar","key":196,"name":"羅・夜光彩墨","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/196.webp"},{"id":"ava-197","type":"avatar","key":197,"name":"布魯克・夜光彩墨","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/197.webp"},{"id":"ava-198","type":"avatar","key":198,"name":"娜美・織線航章","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/198.webp"},{"id":"ava-199","type":"avatar","key":199,"name":"羅賓・織線航章","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/199.webp"},{"id":"ava-200","type":"avatar","key":200,"name":"薇薇・織線航章","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/200.webp"},{"id":"ava-201","type":"avatar","key":201,"name":"香吉士・織線航章","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/201.webp"},{"id":"ava-202","type":"avatar","key":202,"name":"吉貝爾・織線航章","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/202.webp"},{"id":"ava-203","type":"avatar","key":203,"name":"漢考克・航海映金","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/203.webp"},{"id":"ava-204","type":"avatar","key":204,"name":"克洛克達爾・航海映金","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/204.webp"},{"id":"ava-205","type":"avatar","key":205,"name":"多佛朗明哥・航海映金","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/205.webp"},{"id":"ava-206","type":"avatar","key":206,"name":"羅布・路基・航海映金","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/206.webp"},{"id":"ava-207","type":"avatar","key":207,"name":"紅髮傑克・航海映金","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/207.webp"},{"id":"ava-208","type":"avatar","key":208,"name":"索隆・炭筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/208.webp"},{"id":"ava-209","type":"avatar","key":209,"name":"雷利・炭筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/209.webp"},{"id":"ava-210","type":"avatar","key":210,"name":"白鬍子・炭筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/210.webp"},{"id":"ava-211","type":"avatar","key":211,"name":"薩波・炭筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/211.webp"},{"id":"ava-212","type":"avatar","key":212,"name":"卡普・炭筆航誌","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/212.webp"},{"id":"ava-213","type":"avatar","key":213,"name":"羅傑・赤潮刻印","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/213.webp"},{"id":"ava-214","type":"avatar","key":214,"name":"魯夫・赤潮刻印","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/214.webp"},{"id":"ava-215","type":"avatar","key":215,"name":"卡塔克利・赤潮刻印","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/215.webp"},{"id":"ava-216","type":"avatar","key":216,"name":"基德・赤潮刻印","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/216.webp"},{"id":"ava-217","type":"avatar","key":217,"name":"香吉士・赤潮刻印","rarity":"rare","price":10,"asset":"opui://launcher/images/board/avatars/217.webp"},{"id":"ava-218","type":"avatar","key":218,"name":"娜美・粉彩航夢","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/218.webp"},{"id":"ava-219","type":"avatar","key":219,"name":"培羅娜・粉彩航夢","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/219.webp"},{"id":"ava-220","type":"avatar","key":220,"name":"羅賓・粉彩航夢","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/220.webp"},{"id":"ava-221","type":"avatar","key":221,"name":"艾斯・粉彩航夢","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/221.webp"},{"id":"ava-222","type":"avatar","key":222,"name":"喬巴・粉彩航夢","rarity":"epic","price":18,"asset":"opui://launcher/images/board/avatars/222.webp"},{"id":"wall-4","type":"wall","key":4,"name":"牆面 #4","rarity":"common","asset":"opui://launcher/images/walls/4.webp","price":5},{"id":"wall-5","type":"wall","key":5,"name":"牆面 #5","rarity":"rare","asset":"opui://launcher/images/walls/5.webp","price":10},{"id":"wall-6","type":"wall","key":6,"name":"牆面 #6","rarity":"rare","asset":"opui://launcher/images/walls/6.webp","price":10},{"id":"wall-7","type":"wall","key":7,"name":"牆面 #7","rarity":"epic","asset":"opui://launcher/images/walls/7.webp","price":18},{"id":"wall-8","type":"wall","key":8,"name":"牆面 #8","rarity":"legend","asset":"opui://launcher/images/walls/8.webp","price":25},{"id":"flag-4","type":"flag","key":4,"name":"海賊旗 #4","rarity":"common","asset":"opui://launcher/images/flags/4.webp","price":5},{"id":"flag-5","type":"flag","key":5,"name":"海賊旗 #5","rarity":"common","asset":"opui://launcher/images/flags/5.webp","price":5},{"id":"flag-6","type":"flag","key":6,"name":"海賊旗 #6","rarity":"rare","asset":"opui://launcher/images/flags/6.webp","price":10},{"id":"flag-7","type":"flag","key":7,"name":"海賊旗 #7","rarity":"rare","asset":"opui://launcher/images/flags/7.webp","price":10},{"id":"flag-8","type":"flag","key":8,"name":"海賊旗 #8","rarity":"epic","asset":"opui://launcher/images/flags/8.webp","price":18},{"id":"flag-9","type":"flag","key":9,"name":"海賊旗 #9","rarity":"epic","asset":"opui://launcher/images/flags/9.webp","price":18},{"id":"flag-10","type":"flag","key":10,"name":"海賊旗 #10","rarity":"epic","asset":"opui://launcher/images/flags/10.webp","price":18},{"id":"flag-11","type":"flag","key":11,"name":"海賊旗 #11","rarity":"legend","asset":"opui://launcher/images/flags/11.webp","price":25},{"id":"flag-12","type":"flag","key":12,"name":"海賊旗 #12","rarity":"legend","asset":"opui://launcher/images/flags/12.webp","price":25},{"id":"flag-13","type":"flag","key":13,"name":"海賊旗 #13","rarity":"legend","asset":"opui://launcher/images/flags/13.webp","price":25},{"id":"flag-14","type":"flag","key":14,"name":"海賊旗 #14","rarity":"legend","asset":"opui://launcher/images/flags/14.webp","price":25},{"id":"flag-15","type":"flag","key":15,"name":"海賊旗 #15","rarity":"legend","asset":"opui://launcher/images/flags/15.webp","price":25},{"id":"layout-grand-line","type":"layout","key":"grand-line","name":"偉大航路日誌","rarity":"common","price":5},{"id":"layout-bounty-board","type":"layout","key":"bounty-board","name":"懸賞牆","rarity":"rare","price":10},{"id":"layout-captain-quarters","type":"layout","key":"captain-quarters","name":"船長艙","rarity":"epic","price":18},{"id":"background-luffy","type":"background","key":"luffy","name":"魯夫啟航","rarity":"rare","asset":"opui://launcher/images/profile_decor/bg-luffy.webp","price":10},{"id":"background-zoro","type":"background","key":"zoro","name":"索隆劍影","rarity":"rare","asset":"opui://launcher/images/profile_decor/bg-zoro.webp","price":10},{"id":"background-nami","type":"background","key":"nami","name":"娜美航海圖","rarity":"rare","asset":"opui://launcher/images/profile_decor/bg-nami.webp","price":10},{"id":"frame-luffy","type":"frame","key":"luffy","name":"魯夫相框","rarity":"epic","asset":"opui://launcher/images/profile_decor/frame-luffy.webp","price":18},{"id":"frame-zoro","type":"frame","key":"zoro","name":"索隆相框","rarity":"epic","asset":"opui://launcher/images/profile_decor/frame-zoro.webp","price":18},{"id":"decor-header-luffy","type":"decoration","key":"header-luffy","slot":"header","name":"魯夫貼紙","rarity":"rare","asset":"opui://launcher/images/profile_decor/sticker-luffy.webp","price":10},{"id":"decor-header-chopper","type":"decoration","key":"header-chopper","slot":"header","name":"喬巴貼紙","rarity":"common","asset":"opui://launcher/images/profile_decor/sticker-chopper.webp","price":5},{"id":"decor-side-zoro","type":"decoration","key":"side-zoro","slot":"side","name":"索隆貼紙","rarity":"rare","asset":"opui://launcher/images/profile_decor/sticker-zoro.webp","price":10},{"id":"decor-side-nami","type":"decoration","key":"side-nami","slot":"side","name":"娜美貼紙","rarity":"common","asset":"opui://launcher/images/profile_decor/sticker-nami.webp","price":5},{"id":"decor-footer-ace","type":"decoration","key":"footer-ace","slot":"footer","name":"艾斯貼紙","rarity":"epic","asset":"opui://launcher/images/profile_decor/sticker-ace.webp","price":18},{"id":"decor-footer-robin","type":"decoration","key":"footer-robin","slot":"footer","name":"羅賓貼紙","rarity":"rare","asset":"opui://launcher/images/profile_decor/sticker-robin.webp","price":10},{"id":"bgm-harbor","type":"bgm","key":"harbor","name":"暮港歸航","rarity":"rare","asset":"opui://launcher/audio/profile_bgm/harbor.ogg","price":10},{"id":"bgm-night-watch","type":"bgm","key":"night-watch","name":"星夜航線","rarity":"epic","asset":"opui://launcher/audio/profile_bgm/night-watch.ogg","price":18},{"id":"bgm-voyage","type":"bgm","key":"voyage","name":"破曉揚帆","rarity":"legend","asset":"opui://launcher/audio/profile_bgm/voyage.ogg","price":25},{"id":"bgm-op-01","type":"bgm","key":"op-01","name":"OP 01 · ウィーアー!(We Are)","rarity":"rare","asset":"opui://launcher/audio/bgm/track01.mp3","price":10},{"id":"bgm-op-02","type":"bgm","key":"op-02","name":"OP 02 · Believe","rarity":"rare","asset":"opui://launcher/audio/bgm/track02.mp3","price":10},{"id":"bgm-op-03","type":"bgm","key":"op-03","name":"OP 03 · ヒカリへ","rarity":"rare","asset":"opui://launcher/audio/bgm/track03.mp3","price":10},{"id":"bgm-op-04","type":"bgm","key":"op-04","name":"OP 04 · BON VOYAGE!","rarity":"rare","asset":"opui://launcher/audio/bgm/track04.mp3","price":10},{"id":"bgm-op-05","type":"bgm","key":"op-05","name":"OP 05 · ココロのちず","rarity":"rare","asset":"opui://launcher/audio/bgm/track05.mp3","price":10},{"id":"bgm-op-06","type":"bgm","key":"op-06","name":"OP 06 · BRAND NEW WORLD","rarity":"rare","asset":"opui://launcher/audio/bgm/track06.mp3","price":10},{"id":"bgm-op-07","type":"bgm","key":"op-07","name":"OP 07 · ウィーアー!～7人の麥わら海賊団篇～","rarity":"rare","asset":"opui://launcher/audio/bgm/track07.mp3","price":10},{"id":"bgm-op-08","type":"bgm","key":"op-08","name":"OP 08 · Crazy Rainbow","rarity":"rare","asset":"opui://launcher/audio/bgm/track08.mp3","price":10},{"id":"bgm-op-09","type":"bgm","key":"op-09","name":"OP 09 · Jungle P","rarity":"rare","asset":"opui://launcher/audio/bgm/track09.mp3","price":10},{"id":"bgm-op-10","type":"bgm","key":"op-10","name":"OP 10 · ウィーアー!～アニメーションワンピース10週年","rarity":"rare","asset":"opui://launcher/audio/bgm/track10.mp3","price":10},{"id":"bgm-op-11","type":"bgm","key":"op-11","name":"OP 11 · Share The World","rarity":"rare","asset":"opui://launcher/audio/bgm/track11.mp3","price":10},{"id":"bgm-op-12","type":"bgm","key":"op-12","name":"OP 12 · 風をさがして","rarity":"rare","asset":"opui://launcher/audio/bgm/track12.mp3","price":10},{"id":"bgm-op-13","type":"bgm","key":"op-13","name":"OP 13 · One day","rarity":"rare","asset":"opui://launcher/audio/bgm/track13.mp3","price":10},{"id":"bgm-op-14","type":"bgm","key":"op-14","name":"OP 14 · Fight Together","rarity":"rare","asset":"opui://launcher/audio/bgm/track14.mp3","price":10},{"id":"bgm-op-15","type":"bgm","key":"op-15","name":"OP 15 · We Go!","rarity":"rare","asset":"opui://launcher/audio/bgm/track15.mp3","price":10},{"id":"bgm-op-16","type":"bgm","key":"op-16","name":"OP 16 · Hands Up!","rarity":"rare","asset":"opui://launcher/audio/bgm/track16.mp3","price":10},{"id":"bgm-op-17","type":"bgm","key":"op-17","name":"OP 17 · Wake up!","rarity":"rare","asset":"opui://launcher/audio/bgm/track17.mp3","price":10},{"id":"bgm-op-18","type":"bgm","key":"op-18","name":"OP 18 · Hard Knock Days","rarity":"rare","asset":"opui://launcher/audio/bgm/track18.mp3","price":10},{"id":"bgm-op-19","type":"bgm","key":"op-19","name":"OP 19 · We Can!","rarity":"rare","asset":"opui://launcher/audio/bgm/track19.mp3","price":10},{"id":"bgm-op-20","type":"bgm","key":"op-20","name":"OP 20 · Hope","rarity":"rare","asset":"opui://launcher/audio/bgm/track20.mp3","price":10},{"id":"guestbook-1","type":"guestbook","key":"guestbook","name":"好友留言板","rarity":"rare","price":10},{"id":"guestbook-style-sunny-deck","type":"guestbook_style","key":"sunny-deck","name":"千陽號甲板","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/boards/sunny-deck.webp","price":10},{"id":"guestbook-style-merry-log","type":"guestbook_style","key":"merry-log","name":"梅利號航海日誌","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/boards/merry-log.webp","price":10},{"id":"guestbook-style-water-seven","type":"guestbook_style","key":"water-seven","name":"水之七島船塢","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/boards/water-seven.webp","price":18},{"id":"guestbook-style-skypiea","type":"guestbook_style","key":"skypiea","name":"空島雲海","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/boards/skypiea.webp","price":18},{"id":"guestbook-style-alabasta","type":"guestbook_style","key":"alabasta","name":"阿拉巴斯坦王國","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/boards/alabasta.webp","price":10},{"id":"guestbook-style-wano","type":"guestbook_style","key":"wano","name":"和之國櫻夜","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/boards/wano.webp","price":18},{"id":"guestbook-style-fishman-island","type":"guestbook_style","key":"fishman-island","name":"魚人島深海","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/boards/fishman-island.webp","price":18},{"id":"guestbook-style-marineford","type":"guestbook_style","key":"marineford","name":"馬林福特要塞","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/boards/marineford.webp","price":10},{"id":"guestbook-style-grand-line-chart","type":"guestbook_style","key":"grand-line-chart","name":"偉大航道海圖","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/boards/grand-line-chart.webp","price":10},{"id":"guestbook-style-tabletop-captain","type":"guestbook_style","key":"tabletop-captain","name":"船長的桌遊航路","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/boards/tabletop-captain.webp","price":18},{"id":"comment-style-strawhat-note","type":"comment_style","key":"strawhat-note","name":"草帽便條","rarity":"common","asset":"opui://launcher/images/launcher_guestbook/notes/strawhat-note.webp","price":5},{"id":"comment-style-zoro-tag","type":"comment_style","key":"zoro-tag","name":"三刀流掛箋","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/zoro-tag.webp","price":10},{"id":"comment-style-nami-chart","type":"comment_style","key":"nami-chart","name":"航海士海圖紙","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/nami-chart.webp","price":10},{"id":"comment-style-usopp-letter","type":"comment_style","key":"usopp-letter","name":"狙擊手手札","rarity":"common","asset":"opui://launcher/images/launcher_guestbook/notes/usopp-letter.webp","price":5},{"id":"comment-style-sanji-menu","type":"comment_style","key":"sanji-menu","name":"海上餐廳菜單","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/sanji-menu.webp","price":10},{"id":"comment-style-chopper-prescription","type":"comment_style","key":"chopper-prescription","name":"櫻花醫師處方箋","rarity":"common","asset":"opui://launcher/images/launcher_guestbook/notes/chopper-prescription.webp","price":5},{"id":"comment-style-robin-rubbing","type":"comment_style","key":"robin-rubbing","name":"考古學家拓印紙","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/notes/robin-rubbing.webp","price":18},{"id":"comment-style-franky-blueprint","type":"comment_style","key":"franky-blueprint","name":"船匠設計圖","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/franky-blueprint.webp","price":10},{"id":"comment-style-brook-score","type":"comment_style","key":"brook-score","name":"靈魂之王樂譜","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/brook-score.webp","price":10},{"id":"comment-style-jinbe-letter","type":"comment_style","key":"jinbe-letter","name":"海俠波紋信箋","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/jinbe-letter.webp","price":10},{"id":"comment-style-ace-postcard","type":"comment_style","key":"ace-postcard","name":"火拳旅行明信片","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/notes/ace-postcard.webp","price":18},{"id":"comment-style-sabo-dispatch","type":"comment_style","key":"sabo-dispatch","name":"革命軍密函","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/notes/sabo-dispatch.webp","price":18},{"id":"comment-style-law-chart","type":"comment_style","key":"law-chart","name":"紅心船醫紀錄紙","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/notes/law-chart.webp","price":18},{"id":"comment-style-hancock-letter","type":"comment_style","key":"hancock-letter","name":"九蛇女帝信紙","rarity":"epic","asset":"opui://launcher/images/launcher_guestbook/notes/hancock-letter.webp","price":18},{"id":"comment-style-shanks-note","type":"comment_style","key":"shanks-note","name":"紅髮航海便箋","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/shanks-note.webp","price":10},{"id":"comment-style-merry-ticket","type":"comment_style","key":"merry-ticket","name":"梅利號乘船券","rarity":"common","asset":"opui://launcher/images/launcher_guestbook/notes/merry-ticket.webp","price":5},{"id":"comment-style-sunny-pass","type":"comment_style","key":"sunny-pass","name":"千陽號登船證","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/sunny-pass.webp","price":10},{"id":"comment-style-log-pose-card","type":"comment_style","key":"log-pose-card","name":"紀錄指針航路卡","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/log-pose-card.webp","price":10},{"id":"comment-style-fishing-catch","type":"comment_style","key":"fishing-catch","name":"釣手漁獲紀念卡","rarity":"common","asset":"opui://launcher/images/launcher_guestbook/notes/fishing-catch.webp","price":5},{"id":"comment-style-tabletop-invite","type":"comment_style","key":"tabletop-invite","name":"海賊桌遊邀請函","rarity":"rare","asset":"opui://launcher/images/launcher_guestbook/notes/tabletop-invite.webp","price":10},{"id":"room-scene-sunny-deck","type":"room_scene","key":"sunny-deck","name":"千陽號甲板","rarity":"rare","asset":"opui://launcher/images/launcher_room/scenes/sunny-deck.webp","price":10},{"id":"room-scene-sunny-kitchen","type":"room_scene","key":"sunny-kitchen","name":"千陽號廚房","rarity":"epic","asset":"opui://launcher/images/launcher_room/scenes/sunny-kitchen.webp","price":18},{"id":"room-scene-sunny-library","type":"room_scene","key":"sunny-library","name":"千陽號圖書室","rarity":"epic","asset":"opui://launcher/images/launcher_room/scenes/sunny-library.webp","price":18},{"id":"room-scene-sunny-workshop","type":"room_scene","key":"sunny-workshop","name":"千陽號船匠工作間","rarity":"epic","asset":"opui://launcher/images/launcher_room/scenes/sunny-workshop.webp","price":18},{"id":"room-scene-sunny-aquarium","type":"room_scene","key":"sunny-aquarium","name":"千陽號水族館酒吧","rarity":"epic","asset":"opui://launcher/images/launcher_room/scenes/sunny-aquarium.webp","price":18},{"id":"room-furniture-helm","type":"room_furniture","key":"helm","name":"千陽號舵輪","rarity":"rare","asset":"opui://launcher/images/launcher_room/furniture/helm.webp","price":10},{"id":"room-furniture-map-table","type":"room_furniture","key":"map-table","name":"娜美的航海圖桌","rarity":"rare","asset":"opui://launcher/images/launcher_room/furniture/map-table.webp","price":10},{"id":"room-furniture-treasure-chest","type":"room_furniture","key":"treasure-chest","name":"草帽一行人的寶箱","rarity":"common","asset":"opui://launcher/images/launcher_room/furniture/treasure-chest.webp","price":5},{"id":"room-furniture-tangerine-tree","type":"room_furniture","key":"tangerine-tree","name":"娜美的橘子樹","rarity":"epic","asset":"opui://launcher/images/launcher_room/furniture/tangerine-tree.webp","price":18},{"id":"room-furniture-swords-rack","type":"room_furniture","key":"swords-rack","name":"索隆的刀架","rarity":"rare","asset":"opui://launcher/images/launcher_room/furniture/swords-rack.webp","price":10},{"id":"room-furniture-kitchen-table","type":"room_furniture","key":"kitchen-table","name":"香吉士的餐桌","rarity":"common","asset":"opui://launcher/images/launcher_room/furniture/kitchen-table.webp","price":5},{"id":"room-furniture-bookshelf","type":"room_furniture","key":"bookshelf","name":"羅賓的書架","rarity":"rare","asset":"opui://launcher/images/launcher_room/furniture/bookshelf.webp","price":10},{"id":"room-furniture-medicine-cabinet","type":"room_furniture","key":"medicine-cabinet","name":"喬巴的醫藥櫃","rarity":"rare","asset":"opui://launcher/images/launcher_room/furniture/medicine-cabinet.webp","price":10},{"id":"room-furniture-piano","type":"room_furniture","key":"piano","name":"布魯克的鋼琴","rarity":"epic","asset":"opui://launcher/images/launcher_room/furniture/piano.webp","price":18},{"id":"room-furniture-tool-bench","type":"room_furniture","key":"tool-bench","name":"佛朗基的工作台","rarity":"epic","asset":"opui://launcher/images/launcher_room/furniture/tool-bench.webp","price":18},{"id":"room-furniture-supply-rack","type":"room_furniture","key":"supply-rack","name":"甲板補給架","rarity":"rare","stationType":"deck","footprint":{"cols":2,"rows":1},"asset":"opui://launcher/images/launcher_room/furniture/supply-rack.webp","price":10},{"id":"room-furniture-log-pose-desk","type":"room_furniture","key":"log-pose-desk","name":"航海記錄桌","rarity":"rare","stationType":"navigation","footprint":{"cols":2,"rows":2},"asset":"opui://launcher/images/launcher_room/furniture/log-pose-desk.webp","price":10},{"id":"room-furniture-repair-cart","type":"room_furniture","key":"repair-cart","name":"船匠工具推車","rarity":"rare","stationType":"workshop","footprint":{"cols":2,"rows":1},"asset":"opui://launcher/images/launcher_room/furniture/repair-cart.webp","price":10},{"id":"room-furniture-library-cart","type":"room_furniture","key":"library-cart","name":"考古書籍推車","rarity":"rare","stationType":"library","footprint":{"cols":2,"rows":1},"asset":"opui://launcher/images/launcher_room/furniture/library-cart.webp","price":10},{"id":"room-furniture-medical-cart","type":"room_furniture","key":"medical-cart","name":"船醫備品推車","rarity":"rare","stationType":"medical","footprint":{"cols":2,"rows":1},"asset":"opui://launcher/images/launcher_room/furniture/medical-cart.webp","price":10},{"id":"room-furniture-den-den-desk","type":"room_furniture","key":"den-den-desk","name":"電話蟲聯絡桌","rarity":"epic","stationType":"deck","footprint":{"cols":2,"rows":2},"asset":"opui://launcher/images/launcher_room/furniture/den-den-desk.webp","price":18},{"id":"room-furniture-galley-stove","type":"room_furniture","key":"galley-stove","name":"千陽號料理爐台","rarity":"epic","price":80,"stationType":"kitchen","footprint":{"cols":3,"rows":2},"asset":"opui://launcher/images/launcher_room/furniture/galley-stove.webp"},{"id":"room-furniture-aquarium-tank","type":"room_furniture","key":"aquarium-tank","name":"千陽號移動水族箱","rarity":"epic","price":28,"stationType":"aquarium","footprint":{"cols":3,"rows":2},"asset":"opui://launcher/images/launcher_room/furniture/aquarium-tank.webp"},{"id":"room-furniture-fishing-gear-rack","type":"room_furniture","key":"fishing-gear-rack","name":"草帽一行人的釣具架","rarity":"rare","price":12,"stationType":"deck","footprint":{"cols":2,"rows":2},"asset":"opui://launcher/images/launcher_room/furniture/fishing-gear-rack.webp"},{"id":"room-furniture-galley-icebox","type":"room_furniture","key":"galley-icebox","name":"香吉士的食材冰箱","rarity":"rare","price":14,"stationType":"kitchen","footprint":{"cols":2,"rows":1},"asset":"opui://launcher/images/launcher_room/furniture/galley-icebox.webp"},{"id":"room-furniture-crew-tea-table","type":"room_furniture","key":"crew-tea-table","name":"千陽號夥伴茶桌","rarity":"common","price":6,"stationType":"social","footprint":{"cols":3,"rows":1},"asset":"opui://launcher/images/launcher_room/furniture/crew-tea-table.webp"},{"id":"room-character-luffy","type":"room_character","key":"luffy","name":"魯夫","rarity":"legend","asset":"opui://launcher/images/launcher_room/chibi/luffy.webp","price":25},{"id":"room-character-zoro","type":"room_character","key":"zoro","name":"索隆","rarity":"epic","asset":"opui://launcher/images/launcher_room/chibi/zoro.webp","price":18},{"id":"room-character-nami","type":"room_character","key":"nami","name":"娜美","rarity":"epic","asset":"opui://launcher/images/launcher_room/chibi/nami.webp","price":18},{"id":"room-character-chopper","type":"room_character","key":"chopper","name":"喬巴","rarity":"epic","asset":"opui://launcher/images/launcher_room/chibi/chopper.webp","price":18},{"id":"room-character-sanji","type":"room_character","key":"sanji","name":"香吉士","rarity":"epic","asset":"opui://launcher/images/launcher_room/chibi/sanji.webp","price":18},{"id":"room-character-robin","type":"room_character","key":"robin","name":"羅賓","rarity":"epic","asset":"opui://launcher/images/launcher_room/chibi/robin.webp","price":18},{"id":"room-character-usopp","type":"room_character","key":"usopp","name":"騙人布","rarity":"rare","asset":"opui://launcher/images/launcher_room/chibi/usopp.webp","price":10},{"id":"room-character-franky","type":"room_character","key":"franky","name":"佛朗基","rarity":"epic","asset":"opui://launcher/images/launcher_room/chibi/franky.webp","price":18},{"id":"room-character-brook","type":"room_character","key":"brook","name":"布魯克","rarity":"epic","asset":"opui://launcher/images/launcher_room/chibi/brook.webp","price":18},{"id":"room-character-jinbe","type":"room_character","key":"jinbe","name":"甚平","rarity":"epic","asset":"opui://launcher/images/launcher_room/chibi/jinbe.webp","price":18},{"id":"room-character-ace","type":"room_character","key":"ace","name":"艾斯","rarity":"epic","asset":"opui://launcher/images/launcher_room/reserved_v2/ace/portrait.webp","price":18},{"id":"room-character-sabo","type":"room_character","key":"sabo","name":"薩波","rarity":"epic","asset":"opui://launcher/images/launcher_room/reserved_v1/sabo/portrait.webp","price":18},{"id":"room-character-law","type":"room_character","key":"law","name":"托拉法爾加·羅","rarity":"epic","asset":"opui://launcher/images/launcher_room/reserved_v1/law/portrait.webp","price":18},{"id":"decor-header-luffy-chibi","type":"decoration","key":"header-luffy-chibi","slot":"header","name":"魯夫貼紙","rarity":"rare","asset":"opui://launcher/images/launcher_room/chibi/luffy.webp","price":10},{"id":"decor-header-chopper-chibi","type":"decoration","key":"header-chopper-chibi","slot":"header","name":"喬巴貼紙","rarity":"rare","asset":"opui://launcher/images/launcher_room/chibi/chopper.webp","price":10},{"id":"decor-side-zoro-chibi","type":"decoration","key":"side-zoro-chibi","slot":"side","name":"索隆貼紙","rarity":"rare","asset":"opui://launcher/images/launcher_room/chibi/zoro.webp","price":10},{"id":"decor-side-nami-chibi","type":"decoration","key":"side-nami-chibi","slot":"side","name":"娜美貼紙","rarity":"rare","asset":"opui://launcher/images/launcher_room/chibi/nami.webp","price":10},{"id":"decor-footer-sanji-chibi","type":"decoration","key":"footer-sanji-chibi","slot":"footer","name":"香吉士貼紙","rarity":"rare","asset":"opui://launcher/images/launcher_room/chibi/sanji.webp","price":10},{"id":"decor-footer-robin-chibi","type":"decoration","key":"footer-robin-chibi","slot":"footer","name":"羅賓貼紙","rarity":"rare","asset":"opui://launcher/images/launcher_room/chibi/robin.webp","price":10},{"id":"background-sunny-deck","type":"background","key":"sunny-deck","name":"千陽號甲板背景","rarity":"rare","asset":"opui://launcher/images/launcher_room/scenes/sunny-deck.webp","price":10},{"id":"background-sunny-kitchen","type":"background","key":"sunny-kitchen","name":"千陽號廚房背景","rarity":"rare","asset":"opui://launcher/images/launcher_room/scenes/sunny-kitchen.webp","price":10},{"id":"background-sunny-library","type":"background","key":"sunny-library","name":"千陽號圖書室背景","rarity":"rare","asset":"opui://launcher/images/launcher_room/scenes/sunny-library.webp","price":10},{"id":"frame-sunny","type":"frame","key":"sunny","name":"千陽號相框","rarity":"epic","asset":"opui://launcher/images/launcher_room/frames/ship-wheel.webp","price":18},{"id":"frame-straw-hat","type":"frame","key":"straw-hat","name":"草帽海賊團相框","rarity":"epic","asset":"opui://launcher/images/launcher_room/frames/straw-hat.webp","price":18},{"id":"layout-sunny-deck","type":"layout","key":"sunny-deck","name":"千陽號甲板排版","rarity":"rare","price":10},{"id":"layout-sunny-kitchen","type":"layout","key":"sunny-kitchen","name":"千陽號廚房排版","rarity":"rare","price":10},{"id":"layout-sunny-library","type":"layout","key":"sunny-library","name":"千陽號圖書室排版","rarity":"rare","price":10}];
  // END GENERATED LOCAL SHOP CATALOG
  // Versioned profile operations ride the existing authenticated desktop bridge.
  // The server validates catalog IDs, ownership and permissions for each action.
  const profileCommand = (operation, payload = {}, requestId = crypto.randomUUID()) => api.commandLauncherLife({
    requestId, expectedRevision: 0, type: 'event.record', payload: { scope: 'launcher-profile-v1', operation, ...payload }
  });
  const extendedItem = id => /^(?:guestbook-style-|comment-style-)/.test(id) || /^ava-[1-9][0-9]*$/.test(id) && Number(id.slice(4)) >= 63 && Number(id.slice(4)) <= MAX_AVATAR_ID;
  const number = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  const fmt = value => number(value).toLocaleString('zh-TW');
  const el = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = String(content);
    return node;
  };
  const validIds = (source, max) => [...new Set((Array.isArray(source) ? source : []).map(Number).filter(id => Number.isInteger(id) && id >= 1 && id <= max))].sort((a, b) => a - b);
  const imageFor = (type, key) => {
    if (type === 'room_scene' && ['sunny-deck', 'sunny-kitchen', 'sunny-library'].includes(key)) return `opui://launcher/images/launcher_room/scenes/${key}-v2.webp`;
    if (type === 'room_character' && ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe'].includes(key)) return `opui://launcher/images/launcher_room/${window.OnePieceRoomMotion?.LUFFY_ART_ENABLED === true && key === 'luffy' ? 'portrait_v4' : 'portrait_v3'}/${key}.webp`;
    const id = Number(key);
    if (type === 'avatar' && Number.isInteger(id) && id >= 1 && id <= MAX_AVATAR_ID) return `opui://launcher/images/board/avatars/${id}.webp`;
    if (type === 'wall' && Number.isInteger(id) && id >= 1 && id <= 8) return `opui://launcher/images/walls/${id}.webp`;
    if (type === 'flag' && Number.isInteger(id) && id >= 1 && id <= 15) return `opui://launcher/images/flags/${id}.webp`;
    return '';
  };
  const safeImageAsset = asset => typeof asset === 'string' && /^opui:\/\/launcher\/images\/[a-z0-9_/-]+\.(?:png|webp)$/i.test(asset) ? asset : '';
  const safeAudioAsset = asset => typeof asset === 'string' &&
    /^opui:\/\/launcher\/audio\/(?:profile_bgm\/[a-z0-9-]+\.ogg|bgm\/track(?:0[1-9]|1[0-9]|20)\.mp3)$/i.test(asset) ? asset : '';
  const itemImage = item => imageFor(item?.type, item?.key) || safeImageAsset(item?.asset);
  function portraitFallback(image, item) {
    image.onerror = null;
    if (window.OnePieceRoomMotion?.LUFFY_ART_ENABLED !== true || item?.type !== 'room_character' || item?.key !== 'luffy') return;
    image.onerror = () => {
      image.onerror = null;
      image.src = 'opui://launcher/images/launcher_room/portrait_v3/luffy.webp';
    };
  }
  const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
  const errorText = code => ({
    'client_update_required': '請先更新啟動器，再操作含新夥伴的個人頁。',
    'character_not_released': '這位夥伴尚未開放，請留意後續公告。',
    'not authenticated': '請先登入帳號。', 'bad secret': '登入已失效，請重新登入。',
    'not friends': '目前無法參觀這位玩家的個人頁。', 'not found': '找不到這位玩家。',
    'insufficient_coins': '金幣不足。', 'insufficient coins': '金幣不足。',
    'already_owned': '已經收藏這件商品。', 'not_owned': '尚未收藏這件商品。',
    'room_full': '房間最多同時放 10 位夥伴。請先在佈置模式收回一位，再放入新夥伴。',
    'invalid item': '這件商品目前無法購買，請更新啟動器後再試。',
    'invalid_comment_style': '請重新選擇留言紙。', 'comment_style_not_owned': '尚未收藏這款留言紙。', 'comment_deleted': '這則留言已刪除。', 'request_id_conflict': '內容已變更，請修改文字後重新送出。',
    'guestbook_locked': '留言板尚未解鎖。', 'not_friends': '目前只有好友可以留言。',
    'invalid placement': '佈置位置不正確，請重新調整。', 'rate_limited': '留言太頻繁，請稍後再試。',
    'invalid card': '名片內容不正確，請檢查名稱、簡介與頭像。', 'invalid_card': '名片內容不正確，請檢查名稱、簡介與頭像。',
    timeout: '伺服器回應逾時，請重新整理確認結果。', offline: '目前無法連線，請稍後再試。'
  })[String(code || '')] || '操作未完成，請稍後再試。';

  let accountId = 0, accountAvatarVersion = 0;
  let preview = false;
  let viewUserId = 0;
  let profile = null;
  let shop = null;
  const SHOP_FRESH_MS = 30000;
  let shopFetchedAt = 0, shopOnline = false, shopSync = null;
  let shopWalletVersion = 0, shopWalletUpdate = null;
  const shopCards = new Map();
  let profileRequest = 0;
  let shopRequest = 0;
  let collectionTab = 'avatars';
  let shopTab = 'avatar';
  let announcementShopItem = '';
  let pendingPurchase = null;
  let shopBusy = false;
  let shopMutation = 0;
  const shopPreviewAudio = el('audio');
  shopPreviewAudio.dataset.role = 'shop-preview';
  shopPreviewAudio.preload = 'none';
  shopPreviewAudio.volume = .4;
  $('shopPanel').append(shopPreviewAudio);
  let shopPreviewId = '';
  let shopPreviewRequest = 0;
  let shopPreviewPending = false;
  let comments = null;
  let commentRequest = 0;
  let commentNextBeforeId = 0;
  let commentHasMore = false;
  let commentBusy = false;
  let pendingCommentDelete = null;
  let cardBusy = false;
  let decorBusy = false;
  let cardMutation = 0;
  let bgmSource = '';
  let bgmPlaylist = [];
  let bgmIndex = 0;
  let bgmPlayRequest = 0;
  let bgmPlayPending = false;
  let bgmPausedByUser = false;
  let bgmAutoplayBlocked = false;
  let bgmState = 'idle';
  let bgmSaveRequest = 0;
  let bgmPickerBusy = false;
  let profileVisible = false;
  const BGM_LISTENER_KEY = 'onepiece.launcher.profileMusic.v1';
  let bgmListener = { volume: .35, muted: false };
  try {
    const saved = JSON.parse(localStorage.getItem(BGM_LISTENER_KEY) || 'null');
    if (saved && Number.isFinite(saved.volume) && typeof saved.muted === 'boolean') bgmListener = { volume: clamp(saved.volume, 0, 1, .35), muted: saved.muted };
  } catch { /* Listener preferences never change the page owner's saved song. */ }
  let roomEditorRequested = false;

  function status(target, message, error = false) {
    const node = $(target);
    node.textContent = message;
    node.classList.toggle('is-error', error);
  }
  function emptyCollection(message) { $('profileCollectionGrid').replaceChildren(el('p', 'voyage-collection-empty', message)); }
  function avatarFallback(img) { img.onerror = () => { img.onerror = null; img.src = imageFor('avatar', 8); }; }
  function cardDisplayName(p) { return String(p?.card?.displayName || p?.name || '航海者'); }
  function cardTagline(p) { return typeof p?.card?.tagline === 'string' ? p.card.tagline : String(p?.title || '偉大航道航海者'); }
  function cardAvatarId(p) {
    const chosen = Number(p?.card?.avatarId);
    return Number.isInteger(chosen) && chosen >= 1 && chosen <= MAX_AVATAR_ID ? chosen : number(p?.avatar) || 8;
  }
  function renderHero() {
    const own = profile ? profile.isSelf !== false : !viewUserId;
    const p = profile || {};
    if(p.isSelf&&number(p.userId)===accountId)publishAccountAvatar(p);
    $('profilePageTitle').textContent = own ? '個人頁' : '好友個人頁';
    $('profilePageHint').textContent = own ? '三款遊戲的航行紀錄與珍藏。' : '參觀好友的遊戲紀錄與公開蒐藏。';
    $('profileBackToFriends').hidden = own;
    $('profileHeroKind').textContent = own ? 'MY VOYAGE' : 'FRIEND VOYAGE';
    $('profileHeroName').textContent = cardDisplayName(p);
    $('profileHeroTitle').textContent = cardTagline(p);
    $('profileHeroId').textContent = p.userId ? `航海者 #${number(p.userId)}` : '';
    $('profileHeroAvatar').src = imageFor('avatar', cardAvatarId(p)) || imageFor('avatar', 8);
    avatarFallback($('profileHeroAvatar'));
    const appearance = p.appearance || {};
    const items = p.appearanceItems || {};
    const hero = $('profileHero');
    hero.classList.toggle('is-friend', !own);
    const layoutId = String(appearance.layoutId || 'layout-default');
    hero.dataset.layout = ['layout-grand-line', 'layout-bounty-board', 'layout-captain-quarters', 'layout-sunny-deck', 'layout-sunny-kitchen', 'layout-sunny-library'].includes(layoutId) ? layoutId : 'layout-default';
    const background = items.background?.id === appearance.backgroundId ? safeImageAsset(items.background?.asset) : '';
    const wall = imageFor('wall', appearance.wallId);
    const cardArt = background || wall;
    $('profileHeroArt').style.backgroundImage = cardArt ? `linear-gradient(90deg, #04141eee, #04141e99 68%, #04141e55), url("${cardArt}")` : '';
    const frame = items.frame?.id === appearance.frameId ? safeImageAsset(items.frame?.asset) : '';
    $('profileHeroFrame').hidden = !frame;
    $('profileHeroFrame').style.backgroundImage = frame ? `url("${frame}")` : '';
    const flag = imageFor('flag', appearance.flagId);
    $('profileHeroFlag').hidden = !flag;
    if (flag) $('profileHeroFlag').src = flag;
    else $('profileHeroFlag').removeAttribute('src');
    const stickers = $('profileHeroStickers'); stickers.replaceChildren();
    for (const [slot] of SLOTS) {
      const item = items.decorations?.[slot];
      const source = safeImageAsset(item?.asset);
      if (!source || item?.id !== appearance.decorations?.[slot]) continue;
      const position = slotPlacement(appearance.decorationPlacement, slot);
      const img = el('img', 'captain-hero-sticker'); img.alt = ''; img.src = source; img.dataset.slot = slot;
      img.style.left = `${position.x}%`; img.style.top = `${position.y}%`; img.style.setProperty('--scale', String(position.scale));
      stickers.append(img);
    }
    $('profileCardEdit').hidden = !own || !p.isSelf || !accountId || preview;
    if (!own || !p.isSelf || !accountId || preview) $('profileCardEditor').hidden = true;
  }
  function publishAccountAvatar(p){
    if(!p?.isSelf||number(p.userId)!==accountId)return;
    accountAvatarVersion++;
    window.LauncherProfileAvatar={userId:accountId,avatar:number(p.avatar)};
    window.dispatchEvent(new Event('launcher-profile-avatar'));
  }
  function metric(label, value) { const wrap = el('div'); wrap.append(el('dt', '', label), el('dd', '', value)); return wrap; }
  function gameMetrics(id, data) {
    if (id === 'card') return [metric('對局', fmt(data.games)), metric('勝場', fmt(data.wins)), metric('勝率', number(data.games) ? `${Math.round(number(data.wins) / number(data.games) * 100)}%` : '—')];
    if (id === 'board') {
      const values = [];
      if (Number.isFinite(Number(data.campaigns))) values.push(metric('航海存檔', fmt(data.campaigns)));
      if (Number.isFinite(Number(data.crewCount))) values.push(metric('最近船員', fmt(data.crewCount)));
      if (Number.isFinite(Number(data.bounty))) values.push(metric('最近懸賞', fmt(data.bounty)));
      if (Number.isFinite(Number(data.latestCoins))) values.push(metric('最近貝里', fmt(data.latestCoins)));
      if (Number.isFinite(Number(data.completed))) values.push(metric('完成航程', fmt(data.completed)));
      return values;
    }
    return [metric('對局', fmt(data.games)), metric('勝場', fmt(data.wins)), metric('和棋', fmt(data.draws)), metric('敗場', fmt(data.losses))];
  }
  function renderGames() {
    const grid = $('profileGameStats'); grid.replaceChildren();
    for (const game of GAME_META) {
      const data = profile?.games?.[game.id] || {};
      const card = el('article', 'voyage-game-card'); card.dataset.game = game.id;
      const image = el('img'); image.src = `opui://launcher/images/game_launcher/${game.cover}`; image.alt = '';
      const heading = el('div', 'voyage-game-card-header'); heading.append(el('h4', '', game.title), el('p', '', game.english));
      card.append(image, heading);
      if (!profile || data.available !== true) {
        const copy = game.id === 'card' ? '尚無雲端對局紀錄。' : game.id === 'board' ? '尚無可讀取的雲端航海存檔。' : '尚無已驗證的戰棋對局紀錄。';
        card.append(el('p', 'voyage-no-data', copy));
      } else {
        const dl = el('dl'); for (const item of gameMetrics(game.id, data)) dl.append(item);
        if (dl.childElementCount) card.append(dl);
        else card.append(el('p', 'voyage-no-data', '目前沒有可顯示的統計。'));
      }
      const source = game.id === 'card' ? '雲端卡牌戰績' : game.id === 'board' ? '雲端航海存檔' : '伺服器驗證的完成對局';
      card.append(el('p', 'voyage-card-source', source)); grid.append(card);
    }
  }
  function renderCollectionTabs() {
    const tabs = $('profileCollectionTabs'); tabs.replaceChildren();
    for (const [id, title] of COLLECTION_TABS) {
      const button = el('button', '', title); button.type = 'button'; button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(id === collectionTab));
      button.onclick = () => { collectionTab = id; renderCollectionTabs(); renderCollection(); };
      tabs.append(button);
    }
  }
  function collectionItem(grid, type, id, label) {
    const card = el('article', 'voyage-collectible');
    const img = el('img'); img.alt = ''; img.src = imageFor(type, id); if (type === 'avatar') avatarFallback(img);
    card.append(img, el('strong', '', `${label} #${id}`), el('small', '', type === 'avatar' && number(profile?.avatar) === id ? '目前使用' : '已收藏'));
    grid.append(card);
  }
  function textCollection(grid, title, subtitle) {
    const card = el('article', 'voyage-collectible is-text'); card.append(el('strong', '', title), el('small', '', subtitle)); grid.append(card);
  }
  function renderCollection() {
    const grid = $('profileCollectionGrid'); grid.replaceChildren();
    const card = profile?.collection?.card || {};
    const board = profile?.collection?.board || {};
    const category = collectionTab;
    if (['avatars', 'walls', 'flags'].includes(category)) {
      const type = category === 'avatars' ? 'avatar' : category === 'walls' ? 'wall' : 'flag';
      const max = type === 'avatar' ? MAX_AVATAR_ID : type === 'wall' ? 8 : 15;
      const label = type === 'avatar' ? '頭像' : type === 'wall' ? '牆面' : '旗幟';
      const ids = validIds(card[category], max);
      $('profileCollectionCount').textContent = `${ids.length} 件${label}`;
      for (const id of ids) collectionItem(grid, type, id, label);
      if (!ids.length) emptyCollection(`尚未收藏${label}。`);
      return;
    }
    if (category === 'titles') {
      $('profileCollectionCount').textContent = '榮譽與懸賞';
      textCollection(grid, `${fmt(card.titles)} 個稱號`, '偉大航道爭霸戰');
      textCollection(grid, `${fmt(card.bountyPosters)} 張懸賞令`, '偉大航道爭霸戰');
      if (card.deluxeUnlocked) textCollection(grid, '豪華版已解鎖', '偉大航道爭霸戰');
      for (const name of Array.isArray(card.titleNames) ? card.titleNames.slice(0, 30) : []) textCollection(grid, String(name).slice(0, 60), '已獲得稱號');
      return;
    }
    if (category === 'launcher') {
      const ids = Array.isArray(profile?.collection?.launcher?.itemIds) ? profile.collection.launcher.itemIds.filter(id => typeof id === 'string' && /^[a-z0-9-]{3,64}$/.test(id)) : [];
      const summaries = Array.isArray(profile?.collection?.launcher?.items) ? profile.collection.launcher.items : [];
      $('profileCollectionCount').textContent = `${ids.length} 件展示室收藏`;
      for (const id of ids) {
        const item = summaries.find(entry => entry?.id === id) || safeCatalog().find(entry => entry.id === id);
        textCollection(grid, item?.name || id, TYPE_LABEL[item?.type] || '展示室收藏');
      }
      if (!ids.length) emptyCollection('尚未收藏展示室佈置或音樂。');
      return;
    }
    if (category === 'board') {
      const ids = Array.isArray(board.artworkIds) ? board.artworkIds : [];
      const entries = Array.isArray(board.artworkEntries) ? board.artworkEntries : [];
      $('profileCollectionCount').textContent = `${fmt(board.artworks)} / ${fmt(board.artworkTotal)} 件航海圖鑑`;
      if (entries.length) for (const item of entries.slice(0, 60)) {
        textCollection(grid, String(item.title || item.id || '航海插畫').slice(0, 65),
          `${String(item.group || '新世界航海錄').slice(0, 30)} · ${String(item.variantLabel || '').slice(0, 20)}`);
      }
      else if (ids.length) for (const id of ids.slice(0, 60)) textCollection(grid, String(id).slice(0, 65), '新世界航海錄圖鑑');
      else emptyCollection('尚無雲端航海圖鑑紀錄。完成圖鑑收集後會顯示在這裡。');
      return;
    }
    $('profileCollectionCount').textContent = '戰棋收藏';
    emptyCollection('霸海戰棋目前尚無獨立收藏系統；你在商店取得的頭像仍可用於共用帳號。');
  }
  function stopBgm(resetTime = true) {
    bgmPlayRequest++;
    bgmPlayPending = false; bgmState = 'idle';
    const audio = $('profileBgmAudio');
    audio.pause();
    try { if (resetTime) audio.currentTime = 0; } catch { /* The source may still be loading. */ }
    renderMusicControls();
  }
  function clearBgm() {
    stopBgm(); bgmSource = ''; bgmPlaylist = []; bgmIndex = 0; bgmAutoplayBlocked = false; bgmPausedByUser = false;
    bgmSaveRequest++; bgmPickerBusy = false; $('profileBgmPicker').hidden = true;
    $('profileBgmSave').disabled = false; $('profileBgmCancel').disabled = false;
    const audio = $('profileBgmAudio'); audio.removeAttribute('src'); audio.load();
    $('profileBgmName').textContent = '尚未設定個人頁音樂';
    renderMusicControls();
  }
  function musicVisible() {
    return accountId > 0 && !preview && profile && document.body.dataset.stage === 'app' && !$('profilePanel').hidden && !document.hidden;
  }
  function renderMusicControls() {
    const audio = $('profileBgmAudio'), quiet = bgmListener.muted || bgmListener.volume === 0;
    audio.volume = bgmListener.volume; audio.muted = bgmListener.muted;
    $('profileBgmToggle').disabled = !bgmSource;
    $('profileBgmNext').disabled = bgmPlaylist.length < 2;
    $('profileBgmToggle').textContent = bgmPlayPending ? '取消播放' : !audio.paused ? '暫停音樂' : '播放音樂';
    $('profileBgmMute').textContent = quiet ? '取消靜音' : '靜音';
    $('profileBgmMute').setAttribute('aria-pressed', String(quiet));
    $('profileBgmVolume').value = String(Math.round(bgmListener.volume * 100));
    $('profileBgmVolumeValue').textContent = `${Math.round(bgmListener.volume * 100)}%`;
    $('profileBgmHint').textContent = !bgmSource ? '選擇已購歌曲後，進入時會自動播放。' : bgmAutoplayBlocked ? '系統限制了自動播放，按「播放音樂」即可開始。' : bgmState === 'error' ? '音樂暫時無法播放，可按播放重試或下一首。' : bgmPausedByUser ? '音樂已暫停；下次進入個人頁時會自動播放。' : quiet ? '目前已靜音；音量設定只影響你聽到的聲音。' : bgmPlayPending ? '正在載入個人頁音樂…' : bgmPlaylist.length > 1 ? `依序輪播 ${bgmPlaylist.length} 首；離開個人頁時停止。` : '進入時自動播放；離開個人頁時停止。';
  }
  function saveMusicListener() {
    try { localStorage.setItem(BGM_LISTENER_KEY, JSON.stringify(bgmListener)); } catch { /* Playback also works without persistent browser storage. */ }
    renderMusicControls();
  }
  async function playBgm(automatic = false) {
    const audio = $('profileBgmAudio');
    if (!bgmSource || !musicVisible() || bgmPlayPending || (automatic && (bgmPausedByUser || bgmAutoplayBlocked)) || !audio.paused) return;
    const requestId = ++bgmPlayRequest, source = bgmSource;
    bgmPlayPending = true; bgmState = 'loading'; renderMusicControls();
    try {
      await audio.play();
      // A superseded play promise must never pause a newer owner's song.
      if (requestId !== bgmPlayRequest || source !== bgmSource) return;
      if (!musicVisible()) { stopBgm(); return; }
      bgmPlayPending = false; bgmAutoplayBlocked = false; bgmState = 'playing'; renderMusicControls();
    } catch (error) {
      if (requestId !== bgmPlayRequest || source !== bgmSource) return;
      bgmPlayPending = false;
      bgmAutoplayBlocked = error?.name === 'NotAllowedError';
      bgmState = bgmAutoplayBlocked ? 'blocked' : 'error'; renderMusicControls();
    }
  }
  function slotPlacement(placement, slot) {
    const defaults = { header: { x: 50, y: 12 }, side: { x: 12, y: 54 }, footer: { x: 50, y: 86 } }[slot];
    const value = placement?.[slot] || {};
    return { x: clamp(value.x, 5, 95, defaults.x), y: clamp(value.y, 5, 95, defaults.y), scale: clamp(value.scale, .5, 1.5, 1) };
  }
  function setBgmTrack(index) {
    const audio = $('profileBgmAudio');
    bgmIndex = index;
    bgmSource = bgmPlaylist[index]?.src || '';
    audio.loop = bgmPlaylist.length === 1;
    if (bgmSource) audio.src = bgmSource;
    else audio.removeAttribute('src');
    audio.load();
    const track = bgmPlaylist[index];
    $('profileBgmName').textContent = track
      ? `${track.name}${bgmPlaylist.length > 1 ? `（${index + 1} / ${bgmPlaylist.length}）` : ''}`
      : '尚未設定個人頁音樂';
    renderMusicControls();
  }
  function nextBgm(automatic = false) {
    if (bgmPlaylist.length < 2 || !musicVisible()) return;
    stopBgm();
    setBgmTrack((bgmIndex + 1) % bgmPlaylist.length);
    if (!automatic) { bgmPausedByUser = false; bgmAutoplayBlocked = false; }
    playBgm(automatic);
  }
  function renderMusic() {
    const appearance = profile?.appearance || {};
    const items = profile?.appearanceItems || {};
    const ids = Array.isArray(appearance.bgmIds) ? appearance.bgmIds : [appearance.bgmId];
    const available = Array.isArray(items.bgms) ? items.bgms : [items.bgm];
    const nextPlaylist = [...new Set(ids)].map(id => available.find(item => item?.id === id))
      .filter(item => item && safeAudioAsset(item.asset))
      .map(item => ({ id: item.id, name: String(item.name || '個人頁音樂').slice(0, 60), src: safeAudioAsset(item.asset) }));
    if (nextPlaylist.length !== bgmPlaylist.length || nextPlaylist.some((item, index) => item.id !== bgmPlaylist[index].id || item.src !== bgmPlaylist[index].src)) {
      stopBgm(); bgmPlaylist = nextPlaylist; bgmAutoplayBlocked = false;
      setBgmTrack(0);
    }
    $('profileBgmChoose').hidden = !profile?.isSelf || !accountId || preview;
    $('profileBgmChoose').disabled = !Array.isArray(profile?.collection?.launcher?.bgms) || !profile.collection.launcher.bgms.length;
    if ($('profileBgmChoose').hidden) $('profileBgmPicker').hidden = true;
    renderMusicControls();
    if (bgmSource && bgmState !== 'error') playBgm(true);
  }
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let guestbookPaused = false, guestbookReading = motionPreference.matches, guestbookObserver;
  let stationery = [], stationeryRequest = 0, selectedStationery = 'comment-style-default', postRequestId = '', commentMutation = 0;
  function noteAsset(entry) { return safeImageAsset(entry?.style?.asset); }
  function paintNote(node, asset) {
    node.classList.toggle('has-note-art', Boolean(asset));
    node.dataset.noteStyle = asset ? asset.split('/').pop().replace(/\.webp$/, '') : 'default';
    node.style.setProperty('--note-art', asset ? `url("${asset}")` : 'none');
  }
  function syncGuestbookMotion() {
    const stage = $('profileGuestbookStage');
    stage.dataset.paused = String(guestbookPaused || document.hidden || !profileVisible || $('profileCommentReadDialog').open || $('shopItemPreviewDialog')?.open);
    stage.dataset.reading = String(guestbookReading);
    $('profileGuestbookMotion').textContent = guestbookPaused ? '繼續彈幕' : '暫停彈幕';
    $('profileGuestbookMotion').setAttribute('aria-pressed', String(guestbookPaused));
    $('profileGuestbookMotion').disabled = guestbookReading;
    $('profileGuestbookRead').textContent = guestbookReading ? '返回彈幕' : '閱讀模式';
    $('profileGuestbookRead').setAttribute('aria-pressed', String(guestbookReading));
  }
  function showComment(entry) {
    const holder=$('profileCommentReadBody'); holder.replaceChildren(makeComment(entry,true));
    $('profileCommentReadDialog').showModal(); syncGuestbookMotion();
  }
  function makeComment(entry, full=false) {
    const card=el('article','captain-guestbook-entry'); card.dataset.commentId=String(entry.id);
    paintNote(card,noteAsset(entry));
    const header=el('header'), avatar=el('img'); avatar.alt=''; avatar.src=imageFor('avatar',entry.authorAvatar)||imageFor('avatar',8); avatarFallback(avatar);
    header.append(avatar,el('strong','',String(entry.authorName||'航海者').slice(0,40)));
    const when=new Date(entry.createdAt||entry.created_at||0);
    if(full&&Number.isFinite(when.getTime())){const time=el('time','',when.toLocaleString('zh-TW'));time.dateTime=when.toISOString();header.append(time);}
    card.append(header,el('p','',String(entry.body||'').slice(0,280)));
    if(full){
      const authorId=number(entry.authorUserId??entry.authorId??entry.userId);
      if(profile?.isSelf||authorId===accountId){const remove=el('button','','刪除留言');remove.type='button';remove.onclick=()=>{pendingCommentDelete=entry.id;$('profileCommentDeleteHint').textContent='';$('profileCommentDeleteDialog').showModal();};card.append(remove);}
    }else{
      card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`${String(entry.authorName||'航海者').slice(0,40)}：${String(entry.body||'').slice(0,80)}，點開閱讀`);
      card.onclick=()=>showComment(entry);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showComment(entry);}};
    }
    return card;
  }
  function renderStationery() {
    const select=$('profileCommentStyle');select.replaceChildren();
    const base=el('option','','航海素紙');base.value='comment-style-default';select.append(base);
    for(const item of stationery){const option=el('option','',item.name);option.value=item.id;select.append(option);}
    if(![...select.options].some(o=>o.value===selectedStationery))selectedStationery='comment-style-default';
    select.value=selectedStationery;paintNote($('profileCommentPreview'),safeImageAsset(stationery.find(s=>s.id===selectedStationery)?.asset));
  }
  async function loadStationery() {
    const request=++stationeryRequest,owner=accountId;if(!owner||preview)return;
    try{const result=await refreshShop();if(request!==stationeryRequest||owner!==accountId||!result?.ok)return;
      const owned=new Set(result.shop?.owned?.commentStyles||[]);stationery=(result.shop?.catalog||[]).filter(i=>i.type==='comment_style'&&owned.has(i.id)&&safeImageAsset(i.asset));
      selectedStationery=result.shop?.equipped?.commentStyleId||'comment-style-default';renderStationery();
    }catch{if(request===stationeryRequest)renderStationery();}
  }
  function renderGuestbook() {
    const enabled = profile?.guestbookUnlocked === true || profile?.guestbook?.enabled === true;
    $('profileGuestbookCount').textContent = enabled ? `${fmt(profile?.guestbook?.commentCount ?? comments?.length ?? 0)} 則留言` : '';
    $('profileGuestbookLocked').hidden = !profile || enabled;
    $('profileGuestbookForm').hidden = !profile || !enabled || !accountId || preview;
    $('profileGuestbookMore').hidden = !enabled || !commentHasMore;
    const list=$('profileGuestbookList');list.replaceChildren();guestbookObserver?.disconnect();
    const stage=$('profileGuestbookStage');stage.hidden=!profile||!enabled;
    stage.previousElementSibling.hidden=!profile||!enabled;
    const theme=profile?.appearanceItems?.guestbookStyle,background=safeImageAsset(theme?.asset);
    stage.style.setProperty('--board-art',background?`url("${background}")`:'none');
    $('profileGuestbookPreview').hidden=!background;
    $('profileGuestbookPreview').onclick=()=>{if(background)showItemPreview({...theme,type:'guestbook_style'});};
    $('profileGuestbookTheme').textContent=theme?.name||'航海留言';
    syncGuestbookMotion();renderStationery();
    if(!profile||!enabled)return;
    if(!Array.isArray(comments)||!comments.length){list.append(el('p','captain-guestbook-empty',Array.isArray(comments)?'下一段航程，從一句問候開始。':'正在讀取好友留言…'));return;}
    const laneCount=()=>Math.min(3,comments.length,Math.max(1,Math.floor(((stage.clientWidth||1200)*9/16-32)/178)));
    const rows=guestbookReading?1:laneCount();const lanes=[];
    for(let i=0;i<rows;i++){
      const lane=el('div','captain-danmaku-lane'),track=el('div','captain-danmaku-track'),sequence=el('div','captain-danmaku-sequence');
      for(let n=i;n<comments.length;n+=rows)sequence.append(makeComment(comments[n]));
      const duplicate=sequence.cloneNode(true);duplicate.classList.add('is-duplicate');duplicate.setAttribute('aria-hidden','true');
      // Visual copies open the same persisted comment, but have no extra tab stops.
      for(const card of duplicate.children){card.tabIndex=-1;card.removeAttribute('role');card.removeAttribute('aria-label');const entry=comments.find(c=>String(c.id)===card.dataset.commentId);card.onclick=()=>showComment(entry);}
      track.append(sequence,duplicate);lane.append(track);list.append(lane);lanes.push({track,sequence});
    }
    const measure=()=>{if(!guestbookReading&&stage.clientWidth&&laneCount()!==rows){renderGuestbook();return;}for(let i=0;i<lanes.length;i++){const {track,sequence}=lanes[i];const width=Math.max(stage.clientWidth,sequence.scrollWidth);track.style.setProperty('--lap',width+'px');track.style.setProperty('--duration',(width/(i===1?31:37))+'s');track.style.setProperty('--offset',(-i*2)+'s');}};
    guestbookObserver=new ResizeObserver(measure);guestbookObserver.observe(stage);measure();
  }

  function renderProfile() { renderHero(); renderMusic(); window.LauncherRoom?.setProfile(profile, { accountId, preview }); renderGames(); renderCollectionTabs(); renderCollection(); renderGuestbook(); }
  function renderCardAvatarOptions() {
    const select = $('profileCardAvatar'); select.replaceChildren();
    const following = el('option', '', `沿用目前頭像 #${number(profile?.avatar) || 8}`); following.value = '0'; select.append(following);
    const ownedAvatars = new Set([
      ...validIds(profile?.collection?.card?.avatars, MAX_AVATAR_ID),
      ...validIds(shop?.owned?.avatars, MAX_AVATAR_ID)
    ]);
    for (let id = 1; id <= MAX_AVATAR_ID; id++) {
      if (id > 30 && !ownedAvatars.has(id)) continue;
      const item = shop?.catalog?.find(entry => entry?.type === 'avatar' && Number(entry.key) === id);
      const option = el('option', '', `${item?.name || `頭像 #${id}`}${id <= 30 ? ' · 免費' : ''}`);
      option.value = String(id); select.append(option);
    }
    const selected = Number(profile?.card?.avatarId);
    select.value = Number.isInteger(selected) && selected >= 1 && selected <= MAX_AVATAR_ID && (selected <= 30 || ownedAvatars.has(selected)) ? String(selected) : '0';
  }
  function renderCardDecorControls() {
    const root = $('profileCardDecorControls'); root.replaceChildren();
    const items = profile?.appearanceItems?.decorations || {};
    const equipped = SLOTS.filter(([slot]) => items[slot]?.id && items[slot].id === profile?.appearance?.decorations?.[slot]);
    root.hidden = !equipped.length;
    if (!equipped.length) return;
    root.append(el('strong', '', '名片貼紙位置'));
    const group = el('div', 'captain-decor-controls');
    for (const [slot, label] of equipped) {
      const current = slotPlacement(profile?.appearance?.decorationPlacement, slot);
      const card = el('div', 'captain-decor-slot'); card.dataset.slot = slot;
      card.append(el('strong', '', `${label} · ${items[slot].name || '貼紙'}`));
      for (const [field, title, min, max, step] of [['x', '左右', 5, 95, 1], ['y', '上下', 5, 95, 1], ['scale', '大小', .5, 1.5, .05]]) {
        const row = el('label');
        const input = el('input'); input.type = 'range'; input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(current[field]); input.dataset.field = field; input.disabled = cardBusy || decorBusy;
        const value = el('output', '', field === 'scale' ? `${Math.round(current[field] * 100)}%` : `${Math.round(current[field])}%`);
        input.oninput = () => {
          value.textContent = field === 'scale' ? `${Math.round(Number(input.value) * 100)}%` : `${Math.round(Number(input.value))}%`;
          const sticker = $('profileHeroStickers').querySelector(`[data-slot="${slot}"]`);
          if (sticker) {
            if (field === 'x') sticker.style.left = `${input.value}%`;
            if (field === 'y') sticker.style.top = `${input.value}%`;
            if (field === 'scale') sticker.style.setProperty('--scale', input.value);
          }
        };
        row.append(el('span', '', title), input, value); card.append(row);
      }
      const save = el('button', '', '儲存貼紙位置'); save.type = 'button'; save.disabled = cardBusy || decorBusy;
      save.onclick = () => saveCardDecorPlacement(slot, card);
      card.append(save); group.append(card);
    }
    root.append(group);
  }
  async function saveCardDecorPlacement(slot, card) {
    if (cardBusy || decorBusy || !profile?.isSelf || !accountId || preview || viewUserId || $('profileCardEditor').hidden) return;
    const fields = Object.fromEntries([...card.querySelectorAll('input[data-field]')].map(input => [input.dataset.field, Number(input.value)]));
    const placement = { x: clamp(fields.x, 5, 95, 50), y: clamp(fields.y, 5, 95, 50), scale: clamp(fields.scale, .5, 1.5, 1) };
    const ownerId = accountId, userId = number(profile.userId), mutation = cardMutation;
    const current = () => mutation === cardMutation && accountId === ownerId && number(profile?.userId) === userId && profile?.isSelf === true && !viewUserId;
    profileRequest++;
    decorBusy = true; $('profileCardSave').disabled = true; $('profileCardCancel').disabled = true; renderCardDecorControls(); status('profileCardStatus', '正在儲存貼紙位置…');
    try {
      const result = await api.saveLauncherDecorationPlacement(slot, placement);
      if (!current()) return;
      if (!result?.ok || !result.profile) { renderHero(); status('profileCardStatus', errorText(result?.error), true); return; }
      profile = result.profile; if (result.shop) acceptShopSnapshot(result.shop);
      renderProfile(); status('profileCardStatus', '貼紙位置已儲存。');
    } catch { if (current()) { renderHero(); status('profileCardStatus', errorText('offline'), true); } }
    finally { if (current()) { decorBusy = false; $('profileCardSave').disabled = false; $('profileCardCancel').disabled = false; renderCardDecorControls(); } }
  }
  function closeCardEditor() {
    cardMutation++;
    cardBusy = false;
    decorBusy = false;
    $('profileCardEditor').hidden = true;
    $('profileCardSave').disabled = false;
    $('profileCardCancel').disabled = false;
    status('profileCardStatus', '');
    renderHero();
  }
  function openCardEditor() {
    if (!profile?.isSelf || !accountId || preview) return;
    renderCardAvatarOptions();
    $('profileCardName').value = cardDisplayName(profile);
    $('profileCardTagline').value = cardTagline(profile);
    renderCardDecorControls();
    status('profileCardStatus', '');
    $('profileCardEditor').hidden = false;
    $('profileCardName').focus();
  }
  async function saveCard(event) {
    event.preventDefault();
    if (cardBusy || decorBusy || !profile?.isSelf || !accountId || preview || viewUserId) return;
    const displayName = $('profileCardName').value.trim();
    const tagline = $('profileCardTagline').value.trim();
    const avatarId = Number($('profileCardAvatar').value);
    if (!displayName || displayName.length > 32 || tagline.length > 120 || !Number.isInteger(avatarId) || avatarId < 0 || avatarId > MAX_AVATAR_ID) {
      status('profileCardStatus', '請填入 1–32 字名稱、最多 120 字簡介，並選擇頭像。', true); return;
    }
    const ownerId = accountId;
    const userId = number(profile.userId);
    const viewId = viewUserId;
    const mutation = ++cardMutation;
    profileRequest++;
    cardBusy = true;
    $('profileCardSave').disabled = true;
    $('profileCardCancel').disabled = true;
    renderCardDecorControls();
    status('profileCardStatus', '正在儲存名片…');
    const current = () => mutation === cardMutation && accountId === ownerId && viewUserId === viewId && number(profile?.userId) === userId && profile?.isSelf === true;
    try {
      const result = await (avatarId > 62 ? profileCommand('card.set', {card:{displayName,tagline,avatarId}}) : api.saveLauncherCard({ displayName, tagline, avatarId }));
      if (!current()) return;
      if (!result?.ok || !result.profile) { status('profileCardStatus', errorText(result?.error), true); return; }
      profile = result.profile;
      if (result.shop) acceptShopSnapshot(result.shop);
      $('profileCardEditor').hidden = true;
      renderProfile();
      status('profileStatus', '名片已儲存。');
    } catch { if (current()) status('profileCardStatus', errorText('offline'), true); }
    finally {
      if (mutation === cardMutation) { cardBusy = false; $('profileCardSave').disabled = false; $('profileCardCancel').disabled = false; if (!$('profileCardEditor').hidden) renderCardDecorControls(); }
    }
  }
  async function loadProfile() {
    const requestId = ++profileRequest;
    commentRequest++; comments = null; commentNextBeforeId = 0; commentHasMore = false;
    if (!accountId || preview) {
      profile = null; renderProfile();
      status('profileStatus', preview ? '設計預覽不連線；登入後會讀取真實雲端紀錄。' : '請先登入帳號。');
      return;
    }
    status('profileStatus', '正在讀取雲端個人頁…');
    try {
      const result = await api.getLauncherProfile(viewUserId);
      if (requestId !== profileRequest) return;
      if (!result?.ok || !result.profile) { profile = null; renderProfile(); status('profileStatus', errorText(result?.error), true); return; }
      profile = result.profile; renderProfile(); status('profileStatus', '');
      if (roomEditorRequested && profile.isSelf) { roomEditorRequested = false; window.LauncherRoom?.openEditor(); }
      loadComments(); loadStationery();
    } catch {
      if (requestId === profileRequest) { profile = null; renderProfile(); status('profileStatus', errorText('offline'), true); }
    }
  }
  async function loadComments(more = false) {
    if (more && !commentHasMore) return;
    const requestId = ++commentRequest;
    if (!profile || !(profile.guestbookUnlocked === true || profile.guestbook?.enabled === true) || !accountId || preview) {
      comments = null; renderGuestbook(); status('profileGuestbookStatus', ''); return;
    }
    status('profileGuestbookStatus', '正在讀取留言…');
    try {
      const result = await api.getLauncherComments(viewUserId, more ? commentNextBeforeId : 0);
      if (requestId !== commentRequest) return;
      if (!result?.ok) { if (!more) comments = []; renderGuestbook(); status('profileGuestbookStatus', errorText(result?.error), true); return; }
      const page = Array.isArray(result.comments) ? result.comments : [];
      comments = more ? [...(comments || []), ...page.filter(item => !(comments || []).some(existing => existing.id === item.id))] : page;
      commentHasMore = result.hasMore === true;
      commentNextBeforeId = Number.isSafeInteger(Number(result.nextBeforeId)) ? Number(result.nextBeforeId) : 0;
      if (result.enabled === false) profile.guestbookUnlocked = false;
      renderGuestbook(); status('profileGuestbookStatus', '');
    } catch {
      if (requestId === commentRequest) { comments = []; renderGuestbook(); status('profileGuestbookStatus', errorText('offline'), true); }
    }
  }
  async function postComment(event) {
    event.preventDefault();
    const body = $('profileGuestbookInput').value.trim();
    if (commentBusy || !profile || !body || body.length > 240) return;
    const owner=accountId,target=viewUserId,mutation=++commentMutation;
    commentBusy = true; $('profileGuestbookPost').disabled = true; $('profileGuestbookInput').disabled=true; $('profileCommentStyle').disabled=true; status('profileGuestbookStatus', '正在發表留言…');
    try {
      if(!postRequestId)postRequestId=crypto.randomUUID();
      const result = await profileCommand('comment.post', {userId:viewUserId,body,styleId:selectedStationery},postRequestId);
      if(owner!==accountId||target!==viewUserId||mutation!==commentMutation)return;
      if (!result?.ok) { status('profileGuestbookStatus', errorText(result?.error), true); return; }
      postRequestId='';
      $('profileGuestbookInput').value = ''; $('profileGuestbookLength').textContent = '0 / 240';
      await loadProfile();
      if(owner===accountId&&target===viewUserId&&mutation===commentMutation)status('profileGuestbookStatus', '留言已發表。');
    } catch { if(owner===accountId&&target===viewUserId&&mutation===commentMutation)status('profileGuestbookStatus', errorText('offline'), true); }
    finally { if(mutation===commentMutation){commentBusy = false; $('profileGuestbookPost').disabled = false; $('profileGuestbookInput').disabled=false; $('profileCommentStyle').disabled=false;} }
  }
  async function deleteComment() {
    if (!pendingCommentDelete || commentBusy) return;
    const owner=accountId,target=viewUserId,mutation=++commentMutation,messageId=pendingCommentDelete;
    commentBusy = true; $('profileCommentDeleteConfirm').disabled = true; $('profileCommentDeleteHint').textContent = '正在刪除留言…';
    try {
      const result = await api.deleteLauncherComment(messageId);
      if(owner!==accountId||target!==viewUserId||mutation!==commentMutation)return;
      if (!result?.ok) { $('profileCommentDeleteHint').textContent = errorText(result?.error); return; }
      $('profileCommentDeleteDialog').close(); $('profileCommentReadDialog').close(); pendingCommentDelete = null;
      await loadProfile(); if(owner===accountId&&target===viewUserId&&mutation===commentMutation)status('profileGuestbookStatus', '留言已刪除。');
    } catch { if(owner===accountId&&target===viewUserId&&mutation===commentMutation)$('profileCommentDeleteHint').textContent = errorText('offline'); }
    finally { if(mutation===commentMutation){commentBusy = false; $('profileCommentDeleteConfirm').disabled = false;} }
  }
  async function toggleBgm() {
    const audio = $('profileBgmAudio');
    if (!bgmSource) return;
    if (bgmPlayPending || !audio.paused) { bgmPausedByUser = true; stopBgm(false); return; }
    bgmPausedByUser = false; bgmAutoplayBlocked = false; await playBgm();
  }
  function openBgmPicker() {
    if (!profile?.isSelf || !accountId || preview || bgmPickerBusy) return;
    const picker = $('profileBgmPicker');
    if (!picker.hidden) { picker.hidden = true; return; }
    const list = $('profileBgmPickerList'); list.replaceChildren();
    const selected = new Set(Array.isArray(profile.appearance?.bgmIds) ? profile.appearance.bgmIds : [profile.appearance?.bgmId]);
    const ownedSongs = Array.isArray(profile.collection?.launcher?.bgms) ? profile.collection.launcher.bgms : [];
    for (const song of ownedSongs) {
      if (!song || !safeAudioAsset(song.asset)) continue;
      const label = el('label'); const check = el('input');
      check.type = 'checkbox'; check.value = song.id; check.checked = selected.has(song.id);
      label.append(check, el('span', '', String(song.name || song.id).slice(0, 60)));
      list.append(label);
    }
    status('profileBgmPickerStatus', list.childElementCount ? '未勾選任何歌曲會關閉個人頁音樂。' : '尚未購買可播放的音樂。');
    picker.hidden = false;
  }
  async function saveBgmPicker() {
    if (bgmPickerBusy || !profile?.isSelf || !accountId || preview || $('profileBgmPicker').hidden) return;
    const checked = [...$('profileBgmPickerList').querySelectorAll('input:checked')].map(input => input.value);
    const prior = Array.isArray(profile.appearance?.bgmIds) ? profile.appearance.bgmIds : [profile.appearance?.bgmId];
    const bgmIds = [...new Set([...prior.filter(id => checked.includes(id)), ...checked])];
    const owner = accountId, request = ++bgmSaveRequest;
    profileRequest++;
    bgmPickerBusy = true; $('profileBgmSave').disabled = true; $('profileBgmCancel').disabled = true;
    status('profileBgmPickerStatus', '正在儲存播放清單…');
    try {
      const result = await api.saveLauncherBgmPlaylist(bgmIds);
      if (request !== bgmSaveRequest || owner !== accountId || !profile?.isSelf || viewUserId) return;
      if (!result?.ok || !result.profile) { status('profileBgmPickerStatus', errorText(result?.error), true); return; }
      profile = result.profile;
      if (result.shop) acceptShopSnapshot(result.shop);
      $('profileBgmPicker').hidden = true;
      renderProfile();
      status('profileStatus', bgmIds.length ? `已儲存 ${bgmIds.length} 首個人頁音樂。` : '已停用個人頁音樂。');
    } catch { if (request === bgmSaveRequest && owner === accountId) status('profileBgmPickerStatus', errorText('offline'), true); }
    finally {
      if (request === bgmSaveRequest) { bgmPickerBusy = false; $('profileBgmSave').disabled = false; $('profileBgmCancel').disabled = false; }
    }
  }
  function safeCatalog() {
    return (Array.isArray(shop?.catalog) ? shop.catalog : []).filter(item =>
      item && TYPE_LABEL[item.type] && typeof item.id === 'string' && /^[a-z0-9-]{3,64}$/.test(item.id) &&
      Number.isSafeInteger(Number(item.price)) && Number(item.price) >= 0 &&
      (['avatar', 'wall', 'flag'].includes(item.type) ? !!imageFor(item.type, item.key) :
        ['background', 'frame', 'guestbook_style', 'comment_style'].includes(item.type) ? !!safeImageAsset(item.asset) :
        item.type === 'decoration' ? !!safeImageAsset(item.asset) && SLOTS.some(([slot]) => slot === item.slot) :
        item.type === 'bgm' ? !!safeAudioAsset(item.asset) :
        item.type === 'layout' ? ['layout-grand-line', 'layout-bounty-board', 'layout-captain-quarters', 'layout-sunny-deck', 'layout-sunny-kitchen', 'layout-sunny-library'].includes(item.id) :
        ROOM_TYPES.includes(item.type) ? !!safeImageAsset(item.asset) :
        item.id === 'guestbook-1'));
  }
  function owned(item) {
    if (item.type === 'guestbook') return shop?.owned?.guestbook === true;
    if (ROOM_TYPES.includes(item.type)) {
      const field = { room_scene: 'roomScenes', room_furniture: 'roomFurniture', room_character: 'roomCharacters' }[item.type];
      return Array.isArray(shop?.owned?.[field]) && shop.owned[field].includes(item.id);
    }
    if (['background', 'frame', 'layout', 'decoration', 'bgm', 'guestbook_style', 'comment_style'].includes(item.type)) {
      const field = { background: 'backgrounds', frame: 'frames', layout: 'layouts', decoration: 'decorations', bgm: 'bgms', guestbook_style: 'guestbookStyles', comment_style: 'commentStyles' }[item.type];
      return Array.isArray(shop?.owned?.[field]) && shop.owned[field].includes(item.id);
    }
    const field = item.type === 'avatar' ? 'avatars' : item.type === 'wall' ? 'walls' : 'flags';
    return validIds(shop?.owned?.[field], item.type === 'avatar' ? MAX_AVATAR_ID : item.type === 'wall' ? 8 : 15).includes(Number(item.key));
  }
  function equipped(item) {
    if (item.type === 'guestbook') return owned(item);
    if (ROOM_TYPES.includes(item.type)) return false;
    if (item.type === 'guestbook_style') return shop?.equipped?.guestbookStyleId === item.id;
    if (item.type === 'comment_style') return shop?.equipped?.commentStyleId === item.id;
    if (item.type === 'background') return shop?.equipped?.backgroundId === item.id;
    if (item.type === 'frame') return shop?.equipped?.frameId === item.id;
    if (item.type === 'layout') return shop?.equipped?.layoutId === item.id;
    if (item.type === 'bgm') {
      const selected = shop?.equipped?.bgmIds;
      return Array.isArray(selected) ? selected.includes(item.id) : shop?.equipped?.bgmId === item.id;
    }
    if (item.type === 'decoration') return shop?.equipped?.decorations?.[item.slot] === item.id;
    const field = item.type === 'avatar' ? 'avatar' : item.type === 'wall' ? 'wall' : 'flag';
    return Number(shop?.equipped?.[field]) === Number(item.key);
  }
  function renderShopReset() {
    const actions = $('shopResetActions'); actions.replaceChildren();
    if (!shop || shop.preview) return;
    const choices = shopTab === 'background' ? [['background-default', '恢復原始背景']] :
      shopTab === 'frame' ? [['frame-none', '移除相框']] :
      shopTab === 'layout' ? [['layout-default', '恢復原始排版']] :
      shopTab === 'guestbook_style' ? [['guestbook-style-default', '使用原始留言板']] :
      shopTab === 'comment_style' ? [['comment-style-default', '使用素紙留言']] :
      shopTab === 'bgm' ? [['bgm-none', '停用個人頁音樂']] :
      shopTab === 'decoration' ? SLOTS.map(([slot, label]) => [`decor-none-${slot}`, `移除${label}貼紙`]) : [];
    for (const [id, label] of choices) {
      const button = el('button', '', label); button.type = 'button'; button.disabled = shopBusy || !shopOnline;
      button.onclick = () => equipById(id, label); actions.append(button);
    }
  }
  function renderShopTabs() {
    const tabs = $('shopCategoryTabs'); tabs.replaceChildren();
    for (const [id, label] of SHOP_TABS) {
      const button = el('button', '', label); button.type = 'button'; button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(id === shopTab));
      button.onclick = () => { if (id !== shopTab) stopShopPreview(); shopTab = id; renderShopTabs(); renderShop(); };
      tabs.append(button);
    }
  }
  function updateShopPreviewButtons() {
    for (const button of document.querySelectorAll('#shopGrid .shop-preview-button, #shopItemPreviewActions .shop-preview-button')) {
      const active = button.dataset.previewId === shopPreviewId;
      button.textContent = active ? shopPreviewPending ? '載入中…按此取消' : '停止試聽' : '♫ 試聽 30 秒';
      button.setAttribute('aria-pressed', String(active));
    }
  }
  function stopShopPreview() {
    shopPreviewRequest++;
    shopPreviewId = '';
    shopPreviewPending = false;
    shopPreviewAudio.pause();
    shopPreviewAudio.removeAttribute('src');
    shopPreviewAudio.load();
    updateShopPreviewButtons();
  }
  async function toggleShopPreview(item) {
    const source = safeAudioAsset(item?.asset);
    if (!source || $('shopPanel').hidden || document.hidden) return;
    if (shopPreviewId === item.id) { stopShopPreview(); return; }
    stopShopPreview();
    const request = ++shopPreviewRequest;
    shopPreviewId = item.id;
    shopPreviewPending = true;
    shopPreviewAudio.src = source;
    updateShopPreviewButtons();
    try {
      await shopPreviewAudio.play();
      if (request !== shopPreviewRequest) return;
      shopPreviewPending = false;
      updateShopPreviewButtons();
    } catch {
      if (request !== shopPreviewRequest) return;
      stopShopPreview();
      status('shopStatus', '這首音樂目前無法試聽，請稍後再試。', true);
    }
  }
  shopPreviewAudio.ontimeupdate = () => { if (shopPreviewId && shopPreviewAudio.currentTime >= 30) stopShopPreview(); };
  shopPreviewAudio.onended = stopShopPreview;
  shopPreviewAudio.onerror = () => {
    if (!shopPreviewId) return;
    stopShopPreview();
    status('shopStatus', '這首音樂目前無法試聽，請稍後再試。', true);
  };
  let previewedItem = null, previewPanel = '';
  function closeItemPreview() {
    if (previewedItem?.type === 'bgm') stopShopPreview();
    $('shopItemPreviewDialog').close();
  }
  function showItemPreview(item) {
    if (!item) return;
    stopShopPreview();
    previewedItem = item;
    previewPanel = profileVisible ? 'profile' : 'shop';
    const dialog=$('shopItemPreviewDialog'), stage=$('shopItemPreviewStage'), actions=$('shopItemPreviewActions');
    dialog.dataset.type=item.type; dialog.dataset.itemId=item.id||'';
    $('shopItemPreviewName').textContent=String(item.name||'商品預覽').slice(0,80);
    $('shopItemPreviewMeta').textContent=TYPE_LABEL[item.type]||'商品預覽';
    stage.replaceChildren(); actions.replaceChildren();
    const source=itemImage(item);
    if(source){
      const image=el('img','shop-large-preview-image'); image.alt=String(item.name||'商品圖片').slice(0,80);
      image.onload=()=>{image.style.maxWidth=image.naturalWidth+'px';image.style.maxHeight=image.naturalHeight+'px';};
      image.onerror=()=>{image.hidden=true;stage.append(el('p','shop-preview-message','圖片暫時無法載入，請關閉後重試。'));};
      if(item.type==='room_character'&&item.key==='luffy'&&window.OnePieceRoomMotion?.LUFFY_ART_ENABLED===true){
        const failure=image.onerror;image.onerror=()=>{image.onerror=failure;image.src='opui://launcher/images/launcher_room/portrait_v3/luffy.webp';};
      }
      image.src=source;stage.append(image);
    }else if(item.type==='layout'){
      const sample=el('div','captain-hero shop-layout-sample'); sample.dataset.layout=item.id;
      const body=el('div','captain-hero-body'),avatar=el('span','captain-hero-avatar'),image=el('img');image.src=imageFor('avatar',8);image.alt='排版示意頭像';avatar.append(image);
      const copy=el('div','captain-hero-copy');copy.append(el('p','eyebrow','CAPTAIN'),el('h3','','你的航海名片'),el('p','','下一段冒險，從這裡開始。'),el('small','','排版示意'));
      body.append(avatar,copy);sample.append(el('div','captain-hero-art'),body);stage.append(sample);
    }else if(item.type==='bgm'){
      const music=el('div','shop-preview-feature');music.append(el('span','shop-symbol','♫'),el('strong','',String(item.name||'個人頁音樂').slice(0,80)));stage.append(music);
      const play=el('button','shop-preview-button','♫ 試聽 30 秒');play.type='button';play.dataset.previewId=item.id;play.onclick=()=>toggleShopPreview(item);actions.append(play);
    }else{
      const sample=el('div','shop-preview-feature shop-unlock-sample'),paper=el('div','captain-guestbook-entry');
      paper.append(el('header','','好友航海者'),el('p','','來坐一下，留下今天的航海回憶！'));
      sample.append(paper,el('strong','','開放好友留言'),el('p','','解鎖留言功能；主題板面與留言紙可另外選購。'));stage.append(sample);
    }
    updateShopPreviewButtons();
    if(!dialog.open)dialog.showModal();
    syncGuestbookMotion();
  }
  function renderShop() {
    const wallet = number(shop?.wallet?.coins);
    $('shopWallet').textContent = shop && !shop.preview ? fmt(wallet) : '—';
    $('shopWalletMeta').textContent = shop && !shop.preview
      ? shopOnline ? `每日補給 +${fmt(shop.wallet?.dailyGrant)}，上限 ${fmt(shop.wallet?.cap)}` : '上次同步餘額'
      : accountId && !preview ? shopSync ? '正在核對餘額' : '連線後核對餘額' : '登入後查看每日補給';
    const list = safeCatalog().filter(item => item.type === shopTab);
    $('shopItemCount').textContent = shop ? `${list.length} 件商品` : '';
    renderShopReset();
    if ($('shopConfirmDialog').open) $('shopConfirmBuy').disabled=shopBusy||!shopOnline;
    const grid = $('shopGrid'), cards = [];
    if (!list.length) { grid.replaceChildren(el('p', 'voyage-collection-empty', shop ? '此分類目前沒有商品。' : '請先登入帳號。')); return; }
    for (const [index, item] of list.entries()) {
      const source = itemImage(item);
      const stamp = JSON.stringify([item.name,item.type,item.rarity,item.slot,source]);
      let card = shopCards.get(item.id);
      if (!card || card.stamp !== stamp) {
      const article = el('article', 'shop-item'); article.dataset.rarity = item.rarity || 'common'; article.dataset.type = item.type; article.dataset.itemId = item.id;
      card = {article,stamp,item};
      const visual = el('button', 'shop-item-image');visual.type='button';visual.setAttribute('aria-label',`預覽「${String(item.name||item.id).slice(0,80)}」`);visual.title='點開大圖預覽';visual.onclick=()=>showItemPreview(card.item);
      if (source) { const image = el('img'); portraitFallback(image, item); image.alt = ''; image.loading=index<12?'eager':'lazy'; image.decoding='async'; if (item.type === 'avatar') avatarFallback(image); image.src = source; visual.append(image); }
      else if (item.type === 'layout') { const miniature = el('div', 'shop-layout-preview'); miniature.dataset.layout = item.id; miniature.append(el('i'), el('span', '', 'CAPTAIN')); visual.append(miniature); }
      else visual.append(el('span', 'shop-symbol', item.type === 'bgm' ? '♫' : '✒'));
      visual.append(el('span','shop-image-preview-label','放大預覽'));
      article.onclick=event=>{if(!event.target.closest('button'))showItemPreview(card.item);};
      const body = el('div', 'shop-item-body');
      body.append(el('small', '', `${RARITY[item.rarity] || '普通'} · ${TYPE_LABEL[item.type]}${item.slot ? ` · ${SLOTS.find(([slot]) => slot === item.slot)?.[1] || ''}` : ''}`), el('strong', '', String(item.name || item.id).slice(0, 80)));
      if (item.type === 'bgm') {
        const previewButton = el('button', 'shop-preview-button', '♫ 試聽 30 秒');
        previewButton.type = 'button';
        previewButton.dataset.previewId = item.id;
        previewButton.setAttribute('aria-label', `試聽「${String(item.name || item.id).slice(0, 80)}」30 秒`);
        previewButton.onclick = () => toggleShopPreview(card.item);
        body.append(previewButton);
      }
      const bottom = el('div', 'shop-item-bottom');
      card.label=el('span');card.button=el('button');card.button.type='button';
      card.button.onclick = () => {
        if (!shopOnline || shopBusy || shop?.preview) return;
        const selected=card.item;
        if (owned(selected) && ROOM_TYPES.includes(selected.type)) { roomEditorRequested = true; window.LauncherProfileShop?.openProfile(0); }
        else if (owned(selected)) equip(selected);
        else confirmPurchase(selected);
      };
      bottom.append(card.label,card.button);body.append(bottom);article.append(visual,body);
      shopCards.set(item.id,card);
      }
      card.item=item;
      const isOwned = owned(item), isEquipped = equipped(item);
      card.label.textContent = isOwned ? item.type === 'guestbook' ? '已解鎖' : '已收藏' : `${fmt(item.price)} 金幣`;
      card.button.textContent = preview ? '登入後購買' : !shopOnline ? shopSync ? '核對中…' : '連線後購買' : isEquipped ? item.type === 'guestbook' ? '已開放' : item.type === 'bgm' ? '清單中' : '使用中' : isOwned ? ROOM_TYPES.includes(item.type) ? '佈置' : item.type === 'bgm' ? '單曲套用' : '套用' : wallet < number(item.price) ? '金幣不足' : '購買';
      card.button.disabled = shopBusy || !shopOnline || shop?.preview || isEquipped || (!isOwned && wallet < number(item.price));
      cards.push(card.article);
    }
    // Keep decoded local images and focused controls across wallet updates/reopens.
    if (grid.children.length !== cards.length || cards.some((card,index)=>grid.children[index]!==card)) grid.replaceChildren(...cards);
    updateShopPreviewButtons();
  }
  function localShop() { return {catalog:LOCAL_SHOP_CATALOG,preview:true,wallet:null,owned:{},equipped:{}}; }
  function acceptShopSnapshot(next) {
    shopRequest++; shop=next; shopFetchedAt=Date.now(); shopOnline=true;
  }
  function showAnnouncementProduct() {
    if (!announcementShopItem) return;
      const announcedItem = announcementShopItem ? safeCatalog().find(item => item.id === announcementShopItem) : null;
      if (announcedItem && SHOP_TABS.some(([id]) => id === announcedItem.type)) shopTab = announcedItem.type;
      renderShopTabs(); renderShop();
      if (announcementShopItem) {
        const article = [...$('shopGrid').querySelectorAll('[data-item-id]')].find(node => node.dataset.itemId === announcementShopItem);
        if (article) { article.tabIndex = -1; article.classList.add('is-announcement-target'); article.scrollIntoView({ block: 'center' }); article.focus({ preventScroll: true }); status('shopStatus', `公告商品：${String(announcedItem.name || announcedItem.id).slice(0, 80)}`); }
        else if (!shopOnline) return;
        else status('shopStatus', '這件公告商品目前尚未開放，或需要更新啟動器後查看。');
        announcementShopItem = '';
      }
  }
  function refreshShop() {
    if (!accountId && !preview) return Promise.resolve({ok:false,error:'not authenticated'});
    if (shopSync) return shopSync;
    if (shopOnline && (shopBusy || Date.now()-shopFetchedAt<SHOP_FRESH_MS)) return Promise.resolve({ok:true,shop});
    const requestId=++shopRequest,owner=accountId,previewMode=preview,walletVersion=shopWalletVersion;
    shopOnline=false;
    let pending;
    pending=Promise.resolve().then(()=>api.getLauncherShop(previewMode?{preview:true}:undefined)).then(result=>{
      if(requestId!==shopRequest||owner!==accountId||previewMode!==preview)return {ok:false,error:'stale'};
      if(!result?.ok||!result.shop){
        if(['not authenticated','bad secret'].includes(result?.error))shop=localShop();
        status('shopStatus','商品圖片可先預覽；'+errorText(result?.error),true);return result||{ok:false,error:'offline'};
      }
      if(walletVersion!==shopWalletVersion&&shopWalletUpdate&&!result.shop.preview)result.shop={...result.shop,wallet:{...result.shop.wallet,...shopWalletUpdate}};
      acceptShopSnapshot(result.shop);
      status('shopStatus',preview?'設計預覽可查看商品；登入後才能使用金幣購買。':'');
      showAnnouncementProduct();return result;
    }).catch(()=>{
      if(requestId===shopRequest&&owner===accountId)status('shopStatus','目前離線，仍可預覽商品；連線後可購買。',true);
      return {ok:false,error:'offline'};
    }).finally(()=>{
      if(shopSync===pending){shopSync=null;renderShop();}
    });
    shopSync=pending;
    status('shopStatus',preview?'':'商品已就緒，正在核對餘額與收藏…');renderShop();
    return pending;
  }
  function loadShop() {
    stopShopPreview();
    if(!accountId&&!preview){shop=null;renderShopTabs();renderShop();status('shopStatus','請先登入帳號。');return;}
    if(!shop)shop=localShop();
    renderShopTabs();renderShop();showAnnouncementProduct();
    return refreshShop();
  }
  function confirmPurchase(item) {
    if (!shop || !shopOnline || shop.preview || shopBusy || owned(item)) return;
    pendingPurchase = item;
    $('shopConfirmName').textContent = String(item.name || item.id).slice(0, 80);
    $('shopConfirmCopy').textContent = `確定花費 ${fmt(item.price)} 金幣收藏這件商品？`;
    const source = itemImage(item);
    $('shopConfirmDialog').dataset.type = item.type;
    $('shopConfirmImage').hidden = !source;
    if (source) { portraitFallback($('shopConfirmImage'), item); $('shopConfirmImage').src = source; }
    else $('shopConfirmImage').removeAttribute('src');
    $('shopConfirmPrice').textContent = `${fmt(item.price)} 金幣`;
    $('shopConfirmHint').textContent = '購買後會儲存在雲端帳號。';
    $('shopConfirmBuy').disabled = false;
    $('shopConfirmDialog').showModal();
  }
  async function buy() {
    const item = pendingPurchase;
    if (!item || shopBusy || !shopOnline || !accountId || preview) return;
    const owner = accountId;
    const mutation = ++shopMutation;
    shopBusy = true; $('shopConfirmBuy').disabled = true; $('shopConfirmHint').textContent = '正在確認購買…';
    try {
      const result = await (extendedItem(item.id) ? profileCommand('shop.buy', {itemId:item.id}) : api.buyLauncherItem(item.id));
      if (owner !== accountId || mutation !== shopMutation || !accountId || preview) return;
      if (!result?.ok || !result.shop) { $('shopConfirmHint').textContent = result?.error === 'timeout' ? '結果尚未確認。請關閉後重新整理商店，避免重複購買。' : errorText(result?.error); return; }
      shopRequest++;
      acceptShopSnapshot(result.shop); void loadStationery(); publishAccountAvatar(result.profile); $('shopConfirmDialog').close(); renderShop();
      const purchasedName = String(item.name || item.id).slice(0, 80);
      status('shopStatus', result.roomPlacementDeferred
        ? `已收藏「${purchasedName}」。房間最多同時放 10 位夥伴；請到佈置模式替換角色。`
        : `已收藏「${purchasedName}」。`);
      if (profile?.isSelf && result.profile?.userId === owner) {
        profileRequest++; profile = result.profile; renderProfile();
      }
      window.LauncherRoom?.onPurchase?.(result, item.id);
    } catch { if (owner === accountId && mutation === shopMutation) $('shopConfirmHint').textContent = errorText('offline'); }
    finally {
      if (owner === accountId && mutation === shopMutation) {
        shopBusy = false; $('shopConfirmBuy').disabled = false; renderShop();
      }
    }
  }
  async function equip(item) {
    if (shopBusy || !owned(item) || item.type === 'guestbook' || ROOM_TYPES.includes(item.type)) return;
    return equipById(item.id, String(item.name || item.id).slice(0, 80));
  }
  async function equipById(itemId, label) {
    if (shopBusy || !shopOnline || !shop || shop.preview) return;
    const owner=accountId,mutation=++shopMutation;
    shopBusy = true; renderShop(); status('shopStatus', '正在套用裝扮…');
    try {
      const result = await (extendedItem(itemId) ? profileCommand('shop.equip', {itemId}) : api.equipLauncherItem(itemId));
      if(owner!==accountId||mutation!==shopMutation||!accountId||preview)return;
      if (!result?.ok || !result.shop) { status('shopStatus', errorText(result?.error), true); return; }
      acceptShopSnapshot(result.shop); void loadStationery(); publishAccountAvatar(result.profile); status('shopStatus', `已套用「${label}」。`);
      if (profile?.isSelf) loadProfile();
    } catch { if(owner===accountId&&mutation===shopMutation)status('shopStatus', errorText('offline'), true); }
    finally { if(owner===accountId&&mutation===shopMutation){shopBusy = false; renderShop();} }
  }

  $('profileRefresh').onclick = loadProfile;
  $('profileBackToFriends').onclick = () => window.launcherSwitchPanel?.('social');
  $('profileCardEdit').onclick = openCardEditor;
  $('profileCardCancel').onclick = closeCardEditor;
  $('profileCardEditor').onsubmit = saveCard;
  $('profileCardAvatar').onchange = () => {
    const id = number($('profileCardAvatar').value) || number(profile?.avatar) || 8;
    $('profileHeroAvatar').src = imageFor('avatar', id) || imageFor('avatar', 8);
  };
  $('profileBgmToggle').onclick = toggleBgm;
  $('profileBgmNext').onclick = () => nextBgm(false);
  $('profileBgmChoose').onclick = openBgmPicker;
  $('profileBgmCancel').onclick = () => { if (!bgmPickerBusy) $('profileBgmPicker').hidden = true; };
  $('profileBgmSave').onclick = saveBgmPicker;
  $('profileBgmMute').onclick = () => {
    if (bgmListener.muted || bgmListener.volume === 0) { bgmListener.muted = false; if (bgmListener.volume === 0) bgmListener.volume = .35; }
    else bgmListener.muted = true;
    saveMusicListener();
    if (!bgmPausedByUser && bgmAutoplayBlocked) { bgmAutoplayBlocked = false; playBgm(); }
  };
  $('profileBgmVolume').oninput = () => { bgmListener.volume = clamp(Number($('profileBgmVolume').value) / 100, 0, 1, .35); saveMusicListener(); };
  $('profileBgmAudio').onended = () => { if (bgmPlaylist.length > 1) nextBgm(true); else stopBgm(); };
  $('profileGuestbookForm').onsubmit = postComment;
  $('profileGuestbookInput').oninput = () => { postRequestId=''; $('profileGuestbookLength').textContent = `${$('profileGuestbookInput').value.length} / 240`; };
  $('profileCommentStyle').onchange=()=>{selectedStationery=$('profileCommentStyle').value;postRequestId='';renderStationery();};
  $('profileGuestbookMotion').onclick=()=>{guestbookPaused=!guestbookPaused;syncGuestbookMotion();};
  $('profileGuestbookRead').onclick=()=>{guestbookReading=!guestbookReading;renderGuestbook();};
  $('profileCommentReadClose').onclick=()=>$('profileCommentReadDialog').close();
  $('profileCommentReadDialog').addEventListener('close',syncGuestbookMotion);
  motionPreference.addEventListener('change',e=>{guestbookReading=e.matches;renderGuestbook();});
  $('profileGuestbookMore').onclick = () => loadComments(true);
  $('profileCommentDeleteCancel').onclick = () => $('profileCommentDeleteDialog').close();
  $('profileCommentDeleteConfirm').onclick = deleteComment;
  $('profileCommentDeleteDialog').addEventListener('close', () => { pendingCommentDelete = null; });
  $('shopConfirmClose').onclick = () => $('shopConfirmDialog').close();
  $('shopConfirmCancel').onclick = () => $('shopConfirmDialog').close();
  $('shopConfirmBuy').onclick = buy;
  $('shopConfirmDialog').addEventListener('close', () => { pendingPurchase = null; });
  $('shopConfirmDialog').addEventListener('click', event => { if (event.target === $('shopConfirmDialog')) $('shopConfirmDialog').close(); });
  $('shopItemPreviewClose').onclick=closeItemPreview;
  $('shopItemPreviewDialog').addEventListener('cancel',()=>{if(previewedItem?.type==='bgm')stopShopPreview();});
  $('shopItemPreviewDialog').addEventListener('close',()=>{if($('shopItemPreviewDialog').open)return;if(previewedItem?.type==='bgm')stopShopPreview();previewedItem=null;syncGuestbookMotion();});
  $('shopItemPreviewDialog').addEventListener('click',event=>{const box=$('shopItemPreviewDialog').getBoundingClientRect();if(event.target===$('shopItemPreviewDialog')&&(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom))closeItemPreview();});
  window.LauncherProfileShop = {
    setAccount(snapshot) {
      const id = snapshot?.authenticated && !snapshot.profile?.needsDisplayName ? number(snapshot.profile?.userId) : 0;
      const isPreview = snapshot?.previewMode === true;
      if (id === accountId && isPreview === preview) return;
      closeItemPreview();
      stopShopPreview();
      clearBgm(); profileVisible = false;
      shopMutation++; shopBusy = false;
      cardMutation++; cardBusy = false; decorBusy = false; $('profileCardEditor').hidden = true; $('profileCardSave').disabled = false; $('profileCardCancel').disabled = false;
      accountId = id; preview = isPreview; window.LauncherProfileAvatar=null;
      const avatarVersion=++accountAvatarVersion;
      if(id&&!isPreview)void api.getLauncherProfile(0).then(r=>{if(accountId===id&&accountAvatarVersion===avatarVersion&&r?.ok)publishAccountAvatar(r.profile);}).catch(()=>{}); viewUserId = 0; profile = null; shop = id||isPreview?localShop():null; roomEditorRequested = false;
      shopFetchedAt=0;shopOnline=false;shopSync=null;shopWalletVersion=0;shopWalletUpdate=null;shopCards.clear();
      announcementShopItem = '';
      commentMutation++;commentBusy=false;$('profileGuestbookPost').disabled=false;$('profileGuestbookInput').disabled=false;$('profileCommentStyle').disabled=false;
      stationeryRequest++;stationery=[];selectedStationery='comment-style-default';postRequestId='';guestbookObserver?.disconnect();$('profileCommentReadDialog').close();
      profileRequest++; shopRequest++; commentRequest++; comments = null; commentHasMore = false; commentNextBeforeId = 0; pendingPurchase = null; pendingCommentDelete = null;
      if ($('shopConfirmDialog').open) $('shopConfirmDialog').close();
      if ($('profileCommentDeleteDialog').open) $('profileCommentDeleteDialog').close();
      $('profileCommentDeleteConfirm').disabled=false;
      renderProfile(); renderShopTabs(); renderShop();
      if(id||isPreview)void refreshShop();
    },
    openProfile(userId = 0) {
      closeItemPreview();
      const id = number(userId);
      clearBgm();
      cardMutation++; cardBusy = false; decorBusy = false; $('profileCardEditor').hidden = true; $('profileCardSave').disabled = false; $('profileCardCancel').disabled = false;
      commentMutation++;commentBusy=false;$('profileGuestbookPost').disabled=false;$('profileGuestbookInput').disabled=false;$('profileCommentStyle').disabled=false;
      $('profileCommentDeleteDialog').close();pendingCommentDelete=null;$('profileCommentDeleteConfirm').disabled=false;
      $('profileCommentReadDialog').close();postRequestId='';guestbookObserver?.disconnect();
      viewUserId = id && id !== accountId ? id : 0;
      profile = null; comments = null; profileRequest++; commentRequest++; commentHasMore = false; commentNextBeforeId = 0;
      if (window.launcherSwitchPanel) window.launcherSwitchPanel('profile');
      else loadProfile();
    },
    onVisible(panel) {
      if (previewedItem && panel !== previewPanel) closeItemPreview();
      if (panel !== 'shop') stopShopPreview();
      if (panel !== 'profile') { profileVisible = false; stopBgm(); }
      else if (!profileVisible) { profileVisible = true; bgmPausedByUser = false; bgmAutoplayBlocked = false; }
      syncGuestbookMotion();
      window.LauncherRoom?.onVisible(panel);
      if (panel === 'profile' && !profile) loadProfile();
      else if (panel === 'profile') playBgm(true);
      if (panel === 'shop') loadShop();
    },
    openShopCategory(category) {
      if (!SHOP_TABS.some(([id]) => id === category)) return;
      closeItemPreview();
      if (category !== shopTab) stopShopPreview();
      shopTab = category;
      window.launcherSwitchPanel?.('shop');
      renderShopTabs(); renderShop();
    },
    openShop(itemId) {
      if (typeof itemId !== 'string' || !/^[a-z0-9-]{1,100}$/.test(itemId)) return;
      stopShopPreview();
      announcementShopItem = itemId;
      if (itemId.startsWith('room-character-')) shopTab = 'room_character';
      window.launcherSwitchPanel?.('shop');
    },
    onRoomSaved(nextProfile, nextShop) {
      if (!nextProfile?.isSelf || !profile?.isSelf || nextProfile.userId !== profile.userId) return;
      profile = nextProfile;
      if (nextShop) acceptShopSnapshot(nextShop);
      renderProfile();
    },
    onCompanionWalletChanged(wallet) {
      if (!accountId || !wallet || !Number.isFinite(Number(wallet.coins))) return;
      shopWalletVersion++;shopWalletUpdate={...wallet};
      if (shop && !shop.preview) {
        shop = { ...shop, wallet: { ...shop.wallet, ...wallet } };
        renderShop();
      }
    }
  };
  document.addEventListener('visibilitychange', () => { syncGuestbookMotion(); if (document.hidden) { stopBgm(); stopShopPreview(); } else playBgm(true); });
  renderProfile(); renderShopTabs(); renderShop();
})();
