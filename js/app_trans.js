$(document).ready(function() {
    let myChart;
    $.getJSON('song_info/song_data.json', function(songData) {
        const Data = createScatterData(songData); // 取得したデータの詳細をまとめる
        const scatterData = Object.values(Data); // 散布図作成用のデータ
        myChart = renderScatterPlot(scatterData);
        
        var N = localStorage.getItem("N"); // 表示したい曲数
        var songAId = localStorage.getItem("songA");
        var songBId = localStorage.getItem("songB");

        const songA = songData[songAId].position;
        const songB = songData[songBId].position;

        // 垂直二等分線に基づく最長の曲Cと最短の曲Dを取得
        const { longestSongC, nearestSongD } = findSongsCAndD(songData, songA, songB, songAId, songBId);
        const recommendedSongId = findexpandSong(songData, songAId, songBId, longestSongC, nearestSongD);

        // プレイリストの推薦曲を取得
        const recommendedPlaylist = createRecommendedPlaylist(songData, songAId, songBId, recommendedSongId, N);

        // プレイリストを描画
        renderPlaylist(recommendedPlaylist, Data);
        
        // クリックイベントの設定
        setupClickEventForPlaylist();
    });

    // 散布データ作成関数
    function createScatterData(songData) {
        return Object.fromEntries(
            Object.entries(songData).map(([key, song]) => [
                key, // songID をキーとして利用
                {
                    songid: key,
                    x: song.position[0],
                    y: song.position[1],
                    title: song.title,
                    writer: song.writer,
                    url: song.url,
                    thumbnails: song.thumbnails,
                },
            ])
        );
    }

    // 散布図を描画する関数
    function renderScatterPlot(scatterData) {
        //const scatterData = Object.values(data);
        const ctx = document.getElementById('song-map').getContext('2d');
        const chart = new Chart(ctx, {
            type: 'scatter',
            data: { 
                datasets: [
                    { 
                        label: '曲', 
                        data: scatterData, 
                        backgroundColor: scatterData.map(() => 'rgba(255,255,255, 0.05)'), 
                        pointRadius: scatterData.map(() => 1.2),
                    }] },
            options: {
                maintainAspectRatio: false,
                layout: { padding: 20 },
                animation: { duration: 0 },
                scales: { x: { display: false }, y: { display: false } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: { label: (tooltipItem) => {
                            const dataPoint = scatterData[tooltipItem.dataIndex];
                            return [`${dataPoint.title}`, `${dataPoint.writer}`];
                        }},
                        mode: 'nearest',
                        intersect: true,
                        bodyFont: { size: 18, weight: 'bold' }
                    }
                }
            }
        });
        return chart;
    }


    // 曲Cと曲Dを見つける関数
    function findSongsCAndD(songData, songA, songB, songAId, songBId) {
        const midPoint = [(songA[0] + songB[0]) / 2, (songA[1] + songB[1]) / 2];
        const slopeAB = (songB[1] - songA[1]) / (songB[0] - songA[0]);
        const perpendicularSlope = -1 / slopeAB;

        let longestSongC = null;
        let nearestSongD = null;
        let maxDistance = -Infinity;
        let minDistanceToMid = Infinity;

        Object.entries(songData).forEach(([key, song]) => {
            if (key === songAId || key === songBId) return;
            const songPos = song.position;
            const distanceToMid = Math.hypot(songPos[0] - midPoint[0], songPos[1] - midPoint[1]);

            const yOnLine = perpendicularSlope * (songPos[0] - midPoint[0]) + midPoint[1];
            const distanceToLine = Math.abs(songPos[1] - yOnLine);

            if (distanceToLine < 10 && maxDistance < Math.hypot(songPos[0] - songA[0], songPos[1] - songA[1])) { // 10は近傍の閾値
                maxDistance = Math.hypot(songPos[0] - songA[0], songPos[1] - songA[1]);
                longestSongC = key;
            }

            if (distanceToMid < minDistanceToMid) {
                minDistanceToMid = distanceToMid;
                nearestSongD = key;
            }
        });

        return { longestSongC, nearestSongD };
    }

    // 嗜好拡大曲を見つける関数
    function findexpandSong(songData, songAId, songBId, longestSongC, nearestSongD) {
        let recommendedSongID = null;
        let minDistanceBetweenCD = Infinity;

        const posC = songData[longestSongC].position;
        const posD = songData[nearestSongD].position;

        Object.entries(songData).forEach(([key, song]) => {
            if ([songAId, songBId, longestSongC, nearestSongD].includes(key)) return;

            const songPos = song.position;
            const distanceToCD = Math.abs(
                (songPos[0] - posC[0]) * (posD[1] - posC[1]) - 
                (songPos[1] - posC[1]) * (posD[0] - posC[0])
            ) / Math.hypot(posD[0] - posC[0], posD[1] - posC[1]);

            if (distanceToCD < minDistanceBetweenCD) {
                minDistanceBetweenCD = distanceToCD;
                recommendedSongID = key;
            }
        });
        //console.log(recommendedSongID, songData[recommendedSongID].title);
        return recommendedSongID;
    }

    // 推薦楽曲を見つける関数
    function findNearestSongs(songData, song1Pos, song2Pos, song1Id, song2Id, numSongs) {
        const nearestSongs = [];
        for (let i = 1; i < (numSongs + 1); i++) {
            const t = i / (numSongs + 1); // tの値を計算
            const splitPoint = [
                song1Pos[0] + (song2Pos[0] - song1Pos[0]) * t,
                song1Pos[1] + (song2Pos[1] - song1Pos[1]) * t
            ];

            // 2. 各分割点から最も近い楽曲を見つける
            let nearestSong = null;
            let minDistance = Infinity;

            Object.keys(songData).forEach(key => {
                if (key === song1Id || key === song2Id) return; // 始中間（中間終）端曲は除く

                const songPos = songData[key].position; // 楽曲の(x,y)
                const distance = Math.hypot(songPos[0] - splitPoint[0], songPos[1] - splitPoint[1]); // 分割点とのユークリッド距離

                // 最近傍を求める
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestSong = key;
                }
            });
            nearestSongs.push(nearestSong);
        }
        return nearestSongs;
    }

    // 推薦プレイリストを作成する関数
    function createRecommendedPlaylist(songData, songAId, songBId, recommendedSongId, N) {
        const songA = songData[songAId].position;
        const songB = songData[songBId].position;
        const songM = songData[recommendedSongId].position;
        const k = Math.floor((N - 3) / 2) + 1; // 中間までの推薦曲数
        const z = Math.floor((N - 3) / 2); // 中間からの推薦曲数

        const nearestSongsAM = findNearestSongs(songData, songA, songM, songAId, recommendedSongId, k); // 前半の推薦
        const nearestSongsMB = findNearestSongs(songData, songM, songB, recommendedSongId, songBId, z); // 後半の推薦

        return [songAId, ...nearestSongsAM, recommendedSongId, ...nearestSongsMB, songBId];
    }

    // プレイリストを描画する関数
    // 一部楽曲はサムネイル情報なし
    function renderPlaylist(playlist, Data) {
        const $playlist = $('#rec-content').html('<ul></ul>').find('ul');
        playlist.forEach(songId => {
            const song = Data[songId];
            //console.log(song);
            // const icon_Id = songId.match(/\d+/)[0];
            $playlist.append(`
                <li class="rec-select-window" data-songid="${songId}" data-url="${song.url}" >
                    <div class="rec-icon" style="background-image: url(${song.thumbnails});"></div>
                    <div class="rec-title">${song.title}
                        <div class="rec-writer">${song.writer}</div>
                    </div>
                    <div class="check-button"></div>
                </li>
            `);
        });
    }

    // クリックイベントの設定関数
    function setupClickEventForPlaylist() {
        var song_select_check = false; // 初期状態：プレイリストをクリックしていない
        var selected_song = null; // クリックされた楽曲（初期状態は無し）

        // 楽曲選択時の処理
        $('.rec-select-window').on('click', function() {
            const url = $(this).data('url');
            // songle 読み込み
            $('#player').html(`
                <div data-api="songle-widget-extra-module" data-url="${url}" id="songle-widget" data-songle-widget-ctrl="0" data-song-start-at="chorus"
                data-video-player-size-w="575" data-video-player-size-h="280" data-songle-widget-size-w="575" data-songle-widget-size-h="95"></div>
            `);
            $('.rec-select-window .rec-title').removeClass('song-selected'); 
            $.getScript("https://widget.songle.jp/v1/widgets.js"); // songle プレイヤーの表示
            $(this).find('.rec-title').addClass('song-selected'); // 選択された楽曲のタイトルを緑色に変化
            song_select_check = true;
            selected_song = $(this); // 現在選択された楽曲を記録
        });

        // 評価ボタンのクリック処理
        $('.rating-button').on('click', function() {
            if(song_select_check && selected_song) {
                // 評価のクラス名(色)を取得
                let rating_class = $(this).attr("class").split(/\s+/)[1];
                // 評価をプレイリストに表示
                selected_song.find('.check-button').removeClass('dislike slightly-dislike neutral slightly-like like').addClass(rating_class);
                
                const songid = selected_song.data('songid'); 
                const backgroundColor = $("." + rating_class).css("background-color"); // 評価したときの色
                const index = (myChart.data.datasets[0].data).findIndex(item => item.songid === songid); // 散布図で扱う配列のインデックスに対応する楽曲ID
 
                myChart.data.datasets[0].backgroundColor[index] = backgroundColor; // 散布図に評価の色を反映
                myChart.data.datasets[0].pointRadius[index] = 3.5; // 評価した楽曲の点の大きさを変更
                myChart.update();
            }
        });
    }
});
