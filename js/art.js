/* こえだけ— 絵（Codex 担当）
 *
 * Codex 版のキャラクターと「ないしょ」吹き出しをここに書く。
 * システム（index.html）は window.KoedakeArt を読むだけで、このファイルの外の値は渡さない。
 * 約束の詳しい説明は、同じリポジトリの外にある引き継ぎ書（Codex向け）を見ること。
 *
 * ■ キャラクター：charas に { id, name, draw(c, v) } を足す
 *   - id は 'cx-' で始める（例 'cx-hoshi'）。name は一覧に出る名前（ひらがな2〜4文字くらい）
 *   - draw(c, v)：c は CanvasRenderingContext2D。原点 (0,0) がキャラの中心に移してある
 *       本番の画面は 720×1280 で、中心は (360, 600)。v.r = 200 が「頭の半径」くらいの大きさの目安
 *       一覧の小さな絵（サムネイル）では v.r = 44、v.thumb = true で呼ばれる（止まった絵を描く）
 *   - v の中身（読むだけ。書き換えない）
 *       v.r      大きさの目安（本番 200／サムネイル 44）
 *       v.open   口の開き 0〜1（声の大きさ。なめらかに変わる。段階に丸めてよい）
 *       v.level  v.open と同じ値（揺れ・伸び縮みに使ってよい）
 *       v.blink  目 1=開いている、1未満=まばたき中
 *       v.now    時刻（秒）。待機中の揺れなどに使う
 *       v.hush   true のとき「ないしょ」（無音にした部分）。口は閉じる
 *       v.thumb  true のときサムネイル
 *   - 揺れ・伸び縮み・位置の上下もすべて draw の中で決めてよい（システムは中心に移すだけ）
 *   - 描いてよい範囲：中心から上下左右 ±300px くらいまで（上のタイトル y<260、下の字幕 y>960 にかからない）
 *
 * ■ 画像（assets/ に置いた SVG・PNG）を使うとき
 *   - 読み込みを待つ Promise を ready に入れる（書き出しの前にシステムが待つ）
 *   - 読み込み前の draw は、何も描かないか簡単な形で逃げてよい（エラーにしない）
 *
 * ■ 「ないしょ」吹き出し：drawSecret(c, v) を入れると Claude 版の代わりに使う（null なら Claude 版）
 *   c の原点は吹き出しの置き場所（本番画面で (520, 330)）。v.now・v.charaId（今のキャラの id）を読める
 */
// ここから Codex 版（codex/art-v1 から取り込み。2026-09-25 佳澄さんの採用分：しぇるてぃ）
(() => {
  // 水彩のしぇるてぃ。元の画像（1146×1372）を半分の大きさで描き、目と口だけ上から描き足して動かす
  function watercolorImage(src, name) {
    const image = new Image();
    let loaded = false;
    const ready = new Promise((resolve, reject) => {
      image.onload = () => { loaded = true; resolve(); };
      image.onerror = () => reject(new Error(`${name}の画像を読み込めませんでした`));
      image.src = src;
    });
    return { image, ready, loaded: () => loaded };
  }
  const sheltieImage = watercolorImage('assets/characters/sheltie-v1.webp', 'しぇるてぃ');
  const sheltie = { source: sheltieImage, center: 650, eyes: [558, 751, 417], eyeSize: [23, 28], mouth: [655, 550], width: 57, thumb: [650, 395, .18] };

  function oval(c, x, y, rx, ry, fill, angle = 0) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
  }
  function line(c, d, color, width = 6) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.stroke(new Path2D(d));
  }

  function watercolorAnimal(c, v, spec) {
    if (!spec.source.loaded()) return;
    const still = !!v.thumb;
    const volume = still || v.hush ? 0 : Math.max(0, Math.min(1, v.level));
    const breath = still ? 0 : Math.sin(v.now * 1.8);
    const syllable = still ? 0 : Math.sin(v.now * 9);
    c.save();
    c.lineCap = 'round';
    if (still) {
      const [cx, cy, scale] = spec.thumb;
      c.scale(scale, scale);
      c.translate(-cx, -cy);
    } else {
      c.scale(v.r / 200, v.r / 200);
      c.translate(0, breath * 4 - volume * (12 + syllable * 8));
      c.scale(1 - volume * syllable * .012, 1 + breath * .006 + volume * syllable * .02);
      c.scale(.5, .5);
      c.translate(-spec.center, -650);
    }
    c.drawImage(spec.source.image, 0, 0);
    const dark = '#153763';
    const [lx, rx, ey] = spec.eyes;
    const [ew, eh] = spec.eyeSize;
    if (!still && v.blink < 1) {
      line(c, `M${lx - ew - 4} ${ey + 2} Q${lx} ${ey + 13} ${lx + ew + 4} ${ey + 2} M${rx - ew - 4} ${ey + 2} Q${rx} ${ey + 13} ${rx + ew + 4} ${ey + 2}`, dark, 6);
    } else {
      oval(c, lx, ey, ew, eh, dark);
      oval(c, rx, ey, ew, eh, dark);
    }
    const opening = still || v.hush ? 0 : Math.max(0, Math.min(1, v.open));
    const step = opening < .08 ? 0 : opening < .38 ? 1 : opening < .72 ? 2 : 3;
    const [mx, my] = spec.mouth;
    if (!step) {
      line(c, `M${mx - spec.width * .5} ${my - 5} Q${mx} ${my + spec.width * .38} ${mx + spec.width * .5} ${my - 5}`, dark, 7);
    } else {
      const w = spec.width * [0, .52, .78, 1][step];
      const h = spec.width * [0, .34, .6, .83][step];
      c.save();
      c.beginPath();
      c.ellipse(mx, my + h * .22, w, h, 0, 0, Math.PI * 2);
      c.fillStyle = dark;
      c.fill();
      c.clip();
      if (step > 1) oval(c, mx, my + h * 1.05, w * .64, h * .24, '#E8989A');
      c.restore();
    }
    c.restore();
  }

  window.KoedakeArt = {
    ready: sheltieImage.ready,
    charas: [
      { id: 'cx-sheltie', name: 'しぇるてぃ', secretAt: { x: -240, y: -370 }, draw: (c, v) => watercolorAnimal(c, v, sheltie) },
    ],
    drawSecret: null,
  };
})();
