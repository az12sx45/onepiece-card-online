(function () {
  "use strict";
  const story = "images/board/story/speakers/";
  const art = "images/board/tavern_recruit/crew_v3/";
  const phase = (image, line, motion) => Object.freeze({ image, line, motion });
  const captain = Object.freeze({
    id: "luffy", name: "蒙其・D・魯夫", role: "船長", accent: "#ffb790",
    invite: phase(story + "luffy_reunion_laugh.webp", "你真有趣，要不要加入我們？", "eager"),
    accept: phase(story + "luffy_laugh.webp", "太好了！走吧，一起去冒險！", "jump"),
    decline: phase(story + "luffy_smile.webp", "這樣啊！那下次再一起玩吧！", "easy"),
  });
  const responders = [
    {
      id: "zoro", name: "羅羅亞・索隆", role: "戰鬥員", accent: "#b9e4ac",
      accept: phase(art + "zoro_accept.webp", "歡迎。先喝一杯吧。", "nod"),
      decline: phase(art + "zoro_decline.webp", "連魯夫都敢拒絕？哼，有膽識。", "settle"),
    },
    {
      id: "nami", name: "娜美", role: "航海士", accent: "#ffc77d",
      accept: phase(art + "nami_accept.webp", "歡迎上船！航線交給我吧。", "bright"),
      decline: phase(art + "nami_decline.webp", "魯夫竟然被拒絕了？好吧，祝你順風。", "shrug"),
    },
    {
      id: "usopp", name: "騙人布", role: "狙擊手", accent: "#e6d6a6",
      accept: phase(art + "usopp_accept.webp", "歡迎！本大爺罩你，放心吧！", "boast"),
      decline: phase(art + "usopp_decline.webp", "欸！連魯夫都拒絕？你膽子真大！", "fluster"),
    },
    {
      id: "sanji", name: "香吉士", role: "廚師", accent: "#f0d7a0",
      accept: phase(art + "sanji_accept.webp", "歡迎。你的那份晚餐，準備好了。", "offer"),
      decline: phase(art + "sanji_decline.webp", "連船長都留不住你？至少吃飽再走。", "offer"),
    },
    {
      id: "chopper", name: "多尼多尼・喬巴", role: "船醫", accent: "#ffc8db",
      accept: phase(art + "chopper_accept.webp", "哇，你加入了！我會好好照顧你的！", "bounce"),
      decline: phase(art + "chopper_decline.webp", "欸，你真的拒絕了？別受傷喔！", "concern"),
    },
    {
      id: "robin", name: "妮可・羅賓", role: "考古學家", accent: "#c8b3df",
      accept: phase(art + "robin_accept.webp", "歡迎。船上又多了一篇新故事。", "gentle"),
      decline: phase(art + "robin_decline.webp", "呵呵，讓魯夫被拒絕，真少見呢。", "settle"),
    },
    {
      id: "franky", name: "佛朗基", role: "船匠", accent: "#93e0ea",
      accept: phase(art + "franky_accept.webp", "SUPER！歡迎登船！", "super"),
      decline: phase(art + "franky_decline.webp", "船長被拒絕啦！嗚，SUPER 可惜！", "weep"),
    },
    {
      id: "brook", name: "布魯克", role: "音樂家", accent: "#e7dcc9",
      accept: phase(art + "brook_accept.webp", "喲呵呵，歡迎！讓我為你奏一曲。", "waltz"),
      decline: phase(art + "brook_decline.webp", "心都碎了……啊，我沒有心臟。", "weep"),
    },
    {
      id: "jinbe", name: "甚平", role: "掌舵手", accent: "#a9d7ee",
      accept: phase(art + "jinbe_accept.webp", "歡迎上船。往後同舟共濟。", "resolve"),
      decline: phase(art + "jinbe_decline.webp", "婉拒船長，倒是有主見。一路順風。", "respect"),
    },
  ].map(Object.freeze);
  const byId = new Map([captain, ...responders].map(entry => [entry.id, entry]));
  let fallbackSequence = 0;
  function chooseResponder(excludedId = "") {
    // Keep cosmetic selection independent of the recruitment draw and its saved RNG state.
    const eligible = responders.filter(entry => entry.id !== excludedId);
    if (window.crypto?.getRandomValues) {
      const buffer = new Uint32Array(1);
      const limit = 0x100000000 - (0x100000000 % eligible.length);
      do { window.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
      return eligible[buffer[0] % eligible.length].id;
    }
    return eligible[(Date.now() + fallbackSequence++) % eligible.length].id;
  }
  window.BoardTavernCrew = Object.freeze({
    version: "3", captain, crew: Object.freeze([captain, ...responders]),
    responders: Object.freeze(responders), chooseResponder,
    get: id => byId.get(id) || captain,
  });
})();
