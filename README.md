# jismesh-tile-tools

[浸水想定区域図データ電子化ガイドライン](https://www.mlit.go.jp/common/001097667.pdf) に記載されている浸水想定区域データのCSVデータを入力として、それぞれのメッシュを再分割し集計した結果ベクトルタイルを作成するツールです。

## 使い方

**注意** データを一旦全てメモリ上に保存するため、最大メモリを調整する必要がある可能性あります。 `--max-old-space-size=16000` などで指定できます。

```
node src/csv2geojson.mjs [csv, csv, csv...] [output.geojson]
```

### メモリ

Linux で実行する場合、`max-old-space-size` を増やしても `vm.max_map_count` （メモリマップファイルの最大数）でも制限される可能性もあります。一時的に開放するために、

```
sudo sysctl -w vm.max_map_count=655300
```

などで対応できます。
