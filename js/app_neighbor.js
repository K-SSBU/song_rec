$(document).ready(function() {
    let myChart;
    $.getJSON('song_info/song_data.json', function(songData) {
        const Data = createScatterData(songData); // 取得したデータの詳細をまとめる
        const scatterData = Object.values(Data); // 散布図作成用のデータ
        myChart = renderScatterPlot(scatterData);
        
        var N = localStorage.getItem("N"); // 表示したい曲数
        var songAId = localStorage.getItem("songA");
        var songBId = localStorage.getItem("songB");

        console.log(N);

        const songA = songData[songAId].position;
        const songB = songData[songBId].position;

        // 垂直二等分線に基づく最長の曲Cと最短の曲Dを取得
        const { longestSongC, nearestSongD } = findSongsCAndD(songData, songA, songB, songAId, songBId);
        const expandsongId = findexpandSong(songData, songAId, songBId, longestSongC, nearestSongD);

        // プレイリストの推薦曲を取得
        const recommendedPlaylist = createRecommendedPlaylist(songData, songAId, songBId, expandsongId, N);

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
        let expandsongId = null;
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
                expandsongId = key;
            }
        });
        //console.log(expandsongId, songData[expandsongId].title);
        return expandsongId;
    }

    // 推薦曲を見つけ、プレイリストを作成する関数
    function createRecommendedPlaylist(songData, song1Id, song2Id, expandsongId, numSongs) {
        // プレイリストに始端と終端を含める場合 → [song1Id,song2Id,expandsongId]
        // プレイリストに始端と終端を含めない場合 → [expandsongId]
        const recsongs = [song1Id,song2Id,expandsongId]; 
        const expandsongPos = songData[expandsongId].position // 嗜好拡大曲の(x, y)

        const distances = Object.keys(songData) // Object.keys(songData) → ["sm○○", "sm××", ...]
        // distances → [{"sm○○", 2.5}, {"sm××", 0.2}, ...]
                .filter(key => key !== expandsongId && key !== song1Id && key !== song2Id) // 始終端曲,嗜好拡大曲は除く
                .map(key => {
                    const songPos = songData[key].position; // 楽曲の(x, y)
                    const distance = Math.hypot(songPos[0] - expandsongPos[0], songPos[1] - expandsongPos[1]); // 嗜好拡大曲とのユークリッド距離
                    return { key, distance }; // 楽曲IDと距離のペアを返す
                });
                
        // 距離でソートして最近傍を取得
        distances.sort((a, b) => a.distance - b.distance); // 距離が小さい順にソート
        const nearsongs = distances.slice(0, numSongs - 1); // 指定数だけ取得 .slice(start, end)

        nearsongs.forEach(song => recsongs.push(song.key)); // 推薦楽曲リストに追加
        
        return recsongs; // 推薦楽曲リスト
    }

    // プレイリストを描画する関数
    // APIから得たurlじゃないとサムネイルが正しく読み込めない
    function renderPlaylist(playlist, Data) {
        const $playlist = $('#rec-content').html('<ul></ul>').find('ul');
        playlist.forEach(songId => {
            const song = Data[songId];
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