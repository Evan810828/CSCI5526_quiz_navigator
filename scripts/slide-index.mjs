// Each PDF page is indexed independently of the hand-written Markdown index.
export function pageText(content) {
  let text='', previous;
  for(const item of content.items.filter(item=>typeof item.str==='string')) {
    if(previous&&!text.endsWith('\n')&&!/\s$/.test(text)&&!/^\s/.test(item.str)) {
      const sameLine=previous.transform&&item.transform&&Math.abs(previous.transform[5]-item.transform[5])<Math.max(item.height||0,previous.height||0)*.2;
      const gap=item.transform&&previous.transform?item.transform[4]-previous.transform[4]-previous.width:Infinity;
      // Join adjacent glyphs (e.g. P r e c i s i o n), but keep separate columns/words apart.
      if(!sameLine||gap>Math.max(item.height||0,previous.height||0)*.12||gap< -Math.max(previous.width||0,1)*.3)text+=' ';
    }
    text+=item.str+(item.hasEOL?'\n':'');
    previous=item;
  }
  return text
    .normalize('NFKC').replace(/[\u00ad\u200b]/g, '')
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function indexSlides(document, lecture) {
  const entries = [], lowTextPages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const text = pageText(await page.getTextContent());
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    const heading = lines.find(line => /[\p{L}]/u.test(line) && !/^\d+$/.test(line));
    const title = heading ? heading.slice(0, 150) : `Slide ${pageNumber}`;
    entries.push({
      id: `slide-${lecture.lectureNumber}-${pageNumber}`, title, category: 'Slides',
      keywords: [], explanation: text, rawText: text, rawMarkdown: '', cells: [],
      sourceSection: 'Lecture slides', sourceContext: lecture.title, sourceLine: 0,
      lectureTitles: lecture.title,
      references: [{ lectureNumber: lecture.lectureNumber, pdfFilename: lecture.pdfFilename, startPage: pageNumber }],
    });
    page.cleanup();
  }
  // Repeated running headers are retained in searchable text, but not used as titles.
  const firstLines=new Map();
  for(const entry of entries){const line=entry.rawText.split('\n')[0];firstLines.set(line,(firstLines.get(line)||0)+1);}
  const headers=new Set([...firstLines].filter(([,count])=>count>Math.max(2,entries.length/2)).map(([line])=>line));
  const boilerplate=line=>headers.has(line)||/^(Computer Science & Engineering.*|Science &|Engineering|CSCI 5526|Fall \d{4}.*|Varatharajah, CSCI 5526.*)$/.test(line);
  for(const entry of entries){
    const contentLines=entry.rawText.split('\n').filter(line=>!boilerplate(line));
    const heading=contentLines.find(line=>/[\p{L}]/u.test(line));
    entry.title=heading?.slice(0,150)||`Slide ${entry.references[0].startPage}`;
    if(contentLines.join('').replace(/[^\p{L}\p{N}]/gu,'').length<40)lowTextPages.push(entry.references[0].startPage);
  }
  return { entries, lowTextPages };
}
