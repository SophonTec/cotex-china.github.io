#!/usr/bin/env bash
set -euo pipefail

source_root="${1:-/home/sophon/Downloads/cotex-WEBSITE}"

image_dimensions() {
  ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height \
    -of csv=s=x:p=0 "$1" 2>/dev/null || printf 'unknown'
}

file_size() {
  stat -c '%s' "$1"
}

printf '# CoTeX 4-category Asset Inventory\n\n'
printf 'Generated from the read-only source directory `%s`. Original files are not modified.\n\n' "$source_root"
printf '## Summary\n\n'
printf '| Asset group | Files | Source size |\n'
printf '| --- | ---: | ---: |\n'

for directory in \
  "products-women's scarf&hijab" \
  "products-women's underwear" \
  "products-women's clothing" \
  "products-girls' clothing" \
  "工厂图片"; do
  count=$(find "$source_root/$directory" -maxdepth 1 -type f ! -name '.DS_Store' | wc -l)
  size=$(du -sh "$source_root/$directory" | cut -f1)
  printf '| `%s/` | %s | %s |\n' "$directory" "$count" "$size"
done

printf '| Design elements | 10 | %s |\n' "$(du -ch "$source_root"/设计元素-* | tail -n 1 | cut -f1)"
printf '| Official logo | 1 | %s bytes |\n' "$(file_size "$source_root/公司logo COTEX 新.jpg")"
printf '| Corporate video | 1 | %s bytes |\n\n' "$(file_size "$source_root/company video.MP4")"

printf '## Primary files\n\n'
printf '| Source path | Type | Dimensions / duration | Bytes |\n'
printf '| --- | --- | --- | ---: |\n'
logo="$source_root/公司logo COTEX 新.jpg"
printf '| `%s` | JPEG image | %s | %s |\n' "$logo" "$(image_dimensions "$logo")" "$(file_size "$logo")"
video="$source_root/company video.MP4"
duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$video")
video_dimensions=$(image_dimensions "$video")
printf '| `%s` | H.264/AAC MP4 | %s, %.2f seconds | %s |\n\n' "$video" "$video_dimensions" "$duration" "$(file_size "$video")"

for group in \
  "products-women's scarf&hijab" \
  "products-women's underwear" \
  "products-women's clothing" \
  "products-girls' clothing" \
  "工厂图片"; do
  printf '## %s\n\n' "$group"
  printf '| Filename | Type | Dimensions | Bytes | Source path |\n'
  printf '| --- | --- | ---: | ---: | --- |\n'
  while IFS= read -r -d '' file; do
    name=$(basename "$file")
    extension=${name##*.}
    printf '| `%s` | %s | %s | %s | `%s` |\n' \
      "$name" "${extension^^}" "$(image_dimensions "$file")" "$(file_size "$file")" "$file"
  done < <(find "$source_root/$group" -maxdepth 1 -type f ! -name '.DS_Store' -print0 | sort -zV)
  printf '\n'
done

printf '## Design references\n\n'
printf '| Filename | Type | Dimensions | Bytes | Source path |\n'
printf '| --- | --- | ---: | ---: | --- |\n'
while IFS= read -r -d '' file; do
  name=$(basename "$file")
  extension=${name##*.}
  printf '| `%s` | %s | %s | %s | `%s` |\n' \
    "$name" "${extension^^}" "$(image_dimensions "$file")" "$(file_size "$file")" "$file"
done < <(find "$source_root" -maxdepth 1 -type f -name '设计元素-*' -print0 | sort -zV)
