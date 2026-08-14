# P10-COMP-03 blocked contracts

These entries are intentionally `blocked-by-contract`. They have no source file,
no public barrel export, no placeholder implementation, and no local cached
business truth. A later implementation requires an authoritative contract
revision and a new exact ownership claim; this document does not assign them to
an existing later task.

| Registry component | Missing authority | Fail-closed proof |
| --- | --- | --- |
| `DirectoryPersonPickerAdapter` | Person-directory query API, permission and data-scope contract, stable identity projection, pagination/search semantics | No implementation/export; no cached or invented person directory |
| `DirectoryOrganizationPickerAdapter` | Organization-directory query API, permission and data-scope contract, stable hierarchy projection, pagination/search semantics | No implementation/export; no cached or invented organization hierarchy |
| `ManagedUpload` | Upload-session API, attachment lifecycle, virus-scan state, permission/data-scope and audit contract | No implementation/export; no local fake upload or fabricated success state |

The public alias test explicitly proves all three names are absent from
`@sgj/platform-ui`. The registry retains their intended names and paths only as
canonical planned authority; `blocked-by-contract` forbids a source or barrel
export until the missing contracts are supplied.
