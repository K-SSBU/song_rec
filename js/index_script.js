$(document).ready(function() {
    $.getJSON('song_info/song_data.json', function(songData) {
    // 1つ目の楽曲選択用のプルダウンメニュー
    var songA = $('#songA');
    $.each(songData, function(key, value) {
      var option = $('<option></option>')
        .attr('value', key)  // フォームに送信される値（sm○○）
        .text(value.title);  // 表示されるテキスト（【初音ミク】みくみくにしてあげる♪【してやんよ】）
      songA.append(option);
    });
  
    // 2つ目の楽曲選択用のプルダウンメニュー
    var songB = $('#songB');
    $.each(songData, function(key, value) {
      var option = $('<option></option>')
        .attr('value', key)  // フォームに送信される値（sm○○）
        .text(value.title);  
      songB.append(option);
    });
  
    $('#songA').select2({
      language: "ja" //日本語化
    });

    $('#songB').select2({
      language: "ja" //日本語化
    });

    // フォーム送信時の処理
    $('#trans-button').on('click', function(e) {
      e.preventDefault();
      
      var selecteSongA = $('#songA').val();  // 1つ目の楽曲ID
      var selecteSongB = $('#songB').val();  // 2つ目の楽曲ID
      var number = $('#numberInput').val(); // 楽曲数
      
      localStorage.setItem('songA', selecteSongA);
      localStorage.setItem('songB', selecteSongB);
      localStorage.setItem('N', number);

      window.location.href = 'trans.html';
    });

    $('#flexer-button').on('click', function(e) {
      e.preventDefault();
      
      var selecteSongA = $('#songA').val();  // 1つ目の楽曲ID
      var selecteSongB = $('#songB').val();  // 2つ目の楽曲ID
      var number = $('#numberInput').val(); // 楽曲数
      
      localStorage.setItem('songA', selecteSongA);
      localStorage.setItem('songB', selecteSongB);
      localStorage.setItem('N', number);

      window.location.href = 'flexer.html';
    });

    $('#neighbor-button').on('click', function(e) {
        e.preventDefault();
        
        var selecteSongA = $('#songA').val();  // 1つ目の楽曲ID
        var selecteSongB = $('#songB').val();  // 2つ目の楽曲ID
        var number = $('#numberInput').val(); // 楽曲数
        
        localStorage.setItem('songA', selecteSongA);
        localStorage.setItem('songB', selecteSongB);
        localStorage.setItem('N', number);
  
        window.location.href = 'neighbor.html';
      });
  });
});