const STATE_NAMES = {
  '-1': 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'cued',
};

/**
 * Construit le document qui héberge le lecteur YouTube officiel.
 *
 * Le lecteur reste dans l'application : la page autorise uniquement son propre
 * document, et les commandes passent par une petite API injectée (window.__yt).
 */
export function buildPlayerHtml({ videoId, startSeconds = 0, autoplay = false }) {
  const safeVideoId = JSON.stringify(String(videoId));
  const safeStart = Math.max(0, Math.round(startSeconds));
  const safeAutoplay = autoplay ? 'true' : 'false';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
    * { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
    #player { position: absolute; inset: 0; width: 100%; height: 100%; }
    .overlay {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: rgba(0, 0, 0, 0.5); z-index: 5; border: 0; margin: 0; padding: 0;
      width: 100%; height: 100%; color: #fff; font-family: -apple-system, Roboto, sans-serif;
    }
    .overlay[hidden] { display: none; }
    .play {
      width: 84px; height: 84px; border-radius: 50%; border: 0;
      background: #ff3b30; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
    }
    .play::after {
      content: ''; display: block; margin-left: 6px;
      border-style: solid; border-width: 16px 0 16px 26px;
      border-color: transparent transparent transparent #fff;
    }
    #error { display: none; flex-direction: column; gap: 10px; text-align: center; padding: 24px; }
    #error.visible { display: flex; }
    #error p { margin: 0; font-size: 15px; line-height: 22px; color: #e6eaef; }
    #error small { color: #98a2b0; font-size: 12px; }
  </style>
</head>
<body>
  <div id="player"></div>

  <button id="start" class="overlay" aria-label="Lire la vidéo">
    <span class="play"></span>
  </button>

  <div id="error" class="overlay">
    <p id="errorText">Lecture impossible dans l’application.</p>
    <small>Le propriétaire a peut-être désactivé l’intégration.</small>
  </div>

  <script>
    (function () {
      var VIDEO_ID = ${safeVideoId};
      var START_AT = ${safeStart};
      var AUTOPLAY = ${safeAutoplay};
      var STATE_NAMES = ${JSON.stringify(STATE_NAMES)};
      var player = null;
      var started = false;
      var ticker = null;

      function post(payload) {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        } catch (error) {}
      }

      function hideStart() {
        var start = document.getElementById('start');
        if (start) start.setAttribute('hidden', 'true');
      }

      function stopTicker() {
        if (ticker) { clearInterval(ticker); ticker = null; }
      }

      function startTicker() {
        stopTicker();
        ticker = setInterval(function () {
          if (!player || typeof player.getCurrentTime !== 'function') return;
          post({
            type: 'progress',
            currentTime: player.getCurrentTime() || 0,
            duration: player.getDuration() || 0,
          });
        }, 500);
      }

      function showError(code) {
        var box = document.getElementById('error');
        var text = document.getElementById('errorText');
        if (code === 101 || code === 150) {
          text.textContent = 'Cette vidéo n’autorise pas la lecture intégrée.';
        } else if (code === 100) {
          text.textContent = 'Vidéo introuvable ou supprimée.';
        }
        if (box) box.classList.add('visible');
      }

      window.onYouTubeIframeAPIReady = function () {
        player = new YT.Player('player', {
          videoId: VIDEO_ID,
          playerVars: {
            autoplay: AUTOPLAY ? 1 : 0,
            start: START_AT,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            cc_load_policy: 0,
            fs: 1,
            origin: 'https://www.youtube.com'
          },
          events: {
            onReady: function (event) {
              post({ type: 'ready', duration: event.target.getDuration() || 0 });
              if (AUTOPLAY) { play(); }
            },
            onStateChange: function (event) {
              var name = STATE_NAMES[String(event.data)] || 'unknown';
              post({ type: 'state', state: name });
              if (name === 'playing') {
                started = true;
                hideStart();
                startTicker();
              } else {
                stopTicker();
              }
              if (name === 'ended') hideStart();
            },
            onError: function (event) {
              showError(event.data);
              post({ type: 'error', code: event.data });
            }
          }
        });
      };

      function play() {
        if (!player) return;
        hideStart();
        player.playVideo();
      }

      window.__yt = {
        play: play,
        load: function (id) {
          if (!player || !id) return;
          stopTicker();
          post({ type: 'reset' });
          var start = document.getElementById('start');
          var error = document.getElementById('error');
          if (error) error.classList.remove('visible');
          if (start) start.removeAttribute('hidden');
          if (player.loadVideoById) player.loadVideoById(id);
        },
        pause: function () { if (player) player.pauseVideo(); },
        toggle: function () {
          if (!player) return;
          if (player.getPlayerState && player.getPlayerState() === 1) player.pauseVideo();
          else play();
        },
        seekTo: function (seconds) {
          if (player && typeof player.seekTo === 'function') player.seekTo(Math.max(0, seconds), true);
        },
        seekBy: function (delta) {
          if (!player || typeof player.getCurrentTime !== 'function') return;
          window.__yt.seekTo((player.getCurrentTime() || 0) + delta);
        },
        setRate: function (rate) {
          if (player && player.setPlaybackRate) player.setPlaybackRate(rate);
        },
        state: function () {
          return {
            state: player && player.getPlayerState ? player.getPlayerState() : -1,
            currentTime: player && player.getCurrentTime ? player.getCurrentTime() : 0,
            duration: player && player.getDuration ? player.getDuration() : 0
          };
        }
      };

      document.getElementById('start').addEventListener('click', function () {
        play();
        post({ type: 'started' });
      });

      // Toute navigation sortante est signalée à l'application, qui la refuse.
      document.addEventListener('click', function (event) {
        var link = event.target && event.target.closest ? event.target.closest('a') : null;
        if (link) {
          event.preventDefault();
          event.stopPropagation();
          post({ type: 'exitBlocked', href: link.getAttribute('href') || '' });
        }
      }, true);
    })();
  </script>
  <script src="https://www.youtube.com/iframe_api"></script>
</body>
</html>`;
}
