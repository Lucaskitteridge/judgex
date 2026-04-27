import { fetchPdf } from "../lib/fetcher";
import pdfParse from "pdf-parse";

describe("fetchPdf", () => {
  it("fetches a real ISU protocol PDF and returns a buffer", async () => {
    const buffer = await fetchPdf("2425", "gpusa2024");

    expect(buffer).not.toBeNull();
    expect(buffer!.byteLength).toBeGreaterThan(0);
  }, 30000);

  it("returns null for a non-existent event code", async () => {
    const buffer = await fetchPdf("2425", "fakeevent9999");

    expect(buffer).toBeNull();
  }, 30000);

  it("parses fetched PDF and extracts text", async () => {
    const buffer = await fetchPdf("2425", "gpusa2024");
    expect(buffer).not.toBeNull();

    const pdf = await pdfParse(buffer!);

    expect(pdf.text).toBeTruthy();
    expect(pdf.text.length).toBeGreaterThan(100);
  }, 30000);
});
