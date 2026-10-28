export interface SlideReference {
  lectureNumber: number;
  pdfFilename: string;
  startPage: number;
  endPage?: number;
}
export type Category = 'Concepts' | 'Quiz Questions' | 'Lecture Topics' | 'Formulas' | 'Comparisons' | 'Clinical Cases' | 'Quick Lookup' | 'Slides' | 'Other';
export interface SearchEntry {
  id: string;
  title: string;
  keywords: string[];
  explanation: string;
  category: Category;
  references: SlideReference[];
  sourceSection: string;
  sourceContext: string;
  sourceLine: number;
  rawText: string;
  rawMarkdown: string;
  cells: { heading: string; markdown: string; text: string }[];
  lectureTitles: string;
}
export interface Lecture {
  lectureNumber: number;
  title: string;
  pdfFilename: string;
  pageCount: number;
  available: boolean;
  sha256?: string;
}
export interface KnowledgeBase {
  entries: SearchEntry[];
  slideEntries: SearchEntry[];
  lectures: Lecture[];
  sourceFilename: string;
  sourceHash: string;
  report: { searchRows: number; tableRows: number; validReferences: number; errors: number; warnings: number; slidePages: number; textPages: number };
}
export interface ViewState {
  q: string;
  mode: string;
  category: string;
  filters: number[];
  sort: string;
  lecture?: number;
  page?: number;
  file?: string;
  start?: number;
  end?: number;
  entry?: string;
}
export interface SavedItem { key: string; entryId?: string; title: string; reference?: SlideReference; at: number }
