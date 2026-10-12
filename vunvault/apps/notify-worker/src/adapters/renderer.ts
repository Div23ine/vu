import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import type { PdfRenderer } from '../ports';

/**
 * `@react-pdf/renderer` behind the `PdfRenderer` port.
 *
 * `renderToBuffer` is the Node entry point — it runs yoga layout and font
 * subsetting in-process and resolves with the finished PDF. Tests replace this
 * adapter with a fake; `src/pdf/render.test.ts` exercises the real renderer
 * against both documents so a broken layout fails CI, not the first customer.
 */
export class ReactPdfRenderer implements PdfRenderer {
  async render(document: unknown): Promise<Uint8Array> {
    const buffer = await renderToBuffer(document as ReactElement<DocumentProps>);
    return new Uint8Array(buffer);
  }
}
