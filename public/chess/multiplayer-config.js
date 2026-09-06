(function () {
  "use strict";

  // 留空代表前端與 Socket.IO 伺服器部署在同一個網域。
  // 分開部署時只需填入伺服器來源，例如：https://battle-api.example.com
  window.GRAND_LINE_BATTLE_CONFIG = Object.freeze({
    serverOrigin: "",
  });
})();
