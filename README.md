# ZEN Study Auto Next

ZEN Study の授業動画が終了すると、左側の動画一覧から次の動画へ移動する非公式の Safari Web Extension です。

## 機能

- 動画の終了イベントを検知し、設定した待ち時間後に次の動画行をクリック
- 再生時間の表示を起点に動画行を検出
- 確認テストなど、動画以外の行をスキップ
- 自動遷移のオン／オフ、待ち時間、カスタム CSS セレクタの設定

## 自分の Mac でビルド

1. このリポジトリをダウンロードまたは clone します。
2. `ZenStudy-Auto-Next-extension.xcodeproj` を Xcode で開きます。
3. Scheme を `ZenStudy-Auto-Next-extension`、実行先を `My Mac` にします。
4. アプリと Extension の両ターゲットの `Signing & Capabilities` を確認します。公開用プロジェクトは Team を空にし、ローカル署名（`Sign to Run Locally`）を使う設定です。
5. `Product → Run` を実行します。
6. Safari の設定で開発者機能を表示し、「デベロッパ → 未署名の機能拡張を許可」をオンにします。
7. 「機能拡張」で本拡張を有効にし、`nnn.ed.nico` へのアクセスを許可します。
8. 既存の一時インストール版がある場合は無効化し、授業ページを再読み込みします。

未署名拡張の許可は Safari 終了後に再設定が必要です。Apple Developer Program に加入せず使う場合も、受け取った人が自分の Mac でビルドできます。

プロジェクトは Xcode 26.6 で作成され、現在の最低 macOS バージョンは 26.5 です。古い macOS で使う場合は両ターゲットの Deployment Target とビルド互換性を確認してください。

## ファイル構成

```text
ZenStudy-Auto-Next-extension.xcodeproj/       Xcode プロジェクト
ZenStudy-Auto-Next-extension/                 macOS アプリとアイコン
ZenStudy-Auto-Next-extension Extension/
  Resources/
    manifest.json                           権限と読み込み設定
    core.js                                 動画一覧の判定
    content.js                              終了検知・遷移処理
    popup.html / popup.css / popup.js        設定画面
tests/core.test.cjs                          判定ロジックのテスト
```

拡張機能のソースは `Resources` 配下が正本です。変更後は Xcode で再ビルドし、授業ページを再読み込みしてください。

## テスト

Node.js 20 以降で実行します。追加パッケージは不要です。

```sh
node --test tests/core.test.cjs
```

## 権限・データ

`storage` は設定保存用、`nnn.ed.nico` のホスト権限は動画と一覧の操作用です。拡張ソースは独自サーバーへのデータ送信を行いません。

サイトの画面構造が変わると検出できなくなる場合があります。失敗時は Web インスペクタのコンソールに `[ZEN Auto Next]` の診断が表示されます。別オリジンの動画フレームは追加対応が必要になる場合があります。次の動画ページの自動再生は Safari とサイト側の挙動に依存します。

本拡張は ZEN Study 運営とは関係ありません。確認テストや教材のロックを解除する機能、受講記録を改変する機能はありません。

## ライセンス

現時点ではライセンスは指定していません。再配布・改変の許諾条件を定めて公開する場合は、公開者が適切な LICENSE ファイルを追加してください。

## Safari 開発資料

- [Safari 拡張の実行](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)
- [Safari 拡張の配布](https://developer.apple.com/documentation/safariservices/distributing-your-safari-web-extension)
