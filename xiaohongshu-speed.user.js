// ==UserScript==
// @name         小红书视频倍速控制器
// @namespace    https://github.com/morrishruangchun/xiaohongshu-speed
// @version      2.0.0
// @description  小红书视频播放倍速控制 + 自动最高画质，鼠标悬停显示，自动隐藏，支持自定义档位，自动记忆上次倍速
// @author       morrishruangchun
// @license      MIT
// @match        https://www.xiaohongshu.com/*
// @homepageURL  https://github.com/morrishruangchun/xiaohongshu-speed
// @supportURL   https://github.com/morrishruangchun/xiaohongshu-speed/issues
// @downloadURL  https://raw.githubusercontent.com/morrishruangchun/xiaohongshu-speed/main/xiaohongshu-speed.user.js
// @updateURL    https://raw.githubusercontent.com/morrishruangchun/xiaohongshu-speed/main/xiaohongshu-speed.user.js
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==


(function () {
  'use strict';

  // ─── 配置 ──────────────────────────────────────────────────────────────────
  const CONFIG = {
    storageKey:  'xhs_speed_v1_val',
    presetsKey:  'xhs_speed_v1_presets',
    hideDelay:   2200,
    checkMs:     600,
    defaultPresets: [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5],
    // 清晰度优先级（从高到低）
    qualityPriority: ['1080', '超清', '高清', '720', '480', '标清'],
  };

  let currentSpeed = parseFloat(localStorage.getItem(CONFIG.storageKey) || '1.0');
  let hideTimer    = null;
  let barInjected  = false;

  // ─── 样式 ──────────────────────────────────────────────────────────────────
  GM_addStyle(`
    /* ── 浮层条 ─────────────────────────────────────────── */
    #xhs-speed-bar {
      position: absolute;
      top: 0; left: 0;
      width: 100%;
      min-height: 44px;
      display: flex;
      align-items: center;
      padding: 0 10px;
      gap: 5px;
      z-index: 999999;
      box-sizing: border-box;
      background: linear-gradient(to bottom, rgba(0,0,0,.55) 0%, transparent 100%);
      opacity: 0;
      pointer-events: none;
      transition: opacity .28s ease;
      flex-wrap: nowrap;
    }
    #xhs-speed-bar.xhs-show {
      opacity: 1;
      pointer-events: auto;
    }

    /* ── 倍速按钮 ────────────────────────────────────────── */
    .xhs-sp-btn {
      height: 26px;
      min-width: 44px;
      padding: 0 7px;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.35);
      color: #fff;
      font-size: 12px;
      font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
      font-weight: 500;
      border-radius: 5px;
      cursor: pointer;
      outline: none;
      white-space: nowrap;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      transition: background .18s, transform .12s, border-color .18s;
      flex-shrink: 0;
    }
    .xhs-sp-btn:hover {
      background: rgba(255,255,255,.38);
      transform: scale(1.06);
    }
    .xhs-sp-btn.xhs-active {
      background: #ff2442;
      border-color: #ff2442;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(255,36,66,.45);
    }

    /* ── 设置按钮 ────────────────────────────────────────── */
    .xhs-sp-setting {
      min-width: 28px;
      font-size: 14px;
      padding: 0;
      background: rgba(0,0,0,.35);
      border-color: rgba(255,255,255,.2);
      margin-right: 2px;
    }
    .xhs-sp-setting:hover {
      background: rgba(0,0,0,.6);
    }

    /* ── 当前倍速标签 ────────────────────────────────────── */
    #xhs-speed-label {
      font-size: 11.5px;
      font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
      color: rgba(255,255,255,.75);
      margin-left: auto;
      margin-right: 6px;
      white-space: nowrap;
      flex-shrink: 0;
      letter-spacing: .3px;
    }

    /* ── 分隔线 ──────────────────────────────────────────── */
    .xhs-divider {
      width: 1px;
      height: 18px;
      background: rgba(255,255,255,.25);
      flex-shrink: 0;
      margin: 0 3px;
    }

    /* ── 画质按钮（蓝色系区分） ──────────────────────────── */
    .xhs-q-btn {
      height: 26px;
      min-width: 44px;
      padding: 0 7px;
      background: rgba(255,255,255,.18);
      border: 1px solid rgba(255,255,255,.35);
      color: #fff;
      font-size: 12px;
      font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
      font-weight: 500;
      border-radius: 5px;
      cursor: pointer;
      outline: none;
      white-space: nowrap;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      transition: background .18s, transform .12s;
      flex-shrink: 0;
    }
    .xhs-q-btn:hover {
      background: rgba(255,255,255,.38);
      transform: scale(1.06);
    }
    .xhs-q-btn.xhs-active {
      background: #1890ff;
      border-color: #1890ff;
      font-weight: 700;
      box-shadow: 0 2px 8px rgba(24,144,255,.45);
    }
    #xhs-quality-label {
      font-size: 11.5px;
      font-family: 'PingFang SC', 'Helvetica Neue', sans-serif;
      color: rgba(100,180,255,.85);
      white-space: nowrap;
      flex-shrink: 0;
      letter-spacing: .3px;
      margin-right: 4px;
    }
  `);

  // ─── 工具 ──────────────────────────────────────────────────────────────────
  function getPresets() {
    const raw = localStorage.getItem(CONFIG.presetsKey);
    if (!raw) return CONFIG.defaultPresets.slice();
    try {
      const arr = raw.split(',').map(Number).filter(n => !isNaN(n) && n > 0);
      return arr.length ? arr : CONFIG.defaultPresets.slice();
    } catch (_) { return CONFIG.defaultPresets.slice(); }
  }

  function getVideo() {
    // 小红书视频播放器选择器（含弹窗播放器）
    return (
      document.querySelector('.player-container video') ||
      document.querySelector('.xg-video-container video') ||
      document.querySelector('video')
    );
  }

  function getPlayerWrap() {
    // 先找 xgplayer 外壳，再找常见播放器容器
    return (
      document.querySelector('.player-container') ||
      document.querySelector('.xg-video-container') ||
      document.querySelector('[class*="player"]') ||
      document.querySelector('[class*="video-container"]') ||
      null
    );
  }

  // ─── 显示 / 隐藏 ───────────────────────────────────────────────────────────
  function showBar() {
    const bar = document.getElementById('xhs-speed-bar');
    if (!bar) return;
    bar.classList.add('xhs-show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!bar._hovering) bar.classList.remove('xhs-show');
    }, CONFIG.hideDelay);
  }

  // ─── 高亮当前按钮 & 更新标签 ────────────────────────────────────────────────
  function syncUI(speed) {
    document.querySelectorAll('.xhs-sp-btn[data-spd]').forEach(b => {
      b.classList.toggle('xhs-active', Math.abs(parseFloat(b.dataset.spd) - speed) < 0.01);
    });
    const lbl = document.getElementById('xhs-speed-label');
    if (lbl) lbl.textContent = speed === 1 ? '正常速度' : `${speed}x 播放中`;
  }

  // ─── 设置倍速 ──────────────────────────────────────────────────────────────
  function setSpeed(speed) {
    currentSpeed = speed;
    localStorage.setItem(CONFIG.storageKey, speed);
    const v = getVideo();
    if (v) v.playbackRate = speed;
    syncUI(speed);
  }

  // ─── 自定义档位 ────────────────────────────────────────────────────────────
  function openSettings() {
    const cur = getPresets().join(', ');
    const input = prompt(
      '📐 自定义倍速档位\n用英文逗号分隔，例如：0.5, 1, 1.5, 2, 3',
      cur
    );
    if (input === null) return;
    const cleaned = input.split(/[,，\s]+/).map(Number).filter(n => !isNaN(n) && n > 0 && n <= 16);
    if (!cleaned.length) { alert('格式有误，未保存。'); return; }
    localStorage.setItem(CONFIG.presetsKey, cleaned.join(','));
    // 重建 bar
    const bar = document.getElementById('xhs-speed-bar');
    if (bar) bar.remove();
    barInjected = false;
  }

  // ─── 画质控制 ──────────────────────────────────────────────────────────────
  // 小红书播放器使用 xgplayer，清晰度切换通过点击播放器内置菜单实现
  // 策略：找到画质选择 DOM，按优先级列表尝试点击最高档

  let qualityApplied = false;
  let currentQuality = '';

  // 找播放器实例（xgplayer 挂在 window.xgplayer 或 DOM 上）
  function getXgPlayer() {
    // xgplayer 通常把实例挂在播放器容器的 _player 属性
    const wrap = getPlayerWrap();
    if (!wrap) return null;
    return wrap._player || wrap.__xgplayer__ || null;
  }

  // 方案A：通过 xgplayer API 直接切换（最干净）
  function setQualityViaAPI(player) {
    try {
      const definitions = player.definitionList || player.config?.definitionList || [];
      if (!definitions.length) return false;

      // 按优先级匹配
      for (const keyword of CONFIG.qualityPriority) {
        const match = definitions.find(d =>
          String(d.text || d.label || d.name || '').includes(keyword) ||
          String(d.definition || d.value || '').includes(keyword)
        );
        if (match) {
          // 调用切换方法
          if (typeof player.changeDefinition === 'function') {
            player.changeDefinition(match);
            currentQuality = String(match.text || match.label || keyword);
            return true;
          }
          if (typeof player.emit === 'function') {
            player.emit('definition_change', match);
            currentQuality = String(match.text || match.label || keyword);
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  // 方案B：模拟点击播放器内置画质菜单
  function setQualityViaDOM() {
    // 1. 先打开画质设置面板（找设置按钮或画质按钮）
    const settingTriggers = [
      '[class*="definition"]',
      '[class*="quality"]',
      '[class*="clarify"]',
      '[data-index="definition"]',
    ];
    let panel = null;
    for (const sel of settingTriggers) {
      panel = document.querySelector(sel);
      if (panel) break;
    }

    // 2. 找画质列表项（通常是 li 或 div，文字含清晰度名）
    // 小红书 xgplayer 画质菜单选择器
    const menuSelectors = [
      '.xgplayer-definition-item',
      '[class*="definition-item"]',
      '[class*="quality-item"]',
      '[class*="clarify-item"]',
    ];

    let items = [];
    for (const sel of menuSelectors) {
      items = Array.from(document.querySelectorAll(sel));
      if (items.length) break;
    }

    if (!items.length) {
      // 尝试触发一次面板展开，再找
      if (panel) { panel.click(); }
      return false;
    }

    // 按优先级尝试点击
    for (const keyword of CONFIG.qualityPriority) {
      const target = items.find(el => el.textContent.includes(keyword));
      if (target) {
        target.click();
        currentQuality = keyword;
        syncQualityUI();
        return true;
      }
    }

    // 没匹配到优先级，点第一个（最高）
    if (items[0]) {
      items[0].click();
      currentQuality = items[0].textContent.trim();
      syncQualityUI();
      return true;
    }
    return false;
  }

  // 方案C：拦截 XHR/fetch，在响应中找到画质信息后替换（高级，备用）
  // 小红书视频 URL 通常含有清晰度标识，这里通过监听 source 变化来辅助判断

  function trySetHighestQuality() {
    if (qualityApplied) return;

    // 先试 API
    const player = getXgPlayer();
    if (player && setQualityViaAPI(player)) {
      qualityApplied = true;
      syncQualityUI();
      return;
    }

    // 再试 DOM 点击
    if (setQualityViaDOM()) {
      qualityApplied = true;
      return;
    }
  }

  function syncQualityUI() {
    const lbl = document.getElementById('xhs-quality-label');
    if (lbl && currentQuality) lbl.textContent = `🎬 ${currentQuality}`;
    // 高亮对应画质按钮（如果有显示画质按钮的话）
    document.querySelectorAll('.xhs-q-btn').forEach(b => {
      b.classList.toggle('xhs-active', b.dataset.q === currentQuality);
    });
  }

  // 监听 video src 变化 -> 重新尝试设置画质
  function watchVideoSrcChange() {
    const video = getVideo();
    if (!video || video._xhsWatched) return;
    video._xhsWatched = true;

    // 每次 loadedmetadata 都重新尝试（新视频加载）
    video.addEventListener('loadedmetadata', () => {
      qualityApplied = false;
      currentQuality = '';
      setTimeout(trySetHighestQuality, 800);
      setTimeout(trySetHighestQuality, 2000); // 双保险（部分视频加载慢）
    });
  }

  // ─── 注入控制条 ────────────────────────────────────────────────────────────
  function injectBar() {
    if (document.getElementById('xhs-speed-bar')) return;

    const wrap = getPlayerWrap();
    if (!wrap) return;

    // 确保父容器 position 不是 static（以便 absolute 定位生效）
    const cs = getComputedStyle(wrap);
    if (cs.position === 'static') wrap.style.position = 'relative';

    const bar = document.createElement('div');
    bar.id = 'xhs-speed-bar';
    bar._hovering = false;

    bar.addEventListener('mouseenter', () => { bar._hovering = true; showBar(); clearTimeout(hideTimer); });
    bar.addEventListener('mouseleave', () => { bar._hovering = false; showBar(); });

    // 设置按钮
    const settingBtn = document.createElement('button');
    settingBtn.className = 'xhs-sp-btn xhs-sp-setting';
    settingBtn.title = '自定义倍速档位';
    settingBtn.textContent = '⚙';
    settingBtn.onclick = e => { e.stopPropagation(); openSettings(); };
    bar.appendChild(settingBtn);

    // 倍速按钮
    getPresets().forEach(spd => {
      const btn = document.createElement('button');
      btn.className = 'xhs-sp-btn';
      btn.dataset.spd = spd;
      btn.textContent = spd === 1 ? '正常' : `${spd}x`;
      btn.onclick = e => { e.stopPropagation(); setSpeed(spd); };
      bar.appendChild(btn);
    });

    // 当前速度标签
    const lbl = document.createElement('span');
    lbl.id = 'xhs-speed-label';
    bar.appendChild(lbl);

    // 分隔线
    const divider = document.createElement('div');
    divider.className = 'xhs-divider';
    bar.appendChild(divider);

    // 画质标签（实时显示当前画质）
    const qLbl = document.createElement('span');
    qLbl.id = 'xhs-quality-label';
    qLbl.textContent = '🎬 自动最高画质';
    bar.appendChild(qLbl);

    wrap.appendChild(bar);
    barInjected = true;

    syncUI(currentSpeed);

    // 注入后立即尝试设置最高画质
    watchVideoSrcChange();
    setTimeout(trySetHighestQuality, 1000);
    setTimeout(trySetHighestQuality, 2500);

    // 鼠标移动时显示
    wrap.addEventListener('mousemove', showBar);
    // 触摸设备：tap 显示
    wrap.addEventListener('touchstart', showBar, { passive: true });
  }

  // ─── 守护进程 ──────────────────────────────────────────────────────────────
  setInterval(() => {
    const video = getVideo();
    if (!video) { barInjected = false; return; }

    // 确保 bar 存在
    if (!document.getElementById('xhs-speed-bar')) {
      barInjected = false;
      injectBar();
    }

    // 监听新 video 元素（SPA 切换后 video 可能重建）
    watchVideoSrcChange();

    // 若画质未生效，继续尝试
    if (!qualityApplied) trySetHighestQuality();

    // 锁定倍速（防止页面自行重置）
    if (Math.abs(video.playbackRate - currentSpeed) > 0.05) {
      video.playbackRate = currentSpeed;
      syncUI(currentSpeed);
    }
  }, CONFIG.checkMs);

  // ─── SPA 路由监听（小红书是 SPA，URL 切换时重新注入）─────────────────────
  let lastHref = location.href;
  new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      barInjected = false;
      qualityApplied = false;
      currentQuality = '';
      const old = document.getElementById('xhs-speed-bar');
      if (old) old.remove();
      setTimeout(injectBar, 1200);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // 初始注入（等页面稳定）
  setTimeout(injectBar, 1500);
  setTimeout(injectBar, 3000); // 双保险

})();
