#!/bin/sh
# CompliGuard Docker entrypoint
#
# Runtime assertions for secrets that were given placeholder values during
# `docker build`. Build-time ARGs are inlined into the image layer so anyone
# who can pull the image can read them — these placeholders are deliberately
# unusable, and this script ensures the operator has supplied real values
# before the Node process boots.
set -e

# The literal string used by the Dockerfile's BUILD_NEXTAUTH_SECRET ARG default.
# Keep these in sync with Dockerfile.
PLACEHOLDER="DO_NOT_USE_AT_RUNTIME_REPLACE_VIA_ENV"

fail() {
  echo "compliguard entrypoint: FATAL: $1" >&2
  echo "compliguard entrypoint:   Set this in your .env / docker-compose env block before starting." >&2
  exit 1
}

if [ -z "${NEXTAUTH_SECRET:-}" ] || [ "${NEXTAUTH_SECRET}" = "${PLACEHOLDER}" ]; then
  fail "NEXTAUTH_SECRET is unset or still the build-time placeholder."
fi

if [ -z "${JWT_SECRET:-}" ] || [ "${JWT_SECRET}" = "${PLACEHOLDER}" ]; then
  fail "JWT_SECRET is unset or still the build-time placeholder."
fi

# Soft length check — refuse anything shorter than 32 chars. Both secrets are
# used by JWT/session signing; <32 bytes is brute-forceable on a laptop.
if [ "${#NEXTAUTH_SECRET}" -lt 32 ]; then
  fail "NEXTAUTH_SECRET must be at least 32 characters (got ${#NEXTAUTH_SECRET})."
fi
if [ "${#JWT_SECRET}" -lt 32 ]; then
  fail "JWT_SECRET must be at least 32 characters (got ${#JWT_SECRET})."
fi

exec node server.js
