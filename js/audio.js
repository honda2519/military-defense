
(() => {

    // =====================================
    // 1. BGMの設定
    // =====================================

    const bgm = new Audio('audio/battle-bgm.mp3');

    bgm.loop = true;
    bgm.preload = 'auto';


    // =====================================
    // 2. 音量・音声管理
    // =====================================

    let on = true;

    // BGM音量（初期値35%）
    let vol = 0.35;

    // 効果音音量（初期値70%）
    let seVol = 0.70;

    let ac = null;
    let master = null;
    let sfx = null;


    // =====================================
    // 3. オーディオシステムの初期化
    // =====================================

    function init() {

        if (ac) {

            if (ac.state === 'suspended') {
                ac.resume();
            }

            return;
        }

        const A =
            window.AudioContext ||
            window.webkitAudioContext;

        if (!A) return;

        ac = new A();

        // 全体の音声管理
        master = ac.createGain();

        // 効果音専用の音声管理
        sfx = ac.createGain();

        sfx.connect(master);
        master.connect(ac.destination);

        master.gain.value = on ? 1 : 0;

        // 効果音の初期音量
        sfx.gain.value = seVol;
    }


    // =====================================
    // 4. 効果音を鳴らす処理
    // =====================================

    function tone(f, d, type = 'square', level = 0.12) {

        if (!on) return;

        init();

        if (!ac) return;

        const o = ac.createOscillator();
        const g = ac.createGain();

        const t = ac.currentTime;

        o.type = type;

        o.frequency.setValueAtTime(f, t);

        g.gain.setValueAtTime(0.001, t);

        g.gain.exponentialRampToValueAtTime(
            Math.max(level, 0.002),
            t + 0.012
        );

        g.gain.exponentialRampToValueAtTime(
            0.001,
            t + d
        );

        o.connect(g);
        g.connect(sfx);

        o.start(t);
        o.stop(t + d + 0.02);
    }


    // =====================================
    // 5. BGMの再生・停止
    // =====================================

    function startBgm() {

        if (on) {

            bgm.volume = vol;

            bgm.play().catch(e => {
                console.warn('BGM再生失敗', e);
            });
        }
    }


    function stopBgm() {

        bgm.pause();

        bgm.currentTime = 0;
    }


    // =====================================
    // 6. 音声 ON / OFF
    // =====================================

    function toggle() {

        on = !on;

        init();

        if (master && ac) {

            master.gain.setTargetAtTime(
                on ? 1 : 0,
                ac.currentTime,
                0.025
            );
        }

        if (on) {

            startBgm();

            document.getElementById('soundButton').textContent =
                '🔊 音声 ON';

        } else {

            stopBgm();

            document.getElementById('soundButton').textContent =
                '🔇 音声 OFF';
        }
    }


    // =====================================
    // 7. BGM音量の調節
    // =====================================

    function setVolume(v) {

        vol = Math.max(0, Math.min(1, +v));

        bgm.volume = vol;
    }


    // =====================================
    // 8. 効果音音量の調節
    // =====================================

    function setSeVolume(v) {

        seVol = Math.max(0, Math.min(1, +v));

        // オーディオが初期化済みなら即座に反映
        if (sfx && ac) {

            sfx.gain.setTargetAtTime(
                seVol,
                ac.currentTime,
                0.025
            );
        }
    }


    // =====================================
    // 9. 最初のクリックでBGMを開始
    // =====================================

    document.addEventListener('pointerdown', function first() {

        if (on) {

            init();

            startBgm();
        }

    }, { once: true });


    // =====================================
    // 10. 音声 ON / OFF ボタン
    // =====================================

    document.getElementById('soundButton')
        .addEventListener('click', toggle);


    // =====================================
    // 11. BGM音量スライダー
    // =====================================

    document.getElementById('volumeSlider')
        .addEventListener('input', e => {

            setVolume(e.target.value / 100);

            document.getElementById('volumeValue').textContent =
                e.target.value + '%';
        });


    // =====================================
    // 12. 効果音音量スライダー
    // =====================================

    document.getElementById('seVolumeSlider')
        .addEventListener('input', e => {

            setSeVolume(e.target.value / 100);

            document.getElementById('seVolumeValue').textContent =
                e.target.value + '%';
        });


    // =====================================
    // 13. ゲーム本体から呼び出す効果音
    // =====================================

    window.gameAudio = {

        // タワー設置音
        playTowerPlace() {

            tone(520, 0.09);

            setTimeout(() => {
                tone(780, 0.12);
            }, 80);
        },


        // 攻撃音
        playAttack() {

            tone(180, 0.08, 'sawtooth', 0.09);
        },


        // 敵撃破音
        playEnemyDefeated() {

            tone(660, 0.1, 'triangle');

            setTimeout(() => {
                tone(880, 0.16, 'triangle');
            }, 100);
        }

    };

})();
