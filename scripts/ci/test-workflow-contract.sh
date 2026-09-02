#!/bin/sh

set -eu

repo_root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
heavy="$repo_root/.github/workflows/ci.yml"
metadata="$repo_root/.github/workflows/consumes-expand-gate.yml"
template="$repo_root/.github/pull_request_template.md"

require_literal() {
  file=$1
  literal=$2
  grep -Fq -- "$literal" "$file" || {
    printf 'missing required workflow contract in %s: %s\n' "$file" "$literal" >&2
    exit 1
  }
}

require_literal "$metadata" 'types: [opened, synchronize, reopened, edited]'
require_literal "$metadata" 'name: Consumes-Expand declaration gate'
require_literal "$metadata" 'group: frontend-contract-${{ github.event.pull_request.number }}'
require_literal "$heavy" 'types: [opened, synchronize, reopened]'
require_literal "$heavy" 'group: frontend-ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}'
require_literal "$heavy" "node-version: '22'"
require_literal "$heavy" 'run: npm run test:ci-contract'
require_literal "$template" 'Consumes-Expand: <none or IaC task PR number(s)>'

if grep -Fxq 'Consumes-Expand: none' "$template"; then
  printf 'PR template must not predeclare a fail-open Consumes-Expand value\n' >&2
  exit 1
fi
require_literal "$repo_root/.githooks/pre-push" 'npm run test:ci-contract'

if grep -Fq 'edited' "$heavy"; then
  printf 'heavy frontend workflow must not react to pull_request.edited\n' >&2
  exit 1
fi

if grep -Fq 'Consumes-Expand declaration gate' "$heavy"; then
  printf 'metadata declaration gate must not remain in the heavy workflow\n' >&2
  exit 1
fi

printf 'frontend workflow contract passed\n'
