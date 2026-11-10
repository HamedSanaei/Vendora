#!/usr/bin/env bash
# Verify read-only public GET endpoints with bounded retries, including
# Cloudflare's transient 520-525 responses (not covered by curl --retry).
# TLS certificate validation stays enabled; permanent failures still fail deploy.
set -Eeuo pipefail

ORIGIN="${1:-}"
ORIGIN="${ORIGIN%/}"
if [[ ! "$ORIGIN" =~ ^https://[a-zA-Z0-9.-]+(:[0-9]+)?$ ]]; then
  echo "usage: verify-public-endpoints.sh https://public-host[:port]" >&2
  exit 2
fi

# Six attempts, at most 20 seconds each, separated by five seconds: a maximum
# of 145 seconds per endpoint. Never retry writes or ignore a persistent outage.
verify_endpoint() {
  local url="$1" attempt status exit_code details remote_ip
  for attempt in 1 2 3 4 5 6; do
    exit_code=0
    details="$(curl --silent --show-error --fail --location --max-redirs 5 \
      --proto '=https' --proto-redir '=https' --connect-timeout 5 --max-time 20 \
      --retry 0 --output /dev/null --write-out '%{http_code} %{remote_ip}' \
      "$url")" || exit_code=$?
    read -r status remote_ip <<< "$details"
    if [[ "$exit_code" = 0 && "$status" =~ ^2[0-9][0-9]$ ]]; then
      echo "[public-check] Passed: $url (HTTP $status, attempt $attempt/6)"
      return 0
    fi
    echo "[public-check] Failed: $url (HTTP ${status:-000}, curl $exit_code, edge ${remote_ip:-unknown}, attempt $attempt/6)" >&2
    # HTTP 526 and curl 60 are certificate errors, not transient handshakes.
    # Other 4xx/configuration errors fail immediately. A 525 must actually
    # recover to 2xx; it is never considered a successful health check.
    case "$exit_code:$status" in
      22:408|22:429|22:500|22:502|22:503|22:504|22:52[0-5]|6:000|7:000|28:*|35:000|52:000|55:000|56:*) ;;
      *) return 1 ;;
    esac
    if [ "$attempt" -lt 6 ]; then sleep 5; fi
  done
  echo "[public-check] Retry budget exhausted: $url. Investigate origin TLS/network logs; TLS validation was not bypassed." >&2
  return 1
}

for path in /healthz / /fa/admin; do
  verify_endpoint "$ORIGIN$path"
done
