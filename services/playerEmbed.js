// Origine de l'application, envoyée à YouTube comme référent.
// Depuis fin 2025, YouTube refuse les intégrations sans en-tête `Referer`
// valide (erreurs 152/153) : une origine neutre est donc obligatoire.
export const APP_ORIGIN = 'https://youtubefilterv2.app';

const BASE_PARAMS = [
  'playsinline=1',
  'rel=0',
  'modestbranding=1',
  'iv_load_policy=3',
  'cc_load_policy=0',
  'fs=1',
  'enablejsapi=1',
  // L'application fournit ses propres contrôles : on masque la barre de
  // lecture YouTube pour ne pas en avoir deux.
  'controls=0',
  'disablekb=1',
  `origin=${encodeURIComponent(APP_ORIGIN)}`,
];

/** Page embed officielle, chargée directement (et non plus dans une iframe locale). */
export function buildEmbedUrl({ videoId, startSeconds = 0, autoplay = false }) {
  const params = [...BASE_PARAMS];
  params.push(`autoplay=${autoplay ? 1 : 0}`);

  const start = Math.max(0, Math.round(startSeconds));
  if (start > 0) params.push(`start=${start}`);

  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.join('&')}`;
}

/**
 * Script injecté dans la page YouTube : il expose `window.__yt` aux commandes
 * de l'application et renvoie l'état/la progression au natif via
 * `ReactNativeWebView.postMessage`.
 *
 * On pilote directement l'objet `movie_player` de la page : pas d'iframe
 * intermédiaire, donc pas de problème d'origine ni de lecteur bridé.
 */
export const PLAYER_BRIDGE_SCRIPT = `
(function () {
  if (window.__ytInstalled) return;
  window.__ytInstalled = true;

  // Habillage : on ne garde que l'image de la vidéo. Titre, partage, cartes,
  // suggestions de fin et contrôles YouTube disparaissent — l'application
  // affiche sa propre barre. Le logo YouTube reste (obligation d'affichage).
  var FOCUS_CSS = [
    '.ytp-chrome-top,.ytp-chrome-bottom,.ytp-gradient-top,.ytp-gradient-bottom{display:none !important}',
    '.ytp-cards-teaser,.ytp-ce-element,.ytp-endscreen-content,.ytp-pause-overlay,.ytp-suggested-action,.ytp-share-button{display:none !important}'
  ].join('');

  function injectStyle() {
    if (document.getElementById('__focus_style')) return;
    var root = document.head || document.documentElement;
    if (!root) return;
    var style = document.createElement('style');
    style.id = '__focus_style';
    style.textContent = FOCUS_CSS;
    root.appendChild(style);
  }

  injectStyle();
  document.addEventListener('DOMContentLoaded', injectStyle);

  var STATES = {
    '-1': 'unstarted',
    '0': 'ended',
    '1': 'playing',
    '2': 'paused',
    '3': 'buffering',
    '5': 'cued'
  };

  var lastState = null;
  var lastDuration = 0;
  var announcedReady = false;
  var announcedError = false;

  function post(payload) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (error) {}
  }

  function player() {
    return document.getElementById('movie_player');
  }

  function call(name, args) {
    var element = player();
    if (element && typeof element[name] === 'function') {
      element[name].apply(element, args || []);
    }
  }

  window.__yt = {
    play: function () {
      call('playVideo');
    },
    pause: function () {
      call('pauseVideo');
    },
    toggle: function () {
      var element = player();
      if (!element || typeof element.getPlayerState !== 'function') return;
      if (element.getPlayerState() === 1) {
        window.__yt.pause();
      } else {
        window.__yt.play();
      }
    },
    seekTo: function (seconds) {
      call('seekTo', [Math.max(0, Number(seconds) || 0), true]);
    },
    seekBy: function (delta) {
      var element = player();
      if (!element || typeof element.getCurrentTime !== 'function') return;
      window.__yt.seekTo((element.getCurrentTime() || 0) + (Number(delta) || 0));
    },
    setRate: function (rate) {
      call('setPlaybackRate', [Number(rate) || 1]);
    },
    load: function (videoId) {
      if (!videoId) return;
      announcedError = false;
      call('loadVideoById', [videoId]);
      window.__yt.play();
    },
    state: function () {
      var element = player();
      if (!element || typeof element.getPlayerState !== 'function') return null;
      return {
        state: element.getPlayerState(),
        currentTime: element.getCurrentTime() || 0,
        duration: element.getDuration() || 0
      };
    }
  };

  function readErrorCode() {
    var box = document.querySelector('.ytp-error');
    if (!box) return null;
    var text = (box.innerText || '') + ' ' + (box.textContent || '');
    var match = text.match(/[0-9]{2,3}/);
    return match ? Number(match[0]) : 150;
  }

  setInterval(function () {
    var element = player();
    if (!element || typeof element.getPlayerState !== 'function') return;

    var state = element.getPlayerState();
    var duration = element.getDuration() || 0;
    var currentTime = element.getCurrentTime() || 0;

    if (state !== lastState) {
      lastState = state;
      post({ type: 'state', state: STATES[String(state)] || 'unknown' });
    }

    post({ type: 'progress', currentTime: currentTime, duration: duration });

    if (!announcedReady && duration > 0) {
      announcedReady = true;
      lastDuration = duration;
      post({ type: 'ready', duration: duration });
    } else if (duration > 0 && Math.abs(duration - lastDuration) > 1) {
      lastDuration = duration;
      post({ type: 'ready', duration: duration });
    }

    var errorCode = readErrorCode();
    if (errorCode && !announcedError) {
      announcedError = true;
      post({ type: 'error', code: errorCode });
    }
  }, 500);
})();
`;
