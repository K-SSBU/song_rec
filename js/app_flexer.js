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

        // プレイリストの推薦曲を取得
        const recommendedPlaylist = createRecommendedPlaylist(songData, songAId, songBId, N);

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
    const ctx = document.getElementById('song-map').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'scatter',
        data: { 
            datasets: [
                { 
                    label: '曲', 
                    data: scatterData, 
                    backgroundColor: scatterData.map(() => 'rgba(0,0,0,0.01)'), 
                    pointRadius: scatterData.map(() => 2),
                }] 
        },
        options: {
            maintainAspectRatio: false,
            layout: { padding: 20 },
            animation: { duration: 0 },
            scales: { 
                x: { display: false }, 
                y: { display: false } 
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { 
                        label: (tooltipItem) => {
                            const dataPoint = scatterData[tooltipItem.dataIndex];
                            return [`${dataPoint.title}`, `${dataPoint.writer}`];
                        }
                    },
                    mode: 'nearest',
                    intersect: true,
                    bodyFont: { size: 18, weight: 'bold' }
                },
                zoom: {
                    zoom: {
                        wheel: { enabled: true } // マウスホイールでズーム
                    }
                }
            }
        }
    });
    return chart;
}

    // 推薦楽曲を見つける関数
    function findNearestSongs(songData, song1Pos, song2Pos, song1Id, song2Id, numSongs) {
        const nearestSongs = [];
        let songs = songData;
        for (let i = 1; i < (numSongs + 1); i++) {
            const t = i / (numSongs + 1); // tの値を計算
            const splitPoint = [
                song1Pos[0] + (song2Pos[0] - song1Pos[0]) * t,
                song1Pos[1] + (song2Pos[1] - song1Pos[1]) * t
            ];

            // 2. 各分割点から最も近い楽曲を見つける
            let nearestSong = null;
            let minDistance = Infinity;

            Object.keys(songs).forEach(key => {
                if (key === song1Id || key === song2Id) return; // 始終端曲は除く

                const songPos = songs[key].position; // 楽曲の(x,y)
                const distance = Math.hypot(songPos[0] - splitPoint[0], songPos[1] - splitPoint[1]); // 分割点とのユークリッド距離

                // 最近傍を求める
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestSong = key;
                }
            });
            delete songs[nearestSong];
            nearestSongs.push(nearestSong);
        }
        return nearestSongs;
    }

    // 推薦プレイリストを作成する関数
    function createRecommendedPlaylist(songData, songAId, songBId, N) {
        const songA = songData[songAId].position;
        const songB = songData[songBId].position;
        const k = N - 2; // 推薦曲数

        const nearestSongsAM = findNearestSongs(songData, songA, songB, songAId, songBId, k); // flexerの推薦

        return [songAId, ...nearestSongsAM, songBId];
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