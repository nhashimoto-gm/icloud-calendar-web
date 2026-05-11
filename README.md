# iCloud Calendar Web Viewer

iCloudカレンダーをWebブラウザで閲覧できるシンプルなWebアプリです。

## 機能

- iCloud CalDAV経由でカレンダーを取得
- 月 / 週 / 日 / 一覧 ビュー切り替え
- 複数カレンダーの色分け表示
- 21:00〜5:00の深夜帯を折りたたみ表示
- イベントをクリックして詳細表示（場所・メモ）
- スマートフォン対応（レスポンシブ）

## セットアップ

### 1. App固有のパスワードを取得

[appleid.apple.com](https://appleid.apple.com) →「セキュリティ」→「App固有のパスワード」で生成

### 2. 認証情報ファイルを作成

```bash
cp .cal_example .cal_XXXXXXXXXXXXXXX
```

ファイルを編集して Apple ID と App固有パスワードを入力：

```
APPLE_ID=your_apple_id@icloud.com
APPLE_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

`app.py` の `load_dotenv(dotenv_path=...)` をそのファイル名に合わせて変更してください。

### 3. 依存パッケージをインストール

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. 起動

```bash
python app.py
```

ブラウザで `http://localhost:5050` にアクセス

## 本番環境（Nginx + Gunicorn）

```bash
# gunicorn で起動
venv/bin/gunicorn -w 2 -b 127.0.0.1:5050 app:app
```

Nginx でリバースプロキシする場合は `/calendar/` パスへの設定を追加し、  
`app.py` 内の `_ScriptName` ミドルウェアのプレフィックスを合わせてください。

## 技術スタック

- **Backend**: Python / Flask / caldav / icalendar
- **Frontend**: HTML / CSS / JavaScript
- **Calendar UI**: [FullCalendar v6](https://fullcalendar.io/)

## セキュリティ注意事項

- 認証情報ファイル（`.cal_*`）は `.gitignore` で管理対象外にしています
- 本番環境では Nginx の Basic認証などでアクセスを制限してください
