import axios from 'axios';
import { httpClient } from './api/httpClient';
import { preparePdfPrintWindow } from './pdf-browser';

interface PdfRequest { url: string; method?: 'GET' | 'POST'; data?: unknown; params?: Record<string, string> }

/** Uses one authenticated blob transport for invoice/label downloads and native browser printing; never accesses a server printer. */
export async function downloadPdf(request: PdfRequest, filename: string, print = false): Promise<void> {
  const printWindow = print ? preparePdfPrintWindow() : null;
  try {
    const { data } = await httpClient.request<Blob>({ ...request, responseType: 'blob', timeout: 60000 });
    const url = URL.createObjectURL(data);
    if (printWindow) printWindow.location.replace(url);
    else { const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click(); }
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (error) {
    printWindow?.close();
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Retain the original HTTP error. */ }
    }
    throw error;
  }
}
