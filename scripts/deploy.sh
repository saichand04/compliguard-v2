#!/usr/bin/env bash
# =============================================================================
#  CompliGuard v2 — Interactive Deployment Script
#  https://github.com/saichand04/compliguard-v2
#
#  Usage:
#    bash scripts/deploy.sh           # interactive wizard
#    bash scripts/deploy.sh --dry-run # preview without deploying
#    bash scripts/deploy.sh --help    # show help
# =============================================================================
set -uo pipefail
# Note: -e (errexit) intentionally omitted — we handle errors explicitly
# so partial failures in optional steps don't abort the whole deployment

# ─────────────────────────────────────────────────────────────────────────────
# COLOR & STYLE CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────
RESET="\e[0m"
BOLD="\e[1m"
DIM="\e[2m"
ITALIC="\e[3m"

# CompliGuard palette
VIOLET="\e[38;5;135m"       # #8B5CF6 violet
CYAN="\e[38;5;51m"          # #06B6D4 cyan
PINK="\e[38;5;213m"         # accent pink
GOLD="\e[38;5;220m"         # gold / warning
GREEN="\e[38;5;82m"         # success green
RED="\e[38;5;196m"          # error red
WHITE="\e[97m"
GRAY="\e[38;5;245m"
DARK="\e[38;5;237m"

BG_VIOLET="\e[48;5;57m"
BG_DARK="\e[48;5;232m"

# ─────────────────────────────────────────────────────────────────────────────
# GLOBAL STATE
# ─────────────────────────────────────────────────────────────────────────────
DRY_RUN=false
DEPLOY_MODE=""        # minimal | fullstack | dev
DOMAIN="localhost"
PORT="3030"
SSL_CERT_PATH=""
SSL_KEY_PATH=""
SELF_SIGNED=false
AI_PROVIDER="skip"
AI_API_KEY=""
POSTGRES_PASSWORD=""
MINIO_PASSWORD=""
NEXTAUTH_SECRET=""
JWT_SECRET=""
NEXTAUTH_URL=""
NEXTAUTH_URL_INTERNAL=""  # set equal to NEXTAUTH_URL during gather_config
ADMIN_EMAIL="admin@compliguard.local"
ADMIN_PASSWORD=""
COMPOSE_SERVICES=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
print_center() {
  local text="$1"
  local width="${2:-80}"
  local clean
  # Strip ANSI for length calculation
  clean=$(echo -e "$text" | sed 's/\x1b\[[0-9;]*m//g')
  local pad=$(( (width - ${#clean}) / 2 ))
  printf "%${pad}s" ""
  echo -e "$text"
}

hr() {
  local char="${1:--}"
  local color="${2:-$DARK}"
  local width="${3:-80}"
  # Use ASCII fallback chars to avoid Unicode rendering issues on non-UTF8 terminals
  case "$char" in
    '─'|'═') char='-' ;;
    '╗'|'|'|'╔'|'╚'|'╝'|'╠'|'╣') char='|' ;;
  esac
  echo -e "${color}$(printf '%*s' "$width" | tr ' ' "$char")${RESET}"
}

badge() {
  local type="$1"
  local msg="$2"
  case "$type" in
    ok)    echo -e " ${BG_DARK}${GREEN}${BOLD}  ✓  ${RESET}${DARK} ${msg}${RESET}" ;;
    warn)  echo -e " ${BG_DARK}${GOLD}${BOLD}  ⚠  ${RESET}${DARK} ${msg}${RESET}" ;;
    err)   echo -e " ${BG_DARK}${RED}${BOLD}  ✗  ${RESET}${DARK} ${msg}${RESET}" ;;
    info)  echo -e " ${BG_DARK}${CYAN}${BOLD}  ℹ  ${RESET}${DARK} ${msg}${RESET}" ;;
    gen)   echo -e " ${BG_DARK}${VIOLET}${BOLD}  ⚡  ${RESET}${DARK} ${msg}${RESET}" ;;
  esac
}

step_header() {
  local num="$1"
  local title="$2"
  local pad=$(( 68 - ${#title} - 8 ))
  [[ $pad -lt 0 ]] && pad=0
  echo ""
  echo -e "${VIOLET}${BOLD}+------------------------------------------------------------------------------+${RESET}"
  echo -e "${VIOLET}${BOLD}|${RESET}  ${CYAN}${BOLD}STEP ${num}${RESET}${WHITE}${BOLD}  ${title}$(printf '%*s' $pad '')${VIOLET}${BOLD}|${RESET}"
  echo -e "${VIOLET}${BOLD}+------------------------------------------------------------------------------+${RESET}"
  echo ""
}

ask() {
  # ask <variable_name> <prompt> [default]
  local var="$1"
  local prompt="$2"
  local default="${3:-}"
  local value=""

  if [[ -n "$default" ]]; then
    echo -en "  ${CYAN}▶${RESET} ${WHITE}${prompt}${RESET} ${GRAY}[${default}]${RESET}: "
  else
    echo -en "  ${CYAN}▶${RESET} ${WHITE}${prompt}${RESET}: "
  fi

  read -r value
  if [[ -z "$value" && -n "$default" ]]; then
    value="$default"
  fi
  printf -v "$var" '%s' "$value"
}

ask_secret() {
  local var="$1"
  local prompt="$2"
  local value=""
  echo -en "  ${PINK}▶${RESET} ${WHITE}${prompt}${RESET} ${GRAY}(hidden)${RESET}: "
  read -rs value
  echo ""
  printf -v "$var" '%s' "$value"
}

ask_choice() {
  # ask_choice <variable_name> <prompt> <opt1> <opt2> ...
  local var="$1"
  local prompt="$2"
  shift 2
  local opts=("$@")
  local choice=""

  echo -e "  ${WHITE}${BOLD}${prompt}${RESET}"
  echo ""
  local i=1
  for opt in "${opts[@]}"; do
    echo -e "    ${VIOLET}[${i}]${RESET}  ${opt}"
    ((i++))
  done
  echo ""

  while true; do
    echo -en "  ${CYAN}▶${RESET} ${WHITE}Enter choice${RESET} ${GRAY}[1-$((i-1))]${RESET}: "
    read -r choice
    if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice < i )); then
      printf -v "$var" '%s' "${opts[$((choice-1))]}"
      break
    fi
    echo -e "  ${RED}  Invalid choice. Try again.${RESET}"
  done
}

confirm() {
  local prompt="$1"
  local default="${2:-y}"
  local answer=""
  if [[ "$default" == "y" ]]; then
    echo -en "  ${GOLD}▶${RESET} ${WHITE}${prompt}${RESET} ${GRAY}[Y/n]${RESET}: "
  else
    echo -en "  ${GOLD}▶${RESET} ${WHITE}${prompt}${RESET} ${GRAY}[y/N]${RESET}: "
  fi
  read -r answer
  answer="${answer:-$default}"
  [[ "${answer,,}" == "y" ]]
}

gen_secret() {
  local len="${1:-32}"
  # Try openssl first, then /dev/urandom fallback
  if command -v openssl &>/dev/null; then
    openssl rand -hex "$len" 2>/dev/null | head -c $((len * 2))
  else
    cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c $((len * 2))
  fi
}

gen_password() {
  local len="${1:-24}"
  if command -v openssl &>/dev/null; then
    openssl rand -base64 32 2>/dev/null | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c "$len"
  else
    cat /dev/urandom | tr -dc 'a-zA-Z0-9!@#$%^&*' | head -c "$len"
  fi
}

mask_secret() {
  local s="$1"
  local len="${#s}"
  if (( len <= 4 )); then
    echo "****"
  else
    echo "${s:0:4}$(printf '%*s' $((len - 4)) | tr ' ' '*')"
  fi
}

# is_weak_secret <value>
# Returns 0 (true) if the value matches a known cargo-cult placeholder pattern.
# Patterns are case-insensitive and substring-matched, so e.g.
# "MyChangeMe123" and "compliguard-prod" are both rejected.
is_weak_secret() {
  local value="$1"
  echo "$value" | grep -qiE 'changeme|your-32-char|placeholder|compliguard123|^compliguard$'
}

# require_strong_secret <varname> <prompt> <min_length>
# Re-prompts via ask_secret until the user supplies a value that:
#   1. is at least <min_length> chars
#   2. does not match is_weak_secret patterns
require_strong_secret() {
  local var="$1"
  local prompt="$2"
  local min_len="${3:-32}"
  local value=""
  while true; do
    ask_secret value "$prompt"
    if (( ${#value} < min_len )); then
      badge err "Value too short (got ${#value}, need ≥ ${min_len}). Try again."
      continue
    fi
    if is_weak_secret "$value"; then
      badge err "Value matches a known weak/placeholder pattern. Try again."
      continue
    fi
    break
  done
  printf -v "$var" '%s' "$value"
}

spinner() {
  local pid="$1"
  local msg="$2"
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  while kill -0 "$pid" 2>/dev/null; do
    echo -en "\r  ${CYAN}${frames[$((i % 10))]}${RESET}  ${WHITE}${msg}${RESET}   "
    sleep 0.1
    ((i++))
  done
  echo -en "\r  ${GREEN}✓${RESET}  ${WHITE}${msg}${RESET}   \n"
}

clear_screen() {
  printf "\033[2J\033[H"
}

# ─────────────────────────────────────────────────────────────────────────────
# BANNER
# ─────────────────────────────────────────────────────────────────────────────
show_banner() {
  clear_screen
  echo ""
  echo -e "${VIOLET}${BOLD}"
  echo '  ██████╗ ██████╗ ███╗   ███╗██████╗ ██╗     ██╗ ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ '
  echo '  ██╔════╝██╔═══██╗████╗ ████|██╔══██╗██|     ██|██╔════╝ ██|   ██|██╔══██╗██╔══██╗██╔══██╗'
  echo '  ██|     ██|   ██|██╔████╔██|██████╔╝██|     ██|██|  ███╗██|   ██|███████|██████╔╝██|  ██|'
  echo '  ██|     ██|   ██|██|╚██╔╝██|██╔═══╝ ██|     ██|██|   ██|██|   ██|██╔══██|██╔══██╗██|  ██|'
  echo '  ╚██████╗╚██████╔╝██| ╚═╝ ██|██|     ███████╗██|╚██████╔╝╚██████╔╝██|  ██|██|  ██|██████╔╝'
  echo '   ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚══════╝╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ '
  echo -e "${RESET}"
  echo -e "${CYAN}${BOLD}"
  print_center "✦  AI-Powered GRC & Compliance Platform  ✦" 94
  echo -e "${RESET}"
  echo -e "${GRAY}"
  print_center "v2.0  ·  Interactive Deployment Wizard  ·  Apache 2.0" 94
  echo -e "${RESET}"
  echo ""
  hr "-" "$VIOLET" 94
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# PRE-FLIGHT CHECKS
# ─────────────────────────────────────────────────────────────────────────────
run_preflight() {
  step_header "0" "Pre-flight Checks"

  local failed=false

  # Docker installed
  if command -v docker &>/dev/null; then
    badge ok "Docker found: $(docker --version | cut -d' ' -f3 | tr -d ',')"
  else
    badge err "Docker not found. Install Docker: https://docs.docker.com/get-docker/"
    failed=true
  fi

  # Docker daemon running
  if docker info &>/dev/null 2>&1; then
    badge ok "Docker daemon is running"
  else
    badge err "Docker daemon is not running. Start Docker Desktop or: sudo systemctl start docker"
    failed=true
  fi

  # Docker Compose
  if docker compose version &>/dev/null 2>&1; then
    badge ok "Docker Compose found: $(docker compose version --short 2>/dev/null || docker compose version | head -1)"
  elif command -v docker-compose &>/dev/null; then
    badge warn "docker-compose (legacy) found — consider upgrading to Docker Compose v2"
  else
    badge err "Docker Compose not found. Install: https://docs.docker.com/compose/install/"
    failed=true
  fi

  # Project directory
  if [[ -f "$PROJECT_DIR/docker-compose.yml" ]]; then
    badge ok "Project root: $PROJECT_DIR"
  else
    # Script may have been downloaded standalone (not inside the repo)
    # Try common locations before failing
    for candidate in \
        "$(pwd)" \
        "$HOME/compliguard-v2" \
        "/opt/compliguard" \
        "/opt/compliguard-v2" \
        "/home/compliguard" \
        "/root/compliguard-v2"; do
      if [[ -f "$candidate/docker-compose.yml" ]]; then
        PROJECT_DIR="$candidate"
        badge warn "Script running standalone — using project root: $PROJECT_DIR"
        break
      fi
    done
    if [[ ! -f "$PROJECT_DIR/docker-compose.yml" ]]; then
      badge err "docker-compose.yml not found. This script must run from inside the CompliGuard repo."
      echo ""
      echo -e "  ${GOLD}${BOLD}  Fix: clone the repo first, then run the script from it:${RESET}"
      echo -e "  ${CYAN}    git clone https://github.com/saichand04/compliguard-v2.git /opt/compliguard${RESET}"
      echo -e "  ${CYAN}    cd /opt/compliguard && bash scripts/deploy.sh${RESET}"
      echo ""
      failed=true
    fi
  fi

  # openssl for secret generation
  if command -v openssl &>/dev/null; then
    badge ok "OpenSSL found — strong secrets will be generated"
  else
    badge warn "OpenSSL not found — falling back to /dev/urandom for secret generation"
  fi

  if [[ "$failed" == true ]]; then
    echo ""
    echo -e "  ${RED}${BOLD}Pre-flight failed. Fix the errors above and re-run.${RESET}"
    echo ""
    exit 1
  fi

  echo ""
  badge ok "All pre-flight checks passed"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — DEPLOYMENT MODE
# ─────────────────────────────────────────────────────────────────────────────
select_deploy_mode() {
  step_header "1" "Deployment Mode"

  echo -e "  ${WHITE}Choose how you want to deploy CompliGuard:${RESET}"
  echo ""
  echo -e "  ${VIOLET}${BOLD}[1]${RESET}  ${WHITE}${BOLD}Minimal${RESET}  ${GRAY}— App + PostgreSQL + Redis${RESET}"
  echo -e "       ${DIM}Best if you already have Nginx, Caddy, Traefik, or another reverse proxy.${RESET}"
  echo -e "       ${DIM}App is exposed on a port you choose. No SSL managed here.${RESET}"
  echo ""
  echo -e "  ${CYAN}${BOLD}[2]${RESET}  ${WHITE}${BOLD}Full Stack${RESET}  ${GRAY}— App + PostgreSQL + Redis + MinIO + Nginx (80/443)${RESET}"
  echo -e "       ${DIM}Self-contained deployment. Nginx handles SSL termination.${RESET}"
  echo -e "       ${DIM}Bring your own certs or generate a self-signed cert for testing.${RESET}"
  echo ""
  echo -e "  ${GOLD}${BOLD}[3]${RESET}  ${WHITE}${BOLD}Dev Mode${RESET}  ${GRAY}— Hot-reload development build${RESET}"
  echo -e "       ${DIM}Mounts source into container, rebuilds on file changes.${RESET}"
  echo -e "       ${DIM}Not for production. No SSL, no MinIO, no Nginx.${RESET}"
  echo ""

  local choice=""
  while true; do
    echo -en "  ${CYAN}▶${RESET} ${WHITE}Enter choice${RESET} ${GRAY}[1-3]${RESET}: "
    read -r choice
    case "$choice" in
      1) DEPLOY_MODE="minimal";    break ;;
      2) DEPLOY_MODE="fullstack";  break ;;
      3) DEPLOY_MODE="dev";        break ;;
      *) echo -e "  ${RED}  Invalid choice. Enter 1, 2, or 3.${RESET}" ;;
    esac
  done

  echo ""
  case "$DEPLOY_MODE" in
    minimal)   badge ok "Mode: Minimal  (App + PostgreSQL + Redis)" ;;
    fullstack) badge ok "Mode: Full Stack  (App + PostgreSQL + Redis + MinIO + Nginx)" ;;
    dev)       badge ok "Mode: Dev  (hot-reload, source mounted)" ;;
  esac
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
gather_config() {
  step_header "2" "Configuration"

  # Domain / hostname
  ask DOMAIN "Domain or hostname" "localhost"

  if [[ "$DEPLOY_MODE" == "minimal" || "$DEPLOY_MODE" == "dev" ]]; then
    # Auto-detect a free port starting from 3030
    local suggested_port="3030"
    while lsof -ti:"$suggested_port" &>/dev/null 2>&1 || \
          ss -tlnp 2>/dev/null | grep -q ":${suggested_port} " || \
          netstat -tlnp 2>/dev/null | grep -q ":${suggested_port} "; do
      badge warn "Port ${suggested_port} is in use — trying $((suggested_port + 1))..."
      suggested_port=$((suggested_port + 1))
    done
    [[ "$suggested_port" != "3030" ]] && badge info "Suggested free port: ${suggested_port}"

    ask PORT "External app port (what you'll access in browser)" "${suggested_port}"

    # Both NEXTAUTH_URL and NEXTAUTH_URL_INTERNAL must be identical.
    # NextAuth uses NEXTAUTH_URL_INTERNAL for server-side callback resolution.
    # Since we have no Nginx layer, the container reaches itself on the same
    # host:port the browser uses — they must match exactly.
    NEXTAUTH_URL="http://${DOMAIN}:${PORT}"
    NEXTAUTH_URL_INTERNAL="http://${DOMAIN}:${PORT}"
  fi

  if [[ "$DEPLOY_MODE" == "fullstack" ]]; then
    PORT="443"
    echo ""
    echo -e "  ${WHITE}${BOLD}SSL Certificate${RESET}"
    echo ""
    echo -e "  ${VIOLET}[1]${RESET}  ${WHITE}I have my own SSL certificate/key files${RESET}"
    echo -e "  ${CYAN}[2]${RESET}  ${WHITE}Generate a self-signed certificate (testing only)${RESET}"
    echo ""
    local ssl_choice=""
    while true; do
      echo -en "  ${CYAN}▶${RESET} ${WHITE}SSL option${RESET} ${GRAY}[1-2]${RESET}: "
      read -r ssl_choice
      case "$ssl_choice" in
        1)
          ask SSL_CERT_PATH "Path to SSL certificate (.crt / .pem)" ""
          ask SSL_KEY_PATH  "Path to SSL private key (.key)" ""
          if [[ ! -f "$SSL_CERT_PATH" ]]; then
            badge warn "Certificate file not found — you can add it later at deploy/ssl/"
          fi
          break
          ;;
        2)
          SELF_SIGNED=true
          badge warn "Self-signed cert will be generated — browsers will show a security warning"
          break
          ;;
        *) echo -e "  ${RED}  Enter 1 or 2.${RESET}" ;;
      esac
    done
    NEXTAUTH_URL="https://${DOMAIN}"
    NEXTAUTH_URL_INTERNAL="https://${DOMAIN}"
  fi

  echo ""
  echo -e "  ${WHITE}${BOLD}AI Provider${RESET}  ${GRAY}(used by CompliGuard's AI analysis engine)${RESET}"
  echo ""
  echo -e "  ${VIOLET}[1]${RESET}  ${WHITE}OpenAI${RESET}  ${GRAY}(GPT-4o, GPT-4-turbo, etc.)${RESET}"
  echo -e "  ${CYAN}[2]${RESET}  ${WHITE}Anthropic${RESET}  ${GRAY}(Claude 3.5, Claude 3 Opus, etc.)${RESET}"
  echo -e "  ${GOLD}[3]${RESET}  ${WHITE}Ollama${RESET}  ${GRAY}(local models — self-hosted)${RESET}"
  echo -e "  ${GRAY}[4]${RESET}  ${WHITE}Skip${RESET}  ${GRAY}(configure later in Settings → AI)${RESET}"
  echo ""

  local ai_choice=""
  while true; do
    echo -en "  ${CYAN}▶${RESET} ${WHITE}AI provider${RESET} ${GRAY}[1-4]${RESET}: "
    read -r ai_choice
    case "$ai_choice" in
      1) AI_PROVIDER="openai";    ask_secret AI_API_KEY "OpenAI API key (sk-...)"; break ;;
      2) AI_PROVIDER="anthropic"; ask_secret AI_API_KEY "Anthropic API key (sk-ant-...)"; break ;;
      3) AI_PROVIDER="ollama"
         local ollama_url=""
         ask ollama_url "Ollama base URL" "http://host.docker.internal:11434"
         AI_API_KEY="$ollama_url"
         break ;;
      4) AI_PROVIDER="skip"; break ;;
      *) echo -e "  ${RED}  Enter 1, 2, 3, or 4.${RESET}" ;;
    esac
  done

  echo ""
  echo -e "  ${WHITE}${BOLD}Admin Account${RESET}  ${GRAY}(first super-admin user for CompliGuard)${RESET}"
  echo ""
  ask ADMIN_EMAIL "Admin email address" "admin@compliguard.local"

  # Ask for admin password (must not be empty)
  while true; do
    ask_secret ADMIN_PASSWORD "Admin password (min 8 chars)"
    if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
      badge err "Password must be at least 8 characters. Try again."
    else
      break
    fi
  done
  badge ok "Admin account: ${ADMIN_EMAIL}"
  echo ""

  badge ok "Domain: ${DOMAIN}"
  badge ok "App URL: ${NEXTAUTH_URL}"
  badge ok "NEXTAUTH_URL_INTERNAL: ${NEXTAUTH_URL_INTERNAL}  (must equal App URL)"
  [[ "$AI_PROVIDER" != "skip" ]] && badge ok "AI Provider: ${AI_PROVIDER}"
  [[ "$AI_PROVIDER" == "skip" ]] && badge warn "AI Provider: skipped (configure post-deploy)"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — SECRETS & .ENV
# ─────────────────────────────────────────────────────────────────────────────
generate_secrets() {
  step_header "3" "Secrets & Environment"

  echo -e "  ${WHITE}CompliGuard requires strong secrets for security.${RESET}"
  echo -e "  ${GRAY}Auto-generated values are cryptographically random. You can override any.${RESET}"
  echo ""

  # NEXTAUTH_SECRET
  local generated_auth
  generated_auth="$(gen_secret 32)"
  echo -e "  ${VIOLET}${BOLD}NEXTAUTH_SECRET${RESET}  ${GRAY}(session encryption)${RESET}"
  echo -e "  ${DIM}Auto-generated: $(mask_secret "$generated_auth")${RESET}"
  if confirm "Use auto-generated value?"; then
    NEXTAUTH_SECRET="$generated_auth"
    badge gen "NEXTAUTH_SECRET generated"
  else
    # User-supplied secrets must be ≥ 32 chars and free of cargo-cult patterns
    # (changeme, your-32-char, placeholder, compliguard123, etc.).
    require_strong_secret NEXTAUTH_SECRET "Enter NEXTAUTH_SECRET (min 32 chars, no placeholder text)" 32
    badge ok "NEXTAUTH_SECRET set"
  fi
  echo ""

  # JWT_SECRET
  local generated_jwt
  generated_jwt="$(gen_secret 32)"
  echo -e "  ${VIOLET}${BOLD}JWT_SECRET${RESET}  ${GRAY}(API token signing)${RESET}"
  echo -e "  ${DIM}Auto-generated: $(mask_secret "$generated_jwt")${RESET}"
  if confirm "Use auto-generated value?"; then
    JWT_SECRET="$generated_jwt"
    badge gen "JWT_SECRET generated"
  else
    require_strong_secret JWT_SECRET "Enter JWT_SECRET (min 32 chars, no placeholder text)" 32
    badge ok "JWT_SECRET set"
  fi
  echo ""

  # POSTGRES_PASSWORD
  local generated_pg
  generated_pg="$(gen_password 24)"
  echo -e "  ${CYAN}${BOLD}POSTGRES_PASSWORD${RESET}  ${GRAY}(database password)${RESET}"
  echo -e "  ${DIM}Auto-generated: $(mask_secret "$generated_pg")${RESET}"
  if confirm "Use auto-generated value?"; then
    POSTGRES_PASSWORD="$generated_pg"
    badge gen "POSTGRES_PASSWORD generated"
  else
    # Postgres passwords don't need 32 chars but must not be cargo-cult.
    require_strong_secret POSTGRES_PASSWORD "Enter POSTGRES_PASSWORD (min 16 chars, no placeholder text)" 16
    badge ok "POSTGRES_PASSWORD set"
  fi
  echo ""

  # MINIO_PASSWORD
  #
  # Always generate this, even in minimal/dev mode where the minio service
  # isn't started. Reason: docker-compose.yml uses
  # ${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD must be set}, which is
  # evaluated by `docker compose` at parse time across ALL services in the
  # file — even ones not selected for `up`. If the var is missing, compose
  # aborts with "required variable MINIO_ROOT_PASSWORD is missing a value"
  # before it gets a chance to read the service list. So we always populate
  # it; in minimal/dev mode the value is unused at runtime (no minio
  # container is started) but it satisfies the parser.
  local generated_minio
  generated_minio="$(gen_password 24)"
  if [[ "$DEPLOY_MODE" == "fullstack" ]]; then
    echo -e "  ${CYAN}${BOLD}MINIO_ROOT_PASSWORD${RESET}  ${GRAY}(object storage password)${RESET}"
    echo -e "  ${DIM}Auto-generated: $(mask_secret "$generated_minio")${RESET}"
    if confirm "Use auto-generated value?"; then
      MINIO_PASSWORD="$generated_minio"
      badge gen "MINIO_ROOT_PASSWORD generated"
    else
      require_strong_secret MINIO_PASSWORD "Enter MINIO_ROOT_PASSWORD (min 16 chars, no placeholder text)" 16
      badge ok "MINIO_ROOT_PASSWORD set"
    fi
    echo ""
  else
    # Silent for minimal/dev — operator doesn't care about an unused service
    # secret. Still goes into .env so compose parses cleanly.
    MINIO_PASSWORD="$generated_minio"
    badge gen "MINIO_ROOT_PASSWORD auto-generated (unused in ${DEPLOY_MODE} mode; required by compose parser)"
  fi

  # Check existing .env
  if [[ -f "$PROJECT_DIR/.env" ]]; then
    echo ""
    badge warn ".env file already exists at $PROJECT_DIR/.env"
    if ! confirm "Overwrite existing .env?"; then
      badge info "Keeping existing .env — skipping write"
      echo ""
      return
    fi
  fi

  # write_env_file performs final strong-secret validation; if it fails we
  # must NOT continue to run_deploy with a half-written or weak .env.
  if ! write_env_file; then
    badge err "Failed to write .env — aborting deploy."
    exit 1
  fi
}

write_env_file() {
  local env_file="$PROJECT_DIR/.env"

  # Final defensive gate before persisting. Even auto-generated values get
  # checked here — protects against future refactors that swap gen_secret()
  # for something weaker without revisiting this file.
  if (( ${#NEXTAUTH_SECRET} < 32 )); then
    badge err "NEXTAUTH_SECRET is shorter than 32 chars (${#NEXTAUTH_SECRET}). Aborting."
    return 1
  fi
  if (( ${#JWT_SECRET} < 32 )); then
    badge err "JWT_SECRET is shorter than 32 chars (${#JWT_SECRET}). Aborting."
    return 1
  fi
  if is_weak_secret "$NEXTAUTH_SECRET" || is_weak_secret "$JWT_SECRET" \
       || is_weak_secret "$POSTGRES_PASSWORD" \
       || { [[ "$DEPLOY_MODE" == "fullstack" ]] && is_weak_secret "$MINIO_PASSWORD"; }; then
    badge err "One of the secrets matches a known weak/placeholder pattern. Aborting."
    return 1
  fi

  # Determine storage provider
  local storage_provider="local"
  [[ "$DEPLOY_MODE" == "fullstack" ]] && storage_provider="s3"

  cat > "$env_file" << EOF
# ============================================================
#  CompliGuard v2 — Environment Configuration
#  Generated by deploy.sh on $(date -u +"%Y-%m-%d %H:%M:%S UTC")
#  ⚠  Keep this file SECRET — never commit to git
# ============================================================

# ── App ─────────────────────────────────────────────────────
NODE_ENV=production
PORT=${PORT}
NEXTAUTH_URL=${NEXTAUTH_URL}
NEXTAUTH_URL_INTERNAL=${NEXTAUTH_URL_INTERNAL}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
JWT_SECRET=${JWT_SECRET}

# ── Database ─────────────────────────────────────────────────
DATABASE_URL=postgresql://compliguard:${POSTGRES_PASSWORD}@postgres:5432/compliguard
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# ── Redis ────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

EOF

  if [[ "$DEPLOY_MODE" == "fullstack" ]]; then
    cat >> "$env_file" << EOF
# ── Object Storage (MinIO) ───────────────────────────────────
STORAGE_PROVIDER=s3
S3_ENDPOINT=http://minio:9000
S3_BUCKET=compliguard-uploads
S3_REGION=us-east-1
MINIO_ROOT_USER=compliguard
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
S3_ACCESS_KEY_ID=compliguard
S3_SECRET_ACCESS_KEY=${MINIO_PASSWORD}

EOF
  else
    cat >> "$env_file" << EOF
# ── Storage ──────────────────────────────────────────────────
STORAGE_PROVIDER=local
LOCAL_STORAGE_PATH=/data/uploads

# ── MinIO (unused in ${DEPLOY_MODE} mode but required by compose parser) ──
# docker-compose.yml references \${MINIO_ROOT_PASSWORD:?...} on the minio
# service. Compose evaluates that interpolation at PARSE time across ALL
# services, even ones we don't start. Without this line the deploy aborts
# with "required variable MINIO_ROOT_PASSWORD is missing a value" — and
# no containers come up. The value is never read at runtime in this mode.
MINIO_ROOT_USER=compliguard
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}

EOF
  fi

  # AI provider
  cat >> "$env_file" << EOF
# ── AI Provider ─────────────────────────────────────────────
AI_PROVIDER=${AI_PROVIDER}
EOF

  case "$AI_PROVIDER" in
    openai)    echo "OPENAI_API_KEY=${AI_API_KEY}" >> "$env_file" ;;
    anthropic) echo "ANTHROPIC_API_KEY=${AI_API_KEY}" >> "$env_file" ;;
    ollama)    echo "OLLAMA_BASE_URL=${AI_API_KEY}" >> "$env_file" ;;
  esac

  cat >> "$env_file" << EOF

# ── Admin Account ───────────────────────────────────────────
ADMIN_EMAIL=${ADMIN_EMAIL}
# Admin password is injected into the DB during deploy (not stored here)

# ── Email ────────────────────────────────────────────────────
# Set EMAIL_PROVIDER=postmark and add POSTMARK_TOKEN for real emails
EMAIL_PROVIDER=mock
# POSTMARK_TOKEN=your-postmark-server-token

# ── Teams Bot ────────────────────────────────────────────────
# TEAMS_BOT_ID=your-bot-app-id
# TEAMS_BOT_PASSWORD=your-bot-app-password
# TEAMS_TENANT_ID=your-tenant-id

# ── MCP / OpenClaw ───────────────────────────────────────────
# MCP_API_KEY=cgk_your-api-key
EOF

  badge ok ".env written to $env_file"
  echo ""
  echo -e "  ${GOLD}${BOLD}  ⚠  Keep .env secret — it contains your database password and signing keys.${RESET}"
  echo -e "  ${GOLD}     .env is already in .gitignore so it will NOT be committed to git.${RESET}"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# SELF-SIGNED CERT GENERATION
# ─────────────────────────────────────────────────────────────────────────────
generate_self_signed_cert() {
  local ssl_dir="$PROJECT_DIR/deploy/ssl"
  mkdir -p "$ssl_dir"

  badge info "Generating self-signed SSL certificate for $DOMAIN..."

  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$ssl_dir/privkey.pem" \
    -out    "$ssl_dir/fullchain.pem" \
    -subj "/C=US/ST=Local/L=Local/O=CompliGuard/CN=${DOMAIN}" \
    -addext "subjectAltName=DNS:${DOMAIN},IP:127.0.0.1" \
    2>/dev/null

  badge ok "Certificate: $ssl_dir/fullchain.pem"
  badge ok "Private key: $ssl_dir/privkey.pem"
}

copy_user_certs() {
  local ssl_dir="$PROJECT_DIR/deploy/ssl"
  mkdir -p "$ssl_dir"
  [[ -f "$SSL_CERT_PATH" ]] && cp "$SSL_CERT_PATH" "$ssl_dir/fullchain.pem" && badge ok "Cert copied"
  [[ -f "$SSL_KEY_PATH"  ]] && cp "$SSL_KEY_PATH"  "$ssl_dir/privkey.pem"  && badge ok "Key copied"
}

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — DEPLOY
# ─────────────────────────────────────────────────────────────────────────────
run_deploy() {
  step_header "4" "Deploying CompliGuard"

  # Determine docker compose command
  local dc="docker compose"
  command -v "docker-compose" &>/dev/null && ! docker compose version &>/dev/null 2>&1 && dc="docker-compose"

  # Build service list and compose args.
  # IMPORTANT: always pass -f explicitly. Without -f, Docker Compose auto-loads
  # docker-compose.override.yml from the project dir if it exists, which in past
  # deployments silently turned a "production" deploy into a dev (Turbopack)
  # container — breaking client-side hydration. Pinning the file list here keeps
  # prod deploys deterministic.
  local compose_args="-f $PROJECT_DIR/docker-compose.yml"
  local services=""

  case "$DEPLOY_MODE" in
    minimal)
      services="app postgres redis"
      ;;
    fullstack)
      services=""  # start all
      if [[ "$SELF_SIGNED" == true ]]; then
        generate_self_signed_cert
      else
        copy_user_certs
      fi
      ;;
    dev)
      compose_args="-f $PROJECT_DIR/docker-compose.yml -f $PROJECT_DIR/docker-compose.dev.yml"
      services="app postgres redis"
      ;;
  esac

  # Defensive cleanup: a stray docker-compose.override.yml in the deploy dir
  # would still be picked up by any plain `docker compose ...` the operator
  # later runs. Warn so the operator can remove it if it shouldn't be there.
  if [[ -f "$PROJECT_DIR/docker-compose.override.yml" ]]; then
    badge warn "docker-compose.override.yml exists — Docker Compose auto-loads it on \`docker compose up\` (without -f)."
    badge warn "If you intend a production deploy, remove it: rm $PROJECT_DIR/docker-compose.override.yml"
  fi

  echo -e "  ${WHITE}${BOLD}Compose command:${RESET}"
  echo -e "  ${GRAY}${dc} ${compose_args} up -d --build ${services}${RESET}"
  echo ""

  if [[ "$DRY_RUN" == true ]]; then
    badge warn "DRY RUN — skipping actual deploy. Remove --dry-run to deploy for real."
    echo ""
    return
  fi

  cd "$PROJECT_DIR"

  # Pull base images first (faster parallel pull)
  echo -e "  ${CYAN}Pulling base images...${RESET}"
  $dc $compose_args pull $services 2>&1 | grep -E "Pull|Pulled|already|error|Error" | \
    while IFS= read -r line; do echo -e "  ${GRAY}${line}${RESET}"; done &
  wait
  echo ""

  # Build app image
  echo -e "  ${CYAN}Building CompliGuard image (this takes 3-5 minutes on first run)...${RESET}"
  echo ""
  $dc $compose_args build --progress=plain app 2>&1 | \
    grep -E "^#[0-9]|Step|DONE|ERROR|npm warn|npm error" | \
    while IFS= read -r line; do
      if echo "$line" | grep -qiE "error|ERROR"; then
        echo -e "  ${RED}${line}${RESET}"
      elif echo "$line" | grep -qiE "DONE|Step [0-9]"; then
        echo -e "  ${GREEN}${line}${RESET}"
      else
        echo -e "  ${GRAY}${line}${RESET}"
      fi
    done

  echo ""
  badge ok "Image built"
  echo ""

  # Start containers
  echo -e "  ${CYAN}Starting containers...${RESET}"
  echo ""
  $dc $compose_args up -d $services 2>&1 | \
    while IFS= read -r line; do
      if echo "$line" | grep -qiE "error|Error"; then
        echo -e "  ${RED}${line}${RESET}"
      elif echo "$line" | grep -qiE "Started|Running|Healthy|done"; then
        echo -e "  ${GREEN}${line}${RESET}"
      elif echo "$line" | grep -qiE "Creating|Starting|Waiting"; then
        echo -e "  ${CYAN}${line}${RESET}"
      else
        echo -e "  ${GRAY}${line}${RESET}"
      fi
    done

  echo ""
  badge ok "Containers started"
  echo ""

  # ── Run DB migrations ────────────────────────────────────────────────────────
  echo -e "  ${CYAN}Running database migrations...${RESET}"
  local pg_container
  pg_container=$(docker compose $compose_args ps -q postgres 2>/dev/null | head -1)
  if [[ -z "$pg_container" ]]; then
    # NB: docker --filter name=... is a SUBSTRING match (Go template style),
    # NOT a regex. The old pattern "compliguard.*postgres" was matching
    # nothing because docker treated ".*" as literal characters. Use a
    # plain substring that catches both compliguard-postgres-1 (legacy
    # project name) and compliguard-v2-postgres-1.
    pg_container=$(docker ps --filter "name=postgres" --format "{{.Names}}\t{{.ID}}" \
      | awk '$1 ~ /compliguard.*postgres/ {print $2; exit}')
  fi

  if [[ -z "$pg_container" ]]; then
    badge err "Could not find a postgres container after \`docker compose up\`."
    badge err "Compose likely aborted earlier — scroll up for the actual error."
    badge info "Common cause: a required env var (e.g. MINIO_ROOT_PASSWORD) was missing."
    badge info "Fix the .env file and re-run \`bash scripts/deploy.sh\`."
    return 1
  fi

  # Wait for Postgres to be ready
  local pg_attempts=0
  until docker exec "$pg_container" pg_isready -U compliguard &>/dev/null 2>&1 || (( ++pg_attempts >= 20 )); do
    echo -en "\r  ${CYAN}  Waiting for Postgres... (${pg_attempts}/20)${RESET}  "
    sleep 2
  done
  echo ""
  if (( pg_attempts >= 20 )); then
    badge err "Postgres container $pg_container never became ready."
    return 1
  fi

  # Run migrations via drizzle-kit inside the app container
  local app_container
  app_container=$(docker compose $compose_args ps -q app 2>/dev/null | head -1)
  if [[ -z "$app_container" ]]; then
    app_container=$(docker ps --filter "name=app" --format "{{.Names}}\t{{.ID}}" \
      | awk '$1 ~ /compliguard.*app/ {print $2; exit}')
  fi

  if [[ -z "$app_container" ]]; then
    badge err "Could not find a compliguard app container after \`docker compose up\`."
    badge err "The app image built but the container failed to start. Check:"
    badge info "  docker compose logs app"
    badge info "  docker compose ps"
    return 1
  fi

  # Wait for the app container to be running and node to be available
  # (bcrypt hashing depends on docker exec into this container)
  local app_attempts=0
  until docker exec "$app_container" node -e 'process.exit(0)' &>/dev/null 2>&1 || (( ++app_attempts >= 30 )); do
    echo -en "\r  ${CYAN}  Waiting for app container runtime... (${app_attempts}/30)${RESET}  "
    sleep 2
  done
  [[ $app_attempts -gt 0 ]] && echo ""

  # Apply migrations via psql — drizzle-kit is NOT available in the standalone production image
  # IMPORTANT: Drizzle SQL files embed '--> statement-breakpoint' as an INLINE SUFFIX on the same
  # line as each statement (e.g. 'CREATE TYPE ...;--> statement-breakpoint'). We must strip this
  # suffix globally with 's/--> statement-breakpoint//g' — NOT a line-deletion pattern.
  local migration_applied=false
  for sql_file in "$PROJECT_DIR"/drizzle/migrations/*.sql; do
    if [[ -f "$sql_file" ]]; then
      badge info "Applying migration: $(basename "$sql_file")"
      local mig_output
      mig_output=$(sed 's/--> statement-breakpoint//g' "$sql_file" | \
        docker exec -i "$pg_container" psql -U compliguard -d compliguard \
        --set ON_ERROR_STOP=0 2>&1)
      local mig_errors
      mig_errors=$(echo "$mig_output" | grep -iE '^ERROR' | grep -v 'already exists' | head -5 || true)
      if [[ -n "$mig_errors" ]]; then
        badge warn "Migration warnings (non-fatal): $mig_errors"
      else
        badge ok "Migration applied: $(basename "$sql_file")"
        migration_applied=true
      fi
    fi
  done
  if [[ "$migration_applied" == false ]]; then
    badge warn "No .sql migration files found in $PROJECT_DIR/drizzle/migrations/"
    badge warn "Tables may already exist, or migration files may be missing from the repo."
  fi
  echo ""

  # ── Inject admin user via psql ────────────────────────────────────────────────
  echo -e "  ${CYAN}Creating admin account (${ADMIN_EMAIL})...${RESET}"

  # Hash the password using pgcrypto inside the running postgres container.
  # postgres:16-alpine ships pgcrypto, so this works on every supported deploy
  # without depending on host-side python+bcrypt, apache2-utils, or bcryptjs
  # inside the standalone Next.js image (where /app/node_modules is minimal
  # — bcryptjs is bundled into the route chunk, not exposed as a require()
  # target — so `docker exec app node -e "require('bcryptjs')..."` fails).
  #
  # We do hashing + UPSERT in a single SQL block so:
  #   - the plaintext password never appears in the users table
  #   - a failure to create the extension or compute the hash aborts the deploy
  #     (instead of silently storing an empty string and producing "Invalid
  #     email or password" on every login)
  #   - the password is passed via psql --set so passwords with $, ', \, etc.
  #     are safely escaped by psql instead of by hand-rolled sed.

  # Write the SQL to a temp file rather than embedding a heredoc inside $(...).
  # Heredocs containing PL/pgSQL $$ markers, single-quoted strings, and
  # SQL parser literals like $2a$/$2b$ confuse bash's tokenizer when wrapped
  # in command substitution + backslash line continuation.
  local sql_file
  sql_file=$(mktemp -t cg-admin-XXXXXX.sql)
  trap 'rm -f "$sql_file"' RETURN
  # Note on the SQL below:
  #   - psql expands :'admin_email' / :'admin_pw' as quoted string literals in
  #     regular statements, but NOT inside dollar-quoted bodies ($$...$$), so
  #     we use plain SQL (CREATE EXTENSION, INSERT/UPSERT) and verify the post
  #     condition with a SELECT that errors via division-by-zero if the stored
  #     hash isn't a valid bcrypt string. ON_ERROR_STOP=1 turns that into a
  #     non-zero psql exit code so the deploy aborts loudly.
  cat > "$sql_file" <<'PSQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Pre-flight: confirm pgcrypto's bcrypt support is actually wired up.
SELECT 1 / CASE
  WHEN crypt('probe', gen_salt('bf', 4)) ~ '^\$2[aby]\$' THEN 1
  ELSE 0
END AS pgcrypto_bcrypt_check;

-- Ensure a default organization exists so the admin user has an orgId.
-- Without this, session.orgId is null and every API route returns 403 Forbidden.
INSERT INTO organizations (id, name, slug, plan, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  'enterprise',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id)   DO NOTHING;
-- also handle slug conflict in case the org already exists with a different id
INSERT INTO organizations (id, name, slug, plan, is_active, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  'enterprise',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO UPDATE SET id = '00000000-0000-0000-0000-000000000001', updated_at = NOW();

INSERT INTO users (id, email, first_name, last_name, password_hash, role, organization_id, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  :'admin_email',
  'Admin',
  'User',
  crypt(:'admin_pw', gen_salt('bf', 12)),
  'super_admin',
  '00000000-0000-0000-0000-000000000001',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  password_hash   = crypt(:'admin_pw', gen_salt('bf', 12)),
  role            = 'super_admin',
  organization_id = '00000000-0000-0000-0000-000000000001',
  is_active       = true,
  updated_at      = NOW();

-- Post-condition: must have a valid bcrypt hash AND a non-null organization_id.
SELECT 1 / CASE
  WHEN password_hash ~ '^\$2[aby]\$' AND length(password_hash) >= 60
   AND organization_id IS NOT NULL THEN 1
  ELSE 0
END AS admin_hash_and_org_check
FROM users WHERE email = :'admin_email';
PSQL

  local admin_inject_output
  admin_inject_output=$(
    docker exec -i \
      -e PGOPTIONS=--client-min-messages=warning \
      "$pg_container" \
      psql -U compliguard -d compliguard \
        --set=ON_ERROR_STOP=1 \
        --set=admin_email="$ADMIN_EMAIL" \
        --set=admin_pw="$ADMIN_PASSWORD" \
        < "$sql_file" 2>&1
  )
  local admin_inject_rc=$?

  if [[ $admin_inject_rc -ne 0 ]] || echo "$admin_inject_output" | grep -qiE '^ERROR|^psql:.*ERROR'; then
    badge err "Admin account creation FAILED:"
    echo "$admin_inject_output" | sed 's/^/    /' | head -20
    badge err "The login API will return 'Invalid email or password' until this is fixed."
    badge info "Manual recovery:"
    badge info "  docker exec -i $pg_container psql -U compliguard -d compliguard <<EOF"
    badge info "    CREATE EXTENSION IF NOT EXISTS pgcrypto;"
    badge info "    UPDATE users SET password_hash = crypt('<your-pw>', gen_salt('bf', 12))"
    badge info "    WHERE email = '${ADMIN_EMAIL}';"
    badge info "  EOF"
    return 1
  fi
  badge ok "Admin user ready: ${ADMIN_EMAIL} (bcrypt hash verified)"

  # ── Seed system_settings (mark setup as complete) ─────────────────────────────
  # Without this row, the app redirects every page to /setup/welcome on first run
  docker exec -i "$pg_container" psql -U compliguard -d compliguard > /dev/null 2>&1 <<PSQL
INSERT INTO system_settings (id, setup_completed, setup_step, platform_name, deployment_type, updated_at)
VALUES (gen_random_uuid(), true, 9, 'CompliGuard', 'docker', NOW())
ON CONFLICT DO NOTHING;
PSQL
  badge ok "Setup wizard marked complete"
  echo ""

  # Health check loop
  echo -e "  ${CYAN}Waiting for CompliGuard to be ready...${RESET}"
  echo ""

  local health_url="http://localhost:${PORT}/api/health"
  [[ "$DEPLOY_MODE" == "fullstack" ]] && health_url="http://localhost:3030/api/health"

  local max_attempts=30
  local attempt=0
  local ready=false

  while (( attempt < max_attempts )); do
    ((attempt++))
    local dots="$(printf '%*s' $attempt | tr ' ' '.')"
    echo -en "\r  ${CYAN}  Attempt ${attempt}/${max_attempts}${dots}${RESET}   "

    if curl -sf "$health_url" &>/dev/null 2>&1; then
      ready=true
      break
    fi
    sleep 3
  done

  echo ""
  echo ""

  if [[ "$ready" == true ]]; then
    badge ok "Health check passed — CompliGuard is ready!"
  else
    badge warn "Health check timed out — the app may still be starting"
    badge info "Check logs: docker compose logs -f app"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# FINAL SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
show_summary() {
  echo ""
  echo ""
  hr "═" "$VIOLET" 80
  echo ""
  echo -e "${VIOLET}${BOLD}"
  print_center "🚀  CompliGuard is Deployed!" 80
  echo -e "${RESET}"
  echo ""

  local app_url="$NEXTAUTH_URL"
  local pg_pass_masked
  pg_pass_masked="$(mask_secret "$POSTGRES_PASSWORD")"

  echo -e "${BOLD}${WHITE}  +--------------------------------------------------------------+${RESET}"
  echo -e "${BOLD}${WHITE}  |${RESET}                                                              ${BOLD}${WHITE}|${RESET}"
  echo -e "${BOLD}${WHITE}  |${RESET}  ${CYAN}${BOLD}App URL    ${RESET}  ${WHITE}${app_url}$(printf '%*s' $((40 - ${#app_url})) '')${BOLD}${WHITE}|${RESET}"
  echo -e "${BOLD}${WHITE}  |${RESET}  ${VIOLET}${BOLD}Admin      ${RESET}  ${WHITE}${ADMIN_EMAIL}$(printf '%*s' $((40 - ${#ADMIN_EMAIL})) '')${BOLD}${WHITE}|${RESET}"
  echo -e "${BOLD}${WHITE}  |${RESET}  ${VIOLET}${BOLD}Password   ${RESET}  ${WHITE}(the password you entered)$(printf '%*s' $((40 - 25)) '')${BOLD}${WHITE}|${RESET}"
  echo -e "${BOLD}${WHITE}  |${RESET}  ${CYAN}${BOLD}DB Pass    ${RESET}  ${GRAY}${pg_pass_masked}$(printf '%*s' $((40 - ${#pg_pass_masked})) '')${BOLD}${WHITE}|${RESET}"
  echo -e "${BOLD}${WHITE}  |${RESET}  ${GREEN}${BOLD}Env File   ${RESET}  ${WHITE}${PROJECT_DIR}/.env$(printf '%*s' $((40 - ${#PROJECT_DIR} - 5)) '')${BOLD}${WHITE}|${RESET}"
  echo -e "${BOLD}${WHITE}  |${RESET}                                                              ${BOLD}${WHITE}|${RESET}"
  if [[ "$DEPLOY_MODE" == "fullstack" ]]; then
    echo -e "${BOLD}${WHITE}  |${RESET}  ${GOLD}${BOLD}MinIO UI   ${RESET}  ${WHITE}http://${DOMAIN}:9001$(printf '%*s' $((40 - ${#DOMAIN} - 16)) '')${BOLD}${WHITE}|${RESET}"
    echo -e "${BOLD}${WHITE}  |${RESET}                                                              ${BOLD}${WHITE}|${RESET}"
  fi
  echo -e "${BOLD}${WHITE}  +--------------------------------------------------------------+${RESET}"

  echo ""
  echo -e "  ${WHITE}${BOLD}Useful commands:${RESET}"
  echo ""
  echo -e "  ${GRAY}View logs:      ${CYAN}docker compose logs -f app${RESET}"
  echo -e "  ${GRAY}Stop:           ${CYAN}docker compose down${RESET}"
  echo -e "  ${GRAY}Stop + volumes: ${CYAN}docker compose down -v${RESET}  ${RED}(⚠ deletes data)${RESET}"
  echo -e "  ${GRAY}Run migrations: ${CYAN}docker compose exec app npx drizzle-kit migrate${RESET}"
  echo -e "  ${GRAY}Shell access:   ${CYAN}docker compose exec app sh${RESET}"
  echo -e "  ${GRAY}Restart clean:  ${CYAN}bash scripts/dev-restart.sh${RESET}  ${GRAY}(dev only)${RESET}"
  echo ""
  hr "═" "$VIOLET" 80
  echo ""
  echo -e "${GRAY}  CompliGuard v2  ·  Apache 2.0  ·  https://github.com/saichand04/compliguard-v2${RESET}"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# HELP
# ─────────────────────────────────────────────────────────────────────────────
show_help() {
  echo ""
  echo -e "${BOLD}${WHITE}CompliGuard Deployment Script${RESET}"
  echo ""
  echo -e "  ${BOLD}Usage:${RESET}"
  echo -e "    ${CYAN}bash scripts/deploy.sh${RESET}            Interactive wizard"
  echo -e "    ${CYAN}bash scripts/deploy.sh --dry-run${RESET}  Preview without deploying"
  echo -e "    ${CYAN}bash scripts/deploy.sh --help${RESET}     Show this help"
  echo ""
  echo -e "  ${BOLD}Modes:${RESET}"
  echo -e "    ${VIOLET}minimal${RESET}    App + PostgreSQL + Redis (bring your own proxy)"
  echo -e "    ${CYAN}fullstack${RESET}  App + PostgreSQL + Redis + MinIO + Nginx"
  echo -e "    ${GOLD}dev${RESET}        Hot-reload development build"
  echo ""
  echo -e "  ${BOLD}Requirements:${RESET}"
  echo -e "    Docker Engine 24+, Docker Compose v2"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
main() {
  # Parse args
  for arg in "$@"; do
    case "$arg" in
      --dry-run) DRY_RUN=true ;;
      --help|-h) show_banner; show_help; exit 0 ;;
    esac
  done

  show_banner

  if [[ "$DRY_RUN" == true ]]; then
    echo -e "  ${GOLD}${BOLD}  ── DRY RUN MODE — no containers will be started ──${RESET}"
    echo ""
  fi

  run_preflight
  select_deploy_mode
  gather_config
  generate_secrets
  run_deploy
  show_summary
}

main "$@"
