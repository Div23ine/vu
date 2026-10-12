{{/*
Common labels. Every object in every chart carries these, so `kubectl get
-all -l app.kubernetes.io/part-of=vunvault` is a real inventory.
*/}}
{{- define "vv-lib.labels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .release }}
app.kubernetes.io/part-of: vunvault
app.kubernetes.io/managed-by: {{ .managedBy }}
{{- end -}}

{{/*
Selector labels — the immutable subset (name + instance). Adding a mutable
label here would orphan every running pod on the next upgrade.
*/}}
{{- define "vv-lib.selectorLabels" -}}
app.kubernetes.io/name: {{ .name }}
app.kubernetes.io/instance: {{ .release }}
{{- end -}}
