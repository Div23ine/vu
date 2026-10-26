import { HttpError } from '../../../lib/http-error.js';
import type { ObjectStorage } from '../../../lib/object-storage.js';

/**
 * Signed authorisation to test.
 *
 * No scan is created without a document that says the client authorised it, and
 * the document is never accepted as a path a caller typed: the API issues the
 * object key, under the caller's own organisation prefix, and then checks that an
 * object actually exists at that key before it will queue a job.
 *
 * Keys are `authorisations/<orgId>/<uuid>.pdf`. The org prefix is what stops one
 * client pointing a scan at another client's paperwork.
 */

/** Object-storage prefix for signed authorisations. */
export const AUTHORISATION_PREFIX = 'authorisations/';

/** The only content type accepted: a signed document is a PDF. */
export const AUTHORISATION_CONTENT_TYPE = 'application/pdf';

/** 10 MB. */
export const AUTHORISATION_MAX_BYTES = 10_485_760;

/** How long an upload URL stays valid. */
export const AUTHORISATION_UPLOAD_SECONDS = 300;

export interface AuthorisationUpload {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

export interface IssueUploadDeps {
  storage: ObjectStorage;
  orgId: string;
  now?: () => Date;
  randomUuid?: () => string;
}

/** `authorisations/<orgId>/<uuid>.pdf` */
export function authorisationObjectKey(orgId: string, fileId: string): string {
  return `${AUTHORISATION_PREFIX}${orgId}/${fileId}.pdf`;
}

/**
 * True when the key is a PDF inside THIS organisation's prefix.
 *
 * Checked before any storage call, so a key belonging to another org is refused
 * without the API ever looking at it.
 */
export function isAuthorisationKeyForOrg(key: string, orgId: string): boolean {
  return key.startsWith(`${AUTHORISATION_PREFIX}${orgId}/`) && key.endsWith('.pdf');
}

/** Presign a PUT the browser uploads straight to object storage. */
export async function issueAuthorisationUpload(
  deps: IssueUploadDeps,
): Promise<AuthorisationUpload> {
  const now = deps.now ?? (() => new Date());
  const randomUuid = deps.randomUuid ?? ((): string => crypto.randomUUID());
  const objectKey = authorisationObjectKey(deps.orgId, randomUuid());

  const { url } = await deps.storage.presignPut({
    key: objectKey,
    contentType: AUTHORISATION_CONTENT_TYPE,
    maxBytes: AUTHORISATION_MAX_BYTES,
    expiresSec: AUTHORISATION_UPLOAD_SECONDS,
  });

  return {
    uploadUrl: url,
    objectKey,
    expiresAt: new Date(now().getTime() + AUTHORISATION_UPLOAD_SECONDS * 1_000).toISOString(),
  };
}

/**
 * Prove the document is really there.
 *
 * A key that is not ours, or ours but empty, is `422 authorisation_missing`: the
 * request is understood and refused, not a validation error about the shape of a
 * string.
 */
export async function assertAuthorisationPresent(deps: {
  storage: ObjectStorage;
  key: string;
  orgId: string;
}): Promise<void> {
  if (!isAuthorisationKeyForOrg(deps.key, deps.orgId)) {
    throw new HttpError(
      422,
      'authorisation_missing',
      'Upload a signed authorisation for this organisation first',
    );
  }
  const metadata = await deps.storage.head(deps.key).catch(() => null);
  if (metadata === null || metadata.size <= 0) {
    throw new HttpError(
      422,
      'authorisation_missing',
      'Upload a signed authorisation for this organisation first',
    );
  }
}
