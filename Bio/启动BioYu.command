#!/bin/zsh
# Double-click in Finder. Paths are resolved relative to this file.
BIOYU_PROJECT="${0:A:h}"
cd -- "$BIOYU_PROJECT" || exit 1
BIOYU_PORT="${BIOYU_PORT:-5173}"
BIOYU_URL="http://127.0.0.1:${BIOYU_PORT}"

bioyu_fail() {
  print -r -- "$1"
  read -r '?按回车关闭窗口…'
  exit 1
}

# Finder's Terminal session may not include a custom Node installation in PATH.
BIOYU_NODE="$(command -v node)"
if [[ -z "$BIOYU_NODE" ]]; then
  for BIOYU_CANDIDATE in /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.local/node-*/bin/node(N); do
    if [[ -x "$BIOYU_CANDIDATE" ]]; then
      BIOYU_NODE="$BIOYU_CANDIDATE"
      break
    fi
  done
fi
[[ -n "$BIOYU_NODE" ]] || bioyu_fail '没有找到 Node.js。请先安装 Node.js 20 或更高版本。'
"$BIOYU_NODE" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || bioyu_fail '需要 Node.js 20 或更高版本。'

# Reuse the existing BioYu preview, without launching another process.
BIOYU_PROBE="$(mktemp -t bioyu-launch)" || exit 1
BIOYU_PID=''
bioyu_cleanup() {
  rm -f -- "$BIOYU_PROBE"
  if [[ -n "$BIOYU_PID" ]]; then
    kill "$BIOYU_PID" 2>/dev/null
    wait "$BIOYU_PID" 2>/dev/null
  fi
}
trap bioyu_cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM HUP

if /usr/bin/curl --noproxy '*' -fsS --max-time 2 "$BIOYU_URL/src/main.js" -o "$BIOYU_PROBE" 2>/dev/null && /usr/bin/cmp -s "$BIOYU_PROBE" "$BIOYU_PROJECT/src/main.js"; then
  print -r -- "BioYu 已在运行，正在打开 $BIOYU_URL"
  /usr/bin/open "$BIOYU_URL"
  exit 0
fi

if /usr/sbin/lsof -nP -iTCP:"$BIOYU_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  bioyu_fail "端口 $BIOYU_PORT 已被其他服务占用，请关闭该服务后重试。"
fi

print '正在启动 BioYu…'
PORT="$BIOYU_PORT" "$BIOYU_NODE" scripts/serve.mjs &
BIOYU_PID=$!
for BIOYU_ATTEMPT in {1..50}; do
  if /usr/bin/curl --noproxy '*' -fsS --max-time 1 "$BIOYU_URL/src/main.js" -o "$BIOYU_PROBE" 2>/dev/null && /usr/bin/cmp -s "$BIOYU_PROBE" "$BIOYU_PROJECT/src/main.js"; then
    print -r -- "已启动：$BIOYU_URL"
    print '保持此终端窗口打开；按 Control + C 停止服务。'
    /usr/bin/open "$BIOYU_URL"
    wait "$BIOYU_PID"
    exit $?
  fi
  kill -0 "$BIOYU_PID" 2>/dev/null || bioyu_fail '启动失败，请查看上方错误信息。'
  sleep 0.1
done
bioyu_fail '启动超时，请查看上方错误信息。'
