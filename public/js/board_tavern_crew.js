(function () {
  "use strict";
  const story = "images/board/story/speakers/";
  const art = "images/board/tavern_recruit/crew_v2/";
  const phase = (image, line, motion) => Object.freeze({ image, line, motion });
  const crew = [
    {
      id: "luffy", name: "蒙其・D・魯夫", role: "船長", accent: "#ffb790",
      invite: phase(story + "luffy_reunion_laugh.webp", "你真有趣，要不要加入我們？", "eager"),
      accept: phase(story + "luffy_laugh.webp", "太好了！走吧，一起去冒險！", "jump"),
      decline: phase(story + "luffy_smile.webp", "這樣啊！那下次再一起玩吧！", "easy"),
    },
    {
      id: "zoro", name: "羅羅亞・索隆", role: "戰鬥員", accent: "#b9e4ac",
      invite: phase(story + "zoro_smirk.webp", "有膽量的話，就跟我們走一趟。", "steady"),
      accept: phase(story + "zoro_banquet.webp", "跟上。往後的路，一起闖。", "nod"),
      decline: phase(story + "zoro_calm.webp", "行。走你自己選的路吧。", "settle"),
    },
    {
      id: "nami", name: "娜美", role: "航海士", accent: "#ffc77d",
      invite: phase(art + "nami_invite.webp", "風向不錯，要不要搭上我們這趟航程？", "welcome"),
      accept: phase(art + "nami_accept.webp", "那就說定了！接下來的航線交給我。", "bright"),
      decline: phase(art + "nami_decline.webp", "好吧，祝你找到合適的航線。", "shrug"),
    },
    {
      id: "usopp", name: "騙人布", role: "狙擊手", accent: "#e6d6a6",
      invite: phase(story + "usopp_story.webp", "有本大爺在，這趟冒險肯定精采！你也來吧！", "boast"),
      accept: phase(story + "usopp_brave_sniper.webp", "好！放心，遇到麻煩我、我會想辦法的！", "brave"),
      decline: phase(story + "usopp_brave.webp", "也、也是啦！大冒險總得先準備充分嘛！", "fluster"),
    },
    {
      id: "sanji", name: "香吉士", role: "廚師", accent: "#f0d7a0",
      invite: phase(story + "sanji_cook.webp", "餓了吧？上船一起吃頓好的，怎麼樣？", "offer"),
      accept: phase(art + "sanji_accept.webp", "歡迎上船。你的那份晚餐，我也會準備好。", "bow"),
      decline: phase(story + "sanji_smoke_observe.webp", "沒關係，至少吃飽了再走吧。", "easy"),
    },
    {
      id: "chopper", name: "多尼多尼・喬巴", role: "船醫", accent: "#ffc8db",
      invite: phase(art + "chopper_invite.webp", "要跟我們一起走嗎？受傷了，我會幫你治療！", "eager"),
      accept: phase(art + "chopper_accept.webp", "太好了！我會努力照顧好大家的！", "bounce"),
      decline: phase(story + "chopper_worried.webp", "這樣啊……那你路上要小心，別勉強自己喔。", "concern"),
    },
    {
      id: "robin", name: "妮可・羅賓", role: "考古學家", accent: "#c8b3df",
      invite: phase(story + "robin_reveal.webp", "下一段旅程，或許有你想知道的故事。一起來嗎？", "calm"),
      accept: phase(story + "robin_smile.webp", "歡迎。看來船上又多了一個有趣的故事。", "gentle"),
      decline: phase(story + "robin_poneglyph_focus.webp", "我明白了。每個人都有想前往的地方。", "settle"),
    },
    {
      id: "franky", name: "佛朗基", role: "船匠", accent: "#93e0ea",
      invite: phase(story + "franky_engineer.webp", "想來一趟 SUPER 棒的航海嗎？上我們的船吧！", "power"),
      accept: phase(story + "franky_cry.webp", "SUPER！歡迎登船，這趟一定超級精彩！", "super"),
      decline: phase(story + "franky_proud.webp", "嗚……真可惜！有自己的航向，也很帥啊！", "weep"),
    },
    {
      id: "brook", name: "布魯克", role: "音樂家", accent: "#e7dcc9",
      invite: phase(art + "brook_invite.webp", "願意和我們一起出航嗎？船上正缺一位聽眾呢。", "sway"),
      accept: phase(art + "brook_accept.webp", "喲呵呵呵！歡迎！容我為新夥伴奏上一曲。", "waltz"),
      decline: phase(story + "brook_cry_laugh.webp", "真可惜。那麼，願愉快的旋律陪您上路。", "bow"),
    },
    {
      id: "jinbe", name: "甚平", role: "掌舵手", accent: "#a9d7ee",
      invite: phase(story + "jinbe_smile.webp", "若你願意，便與我們一同走這段航路吧。", "steady"),
      accept: phase(story + "jinbe_resolve.webp", "歡迎。從今往後，便是互相照應的夥伴了。", "resolve"),
      decline: phase(story + "jinbe_solemn.webp", "明白了。人各有志，願你一路平安。", "respect"),
    },
  ].map(Object.freeze);
  const byId = new Map(crew.map(entry => [entry.id, entry]));
  let fallbackSequence = 0;
  function choose() {
    // Cosmetic randomness never consumes the game's recruitment RNG.
    if (window.crypto?.getRandomValues) {
      const buffer = new Uint32Array(1);
      const limit = 0x100000000 - (0x100000000 % crew.length);
      do { window.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
      return crew[buffer[0] % crew.length].id;
    }
    return crew[(Date.now() + fallbackSequence++) % crew.length].id;
  }
  window.BoardTavernCrew = Object.freeze({
    version: "2", crew: Object.freeze(crew), choose,
    get: id => byId.get(id) || crew[0],
  });
})();
