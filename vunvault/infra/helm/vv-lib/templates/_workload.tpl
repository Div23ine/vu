{{/*
The workload templates (Task 100).

One definition of the hardening contract for all five services — a chart
that "forgets" readOnlyRootFilesystem cannot be written without editing THIS
file, and Task 104's checker reads it back.

Expected dict shape (see any service chart's deployment.yaml):
  .ctx         the root context ($)
  .name        chart-local workload name (e.g. "api")
  .image       { repository, tag, digest? }
  .replicas    int
  .serviceAccountName string
  .env         list of { name, value } (plain, non-secret only)
  .envFrom     list of secret names
  .port        containerPort (0 = no port)
  .probe       { path, port } health endpoint
  .resources   { requests, limits }
  .nodeSelector/.tolerations optional
  .extraPodSpec optional raw pod-spec additions (rarely used)
*/}}

{{- define "vv-lib.imageRef" -}}
{{- if not .image.tag -}}
{{- fail "image.tag is required: CI supplies the pinned tag (GIT_SHA). 'latest' is never deployable." -}}
{{- end -}}
{{- if .image.digest -}}
{{- printf "%s@%s" .image.repository .image.digest -}}
{{- else -}}
{{- printf "%s:%s" .image.repository .image.tag -}}
{{- end -}}
{{- end -}}

{{- define "vv-lib.securityContext.pod" -}}
runAsNonRoot: true
runAsUser: 65532
runAsGroup: 65532
fsGroup: 65532
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{- define "vv-lib.securityContext.container" -}}
allowPrivilegeEscalation: false
privileged: false
capabilities:
  drop: ["ALL"]
readOnlyRootFilesystem: true
{{- end -}}

{{- define "vv-lib.deployment" -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ printf "vv-%s" .name }}
  labels:
    {{- include "vv-lib.labels" (dict "name" .name "release" .ctx.Release.Name "managedBy" .ctx.Release.Service) | nindent 4 }}
spec:
  replicas: {{ .replicas }}
  revisionHistoryLimit: 3
  selector:
    matchLabels:
      {{- include "vv-lib.selectorLabels" (dict "name" .name "release" .ctx.Release.Name) | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "vv-lib.labels" (dict "name" .name "release" .ctx.Release.Name "managedBy" .ctx.Release.Service) | nindent 8 }}
    spec:
      serviceAccountName: {{ .serviceAccountName }}
      imagePullSecrets:
        - name: ocir-pull
      securityContext:
        {{- include "vv-lib.securityContext.pod" . | nindent 8 }}
      terminationGracePeriodSeconds: 30
      containers:
        - name: {{ .name }}
          image: {{ include "vv-lib.imageRef" . | quote }}
          imagePullPolicy: IfNotPresent
          securityContext:
            {{- include "vv-lib.securityContext.container" . | nindent 12 }}
          {{- if gt (int .port) 0 }}
          ports:
            - name: http
              containerPort: {{ .port }}
              protocol: TCP
          {{- end }}
          {{- if .env }}
          env:
            {{- toYaml .env | nindent 12 }}
          {{- end }}
          {{- if .envFrom }}
          envFrom:
            {{- range .envFrom }}
            - secretRef:
                name: {{ . }}
            {{- end }}
          {{- end }}
          {{- if .probe }}
          startupProbe:
            httpGet:
              path: {{ .probe.path }}
              port: {{ .probe.port }}
            failureThreshold: 30
            periodSeconds: 2
          livenessProbe:
            httpGet:
              path: {{ .probe.path }}
              port: {{ .probe.port }}
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: {{ .probe.path }}
              port: {{ .probe.port }}
            periodSeconds: 5
            failureThreshold: 3
          {{- end }}
          resources:
            {{- toYaml .resources | nindent 12 }}
          volumeMounts:
            # The root filesystem is read-only; /tmp is the one writable path
            # (BullMQ's temp files, pino's fallback, Node's os.tmpdir()).
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: 256Mi
      {{- with .nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
{{- end -}}

{{- define "vv-lib.serviceAccount" -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ .serviceAccountName }}
  labels:
    {{- include "vv-lib.labels" (dict "name" .name "release" .ctx.Release.Name "managedBy" .ctx.Release.Service) | nindent 4 }}
  {{- with .annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
automountServiceAccountToken: {{ .automountServiceAccountToken | default true }}
{{- end -}}

{{- define "vv-lib.service" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ printf "vv-%s" .name }}
  labels:
    {{- include "vv-lib.labels" (dict "name" .name "release" .ctx.Release.Name "managedBy" .ctx.Release.Service) | nindent 4 }}
spec:
  type: ClusterIP
  selector:
    {{- include "vv-lib.selectorLabels" (dict "name" .name "release" .ctx.Release.Name) | nindent 4 }}
  ports:
    - name: http
      port: {{ .servicePort }}
      targetPort: http
      protocol: TCP
{{- end -}}

{{/*
ExternalSecret from the oci-vault ClusterSecretStore (Task 98 bootstrap).
.vaultSecrets is a map of ENV_NAME -> secret OCID. OCIDs are identifiers, not
secrets; the VALUES arrive from Vault at sync time and never touch git.
*/}}
{{- define "vv-lib.externalSecret" -}}
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: {{ printf "vv-%s-secrets" .name }}
  labels:
    {{- include "vv-lib.labels" (dict "name" .name "release" .ctx.Release.Name "managedBy" .ctx.Release.Service) | nindent 4 }}
spec:
  refreshInterval: 15m
  secretStoreRef:
    kind: ClusterSecretStore
    name: oci-vault
  target:
    name: {{ printf "vv-%s-secrets" .name }}
    creationPolicy: Owner
  data:
    {{- range $envName, $ocid := .vaultSecrets }}
    {{- if $ocid }}
    - secretKey: {{ $envName }}
      remoteRef:
        key: {{ $ocid | quote }}
    {{- end }}
    {{- end }}
{{- end -}}
