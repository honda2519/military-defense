
(() => {

    // =========================================
    // 1. ゲーム画面の基本設定
    // =========================================

    const c = document.getElementById('gameCanvas');
    const x = c.getContext('2d');

    const W = 960;
    const H = 600;


    // =========================================
    // 2. 敵の進行ルート
    // =========================================

    const route = [
        [-20, 115],
        [180, 115],
        [180, 270],
        [390, 270],
        [390, 105],
        [625, 105],
        [625, 430],
        [820, 430],
        [820, 285],
        [980, 285]
    ].map(([x, y]) => ({ x, y }));


    // =========================================
    // 3. タワーの種類と性能
    // =========================================

    const D = {

        gun: {
            name: '機関銃',
            cost: 100,
            range: 145,
            damage: 13,
            rate: 0.48,
            color: '#6f9661'
        },

        cannon: {
            name: '砲台',
            cost: 180,
            range: 180,
            damage: 42,
            rate: 1.45,
            color: '#929ba5'
        },

        rocket: {
            name: 'ロケット砲',
            cost: 250,
            range: 220,
            damage: 58,
            rate: 1.9,
            color: '#b65c45'
        },

        sniper: {
            name: '狙撃砲',
            cost: 200,
            range: 270,
            damage: 82,
            rate: 2.1,
            color: '#527fa8'
        }

    };


    // =========================================
    // 4. ゲームの状態を管理する変数
    // =========================================

    let money = 300;
    let lives = 20;
    let wave = 0;
    let kills = 0;

    let kind = 'gun';
    let chosen = null;

    let towers = [];
    let enemies = [];
    let shots = [];
    let fx = [];

    let active = false;
    let left = 0;
    let spawn = 0;
    let last = 0;
    let over = false;


    // =========================================
    // 5. HTML要素の取得とログ表示
    // =========================================

    const el = id => document.getElementById(id);

    function log(s) {

        let p = document.createElement('p');

        p.textContent = '› ' + s;

        el('log').prepend(p);
    }


    // =========================================
    // 6. ステータスの更新
    // =========================================

    function status() {

        el('money').textContent = money;
        el('lives').textContent = lives;
        el('wave').textContent = wave;
        el('kills').textContent = kills;

        el('upgradeButton').disabled =
            !chosen || money < 120;

        el('waveButton').disabled =
            active || over;

        el('waveStatus').textContent =
            active ? '交戦中' : '待機中';
    }


    // =========================================
    // 7. 距離・道路の判定
    // =========================================

    function distance(a, b) {

        return Math.hypot(
            a.x - b.x,
            a.y - b.y
        );
    }


    // 点と線分の距離を計算
    function segdist(px, py, a, b) {

        let dx = b.x - a.x;
        let dy = b.y - a.y;

        let t = Math.max(
            0,
            Math.min(
                1,
                (
                    (px - a.x) * dx +
                    (py - a.y) * dy
                ) / (dx * dx + dy * dy)
            )
        );

        return Math.hypot(
            px - a.x - t * dx,
            py - a.y - t * dy
        );
    }


    // 敵の進行ルート上かどうか
    function road(px, py) {

        return route.slice(0, -1).some((p, i) => {

            return segdist(
                px,
                py,
                p,
                route[i + 1]
            ) < 39;

        });
    }


    // =========================================
    // 8. タワーの設置
    // =========================================

    function place(px, py) {

        // マップの範囲外
        if (
            px < 25 ||
            py < 25 ||
            px > 935 ||
            py > 575
        ) {
            log('そこには設置できません。');
            return;
        }

        // 道路上への設置を禁止
        if (road(px, py)) {

            log('そこには設置できません。');
            return;
        }

        // タワー同士が近すぎる場合
        if (
            towers.some(t =>
                Math.hypot(t.x - px, t.y - py) < 43
            )
        ) {
            log('そこには設置できません。');
            return;
        }

        const d = D[kind];

        // 資金不足
        if (money < d.cost) {

            log('資金が足りません。');
            return;
        }

        // 資金を消費
        money -= d.cost;

        // タワーを追加
        towers.push({

            x: px,
            y: py,

            type: kind,
            angle: 0,
            cool: 0,

            level: 1,

            range: d.range,
            damage: d.damage,
            rate: d.rate

        });

        // 設置音
        window.gameAudio.playTowerPlace();

        log(d.name + 'を設置しました。');

        status();
    }


    // =========================================
    // 9. ウェーブ開始
    // =========================================

    function start() {

        if (active || over) return;

        wave++;

        active = true;

        // 5ウェーブごとにボスが登場
        left = wave % 5 === 0 ? 6 : 9;

        spawn = 0;

        log(
            wave % 5 === 0
                ? 'ボス部隊接近！'
                : '第' + wave + 'ウェーブ接近。'
        );

        status();
    }


    // =========================================
    // 10. タワーの強化
    // =========================================

    function upgrade() {

        if (!chosen || money < 120) return;

        money -= 120;

        chosen.level++;

        chosen.damage = Math.round(
            chosen.damage * 1.45
        );

        chosen.range += 12;

        log(
            D[chosen.type].name +
            'をLv.' +
            chosen.level +
            'に強化。'
        );

        status();
    }


    // =========================================
    // 11. 敵の生成
    // =========================================

    function enemy() {

        // 5ウェーブごとの最後の敵をボスにする
        let boss = wave % 5 === 0 && left === 1;

        let hp = (30 + wave * 13) * (boss ? 8 : 1);

        enemies.push({

            x: route[0].x,
            y: route[0].y,

            i: 0,

            hp: hp,
            max: hp,

            speed: boss ? 30 : 48 + wave * 1.8,

            reward: boss
                ? 100
                : 12 + Math.floor(wave / 2),

            boss: boss

        });

        left--;
    }


    // =========================================
    // 12. ゲームの進行処理
    // =========================================

    function update(dt) {

        // -------------------------------------
        // 敵を出現させる
        // -------------------------------------

        if (active && left > 0) {

            spawn -= dt;

            if (spawn <= 0) {

                enemy();

                spawn = 0.85;
            }
        }


        // -------------------------------------
        // 敵を移動させる
        // -------------------------------------

        for (let e of enemies) {

            let p = route[e.i + 1];

            if (!p) continue;

            let dx = p.x - e.x;
            let dy = p.y - e.y;

            let l = Math.hypot(dx, dy);
            let s = e.speed * dt;

            if (l <= s) {

                e.x = p.x;
                e.y = p.y;

                e.i++;

                // ゴールに到達した場合
                if (e.i >= route.length - 1) {

                    lives -= e.boss ? 5 : 1;

                    e.reached = true;
                }

            } else {

                e.x += dx / l * s;
                e.y += dy / l * s;
            }
        }

        // ゴールに到達した敵を削除
        enemies = enemies.filter(e => !e.reached);


        // -------------------------------------
        // タワーの攻撃処理
        // -------------------------------------

        for (let t of towers) {

            t.cool -= dt;

            if (t.cool <= 0) {

                // 射程内の敵を探す
                let target = enemies
                    .filter(e => distance(t, e) <= t.range)
                    .sort((a, b) => b.i - a.i)[0];

                if (target) {

                    // タワーの向きを敵に合わせる
                    t.angle = Math.atan2(
                        target.y - t.y,
                        target.x - t.x
                    );

                    // 弾を発射
                    shots.push({

                        x: t.x,
                        y: t.y,

                        target: target,

                        damage: t.damage,

                        speed:
                            t.type === 'sniper' ? 650 :
                            t.type === 'rocket' ? 260 :
                            440,

                        type: t.type

                    });

                    // 次の攻撃までの時間
                    t.cool =
                        t.rate /
                        (1 + (t.level - 1) * 0.08);
                }
            }
        }


        // -------------------------------------
        // 弾の移動と命中判定
        // -------------------------------------

        for (let b of shots) {

            if (!enemies.includes(b.target)) {

                b.dead = true;
                continue;
            }

            let dx = b.target.x - b.x;
            let dy = b.target.y - b.y;

            let l = Math.hypot(dx, dy);
            let s = b.speed * dt;

            if (l <= s + 7) {

                // 弾が命中
                let e = b.target;

                e.hp -= b.damage;

                b.dead = true;

                // 命中エフェクト
                fx.push({
                    x: e.x,
                    y: e.y,
                    t: 0.25
                });

                window.gameAudio.playAttack();

                // 敵を撃破した場合
                if (e.hp <= 0) {

                    money += e.reward;

                    kills++;

                    fx.push({
                        x: e.x,
                        y: e.y,
                        t: 0.5
                    });

                    window.gameAudio.playEnemyDefeated();

                    enemies = enemies.filter(v => v !== e);
                }

            } else {

                // 弾を目標に向かって移動
                b.x += dx / l * s;
                b.y += dy / l * s;
            }
        }

        // 消えた弾を削除
        shots = shots.filter(b => !b.dead);


        // -------------------------------------
        // エフェクトの更新
        // -------------------------------------

        for (let f of fx) {

            f.t -= dt;
        }

        fx = fx.filter(f => f.t > 0);


        // -------------------------------------
        // ウェーブクリア判定
        // -------------------------------------

        if (
            active &&
            left === 0 &&
            enemies.length === 0
        ) {

            active = false;

            money += 35 + wave * 3;

            log(
                'ウェーブ' +
                wave +
                '防衛成功。補給物資を獲得。'
            );
        }


        // -------------------------------------
        // ゲームオーバー判定
        // -------------------------------------

        if (lives <= 0) {

            lives = 0;

            active = false;
            over = true;

            log('ゲームオーバー。再読み込みで再挑戦。');
        }

        status();
    }


    // =========================================
    // 13. ゲーム画面の描画
    // =========================================

    function draw() {

        // -------------------------------------
        // 背景
        // -------------------------------------

        x.fillStyle = '#304334';

        x.fillRect(0, 0, W, H);


        // 背景のグリッド
        for (let a = 0; a < W; a += 40) {

            for (let b = 0; b < H; b += 40) {

                x.strokeStyle = 'rgba(180,210,160,.07)';

                x.strokeRect(a, b, 40, 40);
            }
        }


        // -------------------------------------
        // 敵の進行ルート
        // -------------------------------------

        x.beginPath();

        x.moveTo(route[0].x, route[0].y);

        route.slice(1).forEach(p => {

            x.lineTo(p.x, p.y);
        });

        x.lineCap = 'round';
        x.lineJoin = 'round';

        // 道路の外側
        x.strokeStyle = '#17231c';
        x.lineWidth = 86;
        x.stroke();

        // 道路の内側
        x.strokeStyle = '#9c9168';
        x.lineWidth = 70;
        x.stroke();

        // 道路の中央線
        x.setLineDash([16, 16]);

        x.strokeStyle = '#d5c58c';
        x.lineWidth = 2;
        x.stroke();

        x.setLineDash([]);


        // -------------------------------------
        // タワーの描画
        // -------------------------------------

        for (let t of towers) {

            x.save();

            // 選択中タワーの射程範囲
            if (t === chosen) {

                x.beginPath();

                x.arc(
                    t.x,
                    t.y,
                    t.range,
                    0,
                    Math.PI * 2
                );

                x.fillStyle = 'rgba(180,220,120,.09)';
                x.fill();

                x.strokeStyle = '#d8ec9b';

                x.setLineDash([5, 5]);
                x.stroke();
                x.setLineDash([]);
            }

            x.translate(t.x, t.y);

            x.rotate(t.angle);

            // タワーの土台
            x.fillStyle = '#101a15';
            x.fillRect(-19, -19, 38, 38);

            // タワー本体
            x.fillStyle = D[t.type].color;
            x.fillRect(-15, -15, 30, 30);

            x.fillStyle = '#26372c';
            x.fillRect(-10, -10, 20, 20);


            // ---------------------------------
            // タワーごとの武器を描画
            // ---------------------------------

            if (t.type === 'gun') {

                // 機関銃
                x.fillStyle = '#17221b';

                x.fillRect(1, -7, 27, 4);
                x.fillRect(1, 3, 27, 4);

            } else if (t.type === 'cannon') {

                // 砲台
                x.fillStyle = '#202a30';

                x.fillRect(-5, -7, 34, 14);

            } else if (t.type === 'rocket') {

                // ロケット砲
                x.fillStyle = '#252c2a';

                x.fillRect(-2, -11, 23, 6);
                x.fillRect(-2, 5, 23, 6);

            } else {

                // 狙撃砲
                x.fillStyle = '#172c42';

                x.fillRect(0, -2, 36, 4);

                x.fillStyle = '#b7d2e9';

                x.fillRect(31, -2, 6, 4);
            }

            x.restore();

            // タワーのレベル表示
            x.fillStyle = '#fff';

            x.font = '12px sans-serif';

            x.fillText(
                'Lv.' + t.level,
                t.x - 12,
                t.y + 31
            );
        }


        // -------------------------------------
        // 敵の描画
        // -------------------------------------

        for (let e of enemies) {

            x.fillStyle = e.boss
                ? '#9d3939'
                : '#bdc7b7';

            x.beginPath();

            x.arc(
                e.x,
                e.y,
                e.boss ? 14 : 9,
                0,
                Math.PI * 2
            );

            x.fill();

            // HPバーの幅
            let w = e.boss ? 38 : 26;

            // HPバーの背景
            x.fillStyle = '#222';

            x.fillRect(
                e.x - w / 2,
                e.y - 22,
                w,
                4
            );

            // 現在のHP
            x.fillStyle = '#df5148';

            x.fillRect(
                e.x - w / 2,
                e.y - 22,
                w * Math.max(0, e.hp / e.max),
                4
            );
        }


        // -------------------------------------
        // 弾の描画
        // -------------------------------------

        for (let b of shots) {

            x.fillStyle =
                b.type === 'rocket' ? '#ff9a55' :
                b.type === 'sniper' ? '#b9e3ff' :
                '#f5dc8a';

            x.beginPath();

            x.arc(
                b.x,
                b.y,
                b.type === 'rocket' ? 5 : 3,
                0,
                7
            );

            x.fill();
        }


        // -------------------------------------
        // 攻撃エフェクトの描画
        // -------------------------------------

        for (let f of fx) {

            x.globalAlpha = Math.max(0, f.t / 0.5);

            x.strokeStyle = '#ffb45e';

            x.beginPath();

            x.arc(
                f.x,
                f.y,
                (1 - f.t / 0.5) * 25 + 4,
                0,
                7
            );

            x.stroke();

            x.globalAlpha = 1;
        }


        // -------------------------------------
        // ゲームオーバー画面
        // -------------------------------------

        if (over) {

            x.fillStyle = '#000a';

            x.fillRect(0, 0, W, H);

            x.fillStyle = 'white';

            x.textAlign = 'center';

            x.font = 'bold 48px sans-serif';

            x.fillText(
                'GAME OVER',
                480,
                300
            );

            x.textAlign = 'left';
        }
    }


    // =========================================
    // 14. ゲームループ
    // =========================================

    function frame(ts) {

        let dt = Math.min(
            (ts - last) / 1000 || 0,
            0.04
        );

        last = ts;

        update(dt);

        draw();

        requestAnimationFrame(frame);
    }


    // =========================================
    // 15. マップのクリック処理
    // =========================================

    c.addEventListener('click', e => {

        const r = c.getBoundingClientRect();

        // 画面サイズに合わせて座標を変換
        let px = (e.clientX - r.left) * W / r.width;
        let py = (e.clientY - r.top) * H / r.height;

        // クリックした位置にタワーがあるか確認
        let t = [...towers]
            .reverse()
            .find(v =>
                Math.hypot(v.x - px, v.y - py) < 20
            );

        if (t) {

            // タワーを選択
            chosen = t;

            el('message').textContent =
                D[t.type].name + 'を選択中';

            status();

        } else {

            // タワーがなければ設置を試みる
            chosen = null;

            place(px, py);
        }
    });


    // =========================================
    // 16. 兵器選択ボタン
    // =========================================

    document.querySelectorAll('.choice').forEach(b => {

        b.addEventListener('click', () => {

            kind = b.dataset.type;

            chosen = null;

            // 選択中のボタン表示を切り替える
            document.querySelectorAll('.choice').forEach(v => {

                v.classList.toggle(
                    'selected',
                    v === b
                );
            });

            el('message').textContent =
                D[kind].name + 'を選択中';

            status();
        });
    });


    // =========================================
    // 17. 各種ボタンのイベント設定
    // =========================================

    // タワー強化
    el('upgradeButton').addEventListener(
        'click',
        upgrade
    );

    // 戦闘開始
    el('waveButton').addEventListener(
        'click',
        start
    );


    // =========================================
    // 18. ゲーム開始
    // =========================================

    status();

    requestAnimationFrame(frame);

})();
