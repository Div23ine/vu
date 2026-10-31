# Pinned scan tools

Built into `Dockerfile.runner`. Versions and checksums arrive as **build args**;
none has a default, so a build without them fails loudly instead of fetching
whatever a URL currently serves. CI supplies them from the upstream release
artefacts (`SOURCE_COMMIT` and `BUILD_DATE` become image labels).

| Tool             | Build args                             | Source                                         | Why this one                                                                              |
| ---------------- | -------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| nmap             | `NMAP_PACKAGE` (e.g. `nmap=7.93*`)     | Debian 12 apt                                  | Connect scans only (`-sT`). A SYN scan needs `CAP_NET_RAW`, which the pod never has.      |
| nuclei           | `NUCLEI_VERSION`, `NUCLEI_SHA256`      | `github.com/projectdiscovery/nuclei/releases`  | Template engine. Runs with `-ni` (no interactsh/OOB) and `-no-update-templates`.          |
| httpx            | `HTTPX_VERSION`, `HTTPX_SHA256`        | `github.com/projectdiscovery/httpx/releases`   | HTTP probing; `-json` output only.                                                        |
| testssl.sh       | `TESTSSL_VERSION`, `TESTSSL_SHA256`    | `github.com/drwetter/testssl.sh` tags          | TLS review; needs `sh`, the only shell kept in the image.                                 |
| nuclei templates | `NUCLEI_TEMPLATES_REF` (tag or commit) | `github.com/projectdiscovery/nuclei-templates` | Fetched at **build** time into `/opt/nuclei-templates`; nothing is downloaded at runtime. |

Checksums are verified with `sha256sum -c` during the build, and a mismatch
fails the build.

## What is never allowed

`-sS`, `-O`, `--privileged`, `-iL`, `--script <arbitrary>`. Every nuclei
invocation carries `-etags dos,bruteforce,intrusive,fuzz`, appended by
`runner/src/plan.ts` so no plan can forget it.

## Hardening the image relies on

Read-only root filesystem, all capabilities dropped, non-root `65532:65532`, no
package manager, no shell except `sh`, no setuid/setgid binary (the final
`find / -xdev -perm /6000 -type f -delete`), writable only at `/tmp` (a 1 GiB
tmpfs), and no network egress except the pinned target IPs.
